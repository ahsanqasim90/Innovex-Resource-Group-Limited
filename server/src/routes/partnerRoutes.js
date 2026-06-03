import express from "express";
import Partner from "../models/Partner.js";
import { protect } from "../middleware/auth.js";
import { uploadPartnerLogo } from "../middleware/upload.js";
import { pick, requireFields, validateEmail } from "../utils.js";

const router = express.Router();
const fields = ["name", "serviceProvided", "location", "contactEmail", "isActive"];

function partnerPayload(req) {
  const payload = pick(req.body, fields);
  if (payload.isActive !== undefined) {
    payload.isActive = payload.isActive === true || payload.isActive === "true";
  }
  if (req.file) {
    payload.logo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/logos/${req.file.filename}`
    };
  }
  return payload;
}

function protectAdminQuery(req, res, next) {
  if (req.query.admin) return protect(req, res, next);
  next();
}

router.get("/", protectAdminQuery, async (req, res, next) => {
  try {
    const filter = req.query.admin ? {} : { isActive: true };
    const partners = await Partner.find(filter).sort({ createdAt: -1 });
    res.json(partners);
  } catch (error) {
    next(error);
  }
});

router.post("/", protect, uploadPartnerLogo.single("logo"), async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "serviceProvided", "location"]);
    if (req.body.contactEmail) validateEmail(req.body.contactEmail);
    const partner = await Partner.create(partnerPayload(req));
    res.status(201).json(partner);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", protect, uploadPartnerLogo.single("logo"), async (req, res, next) => {
  try {
    if (req.body.contactEmail) validateEmail(req.body.contactEmail);
    const partner = await Partner.findByIdAndUpdate(req.params.id, partnerPayload(req), { new: true, runValidators: true });
    if (!partner) return res.status(404).json({ message: "Partner not found" });
    res.json(partner);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", protect, async (req, res, next) => {
  try {
    const partner = await Partner.findByIdAndDelete(req.params.id);
    if (!partner) return res.status(404).json({ message: "Partner not found" });
    res.json({ message: "Partner deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
