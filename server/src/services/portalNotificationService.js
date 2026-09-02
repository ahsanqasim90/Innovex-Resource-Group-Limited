import PortalNotification from "../models/PortalNotification.js";
import User from "../models/User.js";

export async function notifyPortalMembersOfVacancy(job, actorUser) {
  if (!job?._id) return 0;
  const members = await User.find({ isActive: true }).select("_id").lean();
  if (!members.length) return 0;

  const reference = job.reference ? ` (${job.reference})` : "";
  const message = `${job.title}${reference} in ${job.location} has been uploaded by Innovex Resource Group Limited.`;
  const notifications = members.map((member) => ({
    user: member._id,
    type: "vacancy_created",
    title: "New vacancy uploaded",
    message,
    link: "/admin/recruitment-ats",
    entityType: "Job",
    entityId: job._id,
    actor: actorUser ? { user: actorUser._id, name: actorUser.name } : undefined
  }));

  await PortalNotification.insertMany(notifications, { ordered: false });
  return notifications.length;
}
