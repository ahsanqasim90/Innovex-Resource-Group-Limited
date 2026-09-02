import { useState } from "react";
import {
  ArrowRight, BriefcaseBusiness, ChartNoAxesCombined, Check, Eye, EyeOff,
  KeyRound, LockKeyhole, Mail, ShieldCheck, Sparkles, UsersRound
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import SEO from "../../components/SEO.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [credentials, setCredentials] = useState(null);

  async function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setStatus(null);
    setSubmitting(true);
    try {
      const email = data.email || credentials?.email;
      const password = data.password || credentials?.password;
      const result = await login(email, password, data.mfaCode || "");
      if (result.mfaRequired && !result.user) {
        setCredentials({ email, password });
        setMfaRequired(true);
        setStatus({ type: "info", message: result.message });
        return;
      }
      navigate(result.user?.role === "external_agent" || result.user?.role === "sales_manager" ? "/admin/web-leads" : result.user?.permissions?.includes("dashboard.view") ? "/admin/dashboard" : "/admin/attendance");
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <SEO title="Admin Login" description="Secure Innovex admin login." path="/admin/login" noIndex />
      <span className="login-ambient login-ambient-one" aria-hidden="true" />
      <span className="login-ambient login-ambient-two" aria-hidden="true" />
      <section className="login-shell">
        <aside className="login-story">
          <header className="login-story-brand">
            <span><img src="/Logo.png" alt="Innovex Resource Group Limited" width="50" height="50" /></span>
            <div><small>INNOVEX</small><strong>Resource Group Limited</strong></div>
          </header>

          <div className="login-story-copy">
            <span className="login-story-kicker"><Sparkles size={14} /> Innovex recruitment command centre</span>
            <h1>Move every hire<br /><em>forward.</em></h1>
            <p>Manage vacancies, candidate submissions, interviews and placements from one focused Innovex workspace.</p>
            <div className="login-capabilities" aria-label="Workspace capabilities">
              <span><BriefcaseBusiness size={17} /> Vacancies &amp; submissions</span>
              <span><UsersRound size={17} /> Candidate pipeline</span>
              <span><ChartNoAxesCombined size={17} /> Team performance</span>
            </div>
          </div>

          <footer className="login-story-footer">
            <span><ShieldCheck size={19} /></span>
            <div><strong>One team. One hiring workflow.</strong><small>Secure, accountable recruitment delivery from vacancy to placement.</small></div>
          </footer>
        </aside>

        <section className="login-access-panel">
          <div className="login-access-card">
            <div className="login-secure-label"><span><LockKeyhole size={15} /></span> Private team portal</div>
            <div className="login-access-heading"><h2>{mfaRequired ? "Verify it’s you" : "Welcome to Innovex"}</h2><p>{mfaRequired ? "Enter your six-digit authenticator code or a recovery code." : "Sign in to keep every vacancy, candidate and placement moving."}</p></div>
            <StatusMessage status={status} />
            <form className="login-form" onSubmit={submit}>
              {!mfaRequired && <>
                <label className="login-field"><span>Email address</span><div><Mail size={18} /><input name="email" type="email" placeholder="name@innovexresourcegroup.co.uk" autoComplete="email" inputMode="email" required /></div></label>
                <label className="login-field"><span>Password</span><div><LockKeyhole size={18} /><input name="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
              </>}
              {mfaRequired && <label className="login-field"><span>Authentication code</span><div><KeyRound size={18} /><input name="mfaCode" inputMode="numeric" autoComplete="one-time-code" placeholder="000000 or recovery code" required autoFocus /></div></label>}
              <div className="login-form-meta"><span><Check size={13} /> Encrypted sign-in</span><small>Authorised personnel only</small></div>
              <SubmitButton loading={submitting} loadingText={mfaRequired ? "Verifying..." : "Opening workspace..."}>{mfaRequired ? "Verify and continue" : "Enter Innovex workspace"} <ArrowRight size={17} /></SubmitButton>
              {mfaRequired && <button className="login-secondary-action" type="button" onClick={() => { setMfaRequired(false); setCredentials(null); setStatus(null); }}>Use another account</button>}
            </form>
            <div className="login-help"><span>Having trouble accessing your workspace?</span><Link to="/forgot-password">Reset your password securely</Link></div>
          </div>
          <footer className="login-access-footer"><span>© {new Date().getFullYear()} Innovex Resource Group Limited</span><span>Protected workspace • Authorised access</span></footer>
        </section>
      </section>
    </main>
  );
}
