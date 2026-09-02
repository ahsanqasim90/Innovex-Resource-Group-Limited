import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, MessageSquareQuote, Star, Trash2, XCircle } from "lucide-react";
import { api } from "../../api/client.js";
import AdminSectionHero from "../../components/AdminSectionHero.jsx";

export default function AdminTestimonials() {
  const [items, setItems] = useState([]);
  const approved = items.filter((item) => item.status === "Approved").length;
  const pending = items.filter((item) => !item.status || item.status === "Pending").length;
  const averageRating = items.length ? (items.reduce((sum, item) => sum + Number(item.rating || 0), 0) / items.length).toFixed(1) : "0.0";
  const load = () => api("/testimonials?admin=true").then(setItems).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  async function update(item, status) {
    await api(`/testimonials/${item._id}`, { method: "PUT", body: { ...item, status } });
    load();
  }

  async function remove(id) {
    if (!confirm("Delete this testimonial?")) return;
    await api(`/testimonials/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="workspace-pro-suite testimonials-admin-pro">
      <AdminSectionHero icon={MessageSquareQuote} eyebrow="Website reputation" title="Testimonials" description="Moderate client and candidate feedback before it appears on the public website." aside={<div className="workspace-hero-count"><Star size={18} /><span><small>REVIEWS</small><strong>{items.length}</strong></span></div>} />
      <section className="testimonial-admin-stats">
        <article><span><MessageSquareQuote size={18} /></span><div><small>All feedback</small><strong>{items.length}</strong></div></article>
        <article><span><Clock3 size={18} /></span><div><small>Awaiting decision</small><strong>{pending}</strong></div></article>
        <article><span><CheckCircle2 size={18} /></span><div><small>Approved</small><strong>{approved}</strong></div></article>
        <article><span><Star size={18} /></span><div><small>Average rating</small><strong>{averageRating}</strong></div></article>
      </section>
      {items.length ? <section className="testimonial-moderation-grid">
        {items.map((item) => <article className="testimonial-moderation-card" key={item._id}>
          <header><div className="testimonial-admin-avatar">{String(item.name || "?").slice(0, 1).toUpperCase()}</div><div><h2>{item.name}</h2><p>{item.role || item.reviewType || "Candidate feedback"}</p></div><span className={`testimonial-admin-status ${String(item.status || "Pending").toLowerCase()}`}>{item.status || "Pending"}</span></header>
          <div className="testimonial-admin-rating" aria-label={`${item.rating || 0} out of 5 stars`}>{[1, 2, 3, 4, 5].map((value) => <Star key={value} size={16} fill={value <= Number(item.rating || 0) ? "currentColor" : "none"} />)}<strong>{item.rating || 0}.0</strong></div>
          <blockquote>“{item.message}”</blockquote>
          <footer><span>{item.reviewType || "Candidate"} testimonial</span><div><button className="button small" onClick={() => update(item, "Approved")}><CheckCircle2 size={14} /> Approve</button><button className="button secondary small" onClick={() => update(item, "Rejected")}><XCircle size={14} /> Reject</button><button className="testimonial-delete" aria-label={`Delete testimonial from ${item.name}`} onClick={() => remove(item._id)}><Trash2 size={15} /></button></div></footer>
        </article>)}
      </section> : <div className="workspace-empty-state testimonial-admin-empty"><MessageSquareQuote size={30} /><strong>No testimonials awaiting review</strong><span>Submitted reviews will appear here.</span></div>}
    </div>
  );
}
