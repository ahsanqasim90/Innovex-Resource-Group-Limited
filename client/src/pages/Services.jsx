import { Link } from "react-router-dom";
import { Code2, Globe2, LineChart, Megaphone, MonitorSmartphone, Search } from "lucide-react";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import { company, digitalServices, services } from "../data/content.js";

const digitalIcons = [MonitorSmartphone, Search, Megaphone, Globe2];

const faqs = [
  {
    question: "What services does Innovex provide?",
    answer: "Innovex provides recruitment, website development and SEO/digital growth services for UK businesses."
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
      <section className="section" id="recruitment">
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
        <SectionHeading as="h1" eyebrow="Services" title="Healthcare staffing services for care providers" />
        <article className="card service-intro-card">
          <h2>Innovex supports organisations through recruitment, website development, and SEO.</h2>
          <p>Our recruitment services focus on healthcare and social care, while our website and SEO services support growing UK businesses across wider sectors.</p>
        </article>
        <div className="card-grid">
          {services.map((service) => (
            <article className="card" key={service.title}>
              <div className="badge">Recruitment Service</div>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
              <Link className="button secondary small" to="/healthcare-recruitment">Learn More</Link>
            </article>
          ))}
        </div>
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
