export default function SubmitButton({ loading = false, disabled = false, children, loadingText = "Submitting..." }) {
  return (
    <button className={`button${loading ? " is-loading" : ""}`} type="submit" disabled={loading || disabled}>
      {loading && <span className="button-spinner" aria-hidden="true" />}
      <span>{loading ? loadingText : children}</span>
    </button>
  );
}
