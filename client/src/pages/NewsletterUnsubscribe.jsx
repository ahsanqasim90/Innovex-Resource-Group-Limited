import { useEffect, useState } from "react";
import { MailX, ShieldCheck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import SEO from "../components/SEO.jsx";

export default function NewsletterUnsubscribe() {
  const { token } = useParams();
  const [record, setRecord] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api(`/newsletters/unsubscribe/${token}`).then(setRecord).catch((err) => setError(err.message)); }, [token]);
  async function unsubscribe() {
    setBusy(true);
    try { const result = await api(`/newsletters/unsubscribe/${token}`, { method: "POST" }); setMessage(result.message); setRecord((current) => ({ ...current, status: "Unsubscribed" })); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section className="section newsletter-preference-page"><SEO title="Newsletter preferences" path={`/newsletter/unsubscribe/${token}`} description="Manage your Innovex Resource Group Limited newsletter preference." noIndex /><div className="card newsletter-preference-card"><MailX size={38} /><span className="eyebrow">Email preference centre</span><h1>Stop Innovex marketing emails</h1>{error ? <p className="form-error">{error}</p> : !record ? <p>Checking your protected link…</p> : <><p>This request applies to <strong>{record.email}</strong>. Service messages you specifically request are separate from newsletter marketing.</p>{message ? <div className="newsletter-unsubscribed"><ShieldCheck /> {message}</div> : record.status === "Unsubscribed" ? <div className="newsletter-unsubscribed"><ShieldCheck /> This address is already unsubscribed.</div> : <button className="button" onClick={unsubscribe} disabled={busy}>{busy ? "Updating…" : "Unsubscribe from marketing"}</button>}</>}<Link to="/privacy">Read our privacy notice</Link></div></section>;
}
