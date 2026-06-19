const DEFAULT_API_BASE = "https://api.yay.com";
const DEFAULT_CALL_PATH = "/call";
const DEFAULT_AUTH_TEST_PATH = "/authenticated";

function trimSlash(value = "") {
  return String(value || "").replace(/\/+$/, "");
}

function leadSlash(value = "") {
  const path = String(value || "").trim();
  if (!path) return "";
  return path.startsWith("/") ? path : `/${path}`;
}

export function normalizePhone(value = "") {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

function replaceTemplate(value, tokens) {
  if (typeof value === "string") {
    return value.replace(/\{\{\s*(phone|targetName|sipUserUuid|huntGroupUuid|callerId|callRouteUuid)\s*\}\}/gi, (_, key) => tokens[key] || "");
  }
  if (Array.isArray(value)) return value.map((item) => replaceTemplate(item, tokens));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceTemplate(item, tokens)]));
  }
  return value;
}

function buildDefaultPayload({ phone, targetName }) {
  const payload = {
    destination: phone,
    target_name: targetName
  };

  if (process.env.YAY_SIP_USER_UUID) payload.sip_user_uuid = process.env.YAY_SIP_USER_UUID;
  if (process.env.YAY_HUNT_GROUP_UUID) payload.hunt_group_uuid = process.env.YAY_HUNT_GROUP_UUID;
  if (process.env.YAY_CALLER_ID) payload.caller_id = process.env.YAY_CALLER_ID;
  if (process.env.YAY_CALL_ROUTE_UUID) payload.call_route_uuid = process.env.YAY_CALL_ROUTE_UUID;

  return payload;
}

export function yayConfigStatus() {
  const configured = Boolean(
    process.env.YAY_AUTH_RESELLER &&
    process.env.YAY_AUTH_USER &&
    process.env.YAY_AUTH_PASSWORD
  );

  return {
    configured,
    apiBase: trimSlash(process.env.YAY_API_BASE_URL || DEFAULT_API_BASE),
    callPath: leadSlash(process.env.YAY_CLICK_TO_CALL_PATH || DEFAULT_CALL_PATH),
    authTestPath: leadSlash(process.env.YAY_AUTH_TEST_PATH || DEFAULT_AUTH_TEST_PATH),
    hasSipUser: Boolean(process.env.YAY_SIP_USER_UUID),
    hasHuntGroup: Boolean(process.env.YAY_HUNT_GROUP_UUID),
    hasCallerId: Boolean(process.env.YAY_CALLER_ID)
  };
}

export async function testYayConnection() {
  const config = yayConfigStatus();

  if (!config.configured) {
    return {
      configured: false,
      ok: false,
      message: "Yay API credentials are not configured yet."
    };
  }

  const url = `${config.apiBase}${config.authTestPath}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-Auth-Reseller": process.env.YAY_AUTH_RESELLER,
      "X-Auth-User": process.env.YAY_AUTH_USER,
      "X-Auth-Password": process.env.YAY_AUTH_PASSWORD
    }
  });

  const contentType = response.headers.get("content-type") || "";
  const responsePayload = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => "");

  return {
    configured: true,
    ok: response.ok,
    status: response.status,
    url,
    responsePayload,
    message: response.ok ? "Yay API connection verified." : "Yay API connection test failed."
  };
}

export async function startYayOutboundCall({ phone, targetName }) {
  const cleanPhone = normalizePhone(phone);
  const config = yayConfigStatus();

  if (!cleanPhone) {
    return {
      skipped: true,
      configured: config.configured,
      message: "A valid phone number is required before starting a call."
    };
  }

  if (!config.configured) {
    return {
      skipped: true,
      configured: false,
      message: "Yay API credentials are not configured yet. The call has been logged in CRM only."
    };
  }

  const url = `${config.apiBase}${config.callPath}`;
  const tokens = {
    phone: cleanPhone,
    targetName: targetName || "",
    sipUserUuid: process.env.YAY_SIP_USER_UUID || "",
    huntGroupUuid: process.env.YAY_HUNT_GROUP_UUID || "",
    callerId: process.env.YAY_CALLER_ID || "",
    callRouteUuid: process.env.YAY_CALL_ROUTE_UUID || ""
  };

  let payload = buildDefaultPayload({ phone: cleanPhone, targetName });
  if (process.env.YAY_CLICK_TO_CALL_PAYLOAD_TEMPLATE) {
    payload = replaceTemplate(JSON.parse(process.env.YAY_CLICK_TO_CALL_PAYLOAD_TEMPLATE), tokens);
  }

  const response = await fetch(url, {
    method: process.env.YAY_CLICK_TO_CALL_METHOD || "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Reseller": process.env.YAY_AUTH_RESELLER,
      "X-Auth-User": process.env.YAY_AUTH_USER,
      "X-Auth-Password": process.env.YAY_AUTH_PASSWORD
    },
    body: JSON.stringify(payload)
  });

  const contentType = response.headers.get("content-type") || "";
  const responsePayload = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => "");

  return {
    configured: true,
    ok: response.ok,
    status: response.status,
    url,
    payload,
    responsePayload,
    message: response.ok ? "Yay outbound call request sent." : "Yay outbound call request failed."
  };
}
