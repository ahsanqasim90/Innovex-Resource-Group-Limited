import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import JobDescription from "../components/JobDescription.jsx";
import JobCard from "../components/JobCard.jsx";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import FileUpload from "../components/FileUpload.jsx";
import SubmitButton from "../components/SubmitButton.jsx";
import { BriefcaseBusiness, Filter, MapPin, RotateCcw, Search } from "lucide-react";
import { company } from "../data/content.js";
import { trackEvent } from "../utils/analytics.js";

function plainText(value = "") {
  return String(value).replace(/[#*_>`~-]+/g, " ").replace(/\s+/g, " ").trim();
}

function jobSchema(job) {
  const jobUrl = `${company.siteUrl}/jobs/${job._id}`;
  const employmentType = String(job.type || "").toUpperCase().replace(/[^A-Z]+/g, "_");
  return [
    {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: job.title,
      description: plainText(job.description),
      identifier: { "@type": "PropertyValue", name: company.name, value: String(job._id) },
      datePosted: job.createdAt,
      ...(job.closingDate ? { validThrough: job.closingDate } : {}),
      employmentType,
      hiringOrganization: { "@type": "Organization", "@id": `${company.siteUrl}/#organization`, name: company.name, sameAs: company.siteUrl },
      jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.location, addressCountry: "GB" } },
      url: jobUrl
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${company.siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "Healthcare jobs", item: `${company.siteUrl}/jobs` },
        { "@type": "ListItem", position: 3, name: job.title, item: jobUrl }
      ]
    }
  ];
}

export default function Jobs() {
  const { jobId } = useParams();
  const [searchParams] = useSearchParams();
  const selectedJobId = jobId || searchParams.get("job");
  const shouldAutoApply = searchParams.get("apply") === "1";
  const [jobs, setJobs] = useState([]);
  const [detailJob, setDetailJob] = useState(null);
  const [filters, setFilters] = useState({ search: "", location: "", type: "" });
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState(null);
  const [applying, setApplying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const applicationRef = useRef(null);
  const autoAppliedRef = useRef(null);
  const hasFilters = Boolean(filters.search || filters.location || filters.type);

  function loadJobs(nextFilters = filters, page = 1, append = false) {
    const cleanedFilters = Object.fromEntries(
      Object.entries(nextFilters)
        .map(([key, value]) => [key, String(value || "").trim()])
        .filter(([, value]) => value)
    );
    const params = new URLSearchParams(cleanedFilters);
    params.set("paginated", "1");
    params.set("page", String(page));
    params.set("limit", "12");
    const query = params.toString();
    setStatus(null);
    setLoading(true);
    api(`/jobs?${query}`)
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items || [];
        setJobs((current) => append ? [...current, ...items.filter((item) => !current.some((existing) => existing._id === item._id))] : items);
        setPagination(Array.isArray(data) ? { page: 1, pages: 1, total: data.length } : { page: data.page, pages: data.pages, total: data.total });
      })
      .catch((error) => setStatus({ type: "error", message: error.message }))
      .finally(() => setLoading(false));
  }

  function searchJobs(event) {
    event.preventDefault();
    loadJobs(filters, 1);
  }

  function resetSearch() {
    const cleared = { search: "", location: "", type: "" };
    setFilters(cleared);
    loadJobs(cleared, 1);
  }

  useEffect(() => {
    loadJobs(filters, 1);
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
    const attribution = new URLSearchParams(window.location.search);
    form.set("source", attribution.get("utm_source") || (document.referrer ? new URL(document.referrer).hostname : "Direct"));
    form.set("medium", attribution.get("utm_medium") || "");
    form.set("campaign", attribution.get("utm_campaign") || "");
    form.set("referrer", document.referrer || "");
    setApplying(true);
    try {
      await api(`/jobs/${selected._id}/apply`, { method: "POST", body: form });
      trackEvent("job_application_submitted", { funnel: "jobs", job_type: selected.type || "unspecified" });
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

  if (jobId) {
    const description = detailJob ? `${plainText(detailJob.description).slice(0, 130)}${plainText(detailJob.description).length > 130 ? "…" : ""}` : "View this Innovex healthcare vacancy and apply online.";
    return (
      <section className="section">
        <SEO
          title={detailJob ? `${detailJob.title} — ${detailJob.location}` : "Healthcare vacancy"}
          path={`/jobs/${jobId}`}
          description={description}
          noIndex={!detailJob}
          jsonLd={detailJob ? jobSchema(detailJob) : undefined}
        />
        {status?.type === "error" ? (
          <article className="card empty-state-card">
            <h1>This vacancy is no longer available.</h1>
            <StatusMessage status={status} />
            <p>It may have closed or been removed. Browse current opportunities instead.</p>
            <Link className="button" to="/jobs">View current jobs</Link>
          </article>
        ) : !detailJob ? (
          <article className="card"><p className="muted" role="status">Loading vacancy…</p></article>
        ) : (
          <>
            <Link className="text-link back-link" to="/jobs">Back to current jobs</Link>
            <article className="card job-detail-card" style={{ marginTop: 24 }}>
              <div>
                <div className="pill-row"><span>{detailJob.type}</span><span>{detailJob.shift}</span><span>{detailJob.location}</span></div>
                <h1>{detailJob.title}</h1>
                <p className="muted">{detailJob.salary}</p>
                <JobDescription text={detailJob.description} />
                {detailJob.requirements?.length > 0 && <><h2>Requirements</h2><ul className="clean-list">{detailJob.requirements.map((item) => <li key={item}>{item}</li>)}</ul></>}
              </div>
              <aside className="job-detail-aside"><h2>Interested in this role?</h2><p>Send your details and optional CV to the Innovex recruitment team.</p><button className="button" onClick={() => startApplication(detailJob)}>Apply Now</button><Link className="button secondary" to="/upload-cv">Register your CV</Link></aside>
            </article>
            {selected && (
              <div className="card" id="job-application-form" ref={applicationRef} style={{ marginTop: 24, scrollMarginTop: 110 }}>
                <h2>Apply for {selected.title}</h2>
                <form className="form" onSubmit={apply}>
                  <div className="form-grid labelled-form-grid">
                    <label><span>Full name *</span><input name="name" autoComplete="name" required /></label>
                    <label><span>Email *</span><input name="email" type="email" autoComplete="email" required /></label>
                    <label><span>Phone *</span><input name="phone" type="tel" autoComplete="tel" required /></label>
                  </div>
                  <FileUpload label="Attach CV" helper="Optional: secure PDF or DOCX up to 5MB" />
                  <label><span>Cover message</span><textarea name="coverMessage" /></label>
                  <label className="privacy-confirmation"><input type="checkbox" name="privacyConfirmed" required /><span>I have read the <Link to="/privacy" target="_blank">privacy notice</Link> and understand how my application data will be used.</span></label>
                  <SubmitButton loading={applying} loadingText="Submitting application...">Submit Application</SubmitButton>
                </form>
              </div>
            )}
          </>
        )}
      </section>
    );
  }

  return (
    <section className="section">
      <SEO title="Healthcare Jobs" path="/jobs" description="Search and apply for UK healthcare jobs including nurse, care assistant, registered manager, temporary staffing, and permanent recruitment roles." />
      <SectionHeading as="h1" eyebrow="Jobs" title="Current opportunities" />
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
        <>
          <div className="jobs-results-summary"><span><strong>{pagination.total}</strong> opportunities found</span><small>Showing {jobs.length} roles</small></div>
          <div className="card-grid" style={{ marginTop: 14 }}>{jobs.map((job) => <JobCard key={job._id} job={job} onApply={startApplication} />)}</div>
          {pagination.page < pagination.pages && <div className="jobs-load-more"><button className="button secondary" type="button" disabled={loading} onClick={() => loadJobs(filters, pagination.page + 1, true)}>{loading ? "Loading more roles..." : `Load more opportunities (${pagination.total - jobs.length} remaining)`}</button></div>}
        </>
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
            <FileUpload label="Attach CV" helper="Optional: secure PDF or DOCX up to 5MB" />
            <textarea name="coverMessage" placeholder="Cover message" />
            <label className="privacy-confirmation"><input type="checkbox" name="privacyConfirmed" required /><span>I have read the <Link to="/privacy" target="_blank">privacy notice</Link> and understand how my application data will be used.</span></label>
            <SubmitButton loading={applying} loadingText="Submitting application...">Submit Application</SubmitButton>
          </form>
        </div>
      )}
    </section>
  );
}
