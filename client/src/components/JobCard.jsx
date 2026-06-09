import { Link } from "react-router-dom";
import { previewJobText } from "../utils/jobText.js";

export default function JobCard({ job, onApply }) {
  return (
    <article className="card job-card">
      <div className="pill-row">
        <span>{job.type}</span>
        <span>{job.shift}</span>
      </div>
      <h3>{job.title}</h3>
      <p className="muted">{job.location} - {job.salary}</p>
      <p className="job-card-description">{previewJobText(job.description)}</p>
      <div className="card-actions">
        <Link className="button secondary" to={`/jobs?job=${job._id}`}>View Details</Link>
        {onApply ? (
          <button className="button" onClick={() => onApply(job)}>Apply</button>
        ) : (
          <Link className="button" to={`/jobs?job=${job._id}&apply=1`}>Apply</Link>
        )}
      </div>
    </article>
  );
}
