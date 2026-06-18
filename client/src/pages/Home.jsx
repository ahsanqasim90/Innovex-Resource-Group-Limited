import { ArrowRight, ShieldCheck, Users, HeartHandshake, MonitorSmartphone, Search, GraduationCap, CalendarCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import BlogCard from "../components/BlogCard.jsx";
import HomeJobsSlider from "../components/HomeJobsSlider.jsx";
import PartnerLogoSlider from "../components/PartnerLogoSlider.jsx";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import TestimonialSlider from "../components/TestimonialSlider.jsx";
import { services } from "../data/content.js";

const helpCards = [
  {
    icon: ShieldCheck,
    title: "Recruitment",
    text: "Healthcare, social care, nursing, care home and children's residential recruitment support across the UK.",
    points: ["Candidate sourcing", "Screening support", "Interview coordination"],
    cta: "Request Recruitment Support",
    to: "/contact"
  },
  {
    icon: MonitorSmartphone,
    title: "Website Development",
    text: "Modern, responsive websites built to help businesses look professional and generate enquiries.",
    points: ["Mobile-friendly pages", "Clear service content", "Enquiry forms"],
    cta: "Start Website Project",
    to: "/services#website-development"
  },
  {
    icon: Search,
    title: "SEO & Digital Growth",
    text: "SEO, content and digital visibility support to help businesses attract more leads online.",
    points: ["SEO foundations", "Content structure", "Local visibility"],
    cta: "Improve My SEO",
    to: "/services#seo-digital-growth"
  },
  {
    icon: GraduationCap,
    title: "Healthcare Courses",
    text: "Training enquiry support for care homes, children's homes, nursing homes and healthcare teams.",
    points: ["Course selection", "Delegate planning", "Quotation support"],
    cta: "View Courses",
    to: "/courses"
  }
];

const audiences = [
  "Care Providers",
  "Healthcare Candidates",
  "Nursing Homes",
  "Children's Residential Homes",
  "Supported Living Providers",
  "Local Businesses",
  "Service-Based Businesses",
  "Growing Organisations"
];

const digitalProof = [
  {
    title: "Mobile-Friendly Website",
    text: "Responsive websites designed to work smoothly across desktop, tablet and mobile."
  },
  {
    title: "SEO-Ready Structure",
    text: "Pages structured with clear headings, metadata and search-friendly content foundations."
  },
  {
    title: "Lead-Focused Contact Journey",
    text: "Clear calls-to-action and enquiry forms designed to turn visitors into leads."
  }
];

export default function Home() {
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [testimonials, setTestimonials] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    api("/jobs")
      .then((data) => setJobs(data))
      .catch(() => setJobs([]))
      .finally(() => setJobsLoading(false));
    api("/testimonials").then(setTestimonials).catch(() => {});
    api("/blogs").then((data) => setBlogs(data.slice(0, 3))).catch(() => {});
    api("/partners").then((data) => setPartners(data)).catch(() => {});
  }, []);

  return (
    <>
      <SEO title="UK Recruitment, Web Development & SEO" path="/" description="Innovex Resource Group Limited provides UK recruitment services, healthcare staffing, web development, SEO services, and digital growth support from Cardiff." />
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
          <p className="cta-microcopy hero-helper">For care providers, candidates, and businesses looking for recruitment, websites and digital growth.</p>
        </div>
        <aside className="hero-card" aria-label="Innovex highlights">
          <img
            className="hero-visual-image"
            src="/innovex-hero-visual.svg"
            alt="Innovex healthcare recruitment, website and SEO support visual"
            width="1100"
            height="680"
            loading="eager"
            fetchPriority="high"
          />
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

      <section className="section compact-section">
        <SectionHeading eyebrow="Three Core Services" title="How Innovex Can Help">
          Choose the support you need - recruitment, website development, or SEO growth.
        </SectionHeading>
        <div className="card-grid service-choice-grid">
          {helpCards.map(({ icon: Icon, title, text, points, cta, to }) => (
            <article className="card service-choice-card" key={title}>
              <div className="service-choice-top">
                <span className="digital-icon"><Icon size={24} /></span>
                <span className="service-choice-label">Core service</span>
              </div>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
              <ul className="service-mini-list">
                {points.map((point) => <li key={point}>{point}</li>)}
              </ul>
              <Link className="button secondary small" to={to}>{cta}</Link>
            </article>
          ))}
        </div>
        <div className="who-help-card">
          <h2>Who We Help</h2>
          <div className="chip-cloud">
            {audiences.map((audience) => <span key={audience}>{audience}</span>)}
          </div>
        </div>
      </section>

      <section className="section training-home-section">
        <div className="training-home-card">
          <div>
            <span className="eyebrow">Healthcare training</span>
            <h2>Need staff training for your care team?</h2>
            <p>
              Browse available healthcare courses, select the training your staff need, tell us delegate numbers and location, and our team will send a tailored quotation.
            </p>
          </div>
          <div className="training-home-points">
            <span><GraduationCap size={18} /> Active course library</span>
            <span><Users size={18} /> Delegate-based enquiries</span>
            <span><CalendarCheck size={18} /> Preferred date planning</span>
          </div>
          <Link className="button" to="/courses">Explore Healthcare Courses</Link>
        </div>
      </section>

      <section className="section">
        <SectionHeading eyebrow="Services" title="Specialist support for care providers">From temporary shifts to permanent leadership roles, Innovex keeps recruitment practical, fast, and compliant.</SectionHeading>
        <div className="card-grid">
          {services.slice(0, 6).map((service) => <article className="card" key={service.title}><h3>{service.title}</h3><p>{service.description}</p><Link to="/services" className="button secondary small">Learn More</Link></article>)}
        </div>
        <article className="card recruitment-quality-card">
          <div>
            <span className="eyebrow">Recruitment Quality</span>
            <h2>Recruitment Support Built Around Quality</h2>
            <p>We support employers with candidate sourcing, screening and communication throughout the recruitment process.</p>
          </div>
          <ul className="clean-list quality-list">
            <li>Candidate screening</li>
            <li>Right to work awareness</li>
            <li>DBS and compliance awareness</li>
            <li>Interview coordination</li>
            <li>Ongoing communication</li>
          </ul>
        </article>
      </section>

      <section className="section alt">
        <SectionHeading eyebrow="Digital Services" title="Websites and SEO for growing organisations">
          We also design modern websites and provide SEO support for businesses across healthcare and every other sector.
        </SectionHeading>
        <div className="card-grid">
          <article className="card digital-card"><span className="digital-icon"><MonitorSmartphone size={24} /></span><h3>Website Design</h3><p>Responsive, professional websites built around your services, brand, and customer journey.</p><Link to="/services" className="button secondary small">Explore Digital Services</Link></article>
          <article className="card digital-card"><span className="digital-icon"><Search size={24} /></span><h3>SEO Services</h3><p>Search-friendly pages, local SEO, content structure, and visibility improvements.</p><Link to="/contact" className="button small">Discuss SEO</Link></article>
        </div>
        <div className="digital-proof-block">
          <SectionHeading eyebrow="Digital Delivery" title="What You Get With Our Digital Services" />
          <div className="card-grid">
            {digitalProof.map((item) => (
              <article className="card digital-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="section-heading-row">
          <SectionHeading eyebrow="Opportunities" title="Current healthcare roles">Live vacancies from the Innovex admin panel, updated for candidates across the UK.</SectionHeading>
          <Link className="button secondary" to="/jobs">View All Jobs</Link>
        </div>
        <HomeJobsSlider jobs={jobs} loading={jobsLoading} />
      </section>

      <section className="section">
        <SectionHeading eyebrow="Why choose Innovex" title="Recruitment with care-sector judgement" />
        <div className="card-grid">
          {[["Compliance-led", ShieldCheck], ["People-first", Users], ["Partnership focused", HeartHandshake]].map(([title, Icon]) => (
            <article className="card" key={title}><Icon color="#0b5f75" /><h3>{title}</h3><p>Clear communication, careful screening, and a practical understanding of care home staffing pressure.</p></article>
          ))}
        </div>
      </section>

      <PartnerLogoSlider partners={partners} />

      {blogs.length > 0 && (
        <section className="section alt">
          <SectionHeading eyebrow="Insights" title="Latest recruitment and SEO advice">Fresh articles from Innovex for care providers, candidates, and businesses improving their online visibility.</SectionHeading>
          <div className="blog-grid home-blog-grid">{blogs.map((blog) => <BlogCard key={blog._id} blog={blog} />)}</div>
          <div className="actions"><Link className="button secondary" to="/blogs">View All Insights</Link></div>
        </section>
      )}

      <TestimonialSlider testimonials={testimonials} />
    </>
  );
}
