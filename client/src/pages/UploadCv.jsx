import { useState } from "react";
import { api } from "../api/client.js";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import FileUpload from "../components/FileUpload.jsx";
import SubmitButton from "../components/SubmitButton.jsx";

export default function UploadCv() {
  const [status, setStatus] = useState(null);
  const [uploadKey, setUploadKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitting(true);
    try {
      await api("/cv-uploads", { method: "POST", body: new FormData(form) });
      setStatus({ message: "CV uploaded successfully. Our recruitment team will review it." });
      form.reset();
      setUploadKey((key) => key + 1);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <section className="section">
      <SEO title="Upload CV" path="/upload-cv" description="Upload your CV to Innovex Resource Group Limited for healthcare recruitment opportunities across the UK." />
      <SectionHeading eyebrow="Upload CV" title="Register your interest in healthcare roles" />
      <article className="card upload-intro-card">
        <div>
          <h2>Send your CV to the Innovex recruitment team</h2>
          <p>Share your preferred role, location and experience so we can review your profile for suitable healthcare and care-sector opportunities.</p>
        </div>
        <div className="pill-row">
          <span>Confidential review</span>
          <span>Healthcare roles</span>
          <span>UK opportunities</span>
        </div>
      </article>
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
          <SubmitButton loading={submitting} loadingText="Uploading CV...">Upload CV</SubmitButton>
        </form>
      </div>
    </section>
  );
}
