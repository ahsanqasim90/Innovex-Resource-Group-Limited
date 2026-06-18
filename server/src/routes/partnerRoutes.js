import express from "express";
import Partner from "../models/Partner.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { fileMeta, uploadPartnerLogo } from "../middleware/upload.js";
import { pick, requireFields, validateEmail } from "../utils.js";

const router = express.Router();
const fields = ["name", "serviceProvided", "location", "contactEmail", "isActive"];

function serializePartner(partner) {
  const item = partner.toObject ? partner.toObject() : partner;
  if (item.logo?.filename) {
    item.logo.url = `/api/partners/${item._id}/logo`;
  }
  delete item.logo?.data;
  return item;
}

function partnerPayload(req) {
  const payload = pick(req.body, fields);
  if (payload.isActive !== undefined) {
    payload.isActive = payload.isActive === true || payload.isActive === "true";
  }
  if (req.file) {
    payload.logo = fileMeta(req.file);
  }
  return payload;
}

function protectAdminQuery(req, res, next) {
  if (req.query.admin) return protect(req, res, () => requirePermission("partners.view")(req, res, next));
  next();
}

router.get("/", protectAdminQuery, async (req, res, next) => {
  try {
    const filter = req.query.admin ? {} : { isActive: true };
    const partners = await Partner.find(filter).select("-logo.data").sort({ createdAt: -1 });
    res.json(partners.map(serializePartner));
  } catch (error) {
    next(error);
  }
});

router.get("/:id/logo", async (req, res, next) => {
  try {
    const partner = await Partner.findById(req.params.id).select("logo");
    if (!partner?.logo?.data) return res.status(404).json({ message: "Logo not found" });
    res.setHeader("Content-Type", partner.logo.mimetype || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(partner.logo.data);
  } catch (error) {
    next(error);
  }
});

router.post("/", protect, requirePermission("partners.view"), uploadPartnerLogo.single("logo"), async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "serviceProvided", "location"]);
    if (req.body.contactEmail) validateEmail(req.body.contactEmail);
    const partner = await Partner.create(partnerPayload(req));
    res.status(201).json(serializePartner(partner));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", protect, requirePermission("partners.view"), uploadPartnerLogo.single("logo"), async (req, res, next) => {
  try {
    if (req.body.contactEmail) validateEmail(req.body.contactEmail);
    const partner = await Partner.findByIdAndUpdate(req.params.id, partnerPayload(req), { new: true, runValidators: true });
    if (!partner) return res.status(404).json({ message: "Partner not found" });
    res.json(serializePartner(partner));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", protect, requirePermission("partners.view"), async (req, res, next) => {
  try {
    const partner = await Partner.findByIdAndDelete(req.params.id);
    if (!partner) return res.status(404).json({ message: "Partner not found" });
    res.json({ message: "Partner deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
