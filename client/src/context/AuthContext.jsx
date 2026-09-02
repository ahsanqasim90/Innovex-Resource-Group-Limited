import { createContext, useContext, useEffect, useState } from "react";
import { api, setCsrfToken, setToken } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    api("/auth/me")
      .then((data) => { setToken(null); setUser(data.user); setCsrfToken(data.csrfToken); })
      .catch(() => { setToken(null); setCsrfToken(null); setUser(null); })
      .finally(() => setLoadingUser(false));
  }, []);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener("innovex:logout", onLogout);
    return () => window.removeEventListener("innovex:logout", onLogout);
  }, []);

  async function login(email, password, mfaCode = "") {
    const data = await api("/auth/login", { method: "POST", body: { email, password, mfaCode } });
    if (data.mfaRequired && !data.user) return data;
    setToken(null);
    setCsrfToken(data.csrfToken);
    setUser(data.user);
    return data;
  }

  function logout() {
    api("/auth/logout", { method: "POST" }).catch(() => {});
    setToken(null);
    setCsrfToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loadingUser, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
