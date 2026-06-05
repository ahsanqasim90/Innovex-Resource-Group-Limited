import { useEffect, useState } from "react";
import { Award, HeartHandshake, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
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
    <main className="testimonials-page">
      <SEO title="Testimonials" path="/testimonials" description="Read testimonials from care providers, candidates, and partners who work with Innovex Resource Group Limited." />
      <section className="section testimonial-hero-section">
        <div className="testimonial-hero-card">
          <div>
            <span className="eyebrow">Testimonials</span>
            <h1>What providers, partners and candidates say about Innovex</h1>
            <p>Feedback from the people we support through healthcare recruitment, staffing, websites, SEO and long-term partnership work.</p>
            <div className="testimonial-hero-actions">
              <a className="button" href="#submit-review">Share Your Experience</a>
              <a className="button secondary" href="#reviews">Read Reviews</a>
            </div>
          </div>
          <aside className="testimonial-trust-panel">
            <Sparkles size={28} />
            <strong>Human support, professional delivery.</strong>
            <span>Every approved review is checked before it appears publicly.</span>
          </aside>
        </div>
      </section>

      <section className="section testimonial-stats-section">
        <div className="testimonial-stats-grid">
          <article className="testimonial-stat-card"><Award /><strong>5.0</strong><span>Average rating</span></article>
          <article className="testimonial-stat-card"><MessageCircle /><strong>{items.length}</strong><span>Approved reviews</span></article>
          <article className="testimonial-stat-card"><HeartHandshake /><strong>98%</strong><span>Positive feedback</span></article>
          <article className="testimonial-stat-card"><ShieldCheck /><strong>Checked</strong><span>Admin approved</span></article>
        </div>
      </section>

      <section className="section alt" id="reviews">
        <SectionHeading eyebrow="Client voices" title="Stories from people we have supported">Read how Innovex has helped care providers, candidates, and business partners move forward with confidence.</SectionHeading>
        <div className="testimonial-review-grid">
          {items.map((item) => (
            <article className="testimonial-review-card" key={item._id}>
              <div className="testimonial-card-top">
                <RatingStars rating={item.rating} />
                <span>{item.reviewType || "Review"}</span>
              </div>
              <p>{item.message}</p>
              <div className="testimonial-author">
                <strong>{item.name}</strong>
                <span>{item.role}{item.company ? `, ${item.company}` : ""}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section testimonial-form-section" id="submit-review">
        <div className="testimonial-form-card card">
          <div className="testimonial-form-intro">
            <span className="eyebrow">Share feedback</span>
            <h2>Apna Innovex experience share karein</h2>
            <p>Your review helps new candidates, care providers, and business owners understand what it feels like to work with Innovex Resource Group Limited.</p>
          </div>
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
    </main>
  );
}
