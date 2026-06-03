export default function StarRatingInput({ value, onChange, name = "rating" }) {
  return (
    <div className="star-rating-field">
      <span className="file-upload-label">Rating</span>
      <input type="hidden" name={name} value={value} />
      <div className="star-rating-input" role="radiogroup" aria-label="Review rating">
        {Array.from({ length: 5 }, (_, index) => {
          const rating = index + 1;
          return (
            <button
              key={rating}
              type="button"
              className={rating <= value ? "active" : ""}
              aria-label={`${rating} star${rating > 1 ? "s" : ""}`}
              aria-pressed={rating === value}
              onClick={() => onChange(rating)}
            >
              ★
            </button>
          );
        })}
      </div>
    </div>
  );
}
