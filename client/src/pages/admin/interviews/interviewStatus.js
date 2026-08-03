export function effectiveInterviewStatus(interview = {}) {
  if (interview.interviewStatus === "Cancelled") return "Cancelled";
  if (["Yes", "No"].includes(interview.candidateSelected)) return "Completed";
  return interview.interviewStatus || "Pending";
}

export function canSendInterviewFollowUp(interview = {}, now = new Date()) {
  if (effectiveInterviewStatus(interview) !== "Pending" || interview.candidateSelected !== "Pending") return false;
  const interviewDate = new Date(interview.interviewDate);
  if (Number.isNaN(interviewDate.getTime())) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  interviewDate.setHours(23, 59, 59, 999);
  return interviewDate >= today;
}
