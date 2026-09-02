import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import SEO from "../components/SEO.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import { company } from "../data/content.js";

const interestOptions = ["Recruitment", "Training", "Website Development", "SEO", "Reg 44", "Business Growth", "General"];

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "";
}

function NewsletterDetail({ slug }) {
  const [item, setItem] = useState(null);
  const [status, setStatus] = useState(null);
  useEffect(() => { api(`/newsletters/public/${slug}`).then(setItem).catch((error) => setStatus({ type: "error", message: error.message })); }, [slug]);
  if (!item) return <section className="section newsletter-public-page"><StatusMessage status={status} /><p>Loading newsletter…</p></section>;
  return <section className="section newsletter-public-page">
    <SEO title={item.headline} path={`/newsletters/${item.slug}`} description={item.preheader || item.introduction.slice(0, 155)} jsonLd={{ "@context": "https://schema.org", "@type": "Article", headline: item.headline, datePublished: item.publishedAt || item.sentAt, publisher: { "@type": "Organization", name: company.name }, mainEntityOfPage: `${company.siteUrl}/newsletters/${item.slug}` }} />
    <article className="newsletter-public-article">
      <header><span className="eyebrow">Innovex client briefing · {formatDate(item.publishedAt || item.sentAt)}</span><h1>{item.headline}</h1><p>{item.preheader}</p></header>
      <div className="newsletter-public-copy"><p className="lead">{item.introduction}</p>{item.insightTitle && <section><h2>{item.insightTitle}</h2>{String(item.insightBody || "").split("\n").filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}</section>}
      {!!item.serviceFocus?.length && <div className="newsletter-topic-row">{item.serviceFocus.map((topic) => <span key={topic}>{topic}</span>)}</div>}
      {item.ctaUrl && <a className="button" href={item.ctaUrl}>{item.ctaLabel || "Speak to Innovex"} <ArrowRight size={17} /></a>}</div>
    </article>
    <div className="newsletter-back-link"><Link to="/newsletters">← Browse all Innovex briefings</Link></div>
  </section>;
}

export default function Newsletters() {
  const { slug } = useParams();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ firstName: "", email: "", interests: ["General"], consent: false, website: "" });
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!slug) api("/newsletters/public").then(setItems).catch((error) => setStatus({ type: "error", message: error.message })); }, [slug]);
  if (slug) return <NewsletterDetail slug={slug} />;

  async function subscribe(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api("/newsletters/subscribe", { method: "POST", body: form });
      setStatus({ message: result.message });
      setForm({ firstName: "", email: "", interests: ["General"], consent: false, website: "" });
    } catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setBusy(false); }
  }

  return <section className="section newsletter-public-page">
    <SEO title="Client Newsletter & Business Insights" path="/newsletters" description="Subscribe to Innovex Resource Group Limited newsletters for healthcare recruitment, training, website development, SEO and practical business growth insights." jsonLd={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "Innovex client newsletter", url: `${company.siteUrl}/newsletters` }} />
    <div className="newsletter-public-hero"><div><span className="eyebrow"><Mail size={16} /> Innovex client briefing</span><h1>Useful updates for care and business leaders</h1><p>Concise recruitment, training and digital growth advice—written to be useful, never noisy.</p><div><span><CheckCircle2 /> Practical insights</span><span><ShieldCheck /> UK privacy controls</span></div></div>
      <form className="newsletter-signup-card" onSubmit={subscribe}><h2>Join the newsletter</h2><p>Choose what is relevant to you. Every email includes an unsubscribe link.</p><label>First name<input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></label><label>Email address<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><fieldset><legend>Topics</legend><div>{interestOptions.map((item) => <label key={item}><input type="checkbox" checked={form.interests.includes(item)} onChange={() => setForm({ ...form, interests: form.interests.includes(item) ? form.interests.filter((value) => value !== item) : [...form.interests, item] })} /> {item}</label>)}</div></fieldset><label className="newsletter-consent"><input type="checkbox" required checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} /><span>I would like Innovex Resource Group Limited to email me service news, practical insights and occasional offers. I can unsubscribe at any time. See the <Link to="/privacy">privacy notice</Link>.</span></label><input className="newsletter-honeypot" tabIndex="-1" autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} aria-hidden="true" /><button className="button" disabled={busy}>{busy ? "Subscribing…" : "Subscribe"}</button></form>
    </div>
    <StatusMessage status={status} />
    <div className="newsletter-archive-heading"><span className="eyebrow">Public archive</span><h2>Latest client briefings</h2><p>Public editions provide permanent, shareable pages with direct links to relevant Innovex services.</p></div>
    <div className="newsletter-public-grid">{items.map((item) => <article className="card" key={item._id}><span>{formatDate(item.publishedAt || item.sentAt)}</span><h3>{item.headline}</h3><p>{item.preheader || item.introduction}</p><div>{item.serviceFocus?.slice(0, 3).map((topic) => <small key={topic}>{topic}</small>)}</div><Link to={`/newsletters/${item.slug}`}>Read briefing <ArrowRight size={16} /></Link></article>)}{!items.length && <div className="card newsletter-empty"><Mail size={28} /><h3>The first public briefing is being prepared</h3><p>Subscribe above and we will send only relevant, permission-based updates.</p></div>}</div>
  </section>;
}
