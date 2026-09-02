import { Link } from "react-router-dom";
import {
  ArrowRight, BarChart3, Blocks, BriefcaseBusiness, CheckCircle2, Database,
  FileCheck2, Gauge, MailCheck, Network, ShieldCheck, Sparkles, UsersRound, Workflow
} from "lucide-react";
import SEO from "../components/SEO.jsx";
import { company } from "../data/content.js";

const capabilityGroups = [
  {
    icon: BriefcaseBusiness,
    title: "Sales and client operations",
    text: "Keep prospects, follow-ups, meetings, communications and commercial progress connected instead of scattered across spreadsheets.",
    points: ["Lead qualification", "Follow-up ownership", "Client communication history"]
  },
  {
    icon: UsersRound,
    title: "Recruitment workflows",
    text: "Coordinate vacancies, candidates, documents, interviews and placements through clear role-based workflows.",
    points: ["Candidate pipelines", "Vacancy matching", "Interview coordination"]
  },
  {
    icon: FileCheck2,
    title: "Documents and finance",
    text: "Generate professional documents and keep operational records linked to the work that created them.",
    points: ["PDF and Excel outputs", "Quotations and invoices", "Controlled document access"]
  },
  {
    icon: MailCheck,
    title: "Communication centre",
    text: "Bring approved email, mailbox history, reminders and customer touchpoints into one accountable workspace.",
    points: ["Approved sender accounts", "Email history", "Scheduled reminders"]
  }
];

const deliverySteps = [
  ["01", "Map the real workflow", "We document users, hand-offs, data, approvals and the operational bottlenecks the system must remove."],
  ["02", "Design the workspace", "We shape modules, access levels and reporting around the way your team actually works."],
  ["03", "Build and validate", "The platform is delivered in testable stages with practical feedback from the people who will use it."],
  ["04", "Launch and improve", "We support rollout, training and focused improvements as the workflow matures."]
];

const fitItems = [
  ["Recruitment businesses", "Candidate, vacancy and client workflows in one place."],
  ["Care organisations", "Training, staffing and operational records with clear ownership."],
  ["Service-led companies", "A tailored sales and delivery workspace without generic CRM clutter."],
  ["Growing teams", "A controlled replacement for disconnected forms, inboxes and spreadsheets."]
];

export default function CRMSystems() {
  return (
    <main className="crm-product-page">
      <SEO
        title="Tailored CRM Systems & Business Workflow Software"
        path="/crm-systems"
        description="Tailored CRM systems and workflow software from Innovex Resource Group Limited for recruitment, care and service-led organisations."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Tailored CRM systems and workflow software",
          serviceType: "CRM development and business workflow software",
          provider: { "@type": "Organization", name: company.name, url: company.siteUrl },
          areaServed: ["United Kingdom", "Worldwide"]
        }}
      />

      <section className="crm-product-hero">
        <div className="crm-product-hero-copy">
          <span className="crm-product-kicker"><Sparkles size={16} /> Tailored CRM & operations software</span>
          <h1>One professional workspace for the work your business actually does.</h1>
          <p>Replace disconnected spreadsheets, inboxes and manual hand-offs with a secure CRM designed around your team, customers and operational workflow.</p>
          <div className="crm-product-actions">
            <Link className="button" to="/contact?service=crm#contact-form">Discuss your CRM <ArrowRight size={17} /></Link>
            <a className="button secondary" href="#platform">Explore the platform</a>
          </div>
          <div className="crm-product-trust-row">
            <span><ShieldCheck size={16} /> Role-based access</span>
            <span><Workflow size={16} /> Workflow-led design</span>
            <span><BarChart3 size={16} /> Operational reporting</span>
          </div>
        </div>
        <div className="crm-product-visual" aria-label="Example tailored CRM workspace">
          <div className="crm-visual-window">
            <header><span><i /><i /><i /></span><strong>Operations workspace</strong><em>Live</em></header>
            <div className="crm-visual-shell">
              <aside><b /><b /><b /><b /><b /></aside>
              <section>
                <div className="crm-visual-heading"><span><i /> Good morning</span><strong>Business overview</strong></div>
                <div className="crm-visual-stats"><article><small>Active work</small><strong>24</strong><i /></article><article><small>Follow-ups</small><strong>08</strong><i /></article><article><small>Completed</small><strong>91%</strong><i /></article></div>
                <div className="crm-visual-content"><article><header><strong>Priority pipeline</strong><span /></header>{["Qualified enquiry", "Candidate review", "Client meeting", "Proposal follow-up"].map((item, index) => <p key={item}><i>{index + 1}</i><span>{item}</span><em /></p>)}</article><aside><strong>Activity</strong><i /><i /><i /></aside></div>
              </section>
            </div>
          </div>
          <span className="crm-visual-float top"><Gauge size={17} /><b>Clear priorities</b></span>
          <span className="crm-visual-float bottom"><CheckCircle2 size={17} /><b>Accountable delivery</b></span>
        </div>
      </section>

      <section className="crm-product-proof-strip" aria-label="CRM platform principles">
        <span><Database size={19} /><strong>One source of truth</strong><small>Connected business records</small></span>
        <span><Network size={19} /><strong>Connected workflows</strong><small>Fewer manual hand-offs</small></span>
        <span><ShieldCheck size={19} /><strong>Controlled access</strong><small>People see what they need</small></span>
        <span><Blocks size={19} /><strong>Built to evolve</strong><small>Modules that grow with you</small></span>
      </section>

      <section className="crm-product-platform" id="platform">
        <header className="crm-product-section-heading"><span>Platform capability</span><h2>Bring your customer and operational workflows together.</h2><p>Every CRM engagement starts with the process—not a generic feature checklist. The result is a focused workspace your team can understand and adopt.</p></header>
        <div className="crm-capability-grid">
          {capabilityGroups.map(({ icon: Icon, title, text, points }, index) => <article key={title}><header><span><Icon size={23} /></span><small>0{index + 1}</small></header><h3>{title}</h3><p>{text}</p><ul>{points.map((point) => <li key={point}><CheckCircle2 size={15} /> {point}</li>)}</ul></article>)}
        </div>
      </section>

      <section className="crm-product-fit">
        <div><span className="crm-product-kicker"><BriefcaseBusiness size={16} /> Designed around the organisation</span><h2>A better fit for teams with specialist workflows.</h2><p>Generic CRMs often create extra admin because the terminology, records and pipeline do not match the business. Innovex focuses the system around the decisions and actions your team already owns.</p><Link className="button secondary" to="/contact?service=crm#contact-form">Tell us about your workflow <ArrowRight size={16} /></Link></div>
        <div className="crm-fit-list">{fitItems.map(([title, text]) => <article key={title}><span><CheckCircle2 size={17} /></span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
      </section>

      <section className="crm-product-delivery">
        <header className="crm-product-section-heading"><span>Delivery approach</span><h2>From operational problem to working platform.</h2><p>Clear stages keep scope, decisions and user feedback visible from the beginning.</p></header>
        <div className="crm-delivery-grid">{deliverySteps.map(([number, title, text]) => <article key={number}><strong>{number}</strong><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
      </section>

      <section className="crm-product-final-cta">
        <span><Sparkles size={18} /> Start with the workflow that costs your team the most time</span>
        <h2>Let us turn it into a clearer, connected system.</h2>
        <p>Share the process, users and bottlenecks. Innovex will help shape the right first release.</p>
        <div><Link className="button" to="/contact?service=crm#contact-form">Start a CRM conversation <ArrowRight size={17} /></Link><Link className="button secondary" to="/services">View all services</Link></div>
      </section>
    </main>
  );
}
