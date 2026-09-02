import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Check, Download, Eye, FileArchive, FileText, LockKeyhole, Search, ShieldCheck, UploadCloud, UserCheck, UserPlus, X } from "lucide-react";
import { api, downloadFile } from "../../api/client.js";
import CvReviewModal from "../../components/CvReviewModal.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

function formatBytes(value = 0) {
  if (!value) return "-";
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "-";
}

function isPdf(item) {
  return item.cv?.mimetype === "application/pdf";
}

function isReleased(item) {
  return ["Clean", "Validated"].includes(item.cv?.scanStatus);
}

export default function AdminCvLibrary() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [team, setTeam] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [selectedUsers, setSelectedUsers] = useState({});
  const [files, setFiles] = useState([]);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [status, setStatus] = useState(null);
  const [preview, setPreview] = useState(null);
  const [security, setSecurity] = useState(null);

  const pendingCount = useMemo(() => items.reduce((count, item) => count + (item.access?.requests || []).filter((request) => request.status === "Pending").length, 0), [items]);

  async function load(page = 1, query = search) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 30, ...(query.trim() ? { search: query.trim() } : {}) });
      const data = await api(`/candidate-cvs?${params.toString()}`);
      setItems(data.items || []);
      setCanManage(Boolean(data.canManage));
      setPagination({ page: data.page || 1, pages: data.pages || 1, total: data.total || 0 });
      if (data.canManage) {
        const [users, securitySummary] = await Promise.all([api("/candidate-cvs/team"), api("/candidate-cvs/security/summary")]);
        setTeam(users || []);
        setSecurity(securitySummary);
      }
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function uploadFiles(event) {
    event.preventDefault();
    if (!files.length) {
      setStatus({ type: "error", message: "Please choose at least one CV file." });
      return;
    }
    setUploading(true);
    const results = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setUploadProgress({ current: index + 1, total: files.length, name: file.name });
      const body = new FormData();
      body.append("cv", file);
      try {
        const result = await api("/candidate-cvs/upload", { method: "POST", body });
        results.push({ ok: true, name: file.name, message: result.message });
      } catch (error) {
        results.push({ ok: false, name: file.name, message: error.message });
      }
    }
    const succeeded = results.filter((result) => result.ok).length;
    const failed = results.length - succeeded;
    setStatus({
      type: failed ? "error" : undefined,
      message: `${succeeded} CV${succeeded === 1 ? "" : "s"} uploaded successfully.${failed ? ` ${failed} failed: ${results.filter((result) => !result.ok).map((result) => `${result.name} (${result.message})`).join(", ")}` : ""}`
    });
    setFiles([]);
    setUploadInputKey((current) => current + 1);
    setUploadProgress(null);
    setUploading(false);
    await load(1);
  }

  function openPreview(item) {
    setPreview(item);
  }

  function closePreview() {
    setPreview(null);
  }

  async function download(item) {
    setWorking(`download-${item._id}`);
    try {
      await downloadFile(`/candidate-cvs/${item._id}/download`, item.cv?.originalName || `${item.candidateId}-CV`);
      setStatus({ message: `${item.name}'s CV downloaded.` });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setWorking("");
    }
  }

  async function requestDownload(item) {
    setWorking(`request-${item._id}`);
    try {
      const result = await api(`/candidate-cvs/${item._id}/request-download`, { method: "POST" });
      setStatus({ message: result.message });
      await load(pagination.page);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setWorking("");
    }
  }

  async function scanDocument(item) {
    setWorking(`scan-${item._id}`);
    try {
      const result = await api(`/candidate-cvs/${item._id}/security-scan`, { method: "POST" });
      setStatus({ message: result.message });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setWorking("");
      await load(pagination.page);
    }
  }

  async function changeAccess(item, action) {
    const userId = selectedUsers[item._id];
    if (!userId) {
      setStatus({ type: "error", message: "Select a team member first." });
      return;
    }
    setWorking(`${action}-${item._id}`);
    try {
      const result = await api(`/candidate-cvs/${item._id}/access`, { method: "PATCH", body: { userId, action } });
      setStatus({ message: result.message });
      setItems((current) => current.map((entry) => entry._id === item._id ? result.item : entry));
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setWorking("");
    }
  }

  async function decideRequest(item, request, decision) {
    setWorking(`${decision}-${request._id}`);
    try {
      const result = await api(`/candidate-cvs/${item._id}/requests/${request._id}`, { method: "PATCH", body: { decision } });
      setStatus({ message: result.message });
      setItems((current) => current.map((entry) => entry._id === item._id ? result.item : entry));
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setWorking("");
    }
  }

  function userNames(ids = []) {
    return ids.map((id) => team.find((member) => member._id === id)?.name).filter(Boolean);
  }

  return (
    <section className="admin-page cv-library-page">
      <header className="admin-page-header cv-library-hero">
        <div>
          <span className="eyebrow"><ShieldCheck size={16} /> Protected recruitment documents</span>
          <h1>Candidate CV Library</h1>
          <p>Upload, allocate and review candidate CVs without giving automatic download access.</p>
        </div>
        <div className="cv-library-metrics">
          <span><strong>{pagination.total}</strong> CVs</span>
          {canManage && <span><strong>{pendingCount}</strong> pending requests</span>}
        </div>
      </header>

      <StatusMessage status={status} />

      {canManage && security && (
        <details className={`card cv-security-centre ${security.riskLevel === "Normal" ? "normal" : "review"}`}>
          <summary>
            <span className="cv-security-icon">{security.riskLevel === "Normal" ? <ShieldCheck size={21} /> : <AlertTriangle size={21} />}</span>
            <span><strong>CV Security & Compliance Centre · {security.riskLevel}</strong><small>Last 24 hours: {security.views} protected views · {security.downloads} downloads · {security.denied} denied attempts</small></span>
            <Activity size={19} />
          </summary>
          <div className="cv-security-body">
            {security.unusual?.length ? <p className="cv-security-warning">Review unusual volume: {security.unusual.map((entry) => `${entry.name} (${entry.actions} actions)`).join(", ")}</p> : <p>No unusual high-volume CV access detected. {security.retentionDue || 0} retention reviews are due within 30 days; {security.missingLawfulBasis || 0} CV records need a lawful basis recorded.</p>}
            <div>{security.recent?.map((entry) => <span key={entry._id}><strong>{entry.action}</strong>{entry.summary}<small>{formatDate(entry.createdAt)}</small></span>)}</div>
          </div>
        </details>
      )}

      {canManage && (
        <form className="card cv-library-upload" onSubmit={uploadFiles}>
          <div className="cv-library-upload-copy">
            <span className="cv-library-icon"><UploadCloud size={25} /></span>
            <div>
              <h2>Bulk upload existing CVs</h2>
              <p>Select multiple validated PDF or DOCX files. The filename is matched to an existing candidate; otherwise a new candidate profile and ID are created.</p>
            </div>
          </div>
          <div className="cv-library-upload-actions">
            <label className="cv-file-picker" htmlFor="cv-library-files">
              <FileArchive size={18} />
              <span>{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "Choose CV files"}</span>
            </label>
            <input key={uploadInputKey} id="cv-library-files" type="file" multiple accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFiles(Array.from(event.target.files || []))} />
            <SubmitButton loading={uploading} loadingText={uploadProgress ? `Uploading ${uploadProgress.current}/${uploadProgress.total}` : "Uploading..."}>Upload to library</SubmitButton>
          </div>
          {uploadProgress && <small className="cv-upload-progress">Currently uploading: {uploadProgress.name}</small>}
        </form>
      )}

      <form className="card cv-library-search" onSubmit={(event) => { event.preventDefault(); load(1); }}>
        <Search size={18} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search candidate, ID, role, email or CV filename" />
        <button className="button" type="submit">Search</button>
      </form>

      {loading ? (
        <div className="card cv-library-empty">Loading protected CV library...</div>
      ) : !items.length ? (
        <div className="card cv-library-empty"><FileText size={36} /><h2>No CVs found</h2><p>{canManage ? "Upload your first CV above." : "An admin has not allocated any CVs to your account yet."}</p></div>
      ) : (
        <div className="cv-library-grid">
          {items.map((item) => {
            const pending = (item.access?.requests || []).filter((request) => request.status === "Pending");
            const selectedUser = selectedUsers[item._id];
            const selectedHasView = item.access?.viewUserIds?.includes(selectedUser);
            const selectedHasDownload = item.access?.downloadUserIds?.includes(selectedUser);
            return (
              <article className="card cv-library-card" key={item._id}>
                <div className="cv-library-card-top">
                  <div className="cv-document-mark"><FileText size={25} /></div>
                  <div className="cv-library-person">
                    <span className="cv-candidate-id">{item.candidateId}</span>
                    <h2>{item.name}</h2>
                    <p>{item.desiredRole || "Role not specified"}</p>
                  </div>
                  <span className={`cv-file-type ${isPdf(item) ? "pdf" : "word"}`}>{isPdf(item) ? "PDF" : "WORD"}</span>
                </div>

                <div className="cv-file-meta">
                  <strong title={item.cv?.originalName}>{item.cv?.originalName}</strong>
                  <span>{formatBytes(item.cv?.size)} · {formatDate(item.cv?.uploadedAt)} · {isReleased(item) ? (item.cv?.indexedAt ? "Security cleared · Ready for matching" : "Security cleared · Indexing required") : `Quarantined · ${item.cv?.scanStatus || "Scan required"}`}</span>
                </div>

                <div className="cv-library-actions">
                  {!isReleased(item) && canManage ? <button className="button" type="button" onClick={() => scanDocument(item)} disabled={working === `scan-${item._id}`}><ShieldCheck size={16} /> Run antivirus scan</button> : <button className="button" type="button" onClick={() => openPreview(item)} disabled={!isReleased(item)}><Eye size={16} /> Review CV</button>}
                  {isReleased(item) && item.access?.canDownload ? (
                    <button className="button secondary" type="button" onClick={() => download(item)} disabled={working === `download-${item._id}`}><Download size={16} /> Download</button>
                  ) : isReleased(item) && item.access?.requestStatus === "Pending" ? (
                    <span className="cv-request-pending"><LockKeyhole size={15} /> Request pending</span>
                  ) : isReleased(item) ? (
                    <button className="button secondary" type="button" onClick={() => requestDownload(item)} disabled={working === `request-${item._id}`}><LockKeyhole size={16} /> Request download</button>
                  ) : <span className="security-state quarantined"><LockKeyhole size={14} /> Quarantined</span>}
                </div>

                {!isPdf(item) && <p className="cv-preview-note">Word CV supported through the secure in-portal text reviewer.</p>}

                {canManage && (
                  <details className="cv-access-panel" open={pending.length > 0}>
                    <summary><UserCheck size={16} /> Manage access {pending.length ? <b>{pending.length}</b> : null}</summary>
                    <div className="cv-access-body">
                      <label>
                        Team member
                        <select value={selectedUsers[item._id] || ""} onChange={(event) => setSelectedUsers((current) => ({ ...current, [item._id]: event.target.value }))}>
                          <option value="">Select team member</option>
                          {team.map((member) => <option value={member._id} key={member._id}>{member.name} ({member.role.replaceAll("_", " ")})</option>)}
                        </select>
                      </label>
                      <div className="cv-access-current">
                        <span><Eye size={14} /> View: {userNames(item.access?.viewUserIds).join(", ") || "Admin only"}</span>
                        <span><Download size={14} /> Download: {userNames(item.access?.downloadUserIds).join(", ") || "Admin only"}</span>
                      </div>
                      <div className="cv-access-buttons">
                        <button type="button" className="button small" onClick={() => changeAccess(item, selectedHasView ? "revoke-view" : "grant-view")} disabled={!selectedUser || Boolean(working)}>{selectedHasView ? <X size={14} /> : <UserPlus size={14} />}{selectedHasView ? "Remove view" : "Allow view"}</button>
                        <button type="button" className="button secondary small" onClick={() => changeAccess(item, selectedHasDownload ? "revoke-download" : "grant-download")} disabled={!selectedUser || Boolean(working)}>{selectedHasDownload ? <X size={14} /> : <Download size={14} />}{selectedHasDownload ? "Remove download" : "Allow download"}</button>
                      </div>
                      {pending.map((request) => (
                        <div className="cv-download-request" key={request._id}>
                          <div><strong>{request.name}</strong><span>requested download · {formatDate(request.requestedAt)}</span></div>
                          <div>
                            <button className="button small" type="button" onClick={() => decideRequest(item, request, "Approved")} disabled={Boolean(working)}><Check size={14} /> Approve</button>
                            <button className="button secondary small" type="button" onClick={() => decideRequest(item, request, "Rejected")} disabled={Boolean(working)}><X size={14} /> Reject</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </article>
            );
          })}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="pagination cv-library-pagination">
          <button className="button secondary" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Previous</button>
          <span>Page {pagination.page} of {pagination.pages}</span>
          <button className="button secondary" disabled={pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)}>Next</button>
        </div>
      )}

      {preview && <CvReviewModal candidateName={preview.name} reference={preview.candidateId} filename={preview.cv?.originalName} reviewPath={`/candidate-cvs/${preview._id}/review-text`} downloadPath={`/candidate-cvs/${preview._id}/download`} canDownload={preview.access?.canDownload} onClose={closePreview} />}
    </section>
  );
}
