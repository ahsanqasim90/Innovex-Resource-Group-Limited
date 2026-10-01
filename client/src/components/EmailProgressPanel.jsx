import { X } from "lucide-react";

export default function EmailProgressPanel({ report, title = "Email send report", onClose }) {
  if (!report) return null;
  const total = Number(report.total || 0);
  const done = Number(report.done || 0);
  const remaining = Math.max(Number(report.remaining ?? total - done), 0);
  const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return (
    <div className={`outreach-send-report${report.running ? " running" : report.problems ? " problems" : " done"}`} role="status" aria-live="polite">
      <div className="outreach-send-report-head">
        <strong>{report.running ? `${title} in progress` : title}</strong>
        <span>{report.running ? `${done} of ${total} processed` : report.finishedLabel || "Completed"}</span>
        {!report.running && onClose && <button type="button" aria-label="Hide send report" onClick={onClose}><X size={14} /></button>}
      </div>
      {report.running && <div className="outreach-send-report-bar"><i style={{ width: `${percent}%` }} /></div>}
      <div className="outreach-send-report-grid">
        <div><span>Total</span><strong>{total}</strong></div>
        <div><span>Processed</span><strong>{done}</strong></div>
        <div className="ok"><span>Sent</span><strong>{Number(report.sent || 0)}</strong></div>
        <div className={remaining ? "pending" : ""}><span>Remaining</span><strong>{remaining}</strong></div>
        {!report.running && report.archived !== undefined && <div><span>Saved to Sent</span><strong>{Number(report.archived || 0)}</strong></div>}
        {!report.running && report.skipped !== undefined && <div><span>Skipped</span><strong>{Number(report.skipped || 0)}</strong></div>}
        {!report.running && report.failed !== undefined && <div className={report.failed ? "bad" : ""}><span>Failed</span><strong>{Number(report.failed || 0)}</strong></div>}
      </div>
      {report.summary && <p>{report.summary}</p>}
      {report.running && <small className="outreach-progress-note">Keep this page open until sending completes.</small>}
    </div>
  );
}
