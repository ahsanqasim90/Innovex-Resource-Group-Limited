import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SEO from "../../components/SEO.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);

  async function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await login(data.email, data.password);
      navigate("/admin/dashboard");
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  return (
    <main className="login-page">
      <SEO title="Admin Login" description="Secure Innovex admin login." path="/admin/login" noIndex />
      <section className="card login-card">
        <div className="brand"><span className="brand-mark">IR</span> Innovex Admin</div>
        <h1>Admin Login</h1>
        <StatusMessage status={status} />
        <form className="form" onSubmit={submit}>
          <input name="email" type="email" placeholder="Email" required />
          <input name="password" type="password" placeholder="Password" required />
          <button className="button">Login</button>
        </form>
      </section>
    </main>
  );
}
