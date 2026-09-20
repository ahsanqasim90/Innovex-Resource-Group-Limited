import { AlertCircle, RefreshCw } from "lucide-react";

export default function AdminLoadState({ error, onRetry, label = "Loading workspace…" }) {
  return <section className={`workspace-load-state${error ? " is-error" : ""}`} role={error ? "alert" : "status"}>
    {error ? <AlertCircle size={26} /> : <RefreshCw size={26} className="spinning" />}
    <h2>{error ? "We couldn’t load this view" : label}</h2>
    <p>{error || "Your latest records will appear here shortly."}</p>
    {error && onRetry && <button className="button secondary" onClick={onRetry}><RefreshCw size={16} />Try again</button>}
  </section>;
}
