import express from "express";
import ClientTerms from "../models/ClientTerms.js";
import EmailLog from "../models/EmailLog.js";
import { protect } from "../middleware/auth.js";
import { hasPermission } from "../config/permissions.js";
import { allowedSenderAccountsForUser, canUseSender } from "../config/emailAccounts.js";
import { logActivity } from "../services/activityLogService.js";
import { generateClientTermsPdf } from "../services/clientTermsPdfService.js";
import { sendClientTermsEmail } from "../services/emailService.js";
import validator from "validator";

const router = express.Router();

function actorFrom(user) {
  return {
    user: user?._id,
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || ""
  };
}

function canViewTerms(req, res, next) {
  if (hasPermission(req.user, "terms.view") || hasPermission(req.user, "terms.manage")) return next();
  return res.status(403).json({ message: "You do not have permission to view client terms" });
}

function canManageTerms(req, res, next) {
  if (hasPermission(req.user, "terms.manage")) return next();
  return res.status(403).json({ message: "You do not have permission to manage client terms" });
}

function emailList(value) {
  if (Array.isArray(value)) return value.map(cleanEmail).filter(Boolean);
  return String(value || "")
    .split(/[,\n;]/)
    .map(cleanEmail)
    .filter(Boolean);
}

function cleanEmail(value) {
  return String(value || "")
    .replace(/^mailto:/i, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function isValidEmail(value) {
  const email = cleanEmail(value);
  return Boolean(email) && validator.isEmail(email);
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function nextDocumentNumber() {
  const last = await ClientTerms.findOne({ documentNumber: /^TERMS-/ }).sort({ createdAt: -1 }).select("documentNumber");
  const current = Number(String(last?.documentNumber || "").replace(/\D/g, "")) || 0;
  return `TERMS-${String(current + 1).padStart(6, "0")}`;
}

function normalizeRoleRates(roleRates = []) {
  return (Array.isArray(roleRates) ? roleRates : [])
    .map((rate) => ({
      roleTitle: String(rate.roleTitle || "").trim(),
      feeType: rate.feeType || "Percentage",
      rateValue: Number(rate.rateValue || 0),
      rateUnit: String(rate.rateUnit || "").trim() || (rate.feeType === "Flat Fee" ? "fixed fee" : "% of annual salary"),
      paymentTrigger: String(rate.paymentTrigger || "").trim() || "Payable on candidate start date",
      notes: String(rate.notes || "").trim()
    }))
    .filter((rate) => rate.roleTitle);
}

function normalizeClauses(clauses = []) {
  return (Array.isArray(clauses) ? clauses : [])
    .map((clause, index) => ({
      heading: String(clause.heading || "").trim(),
      body: String(clause.body || "").trim(),
      order: Number(clause.order || index + 1)
    }))
    .filter((clause) => clause.heading && clause.body);
}

function normalizePayload(body, existing = null) {
  const cc = emailList(body.cc);
  const invalidCc = cc.find((email) => !isValidEmail(email));
  if (invalidCc) {
    const error = new Error(`Invalid CC email: ${invalidCc}`);
    error.statusCode = 400;
    throw error;
  }

  const clientEmail = cleanEmail(body.clientEmail || existing?.clientEmail || "");
  if (!isValidEmail(clientEmail)) {
    const error = new Error("A valid client email is required");
    error.statusCode = 400;
    throw error;
  }

  const clientName = String(body.clientName || existing?.clientName || "").trim();
  if (!clientName) {
    const error = new Error("Client/company name is required");
    error.statusCode = 400;
    throw error;
  }

  const payload = {
    title: String(body.title || existing?.title || "Terms of Business").trim(),
    agreementType: body.agreementType || existing?.agreementType || "Recruitment",
    clientName,
    contactName: String(body.contactName || "").trim(),
    clientEmail,
    clientAddress: String(body.clientAddress || "").trim(),
    clientCompanyNumber: String(body.clientCompanyNumber || "").trim(),
    effectiveDate: body.effectiveDate || existing?.effectiveDate || new Date(),
    validUntil: body.validUntil || null,
    paymentDueDays: Number(body.paymentDueDays ?? existing?.paymentDueDays ?? 14),
    invoiceCycle: String(body.invoiceCycle || "").trim() || "Invoice issued on candidate start date or as agreed.",
    rebatePeriodDays: Number(body.rebatePeriodDays ?? existing?.rebatePeriodDays ?? 28),
    rebateTerms: String(body.rebateTerms || "").trim(),
    roleRates: normalizeRoleRates(body.roleRates),
    specialTerms: String(body.specialTerms || "").trim(),
    internalNotes: String(body.internalNotes || "").trim(),
    senderEmail: String(body.senderEmail || existing?.senderEmail || "info@innovexresourcegroup.co.uk").trim().toLowerCase(),
    cc
  };

  if (Array.isArray(body.clauses)) {
    const clauses = normalizeClauses(body.clauses);
    if (clauses.length) payload.clauses = clauses;
  } else if (existing?.clauses?.length) {
    payload.clauses = existing.clauses;
  }

  return payload;
}

router.use(protect);

router.get("/senders", canViewTerms, (req, res) => {
  res.json(allowedSenderAccountsForUser(req.user));
});

router.get("/", canViewTerms, async (req, res, next) => {
  try {
    const { search = "", status = "", agreementType = "" } = req.query;
    const query = {};
    if (status) query.status = status;
    if (agreementType) query.agreementType = agreementType;
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      query.$or = [
        { clientName: regex },
        { clientEmail: regex },
        { contactName: regex },
        { documentNumber: regex },
        { "roleRates.roleTitle": regex }
      ];
    }
    const terms = await ClientTerms.find(query).sort({ updatedAt: -1 }).limit(200);
    res.json(terms);
  } catch (error) {
    next(error);
  }
});

router.post("/", canManageTerms, async (req, res, next) => {
  try {
    const payload = normalizePayload(req.body);
    if (!canUseSender(req.user, payload.senderEmail)) {
      return res.status(403).json({ message: "You are not allowed to use this sender mailbox" });
    }
    const terms = await ClientTerms.create({
      ...payload,
      documentNumber: await nextDocumentNumber(),
      createdBy: actorFrom(req.user),
      updatedBy: actorFrom(req.user)
    });
    await logActivity(req, {
      module: "Client Terms",
      action: "Created",
      entityType: "ClientTerms",
      entityId: terms._id,
      summary: `Created client terms ${terms.documentNumber} for ${terms.clientName}`
    });
    res.status(201).json(terms);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", canViewTerms, async (req, res, next) => {
  try {
    const terms = await ClientTerms.findById(req.params.id);
    if (!terms) return res.status(404).json({ message: "Client terms not found" });
    res.json(terms);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", canManageTerms, async (req, res, next) => {
  try {
    const terms = await ClientTerms.findById(req.params.id);
    if (!terms) return res.status(404).json({ message: "Client terms not found" });
    const payload = normalizePayload(req.body, terms);
    if (!canUseSender(req.user, payload.senderEmail)) {
      return res.status(403).json({ message: "You are not allowed to use this sender mailbox" });
    }
    Object.assign(terms, payload, { updatedBy: actorFrom(req.user) });
    await terms.save();
    await logActivity(req, {
      module: "Client Terms",
      action: "Updated",
      entityType: "ClientTerms",
      entityId: terms._id,
      summary: `Updated client terms ${terms.documentNumber} for ${terms.clientName}`
    });
    res.json(terms);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/pdf", canViewTerms, async (req, res, next) => {
  try {
    const terms = await ClientTerms.findById(req.params.id);
    if (!terms) return res.status(404).json({ message: "Client terms not found" });
    const pdf = await generateClientTermsPdf(terms);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Innovex-Terms-${terms.documentNumber}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/send", canManageTerms, async (req, res, next) => {
  try {
    const terms = await ClientTerms.findById(req.params.id);
    if (!terms) return res.status(404).json({ message: "Client terms not found" });
    const fromEmail = cleanEmail(req.body.fromEmail || terms.senderEmail || "");
    if (!canUseSender(req.user, fromEmail)) {
      return res.status(403).json({ message: "You are not allowed to use this sender mailbox" });
    }
    const cc = emailList(req.body.cc || terms.cc);
    const invalidCc = cc.find((email) => !isValidEmail(email));
    if (invalidCc) return res.status(400).json({ message: `Invalid CC email: ${invalidCc}` });

    const pdf = await generateClientTermsPdf(terms);
    const delivery = await sendClientTermsEmail({
      terms,
      pdfBuffer: pdf,
      fromEmail,
      customMessage: req.body.message || "",
      cc
    });
    if (!delivery.sent) return res.status(500).json({ message: delivery.reason || "Unable to send client terms" });

    terms.status = "Sent";
    terms.senderEmail = delivery.fromEmail;
    terms.cc = cc;
    terms.sentAt = new Date();
    terms.sentFolderSaved = Boolean(delivery.sentFolderSaved);
    terms.sentFolderError = delivery.sentFolderError || "";
    terms.updatedBy = actorFrom(req.user);
    await terms.save();

    await EmailLog.create({
      fromEmail: delivery.fromEmail,
      fromName: "Innovex Resource Group Limited",
      to: [terms.clientEmail],
      cc,
      subject: delivery.subject,
      message: delivery.message,
      targetType: "Manual",
      targetId: terms._id,
      status: "Sent",
      sentBy: actorFrom(req.user)
    });

    await logActivity(req, {
      module: "Client Terms",
      action: "Sent",
      entityType: "ClientTerms",
      entityId: terms._id,
      summary: `Sent client terms ${terms.documentNumber} to ${terms.clientEmail}`
    });

    res.json({ terms, delivery });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/mark-signed", canManageTerms, async (req, res, next) => {
  try {
    const terms = await ClientTerms.findById(req.params.id);
    if (!terms) return res.status(404).json({ message: "Client terms not found" });
    terms.status = "Signed";
    terms.signedAt = req.body.signedAt || new Date();
    terms.signedBy = String(req.body.signedBy || terms.contactName || terms.clientName).trim();
    terms.signatureNotes = String(req.body.signatureNotes || "").trim();
    terms.updatedBy = actorFrom(req.user);
    await terms.save();
    await logActivity(req, {
      module: "Client Terms",
      action: "Signed",
      entityType: "ClientTerms",
      entityId: terms._id,
      summary: `Marked client terms ${terms.documentNumber} as signed`
    });
    res.json(terms);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/cancel", canManageTerms, async (req, res, next) => {
  try {
    const terms = await ClientTerms.findById(req.params.id);
    if (!terms) return res.status(404).json({ message: "Client terms not found" });
    terms.status = "Cancelled";
    terms.cancelledAt = new Date();
    terms.cancellationReason = String(req.body.cancellationReason || "").trim();
    terms.updatedBy = actorFrom(req.user);
    await terms.save();
    await logActivity(req, {
      module: "Client Terms",
      action: "Cancelled",
      entityType: "ClientTerms",
      entityId: terms._id,
      summary: `Cancelled client terms ${terms.documentNumber}`
    });
    res.json(terms);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", canManageTerms, async (req, res, next) => {
  try {
    const terms = await ClientTerms.findById(req.params.id);
    if (!terms) return res.status(404).json({ message: "Client terms not found" });
    if (terms.status !== "Draft") {
      return res.status(400).json({ message: "Only draft terms can be deleted. Cancel sent/signed terms instead." });
    }
    await terms.deleteOne();
    await logActivity(req, {
      module: "Client Terms",
      action: "Deleted",
      entityType: "ClientTerms",
      entityId: terms._id,
      summary: `Deleted draft client terms ${terms.documentNumber}`
    });
    res.json({ message: "Client terms deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
