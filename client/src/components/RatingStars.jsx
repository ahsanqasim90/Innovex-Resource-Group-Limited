export default function RatingStars({ rating = 5 }) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));

  return (
    <div className="rating-stars" aria-label={`${value} out of 5 rating`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < value ? "filled" : ""} aria-hidden="true">★</span>
      ))}
    </div>
  );
}
