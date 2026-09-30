import crypto from "node:crypto";
import express from "express";
import multer from "multer";
import Job from "../models/Job.js";
import SocialMedia from "../models/SocialMedia.js";
import SocialPost from "../models/SocialPost.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { logActivity } from "../services/activityLogService.js";
import { buildJobCaption, mediaUrl, postToFacebook, postToInstagram, socialStatus, jobUrl } from "../services/socialPostService.js";
import { redactClientName } from "../utils/jobQuality.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1.5 * 1024 * 1024, files: 1 } });
const REPOST_GUARD_DAYS = 14;

// Public: Facebook and Instagram download the image from here. The key is an unguessable random value.
router.get("/media/:file", async (req, res, next) => {
  try {
    const key = String(req.params.file || "").replace(/\.jpg$/i, "");
    if (!/^[a-f0-9]{32}$/.test(key)) return res.status(404).end();
    const media = await SocialMedia.findOne({ key }).setOptions({ tenantBypass: true }).select("+data").lean();
    const data = Buffer.isBuffer(media?.data) ? media.data : media?.data?.buffer;
    if (!data) return res.status(404).end();
    res.set({ "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "cross-origin" });
    res.send(Buffer.from(data));
  } catch (error) {
    next(error);
  }
});

router.use(protect);

const canView = requirePermission("jobs.view", { inferAction: false });
const canPost = requirePermission("jobs.approve", { inferAction: false });

const isPublishable = (job) => job && job.isActive !== false && !["Closed", "Filled", "Paused"].includes(job.vacancyStatus) && (!job.publicationStatus || job.publicationStatus === "Approved");

router.get("/status", canView, (req, res) => {
  res.json(socialStatus());
});

router.get("/jobs", canView, async (req, res, next) => {
  try {
    const jobs = await Job.find({ isActive: { $ne: false }, vacancyStatus: { $nin: ["Closed", "Filled", "Paused"] } })
      .select("title location postcode salary type shift vacancyStatus publicationStatus createdAt reference")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const posts = await SocialPost.find({ job: { $in: jobs.map((job) => job._id) }, status: "Posted" }).select("job platform createdAt").sort({ createdAt: -1 }).lean();
    const postedByJob = new Map();
    for (const post of posts) {
      const entry = postedByJob.get(String(post.job)) || {};
      entry[post.platform] ||= post.createdAt;
      postedByJob.set(String(post.job), entry);
    }
    res.json(jobs.filter(isPublishable).map((job) => ({ ...job, posted: postedByJob.get(String(job._id)) || {} })));
  } catch (error) {
    next(error);
  }
});

router.get("/jobs/:id/draft", canView, async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).select("+clientName").lean();
    if (!job) return res.status(404).json({ message: "Vacancy not found" });
    const history = await SocialPost.find({ job: job._id }).sort({ createdAt: -1 }).limit(10).select("platform status url error createdAt postedBy.name").lean();
    res.json({ job: redactClientName(job), caption: buildJobCaption(job), url: jobUrl(job), publishable: isPublishable(job), history });
  } catch (error) {
    next(error);
  }
});

router.post("/media", canPost, upload.single("image"), async (req, res, next) => {
  try {
    const file = req.file;
    const isJpeg = file && file.buffer.length > 4 && file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
    if (!isJpeg) return res.status(400).json({ message: "The image must be a JPEG file under 1.5 MB." });
    const key = crypto.randomBytes(16).toString("hex");
    await SocialMedia.create({ key, job: req.body?.jobId || undefined, size: file.buffer.length, data: file.buffer, createdBy: req.user._id });
    res.status(201).json({ key, url: mediaUrl(key) });
  } catch (error) {
    next(error);
  }
});

router.post("/jobs/:id/publish", canPost, async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).select("+clientName").lean();
    if (!job) return res.status(404).json({ message: "Vacancy not found" });
    if (!isPublishable(job)) return res.status(400).json({ message: "Only open, approved vacancies can be posted." });

    const status = socialStatus();
    const requested = (Array.isArray(req.body?.platforms) ? req.body.platforms : []).map((item) => String(item).toLowerCase()).filter((item) => ["facebook", "instagram"].includes(item));
    if (!requested.length) return res.status(400).json({ message: "Choose at least one platform." });
    const notConnected = requested.filter((platform) => !status[platform]);
    if (notConnected.length) return res.status(400).json({ message: `${notConnected.join(" and ")} is not connected yet.` });

    // Safeguard: the client name can never reach a public post, even if it was typed into the caption.
    const caption = redactClientName({ caption: String(req.body?.caption || "").trim() }, job.clientName).caption.slice(0, 2200);
    if (caption.length < 20) return res.status(400).json({ message: "Write a caption before posting." });

    let imageUrl = "";
    const key = String(req.body?.mediaKey || "");
    if (key) {
      if (!/^[a-f0-9]{32}$/.test(key) || !(await SocialMedia.exists({ key }))) return res.status(400).json({ message: "The image expired. Regenerate it and try again." });
      imageUrl = mediaUrl(key);
    }
    if (requested.includes("instagram") && !imageUrl) return res.status(400).json({ message: "Instagram needs the job image." });

    const since = new Date(Date.now() - REPOST_GUARD_DAYS * 24 * 60 * 60 * 1000);
    const results = [];
    for (const platform of requested) {
      const label = platform === "facebook" ? "Facebook" : "Instagram";
      const already = await SocialPost.findOne({ job: job._id, platform: label, status: "Posted", createdAt: { $gte: since } }).lean();
      if (already && !req.body?.force) {
        results.push({ platform: label, status: "Skipped", message: `Already posted on ${new Date(already.createdAt).toLocaleDateString("en-GB")}. Turn on "post again" to repeat it.` });
        continue;
      }
      try {
        const outcome = platform === "facebook" ? await postToFacebook({ caption, imageUrl, link: jobUrl(job) }) : await postToInstagram({ caption, imageUrl });
        await SocialPost.create({ job: job._id, jobTitle: job.title, platform: label, status: "Posted", externalId: outcome.externalId, url: outcome.url, caption, postedBy: { user: req.user._id, name: req.user.name } });
        results.push({ platform: label, status: "Posted", url: outcome.url });
      } catch (error) {
        await SocialPost.create({ job: job._id, jobTitle: job.title, platform: label, status: "Failed", caption, error: String(error.message || "Posting failed").slice(0, 400), postedBy: { user: req.user._id, name: req.user.name } });
        results.push({ platform: label, status: "Failed", message: error.message || "Posting failed" });
      }
    }
    try {
      await logActivity(req, { module: "Social posting", action: "Vacancy posted to social media", entityType: "Job", entityId: job._id, summary: `${req.user.name} posted "${job.title}": ${results.map((item) => `${item.platform} ${item.status}`).join(", ")}` });
    } catch { /* audit logging must never block the result */ }
    res.json({ results });
  } catch (error) {
    next(error);
  }
});

export default router;
