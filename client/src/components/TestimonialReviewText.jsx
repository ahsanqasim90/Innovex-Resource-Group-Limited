import { useState } from "react";

const READ_MORE_THRESHOLD = 180;

export default function TestimonialReviewText({ text = "" }) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = text.trim().length > READ_MORE_THRESHOLD;

  return (
    <div className={`testimonial-copy-region ${expanded ? "is-expanded" : ""}`}>
      <p className="testimonial-copy-text">{text}</p>
      {canExpand && (
        <button
          className="testimonial-read-more"
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
