import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, setCsrfToken, setToken } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const refreshVersion = useRef(0);
  const refreshInFlight = useRef(null);
  const lastRefreshAt = useRef(0);

  const refreshUser = useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const version = ++refreshVersion.current;
    const request = api("/auth/me", { cache: "no-store" }).then((data) => {
      if (version === refreshVersion.current) {
        setToken(null); setUser(data.user); setCsrfToken(data.csrfToken);
        lastRefreshAt.current = Date.now();
      }
      return data.user;
    });
    refreshInFlight.current = request;
    try { return await request; }
    finally { if (refreshInFlight.current === request) refreshInFlight.current = null; }
  }, []);

  useEffect(() => {
    if (!window.location.pathname.startsWith("/admin")) {
      setLoadingUser(false);
      return undefined;
    }
    refreshUser()
      .catch(() => { setToken(null); setCsrfToken(null); setUser(null); })
      .finally(() => setLoadingUser(false));
  }, [refreshUser]);

  useEffect(() => {
    if (!user?.id) return;
    const refreshIfStale = () => {
      if (document.visibilityState !== "hidden" && Date.now() - lastRefreshAt.current >= 120_000) {
        refreshUser().catch(() => {});
      }
    };
    window.addEventListener("focus", refreshIfStale);
    document.addEventListener("visibilitychange", refreshIfStale);
    const timer = window.setInterval(refreshIfStale, 300_000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshIfStale);
      document.removeEventListener("visibilitychange", refreshIfStale);
    };
  }, [user?.id, refreshUser]);

  useEffect(() => {
    const onLogout = () => { refreshVersion.current += 1; setUser(null); };
    window.addEventListener("innovex:logout", onLogout);
    return () => window.removeEventListener("innovex:logout", onLogout);
  }, []);

  async function login(email, password, mfaCode = "") {
    refreshVersion.current += 1;
    const data = await api("/auth/login", { method: "POST", body: { email, password, mfaCode } });
    if (data.mfaRequired && !data.user) return data;
    refreshVersion.current += 1;
    setToken(null);
    setCsrfToken(data.csrfToken);
    setUser(data.user);
    lastRefreshAt.current = Date.now();
    return data;
  }

  function logout() {
    refreshVersion.current += 1;
    api("/auth/logout", { method: "POST" }).catch(() => {});
    setToken(null);
    setCsrfToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loadingUser, login, logout, refreshUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
