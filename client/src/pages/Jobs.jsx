import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import JobDescription from "../components/JobDescription.jsx";
import JobCard from "../components/JobCard.jsx";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import FileUpload from "../components/FileUpload.jsx";
import SubmitButton from "../components/SubmitButton.jsx";

export default function Jobs() {
  const [searchParams] = useSearchParams();
  const selectedJobId = searchParams.get("job");
  const [jobs, setJobs] = useState([]);
  const [detailJob, setDetailJob] = useState(null);
  const [filters, setFilters] = useState({ search: "", location: "", type: "" });
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState(null);
  const [applying, setApplying] = useState(false);

  function loadJobs() {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
    api(`/jobs${query ? `?${query}` : ""}`).then(setJobs).catch((error) => setStatus({ type: "error", message: error.message }));
  }

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (!selectedJobId) {
      setDetailJob(null);
      return;
    }

    const existing = jobs.find((job) => job._id === selectedJobId);
    if (existing) {
      setDetailJob(existing);
      return;
    }

    api(`/jobs/${selectedJobId}`)
      .then(setDetailJob)
      .catch((error) => setStatus({ type: "error", message: error.message }));
  }, [selectedJobId, jobs]);

  async function apply(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setApplying(true);
    try {
      await api(`/jobs/${selected._id}/apply`, { method: "POST", body: form });
      setStatus({ message: "Application submitted successfully." });
      setSelected(null);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="section">
      <SEO title="Healthcare Jobs" path="/jobs" description="Search and apply for UK healthcare jobs including nurse, care assistant, registered manager, temporary staffing, and permanent recruitment roles." />
      <SectionHeading eyebrow="Jobs" title="Current opportunities" />
      <div className="card filters">
        <div className="form-grid">
          <input placeholder="Search role or keyword" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          <input placeholder="Location" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} />
          <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}><option value="">All types</option><option>Temporary</option><option>Permanent</option><option>Contract</option></select>
          <button className="button" onClick={loadJobs}>Search Jobs</button>
        </div>
      </div>
      <StatusMessage status={status} />
      {detailJob && (
        <article className="card job-detail-card" style={{ marginTop: 24 }}>
          <div>
            <div className="pill-row">
              <span>{detailJob.type}</span>
              <span>{detailJob.shift}</span>
              <span>{detailJob.location}</span>
            </div>
            <h2>{detailJob.title}</h2>
            <p className="muted">{detailJob.salary}</p>
            <JobDescription text={detailJob.description} />
            {detailJob.requirements?.length > 0 && (
              <>
                <h3>Requirements</h3>
                <ul className="clean-list">
                  {detailJob.requirements.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </>
            )}
          </div>
          <aside className="job-detail-aside">
            <h3>Interested in this role?</h3>
            <p>Send your details and CV to the Innovex recruitment team.</p>
            <button className="button" onClick={() => setSelected(detailJob)}>Apply Now</button>
            <Link className="button secondary" to="/jobs">Back to Jobs</Link>
          </aside>
        </article>
      )}
      <div className="card-grid" style={{ marginTop: 24 }}>{jobs.map((job) => <JobCard key={job._id} job={job} onApply={setSelected} />)}</div>
      {selected && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2>Apply for {selected.title}</h2>
          <form className="form" onSubmit={apply}>
            <div className="form-grid"><input name="name" placeholder="Full name" required /><input name="email" type="email" placeholder="Email" required /><input name="phone" placeholder="Phone" required /></div>
            <FileUpload label="Attach CV" helper="Optional: PDF, DOC, or DOCX up to 5MB" />
            <textarea name="coverMessage" placeholder="Cover message" />
            <SubmitButton loading={applying} loadingText="Submitting application...">Submit Application</SubmitButton>
          </form>
        </div>
      )}
    </section>
  );
}
