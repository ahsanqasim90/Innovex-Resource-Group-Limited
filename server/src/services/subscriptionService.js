import OrganizationInvitation from "../models/OrganizationInvitation.js";
import User from "../models/User.js";

function subscriptionError(message, statusCode = 409) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = "SUBSCRIPTION_LIMIT_REACHED";
  return error;
}

export function workspaceAccessState(organization, now = new Date()) {
  if (!organization) return { allowed: false, statusCode: 503, message: "Workspace is not available" };
  if (["Suspended", "Cancelled"].includes(organization.status)) {
    return { allowed: false, statusCode: 403, message: `This workspace is ${organization.status.toLowerCase()}. Contact the workspace owner.` };
  }
  if (["Past Due", "Cancelled"].includes(organization.subscription?.status)) {
    return { allowed: false, statusCode: 402, message: "Workspace subscription needs attention. Contact the workspace owner." };
  }
  if (organization.status === "Trial" && organization.subscription?.trialEndsAt && organization.subscription.trialEndsAt < now) {
    return { allowed: false, statusCode: 402, message: "This workspace trial has ended. Choose a plan to restore access." };
  }
  return { allowed: true };
}

export async function subscriptionUsage(organization, { excludeInvitationEmail = "" } = {}) {
  const pendingFilter = { status: "Pending", expiresAt: { $gt: new Date() } };
  if (excludeInvitationEmail) pendingFilter.email = { $ne: String(excludeInvitationEmail).trim().toLowerCase() };
  const [activeSeats, pendingInvitations] = await Promise.all([
    User.countDocuments({ isActive: true }),
    OrganizationInvitation.countDocuments(pendingFilter)
  ]);
  const seatLimit = Math.max(1, Number(organization?.subscription?.seatLimit || 1));
  return {
    activeSeats,
    pendingInvitations,
    reservedSeats: activeSeats + pendingInvitations,
    seatLimit,
    availableSeats: Math.max(0, seatLimit - activeSeats - pendingInvitations),
    storageLimitMb: Number(organization?.subscription?.storageLimitMb || 0)
  };
}

export async function assertSeatAvailable(organization, options = {}) {
  const usage = await subscriptionUsage(organization, options);
  if (usage.reservedSeats >= usage.seatLimit) {
    throw subscriptionError(`Your ${organization.subscription?.plan || "current"} plan includes ${usage.seatLimit} seats. Suspend a member, cancel a pending invitation, or upgrade the plan.`);
  }
  return usage;
}

export async function assertActiveSeatAvailable(organization) {
  const usage = await subscriptionUsage(organization);
  if (usage.activeSeats >= usage.seatLimit) {
    throw subscriptionError(`Your ${organization.subscription?.plan || "current"} plan includes ${usage.seatLimit} active seats. Suspend a member or upgrade the plan.`);
  }
  return usage;
}
