import { canSendInterviewFollowUp, effectiveInterviewStatus } from "./interviewStatus.js";

function dateOnly(value) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function outcomeLabel(value) {
  if (value === "Yes") return "Selected";
  if (value === "No") return "Not selected";
  return "Awaiting";
}

export default function InterviewList({ interviews, onEdit, onDelete, onSelect, onFollowUp, onSendDetails, followUpSendingId, detailsSendingId, selectedId, showFinance = false }) {
  return (
    <div className="table-wrap interview-table">
      <table>
        <thead><tr><th>Candidate</th><th>Job / Client</th><th>Interview</th><th>Status</th><th>Email</th><th>Outcome</th>{showFinance && <th>Revenue</th>}<th>Actions</th></tr></thead>
        <tbody>
          {interviews.map((item) => (
            <tr key={item._id} className={selectedId === item._id ? "selected-row" : ""}>
              <td><strong>{item.candidateName}</strong><br /><span className="muted">{item.candidateEmail}</span></td>
              <td><strong>{item.jobTitle}</strong><br /><span className="muted">{item.clientName}</span></td>
              <td>{dateOnly(item.interviewDate)}<br /><span className="muted">{item.interviewTime} - {item.interviewType}</span></td>
              <td><span className="status-chip table-chip">{effectiveInterviewStatus(item)}</span></td>
              <td>
                <span className={`status-chip table-chip ${item.confirmationEmailStatus === "Sent" ? "" : "gold"}`}>
                  {item.confirmationEmailStatus === "Sent" ? "Details sent" : item.confirmationEmailStatus === "Failed" ? "Send failed" : "Not sent"}
                </span>
                {item.confirmationEmailSentAt && <><br /><span className="muted">{new Date(item.confirmationEmailSentAt).toLocaleString()}</span></>}
              </td>
              <td><span className="status-chip table-chip gold">{outcomeLabel(item.candidateSelected)}</span></td>
              {showFinance && <td><strong>{`\u00a3${Number(item.revenue || 0).toLocaleString()}`}</strong></td>}
              <td className="action-cell"><div className="compact-actions">
                <button className="button secondary small" onClick={() => onSelect(item)}>View</button>
                <button className="button small interview-details-send-button" disabled={detailsSendingId === item._id} onClick={() => onSendDetails(item)}>
                  {detailsSendingId === item._id ? "Sending..." : item.confirmationEmailStatus === "Sent" ? "Send again" : "Send details"}
                </button>
                {canSendInterviewFollowUp(item) && (
                  <button className="button small interview-follow-up-button" disabled={followUpSendingId === item._id} onClick={() => onFollowUp(item)}>
                    {followUpSendingId === item._id ? "Sending..." : item.candidateFollowUpEmailStatus === "Sent" ? "Follow-up again" : "Follow-up"}
                  </button>
                )}
                <button className="button small" onClick={() => onEdit(item)}>Edit</button>
                <button className="button small" onClick={() => onDelete(item._id)}>Delete</button>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
