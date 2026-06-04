function dateOnly(value) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

export default function InterviewDetails({ interview }) {
  if (!interview) return <div className="card interview-detail-empty"><h3>Select an interview</h3><p className="muted">Choose a record from the table to view interview and placement details.</p></div>;

  return (
    <aside className="card interview-detail">
      <h2>{interview.candidateName}</h2>
      <p className="muted">{interview.jobTitle} with {interview.clientName}</p>
      <div className="detail-list">
        <span>Email</span><strong>{interview.candidateEmail}</strong>
        <span>Phone</span><strong>{interview.candidatePhone}</strong>
        <span>Postcode</span><strong>{interview.candidatePostcode || "-"}</strong>
        <span>Visa status</span><strong>{interview.visaStatus || "-"}</strong>
        <span>Interview</span><strong>{dateOnly(interview.interviewDate)} at {interview.interviewTime}</strong>
        <span>Type</span><strong>{interview.interviewType}</strong>
        <span>Status</span><strong>{interview.interviewStatus}</strong>
        <span>Selected</span><strong>{interview.candidateSelected}</strong>
        <span>Revenue</span><strong>£{Number(interview.revenue || 0).toLocaleString()}</strong>
      </div>
      {interview.notes && <p>{interview.notes}</p>}
      {interview.candidateSelected === "No" && interview.feedback && <p><strong>Feedback:</strong> {interview.feedback}</p>}
    </aside>
  );
}
