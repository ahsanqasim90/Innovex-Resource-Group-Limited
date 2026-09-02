import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";

function safeText(value = "") {
  return String(value).replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
}

export async function createProtectedCvPreview(buffer, { viewerName, viewerEmail, candidateId }) {
  const document = await PDFDocument.load(buffer, { ignoreEncryption: false, updateMetadata: true });
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const viewer = safeText(viewerEmail || viewerName || "Authorised user").slice(0, 72);
  const code = safeText(candidateId || "Candidate").slice(0, 30);
  const watermark = `CONFIDENTIAL PREVIEW - ${viewer}`;
  const footer = `${code} | Viewed by ${viewer} | ${timestamp} | Download and redistribution prohibited`;

  document.setTitle(`${code} - Protected CV Preview`);
  document.setAuthor("Innovex Resource Group Limited");
  document.setSubject("Confidential, individually watermarked recruitment document");

  document.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    const fontSize = Math.max(15, Math.min(26, width / 22));
    const textWidth = bold.widthOfTextAtSize(watermark, fontSize);
    [0.25, 0.52, 0.79].forEach((position) => {
      page.drawText(watermark, {
        x: Math.max(-width * 0.05, (width - textWidth) / 2),
        y: height * position,
        size: fontSize,
        font: bold,
        color: rgb(0.04, 0.34, 0.4),
        opacity: 0.11,
        rotate: degrees(28)
      });
    });
    page.drawRectangle({ x: 0, y: 0, width, height: 22, color: rgb(0.02, 0.23, 0.28), opacity: 0.92 });
    page.drawText(footer.slice(0, 150), { x: 10, y: 7, size: Math.max(6, Math.min(8, width / 75)), font: regular, color: rgb(1, 1, 1), opacity: 0.95 });
  });

  return Buffer.from(await document.save({ useObjectStreams: true, addDefaultPage: false }));
}
