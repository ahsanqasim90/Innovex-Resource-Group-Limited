import crypto from "node:crypto";
import { validateRecruitmentDocument } from "./documentIntelligenceService.js";
import { scanRecruitmentDocument } from "./malwareScanService.js";

function verifiedImageType(buffer) {
  if (buffer?.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpeg";
  if (buffer?.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer?.subarray(0, 4).toString("ascii") === "RIFF" && buffer?.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return "";
}

export async function secureComplianceDocumentMeta(file, user) {
  if (!file?.buffer?.length) { const error = new Error("Choose a compliance evidence file"); error.statusCode = 400; throw error; }
  let verifiedType = "";
  if (file.buffer.subarray(0, 5).toString("ascii") === "%PDF-") verifiedType = validateRecruitmentDocument(file, { pdfOnly: true });
  else verifiedType = verifiedImageType(file.buffer);
  const extension = String(file.originalname || "").split(".").pop().toLowerCase();
  const allowedExtensions = verifiedType === "jpeg" ? ["jpg", "jpeg"] : [verifiedType];
  if (!verifiedType || !allowedExtensions.includes(extension)) { const error = new Error("File content does not match its PDF or image extension"); error.statusCode = 400; throw error; }
  const scan = await scanRecruitmentDocument(file.buffer);
  if (scan.status === "Rejected") { const error = new Error("Compliance document was rejected by the antivirus scanner"); error.statusCode = 422; throw error; }
  const mimetypes = { pdf: "application/pdf", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  return { filename: `${Date.now()}-${crypto.randomUUID()}.${verifiedType === "jpeg" ? "jpg" : verifiedType}`, originalName: String(file.originalname).replace(/[\r\n]/g, "-").slice(0, 180), mimetype: mimetypes[verifiedType], size: file.size, data: file.buffer, contentHash: crypto.createHash("sha256").update(file.buffer).digest("hex"), verifiedType, scanStatus: scan.status, scanEngine: scan.engine, scannedAt: scan.status === "Clean" ? new Date() : undefined, quarantineReason: scan.reason, uploadedAt: new Date(), uploadedBy: user ? { user: user._id, name: user.name, email: user.email } : undefined };
}
