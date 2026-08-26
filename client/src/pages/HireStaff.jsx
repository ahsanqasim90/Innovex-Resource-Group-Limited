import { ArrowRight, CheckCircle2, CircleHelp, PhoneCall, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../api/client.js";
import SEO from "../components/SEO.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import SubmitButton from "../components/SubmitButton.jsx";
import { company, contact } from "../data/content.js";
import { trackEvent } from "../utils/analytics.js";

const roles = ["Support workers", "Healthcare assistants", "Registered nurses", "Senior care staff", "Team leaders", "Deputy managers", "Registered managers", "Home managers"];
const process = ["Share your vacancy brief", "Candidate sourcing and initial screening", "Relevant profiles and shortlisting", "Interview coordination", "Placement next steps"];
const faqs = [
  ["Which employers can contact Innovex?", "Innovex supports care homes, nursing homes, children's residential services, supported living providers and other healthcare and social-care organisations across the UK."],
  ["Can we discuss more than one vacancy?", "Yes. Use the form to describe one role or a wider recruitment requirement, including the approximate number of people needed."],
  ["What information should we provide?", "Role, location, employment type, expected start date and any essential requirements give the recruitment team a useful starting brief."],
  ["What screening does Innovex complete?", "Screening is agreed for the vacancy and may cover role fit, experience, availability and evidence relevant to the employer's requirements. Innovex will confirm the checks applicable to your brief rather than making a blanket compliance claim."]
];

function pageSchema() {
  const url = `${company.siteUrl}/hire-staff`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: "Healthcare recruitment for UK employers",
        description: "Employer recruitment support for UK care, healthcare and social-care organisations.",
        url,
        provider: { "@id": `${company.siteUrl}/#organization` },
        areaServed: { "@type": "Country", name: "United Kingdom" },
        audience: { "@type": "BusinessAudience", audienceType: "UK healthcare and social-care employers" }
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${company.siteUrl}/` },
          { "@type": "ListItem", position: 2, name: "Healthcare recruitment", item: `${company.siteUrl}/healthcare-recruitment` },
          { "@type": "ListItem", position: 3, name: "Hire staff", item: url }
        ]
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } }))
      }
    ]
  };
}

export default function HireStaff() {
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const started = useRef(false);

  function markStarted() {
    if (started.current) return;
    started.current = true;
    trackEvent("employer_enquiry_started", { funnel: "recruitment", page_path: "/hire-staff" });
  }

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const message = [
      `Company: ${values.companyName}`,
      `Role required: ${values.roleRequired}`,
      `Location: ${values.location}`,
      `Number of staff: ${values.numberOfStaff || "Not specified"}`,
      `Employment type: ${values.employmentType}`,
      `Desired start date: ${values.desiredStartDate || "Not specified"}`,
      `Salary / rate: ${values.salaryRate || "Not specified"}`,
      "",
      values.additionalInformation || "No additional information supplied."
    ].join("\n");

    setSubmitting(true);
    setStatus(null);
    try {
      await api("/contact", {
        method: "POST",
        body: {
          name: values.contactName,
          email: values.email,
          phone: values.phone,
          inquiryType: "Recruitment Support",
          subject: `Employer vacancy brief — ${values.roleRequired}`,
          message
        }
      });
      trackEvent("employer_enquiry_submitted", { funnel: "recruitment", employment_type: values.employmentType, page_path: "/hire-staff" });
      setStatus({ message: "Thank you. Your vacancy brief has been sent to the Innovex recruitment team." });
      form.reset();
      started.current = false;
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SEO
        title="Hire Healthcare Staff UK"
        path="/hire-staff"
        description="Tell Innovex about your healthcare or social-care vacancy. Request candidates for care, nursing, support and management roles across the UK."
        jsonLd={pageSchema()}
      />
      <section className="hire-staff-hero">
        <div>
          <span className="eyebrow">For UK employers</span>
          <h1>Hire healthcare and social-care staff with Innovex.</h1>
          <p>Share your vacancy with our Cardiff-based recruitment team. We support care providers and healthcare organisations across the UK with candidate sourcing, initial screening, shortlisting and interview coordination.</p>
          <div className="actions">
            <a className="button" href="#vacancy-brief">Request candidates <ArrowRight size={18} /></a>
            <a className="button light" href={`tel:${contact.phone}`}><PhoneCall size={18} /> Speak to the team</a>
          </div>
        </div>
        <aside className="hire-staff-proof">
          <ShieldCheck size={32} />
          <h2>A focused employer journey</h2>
          <ul>{["Permanent and temporary requirements", "Care, nursing, support and management roles", "UK-wide employer enquiries"].map((item) => <li key={item}><CheckCircle2 size={17} /> {item}</li>)}</ul>
        </aside>
      </section>

      <section className="section compact-section">
        <div className="section-heading"><span>Roles supplied</span><h2>Tell us which people your service needs.</h2><p>The recruitment team will confirm suitability, availability and the checks required for your specific vacancy.</p></div>
        <div className="role-chip-grid">{roles.map((role) => <span key={role}>{role}</span>)}</div>
      </section>

      <section className="section alt hire-process-section">
        <div className="section-heading"><span>Recruitment process</span><h2>A clear route from vacancy brief to placement.</h2></div>
        <ol className="hire-process-list">{process.map((step, index) => <li key={step}><strong>{index + 1}</strong><span>{step}</span></li>)}</ol>
      </section>

      <section className="section hire-form-section" id="vacancy-brief">
        <div className="hire-form-intro">
          <span className="eyebrow">Request candidates</span>
          <h2>Send your vacancy brief.</h2>
          <p>Fields marked required give us enough context to respond usefully. Dates, staffing numbers and rates can be approximate.</p>
          <div className="hire-contact-card"><strong>Prefer to talk?</strong><a href={`tel:${contact.phone}`}>{contact.phoneDisplay}</a><a href={`mailto:${contact.email}`}>{contact.email}</a></div>
        </div>
        <div className="card hire-form-card">
          <StatusMessage status={status} />
          <form className="form" onSubmit={submit} onFocus={markStarted}>
            <div className="form-grid labelled-form-grid">
              <label><span>Company name *</span><input name="companyName" autoComplete="organization" required /></label>
              <label><span>Contact name *</span><input name="contactName" autoComplete="name" required /></label>
              <label><span>Work email *</span><input name="email" type="email" autoComplete="email" required /></label>
              <label><span>Telephone</span><input name="phone" type="tel" autoComplete="tel" /></label>
              <label><span>Role required *</span><input name="roleRequired" placeholder="e.g. Registered Nurse" required /></label>
              <label><span>Location *</span><input name="location" autoComplete="address-level2" placeholder="Town, city or postcode" required /></label>
              <label><span>Number of staff</span><input name="numberOfStaff" type="number" min="1" inputMode="numeric" /></label>
              <label><span>Employment type *</span><select name="employmentType" defaultValue="Permanent" required><option>Permanent</option><option>Temporary</option><option>Contract</option><option>Not sure</option></select></label>
              <label><span>Desired start date</span><input name="desiredStartDate" type="date" /></label>
              <label><span>Salary or rate</span><input name="salaryRate" placeholder="Optional" /></label>
            </div>
            <label><span>Essential requirements or additional information</span><textarea name="additionalInformation" rows="5" placeholder="Tell us about experience, shifts, qualifications or timescales relevant to this vacancy." /></label>
            <SubmitButton loading={submitting} loadingText="Sending vacancy brief...">Request Candidates</SubmitButton>
            <p className="cta-microcopy">No obligation. Your details are used to respond to this recruitment enquiry and are not sent to analytics.</p>
          </form>
        </div>
      </section>

      <section className="section alt service-faq-section">
        <div className="section-heading"><span>Employer FAQs</span><h2>Before you request candidates.</h2></div>
        <div className="faq-grid">{faqs.map(([question, answer]) => <article className="card faq-card" key={question}><CircleHelp size={22} /><h3>{question}</h3><p>{answer}</p></article>)}</div>
      </section>
    </>
  );
}
