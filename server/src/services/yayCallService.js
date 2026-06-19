const DEFAULT_API_BASE = "https://api.yay.com";
const DEFAULT_CALL_PATH = "/call";
const DEFAULT_FALLBACK_CALL_PATH = "/outbound-call";
const DEFAULT_AUTH_TEST_PATH = "/authenticated";

function trimSlash(value = "") {
  return String(value || "").replace(/\/+$/, "");
}

function leadSlash(value = "") {
  const path = String(value || "").trim();
  if (!path) return "";
  return path.startsWith("/") ? path : `/${path}`;
}

function compact(value) {
  return String(value || "").trim();
}

export function normalizePhone(value = "") {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

function replaceTemplate(value, tokens) {
  if (typeof value === "string") {
    return value.replace(/\{\{\s*(phone|targetName|sipUserUuid|huntGroupUuid|callerId|callRouteUuid|agentExtension|huntGroupExtension)\s*\}\}/gi, (_, key) => tokens[key] || "");
  }
  if (Array.isArray(value)) return value.map((item) => replaceTemplate(item, tokens));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceTemplate(item, tokens)]));
  }
  return value;
}

function buildDefaultPayload({ phone, targetName, callerId }) {
  const payload = {
    destination: phone,
    target_name: targetName
  };

  if (process.env.YAY_SIP_USER_UUID) payload.sip_user_uuid = process.env.YAY_SIP_USER_UUID;
  if (process.env.YAY_HUNT_GROUP_UUID) payload.hunt_group_uuid = process.env.YAY_HUNT_GROUP_UUID;
  if (process.env.YAY_AGENT_EXTENSION) payload.agent_extension = process.env.YAY_AGENT_EXTENSION;
  if (process.env.YAY_HUNT_GROUP_EXTENSION) payload.hunt_group_extension = process.env.YAY_HUNT_GROUP_EXTENSION;
  if (callerId || process.env.YAY_CALLER_ID) payload.caller_id = callerId || process.env.YAY_CALLER_ID;
  if (process.env.YAY_CALL_ROUTE_UUID) payload.call_route_uuid = process.env.YAY_CALL_ROUTE_UUID;

  return payload;
}

function callPaths(primaryPath) {
  const configuredPaths = process.env.YAY_CLICK_TO_CALL_PATHS || process.env.YAY_CLICK_TO_CALL_PATH || primaryPath || DEFAULT_CALL_PATH;
  const paths = configuredPaths
    .split(/[,\n;]/)
    .map(leadSlash)
    .filter(Boolean);

  if (!paths.includes(DEFAULT_FALLBACK_CALL_PATH)) paths.push(DEFAULT_FALLBACK_CALL_PATH);
  return [...new Set(paths)];
}

async function parseYayResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }
  return response.text().catch(() => "");
}

function providerMessage(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload.replace(/\s+/g, " ").trim().slice(0, 280);
  const direct = payload.message || payload.error || payload.detail || payload.reason || payload.status;
  if (direct) return String(direct).replace(/\s+/g, " ").trim().slice(0, 280);
  if (Array.isArray(payload.errors) && payload.errors.length) {
    return payload.errors
      .map((item) => (typeof item === "string" ? item : item.message || item.error || JSON.stringify(item)))
      .join("; ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 280);
  }
  return JSON.stringify(payload).replace(/\s+/g, " ").trim().slice(0, 280);
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
    callPaths: callPaths(process.env.YAY_CLICK_TO_CALL_PATH || DEFAULT_CALL_PATH),
    authTestPath: leadSlash(process.env.YAY_AUTH_TEST_PATH || DEFAULT_AUTH_TEST_PATH),
    hasSipUser: Boolean(process.env.YAY_SIP_USER_UUID),
    hasHuntGroup: Boolean(process.env.YAY_HUNT_GROUP_UUID),
    hasAgentExtension: Boolean(process.env.YAY_AGENT_EXTENSION),
    hasHuntGroupExtension: Boolean(process.env.YAY_HUNT_GROUP_EXTENSION),
    hasCallerId: Boolean(process.env.YAY_CALLER_ID),
    hasCallRoute: Boolean(process.env.YAY_CALL_ROUTE_UUID),
    hasPayloadTemplate: Boolean(process.env.YAY_CLICK_TO_CALL_PAYLOAD_TEMPLATE),
    hasRingSource: Boolean(
      process.env.YAY_SIP_USER_UUID ||
      process.env.YAY_HUNT_GROUP_UUID ||
      process.env.YAY_CALL_ROUTE_UUID ||
      process.env.YAY_CLICK_TO_CALL_PAYLOAD_TEMPLATE
    )
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

  const responsePayload = await parseYayResponse(response);
  const detail = providerMessage(responsePayload);

  return {
    configured: true,
    ok: response.ok,
    status: response.status,
    url,
    responsePayload,
    message: response.ok ? "Yay API connection verified." : `Yay API connection test failed${detail ? `: ${detail}` : "."}`
  };
}

export async function startYayOutboundCall({ phone, targetName, callerId }) {
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

  const tokens = {
    phone: cleanPhone,
    targetName: targetName || "",
    sipUserUuid: process.env.YAY_SIP_USER_UUID || "",
    huntGroupUuid: process.env.YAY_HUNT_GROUP_UUID || "",
    callerId: callerId || process.env.YAY_CALLER_ID || "",
    callRouteUuid: process.env.YAY_CALL_ROUTE_UUID || "",
    agentExtension: process.env.YAY_AGENT_EXTENSION || "",
    huntGroupExtension: process.env.YAY_HUNT_GROUP_EXTENSION || ""
  };

  let payload = buildDefaultPayload({ phone: cleanPhone, targetName, callerId });
  if (process.env.YAY_CLICK_TO_CALL_PAYLOAD_TEMPLATE) {
    try {
      payload = replaceTemplate(JSON.parse(process.env.YAY_CLICK_TO_CALL_PAYLOAD_TEMPLATE), tokens);
    } catch (error) {
      return {
        configured: true,
        ok: false,
        payload,
        responsePayload: { error: error.message },
        message: `Yay payload template is not valid JSON: ${error.message}`
      };
    }
  }

  const method = compact(process.env.YAY_CLICK_TO_CALL_METHOD) || "POST";
  const attempts = [];

  for (const path of config.callPaths) {
    const url = `${config.apiBase}${path}`;
    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Reseller": process.env.YAY_AUTH_RESELLER,
          "X-Auth-User": process.env.YAY_AUTH_USER,
          "X-Auth-Password": process.env.YAY_AUTH_PASSWORD
        },
        body: JSON.stringify(payload)
      });

      const responsePayload = await parseYayResponse(response);
      const attempt = {
        ok: response.ok,
        status: response.status,
        url,
        responsePayload
      };
      attempts.push(attempt);

      if (response.ok) {
        return {
          configured: true,
          ok: true,
          status: response.status,
          url,
          payload,
          responsePayload,
          attempts,
          message: "Yay outbound call request sent. Your Yay phone/app should ring first, then connect to the contact."
        };
      }
    } catch (error) {
      attempts.push({
        ok: false,
        url,
        responsePayload: { error: error.message }
      });
    }
  }

  const lastAttempt = attempts[attempts.length - 1] || {};
  const detail = providerMessage(lastAttempt.responsePayload);
  const statusLabel = lastAttempt.status ? ` (${lastAttempt.status})` : "";

  return {
    configured: true,
    ok: false,
    status: lastAttempt.status,
    url: lastAttempt.url,
    payload,
    responsePayload: lastAttempt.responsePayload || {},
    attempts,
    message: `Yay rejected outbound call${statusLabel}${detail ? `: ${detail}` : "."}`
  };
}
