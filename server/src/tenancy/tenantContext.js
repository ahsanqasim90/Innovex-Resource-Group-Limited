import { AsyncLocalStorage } from "node:async_hooks";

const tenantStorage = new AsyncLocalStorage();
let defaultOrganizationId = "";

export function setDefaultOrganizationId(value) {
  defaultOrganizationId = value ? String(value) : "";
}

export function getDefaultOrganizationId() {
  return defaultOrganizationId;
}

export function currentTenant() {
  return tenantStorage.getStore() || {};
}

export function currentOrganizationId() {
  return currentTenant().organizationId || defaultOrganizationId || "";
}

export function isDefaultOrganization(value) {
  return Boolean(value) && String(value) === String(defaultOrganizationId);
}

export function runWithTenant(context, callback) {
  return tenantStorage.run({ ...currentTenant(), ...context }, callback);
}

export function runWithoutTenant(callback) {
  return tenantStorage.run({ ...currentTenant(), bypassTenant: true }, callback);
}

