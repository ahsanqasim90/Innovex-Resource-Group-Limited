import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import SocialLinks from "../components/SocialLinks.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import SubmitButton from "../components/SubmitButton.jsx";
import { company, contact } from "../data/content.js";
import { useState } from "react";

export default function Contact() {
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setSubmitting(true);
    try {
      const response = await api("/contact", { method: "POST", body: data });
      setStatus({
        message: response.email?.sent
          ? "Message sent. The Innovex team will respond shortly."
          : "Message saved. Email delivery needs SMTP setup before live sending."
      });
      form.reset();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="section">
      <SEO title="Contact" path="/contact" description="Contact Innovex Resource Group Limited in Cardiff for healthcare recruitment, care home staffing, website design, SEO, partnerships, and job seeker support." />
      <SectionHeading eyebrow="Contact Us" title={`Talk to ${company.name}`} />
      <div className="card-grid">
        <article className="card"><h3>Email</h3><p><a href={`mailto:${contact.email}`}>{contact.email}</a></p></article>
        <article className="card"><h3>Phone / WhatsApp</h3><p><a href={contact.whatsappUrl} target="_blank" rel="noreferrer">{contact.phoneDisplay}</a></p></article>
        <article className="card"><h3>Office Address</h3><p>{contact.address}</p></article>
        <article className="card"><h3>Office hours</h3><p>{contact.hours}</p></article>
        <article className="card"><h3>Social Media</h3><SocialLinks /></article>
      </div>
      <div className="card" style={{ marginTop: 24 }}>
        <h2>Send a message</h2>
        <StatusMessage status={status} />
        <form className="form" onSubmit={submit}>
          <div className="form-grid">
            <input name="name" placeholder="Name" required />
            <input name="email" type="email" placeholder="Email" required />
            <input name="phone" placeholder="Phone" />
            <label>
              <span>What do you need help with?</span>
              <select name="inquiryType" required defaultValue="">
                <option value="" disabled>Select a service</option>
                <option>Recruitment Support</option>
                <option>Job Application / CV</option>
                <option>Website Development</option>
                <option>SEO Services</option>
                <option>Partnership</option>
                <option>General Enquiry</option>
              </select>
            </label>
            <input name="subject" placeholder="Subject" required />
          </div>
          <textarea name="message" placeholder="How can we help?" required />
          <SubmitButton loading={submitting} loadingText="Sending message...">Send Message</SubmitButton>
          <p className="cta-microcopy">No obligation. Tell us what you need and our team will respond.</p>
        </form>
      </div>
      <div className="card-grid" style={{ marginTop: 24 }}>
        <article className="card"><h3>Job seeker?</h3><div className="actions"><Link className="button secondary" to="/jobs">Browse Jobs</Link><Link className="button" to="/upload-cv">Upload CV</Link></div></article>
        <article className="card"><h3>Care home?</h3><p>Request staffing support for temporary cover, permanent recruitment, or screening.</p><Link className="button secondary" to="/contact">Request Staffing Support</Link></article>
        <article className="card"><h3>Need a website or SEO?</h3><p>Tell us about your business and we can help with a modern website, local SEO, and online visibility.</p><div className="actions"><Link className="button secondary" to="/services">View Digital Services</Link><Link className="button" to="/contact">Start Project</Link></div></article>
      </div>
    </section>
  );
}
