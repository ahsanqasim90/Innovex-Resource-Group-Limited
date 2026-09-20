import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";

const POLL_MS = 60_000;
const ASKED_KEY = "innovexAdminAlertAsked";
const MUTE_KEY = "innovexAdminAlertMuted";

function readFlag(key) {
  try { return localStorage.getItem(key) === "1"; } catch { return false; }
}

function playChime() {
  try {
    if (readFlag(MUTE_KEY)) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    const start = context.currentTime;
    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + index * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.12, start + index * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + index * 0.16 + 0.22);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start + index * 0.16);
      oscillator.stop(start + index * 0.16 + 0.25);
    });
    window.setTimeout(() => context.close().catch(() => {}), 800);
  } catch { /* the browser may block sound until the page has been clicked */ }
}

/**
 * WhatsApp-style unread counts for the admin sidebar.
 * `sections` maps a sidebar path (e.g. "/admin/website-enquiries") to its badge key and label.
 */
export function useAdminBadges({ enabled, pathname, sections }) {
  const [counts, setCounts] = useState({});
  const previousRef = useRef(null);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const baseTitle = useRef(typeof document !== "undefined" ? document.title : "");

  const refresh = useCallback(async () => {
    try {
      const data = await api("/admin-badges");
      const next = data.counts || {};
      const previous = previousRef.current;
      if (previous) {
        const fresh = Object.keys(next).filter((key) => (next[key] || 0) > (previous[key] || 0));
        if (fresh.length) {
          playChime();
          if (document.hidden && "Notification" in window && Notification.permission === "granted") {
            const labels = fresh.map((key) => sectionsRef.current.find((section) => section.key === key)?.label || key).join(", ");
            try { new Notification("Innovex Workspace", { body: `New in: ${labels}`, icon: "/Logo.png" }); } catch { /* ignore */ }
          }
        }
      }
      previousRef.current = next;
      setCounts(next);
    } catch { /* badges are a convenience, never block the page */ }
  }, []);

  const markSeen = useCallback(async (key) => {
    setCounts((current) => (current[key] ? { ...current, [key]: 0 } : current));
    if (previousRef.current) previousRef.current = { ...previousRef.current, [key]: 0 };
    try { await api("/admin-badges/seen", { method: "POST", body: JSON.stringify({ section: key }) }); } catch { /* try again on next visit */ }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [enabled, refresh]);

  // Opening a section clears its count; leaving it clears anything that arrived while it was open.
  useEffect(() => {
    if (!enabled) return undefined;
    const section = sectionsRef.current.find((item) => item.href === pathname);
    if (!section) return undefined;
    markSeen(section.key);
    return () => { markSeen(section.key); };
  }, [enabled, pathname, markSeen]);

  // One-time, click-triggered request so the browser allows desktop alerts.
  useEffect(() => {
    if (!enabled || !("Notification" in window) || Notification.permission !== "default" || readFlag(ASKED_KEY)) return undefined;
    const ask = () => {
      try { localStorage.setItem(ASKED_KEY, "1"); } catch { /* ignore */ }
      Notification.requestPermission().catch(() => {});
    };
    window.addEventListener("pointerdown", ask, { once: true });
    return () => window.removeEventListener("pointerdown", ask);
  }, [enabled]);

  const total = Object.values(counts).reduce((sum, value) => sum + (value || 0), 0);
  useEffect(() => {
    if (!enabled) return;
    if (!baseTitle.current || !/^\(\d+\+?\)\s/.test(document.title)) baseTitle.current = document.title.replace(/^\(\d+\+?\)\s/, "");
    document.title = total > 0 ? `(${total > 99 ? "99+" : total}) ${baseTitle.current}` : baseTitle.current;
  }, [enabled, total, pathname]);

  return { counts, total, markSeen };
}
