import { MessageCircle, Quote } from "lucide-react";
import { Link } from "react-router-dom";
import RatingStars from "./RatingStars.jsx";

function TestimonialSlide({ item }) {
  return (
    <article className="testimonial-slide-card">
      <Quote className="quote-mark" size={28} />
      <RatingStars rating={item.rating} />
      <p>{item.message}</p>
      <div>
        <h3>{item.name}</h3>
        <span>{item.role}{item.company ? `, ${item.company}` : ""}</span>
      </div>
    </article>
  );
}

export default function TestimonialSlider({ testimonials = [] }) {
  const visible = testimonials.filter(Boolean);
  if (!visible.length) return null;
  const trackItems = [...visible, ...visible];

  return (
    <section className="testimonial-slider-section">
      <div className="testimonial-slider-heading">
        <span className="eyebrow">Client & candidate voices</span>
        <h2>Trusted experiences with Innovex</h2>
        <p>Real feedback from people and organisations supported by Innovex Resource Group Limited.</p>
      </div>
      <div className="testimonial-slider" aria-label="Innovex testimonials">
        <div className="testimonial-slider-track">
          {trackItems.map((item, index) => (
            <TestimonialSlide key={`${item._id}-${index}`} item={item} />
          ))}
        </div>
      </div>
      <div className="testimonial-share-cta">
        <div>
          <MessageCircle size={24} />
          <strong>Apna experience share karna chahtay hain?</strong>
          <span>Tell us how Innovex supported your recruitment, job search, website, or SEO journey.</span>
        </div>
        <Link className="button" to="/testimonials#submit-review">Share Feedback</Link>
      </div>
    </section>
  );
}
