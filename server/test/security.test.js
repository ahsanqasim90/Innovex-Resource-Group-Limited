import assert from "node:assert/strict";
import test from "node:test";
import { decryptSecret, deviceLabel, encryptSecret, generateRecoveryCodes, tokenHash, verifyTotp } from "../src/utils/authSecurity.js";
import { assertDocumentReleased, scanRecruitmentDocument } from "../src/services/malwareScanService.js";
import { validateRecruitmentDocument } from "../src/services/documentIntelligenceService.js";

test("MFA secrets encrypt with authenticated encryption and decrypt correctly", () => {
  process.env.MFA_ENCRYPTION_KEY = "test-only-encryption-key-with-sufficient-entropy";
  const encrypted = encryptSecret("JBSWY3DPEHPK3PXP");
  assert.notEqual(encrypted, "JBSWY3DPEHPK3PXP");
  assert.equal(decryptSecret(encrypted), "JBSWY3DPEHPK3PXP");
});

test("TOTP verification follows the standard counter window", () => {
  assert.equal(verifyTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", "287082", 59_000), true);
  assert.equal(verifyTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", "000000", 59_000), false);
});

test("recovery codes and token hashes are unique and non-plaintext", () => {
  const codes = generateRecoveryCodes(8);
  assert.equal(new Set(codes).size, 8);
  assert.match(codes[0], /^[A-F0-9]{5}-[A-F0-9]{5}$/);
  assert.notEqual(tokenHash(codes[0]), codes[0]);
});

test("device labels do not retain the complete user-agent", () => {
  assert.equal(deviceLabel("Mozilla/5.0 (Windows NT 10.0) Chrome/131.0"), "Chrome on Windows");
});

test("recruitment files are signature checked and active PDFs rejected", () => {
  const safePdf = { buffer: Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj"), originalname: "cv.pdf" };
  assert.equal(validateRecruitmentDocument(safePdf), "pdf");
  assert.throws(() => validateRecruitmentDocument({ ...safePdf, buffer: Buffer.from("%PDF-1.7 /JavaScript") }), /active or embedded content/);
  assert.throws(() => validateRecruitmentDocument({ buffer: Buffer.from("not-a-pdf"), originalname: "cv.pdf" }), /genuine PDF or DOCX/);
});

test("malware scanning rejects EICAR and quarantines when scanner is unavailable", async () => {
  const previous = process.env.CLAMAV_HOST;
  delete process.env.CLAMAV_HOST;
  const infected = await scanRecruitmentDocument(Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE"));
  assert.equal(infected.status, "Rejected");
  const unavailable = await scanRecruitmentDocument(Buffer.from("safe-content"));
  assert.equal(unavailable.status, "Quarantined");
  assert.throws(() => assertDocumentReleased(unavailable), /quarantined/);
  assert.doesNotThrow(() => assertDocumentReleased({ scanStatus: "Clean" }));
  if (previous) process.env.CLAMAV_HOST = previous;
});
