import { UploadCloud } from "lucide-react";
import { useState } from "react";

export default function FileUpload({ name = "cv", required = false, label = "Upload CV", helper = "PDF, DOC, or DOCX up to 5MB", prompt = "Choose or drag your CV here" }) {
  const [fileName, setFileName] = useState("");
  const inputId = `${name}-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="file-upload">
      <span className="file-upload-label">{label}</span>
      <label className="file-drop" htmlFor={inputId}>
        <input
          id={inputId}
          name={name}
          type="file"
          accept=".pdf,.doc,.docx"
          required={required}
          onChange={(event) => setFileName(event.target.files?.[0]?.name || "")}
        />
        <span className="file-icon" aria-hidden="true">
          <UploadCloud size={28} />
        </span>
        <span className="file-copy">
          <strong>{fileName || prompt}</strong>
          <small>{helper}</small>
        </span>
        <span className="file-button">Browse File</span>
      </label>
    </div>
  );
}
