import InterviewOutcomePanel from "./InterviewOutcomePanel.jsx";

function dateOnly(value) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function outcomeLabel(value) {
  if (value === "Yes") return "Selected";
  if (value === "No") return "Not selected";
  return "Awaiting outcome";
}

export default function InterviewDetails({ interview, outcomeSaving, onOutcomeSave, showFinance = false }) {
  if (!interview) {
    return (
      <div className="card interview-detail-empty">
        <span className="profile-avatar empty">IR</span>
        <h3>Select an interview</h3>
        <p className="muted">Choose a booking from the table. Outcome tracking will appear here after you select a candidate.</p>
      </div>
    );
  }

  const initials = interview.candidateName?.slice(0, 2).toUpperCase() || "IR";

  return (
    <aside className="card interview-detail">
      <div className="interview-profile">
        <span className="profile-avatar">{initials}</span>
        <div>
          <span className="eyebrow">Selected booking</span>
          <h2>{interview.candidateName}</h2>
          <p className="muted">{interview.jobTitle} with {interview.clientName}</p>
        </div>
      </div>

      <div className="interview-chip-row">
        <span className="status-chip">{interview.interviewStatus}</span>
        <span className="status-chip gold">{outcomeLabel(interview.candidateSelected)}</span>
        {interview.reminderEmailEnabled && <span className="status-chip soft">1-day reminder on</span>}
        {interview.candidateReminderEmailStatus === "Sent" && <span className="status-chip soft">Reminder sent</span>}
      </div>

      <div className="interview-mini-grid">
        <div><span>Interview</span><strong>{dateOnly(interview.interviewDate)}</strong></div>
        <div><span>Time</span><strong>{interview.interviewTime || "-"}</strong></div>
        <div><span>Type</span><strong>{interview.interviewType}</strong></div>
        {showFinance && <div><span>Revenue</span><strong>{`\u00a3${Number(interview.revenue || 0).toLocaleString()}`}</strong></div>}
      </div>

      <div className="contact-strip">
        <a href={`mailto:${interview.candidateEmail}`}>{interview.candidateEmail}</a>
        <a href={`tel:${interview.candidatePhone}`}>{interview.candidatePhone}</a>
        <span>{interview.candidatePostcode || "No postcode added"}</span>
        <span>{interview.visaStatus || "Visa status not set"}</span>
      </div>

      {(interview.careHomeAddress || interview.careHomePostcode || interview.careHomeContactName || interview.careHomeContactPhone || interview.interviewInstructions) && (
        <div className="interview-location-card">
          <span className="eyebrow">Care home / location</span>
          <strong>{interview.clientName}</strong>
          {(interview.careHomeAddress || interview.careHomePostcode) && (
            <p>{[interview.careHomeAddress, interview.careHomePostcode].filter(Boolean).join("\n")}</p>
          )}
          {interview.careHomeContactName && <span>Contact: {interview.careHomeContactName}</span>}
          {interview.careHomeContactPhone && <a href={`tel:${interview.careHomeContactPhone}`}>{interview.careHomeContactPhone}</a>}
          {interview.interviewInstructions && <small>{interview.interviewInstructions}</small>}
        </div>
      )}

      {interview.candidateSelected === "No" && interview.feedback && (
        <div className="feedback-note"><strong>Feedback</strong><p>{interview.feedback}</p></div>
      )}

      <InterviewOutcomePanel interview={interview} saving={outcomeSaving} onSave={onOutcomeSave} showFinance={showFinance} />
    </aside>
  );
}
