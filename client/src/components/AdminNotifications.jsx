import { useEffect, useRef, useState } from "react";
import { Bell, BriefcaseBusiness, CheckCheck, Lightbulb, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";

function timeLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function AdminNotifications() {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);

  async function load(silent = false, { summaryOnly = false } = {}) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await api(`/portal-notifications?limit=${summaryOnly ? 1 : 30}`);
      if (!summaryOnly) setItems(data.items || []);
      setUnread(data.unread || 0);
    } catch (err) {
      setError(err.message || "Notifications could not be loaded.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    load(true, { summaryOnly: true });
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load(true, { summaryOnly: true });
    }, 180_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!panelRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    const onEscape = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onEscape);
    return () => { document.removeEventListener("mousedown", onPointerDown); document.removeEventListener("keydown", onEscape); };
  }, [open]);

  async function openNotification(notification) {
    setSaving(true); setError("");
    try {
      if (!notification.read) {
        await api(`/portal-notifications/${notification._id}/read`, { method: "PATCH" });
        setItems((current) => current.map((item) => item._id === notification._id ? { ...item, read: true } : item));
        setUnread((current) => Math.max(0, current - 1));
      }
      setOpen(false);
      if (notification.link?.startsWith("/admin/")) navigate(notification.link);
    } catch (err) { setError("Could not mark this notification as read. " + err.message); }
    finally { setSaving(false); }
  }

  async function markAllRead() {
    setSaving(true); setError("");
    try {
      await api("/portal-notifications/read-all", { method: "PATCH" });
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      setUnread(0);
    } catch (err) { setError("Could not mark notifications as read. " + err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="admin-notification-centre" ref={panelRef}>
      <button type="button" className={`admin-notification-trigger${open ? " active" : ""}`} onClick={() => { setOpen((value) => !value); if (!open) load(); }} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open}>
        <Bell size={18} />{unread > 0 && <span>{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && <section className="admin-notification-panel" aria-label="Portal notifications">
        <header><div><span>Activity centre</span><h2>Notifications</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close notifications"><X size={17} /></button></header>
        <div className="notification-filter"><button type="button" aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>All</button><button type="button" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>Unread</button></div>
        {error && <div className="workspace-inline-error" role="alert">{error}<button onClick={() => load()}>Retry</button></div>}
        {unread > 0 && <div className="admin-notification-tools"><span>{unread} unread notification{unread === 1 ? "" : "s"}</span><button type="button" disabled={saving} onClick={markAllRead}><CheckCheck size={15} /> Mark all read</button></div>}
        <div className="admin-notification-list">
          {loading && <div className="admin-notification-empty"><span className="notification-loader" />Loading notifications...</div>}
          {!loading && items.filter((item) => !unreadOnly || !item.read).map((notification) => <button type="button" disabled={saving} className={notification.read ? "read" : "unread"} key={notification._id} onClick={() => openNotification(notification)}>
            <span className="admin-notification-icon">{notification.type?.startsWith("suggestion") ? <Lightbulb size={18} /> : <BriefcaseBusiness size={18} />}</span>
            <span><strong>{notification.title}</strong><p>{notification.message}</p><small>{timeLabel(notification.createdAt)}</small></span>
            {!notification.read && <i />}
          </button>)}
          {!loading && !error && !items.filter((item) => !unreadOnly || !item.read).length && <div className="admin-notification-empty"><Bell size={24} /><strong>{unreadOnly ? "No unread notifications in the latest 30" : "No notifications yet"}</strong><span>Workspace updates will appear here.</span></div>}
        </div>
      </section>}
    </div>
  );
}
