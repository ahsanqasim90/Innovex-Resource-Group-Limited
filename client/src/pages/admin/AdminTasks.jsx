import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ListTodo, Plus, RefreshCw, Search, X } from "lucide-react";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { hasPermission } from "../../auth/permissions.js";
import AdminLoadState from "../../components/AdminLoadState.jsx";

const blank = { title: "", description: "", priority: "Normal", dueAt: "", assignedTo: "" };
export default function AdminTasks() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "automations.manage");
  const canExecute = hasPermission(user, "automations.execute");
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ status: "Open", priority: "", mine: false, overdue: false, search: "", page: 1 });
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(blank);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef(null);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError("");
    try { setData(await api("/automations/tasks?" + new URLSearchParams(filters), { signal: controller.signal })); }
    catch (err) { if (err.name !== "AbortError") setError(err.message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [filters]);
  useEffect(() => { load(); return () => request.current?.abort(); }, [load]);
  function filter(key, value) { setFilters((current) => ({ ...current, [key]: value, page: 1 })); }
  function edit(task) {
    const due = task.dueAt ? new Date(task.dueAt) : null;
    setForm({ title: task.title, description: task.description || "", priority: task.priority, dueAt: due ? new Date(due.getTime() - due.getTimezoneOffset() * 60000).toISOString().slice(0,16) : "", assignedTo: task.assignedTo?._id || "" });
    setEditing(task._id); setAdding(true); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function create(event) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      await api(editing ? `/automations/tasks/${editing}` : "/automations/tasks", { method: editing ? "PUT" : "POST", body: { ...form, dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : "" } });
      setForm(blank); setAdding(false); setEditing(""); setNotice(editing ? "Task updated." : "Task created. Use the filters below to find it.");
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  async function changeStatus(task, status) {
    setUpdating(task._id); setError(""); setNotice("");
    try { await api(`/automations/tasks/${task._id}`, { method: "PATCH", body: { status } }); setNotice(`Task ${status.toLowerCase()}.`); await load(); }
    catch (err) { setError(err.message); }
    finally { setUpdating(""); }
  }
  if (!data) return <AdminLoadState error={error} onRetry={load} label="Loading team tasks…" />;
  return <div className="workspace-tasks">
    <section className="workspace-welcome"><div><span className="eyebrow">Plan · assign · follow through</span><h2>Team tasks</h2><p>Manual tasks and automated follow-ups in one shared register.</p></div><div className="workspace-toolbar"><button className="button secondary" onClick={load} disabled={loading} aria-label="Refresh tasks"><RefreshCw size={17} className={loading ? "spinning" : ""} /></button>{canManage && <button className="button" onClick={() => { setForm(blank); setEditing(""); setAdding(!adding); }}>{adding ? <X size={17} /> : <Plus size={17} />}{adding ? "Close form" : "New task"}</button>}</div></section>
    {error && <div className="workspace-inline-error" role="alert">{error} <button onClick={load}>Reload tasks</button></div>}
    {notice && <p className="workspace-notice" role="status"><CheckCircle2 size={17} />{notice}</p>}
    {adding && <form className="workspace-panel workspace-task-form" onSubmit={create}><h3>{editing ? "Edit task" : "Create a task"}</h3><label className="wide">Task title<input autoFocus required maxLength={180} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs to happen?" /></label><label className="wide">Details<textarea rows={3} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><label>Assign to<select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}><option value="">Unassigned</option>{data.team.map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}</select></label><label>Priority<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{["Low", "Normal", "High", "Urgent"].map((p) => <option key={p}>{p}</option>)}</select></label><label>Due date and time (local)<input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} /></label><div className="workspace-toolbar wide"><button className="button" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create task"}</button><button className="button secondary" type="button" onClick={() => setAdding(false)} disabled={saving}>Cancel</button></div></form>}
    <section className="workspace-panel"><form className="workspace-task-filters" onSubmit={(e) => { e.preventDefault(); filter("search", search); }}><label className="workspace-task-search"><span>Search tasks</span><span><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title" maxLength={100} /><button className="button small" type="submit">Search</button></span></label><label>Status<select value={filters.status} disabled={filters.overdue} onChange={(e) => filter("status", e.target.value)}><option value="">All statuses</option>{["Open", "Completed", "Cancelled"].map((s) => <option key={s}>{s}</option>)}</select></label><label>Priority<select value={filters.priority} onChange={(e) => filter("priority", e.target.value)}><option value="">All priorities</option>{["Low", "Normal", "High", "Urgent"].map((p) => <option key={p}>{p}</option>)}</select></label><label className="workspace-check"><input type="checkbox" checked={filters.mine} onChange={(e) => filter("mine", e.target.checked)} />Assigned to me</label><label className="workspace-check"><input type="checkbox" checked={filters.overdue} onChange={(e) => filter("overdue", e.target.checked)} />Overdue only</label><button type="button" className="workspace-reset" onClick={() => { setSearch(""); setFilters({ status: "Open", priority: "", mine: false, overdue: false, search: "", page: 1 }); }}>Reset filters</button></form>
      <div className="workspace-task-register" aria-busy={loading}>{data.items.map((task) => {
        const overdue = task.status === "Open" && task.dueAt && new Date(task.dueAt) < new Date();
        return <article key={task._id}><span className={`workspace-task-symbol ${overdue ? "overdue" : ""}`}><ListTodo size={20} /></span><div><div className="workspace-task-title"><h3>{task.title}</h3><span className={`workspace-priority ${task.priority.toLowerCase()}`}>{task.priority}</span><span className="workspace-status">{task.status}</span></div>{task.description && <p>{task.description}</p>}<div className="workspace-task-meta"><span>{task.assignedTo?.name || "Unassigned"}</span><span className={overdue ? "overdue" : ""}>{overdue ? "Overdue · " : ""}{task.dueAt ? new Date(task.dueAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "No due date"}</span><span>{task.rule ? "Automation" : "Manual task"}</span></div></div>{(canExecute || canManage) && <div className="workspace-task-buttons">{canManage && <button className="workspace-reset" disabled={loading} onClick={() => edit(task)}>Edit task</button>}{canExecute && <>{task.status === "Open" ? <><button className="button secondary small" disabled={Boolean(updating) || loading} onClick={() => changeStatus(task, "Completed")}><CheckCircle2 size={15} />Complete</button><button className="workspace-reset" disabled={Boolean(updating) || loading} onClick={() => changeStatus(task, "Cancelled")}>Cancel task</button></> : <button className="button secondary small" disabled={Boolean(updating) || loading} onClick={() => changeStatus(task, "Open")}>Reopen</button>}</>}</div>}</article>;
      })}{!data.items.length && <div className="workspace-empty"><ListTodo /><strong>No tasks match these filters</strong><p>Try clearing the filters{canManage ? " or create a new task." : "."}</p></div>}</div>
      <footer className="workspace-pagination"><span>{data.total} task{data.total === 1 ? "" : "s"} · Page {data.page} of {data.pages}</span><div><button disabled={loading || filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Previous</button><button disabled={loading || filters.page >= data.pages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</button></div></footer>
    </section>
  </div>;
}
