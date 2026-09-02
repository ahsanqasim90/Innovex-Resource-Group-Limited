import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import FileUpload from "../components/FileUpload.jsx";
import SubmitButton from "../components/SubmitButton.jsx";
import { trackEvent } from "../utils/analytics.js";

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
      trackEvent("cv_submission", { funnel: "candidate", source_page: "/upload-cv" });
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
      <SectionHeading as="h1" eyebrow="Upload CV" title="Register your interest in healthcare roles" />
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
          <div className="form-grid labelled-form-grid">
            <label><span>Full name *</span><input name="name" autoComplete="name" required /></label>
            <label><span>Email *</span><input name="email" type="email" autoComplete="email" required /></label>
            <label><span>Phone *</span><input name="phone" type="tel" autoComplete="tel" required /></label>
            <label><span>Desired role *</span><input name="desiredRole" required /></label>
            <label><span>Preferred location *</span><input name="location" autoComplete="address-level2" required /></label>
            <label><span>Relevant experience *</span><input name="experience" required /></label>
          </div>
          <FileUpload key={uploadKey} required />
          <label className="privacy-confirmation"><input type="checkbox" name="privacyConfirmed" required /><span>I have read the <Link to="/privacy" target="_blank">privacy notice</Link> and understand that Innovex will use my details and CV to provide recruitment services.</span></label>
          <SubmitButton loading={submitting} loadingText="Uploading CV...">Upload CV</SubmitButton>
        </form>
      </div>
    </section>
  );
}
