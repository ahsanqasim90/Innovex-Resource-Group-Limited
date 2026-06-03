import validator from "validator";

export function requireFields(body, fields) {
  const missing = fields.filter((field) => !String(body[field] || "").trim());
  if (missing.length) {
    const error = new Error(`Missing required fields: ${missing.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }
}

export function validateEmail(email) {
  if (!validator.isEmail(String(email || ""))) {
    const error = new Error("A valid email address is required");
    error.statusCode = 400;
    throw error;
  }
}

export function pick(source, keys) {
  return keys.reduce((result, key) => {
    if (source[key] !== undefined) result[key] = source[key];
    return result;
  }, {});
}
