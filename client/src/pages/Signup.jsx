import { useState } from "react";
import { ArrowRight, Building2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api, setWorkspaceSlug } from "../api/client.js";
import SEO from "../components/SEO.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import SubmitButton from "../components/SubmitButton.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function suggestSlug(companyName) {
  return String(companyName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  function onCompanyNameChange(value) {
    setCompanyName(value);
    if (!slugTouched) setSlug(suggestSlug(value));
  }

  async function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (data.password !== data.confirmPassword) return setStatus({ type: "error", message: "Passwords do not match" });
    if (String(data.password || "").length < 12) return setStatus({ type: "error", message: "Password must be at least 12 characters" });
    setStatus(null);
    setSubmitting(true);
    try {
      // Clear any workspace code left over from a previous session on this browser so
      // the signup request always lands on the shared default workspace, never a
      // stale/unrelated one that might be suspended or on hold.
      setWorkspaceSlug("");
      const result = await api("/organizations/signup", {
        method: "POST",
        body: {
          companyName: data.companyName,
          slug: data.slug,
          name: data.name,
          email: data.email,
          password: data.password
        }
      });
      setWorkspaceSlug(result.organization.slug);
      const loginResult = await login(data.email, data.password);
      navigate(loginResult.user?.permissions?.includes("dashboard.view") ? "/admin/dashboard" : "/admin/attendance");
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-recovery-page">
      <SEO title="Start your workspace" description="Create your own recruitment CRM workspace." path="/signup" noIndex />
      <section className="auth-recovery-card auth-recovery-card-wide">
        <div className="auth-recovery-icon"><Building2 /></div>
        <span className="login-secure-label"><ShieldCheck size={15} /> 14-day free trial, no card required</span>
        <h1>Create your agency workspace</h1>
        <p>Set up your own private recruitment CRM in a minute. Your data stays isolated from every other workspace on the platform.</p>
        <StatusMessage status={status} />
        <form className="login-form" onSubmit={submit}>
          <label className="login-field">
            <span>Company / agency name</span>
            <div><Building2 size={18} /><input name="companyName" value={companyName} onChange={(event) => onCompanyNameChange(event.target.value)} placeholder="Acme Recruitment Ltd" autoComplete="organization" required /></div>
          </label>
          <label className="login-field">
            <span>Workspace code <small>(used to sign in later)</small></span>
            <div><Building2 size={18} /><input name="slug" value={slug} onChange={(event) => { setSlugTouched(true); setSlug(suggestSlug(event.target.value)); }} placeholder="acme-recruitment" required /></div>
          </label>
          <label className="login-field">
            <span>Your name</span>
            <div><UserRound size={18} /><input name="name" placeholder="Full name" autoComplete="name" required /></div>
          </label>
          <label className="login-field">
            <span>Work email address</span>
            <div><Mail size={18} /><input name="email" type="email" placeholder="you@youragency.com" autoComplete="email" required /></div>
          </label>
          <label className="login-field">
            <span>Password</span>
            <div><LockKeyhole size={18} /><input name="password" type={showPassword ? "text" : "password"} minLength="12" autoComplete="new-password" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          </label>
          <label className="login-field">
            <span>Confirm password</span>
            <div><LockKeyhole size={18} /><input name="confirmPassword" type={showPassword ? "text" : "password"} minLength="12" autoComplete="new-password" required /></div>
          </label>
          <SubmitButton loading={submitting} loadingText="Creating your workspace...">Create my workspace <ArrowRight size={17} /></SubmitButton>
        </form>
        <div className="login-help"><span>Already have a workspace?</span><Link to="/admin/login">Sign in</Link></div>
        <Link className="auth-back-link" to="/">Back to the website</Link>
      </section>
    </main>
  );
}
