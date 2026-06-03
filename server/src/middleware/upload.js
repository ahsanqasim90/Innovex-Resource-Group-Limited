import fs from "fs";
import path from "path";
import multer from "multer";

export const uploadDir = path.resolve(process.env.UPLOAD_DIR || "uploads");
const cvUploadDir = path.join(uploadDir, "cvs");
const logoUploadDir = path.join(uploadDir, "logos");
fs.mkdirSync(cvUploadDir, { recursive: true });
fs.mkdirSync(logoUploadDir, { recursive: true });

const allowedCvMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const allowedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);

function makeStorage(destination) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, destination),
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-z0-9.\-_]/gi, "-").toLowerCase();
      cb(null, `${Date.now()}-${safeName}`);
    }
  });
}

const cvStorage = makeStorage(cvUploadDir);
const logoStorage = makeStorage(logoUploadDir);

export const uploadCv = multer({
  storage: cvStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedCvMimeTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("CV must be a PDF, DOC, or DOCX file"));
  }
});

export const uploadPartnerLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedImageMimeTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Logo must be a JPG, PNG, WEBP, or SVG image"));
  }
});
