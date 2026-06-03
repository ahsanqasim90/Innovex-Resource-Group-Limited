import { useState } from "react";
import { api } from "../api/client.js";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import FileUpload from "../components/FileUpload.jsx";

export default function UploadCv() {
  const [status, setStatus] = useState(null);
  const [uploadKey, setUploadKey] = useState(0);
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api("/cv-uploads", { method: "POST", body: new FormData(form) });
      setStatus({ message: "CV uploaded successfully. Our recruitment team will review it." });
      form.reset();
      setUploadKey((key) => key + 1);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }
  return (
    <section className="section">
      <SEO title="Upload CV" path="/upload-cv" description="Upload your CV to Innovex Resource Group Limited for healthcare recruitment opportunities across the UK." />
      <SectionHeading eyebrow="Upload CV" title="Register your interest in healthcare roles" />
      <div className="card">
        <StatusMessage status={status} />
        <form className="form" onSubmit={submit}>
          <div className="form-grid">
            <input name="name" placeholder="Full name" required />
            <input name="email" type="email" placeholder="Email" required />
            <input name="phone" placeholder="Phone" required />
            <input name="desiredRole" placeholder="Desired role" required />
            <input name="location" placeholder="Preferred location" required />
            <input name="experience" placeholder="Experience" required />
          </div>
          <FileUpload key={uploadKey} required />
          <button className="button">Upload CV</button>
        </form>
      </div>
    </section>
  );
}
