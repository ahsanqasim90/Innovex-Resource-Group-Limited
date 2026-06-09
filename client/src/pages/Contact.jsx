import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import SocialLinks from "../components/SocialLinks.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import SubmitButton from "../components/SubmitButton.jsx";
import { company, contact } from "../data/content.js";
import { BriefcaseBusiness, CheckCircle2, Clock3, HeartHandshake, Mail, MapPinned, MessageCircle, MonitorSmartphone, Share2 } from "lucide-react";
import { useState } from "react";

const actionCards = [
  {
    label: "For candidates",
    title: "Job seeker?",
    text: "Looking for your next healthcare role? Browse live vacancies or send your CV so our recruitment team can match you with suitable opportunities.",
    icon: BriefcaseBusiness,
    points: ["Live healthcare roles", "CV review support", "Candidate matching"],
    actions: [
      { label: "Browse Jobs", to: "/jobs", secondary: true },
      { label: "Upload CV", to: "/upload-cv" }
    ]
  },
  {
    label: "For care providers",
    title: "Care home?",
    text: "Need reliable staffing support? Share your requirements for temporary cover, permanent recruitment, screening, or urgent workforce support.",
    icon: HeartHandshake,
    points: ["Temporary staffing", "Permanent recruitment", "Screened candidates"],
    actions: [
      { label: "Request Staffing Support", href: "#contact-form", secondary: true }
    ]
  },
  {
    label: "For growing businesses",
    title: "Need a website or SEO?",
    text: "Tell us about your business and we can help with a modern website, local SEO, content visibility, and lead-focused digital growth.",
    icon: MonitorSmartphone,
    points: ["Website development", "Local SEO", "Online enquiries"],
    actions: [
      { label: "Digital Services", to: "/services", secondary: true },
      { label: "Start Project", href: "#contact-form" }
    ]
  }
];

const contactCards = [
  { title: "Email", text: contact.email, href: `mailto:${contact.email}`, icon: Mail, label: "Fast response" },
  { title: "Phone / WhatsApp", text: contact.phoneDisplay, href: contact.whatsappUrl, icon: MessageCircle, label: "Main contact" },
  { title: "Office Address", text: contact.address, icon: MapPinned, label: "Cardiff, UK" },
  { title: "Office hours", text: contact.hours, icon: Clock3, label: "Availability" },
  { title: "Social Media", social: true, icon: Share2, label: "Connect with us" }
];

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
      <div className="card-grid contact-info-grid">
        {contactCards.map(({ title, text, href, icon: Icon, label, social }) => (
          <article className="card contact-info-card" key={title}>
            <div className="contact-info-icon"><Icon size={22} /></div>
            <span>{label}</span>
            <h3>{title}</h3>
            {social ? (
              <SocialLinks />
            ) : href ? (
              <p><a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>{text}</a></p>
            ) : (
              <p>{text}</p>
            )}
          </article>
        ))}
      </div>
      <div className="card contact-form-card" id="contact-form" style={{ marginTop: 24, scrollMarginTop: 110 }}>
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
      <div className="card-grid contact-action-grid" style={{ marginTop: 24 }}>
        {actionCards.map((card) => {
          const Icon = card.icon;
          return (
            <article className="card contact-action-card" key={card.title}>
              <div className="contact-action-head">
                <span className="contact-action-icon"><Icon size={24} /></span>
                <span className="contact-action-label">{card.label}</span>
              </div>
              <div>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </div>
              <ul className="contact-action-list">
                {card.points.map((point) => (
                  <li key={point}><CheckCircle2 size={16} />{point}</li>
                ))}
              </ul>
              <div className="actions contact-action-buttons">
                {card.actions.map((action) => action.to ? (
                  <Link className={`button${action.secondary ? " secondary" : ""}`} to={action.to} key={action.label}>{action.label}</Link>
                ) : (
                  <a className={`button${action.secondary ? " secondary" : ""}`} href={action.href} key={action.label}>{action.label}</a>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
