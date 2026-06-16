import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, CircleDollarSign, Clock, FileBadge } from "lucide-react";
import { api } from "../../api/client.js";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";

const emptyCourse = {
  title: "",
  category: "",
  description: "",
  duration: "",
  defaultSellingPrice: "",
  defaultTrainerCost: "",
  certificateIncluded: true,
  status: "Active"
};

function money(value) {
  return `\u00a3${Number(value || 0).toLocaleString()}`;
}

export default function AdminCourses() {
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(emptyCourse);
  const [filters, setFilters] = useState({ search: "", status: "", category: "" });
  const [editing, setEditing] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const categories = useMemo(() => [...new Set(courses.map((course) => course.category).filter(Boolean))], [courses]);
  const summary = useMemo(() => ({
    total: courses.length,
    active: courses.filter((course) => course.status === "Active").length,
    certificate: courses.filter((course) => course.certificateIncluded).length,
    averagePrice: courses.length ? courses.reduce((sum, course) => sum + Number(course.defaultSellingPrice || 0), 0) / courses.length : 0
  }), [courses]);

  function load() {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
    api(`/courses${query ? `?${query}` : ""}`)
      .then(setCourses)
      .catch((error) => setStatus({ type: "error", message: error.message }));
  }

  useEffect(() => {
    load();
  }, []);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        defaultSellingPrice: Number(form.defaultSellingPrice || 0),
        defaultTrainerCost: Number(form.defaultTrainerCost || 0)
      };
      await api(editing ? `/courses/${editing}` : "/courses", {
        method: editing ? "PUT" : "POST",
        body: payload
      });
      setStatus({ message: editing ? "Course updated." : "Course created." });
      setForm(emptyCourse);
      setEditing(null);
      load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this course?")) return;
    try {
      await api(`/courses/${id}`, { method: "DELETE" });
      setStatus({ message: "Course deleted." });
      load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  function edit(course) {
    setEditing(course._id);
    setForm({
      ...emptyCourse,
      ...course,
      defaultSellingPrice: course.defaultSellingPrice ?? "",
      defaultTrainerCost: course.defaultTrainerCost ?? ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <div className="admin-top"><h1>Courses</h1></div>
      <StatusMessage status={status} />

      <div className="training-summary-grid course-summary-grid">
        <div className="training-summary-card"><BookOpenCheck /><span>Total courses</span><strong>{summary.total}</strong></div>
        <div className="training-summary-card"><Clock /><span>Active courses</span><strong>{summary.active}</strong></div>
        <div className="training-summary-card"><FileBadge /><span>Certificates included</span><strong>{summary.certificate}</strong></div>
        <div className="training-summary-card highlight"><CircleDollarSign /><span>Average selling price</span><strong>{money(summary.averagePrice)}</strong></div>
      </div>

      <form className="card form training-form course-editor-card" onSubmit={save}>
        <div className="admin-form-title">
          <div>
            <span className="eyebrow">Course library</span>
            <h2>{editing ? "Edit course" : "Add healthcare training course"}</h2>
          </div>
          {editing && <button type="button" className="button secondary small" onClick={() => { setEditing(null); setForm(emptyCourse); }}>Cancel edit</button>}
        </div>
        <div className="form-grid">
          <input placeholder="Course title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <input placeholder="Course category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
          <input placeholder="Duration" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} required />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>Active</option><option>Inactive</option></select>
          <input type="number" min="0" step="0.01" placeholder="Default selling price" value={form.defaultSellingPrice} onChange={(e) => setForm({ ...form, defaultSellingPrice: e.target.value })} />
          <input type="number" min="0" step="0.01" placeholder="Default trainer cost" value={form.defaultTrainerCost} onChange={(e) => setForm({ ...form, defaultTrainerCost: e.target.value })} />
        </div>
        <label className="checkbox-line"><input type="checkbox" checked={form.certificateIncluded} onChange={(e) => setForm({ ...form, certificateIncluded: e.target.checked })} /> Certificate included</label>
        <textarea placeholder="Course description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        <SubmitButton loading={saving} loadingText="Saving course...">{editing ? "Update Course" : "Create Course"}</SubmitButton>
      </form>

      <div className="card filters training-filters course-filter-card" style={{ marginTop: 24 }}>
        <div className="form-grid">
          <input placeholder="Search course or category" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option><option>Active</option><option>Inactive</option></select>
          <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
          <button className="button" type="button" onClick={load}>Apply Filters</button>
        </div>
      </div>

      <section className="course-library-section">
        <div className="course-library-heading">
          <div>
            <span className="eyebrow">Course catalogue</span>
            <h2>Training courses</h2>
          </div>
          <span>{courses.length} course{courses.length === 1 ? "" : "s"}</span>
        </div>
        {courses.length ? (
          <div className="course-admin-grid">
            {courses.map((course) => (
              <article className="course-admin-card" key={course._id}>
                <div className="course-admin-card-top">
                  <span className="course-category-pill">{course.category}</span>
                  <span className="status-chip table-chip">{course.status}</span>
                </div>
                <h3>{course.title}</h3>
                <p>{course.description}</p>
                <div className="course-admin-meta">
                  <div><span>Duration</span><strong>{course.duration}</strong></div>
                  <div><span>Selling price</span><strong>{money(course.defaultSellingPrice)}</strong></div>
                  <div><span>Trainer cost</span><strong>{money(course.defaultTrainerCost)}</strong></div>
                  <div><span>Certificate</span><strong>{course.certificateIncluded ? "Included" : "No"}</strong></div>
                </div>
                <div className="course-admin-actions">
                  <button className="button small" onClick={() => edit(course)}>Edit course</button>
                  <button className="button secondary small" onClick={() => remove(course._id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="card meeting-empty"><BookOpenCheck size={32} /><strong>No courses found</strong><span>Add your first healthcare training course above.</span></div>
        )}
      </section>
    </>
  );
}
