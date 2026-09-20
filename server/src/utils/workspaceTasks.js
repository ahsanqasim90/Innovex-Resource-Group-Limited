export const taskStatuses = ["Open", "Completed", "Cancelled"];
export const taskPriorities = ["Low", "Normal", "High", "Urgent"];

export function validateTaskInput(body) {
  const fail = (message) => { const error = new Error(message); error.statusCode = 400; throw error; };
  if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 180) fail("Enter a task title of 1–180 characters.");
  if (body.description != null && (typeof body.description !== "string" || body.description.length > 2000)) fail("Task details must be under 2,000 characters.");
  if (!taskPriorities.includes(body.priority || "Normal")) fail("Choose a valid priority.");
  if (body.dueAt && !Number.isFinite(new Date(body.dueAt).getTime())) fail("Choose a valid due date.");
  if (body.assignedTo && !/^[a-f\d]{24}$/i.test(body.assignedTo)) fail("Choose a valid team member.");
  return { title: body.title.trim(), description: body.description?.trim() || "", priority: body.priority || "Normal", dueAt: body.dueAt ? new Date(body.dueAt) : undefined, assignedTo: body.assignedTo || undefined };
}
