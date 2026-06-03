import { Link } from "react-router-dom";
import { Code2, Globe2, LineChart, Megaphone, MonitorSmartphone, Search } from "lucide-react";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import { digitalServices, services } from "../data/content.js";

const digitalIcons = [MonitorSmartphone, Search, Megaphone, Globe2];

export default function Services() {
  return (
    <>
      <section className="section">
        <SEO title="Services" path="/services" description="Explore Innovex services including healthcare recruitment, care home staffing, nurse placement, website design, SEO, branding, and digital support across all sectors." />
        <SectionHeading eyebrow="Services" title="Healthcare staffing services for care providers" />
        <div className="card-grid">
          {services.map((service) => (
            <article className="card" key={service.title}>
              <div className="badge">Recruitment Service</div>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
              <Link className="button secondary small" to="/contact">Learn More</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="section alt digital-section">
        <div className="digital-showcase">
          <div>
            <SectionHeading eyebrow="Digital Growth Services" title="Websites, SEO, and online visibility for every sector">
              Alongside recruitment support, Innovex helps businesses build a stronger digital presence with clean websites, search-friendly content, and practical online growth services.
            </SectionHeading>
            <div className="actions">
              <Link className="button" to="/contact">Request a Digital Project</Link>
              <Link className="button secondary" to="/contact">Ask About SEO</Link>
            </div>
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

        <div className="card-grid digital-grid">
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
    </>
  );
}
