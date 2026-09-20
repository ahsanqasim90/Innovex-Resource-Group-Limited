import { Link } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, Code2, Globe2, GraduationCap, Layers3, LineChart, Megaphone, MonitorSmartphone, Search, ShieldCheck } from "lucide-react";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import { company, digitalServices, services } from "../data/content.js";

const digitalIcons = [MonitorSmartphone, Search, Megaphone, Globe2];

const faqs = [
  {
    question: "What services does Innovex provide?",
    answer: "Innovex provides specialist recruitment, healthcare training, website development, SEO and tailored CRM systems."
  },
  {
    question: "Do you only work with care providers?",
    answer: "Recruitment support is focused on healthcare and social care, while website development and SEO services are available for wider UK businesses."
  },
  {
    question: "Can you help with both hiring and online growth?",
    answer: "Yes. Innovex can support employers with recruitment while also helping businesses improve their website and online visibility."
  },
  {
    question: "Do you build recruitment websites?",
    answer: "Yes. Innovex can support businesses with professional, responsive and SEO-ready websites, including recruitment-focused websites."
  },
  {
    question: "How can I get started?",
    answer: "Contact Innovex and choose the service you need help with: recruitment, website development, SEO, partnership or general enquiry."
  }
];

export default function Services() {
  return (
    <>
      <section className="section services-overview-section" id="recruitment">
        <SEO
          title="Services"
          path="/services"
          description="Explore Innovex services including healthcare recruitment, care home staffing, nurse placement, website design, SEO, branding, and digital support across all sectors."
          jsonLd={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Innovex Resource Group Limited services",
            itemListElement: [...services, ...digitalServices].map((service, index) => ({
              "@type": "ListItem",
              position: index + 1,
              item: {
                "@type": "Service",
                name: service.title,
                description: service.description,
                provider: { "@type": "Organization", name: company.name, url: company.siteUrl },
                areaServed: "United Kingdom"
              }
            }))
          }}
        />
        <section className="services-overview-hero">
          <div className="services-overview-copy">
            <span className="eyebrow">Innovex services</span>
            <h1>People, skills and systems for organisations that want to grow.</h1>
            <p>Specialist recruitment, professional healthcare training and practical digital services delivered by one responsive team.</p>
            <div className="actions"><Link className="button" to="/contact">Discuss your requirements <ArrowRight size={17} /></Link><Link className="button secondary" to="/about">Why Innovex</Link></div>
          </div>
          <div className="services-overview-panel">
            <span>One accountable partner</span>
            <article><ShieldCheck /><div><strong>Recruitment</strong><small>Source, screen and coordinate the right people.</small></div></article>
            <article><GraduationCap /><div><strong>Training</strong><small>Build capability across healthcare teams.</small></div></article>
            <article><Layers3 /><div><strong>Digital</strong><small>Websites, SEO and tailored CRM systems.</small></div></article>
          </div>
        </section>
        <div className="services-section-heading"><span className="eyebrow">Healthcare recruitment</span><h2>Support across the full hiring journey.</h2><p>Choose the area closest to your current requirement.</p></div>
        <div className="card-grid services-recruitment-grid">
          {services.map((service, index) => (
            <article className="card" key={service.title}>
              <header><span><BriefcaseBusiness size={19} /></span><small>0{index + 1}</small></header>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
              <Link to="/healthcare-recruitment">Explore service <ArrowRight size={16} /></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="section services-extra-divisions" aria-label="Training and CRM services">
        <article><span className="eyebrow">Training</span><h2>Develop the skills your care team needs.</h2><p>Explore healthcare courses and request a quotation for your team, preferred dates and location.</p><Link className="button secondary" to="/courses">Explore training</Link></article>
        <article><span className="eyebrow">Digital systems</span><h2>Bring your business workflows together.</h2><p>Discuss a tailored CRM for managing relationships, recruitment, tasks and reporting in one workspace.</p><Link className="button secondary" to="/crm-systems">Explore CRM systems</Link></article>
      </section>
      <section className="section alt digital-section" id="website-development">
        <div className="digital-showcase">
          <div>
            <SectionHeading eyebrow="Digital Growth Services" title="Websites, SEO, and online visibility for every sector">
              Alongside recruitment support, Innovex helps businesses build a stronger digital presence with clean websites, search-friendly content, and practical online growth services.
            </SectionHeading>
            <div className="actions">
              <Link className="button" to="/website-development">Explore Website Development</Link>
              <Link className="button secondary" to="/seo-services">Explore SEO Services</Link>
              <Link className="button secondary" to="/crm-systems">Explore CRM Systems</Link>
            </div>
            <p className="cta-microcopy">No obligation. Tell us what you need and our team will respond.</p>
          </div>
          <div className="website-visual" aria-label="Website and SEO services illustration">
            <div className="browser-dots"><span></span><span></span><span></span></div>
            <div className="visual-hero"></div>
            <div className="visual-grid">
              <span></span><span></span><span></span><span></span>
            </div>
            <div className="seo-panel">
              <LineChart size={22} />
              <strong>SEO ready</strong>
            </div>
            <Code2 className="code-float" size={34} />
          </div>
        </div>

        <div className="card-grid digital-grid" id="seo-digital-growth">
          {digitalServices.map((service, index) => {
            const Icon = digitalIcons[index];
            return (
              <article className="card digital-card" key={service.title}>
                <span className="digital-icon"><Icon size={24} /></span>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section">
        <SectionHeading eyebrow="FAQ" title="Frequently Asked Questions" />
        <div className="faq-grid">
          {faqs.map((item) => (
            <article className="card faq-card" key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
