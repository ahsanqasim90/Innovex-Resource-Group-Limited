import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, CircleDollarSign, GraduationCap, Mail, Phone, Search, TrendingUp, Users } from "lucide-react";
import { api } from "../../api/client.js";
import { canViewFinance } from "../../auth/permissions.js";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const emptyBooking = {
  clientName: "",
  contactPersonName: "",
  email: "",
  phone: "",
  address: "",
  selectedCourses: [],
  trainingDate: "",
  trainingStartTime: "",
  trainingEndTime: "",
  numberOfDelegates: 1,
  quotedPrice: "",
  actualTrainerCost: "",
  otherExpenses: "",
  paymentStatus: "Pending",
  bookingStatus: "Enquiry",
  notes: "",
  trainer: { name: "", phone: "", email: "", fee: "", paymentStatus: "Pending", notes: "" }
};

function money(value) {
  return `\u00a3${Number(value || 0).toLocaleString()}`;
}

function dateInput(value) {
  return value ? value.slice(0, 10) : "";
}

function dateLabel(value) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "-";
}

function toBookingForm(booking = {}) {
  return {
    ...emptyBooking,
    ...booking,
    selectedCourses: booking.selectedCourses?.map((item) => item.course?._id || item.courseId?._id || item.courseId || item.course || item._id || item).filter(Boolean) || [],
    trainingDate: dateInput(booking.trainingDate),
    trainer: { ...emptyBooking.trainer, ...(booking.trainer || {}) }
  };
}

export default function AdminTrainingBookings() {
  const { user } = useAuth();
  const showFinance = canViewFinance(user);
  const [bookings, setBookings] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(emptyBooking);
  const [filters, setFilters] = useState({ search: "", bookingStatus: "", paymentStatus: "", course: "", dateFrom: "", dateTo: "" });
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [courseSearch, setCourseSearch] = useState("");
  const [courseCategory, setCourseCategory] = useState("");
  const [showAllCourses, setShowAllCourses] = useState(false);
  const formRef = useRef(null);
  const detailRef = useRef(null);
  const tableRef = useRef(null);

  const profit = Number(form.quotedPrice || 0) - Number(form.actualTrainerCost || 0) - Number(form.otherExpenses || 0);
  const summary = useMemo(() => ({
    total: bookings.length,
    upcoming: bookings.filter((item) => new Date(item.trainingDate) >= new Date() && !["Cancelled", "Completed"].includes(item.bookingStatus)).length,
    delegates: bookings.reduce((sum, item) => sum + Number(item.numberOfDelegates || 0), 0),
    revenue: bookings.reduce((sum, item) => sum + Number(item.quotedPrice || 0), 0),
    trainerCosts: bookings.reduce((sum, item) => sum + Number(item.actualTrainerCost || 0), 0),
    profit: bookings.reduce((sum, item) => sum + Number(item.profit || 0), 0)
  }), [bookings]);
  const activeCourses = useMemo(() => courses.filter((course) => course.status !== "Inactive"), [courses]);
  const courseCategories = useMemo(() => (
    [...new Set(activeCourses.map((course) => course.category).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  ), [activeCourses]);
  const filteredCourses = useMemo(() => {
    const search = courseSearch.trim().toLowerCase();
    return activeCourses.filter((course) => {
      const matchesCategory = !courseCategory || course.category === courseCategory;
      const haystack = `${course.title || ""} ${course.description || ""} ${course.category || ""}`.toLowerCase();
      return matchesCategory && (!search || haystack.includes(search));
    });
  }, [activeCourses, courseCategory, courseSearch]);
  const visibleCourses = showAllCourses ? filteredCourses : filteredCourses.slice(0, 8);
  const selectedCourseDocs = useMemo(() => (
    form.selectedCourses
      .map((courseId) => courses.find((course) => course._id === courseId))
      .filter(Boolean)
  ), [courses, form.selectedCourses]);

  useEffect(() => {
    setShowAllCourses(false);
  }, [courseSearch, courseCategory]);

  function loadBookings() {
    const allowedFilters = showFinance ? filters : { ...filters, paymentStatus: "" };
    const query = new URLSearchParams(Object.entries(allowedFilters).filter(([, value]) => value)).toString();
    api(`/training-bookings${query ? `?${query}` : ""}`)
      .then(setBookings)
      .catch((error) => setStatus({ type: "error", message: error.message }));
  }

  function loadCourses() {
    api("/courses")
      .then(setCourses)
      .catch((error) => setStatus({ type: "error", message: error.message }));
  }

  useEffect(() => {
    loadCourses();
    loadBookings();
  }, []);

  function toggleCourse(id) {
    const selectedCourses = form.selectedCourses.includes(id)
      ? form.selectedCourses.filter((courseId) => courseId !== id)
      : [...form.selectedCourses, id];
    const selectedCourseDocs = courses.filter((course) => selectedCourses.includes(course._id));
    const quotedPrice = form.quotedPrice || selectedCourseDocs.reduce((sum, course) => sum + Number(course.defaultSellingPrice || 0), 0);
    const actualTrainerCost = form.actualTrainerCost || selectedCourseDocs.reduce((sum, course) => sum + Number(course.defaultTrainerCost || 0), 0);
    setForm({ ...form, selectedCourses, quotedPrice: showFinance ? quotedPrice : form.quotedPrice, actualTrainerCost: showFinance ? actualTrainerCost : form.actualTrainerCost });
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        numberOfDelegates: Number(form.numberOfDelegates || 1),
        quotedPrice: Number(form.quotedPrice || 0),
        actualTrainerCost: Number(form.actualTrainerCost || 0),
        otherExpenses: Number(form.otherExpenses || 0),
        trainer: { ...form.trainer, fee: Number(form.trainer.fee || 0) }
      };
      const saved = await api(editing ? `/training-bookings/${editing}` : "/training-bookings", {
        method: editing ? "PUT" : "POST",
        body: payload
      });
      setStatus({ message: editing ? "Training booking updated." : "Training booking created." });
      setSelected(saved);
      setForm(emptyBooking);
      setEditing(null);
      loadBookings();
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this training booking?")) return;
    try {
      await api(`/training-bookings/${id}`, { method: "DELETE" });
      setStatus({ message: "Training booking deleted." });
      if (selected?._id === id) setSelected(null);
      loadBookings();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  function edit(booking) {
    setEditing(booking._id);
    setForm(toBookingForm(booking));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function viewBooking(booking) {
    setSelected(booking);
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearCourseSelection() {
    setForm({ ...form, selectedCourses: [], quotedPrice: showFinance ? "" : form.quotedPrice, actualTrainerCost: showFinance ? "" : form.actualTrainerCost });
  }

  function applyFilters() {
    loadBookings();
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetFilters() {
    setFilters({ search: "", bookingStatus: "", paymentStatus: "", course: "", dateFrom: "", dateTo: "" });
    setTimeout(() => {
      api("/training-bookings")
        .then(setBookings)
        .catch((error) => setStatus({ type: "error", message: error.message }));
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  return (
    <>
      <div className="admin-top"><h1>Training Bookings</h1></div>
      <StatusMessage status={status} />

      <div className="training-summary-grid">
        <div className="training-summary-card"><GraduationCap /><span>Total bookings</span><strong>{summary.total}</strong></div>
        <div className="training-summary-card"><CalendarClock /><span>Upcoming sessions</span><strong>{summary.upcoming}</strong></div>
        <div className="training-summary-card"><Users /><span>Total delegates</span><strong>{summary.delegates}</strong></div>
        {showFinance && <div className="training-summary-card"><CircleDollarSign /><span>Quoted revenue</span><strong>{money(summary.revenue)}</strong></div>}
        {showFinance && <div className="training-summary-card"><Users /><span>Trainer costs</span><strong>{money(summary.trainerCosts)}</strong></div>}
        {showFinance && <div className="training-summary-card highlight"><TrendingUp /><span>Total profit</span><strong>{money(summary.profit)}</strong></div>}
      </div>

      <div className="training-admin-grid">
        <form className="card form training-form" onSubmit={save} ref={formRef}>
          <div className="admin-form-title">
            <div>
              <span className="eyebrow">Training tracker</span>
              <h2>{editing ? "Edit training booking" : "Create training booking"}</h2>
            </div>
            {editing && <button type="button" className="button secondary small" onClick={() => { setEditing(null); setForm(emptyBooking); }}>Cancel edit</button>}
          </div>

          <div className="interview-form-section">
            <h3>Client details</h3>
            <div className="form-grid">
              <input placeholder="Client / company name" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} required />
              <input placeholder="Contact person name" value={form.contactPersonName} onChange={(e) => setForm({ ...form, contactPersonName: e.target.value })} required />
              <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              <input placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <textarea placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>

          <div className="interview-form-section">
            <div className="course-picker-head">
              <div>
                <span className="eyebrow">Course picker</span>
                <h3>Choose training courses</h3>
                <p>Select only the courses required for this booking. Use search or category filters to keep the list focused.</p>
              </div>
              <span className="course-picker-count">{form.selectedCourses.length} selected</span>
            </div>

            <div className="course-picker-toolbar">
              <label className="course-picker-search">
                <Search size={16} />
                <input placeholder="Search course title, category or description" value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)} />
              </label>
              <select value={courseCategory} onChange={(e) => setCourseCategory(e.target.value)}>
                <option value="">All categories</option>
                {courseCategories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </div>

            <div className="course-picker-selected">
              {selectedCourseDocs.length ? (
                selectedCourseDocs.map((course) => (
                  <button type="button" className="course-picker-chip" key={course._id} onClick={() => toggleCourse(course._id)}>
                    {course.title}<span>Remove</span>
                  </button>
                ))
              ) : (
                <span>No courses selected yet.</span>
              )}
              {!!selectedCourseDocs.length && <button type="button" className="button secondary small" onClick={clearCourseSelection}>Clear courses</button>}
            </div>

            <div className="course-picker-list">
              {visibleCourses.map((course) => {
                const isSelected = form.selectedCourses.includes(course._id);
                return (
                  <label className={isSelected ? "course-picker-row selected" : "course-picker-row"} key={course._id}>
                    <span className="course-picker-check">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleCourse(course._id)} />
                    </span>
                    <span className="course-picker-main">
                      <strong>{course.title}</strong>
                      <small>{course.category || "Training course"}{course.duration ? ` • ${course.duration}` : ""}</small>
                    </span>
                    {showFinance && (
                      <span className="course-picker-money">
                        <strong>{money(course.defaultSellingPrice)}</strong>
                        <small>trainer {money(course.defaultTrainerCost)}</small>
                      </span>
                    )}
                  </label>
                );
              })}
              {!visibleCourses.length && (
                <div className="course-picker-empty">
                  <GraduationCap size={28} />
                  <strong>No courses match this search</strong>
                  <span>Try a different keyword or clear the category filter.</span>
                </div>
              )}
            </div>

            <div className="course-picker-footer">
              <span>Showing {visibleCourses.length} of {filteredCourses.length} matching courses</span>
              {filteredCourses.length > 8 && (
                <button type="button" className="button secondary small" onClick={() => setShowAllCourses(!showAllCourses)}>
                  {showAllCourses ? "Show fewer" : "Show more courses"}
                </button>
              )}
            </div>
          </div>

          <div className="interview-form-section">
            <h3>Schedule and status</h3>
            <div className="form-grid">
              <input type="date" value={form.trainingDate} onChange={(e) => setForm({ ...form, trainingDate: e.target.value })} required />
              <input type="time" value={form.trainingStartTime} onChange={(e) => setForm({ ...form, trainingStartTime: e.target.value })} required />
              <input type="time" value={form.trainingEndTime} onChange={(e) => setForm({ ...form, trainingEndTime: e.target.value })} />
              <input type="number" min="1" placeholder="Number of delegates" value={form.numberOfDelegates} onChange={(e) => setForm({ ...form, numberOfDelegates: e.target.value })} />
              <select value={form.bookingStatus} onChange={(e) => setForm({ ...form, bookingStatus: e.target.value })}><option>Enquiry</option><option>Quoted</option><option>Confirmed</option><option>Completed</option><option>Cancelled</option></select>
              {showFinance && <select value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}><option>Pending</option><option>Deposit Paid</option><option>Fully Paid</option><option>Cancelled</option></select>}
            </div>
          </div>

          <div className="interview-form-section">
            <h3>Trainer details</h3>
            <div className="form-grid">
              <input placeholder="Trainer name" value={form.trainer.name} onChange={(e) => setForm({ ...form, trainer: { ...form.trainer, name: e.target.value } })} />
              <input placeholder="Trainer phone" value={form.trainer.phone} onChange={(e) => setForm({ ...form, trainer: { ...form.trainer, phone: e.target.value } })} />
              <input type="email" placeholder="Trainer email" value={form.trainer.email} onChange={(e) => setForm({ ...form, trainer: { ...form.trainer, email: e.target.value } })} />
              {showFinance && <input type="number" min="0" step="0.01" placeholder="Trainer fee" value={form.trainer.fee} onChange={(e) => setForm({ ...form, trainer: { ...form.trainer, fee: e.target.value }, actualTrainerCost: e.target.value || form.actualTrainerCost })} />}
              {showFinance && <select value={form.trainer.paymentStatus} onChange={(e) => setForm({ ...form, trainer: { ...form.trainer, paymentStatus: e.target.value } })}><option>Pending</option><option>Paid</option></select>}
            </div>
            <textarea placeholder="Trainer notes" value={form.trainer.notes} onChange={(e) => setForm({ ...form, trainer: { ...form.trainer, notes: e.target.value } })} />
          </div>

          {showFinance && (
            <div className="training-finance-panel">
              <h3>Financial summary</h3>
              <div className="form-grid">
                <input type="number" min="0" step="0.01" placeholder="Quoted price" value={form.quotedPrice} onChange={(e) => setForm({ ...form, quotedPrice: e.target.value })} />
                <input type="number" min="0" step="0.01" placeholder="Actual trainer cost" value={form.actualTrainerCost} onChange={(e) => setForm({ ...form, actualTrainerCost: e.target.value })} />
                <input type="number" min="0" step="0.01" placeholder="Other expenses" value={form.otherExpenses} onChange={(e) => setForm({ ...form, otherExpenses: e.target.value })} />
                <div className="profit-preview"><span>Auto profit</span><strong>{money(profit)}</strong></div>
              </div>
            </div>
          )}

          <textarea placeholder="Booking notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <SubmitButton loading={saving} loadingText="Saving booking...">{editing ? "Update Booking" : "Create Booking"}</SubmitButton>
        </form>

        <aside className="card training-detail" ref={detailRef}>
          {selected ? (
            <>
              <h2>{selected.clientName}</h2>
              <p className="muted">{selected.selectedCourses?.map((course) => course.title).join(", ") || "Training booking"}</p>
              <div className="interview-chip-row">
                <span className="status-chip">{selected.bookingStatus}</span>
                {showFinance && <span className="status-chip gold">{selected.paymentStatus}</span>}
              </div>
              <div className="interview-mini-grid">
                <div><span>Date</span><strong>{dateLabel(selected.trainingDate)}</strong></div>
                <div><span>Time</span><strong>{selected.trainingStartTime}{selected.trainingEndTime ? ` - ${selected.trainingEndTime}` : ""}</strong></div>
                <div><span>Delegates</span><strong>{selected.numberOfDelegates}</strong></div>
                {showFinance && <div><span>Profit</span><strong>{money(selected.profit)}</strong></div>}
              </div>
              {showFinance && (
                <div className="training-money-grid">
                  <div><span>Quoted</span><strong>{money(selected.quotedPrice)}</strong></div>
                  <div><span>Trainer cost</span><strong>{money(selected.actualTrainerCost)}</strong></div>
                  <div><span>Expenses</span><strong>{money(selected.otherExpenses)}</strong></div>
                  <div><span>Final profit</span><strong>{money(selected.profit)}</strong></div>
                </div>
              )}
              <div className="contact-strip">
                <a href={`mailto:${selected.email}`}><Mail size={15} /> {selected.email}</a>
                {selected.phone && <a href={`tel:${selected.phone}`}><Phone size={15} /> {selected.phone}</a>}
                {selected.trainer?.name && <span>Trainer: {selected.trainer.name}{showFinance && selected.trainer.paymentStatus ? ` (${selected.trainer.paymentStatus})` : ""}</span>}
              </div>
            </>
          ) : (
            <div className="interview-detail-empty">
              <GraduationCap size={34} />
              <h3>Select a booking</h3>
              <p className="muted">Choose a booking from the table to view client, trainer and schedule details.</p>
            </div>
          )}
        </aside>
      </div>

      <div className="card filters training-filters" style={{ marginTop: 24 }}>
        <div className="form-grid">
          <input placeholder="Search client, contact, course, or trainer" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          <select value={filters.bookingStatus} onChange={(e) => setFilters({ ...filters, bookingStatus: e.target.value })}><option value="">All booking statuses</option><option>Enquiry</option><option>Quoted</option><option>Confirmed</option><option>Completed</option><option>Cancelled</option></select>
          {showFinance && <select value={filters.paymentStatus} onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}><option value="">All payment statuses</option><option>Pending</option><option>Deposit Paid</option><option>Fully Paid</option><option>Cancelled</option></select>}
          <select value={filters.course} onChange={(e) => setFilters({ ...filters, course: e.target.value })}><option value="">All courses</option>{courses.map((course) => <option value={course._id} key={course._id}>{course.title}</option>)}</select>
          <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
          <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
          <button className="button" type="button" onClick={applyFilters}>Apply Filters</button>
          <button className="button secondary" type="button" onClick={resetFilters}>Reset</button>
        </div>
      </div>

      <div className="table-wrap training-table" style={{ marginTop: 24 }} ref={tableRef}>
        <table>
          <thead><tr><th>Client</th><th>Courses</th><th>Training</th><th>Status</th>{showFinance && <><th>Payment</th><th>Revenue</th><th>Profit</th></>}<th>Actions</th></tr></thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking._id} className={selected?._id === booking._id ? "selected-row" : ""}>
                <td><strong>{booking.clientName}</strong><br /><span className="muted">{booking.contactPersonName} - {booking.email}</span></td>
                <td>{booking.selectedCourses?.map((course) => course.title).join(", ")}</td>
                <td>{dateLabel(booking.trainingDate)}<br /><span className="muted">{booking.trainingStartTime}{booking.trainingEndTime ? ` - ${booking.trainingEndTime}` : ""}</span></td>
                <td><span className="status-chip table-chip">{booking.bookingStatus}</span></td>
                {showFinance && <><td>{booking.paymentStatus}</td><td>{money(booking.quotedPrice)}</td><td>{money(booking.profit)}</td></>}
                <td className="action-cell"><div className="compact-actions"><button className="button secondary small" onClick={() => viewBooking(booking)}>View</button><button className="button small" onClick={() => edit(booking)}>Edit</button><button className="button small" onClick={() => remove(booking._id)}>Delete</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!bookings.length && <div className="meeting-empty"><GraduationCap size={32} /><strong>No training bookings found</strong><span>Create a booking above or adjust your filters.</span></div>}
      </div>
    </>
  );
}
