import { Award, CalendarDays, CheckCircle2, Clock, ClipboardList, GraduationCap, Mail, MapPin, Phone, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import SubmitButton from "../components/SubmitButton.jsx";

const initialForm = {
  clientName: "",
  contactPersonName: "",
  email: "",
  phone: "",
  address: "",
  numberOfDelegates: "",
  trainingDate: "",
  trainingStartTime: "",
  notes: ""
};

const processSteps = [
  {
    title: "Choose courses",
    text: "Select the healthcare training your team needs and share delegate numbers."
  },
  {
    title: "We review your request",
    text: "Innovex checks the training requirements, location, availability and delivery needs."
  },
  {
    title: "Receive a quotation",
    text: "Our team contacts you with course options, pricing and the next steps."
  }
];

function shortDescription(text = "") {
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= 210) return clean;
  return `${clean.slice(0, 210).trim()}...`;
}

const categoryStyles = {
  "Mandatory Care Training": { color: "#1D9E75", bg: "#E1F5EE", text: "#0F6E56" },
  "Children's Homes Specialist Training": { color: "#D85A30", bg: "#FBE8E1", text: "#8B341B" },
  "Clinical & Complex Care Training": { color: "#EF9F27", bg: "#FFF2D8", text: "#8A570C" },
  "Mental Health & Behavioural Training": { color: "#7F77DD", bg: "#ECEAFE", text: "#4942A0" },
  "Adult Care": { color: "#1D9E75", bg: "#E1F5EE", text: "#0F6E56" },
  "Specialist Awareness Courses": { color: "#378ADD", bg: "#E6F1FD", text: "#185C99" },
  "Popular Courses": { color: "#639922", bg: "#EDF7DE", text: "#3D6411" }
};

function styleForCategory(category = "") {
  return categoryStyles[category] || { color: "#1D9E75", bg: "#E1F5EE", text: "#0F6E56" };
}

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All courses");
  const [visibleCount, setVisibleCount] = useState(9);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const categories = useMemo(() => [...new Set(courses.map((course) => course.category).filter(Boolean))], [courses]);
  const filteredCourses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesCategory = activeCategory === "All courses" || course.category === activeCategory;
      const searchable = `${course.title || ""} ${course.description || ""}`.toLowerCase();
      return matchesCategory && (!query || searchable.includes(query));
    });
  }, [activeCategory, courses, searchTerm]);
  const visibleCourses = filteredCourses.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(9);
  }, [activeCategory, searchTerm]);

  useEffect(() => {
    api("/courses/public")
      .then(setCourses)
      .catch(() => setStatus({ type: "error", message: "Courses could not be loaded right now. Please contact our team directly." }))
      .finally(() => setLoading(false));
  }, []);

  function toggleCourse(id) {
    setSelectedCourses((current) => current.includes(id) ? current.filter((courseId) => courseId !== id) : [...current, id]);
  }

  function requestQuote(course) {
    setSelectedCourses((current) => current.includes(course._id) ? current : [...current, course._id]);
    setForm((current) => {
      const quoteLine = `Interested course: ${course.title}`;
      return {
        ...current,
        notes: current.notes?.includes(quoteLine) ? current.notes : [quoteLine, current.notes].filter(Boolean).join("\n")
      };
    });
    window.setTimeout(() => {
      document.getElementById("course-enquiry")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  async function submit(e) {
    e.preventDefault();
    setStatus(null);
    if (!selectedCourses.length) {
      setStatus({ type: "error", message: "Please select at least one course before submitting your enquiry." });
      return;
    }
    try {
      setSaving(true);
      const payload = {
        ...form,
        selectedCourses,
        numberOfDelegates: Number(form.numberOfDelegates || 1),
        notes: [
          form.notes,
          "Public website training enquiry - please review and send quotation."
        ].filter(Boolean).join("\n\n")
      };
      const response = await api("/training-bookings/enquiry", { method: "POST", body: payload });
      setStatus({ type: "success", message: response.message || "Training enquiry submitted. Our team will contact you soon." });
      setForm(initialForm);
      setSelectedCourses([]);
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Training enquiry could not be submitted." });
    } finally {
      setSaving(false);
    }
  }

  const selectedTitles = courses.filter((course) => selectedCourses.includes(course._id)).map((course) => course.title);

  return (
    <>
      <SEO
        title="Healthcare Courses & Staff Training UK"
        path="/courses"
        description="Healthcare training courses for care homes, children's homes, nursing homes and healthcare providers. Select courses and request a quotation from Innovex Resource Group Limited."
      />

      <section className="courses-hero">
        <div className="courses-hero-content">
          <span className="eyebrow">Healthcare training courses</span>
          <h1>Professional staff training for care providers and healthcare teams.</h1>
          <p>
            Innovex supports care homes, children's residential homes, nursing homes and healthcare organisations with practical training enquiries, delegate planning and quotation support.
          </p>
          <div className="actions">
            <a className="button" href="#course-enquiry">Request Training Quote</a>
            <a className="button light" href="#course-library">View Courses</a>
          </div>
        </div>
        <aside className="courses-hero-panel">
          <div className="courses-hero-icon"><GraduationCap size={34} /></div>
          <h2>Training made easier</h2>
          <ul>
            <li><CheckCircle2 size={18} /> Select one or multiple courses</li>
            <li><CheckCircle2 size={18} /> Tell us delegate numbers and location</li>
            <li><CheckCircle2 size={18} /> Receive a tailored quotation</li>
          </ul>
        </aside>
      </section>

      <section className="section compact-section" id="course-library">
        <SectionHeading eyebrow="Course Library" title="Healthcare courses available through Innovex">
          Browse active training courses from our admin panel. Pricing shown is indicative where available; final quotations depend on location, delegates and delivery requirements.
        </SectionHeading>

        {loading ? (
          <div className="public-course-loading">
            {[1, 2, 3].map((item) => <span key={item} />)}
          </div>
        ) : courses.length ? (
          <>
            <div className="course-stats-row">
              <div><strong>50+</strong><span>Courses available</span></div>
              <div><strong>{categories.length || 6}</strong><span>Categories</span></div>
              <div><strong>All</strong><span>Include certificate</span></div>
              <div><strong>UK</strong><span>Nationwide delivery</span></div>
            </div>

            <div className="course-library-controls">
              <label className="course-search-box">
                <Search size={19} />
                <input
                  type="search"
                  placeholder="Search courses by title or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <span>Showing {filteredCourses.length ? Math.min(visibleCount, filteredCourses.length) : 0} of {filteredCourses.length} courses</span>
              </label>
              <div className="training-category-strip" role="tablist" aria-label="Course categories">
                {["All courses", ...categories].map((category) => (
                  <button
                    type="button"
                    className={activeCategory === category ? "active" : ""}
                    key={category}
                    onClick={() => setActiveCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="public-course-grid">
              {visibleCourses.map((course) => {
                const palette = styleForCategory(course.category);
                return (
                <article
                  className={`public-course-card ${selectedCourses.includes(course._id) ? "selected" : ""}`}
                  key={course._id}
                  style={{
                    "--course-accent": palette.color,
                    "--course-badge-bg": palette.bg,
                    "--course-badge-text": palette.text
                  }}
                >
                  <div className="course-category-badge">{course.category}</div>
                  <div className="public-course-top">
                    <span><Clock size={15} /> {course.duration || "Flexible"}</span>
                    {course.certificateIncluded && <span><Award size={15} /> Certificate</span>}
                  </div>
                  <h2>{course.title}</h2>
                  <p>{shortDescription(course.description)}</p>
                  <button type="button" className="button secondary small quote-course-button" onClick={() => requestQuote(course)}>
                    {selectedCourses.includes(course._id) ? "Course selected" : "Get a quote"}
                  </button>
                </article>
              );
              })}
            </div>
            {!visibleCourses.length && (
              <div className="card public-empty-card">
                <Search size={30} />
                <h2>No matching courses found</h2>
                <p>Try a different keyword or category, or send an enquiry and our team will help you choose the right training.</p>
              </div>
            )}
            {visibleCount < filteredCourses.length && (
              <div className="load-more-courses">
                <span>Showing {visibleCourses.length} of {filteredCourses.length} courses</span>
                <button type="button" className="button secondary" onClick={() => setVisibleCount((current) => current + 9)}>
                  Load more courses
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="card public-empty-card">
            <GraduationCap size={32} />
            <h2>Course list is being updated</h2>
            <p>Please contact Innovex and our team will share current course availability.</p>
            <Link className="button secondary" to="/contact">Contact Innovex</Link>
          </div>
        )}
      </section>

      <section className="section alt">
        <SectionHeading eyebrow="How it works" title="Simple training enquiry process" />
        <div className="training-process-grid">
          {processSteps.map((step, index) => (
            <article className="training-process-card" key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="course-enquiry">
        <div className="course-enquiry-layout">
          <form className="card form course-enquiry-form" onSubmit={submit}>
            <span className="eyebrow">Request a quotation</span>
            <h2>Tell us what training your team needs</h2>
            <p className="muted">Choose your courses, add your organisation details, and Innovex will contact you with the next steps.</p>
            <StatusMessage status={status} />
            <div className="selected-course-summary">
              <ClipboardList size={20} />
              <div>
                <strong>{selectedCourses.length ? `${selectedCourses.length} course${selectedCourses.length === 1 ? "" : "s"} selected` : "No course selected yet"}</strong>
                <span>{selectedTitles.length ? selectedTitles.join(", ") : "Select courses above or tell us in the notes."}</span>
              </div>
            </div>
            <div className="form-grid">
              <input required placeholder="Client / company name" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
              <input required placeholder="Contact person name" value={form.contactPersonName} onChange={(e) => setForm({ ...form, contactPersonName: e.target.value })} />
              <input required type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input required placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input required placeholder="Training location / address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <input required type="number" min="1" placeholder="Number of attendees" value={form.numberOfDelegates} onChange={(e) => setForm({ ...form, numberOfDelegates: e.target.value })} />
              <input type="date" value={form.trainingDate} onChange={(e) => setForm({ ...form, trainingDate: e.target.value })} />
              <input type="time" value={form.trainingStartTime} onChange={(e) => setForm({ ...form, trainingStartTime: e.target.value })} />
            </div>
            <textarea rows="5" placeholder="Any details we should know? Preferred course dates, onsite/online preference, multiple locations, urgent deadlines, or compliance needs." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <SubmitButton loading={saving} loadingText="Sending training enquiry...">Send Training Enquiry</SubmitButton>
          </form>

          <aside className="course-enquiry-aside">
            <div className="course-contact-card">
              <h3>Need help choosing courses?</h3>
              <p>Send the enquiry and our team will help confirm suitable training options for your staff.</p>
              <a href="tel:+443300435830"><Phone size={18} /> +44 330 043 5830</a>
              <a href="mailto:info@innovexresourcegroup.co.uk"><Mail size={18} /> info@innovexresourcegroup.co.uk</a>
            </div>
            <div className="course-contact-card light-card">
              <h3>Useful details to include</h3>
              <p><Users size={18} /> Number of delegates</p>
              <p><MapPin size={18} /> Training location</p>
              <p><CalendarDays size={18} /> Preferred dates and urgency</p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
