import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileSearch2, LockKeyhole, X } from "lucide-react";
import { api, downloadFile } from "../api/client.js";

export default function CvReviewModal({ candidateName, reference, reviewPath, downloadPath, filename, canDownload = true, onClose }) {
  const [review, setReview] = useState(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    api(reviewPath)
      .then((result) => active && setReview(result))
      .catch((requestError) => active && setError(requestError.message));
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => {
      active = false;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, reviewPath]);

  async function download() {
    setDownloading(true);
    try {
      await downloadFile(downloadPath, filename || review?.originalName || "candidate-cv");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDownloading(false);
    }
  }

  return createPortal(
    <div className="cv-reader-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="cv-reader-modal" role="dialog" aria-modal="true" aria-label={`${candidateName || "Candidate"} CV review`}>
        <header className="cv-reader-header">
          <div className="cv-reader-identity">
            <span><FileSearch2 size={21} /></span>
            <div><small>{reference || "SECURE CANDIDATE DOCUMENT"}</small><h2>{candidateName || review?.name || "Candidate CV"}</h2><p>{filename || review?.originalName || "Curriculum vitae"}</p></div>
          </div>
          <div className="cv-reader-actions">
            {canDownload && downloadPath && <button className="button secondary" type="button" onClick={download} disabled={downloading}><Download size={16} /> {downloading ? "Preparing..." : "Download original"}</button>}
            <button className="cv-reader-close" type="button" onClick={onClose} aria-label="Close CV review"><X size={21} /></button>
          </div>
        </header>
        <div className="cv-reader-security"><LockKeyhole size={14} /> Protected in-portal review · access is logged · candidate data must remain confidential</div>
        <main className="cv-reader-body">
          {!review && !error && <div className="cv-reader-loading"><span /> Preparing secure CV review...</div>}
          {error && <div className="cv-reader-error"><strong>CV could not be prepared</strong><p>{error}</p><button type="button" className="button secondary" onClick={onClose}>Close review</button></div>}
          {review && !error && <article className="cv-reader-document"><header><span>{review.verifiedType?.toUpperCase() || "CV"}</span><strong>Candidate profile</strong></header><pre>{review.text || "No readable text was found in this CV."}</pre></article>}
        </main>
        <footer className="cv-reader-footer"><span>Innovex Resource Group Limited</span><span>Confidential recruitment document</span></footer>
      </section>
    </div>,
    document.body
  );
}
