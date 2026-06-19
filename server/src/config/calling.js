const FALLBACK_OUTBOUND_NUMBERS = ["+443300435830", "+442922520491"];

function cleanPhone(value = "") {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

export function outboundCallerIds() {
  const raw = process.env.YAY_OUTBOUND_NUMBERS || FALLBACK_OUTBOUND_NUMBERS.join(",");
  return Array.from(
    new Set(
      String(raw)
        .split(/[,\n;]/)
        .map(cleanPhone)
        .filter(Boolean)
    )
  );
}

export function allowedCallerIdsForUser(user) {
  const companyNumbers = outboundCallerIds();
  if (!user) return [];
  if (["admin", "super_admin"].includes(user.role)) return companyNumbers;

  const assigned = Array.isArray(user.outboundCallerIds) ? user.outboundCallerIds.map(cleanPhone) : [];
  return assigned.filter((number) => companyNumbers.includes(number));
}

export function resolveCallerIdForUser(user, requestedCallerId) {
  const allowed = allowedCallerIdsForUser(user);
  const requested = cleanPhone(requestedCallerId);

  if (!allowed.length) {
    const error = new Error("No outbound phone number is assigned to this user.");
    error.statusCode = 403;
    throw error;
  }

  if (!requested) return allowed[0];

  if (!allowed.includes(requested)) {
    const error = new Error("You are not allowed to place calls from this phone number.");
    error.statusCode = 403;
    throw error;
  }

  return requested;
}
