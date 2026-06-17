import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  GraduationCap,
  HeartHandshake,
  MessageCircle,
  MonitorSmartphone,
  PhoneCall,
  RotateCcw,
  Send,
  Sparkles,
  X
} from "lucide-react";
import { api } from "../api/client.js";
import { contact } from "../data/content.js";

const flows = {
  candidate: {
    title: "Job seeker support",
    icon: BriefcaseBusiness,
    inquiryType: "Job Application / CV",
    route: "/jobs",
    routeLabel: "View jobs",
    intro: "I will collect the key details our recruitment team needs to understand your next healthcare role.",
    questions: [
      { key: "role", text: "What role are you looking for?", placeholder: "Example: Registered Nurse, Care Assistant", choices: ["Registered Nurse", "Care Assistant", "Support Worker", "Registered Manager"] },
      { key: "location", text: "Which location or postcode would you prefer?", placeholder: "Example: Cardiff, Birmingham, SO40" },
      { key: "experience", text: "How much relevant experience do you have?", choices: ["0-1 years", "2-4 years", "5+ years", "Senior / management level"] },
      { key: "availability", text: "When are you available to start?", choices: ["Immediately", "Within 2 weeks", "Within 1 month", "Just exploring"] }
    ]
  },
  staffing: {
    title: "Healthcare staffing request",
    icon: HeartHandshake,
    inquiryType: "Recruitment Support",
    route: "/contact",
    routeLabel: "Staffing page",
    intro: "I will turn your staffing need into a clear priority enquiry for Innovex.",
    questions: [
      { key: "company", text: "What is the care home or company name?", placeholder: "Company / care home name" },
      { key: "staffingNeed", text: "What type of staffing support do you need?", choices: ["Temporary cover", "Permanent recruitment", "Registered Manager", "Nurses / Care Assistants", "Screening support"] },
      { key: "location", text: "Where is the service based?", placeholder: "Town, city, or postcode" },
      { key: "urgency", text: "How urgent is this requirement?", choices: ["Urgent - today / this week", "Within 2 weeks", "This month", "Planning ahead"] }
    ]
  },
  website: {
    title: "Website project",
    icon: MonitorSmartphone,
    inquiryType: "Website Development",
    route: "/services",
    routeLabel: "Digital services",
    intro: "I will collect enough detail for a useful website project enquiry without asking for anything complicated.",
    questions: [
      { key: "business", text: "What is your business or organisation name?", placeholder: "Business name" },
      { key: "sector", text: "Which sector are you in?", choices: ["Healthcare / care home", "Recruitment", "Local service business", "Retail / hospitality", "Other sector"] },
      { key: "websiteStatus", text: "What do you need?", choices: ["New website", "Redesign existing website", "Fix current website", "Not sure yet"] },
      { key: "goal", text: "What is the main goal?", choices: ["More enquiries", "Professional brand", "Recruitment / hiring", "Online visibility", "All of these"] }
    ]
  },
  seo: {
    title: "SEO & digital growth",
    icon: Sparkles,
    inquiryType: "SEO Services",
    route: "/services",
    routeLabel: "SEO services",
    intro: "I will collect the SEO basics so Innovex can understand your visibility goals.",
    questions: [
      { key: "website", text: "What is your current website URL, if you have one?", placeholder: "Website URL or say no website yet" },
      { key: "targetArea", text: "Which area do you want to target?", placeholder: "Example: Cardiff, London, UK-wide" },
      { key: "seoGoal", text: "What do you most want help with?", choices: ["Google ranking", "Local SEO", "Website content", "Blog strategy", "Technical SEO"] },
      { key: "timeline", text: "How soon do you want to start improving visibility?", choices: ["As soon as possible", "This month", "Next 2-3 months", "Just researching"] }
    ]
  },
  training: {
    title: "Healthcare training courses",
    icon: GraduationCap,
    inquiryType: "General Enquiry",
    route: "/contact",
    routeLabel: "Contact team",
    intro: "I will collect the key information for a healthcare training course enquiry.",
    questions: [
      { key: "company", text: "What is the care home or company name?", placeholder: "Company / care home name" },
      { key: "courseInterest", text: "Which course or training topic are you interested in?", placeholder: "Example: Syringe driver, medication, moving and handling" },
      { key: "delegates", text: "How many delegates may need training?", choices: ["1-5", "6-10", "11-20", "20+"] },
      { key: "dateWindow", text: "When would you like the training?", choices: ["Urgent", "This month", "Next month", "Flexible"] }
    ]
  },
  contact: {
    title: "General contact",
    icon: PhoneCall,
    inquiryType: "General Enquiry",
    route: "/contact",
    routeLabel: "Contact page",
    intro: "No problem. I will collect a short message and send it to the Innovex team.",
    questions: [
      { key: "topic", text: "What is your enquiry about?", choices: ["Recruitment", "Website", "SEO", "Training", "Partnership", "Other"] },
      { key: "message", text: "Please write a short message for the team.", placeholder: "Tell us what you need help with" }
    ]
  }
};

const contactQuestions = [
  { key: "name", text: "What is your name?", placeholder: "Your full name" },
  { key: "email", text: "What email should the team reply to?", placeholder: "Email address", validate: "email" },
  { key: "phone", text: "What phone number should we use if needed?", placeholder: "Phone number" }
];

const openingMessage = {
  from: "bot",
  text: "Hi, I am the Innovex assistant. Tell me what you need, or choose one of the options below. I will ask the right questions and prepare a proper enquiry for the team."
};

const intentButtons = [
  ["candidate", "Find me a job"],
  ["staffing", "I need healthcare staff"],
  ["website", "Build a website"],
  ["seo", "Improve SEO"],
  ["training", "Book training"],
  ["contact", "Speak to Innovex"]
];

function detectIntent(text) {
  const value = text.toLowerCase();
  if (/(job|cv|candidate|role|work|vacancy|nurse|care assistant|support worker)/.test(value)) return "candidate";
  if (/(staff|staffing|care home|recruit|registered manager|temporary|permanent|cover)/.test(value)) return "staffing";
  if (/(website|web site|web design|redesign|landing page)/.test(value)) return "website";
  if (/(seo|google|ranking|rank|visibility|digital|traffic)/.test(value)) return "seo";
  if (/(training|course|delegate|trainer|certificate|syringe|medication)/.test(value)) return "training";
  return "contact";
}

function getPriority(flowId, answers) {
  if (flowId === "staffing" && /urgent|today|week/i.test(answers.urgency || "")) return "High priority";
  if (flowId === "training" && /urgent/i.test(answers.dateWindow || "")) return "High priority";
  if (flowId === "candidate" && /immediately/i.test(answers.availability || "")) return "Active candidate";
  if (flowId === "website" || flowId === "seo") return "Digital growth lead";
  return "Standard priority";
}

function buildSummary(flow, flowId, answers) {
  const priority = getPriority(flowId, answers);
  const lines = [
    `Source: Innovex website chatbot`,
    `Lead type: ${flow.title}`,
    `Priority: ${priority}`,
    "",
    "Collected details:"
  ];
  [...flow.questions, ...contactQuestions].forEach((question) => {
    if (answers[question.key]) lines.push(`- ${question.text.replace("?", "")}: ${answers[question.key]}`);
  });
  return lines.join("\n");
}

export default function Chatbot() {
  const navigate = useNavigate();
  const bodyRef = useRef(null);
  const scrollRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([openingMessage]);
  const [flowId, setFlowId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  const activeFlow = flowId ? flows[flowId] : null;
  const questions = activeFlow ? [...activeFlow.questions, ...contactQuestions] : [];
  const currentQuestion = !completed ? questions[step] : null;
  const summary = activeFlow && completed ? buildSummary(activeFlow, flowId, answers) : "";
  const priority = activeFlow ? getPriority(flowId, answers) : "";

  useEffect(() => {
    const scrollChat = () => {
      if (bodyRef.current) {
        bodyRef.current.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
      }
      scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    };
    window.setTimeout(scrollChat, 60);
  }, [messages, typing, completed, status]);

  function addUser(text) {
    setMessages((current) => [...current, { from: "user", text }]);
  }

  function addBot(text, delay = 420) {
    setTyping(true);
    window.setTimeout(() => {
      setMessages((current) => [...current, { from: "bot", text }]);
      setTyping(false);
    }, delay);
  }

  function startFlow(id, label) {
    const flow = flows[id];
    setFlowId(id);
    setAnswers({});
    setStep(0);
    setCompleted(false);
    setStatus(null);
    setInput("");
    setMessages([openingMessage, { from: "user", text: label }, { from: "bot", text: flow.intro }]);
    addBot(flow.questions[0].text, 560);
  }

  function restart() {
    setFlowId(null);
    setAnswers({});
    setStep(0);
    setCompleted(false);
    setStatus(null);
    setInput("");
    setMessages([openingMessage]);
  }

  function answerQuestion(value) {
    const cleanValue = value.trim();
    if (!cleanValue) return;
    if (!activeFlow) {
      const detected = detectIntent(cleanValue);
      startFlow(detected, cleanValue);
      return;
    }
    if (currentQuestion?.validate === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanValue)) {
      addBot("That email does not look quite right. Please enter a valid email address so the team can reply.");
      return;
    }

    const nextAnswers = { ...answers, [currentQuestion.key]: cleanValue };
    const nextStep = step + 1;
    setAnswers(nextAnswers);
    addUser(cleanValue);
    setInput("");

    if (nextStep < questions.length) {
      setStep(nextStep);
      addBot(questions[nextStep].text);
      return;
    }

    setCompleted(true);
    setStep(nextStep);
    addBot("I have prepared a professional enquiry summary. You can send it to Innovex now or continue on WhatsApp with the same details.");
  }

  function submitInput(event) {
    event.preventDefault();
    answerQuestion(input);
  }

  function openRoute() {
    if (!activeFlow?.route) return;
    setOpen(false);
    navigate(activeFlow.route);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openWhatsapp() {
    const text = encodeURIComponent(summary || "Hi Innovex, I need help from your team.");
    const separator = contact.whatsappUrl.includes("?") ? "&" : "?";
    window.open(`${contact.whatsappUrl}${separator}text=${text}`, "_blank", "noopener,noreferrer");
  }

  async function sendLead() {
    if (!activeFlow) return;
    setSubmitting(true);
    setStatus(null);
    try {
      await api("/contact", {
        method: "POST",
        body: {
          name: answers.name || "Website visitor",
          email: answers.email,
          phone: answers.phone,
          inquiryType: activeFlow.inquiryType,
          subject: `Chatbot lead: ${activeFlow.title} - ${priority}`,
          message: summary
        }
      });
      setStatus({ type: "success", message: "Sent. Innovex has received this enquiry." });
      addBot("Done. The Innovex team has received your enquiry and will respond as soon as possible.");
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Could not send the enquiry." });
    } finally {
      setSubmitting(false);
    }
  }

  const ProgressIcon = useMemo(() => (activeFlow ? activeFlow.icon : Bot), [activeFlow]);

  return (
    <div className={`chatbot-widget${open ? " is-open" : ""}`}>
      {open && (
        <section className="chatbot-panel advanced-chatbot-panel" aria-label="Innovex assistant">
          <div className="chatbot-header">
            <div className="chatbot-brand">
              <img src="/Logo.png" alt="Innovex Resource Group Limited" />
              <div>
                <span>Innovex assistant</span>
                <strong>Smart enquiry builder</strong>
              </div>
            </div>
            <button className="chatbot-close" type="button" onClick={() => setOpen(false)} aria-label="Close chat">
              <X size={18} />
            </button>
          </div>

          <div className="chatbot-body" ref={bodyRef}>
            <div className="chatbot-progress-card">
              <ProgressIcon size={19} />
              <div>
                <span>{activeFlow ? activeFlow.title : "Innovex support"}</span>
                <strong>{activeFlow ? `${Math.min(step, questions.length)} of ${questions.length} details collected` : "Online now - ready to help"}</strong>
              </div>
            </div>

            <div className="chatbot-messages">
              {messages.map((message, index) => (
                <div className={`chatbot-message ${message.from}`} key={`${message.from}-${index}`}>
                  {message.from === "bot" && <Bot size={16} />}
                  <p>{message.text}</p>
                </div>
              ))}
              {typing && (
                <div className="chatbot-message bot">
                  <Bot size={16} />
                  <p className="typing-dots"><span></span><span></span><span></span></p>
                </div>
              )}
              <div ref={scrollRef} />
            </div>

            {!activeFlow && (
              <div className="chatbot-intent-grid" aria-label="Choose enquiry type">
                {intentButtons.map(([id, label]) => {
                  const Icon = flows[id].icon;
                  return (
                    <button type="button" key={id} onClick={() => startFlow(id, label)}>
                      <Icon size={17} />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {currentQuestion?.choices && !typing && (
              <div className="chatbot-choice-grid">
                {currentQuestion.choices.map((choice) => (
                  <button type="button" key={choice} onClick={() => answerQuestion(choice)}>
                    {choice}
                  </button>
                ))}
              </div>
            )}

            {!completed && (
              <form className="chatbot-input-row" onSubmit={submitInput}>
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={currentQuestion?.placeholder || "Type what you need help with"}
                  aria-label="Chat message"
                />
                <button type="submit" aria-label="Send message"><Send size={17} /></button>
              </form>
            )}

            {completed && (
              <div className="chatbot-summary-card">
                <div className="chatbot-summary-head">
                  <CheckCircle2 size={18} />
                  <div>
                    <span>{priority}</span>
                    <strong>Enquiry summary ready</strong>
                  </div>
                </div>
                <pre>{summary}</pre>
                <div className="chatbot-actions advanced">
                  <button type="button" onClick={sendLead} disabled={submitting}>
                    <Send size={15} />
                    {submitting ? "Sending..." : "Send to Innovex"}
                  </button>
                  <button type="button" onClick={openWhatsapp}>
                    <MessageCircle size={15} />
                    WhatsApp summary
                  </button>
                  <button type="button" onClick={openRoute}>{activeFlow.routeLabel}</button>
                </div>
              </div>
            )}

            {activeFlow && (
              <button className="chatbot-reset" type="button" onClick={restart}>
                <RotateCcw size={15} />
                Start a new enquiry
              </button>
            )}
            {status && <p className={`chatbot-status ${status.type || "success"}`}>{status.message}</p>}
          </div>
        </section>
      )}

      <button className="chatbot-launcher" type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close Innovex assistant" : "Open Innovex assistant"}>
        {open ? (
          <X size={24} />
        ) : (
          <>
            <span className="chatbot-launcher-avatar">
              <img src="/Logo.png" alt="" />
              <span className="chatbot-online-dot"></span>
            </span>
            <span className="chatbot-launcher-copy">
              <small>Online now</small>
              <strong>Chat with Innovex</strong>
            </span>
          </>
        )}
      </button>
    </div>
  );
}
