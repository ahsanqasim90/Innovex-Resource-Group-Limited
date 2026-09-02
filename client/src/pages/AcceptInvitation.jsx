import { useEffect, useState } from "react";
import { ArrowRight, Building2, LockKeyhole, UserRoundCheck } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api, setWorkspaceSlug } from "../api/client.js";
import SEO from "../components/SEO.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import SubmitButton from "../components/SubmitButton.jsx";

export default function AcceptInvitation() {
  const [params] = useSearchParams();
  const [invitation, setInvitation] = useState(null);
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const token = params.get("token") || "";

  useEffect(() => {
    if (params.get("workspace")) setWorkspaceSlug(params.get("workspace"));
    api(`/organizations/invitations/verify/${encodeURIComponent(token)}`).then(setInvitation).catch((error) => setStatus({ type: "error", message: error.message }));
  }, [params, token]);

  async function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (data.password !== data.confirmPassword) return setStatus({ type: "error", message: "Passwords do not match" });
    setSubmitting(true);
    try {
      const result = await api(`/organizations/invitations/accept/${encodeURIComponent(token)}`, { method: "POST", body: { name: data.name, password: data.password } });
      setStatus({ type: "success", message: result.message });
    } catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setSubmitting(false); }
  }

  return <main className="auth-recovery-page"><SEO title="Accept Workspace Invitation" noIndex /><section className="auth-recovery-card">
    <div className="auth-recovery-icon"><Building2 /></div><span className="login-secure-label"><UserRoundCheck size={15} /> Secure team invitation</span>
    <h1>Join {invitation?.organization?.name || "the workspace"}</h1><p>{invitation ? `${invitation.email} has been invited with the ${invitation.role.replaceAll("_", " ")} role.` : "Checking your invitation…"}</p>
    <StatusMessage status={status} />
    {invitation && status?.type !== "success" && <form className="login-form" onSubmit={submit}>
      <label className="login-field"><span>Your name</span><div><UserRoundCheck size={18} /><input name="name" defaultValue={invitation.name} autoComplete="name" required /></div></label>
      <label className="login-field"><span>Create password</span><div><LockKeyhole size={18} /><input name="password" type="password" minLength="12" autoComplete="new-password" required /></div></label>
      <label className="login-field"><span>Confirm password</span><div><LockKeyhole size={18} /><input name="confirmPassword" type="password" minLength="12" autoComplete="new-password" required /></div></label>
      <SubmitButton loading={submitting}>Create workspace account <ArrowRight size={17} /></SubmitButton>
    </form>}
    <Link className="auth-back-link" to="/admin/login">Go to secure sign in</Link>
  </section></main>;
}
