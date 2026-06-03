import { Link } from "react-router-dom";

export default function JobCard({ job, onApply }) {
  return (
    <article className="card job-card">
      <div className="pill-row">
        <span>{job.type}</span>
        <span>{job.shift}</span>
      </div>
      <h3>{job.title}</h3>
      <p className="muted">{job.location} · {job.salary}</p>
      <p>{job.description}</p>
      <div className="card-actions">
        <Link className="button secondary" to={`/jobs?job=${job._id}`}>View Details</Link>
        <button className="button" onClick={() => onApply?.(job)}>Apply</button>
      </div>
    </article>
  );
}
