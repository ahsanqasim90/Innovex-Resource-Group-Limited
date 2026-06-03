import { ArrowRight, ShieldCheck, Users, HeartHandshake, MonitorSmartphone, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import JobCard from "../components/JobCard.jsx";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import { services } from "../data/content.js";

export default function Home() {
  const [jobs, setJobs] = useState([]);
  const [testimonials, setTestimonials] = useState([]);

  useEffect(() => {
    api("/jobs").then((data) => setJobs(data.slice(0, 3))).catch(() => {});
    api("/testimonials").then((data) => setTestimonials(data.slice(0, 3))).catch(() => {});
  }, []);

  return (
    <>
      <SEO title="Healthcare Recruitment, Websites & SEO" path="/" description="Innovex Resource Group Limited provides UK healthcare recruitment, care home staffing, website design, SEO, and digital growth services from Cardiff." />
      <section className="hero">
        <div>
          <span className="eyebrow">Recruitment, websites & SEO</span>
          <h1>Staffing, websites and SEO that help you grow.</h1>
          <p>Innovex Resource Group Limited supports healthcare recruitment and helps businesses across all sectors with modern websites, SEO, and online visibility.</p>
          <div className="actions">
            <Link className="button" to="/jobs">Browse Jobs <ArrowRight size={18} /></Link>
            <Link className="button light" to="/contact">Request Staffing Support</Link>
            <Link className="button hero-digital" to="/contact">Build Website</Link>
            <Link className="button hero-digital secondary-hero" to="/contact">Boost SEO</Link>
          </div>
        </div>
        <aside className="hero-card" aria-label="Innovex highlights">
          <div className="stats-grid">
            <div className="stat"><strong>24/7</strong><span>Staffing response</span></div>
            <div className="stat"><strong>128+</strong><span>Placements</span></div>
            <div className="stat"><strong>Web</strong><span>Design & SEO</span></div>
          </div>
          <div className="hero-service-strip">
            <span><MonitorSmartphone size={18} /> Websites</span>
            <span><Search size={18} /> SEO</span>
            <span><ShieldCheck size={18} /> Recruitment</span>
          </div>
        </aside>
      </section>

      <section className="section">
        <SectionHeading eyebrow="Services" title="Specialist support for care providers">From temporary shifts to permanent leadership roles, Innovex keeps recruitment practical, fast, and compliant.</SectionHeading>
        <div className="card-grid">
          {services.slice(0, 6).map((service) => <article className="card" key={service.title}><h3>{service.title}</h3><p>{service.description}</p><Link to="/services" className="button secondary small">Learn More</Link></article>)}
        </div>
      </section>

      <section className="section alt">
        <SectionHeading eyebrow="Digital Services" title="Websites and SEO for growing organisations">
          We also design modern websites and provide SEO support for businesses across healthcare and every other sector.
        </SectionHeading>
        <div className="card-grid">
          <article className="card digital-card"><span className="digital-icon"><MonitorSmartphone size={24} /></span><h3>Website Design</h3><p>Responsive, professional websites built around your services, brand, and customer journey.</p><Link to="/services" className="button secondary small">Explore Digital Services</Link></article>
          <article className="card digital-card"><span className="digital-icon"><Search size={24} /></span><h3>SEO Services</h3><p>Search-friendly pages, local SEO, content structure, and visibility improvements.</p><Link to="/contact" className="button small">Discuss SEO</Link></article>
        </div>
      </section>

      <section className="section alt">
        <SectionHeading eyebrow="Opportunities" title="Current healthcare roles">Jobs are loaded from the Innovex admin panel.</SectionHeading>
        <div className="card-grid">{jobs.map((job) => <JobCard key={job._id} job={job} />)}</div>
      </section>

      <section className="section">
        <SectionHeading eyebrow="Why choose Innovex" title="Recruitment with care-sector judgement" />
        <div className="card-grid">
          {[["Compliance-led", ShieldCheck], ["People-first", Users], ["Partnership focused", HeartHandshake]].map(([title, Icon]) => (
            <article className="card" key={title}><Icon color="#0b5f75" /><h3>{title}</h3><p>Clear communication, careful screening, and a practical understanding of care home staffing pressure.</p></article>
          ))}
        </div>
      </section>

      <section className="section alt">
        <SectionHeading eyebrow="Testimonials" title="Trusted by providers and candidates" />
        <div className="card-grid">{testimonials.map((item) => <article className="card" key={item._id}><div className="badge">★★★★★</div><p>{item.message}</p><h3>{item.name}</h3><p className="muted">{item.role}{item.company ? `, ${item.company}` : ""}</p></article>)}</div>
      </section>
    </>
  );
}
