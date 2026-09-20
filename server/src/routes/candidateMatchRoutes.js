import express from "express";
import { protect, requirePermission } from "../middleware/auth.js";
import { uploadCv } from "../middleware/upload.js";
import { extractDocumentText } from "../services/documentIntelligenceService.js";
import { matchCandidateToVacancies } from "../services/candidateMatchService.js";
import { logActivity } from "../services/activityLogService.js";

const router = express.Router();
router.use(protect, requirePermission("vacancyIntelligence.view", { inferAction: false }));

const text = (value, max = 300) => String(value || "").trim().slice(0, max);

// The CV is read in memory to score vacancies and is not stored.
router.post("/", uploadCv.single("cv"), async (req, res, next) => {
  try {
    const body = req.body || {};
    let cvText = text(body.cvText, 60000);
    let cvMeta = { originalName: "", verifiedType: "" };
    if (req.file) {
      const extracted = await extractDocumentText(req.file);
      cvText = [extracted.text, cvText].filter(Boolean).join("\n");
      cvMeta = { originalName: req.file.originalname, verifiedType: extracted.verifiedType };
    }
    const desiredRole = text(body.desiredRole);
    const experience = text(body.experience, 2000);
    if (cvText.length < 40 && !desiredRole && !experience) {
      return res.status(400).json({ message: "Attach a CV, or type the candidate's role and experience, so there is something to match." });
    }
    const result = await matchCandidateToVacancies(
      {
        name: text(body.name, 120) || "Candidate",
        email: text(body.email, 160),
        phone: text(body.phone, 40),
        postcode: text(body.postcode, 12),
        city: text(body.city, 80),
        desiredRole,
        experience,
        availability: text(body.availability, 200),
        shiftPreference: text(body.shiftPreference, 200),
        tags: text(body.tags, 400).split(",").map((tag) => tag.trim()).filter(Boolean),
        cv: { extractedText: cvText, ...cvMeta }
      },
      { limit: Math.min(Math.max(Number(body.limit || 15), 1), 40), minimumScore: Math.min(Math.max(Number(body.minimumScore || 0), 0), 100) }
    );
    try {
      await logActivity(req, { module: "Vacancy Intelligence", action: "CV vacancy matching", entityType: "Candidate", summary: `${req.user.name} matched a CV against ${result.analysedVacancies} open vacancies`, metadata: { analysedVacancies: result.analysedVacancies, returned: result.matches.length } });
    } catch { /* audit logging must never block the result */ }
    res.json({ ...result, generatedAt: new Date(), method: "Free rule-based matching: postcode distance, skills, role, shift and eligibility. No paid AI service." });
  } catch (error) {
    next(error);
  }
});

export default router;
