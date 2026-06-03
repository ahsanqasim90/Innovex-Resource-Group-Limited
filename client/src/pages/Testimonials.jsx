import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import RatingStars from "../components/RatingStars.jsx";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import StatusMessage from "../components/StatusMessage.jsx";

export default function Testimonials() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api("/testimonials").then(setItems).catch(() => {});
  }, []);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      await api("/testimonials", { method: "POST", body: data });
      setStatus({ message: "Thank you. Your review has been submitted for approval." });
      form.reset();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  return (
    <section className="section">
      <SEO title="Testimonials" path="/testimonials" description="Read testimonials from care providers, candidates, and partners who work with Innovex Resource Group Limited." />
      <SectionHeading eyebrow="Testimonials" title="What providers and candidates say" />
      <div className="stats-grid">
        <div className="card"><strong>5.0</strong><p>Average rating</p></div>
        <div className="card"><strong>{items.length}</strong><p>Approved reviews</p></div>
        <div className="card"><strong>98%</strong><p>Positive feedback</p></div>
      </div>
      <div className="card-grid" style={{ marginTop: 24 }}>
        {items.map((item) => <article className="card testimonial-card" key={item._id}><RatingStars rating={item.rating} /><p>{item.message}</p><h3>{item.name}</h3><p className="muted">{item.role}</p></article>)}
      </div>
      <div className="card" style={{ marginTop: 24 }}>
        <h2>Submit a review</h2>
        <StatusMessage status={status} />
        <form className="form" onSubmit={submit}>
          <div className="form-grid"><input name="name" placeholder="Name" required /><input name="role" placeholder="Role" required /><input name="company" placeholder="Company" /><select name="rating" defaultValue="5"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></div>
          <textarea name="message" placeholder="Your review" required />
          <button className="button">Submit Review</button>
        </form>
      </div>
    </section>
  );
}
