import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import RatingStars from "../components/RatingStars.jsx";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import StarRatingInput from "../components/StarRatingInput.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import SubmitButton from "../components/SubmitButton.jsx";

export default function Testimonials() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState(null);
  const [rating, setRating] = useState(5);
  const [reviewType, setReviewType] = useState("Candidate");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api("/testimonials").then(setItems).catch(() => {});
  }, []);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setSubmitting(true);
    try {
      await api("/testimonials", { method: "POST", body: data });
      setStatus({ message: "Thank you. Your review has been submitted for approval." });
      form.reset();
      setRating(5);
      setReviewType("Candidate");
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSubmitting(false);
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
          <div className="review-type-options" role="radiogroup" aria-label="Review type">
            {["Candidate", "Partner"].map((type) => (
              <label key={type} className={reviewType === type ? "active" : ""}>
                <input type="radio" name="reviewType" value={type} checked={reviewType === type} onChange={() => setReviewType(type)} />
                <span>{type === "Candidate" ? "Candidate review" : "Partner review"}</span>
                <small>{type === "Candidate" ? "For candidates we helped into work" : "For care homes and business partners"}</small>
              </label>
            ))}
          </div>
          <div className="form-grid"><input name="name" placeholder="Name" required /><input name="role" placeholder={reviewType === "Candidate" ? "Role placed into" : "Your role / organisation"} required /><input name="company" placeholder={reviewType === "Candidate" ? "Company / care provider" : "Company name"} /><StarRatingInput value={rating} onChange={setRating} /></div>
          <textarea name="message" placeholder="Your review" required />
          <SubmitButton loading={submitting} loadingText="Submitting review...">Submit Review</SubmitButton>
        </form>
      </div>
    </section>
  );
}
