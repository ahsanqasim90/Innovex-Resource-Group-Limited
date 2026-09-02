import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  FileSpreadsheet,
  LogIn,
  LogOut,
  MapPin,
  Save,
  UserRoundCheck,
  UsersRound
} from "lucide-react";
import { api, downloadFile } from "../../api/client.js";
import { hasPermission } from "../../auth/permissions.js";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

function localDate(value = new Date()) {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function dateLabel(value) {
  if (!value) return "-";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

function timeLabel(value) {
  return value ? new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "-";
}

function durationLabel(record) {
  if (!record?.checkInAt) return "-";
  const end = record.checkOutAt ? new Date(record.checkOutAt) : new Date();
  const minutes = Math.max(0, Math.floor((end - new Date(record.checkInAt)) / 60000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function totalHours(minutes) {
  const value = Number(minutes || 0);
  return `${Math.floor(value / 60)}h ${value % 60}m`;
}

function reportPeriodRange(period, today) {
  const anchor = new Date(`${today}T12:00:00`);
  const from = new Date(anchor);
  const to = new Date(anchor);

  if (period === "weekly") {
    const mondayOffset = anchor.getDay() === 0 ? -6 : 1 - anchor.getDay();
    from.setDate(anchor.getDate() + mondayOffset);
    to.setDate(from.getDate() + 6);
  } else if (period === "monthly") {
    from.setDate(1);
    to.setMonth(anchor.getMonth() + 1, 0);
  }

  return { from: localDate(from), to: localDate(to) };
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const emptyReport = { cvsDownloaded: 0, cvsSubmitted: 0, notes: "", workLocation: "Office" };
const REPORT_REFRESH_MS = 5000;

export default function AdminAttendance() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "attendance.manage");
  const [today, setToday] = useState(localDate());
  const [attendance, setAttendance] = useState(null);
  const [dailyForm, setDailyForm] = useState(emptyReport);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [filters, setFilters] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 29);
    return { from: localDate(from), to: localDate(to), userId: "" };
  });
  const [report, setReport] = useState({ records: [], summaries: [], employees: [], overview: {} });
  const [loadingReport, setLoadingReport] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [reportPeriod, setReportPeriod] = useState("custom");
  const reportRequestInFlight = useRef(false);
  const pendingReportFilters = useRef(null);
  const activeReportFilters = useRef(filters);

  function applyAttendance(record) {
    setAttendance(record || null);
    setDailyForm(record ? {
      cvsDownloaded: record.cvsDownloaded ?? 0,
      cvsSubmitted: record.cvsSubmitted ?? 0,
      notes: record.notes || "",
      workLocation: record.workLocation || "Office"
    } : emptyReport);
  }

  async function loadToday() {
    try {
      const data = await api("/attendance/today");
      setToday(data.today);
      applyAttendance(data.attendance);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  async function loadReport(nextFilters = filters, { background = false } = {}) {
    if (!canManage) return;
    if (!background) {
      activeReportFilters.current = nextFilters;
      setLoadingReport(true);
    }
    if (reportRequestInFlight.current) {
      if (!background) pendingReportFilters.current = nextFilters;
      return;
    }
    reportRequestInFlight.current = true;
    try {
      const query = new URLSearchParams(nextFilters);
      const data = await api(`/attendance/report?${query.toString()}`);
      setReport(data);
    } catch (error) {
      if (!background) setStatus({ type: "error", message: error.message });
    } finally {
      reportRequestInFlight.current = false;
      const pendingFilters = pendingReportFilters.current;
      if (pendingFilters) {
        pendingReportFilters.current = null;
        loadReport(pendingFilters);
      } else if (!background) {
        setLoadingReport(false);
      }
    }
  }

  function applyReportPeriod(period) {
    const range = reportPeriodRange(period, today);
    const nextFilters = { ...filters, ...range };
    setReportPeriod(period);
    setFilters(nextFilters);
    loadReport(nextFilters);
  }

  function downloadAttendanceReport() {
    const appliedFilters = report.filters || activeReportFilters.current;
    const selectedEmployee = report.employees.find((employee) => String(employee.id) === String(appliedFilters.userId));
    const generatedAt = new Date();
    const rows = [
      ["Innovex Resource Group - Attendance Report"],
      ["Generated", generatedAt.toLocaleString("en-GB")],
      ["Period", `${appliedFilters.from} to ${appliedFilters.to}`],
      ["Employee / candidate", selectedEmployee?.name || "All employees"],
      [],
      ["Summary"],
      ["Employee", "Email", "Days present", "Total hours", "CVs downloaded", "CVs submitted"],
      ...report.summaries.map((summary) => [summary.employeeName, summary.employeeEmail, summary.daysPresent, totalHours(summary.totalMinutes), summary.cvsDownloaded, summary.cvsSubmitted]),
      [],
      ["Daily details"],
      ["Date", "Employee", "Email", "Status", "Location", "Check in", "Check out", "Hours", "CVs downloaded", "CVs submitted", "Notes"],
      ...report.records.map((record) => [record.attendanceDate, record.employeeName, record.employeeEmail, record.status || "Present", record.workLocation, timeLabel(record.checkInAt), timeLabel(record.checkOutAt), durationLabel(record), record.cvsDownloaded, record.cvsSubmitted, record.notes || ""])
    ];
    const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const employeePart = (selectedEmployee?.name || "All-Employees").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    link.href = url;
    link.download = `Innovex-Attendance-${employeePart}-${appliedFilters.from}-to-${appliedFilters.to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus({ message: `${selectedEmployee?.name || "Attendance"} report downloaded successfully.` });
  }

  async function downloadAttendancePdf() {
    const appliedFilters = report.filters || activeReportFilters.current;
    const selectedEmployee = report.employees.find((employee) => String(employee.id) === String(appliedFilters.userId));
    const employeePart = (selectedEmployee?.name || "All-Employees").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "All-Employees";
    const query = new URLSearchParams(appliedFilters);
    setDownloadingPdf(true);
    try {
      await downloadFile(
        `/attendance/report.pdf?${query.toString()}`,
        `Innovex-Attendance-${employeePart}-${appliedFilters.from}-to-${appliedFilters.to}.pdf`
      );
      setStatus({ message: `${selectedEmployee?.name || "Attendance"} signed PDF report downloaded successfully.` });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setDownloadingPdf(false);
    }
  }

  useEffect(() => {
    loadToday();
    if (canManage) loadReport();
  }, [canManage]);

  useEffect(() => {
    if (!canManage) return undefined;

    const refreshReport = () => {
      if (document.visibilityState === "visible") {
        loadReport(activeReportFilters.current, { background: true });
      }
    };
    const intervalId = window.setInterval(refreshReport, REPORT_REFRESH_MS);
    window.addEventListener("focus", refreshReport);
    document.addEventListener("visibilitychange", refreshReport);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshReport);
      document.removeEventListener("visibilitychange", refreshReport);
    };
  }, [canManage]);

  async function checkIn() {
    setCheckingIn(true);
    try {
      const data = await api("/attendance/check-in", { method: "POST", body: { workLocation: dailyForm.workLocation } });
      applyAttendance(data);
      setStatus({ message: "Attendance marked successfully. Have a productive day!" });
      if (canManage) loadReport();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setCheckingIn(false);
    }
  }

  async function saveReport(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api("/attendance/today", { method: "PUT", body: dailyForm });
      applyAttendance(data);
      setStatus({ message: "Today's CV activity report has been saved." });
      if (canManage) loadReport();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function checkOut() {
    setCheckingOut(true);
    try {
      const data = await api("/attendance/check-out", { method: "POST", body: dailyForm });
      applyAttendance(data);
      setStatus({ message: "You have checked out successfully." });
      if (canManage) loadReport();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setCheckingOut(false);
    }
  }

  const todayMetrics = useMemo(() => [
    ["Attendance", attendance ? "Present" : "Not marked", UserRoundCheck, attendance ? "success" : "warning"],
    ["Check in", timeLabel(attendance?.checkInAt), LogIn, ""],
    ["Check out", timeLabel(attendance?.checkOutAt), LogOut, ""],
    ["Hours today", attendance ? durationLabel(attendance) : "-", Clock3, ""]
  ], [attendance]);

  return (
    <>
      <section className="attendance-hero">
        <div>
          <span className="eyebrow">Employee workspace</span>
          <h1><CalendarCheck size={30} /> Attendance & Daily CV Report</h1>
          <p>Mark your attendance, record today's recruitment activity, and complete your day with a check-out.</p>
        </div>
        <div className="attendance-date-card">
          <CalendarCheck size={24} />
          <span>Today</span>
          <strong>{dateLabel(today)}</strong>
          <small>Times are recorded automatically</small>
        </div>
      </section>

      <StatusMessage status={status} />

      <section className="attendance-stat-grid">
        {todayMetrics.map(([label, value, Icon, tone]) => (
          <article className={`attendance-stat ${tone}`} key={label}>
            <span><Icon size={21} /></span>
            <div><small>{label}</small><strong>{value}</strong></div>
          </article>
        ))}
      </section>

      <section className="attendance-work-grid">
        <article className="card attendance-mark-card">
          <div className="attendance-card-heading">
            <span><MapPin size={20} /></span>
            <div>
              <h2>Mark attendance</h2>
              <p>Your check-in time is securely recorded when you press the button.</p>
            </div>
          </div>
          <label className="attendance-field">
            <span>Working from</span>
            <select value={dailyForm.workLocation} disabled={Boolean(attendance?.checkOutAt)} onChange={(event) => setDailyForm({ ...dailyForm, workLocation: event.target.value })}>
              <option>Office</option>
              <option>Remote</option>
              <option>Field</option>
            </select>
          </label>
          {!attendance ? (
            <button className="button attendance-primary-action" type="button" disabled={checkingIn} onClick={checkIn}>
              <LogIn size={18} /> {checkingIn ? "Marking attendance..." : "Mark Present / Check In"}
            </button>
          ) : (
            <div className="attendance-confirmed">
              <CheckCircle2 size={23} />
              <div><strong>Attendance marked</strong><span>{attendance.workLocation} · {timeLabel(attendance.checkInAt)}</span></div>
            </div>
          )}
        </article>

        <form className="card attendance-report-card" onSubmit={saveReport}>
          <div className="attendance-card-heading">
            <span><BarChart3 size={20} /></span>
            <div>
              <h2>Today's work report</h2>
              <p>Enter your totals for today. You can update them until check-out.</p>
            </div>
          </div>
          <div className="attendance-count-grid">
            <label className="attendance-field">
              <span><Download size={16} /> CVs downloaded today</span>
              <input type="number" min="0" max="10000" value={dailyForm.cvsDownloaded} disabled={!attendance || Boolean(attendance?.checkOutAt)} onChange={(event) => setDailyForm({ ...dailyForm, cvsDownloaded: event.target.value })} required />
            </label>
            <label className="attendance-field">
              <span><FileCheck2 size={16} /> CVs submitted for interview</span>
              <input type="number" min="0" max="10000" value={dailyForm.cvsSubmitted} disabled={!attendance || Boolean(attendance?.checkOutAt)} onChange={(event) => setDailyForm({ ...dailyForm, cvsSubmitted: event.target.value })} required />
            </label>
          </div>
          <label className="attendance-field">
            <span>Daily notes / achievements</span>
            <textarea rows="4" maxLength="1000" placeholder="Optional: candidates contacted, interviews arranged, follow-ups..." value={dailyForm.notes} disabled={!attendance || Boolean(attendance?.checkOutAt)} onChange={(event) => setDailyForm({ ...dailyForm, notes: event.target.value })} />
          </label>
          <div className="actions attendance-report-actions">
            <SubmitButton loading={saving} loadingText="Saving report..." disabled={!attendance || Boolean(attendance?.checkOutAt)}><Save size={17} /> Save Daily Report</SubmitButton>
            <button className="button secondary" type="button" disabled={!attendance || Boolean(attendance?.checkOutAt) || checkingOut} onClick={checkOut}>
              <LogOut size={17} /> {attendance?.checkOutAt ? "Checked Out" : checkingOut ? "Checking out..." : "Check Out"}
            </button>
          </div>
          {!attendance && <small className="attendance-help">Mark your attendance first to unlock the daily report.</small>}
        </form>
      </section>

      {canManage && (
        <section className="attendance-admin-section">
          <div className="attendance-admin-title">
            <div>
              <span className="eyebrow">Admin reporting</span>
              <h2><UsersRound size={25} /> Employee Attendance Reports</h2>
              <p>Generate daily, weekly or monthly attendance and CV productivity reports for each employee.</p>
            </div>
            <div className="attendance-download-actions">
              <button className="button secondary" type="button" disabled={!report.records.length} onClick={downloadAttendanceReport}><FileSpreadsheet size={17} /> Download CSV</button>
              <button className="button" type="button" disabled={!report.records.length || downloadingPdf} onClick={downloadAttendancePdf}><Download size={17} /> {downloadingPdf ? "Preparing PDF..." : "Download Signed PDF"}</button>
            </div>
          </div>

          <div className="attendance-period-bar" aria-label="Attendance report period">
            <span>Quick report:</span>
            <div>
              <button className={reportPeriod === "daily" ? "active" : ""} type="button" onClick={() => applyReportPeriod("daily")}>Daily</button>
              <button className={reportPeriod === "weekly" ? "active" : ""} type="button" onClick={() => applyReportPeriod("weekly")}>Weekly</button>
              <button className={reportPeriod === "monthly" ? "active" : ""} type="button" onClick={() => applyReportPeriod("monthly")}>Monthly</button>
              <button className={reportPeriod === "custom" ? "active" : ""} type="button" onClick={() => setReportPeriod("custom")}>Custom dates</button>
            </div>
          </div>

          <form className="card attendance-filters" onSubmit={(event) => { event.preventDefault(); loadReport(); }}>
            <label><span>From</span><input type="date" value={filters.from} onChange={(event) => { setReportPeriod("custom"); setFilters({ ...filters, from: event.target.value }); }} /></label>
            <label><span>To</span><input type="date" value={filters.to} onChange={(event) => { setReportPeriod("custom"); setFilters({ ...filters, to: event.target.value }); }} /></label>
            <label><span>Employee / candidate</span><select value={filters.userId} onChange={(event) => setFilters({ ...filters, userId: event.target.value })}><option value="">All employees</option>{report.employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.name}</option>)}</select></label>
            <button className="button" type="submit" disabled={loadingReport}>{loadingReport ? "Generating..." : "Generate Report"}</button>
          </form>

          <div className="attendance-overview-grid">
            <article><UsersRound size={21} /><span>Active employees</span><strong>{report.overview.activeEmployees ?? 0}</strong></article>
            <article className="success"><UserRoundCheck size={21} /><span>Present today</span><strong>{report.overview.presentToday ?? 0}</strong></article>
            <article className="warning"><Clock3 size={21} /><span>Not marked today</span><strong>{report.overview.notMarkedToday ?? 0}</strong></article>
            <article><Download size={21} /><span>CVs downloaded</span><strong>{report.overview.totalCvsDownloaded ?? 0}</strong></article>
            <article><FileCheck2 size={21} /><span>CVs submitted</span><strong>{report.overview.totalCvsSubmitted ?? 0}</strong></article>
          </div>

          <div className="table-wrap attendance-summary-table">
            <table>
              <thead><tr><th>Employee</th><th>Days present</th><th>Total hours</th><th>CVs downloaded</th><th>CVs submitted</th></tr></thead>
              <tbody>
                {report.summaries.map((summary) => <tr key={summary.userId}><td><strong>{summary.employeeName}</strong><br /><span className="muted">{summary.employeeEmail}</span></td><td>{summary.daysPresent}</td><td>{totalHours(summary.totalMinutes)}</td><td>{summary.cvsDownloaded}</td><td>{summary.cvsSubmitted}</td></tr>)}
                {!report.summaries.length && <tr><td colSpan="5">No attendance records found for this period.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="table-wrap attendance-detail-table">
            <table>
              <thead><tr><th>Date</th>{!report.filters?.userId && <th>Employee</th>}<th>Location</th><th>Check in</th><th>Check out</th><th>Hours</th><th>Downloaded</th><th>Submitted</th><th>Notes</th></tr></thead>
              <tbody>
                {report.records.map((record) => <tr key={record._id}><td>{dateLabel(record.attendanceDate)}</td>{!report.filters?.userId && <td><strong>{record.employeeName}</strong></td>}<td>{record.workLocation}</td><td>{timeLabel(record.checkInAt)}</td><td>{timeLabel(record.checkOutAt)}</td><td>{durationLabel(record)}</td><td>{record.cvsDownloaded}</td><td>{record.cvsSubmitted}</td><td className="attendance-notes-cell">{record.notes ? <details className="attendance-note-disclosure"><summary title={record.notes}>View notes</summary><p>{record.notes}</p></details> : <span className="muted">-</span>}</td></tr>)}
                {!report.records.length && <tr><td colSpan={report.filters?.userId ? 8 : 9}>No detailed records found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
