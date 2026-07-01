import { ArrowRight, CheckCircle2, CircleHelp, MapPin, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO.jsx";
import { company } from "../data/content.js";

const servicePages = {
  recruitment: {
    path: "/healthcare-recruitment",
    eyebrow: "UK healthcare recruitment",
    title: "Healthcare recruitment support for care providers across the UK",
    description: "Innovex helps care homes, children's residential services and healthcare organisations recruit nurses, care professionals and operational leaders across the UK.",
    intro: "From urgent staffing pressure to permanent leadership appointments, our team helps employers reach relevant candidates, coordinate interviews and keep recruitment moving.",
    primaryCta: "Discuss a vacancy",
    serviceParam: "recruitment",
    audiences: ["Care homes and nursing homes", "Children's residential services", "Supported living providers", "Healthcare organisations"],
    deliverables: [
      ["Candidate sourcing", "Targeted outreach through our growing healthcare talent pool."],
      ["Screening support", "Practical pre-screening around role fit, availability and core requirements."],
      ["Interview coordination", "Clear candidate communication, scheduling and outcome tracking."],
      ["Permanent and temporary hiring", "Flexible support for operational cover and long-term appointments."]
    ],
    process: ["Tell us about the vacancy and essential requirements.", "We identify and contact relevant healthcare candidates.", "You review suitable profiles and select who to interview.", "We coordinate next steps and support the placement process."],
    faqs: [
      ["Which healthcare roles can Innovex support?", "We support care providers with roles including registered nurses, care assistants, support workers, team leaders, deputy managers and registered managers."],
      ["Do you support children's residential services?", "Yes. Our recruitment focus includes children's homes, adult care, nursing homes, supported living and wider healthcare services."],
      ["Can you help with a single vacancy?", "Yes. You can contact us about one role, ongoing recruitment needs or a broader staffing requirement."],
      ["Where does Innovex recruit?", "Innovex is based in Cardiff and supports recruitment requirements across the United Kingdom."]
    ]
  },
  websites: {
    path: "/website-development",
    eyebrow: "Professional website development",
    title: "Websites built to earn trust and generate enquiries",
    description: "Innovex designs responsive, professional websites for care providers, recruiters, local businesses and growing UK organisations that need a stronger online presence.",
    intro: "Your website should explain what you do, make your business credible and give visitors a clear next step. We combine clean design, useful content and conversion-focused journeys around your goals.",
    primaryCta: "Start a website project",
    serviceParam: "website",
    audiences: ["Care and healthcare providers", "Recruitment businesses", "Local service companies", "Growing UK organisations"],
    deliverables: [
      ["Responsive design", "A polished experience across desktop, tablet and mobile."],
      ["Service-led content", "Clear pages that help customers understand your offer quickly."],
      ["Enquiry journeys", "Strong calls-to-action and forms built around lead generation."],
      ["SEO foundations", "Search-friendly structure, metadata and technical essentials from launch."]
    ],
    process: ["We learn about your business, audience and commercial goals.", "We agree the page structure, content priorities and visual direction.", "We build and refine the responsive website.", "We launch, test and provide practical ongoing support."],
    faqs: [
      ["Do you only build healthcare websites?", "No. We have specialist care-sector knowledge, but our website development service is available to organisations across all sectors."],
      ["Will the website work on mobile?", "Yes. Responsive design and mobile usability are part of every Innovex website project."],
      ["Can you help with website content?", "Yes. We can structure service pages and help turn your expertise into clear, customer-focused website content."],
      ["Can SEO be included?", "Yes. Every project includes sound SEO foundations, and ongoing SEO support can be discussed separately."]
    ]
  },
  seo: {
    path: "/seo-services",
    eyebrow: "SEO and digital growth",
    title: "SEO services that turn search visibility into business enquiries",
    description: "Innovex provides practical SEO, local search and content support for care providers and UK businesses that want to attract more relevant customers online.",
    intro: "Good SEO is not a collection of keywords. It connects technical quality, useful service pages, local relevance and consistent content so the right people can discover and trust your business.",
    primaryCta: "Discuss SEO growth",
    serviceParam: "seo",
    audiences: ["Care and healthcare providers", "Recruitment companies", "Local UK businesses", "Service-led organisations"],
    deliverables: [
      ["Technical SEO", "Crawlability, metadata, page hierarchy and performance foundations."],
      ["Service page strategy", "Dedicated pages aligned with the searches that can generate enquiries."],
      ["Local visibility", "Location signals, business information and local search improvements."],
      ["Content growth", "Useful articles and internal links that build topical authority over time."]
    ],
    process: ["We review your website, search visibility and commercial priorities.", "We identify technical issues and high-value search opportunities.", "We improve priority pages and build a practical content roadmap.", "We track progress and refine the work around qualified enquiries."],
    faqs: [
      ["How quickly will SEO produce results?", "SEO is a long-term growth channel. Timing depends on the website, competition and starting position, so we focus on measurable improvements rather than instant ranking promises."],
      ["Do you provide local SEO?", "Yes. We can support local businesses with location relevance, service content and stronger business signals."],
      ["Can you improve an existing website?", "Yes. SEO work can be applied to an existing website or planned alongside a new Innovex website project."],
      ["Do you create SEO content?", "Yes. We can plan and improve service pages and useful articles around genuine customer questions and search demand."]
    ]
  }
};

function schemaFor(page) {
  const pageUrl = `${company.siteUrl}${page.path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${pageUrl}#service`,
        name: page.title,
        description: page.description,
        url: pageUrl,
        areaServed: { "@type": "Country", name: "United Kingdom" },
        provider: { "@id": `${company.siteUrl}/#organization` }
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${company.siteUrl}/` },
          { "@type": "ListItem", position: 2, name: "Services", item: `${company.siteUrl}/services` },
          { "@type": "ListItem", position: 3, name: page.eyebrow, item: pageUrl }
        ]
      },
      {
        "@type": "FAQPage",
        mainEntity: page.faqs.map(([question, answer]) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer }
        }))
      }
    ]
  };
}

export default function ServiceLanding({ service }) {
  const page = servicePages[service];
  const contactUrl = `/contact?service=${page.serviceParam}#contact-form`;

  return (
    <>
      <SEO title={page.eyebrow} path={page.path} description={page.description} jsonLd={schemaFor(page)} />
      <section className="service-landing-hero">
        <div>
          <span className="eyebrow">{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p>{page.intro}</p>
          <div className="actions">
            <Link className="button" to={contactUrl}>{page.primaryCta} <ArrowRight size={18} /></Link>
            <Link className="button secondary" to="/services">Explore all services</Link>
          </div>
          <p className="service-landing-location"><MapPin size={17} /> Cardiff-based team supporting organisations across the UK</p>
        </div>
        <aside className="service-landing-proof" aria-label={`${page.eyebrow} highlights`}>
          <ShieldCheck size={30} />
          <span className="eyebrow">Built around your goals</span>
          <h2>Clear support. Practical delivery. A responsive team.</h2>
          <ul>
            {page.audiences.map((audience) => <li key={audience}><CheckCircle2 size={17} /> {audience}</li>)}
          </ul>
        </aside>
      </section>

      <section className="section service-landing-section">
        <div className="section-heading">
          <span>What is included</span>
          <h2>Support designed to create a meaningful business outcome</h2>
          <p>Every engagement is shaped around the organisation, audience and result you need.</p>
        </div>
        <div className="service-deliverable-grid">
          {page.deliverables.map(([title, text], index) => (
            <article className="card service-deliverable-card" key={title}>
              <span className="service-step-number">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section alt service-process-section">
        <div className="service-process-copy">
          <span className="eyebrow">How we work</span>
          <h2>A straightforward route from enquiry to delivery</h2>
          <p>Our process keeps responsibilities clear and gives you a practical next step at every stage.</p>
          <Link className="button secondary" to={contactUrl}>Talk to the Innovex team</Link>
        </div>
        <ol className="service-process-list">
          {page.process.map((step, index) => <li key={step}><strong>{index + 1}</strong><span>{step}</span></li>)}
        </ol>
      </section>

      <section className="section service-faq-section">
        <div className="section-heading">
          <span>Common questions</span>
          <h2>What organisations ask before getting started</h2>
        </div>
        <div className="faq-grid">
          {page.faqs.map(([question, answer]) => (
            <article className="card faq-card" key={question}>
              <CircleHelp size={22} />
              <h3>{question}</h3>
              <p>{answer}</p>
            </article>
          ))}
        </div>
        <div className="service-closing-cta">
          <div><span className="eyebrow">Ready to take the next step?</span><h2>Tell us what you need and we will respond with a practical way forward.</h2></div>
          <Link className="button" to={contactUrl}>{page.primaryCta} <ArrowRight size={18} /></Link>
        </div>
      </section>
    </>
  );
}
