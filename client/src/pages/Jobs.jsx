import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import JobDescription from "../components/JobDescription.jsx";
import JobCard from "../components/JobCard.jsx";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import FileUpload from "../components/FileUpload.jsx";
import SubmitButton from "../components/SubmitButton.jsx";
import { BriefcaseBusiness, Filter, MapPin, RotateCcw, Search } from "lucide-react";

export default function Jobs() {
  const [searchParams] = useSearchParams();
  const selectedJobId = searchParams.get("job");
  const shouldAutoApply = searchParams.get("apply") === "1";
  const [jobs, setJobs] = useState([]);
  const [detailJob, setDetailJob] = useState(null);
  const [filters, setFilters] = useState({ search: "", location: "", type: "" });
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState(null);
  const [applying, setApplying] = useState(false);
  const [loading, setLoading] = useState(true);
  const applicationRef = useRef(null);
  const autoAppliedRef = useRef(null);
  const hasFilters = Boolean(filters.search || filters.location || filters.type);

  function loadJobs(nextFilters = filters) {
    const cleanedFilters = Object.fromEntries(
      Object.entries(nextFilters)
        .map(([key, value]) => [key, String(value || "").trim()])
        .filter(([, value]) => value)
    );
    const query = new URLSearchParams(cleanedFilters).toString();
    setStatus(null);
    setLoading(true);
    api(`/jobs${query ? `?${query}` : ""}`)
      .then(setJobs)
      .catch((error) => setStatus({ type: "error", message: error.message }))
      .finally(() => setLoading(false));
  }

  function searchJobs(event) {
    event.preventDefault();
    loadJobs(filters);
  }

  function resetSearch() {
    const cleared = { search: "", location: "", type: "" };
    setFilters(cleared);
    loadJobs(cleared);
  }

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (!selected) return;
    requestAnimationFrame(() => {
      applicationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selected]);

  useEffect(() => {
    if (!shouldAutoApply || !detailJob || autoAppliedRef.current === detailJob._id) return;
    autoAppliedRef.current = detailJob._id;
    startApplication(detailJob);
  }, [shouldAutoApply, detailJob]);

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

  function startApplication(job) {
    setSelected(job);
    setStatus(null);
  }

  return (
    <section className="section">
      <SEO title="Healthcare Jobs" path="/jobs" description="Search and apply for UK healthcare jobs including nurse, care assistant, registered manager, temporary staffing, and permanent recruitment roles." />
      <SectionHeading eyebrow="Jobs" title="Current opportunities" />
      <div className="card filters jobs-filter-card">
        <div className="jobs-filter-heading">
          <span className="jobs-filter-icon"><Search size={24} /></span>
          <div>
            <h2>Find the right healthcare role</h2>
            <p>Search by role, keyword, location, shift, salary, or employment type.</p>
          </div>
        </div>
        <form className="jobs-filter-form" onSubmit={searchJobs}>
          <label className="filter-field">
            <span>Role or keyword</span>
            <div className="input-with-icon">
              <Search size={18} />
              <input placeholder="e.g. Nurse, Team Leader, Manager" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            </div>
          </label>
          <label className="filter-field">
            <span>Location</span>
            <div className="input-with-icon">
              <MapPin size={18} />
              <input placeholder="e.g. Dover, SO40, Birmingham" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} />
            </div>
          </label>
          <label className="filter-field">
            <span>Job type</span>
            <div className="input-with-icon">
              <Filter size={18} />
              <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
                <option value="">All types</option>
                <option>Temporary</option>
                <option>Permanent</option>
                <option>Contract</option>
              </select>
            </div>
          </label>
          <div className="jobs-filter-actions">
            <button className="button" type="submit" disabled={loading}>{loading ? "Searching..." : "Search Jobs"}</button>
            {hasFilters && (
              <button className="button light reset-filter-button" type="button" onClick={resetSearch}>
                <RotateCcw size={17} /> Reset
              </button>
            )}
          </div>
        </form>
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
            <button className="button" onClick={() => startApplication(detailJob)}>Apply Now</button>
            <Link className="button secondary" to="/jobs">Back to Jobs</Link>
          </aside>
        </article>
      )}
      {loading ? (
        <div className="card-grid" style={{ marginTop: 24 }}>
          {[1, 2, 3].map((item) => (
            <article className="card job-card job-skeleton" key={item} aria-hidden="true">
              <div className="skeleton-line short" />
              <div className="skeleton-line title" />
              <div className="skeleton-line" />
              <div className="skeleton-block" />
              <div className="skeleton-actions">
                <div className="skeleton-pill" />
                <div className="skeleton-pill small" />
              </div>
            </article>
          ))}
        </div>
      ) : jobs.length > 0 ? (
        <div className="card-grid" style={{ marginTop: 24 }}>{jobs.map((job) => <JobCard key={job._id} job={job} onApply={startApplication} />)}</div>
      ) : (
        <article className="card empty-state-card" style={{ marginTop: 24 }}>
          <BriefcaseBusiness size={34} />
          <h2>No matching roles found</h2>
          <p>Try adjusting your search filters, or upload your CV so the Innovex recruitment team can consider you for suitable healthcare roles.</p>
          <div className="actions">
            <button className="button secondary" type="button" onClick={resetSearch}>Reset Search</button>
            <Link className="button" to="/upload-cv">Upload CV</Link>
          </div>
        </article>
      )}
      {selected && (
        <div className="card" id="job-application-form" ref={applicationRef} style={{ marginTop: 24, scrollMarginTop: 110 }}>
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
