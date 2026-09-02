import crypto from "node:crypto";

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer) {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) output += base32Alphabet[parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  return output;
}

function base32Decode(value) {
  let bits = "";
  for (const character of String(value).replace(/=+$/g, "").toUpperCase()) {
    const index = base32Alphabet.indexOf(character);
    if (index >= 0) bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

function encryptionKey() {
  return crypto.createHash("sha256").update(process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET || "development-only-key").digest();
}

export function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(value) {
  const [iv, tag, encrypted] = String(value).split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function totpAt(secret, counter) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", base32Decode(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const code = ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
  return code;
}

export function verifyTotp(secret, code, now = Date.now()) {
  const supplied = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(supplied)) return false;
  const counter = Math.floor(now / 30000);
  return [-1, 0, 1].some((offset) => {
    const expected = totpAt(secret, counter + offset);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
  });
}

export function generateRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => crypto.randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g).join("-"));
}

export function tokenHash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function deviceLabel(userAgent = "") {
  const value = String(userAgent);
  const browser = /Edg\//.test(value) ? "Edge" : /Chrome\//.test(value) ? "Chrome" : /Firefox\//.test(value) ? "Firefox" : /Safari\//.test(value) ? "Safari" : "Browser";
  const device = /Mobile|Android|iPhone/i.test(value) ? "mobile" : /Windows/i.test(value) ? "Windows" : /Mac OS/i.test(value) ? "Mac" : /Linux/i.test(value) ? "Linux" : "device";
  return `${browser} on ${device}`;
}

