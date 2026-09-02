import { useEffect, useState } from "react";
import { ArrowRight, KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api, setWorkspaceSlug } from "../api/client.js";
import SEO from "../components/SEO.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import SubmitButton from "../components/SubmitButton.jsx";

export default function PasswordRecovery({ mode = "request" }) {
  const [params] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const token = params.get("token") || "";

  useEffect(() => { if (params.get("workspace")) setWorkspaceSlug(params.get("workspace")); }, [params]);

  async function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (mode === "reset" && data.password !== data.confirmPassword) return setStatus({ type: "error", message: "Passwords do not match" });
    setSubmitting(true);
    setStatus(null);
    try {
      const result = mode === "reset"
        ? await api(`/auth/reset-password/${encodeURIComponent(token)}`, { method: "POST", body: { password: data.password } })
        : await api("/auth/forgot-password", { method: "POST", body: { email: data.email } });
      setStatus({ type: "success", message: result.message });
      event.currentTarget.reset();
    } catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setSubmitting(false); }
  }

  return <main className="auth-recovery-page">
    <SEO title={mode === "reset" ? "Reset Password" : "Forgot Password"} noIndex />
    <section className="auth-recovery-card">
      <div className="auth-recovery-icon">{mode === "reset" ? <KeyRound /> : <Mail />}</div>
      <span className="login-secure-label"><ShieldCheck size={15} /> Secure account recovery</span>
      <h1>{mode === "reset" ? "Choose a new password" : "Reset your password"}</h1>
      <p>{mode === "reset" ? "Use at least 12 characters. Other signed-in devices will be securely revoked." : "Enter your workspace email. If the account exists, we will send a time-limited reset link."}</p>
      <StatusMessage status={status} />
      <form className="login-form" onSubmit={submit}>
        {mode === "request" ? <label className="login-field"><span>Email address</span><div><Mail size={18} /><input name="email" type="email" autoComplete="email" required /></div></label> : <>
          <label className="login-field"><span>New password</span><div><LockKeyhole size={18} /><input name="password" type="password" minLength="12" autoComplete="new-password" required /></div></label>
          <label className="login-field"><span>Confirm new password</span><div><LockKeyhole size={18} /><input name="confirmPassword" type="password" minLength="12" autoComplete="new-password" required /></div></label>
        </>}
        <SubmitButton loading={submitting}>{mode === "reset" ? "Update password" : "Send reset link"} <ArrowRight size={17} /></SubmitButton>
      </form>
      <Link className="auth-back-link" to="/admin/login">Back to secure sign in</Link>
    </section>
  </main>;
}

