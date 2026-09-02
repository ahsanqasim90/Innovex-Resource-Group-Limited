import { useEffect, useState } from "react";
import { ArrowRight, Building2, KeyRound, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getWorkspaceSlug, portalApi, setWorkspaceSlug } from "../api/client.js";
import StatusMessage from "../components/StatusMessage.jsx";

export default function PortalAccess({ mode = "login" }) {
  const [params] = useSearchParams(); const navigate = useNavigate();
  const [invitation, setInvitation] = useState(null); const [status, setStatus] = useState(null); const [working, setWorking] = useState(false);
  const token = params.get("token") || "";
  useEffect(() => { if (params.get("workspace")) setWorkspaceSlug(params.get("workspace")); if (mode === "activate" && token) portalApi(`/portal/invitation/${encodeURIComponent(token)}`).then(setInvitation).catch((error) => setStatus({ type: "error", message: error.message })); }, [mode, params, token]);
  async function submit(event) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); setWorking(true); setStatus(null);
    try {
      if (mode === "activate") { if (values.password !== values.confirmPassword) throw new Error("Passwords do not match"); const result = await portalApi(`/portal/invitation/${encodeURIComponent(token)}/activate`, { method: "POST", body: { password: values.password } }); setStatus({ type: "success", message: result.message }); }
      else { setWorkspaceSlug(values.workspace); await portalApi("/portal/login", { method: "POST", body: { email: values.email, password: values.password } }); navigate("/portal"); }
    } catch (error) { setStatus({ type: "error", message: error.message }); } finally { setWorking(false); }
  }
  return <main className="external-portal-access"><section className="portal-access-brand"><img src="/Logo.png" alt="Innovex" /><span><small>INNOVEX</small><strong>Secure Portal</strong></span></section><section className="portal-access-card"><div className="portal-access-icon">{mode === "activate" ? <UserRound /> : <KeyRound />}</div><span className="portal-security-label"><ShieldCheck /> Tenant-isolated secure access</span><h1>{mode === "activate" ? `Activate your ${invitation?.type?.toLowerCase() || ""} portal` : "Welcome back"}</h1><p>{mode === "activate" ? invitation ? `${invitation.name}, create a password for your ${invitation.organization} portal.` : "Validating your invitation…" : "Sign in to your candidate or client workspace."}</p><StatusMessage status={status} />
      {(mode === "login" || invitation) && status?.type !== "success" && <form onSubmit={submit}>{mode === "login" && <label><span>Workspace code</span><div><Building2 /><input name="workspace" defaultValue={params.get("workspace") || getWorkspaceSlug()} placeholder="innovex-resource-group" autoCapitalize="none" required /></div><small>Use the workspace code from your invitation, not the client organisation name.</small></label>}{mode === "login" && <label><span>Email address</span><div><UserRound /><input name="email" type="email" autoComplete="email" required /></div></label>}<label><span>{mode === "activate" ? "Create password" : "Password"}</span><div><LockKeyhole /><input name="password" type="password" minLength={mode === "activate" ? 12 : 1} autoComplete={mode === "activate" ? "new-password" : "current-password"} required /></div></label>{mode === "activate" && <label><span>Confirm password</span><div><LockKeyhole /><input name="confirmPassword" type="password" minLength="12" autoComplete="new-password" required /></div></label>}<button disabled={working}>{working ? "Securing access…" : mode === "activate" ? "Activate secure portal" : "Sign in securely"}<ArrowRight /></button></form>}
      {mode === "activate" && status?.type === "success" && <Link className="portal-login-link" to={`/portal/login?workspace=${encodeURIComponent(params.get("workspace") || getWorkspaceSlug())}`}>Continue to portal sign in <ArrowRight /></Link>}<footer><LockKeyhole /> Your session is encrypted, audited and expires automatically.</footer></section></main>;
}
