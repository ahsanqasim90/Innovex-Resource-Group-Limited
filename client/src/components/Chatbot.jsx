import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, BriefcaseBusiness, ChevronRight, GraduationCap, HeartHandshake, MessageCircle, MonitorSmartphone, PhoneCall, Send, Sparkles, Upload, X } from "lucide-react";
import { api } from "../api/client.js";
import { contact } from "../data/content.js";

const initialMessages = [
  {
    from: "bot",
    text: "Hi, welcome to Innovex. I can help with recruitment, jobs, CV uploads, websites, SEO, training courses, or speaking to the team."
  }
];

const options = [
  {
    id: "job",
    label: "I am looking for a job",
    short: "Job seeker",
    icon: BriefcaseBusiness,
    inquiryType: "Job Application / CV",
    response: "Great. You can browse live healthcare roles or upload your CV so our team can match you with suitable opportunities.",
    actions: [
      { label: "Browse Jobs", type: "route", to: "/jobs" },
      { label: "Upload CV", type: "route", to: "/upload-cv", icon: Upload }
    ]
  },
  {
    id: "staffing",
    label: "I need healthcare staff",
    short: "Staffing support",
    icon: HeartHandshake,
    inquiryType: "Recruitment Support",
    response: "We support care homes with temporary staffing, permanent recruitment, nurse placement, care assistants, registered managers, and screening.",
    actions: [
      { label: "Request Support", type: "route", to: "/contact" },
      { label: "WhatsApp", type: "whatsapp", icon: MessageCircle }
    ]
  },
  {
    id: "website",
    label: "I need a website",
    short: "Website project",
    icon: MonitorSmartphone,
    inquiryType: "Website Development",
    response: "We build modern, mobile-friendly websites for care providers, local businesses, recruiters, and growing service companies.",
    actions: [
      { label: "View Services", type: "route", to: "/services" },
      { label: "Start Project", type: "lead" }
    ]
  },
  {
    id: "seo",
    label: "I need SEO support",
    short: "SEO growth",
    icon: Sparkles,
    inquiryType: "SEO Services",
    response: "We can help with local SEO, content structure, search-friendly pages, Google visibility, and lead-focused digital growth.",
    actions: [
      { label: "View Services", type: "route", to: "/services" },
      { label: "Discuss SEO", type: "lead" }
    ]
  },
  {
    id: "training",
    label: "I need training courses",
    short: "Training courses",
    icon: GraduationCap,
    inquiryType: "General Enquiry",
    response: "We can discuss healthcare training courses for care homes and healthcare companies, including delegates, dates, and course requirements.",
    actions: [
      { label: "Send Training Query", type: "lead" },
      { label: "WhatsApp", type: "whatsapp", icon: MessageCircle }
    ]
  },
  {
    id: "contact",
    label: "Contact Innovex",
    short: "Contact team",
    icon: PhoneCall,
    inquiryType: "General Enquiry",
    response: `You can call or WhatsApp us on ${contact.phoneDisplay}, or send a quick message here and the team will respond.`,
    actions: [
      { label: "WhatsApp", type: "whatsapp", icon: MessageCircle },
      { label: "Quick Message", type: "lead" }
    ]
  }
];

export default function Chatbot() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState(initialMessages);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const activeOption = useMemo(() => options.find((item) => item.id === selected), [selected]);

  function choose(option) {
    setSelected(option.id);
    setShowLeadForm(false);
    setStatus(null);
    setMessages([
      ...initialMessages,
      { from: "user", text: option.label },
      { from: "bot", text: option.response }
    ]);
  }

  function runAction(action) {
    if (action.type === "route") {
      setOpen(false);
      navigate(action.to);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (action.type === "whatsapp") {
      window.open(contact.whatsappUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setShowLeadForm(true);
    setStatus(null);
  }

  async function submitLead(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const topic = activeOption?.short || "Website enquiry";
    const message = [
      `Chatbot enquiry type: ${topic}`,
      data.message ? `Visitor message: ${data.message}` : "",
      `Suggested route: ${activeOption?.label || "General enquiry"}`
    ].filter(Boolean).join("\n\n");

    setSubmitting(true);
    setStatus(null);
    try {
      await api("/contact", {
        method: "POST",
        body: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          inquiryType: activeOption?.inquiryType || "General Enquiry",
          subject: `Chatbot enquiry: ${topic}`,
          message
        }
      });
      setStatus({ type: "success", message: "Thanks. Your message has been sent to Innovex." });
      form.reset();
      setMessages((current) => [...current, { from: "bot", text: "Thanks. I have sent your details to the Innovex team." }]);
      setShowLeadForm(false);
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Message could not be sent." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`chatbot-widget${open ? " is-open" : ""}`}>
      {open && (
        <section className="chatbot-panel" aria-label="Innovex assistant">
          <div className="chatbot-header">
            <div className="chatbot-brand">
              <img src="/Logo.png" alt="Innovex Resource Group Limited" />
              <div>
                <span>Innovex assistant</span>
                <strong>How can we help?</strong>
              </div>
            </div>
            <button className="chatbot-close" type="button" onClick={() => setOpen(false)} aria-label="Close chat">
              <X size={18} />
            </button>
          </div>

          <div className="chatbot-body">
            <div className="chatbot-messages">
              {messages.map((message, index) => (
                <div className={`chatbot-message ${message.from}`} key={`${message.from}-${index}`}>
                  {message.from === "bot" && <Bot size={16} />}
                  <p>{message.text}</p>
                </div>
              ))}
            </div>

            <div className="chatbot-options" aria-label="Chat options">
              {options.map((option) => {
                const Icon = option.icon;
                return (
                  <button className={selected === option.id ? "active" : ""} type="button" key={option.id} onClick={() => choose(option)}>
                    <Icon size={16} />
                    <span>{option.short}</span>
                  </button>
                );
              })}
            </div>

            {activeOption && (
              <div className="chatbot-action-card">
                <strong>{activeOption.short}</strong>
                <p>Choose the quickest next step below.</p>
                <div className="chatbot-actions">
                  {activeOption.actions.map((action) => {
                    const Icon = action.icon || ChevronRight;
                    return (
                      <button type="button" key={action.label} onClick={() => runAction(action)}>
                        <Icon size={15} />
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {showLeadForm && (
              <form className="chatbot-lead-form" onSubmit={submitLead}>
                <input name="name" placeholder="Your name" required />
                <input name="email" type="email" placeholder="Email address" required />
                <input name="phone" placeholder="Phone number" />
                <textarea name="message" placeholder="Tell us briefly what you need" rows="3" />
                <button type="submit" disabled={submitting}>
                  <Send size={15} />
                  {submitting ? "Sending..." : "Send enquiry"}
                </button>
              </form>
            )}

            {status && <p className={`chatbot-status ${status.type || "success"}`}>{status.message}</p>}
          </div>
        </section>
      )}

      <button className="chatbot-launcher" type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close Innovex assistant" : "Open Innovex assistant"}>
        {open ? <X size={24} /> : <MessageCircle size={25} />}
        {!open && <span>Need help?</span>}
      </button>
    </div>
  );
}
