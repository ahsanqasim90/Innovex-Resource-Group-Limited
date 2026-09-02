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

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const data = await api("/portal-notifications?limit=30");
      setItems(data.items || []);
      setUnread(data.unread || 0);
    } catch {
      // Notifications should never interrupt the rest of the admin workspace.
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!panelRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  async function openNotification(notification) {
    if (!notification.read) {
      setItems((current) => current.map((item) => item._id === notification._id ? { ...item, read: true } : item));
      setUnread((current) => Math.max(0, current - 1));
      await api(`/portal-notifications/${notification._id}/read`, { method: "PATCH" }).catch(() => {});
    }
    setOpen(false);
    if (notification.link) navigate(notification.link);
  }

  async function markAllRead() {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    setUnread(0);
    await api("/portal-notifications/read-all", { method: "PATCH" }).catch(() => {});
  }

  return (
    <div className="admin-notification-centre" ref={panelRef}>
      <button type="button" className={`admin-notification-trigger${open ? " active" : ""}`} onClick={() => { setOpen((value) => !value); if (!open) load(true); }} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open}>
        <Bell size={18} />{unread > 0 && <span>{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && <section className="admin-notification-panel" aria-label="Portal notifications">
        <header><div><span>Activity centre</span><h2>Notifications</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close notifications"><X size={17} /></button></header>
        {unread > 0 && <div className="admin-notification-tools"><span>{unread} unread notification{unread === 1 ? "" : "s"}</span><button type="button" onClick={markAllRead}><CheckCheck size={15} /> Mark all read</button></div>}
        <div className="admin-notification-list">
          {loading && <div className="admin-notification-empty"><span className="notification-loader" />Loading notifications...</div>}
          {!loading && items.map((notification) => <button type="button" className={notification.read ? "read" : "unread"} key={notification._id} onClick={() => openNotification(notification)}>
            <span className="admin-notification-icon">{notification.type?.startsWith("suggestion") ? <Lightbulb size={18} /> : <BriefcaseBusiness size={18} />}</span>
            <span><strong>{notification.title}</strong><p>{notification.message}</p><small>{timeLabel(notification.createdAt)}</small></span>
            {!notification.read && <i />}
          </button>)}
          {!loading && !items.length && <div className="admin-notification-empty"><Bell size={24} /><strong>You are all caught up</strong><span>New vacancy alerts will appear here.</span></div>}
        </div>
      </section>}
    </div>
  );
}
