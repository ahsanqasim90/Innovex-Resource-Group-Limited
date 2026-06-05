import { BriefcaseBusiness, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { Link } from "react-router-dom";
import JobCard from "./JobCard.jsx";

function JobSkeleton() {
  return (
    <article className="card job-card job-skeleton" aria-hidden="true">
      <div className="skeleton-line short" />
      <div className="skeleton-line title" />
      <div className="skeleton-line" />
      <div className="skeleton-block" />
      <div className="skeleton-actions">
        <div className="skeleton-pill" />
        <div className="skeleton-pill small" />
      </div>
    </article>
  );
}

export default function HomeJobsSlider({ jobs = [], loading = false }) {
  const railRef = useRef(null);
  const canSlide = jobs.length > 0;

  const slide = (direction) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector(".job-slide");
    const amount = card ? card.getBoundingClientRect().width + 18 : 340;
    rail.scrollBy({ left: direction * amount, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="home-jobs-shell">
        <div className="home-jobs-loading">
          <BriefcaseBusiness size={22} />
          <span>Loading latest roles from the Innovex admin panel...</span>
        </div>
      <div className="home-jobs-rail">
          {[1, 2, 3].map((item) => <JobSkeleton key={item} />)}
        </div>
      </div>
    );
  }

  if (!jobs.length) {
    return (
      <div className="home-jobs-empty card">
        <BriefcaseBusiness size={30} />
        <h3>New healthcare roles are being updated</h3>
        <p>Our recruitment team refreshes live vacancies from the admin panel. Browse all roles or upload your CV for matching opportunities.</p>
        <div className="actions">
          <Link className="button secondary" to="/jobs">View All Jobs</Link>
          <Link className="button" to="/upload-cv">Upload CV</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="home-jobs-shell">
      <div className="home-jobs-controls" aria-label="Job carousel controls">
        <button className="carousel-icon" type="button" onClick={() => slide(-1)} disabled={!canSlide} aria-label="Previous jobs">
          <ChevronLeft size={22} />
        </button>
        <button className="carousel-icon" type="button" onClick={() => slide(1)} disabled={!canSlide} aria-label="Next jobs">
          <ChevronRight size={22} />
        </button>
      </div>
      <div className="home-jobs-rail" ref={railRef}>
        {jobs.map((job) => (
          <div className="job-slide" key={job._id}>
            <JobCard job={job} />
          </div>
        ))}
      </div>
    </div>
  );
}
