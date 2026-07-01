import multer from "multer";

const allowedCvMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const allowedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);
const allowedCsvMimeTypes = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/plain"
]);
const allowedReceiptMimeTypes = new Set([...allowedImageMimeTypes, "application/pdf"]);

function safeFilename(originalName) {
  return `${Date.now()}-${originalName.replace(/[^a-z0-9.\-_]/gi, "-").toLowerCase()}`;
}

const memoryStorage = multer.memoryStorage();

export const uploadCv = multer({
  storage: memoryStorage,
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
  storage: memoryStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedImageMimeTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Logo must be a JPG, PNG, WEBP, or SVG image"));
  }
});

export const uploadBlogImage = multer({
  storage: memoryStorage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedImageMimeTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Featured image must be a JPG, PNG, WEBP, or SVG image"));
  }
});

export const uploadCandidateCsv = multer({
  storage: memoryStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isCsvName = /\.csv$/i.test(file.originalname || "");
    if (allowedCsvMimeTypes.has(file.mimetype) || isCsvName) {
      cb(null, true);
      return;
    }
    cb(new Error("Candidate import must be a CSV file"));
  }
});

export const uploadBusinessLeadCsv = multer({
  storage: memoryStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isCsvName = /\.csv$/i.test(file.originalname || "");
    if (allowedCsvMimeTypes.has(file.mimetype) || isCsvName) {
      cb(null, true);
      return;
    }
    cb(new Error("Business lead import must be a CSV file. In Excel, use Save As or Export as CSV UTF-8, then upload that CSV."));
  }
});

export const uploadExpenseReceipt = multer({
  storage: memoryStorage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedReceiptMimeTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Receipt must be a PDF, JPG, PNG, WEBP, or SVG file"));
  }
});

export function fileMeta(file) {
  if (!file) return undefined;
  return {
    filename: safeFilename(file.originalname),
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    data: file.buffer
  };
}
