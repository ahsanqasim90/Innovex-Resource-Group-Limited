import crypto from "crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import NewsletterCampaign from "../models/NewsletterCampaign.js";
import NewsletterSubscriber from "../models/NewsletterSubscriber.js";
import EmailLog from "../models/EmailLog.js";
import { allowedSenderAccountsForUser, canUseSender } from "../config/emailAccounts.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { logActivity } from "../services/activityLogService.js";
import { buildNewsletterEmail, sendNewsletterEmail } from "../services/emailService.js";
import { validateEmail } from "../utils.js";

const router = express.Router();
const publicLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false });
const consentVersion = "newsletter-consent-2026-08";
const validInterests = ["Recruitment", "Training", "Website Development", "SEO", "Reg 44", "Business Growth", "General"];
const individualTypes = new Set(["Individual", "Sole trader", "Ordinary partnership"]);

function actor(req) {
  return { user: req.user?._id, name: req.user?.name || "System", email: req.user?.email || "", role: req.user?.role || "" };
}

function slugify(value = "") {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || `newsletter-${Date.now()}`;
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenSecret() {
  return process.env.NEWSLETTER_TOKEN_SECRET || process.env.JWT_SECRET;
}

function unsubscribeToken(subscriber) {
  const id = String(subscriber._id);
  const signature = crypto.createHmac("sha256", tokenSecret()).update(`newsletter:${id}`).digest("base64url");
  return `${id}.${signature}`;
}

function subscriberFromToken(token = "") {
  const [id, supplied] = String(token).split(".");
  if (!/^[a-f\d]{24}$/i.test(id) || !supplied) return null;
  const expected = crypto.createHmac("sha256", tokenSecret()).update(`newsletter:${id}`).digest("base64url");
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) return null;
  return id;
}

function publicOrigin() {
  return String(process.env.CLIENT_URL || "https://www.innovexresourcegroup.co.uk").replace(/\/$/, "");
}

function unsubscribeUrl(subscriber) {
  return `${publicOrigin()}/newsletter/unsubscribe/${unsubscribeToken(subscriber)}`;
}

function eligibility(subscriber) {
  if (subscriber.status !== "Subscribed") return { eligible: false, reason: `Status is ${subscriber.status}` };
  if (subscriber.subscriberType === "Unknown") return { eligible: false, reason: "Subscriber type is not verified" };
  if (!subscriber.privacyNoticeSentAt) return { eligible: false, reason: "Privacy notice has not been recorded" };

  if (individualTypes.has(subscriber.subscriberType)) {
    if (!["Consent", "Soft opt-in"].includes(subscriber.lawfulBasis)) return { eligible: false, reason: "Consent or a valid soft opt-in is required" };
    if (!subscriber.consentObtainedAt || !subscriber.basisEvidence) return { eligible: false, reason: "Consent/soft opt-in evidence is incomplete" };
    return { eligible: true, reason: subscriber.lawfulBasis };
  }

  if (subscriber.subscriberType === "Corporate") {
    if (["Consent", "Soft opt-in"].includes(subscriber.lawfulBasis) && subscriber.consentObtainedAt && subscriber.basisEvidence) return { eligible: true, reason: subscriber.lawfulBasis };
    if (subscriber.lawfulBasis === "Legitimate interests" && subscriber.liaReference && subscriber.basisEvidence) return { eligible: true, reason: "Documented B2B legitimate interests" };
    return { eligible: false, reason: "Corporate contact needs consent evidence or a documented LIA" };
  }
  return { eligible: false, reason: "Lawful basis is incomplete" };
}

function subscriberPayload(body = {}, req) {
  const email = String(body.email || "").trim().toLowerCase();
  validateEmail(email);
  const payload = {
    email,
    firstName: String(body.firstName || "").trim(),
    lastName: String(body.lastName || "").trim(),
    companyName: String(body.companyName || "").trim(),
    subscriberType: body.subscriberType || "Unknown",
    interests: Array.isArray(body.interests) ? body.interests.filter((item) => validInterests.includes(item)) : [],
    status: body.status || "Subscribed",
    lawfulBasis: body.lawfulBasis || "Not recorded",
    basisEvidence: String(body.basisEvidence || "").trim(),
    liaReference: String(body.liaReference || "").trim(),
    consentWordingVersion: String(body.consentWordingVersion || "").trim(),
    source: String(body.source || "Admin entry").trim(),
    sourceIp: body.sourceIp || req?.ip || ""
  };
  ["consentObtainedAt", "privacyNoticeSentAt"].forEach((key) => {
    if (body[key]) payload[key] = new Date(body[key]);
  });
  if (payload.status === "Unsubscribed" && !body.unsubscribedAt) payload.unsubscribedAt = new Date();
  if (body.unsubscribeReason !== undefined) payload.unsubscribeReason = String(body.unsubscribeReason || "").trim();
  if (body.suppressionReason !== undefined) payload.suppressionReason = String(body.suppressionReason || "").trim();
  return payload;
}

function campaignPayload(body = {}) {
  const ctaUrl = String(body.ctaUrl || "").trim();
  if (ctaUrl) {
    let parsed;
    try { parsed = new URL(ctaUrl, publicOrigin()); } catch { /* handled below */ }
    if (!parsed || parsed.protocol !== "https:") {
      const error = new Error("Campaign links must use a valid HTTPS address");
      error.statusCode = 400;
      throw error;
    }
  }
  return {
    internalName: String(body.internalName || "").trim(),
    subject: String(body.subject || "").trim(),
    preheader: String(body.preheader || "").trim(),
    headline: String(body.headline || "").trim(),
    introduction: String(body.introduction || "").trim(),
    insightTitle: String(body.insightTitle || "").trim(),
    insightBody: String(body.insightBody || "").trim(),
    ctaLabel: String(body.ctaLabel || "").trim(),
    ctaUrl,
    serviceFocus: Array.isArray(body.serviceFocus) ? body.serviceFocus.filter((item) => validInterests.includes(item) && item !== "General") : [],
    senderEmail: String(body.senderEmail || "").trim().toLowerCase(),
    audience: {
      subscriberTypes: Array.isArray(body.audience?.subscriberTypes) ? body.audience.subscriberTypes : [],
      interests: Array.isArray(body.audience?.interests) ? body.audience.interests.filter((item) => validInterests.includes(item)) : []
    },
    archivePublished: Boolean(body.archivePublished)
  };
}

function audienceFilter(campaign) {
  const filter = { status: "Subscribed" };
  if (campaign.audience?.subscriberTypes?.length) filter.subscriberType = { $in: campaign.audience.subscriberTypes };
  if (campaign.audience?.interests?.length) filter.interests = { $in: campaign.audience.interests };
  return filter;
}

router.post("/subscribe", publicLimiter, async (req, res, next) => {
  try {
    if (req.body.website) return res.status(202).json({ message: "Thank you." });
    if (req.body.consent !== true) return res.status(400).json({ message: "Please actively tick the newsletter consent box." });
    const now = new Date();
    const payload = subscriberPayload({
      ...req.body,
      subscriberType: "Individual",
      lawfulBasis: "Consent",
      status: "Subscribed",
      source: "Website newsletter form",
      consentObtainedAt: now,
      privacyNoticeSentAt: now,
      consentWordingVersion: consentVersion,
      basisEvidence: "Actively ticked: I would like Innovex Resource Group Limited to email me service news, practical insights and occasional offers. I can unsubscribe at any time."
    }, req);
    const existing = await NewsletterSubscriber.findOne({ email: payload.email });
    if (existing?.status === "Suppressed" || existing?.status === "Bounced") {
      return res.status(202).json({ message: "Your preference has been recorded. Please contact us if you need help." });
    }
    await NewsletterSubscriber.findOneAndUpdate({ email: payload.email }, { $set: payload, $unset: { unsubscribedAt: 1, unsubscribeReason: 1 } }, { upsert: true, new: true, runValidators: true });
    res.status(201).json({ message: "You are subscribed. You can unsubscribe from every newsletter at any time." });
  } catch (error) { next(error); }
});

router.get("/unsubscribe/:token", publicLimiter, async (req, res, next) => {
  try {
    const id = subscriberFromToken(req.params.token);
    if (!id) return res.status(400).json({ message: "This unsubscribe link is invalid." });
    const subscriber = await NewsletterSubscriber.findById(id).select("email status").lean();
    if (!subscriber) return res.status(404).json({ message: "Subscription was not found." });
    const [local, domain] = subscriber.email.split("@");
    res.json({ email: `${local.slice(0, 2)}***@${domain}`, status: subscriber.status });
  } catch (error) { next(error); }
});

router.post("/unsubscribe/:token", publicLimiter, async (req, res, next) => {
  try {
    const id = subscriberFromToken(req.params.token);
    if (!id) return res.status(400).json({ message: "This unsubscribe link is invalid." });
    const subscriber = await NewsletterSubscriber.findByIdAndUpdate(id, {
      $set: { status: "Unsubscribed", unsubscribedAt: new Date(), unsubscribeReason: "Recipient unsubscribe" }
    }, { new: true });
    if (!subscriber) return res.status(404).json({ message: "Subscription was not found." });
    res.json({ message: "You have been unsubscribed from Innovex marketing emails." });
  } catch (error) { next(error); }
});

router.get("/public", async (_req, res, next) => {
  try {
    const items = await NewsletterCampaign.find({ archivePublished: true, status: { $in: ["Sent", "Partially sent"] } })
      .select("campaignId internalName subject preheader headline introduction insightTitle serviceFocus slug publishedAt sentAt")
      .sort({ publishedAt: -1, sentAt: -1 }).limit(50).lean();
    res.json(items);
  } catch (error) { next(error); }
});

router.get("/public/:slug", async (req, res, next) => {
  try {
    const item = await NewsletterCampaign.findOne({ slug: req.params.slug, archivePublished: true, status: { $in: ["Sent", "Partially sent"] } })
      .select("campaignId internalName subject preheader headline introduction insightTitle insightBody ctaLabel ctaUrl serviceFocus slug publishedAt sentAt").lean();
    if (!item) return res.status(404).json({ message: "Newsletter not found" });
    res.json(item);
  } catch (error) { next(error); }
});

router.use(protect, requirePermission("newsletters.view"));

router.get("/summary", async (req, res, next) => {
  try {
    const [subscribed, unsubscribed, suppressed, campaigns, recent] = await Promise.all([
      NewsletterSubscriber.countDocuments({ status: "Subscribed" }),
      NewsletterSubscriber.countDocuments({ status: "Unsubscribed" }),
      NewsletterSubscriber.countDocuments({ status: { $in: ["Suppressed", "Bounced"] } }),
      NewsletterCampaign.countDocuments(),
      NewsletterCampaign.find().select("campaignId internalName subject status totals sentAt createdAt archivePublished slug").sort({ createdAt: -1 }).limit(10).lean()
    ]);
    const candidates = await NewsletterSubscriber.find({ status: "Subscribed" }).lean();
    const eligible = candidates.filter((item) => eligibility(item).eligible).length;
    res.json({ subscribed, eligible, blocked: subscribed - eligible, unsubscribed, suppressed, campaigns, recent });
  } catch (error) { next(error); }
});

router.get("/senders", (req, res) => res.json({ senders: allowedSenderAccountsForUser(req.user) }));

router.get("/subscribers", async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const regex = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [{ email: regex }, { firstName: regex }, { lastName: regex }, { companyName: regex }];
    }
    const [items, total] = await Promise.all([
      NewsletterSubscriber.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      NewsletterSubscriber.countDocuments(filter)
    ]);
    res.json({ items: items.map((item) => ({ ...item, compliance: eligibility(item) })), total, page, pages: Math.ceil(total / limit) || 1 });
  } catch (error) { next(error); }
});

router.post("/subscribers", requirePermission("newsletters.manage"), async (req, res, next) => {
  try {
    const payload = subscriberPayload(req.body, req);
    payload.createdBy = actor(req);
    const existing = await NewsletterSubscriber.findOne({ email: payload.email });
    if (existing) return res.status(409).json({ message: "This email already exists in the newsletter register. Update the existing record instead." });
    const item = await NewsletterSubscriber.create(payload);
    await logActivity(req, { module: "Newsletter Centre", action: "Create", entityType: "NewsletterSubscriber", entityId: item._id, summary: `Added newsletter recipient ${item.email}`, metadata: { subscriberType: item.subscriberType, lawfulBasis: item.lawfulBasis } });
    res.status(201).json({ ...item.toObject(), compliance: eligibility(item) });
  } catch (error) { next(error); }
});

router.put("/subscribers/:id", requirePermission("newsletters.manage"), async (req, res, next) => {
  try {
    const item = await NewsletterSubscriber.findByIdAndUpdate(req.params.id, subscriberPayload(req.body, req), { new: true, runValidators: true });
    if (!item) return res.status(404).json({ message: "Subscriber not found" });
    await logActivity(req, { module: "Newsletter Centre", action: "Update", entityType: "NewsletterSubscriber", entityId: item._id, summary: `Updated newsletter recipient ${item.email}`, metadata: { status: item.status, lawfulBasis: item.lawfulBasis } });
    res.json({ ...item.toObject(), compliance: eligibility(item) });
  } catch (error) { next(error); }
});

router.get("/campaigns", async (_req, res, next) => {
  try {
    const items = await NewsletterCampaign.find().select("-deliveries").sort({ createdAt: -1 }).limit(100).lean();
    res.json(items);
  } catch (error) { next(error); }
});

router.post("/campaigns", requirePermission("newsletters.manage"), async (req, res, next) => {
  try {
    const payload = campaignPayload(req.body);
    if (!payload.internalName || !payload.subject || !payload.headline || !payload.introduction || !payload.senderEmail) return res.status(400).json({ message: "Campaign name, subject, headline, introduction and sender are required." });
    if (!canUseSender(req.user, payload.senderEmail)) return res.status(403).json({ message: "You cannot use the selected sender mailbox." });
    const campaignId = `IRG-NL-${Date.now().toString(36).toUpperCase()}`;
    let slug = slugify(req.body.slug || payload.internalName);
    if (await NewsletterCampaign.exists({ slug })) slug = `${slug}-${Date.now().toString(36)}`;
    const item = await NewsletterCampaign.create({ ...payload, campaignId, slug, createdBy: actor(req) });
    await logActivity(req, { module: "Newsletter Centre", action: "Create", entityType: "NewsletterCampaign", entityId: item._id, summary: `Created newsletter ${item.campaignId}`, metadata: { subject: item.subject } });
    res.status(201).json(item);
  } catch (error) { next(error); }
});

router.put("/campaigns/:id", requirePermission("newsletters.manage"), async (req, res, next) => {
  try {
    const existing = await NewsletterCampaign.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Campaign not found" });
    if (existing.status !== "Draft") return res.status(409).json({ message: "A sent campaign is locked. Duplicate it to create a new edition." });
    const payload = campaignPayload(req.body);
    if (!canUseSender(req.user, payload.senderEmail)) return res.status(403).json({ message: "You cannot use the selected sender mailbox." });
    Object.assign(existing, payload);
    if (req.body.slug) existing.slug = slugify(req.body.slug);
    await existing.save();
    await logActivity(req, { module: "Newsletter Centre", action: "Update", entityType: "NewsletterCampaign", entityId: existing._id, summary: `Updated newsletter ${existing.campaignId}` });
    res.json(existing);
  } catch (error) { next(error); }
});

router.get("/campaigns/:id/audience", async (req, res, next) => {
  try {
    const campaign = await NewsletterCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    const subscribers = await NewsletterSubscriber.find(audienceFilter(campaign)).lean();
    const blocked = subscribers.filter((item) => !eligibility(item).eligible);
    res.json({ total: subscribers.length, eligible: subscribers.length - blocked.length, blocked: blocked.length, blockedReasons: blocked.reduce((result, item) => { const reason = eligibility(item).reason; result[reason] = (result[reason] || 0) + 1; return result; }, {}) });
  } catch (error) { next(error); }
});

router.post("/campaigns/:id/test", requirePermission("newsletters.manage"), async (req, res, next) => {
  try {
    const campaign = await NewsletterCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    const to = String(req.body.to || req.user.email).trim().toLowerCase();
    validateEmail(to);
    if (!canUseSender(req.user, campaign.senderEmail)) return res.status(403).json({ message: "You cannot use this sender mailbox." });
    const result = await sendNewsletterEmail({ campaign, subscriber: { firstName: req.user.name }, to, preview: true });
    if (!result.sent) throw Object.assign(new Error(result.reason || "Test newsletter could not be sent"), { statusCode: 400 });
    await EmailLog.create({ fromEmail: campaign.senderEmail, fromName: req.user.name, to: [to], subject: `[TEST] ${campaign.subject}`, message: campaign.introduction, targetType: "Newsletter", targetId: campaign._id, status: "Sent", sentBy: actor(req) });
    await logActivity(req, { module: "Newsletter Centre", action: "Test send", entityType: "NewsletterCampaign", entityId: campaign._id, summary: `Sent test for ${campaign.campaignId} to ${to}` });
    res.json({ message: `Test newsletter sent to ${to}.`, sent: result.sent });
  } catch (error) { next(error); }
});

router.post("/campaigns/:id/send", requirePermission("newsletters.manage"), async (req, res, next) => {
  let campaign;
  try {
    campaign = await NewsletterCampaign.findOneAndUpdate({ _id: req.params.id, status: "Draft" }, { $set: { status: "Sending" } }, { new: true });
    if (!campaign) return res.status(409).json({ message: "Only a draft campaign can be sent, or this campaign is already being processed." });
    if (!canUseSender(req.user, campaign.senderEmail)) throw Object.assign(new Error("You cannot use this sender mailbox."), { statusCode: 403 });
    const candidates = await NewsletterSubscriber.find(audienceFilter(campaign));
    const eligible = candidates.filter((item) => eligibility(item).eligible);
    const blocked = candidates.filter((item) => !eligibility(item).eligible);
    if (!eligible.length) throw Object.assign(new Error("No legally eligible subscribers match this audience. Review the compliance records first."), { statusCode: 400 });
    if (eligible.length > 250) throw Object.assign(new Error("This release is limited to 250 recipients per campaign. Narrow the audience before sending."), { statusCode: 400 });

    const deliveries = blocked.map((item) => ({ subscriber: item._id, email: item.email, status: "Suppressed", reason: eligibility(item).reason }));
    let sent = 0;
    let failed = 0;
    for (const subscriber of eligible) {
      try {
        const delivery = await sendNewsletterEmail({ campaign, subscriber, unsubscribeUrl: unsubscribeUrl(subscriber) });
        if (!delivery.sent) throw new Error(delivery.reason || "Newsletter could not be sent");
        sent += 1;
        deliveries.push({ subscriber: subscriber._id, email: subscriber.email, status: "Sent", sentAt: new Date() });
        subscriber.lastSentAt = new Date();
        await subscriber.save();
        await EmailLog.create({ fromEmail: campaign.senderEmail, fromName: req.user.name, to: [subscriber.email], subject: campaign.subject, message: campaign.introduction, targetType: "Newsletter", targetId: campaign._id, status: "Sent", sentBy: actor(req) });
      } catch (error) {
        failed += 1;
        deliveries.push({ subscriber: subscriber._id, email: subscriber.email, status: "Failed", reason: error.message });
        await EmailLog.create({ fromEmail: campaign.senderEmail, fromName: req.user.name, to: [subscriber.email], subject: campaign.subject, message: campaign.introduction, targetType: "Newsletter", targetId: campaign._id, status: "Failed", error: error.message, sentBy: actor(req) });
      }
    }
    campaign.status = failed ? "Partially sent" : "Sent";
    campaign.sentAt = new Date();
    campaign.sentBy = actor(req);
    campaign.publishedAt = campaign.archivePublished ? new Date() : undefined;
    campaign.totals = { eligible: eligible.length, sent, failed, suppressed: blocked.length };
    campaign.deliveries = deliveries.slice(-500);
    await campaign.save();
    await logActivity(req, { module: "Newsletter Centre", action: "Send", entityType: "NewsletterCampaign", entityId: campaign._id, summary: `Sent ${campaign.campaignId} to ${sent} recipients`, metadata: campaign.totals });
    res.json({ message: `Campaign complete: ${sent} sent, ${failed} failed, ${blocked.length} suppressed.`, campaign });
  } catch (error) {
    if (campaign?.status === "Sending") { campaign.status = "Draft"; await campaign.save().catch(() => undefined); }
    next(error);
  }
});

router.get("/campaigns/:id/preview", async (req, res, next) => {
  try {
    const campaign = await NewsletterCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    res.json(buildNewsletterEmail({ campaign, subscriber: { firstName: "A valued client" }, preview: true }));
  } catch (error) { next(error); }
});

export default router;
