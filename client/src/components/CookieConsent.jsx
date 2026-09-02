import { useState } from "react";
import { Cookie, Settings2, ShieldCheck, X } from "lucide-react";
import { Link } from "react-router-dom";

const storageKey = "innovexCookieConsentV1";

function applyConsent(analytics) {
  const consent = { analytics: Boolean(analytics), updatedAt: new Date().toISOString(), version: 1 };
  localStorage.setItem(storageKey, JSON.stringify(consent));
  window.dispatchEvent(new CustomEvent("innovex:consent", { detail: consent }));
}

export function storedConsent() {
  try { return JSON.parse(localStorage.getItem(storageKey)); } catch { return null; }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(() => !storedConsent());
  const [customise, setCustomise] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  if (!visible) return null;
  function save(value) { applyConsent(value); setVisible(false); }
  return <aside className="cookie-consent" role="dialog" aria-modal="false" aria-label="Cookie choices">
    <button className="cookie-close" onClick={() => save(false)} aria-label="Use essential cookies only"><X /></button>
    <span className="cookie-icon"><Cookie /></span><div className="cookie-copy"><strong>Your privacy choices</strong><p>Essential cookies keep the website and secure portal working. Analytics is optional and stays off unless you allow it.</p><Link to="/privacy">Read our privacy and cookie notice</Link></div>
    {customise && <label className="cookie-toggle"><span><ShieldCheck /><span><strong>Privacy-safe analytics</strong><small>Anonymous usage trends; no form or CV data.</small></span></span><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} /></label>}
    <div className="cookie-actions"><button onClick={() => save(false)}>Essential only</button><button onClick={() => setCustomise((value) => !value)}><Settings2 />Customise</button><button className="accept" onClick={() => save(customise ? analytics : true)}>Accept analytics</button></div>
  </aside>;
}

