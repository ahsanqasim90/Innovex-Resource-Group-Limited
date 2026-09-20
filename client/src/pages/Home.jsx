import { ArrowRight, ShieldCheck, Users, HeartHandshake, MonitorSmartphone, GraduationCap, CalendarCheck, BadgeCheck, BriefcaseBusiness, CheckCircle2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import BlogCard from "../components/BlogCard.jsx";
import HomeJobsSlider from "../components/HomeJobsSlider.jsx";
import PartnerLogoSlider from "../components/PartnerLogoSlider.jsx";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import TestimonialSlider from "../components/TestimonialSlider.jsx";
import TestimonialReviewText from "../components/TestimonialReviewText.jsx";

const helpCards = [
  {
    icon: ShieldCheck,
    title: "Recruitment",
    text: "Healthcare, social care, nursing, care home and children's residential recruitment support across the UK.",
    points: ["Candidate sourcing", "Screening support", "Interview coordination"],
    cta: "Request Candidates",
    to: "/hire-staff"
  },
  {
    icon: MonitorSmartphone,
    title: "Digital",
    text: "Websites, SEO and tailored CRM systems that help organisations attract enquiries and manage their work.",
    points: ["Websites and web applications", "Technical and on-page SEO", "CRM systems and workflows"],
    cta: "Discuss a Digital Project",
    to: "/website-development"
  },
  {
    icon: GraduationCap,
    title: "Training",
    text: "Healthcare training for care homes, children's homes, nursing homes and healthcare teams.",
    points: ["Course selection", "Delegate planning", "Quotation support"],
    cta: "Explore Courses",
    to: "/courses"
  }
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
    let active = true;
    api("/jobs?limit=9")
      .then((data) => active && setJobs(data))
      .catch(() => active && setJobs([]))
      .finally(() => active && setJobsLoading(false));

    const loadSecondaryContent = () => {
      api("/testimonials").then((data) => active && setTestimonials(data)).catch(() => {});
      api("/blogs").then((data) => active && setBlogs(data.slice(0, 3))).catch(() => {});
      api("/partners").then((data) => active && setPartners(data)).catch(() => {});
    };
    let idleId;
    let timer;
    if ("requestIdleCallback" in window) idleId = window.requestIdleCallback(loadSecondaryContent, { timeout: 1400 });
    else timer = window.setTimeout(loadSecondaryContent, 450);

    return () => {
      active = false;
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <SEO title="Recruitment, Training, Websites & CRM Systems" path="/" description="Innovex Resource Group supports organisations with specialist recruitment, professional training, modern websites and tailored CRM systems." />
      <section className="home-premium-hero">
        <div className="home-premium-hero-copy">
          <span className="home-premium-kicker"><BadgeCheck size={17} /> Recruitment · Training · Digital</span>
          <h1>The right people.<br />The skills and systems<br />to <em>grow.</em></h1>
          <p>Specialist healthcare recruitment, practical training and digital services. One team to help your organisation move forward.</p>
          <div className="home-premium-actions">
            <Link className="button home-premium-primary" to="/contact">Discuss your requirements <ArrowRight size={18} /></Link>
            <Link className="button home-premium-secondary" to="/jobs">Find a job <ArrowRight size={18} /></Link>
          </div>

        </div>

        <div className="home-premium-bento home-service-mosaic" aria-label="Explore our three divisions">
          <Link className="home-premium-bento-card home-mosaic-main" to="/healthcare-recruitment">
            <img src="/innovex-care-team-hero.jpg" alt="Healthcare team" width="960" height="640" fetchPriority="high" decoding="async" />
            <span><ShieldCheck size={18} /><strong>Recruitment</strong><small>Specialist UK staffing</small></span>
          </Link>
          <Link className="home-premium-bento-card" to="/courses">
            <img src="/innovex-training-hero.jpg" alt="Healthcare training session" width="960" height="640" loading="lazy" decoding="async" />
            <span><GraduationCap size={18} /><strong>Training</strong><small>Develop your team</small></span>
          </Link>
          <Link className="home-premium-bento-card" to="/services#website-development">
            <img src="/innovex-web-development-hero.jpg" alt="Team working on a business website" width="960" height="640" loading="lazy" decoding="async" />
            <span><MonitorSmartphone size={18} /><strong>Digital</strong><small>Websites, SEO & CRM</small></span>
          </Link>
        </div>
      </section>

      <div className="home-premium-ribbon" aria-label="Innovex specialist divisions">
        <span>One accountable partner</span>
        <strong><ShieldCheck size={19} /> Recruitment</strong>
        <strong><GraduationCap size={19} /> Training</strong>
        <strong><MonitorSmartphone size={19} /> Digital</strong>
      </div>

      {testimonials[0] && <section className="home-featured-proof" aria-label="Client and candidate feedback">
        <div><span className="eyebrow">From the people we support</span><h2>Experience, in their words.</h2><Link to="/testimonials">Read more feedback <ArrowRight size={16} /></Link></div>
        <div><TestimonialReviewText text={testimonials[0].message} /><p><strong>{testimonials[0].name}</strong><span>{[testimonials[0].role, testimonials[0].company].filter(Boolean).join(" · ")}</span></p></div>
      </section>}

      <section className="home-premium-divisions">
        <div className="home-premium-section-intro">
          <span className="eyebrow">Three specialist divisions</span>
          <h2>Expert support where people and organisations grow.</h2>
          <p>Choose the team that matches your goal. Every division combines practical delivery with clear, responsive communication.</p>
        </div>
        <div className="home-premium-division-grid">
          {helpCards.map(({ icon: Icon, title, text, points, cta, to }, index) => (
            <article className="home-premium-division-card" key={title}>
              <header><span className="home-premium-division-icon"><Icon size={25} /></span><small>0{index + 1}</small></header>
              <div><h3>{title}</h3><p>{text}</p></div>
              <ul>{points.map((point) => <li key={point}><CheckCircle2 size={16} /> {point}</li>)}</ul>
              <Link to={to}>{cta} <ArrowRight size={17} /></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="home-premium-recruitment">
        <div className="home-premium-recruitment-copy">
          <span className="eyebrow">Recruitment with judgement</span>
          <h2>Built for the realities of care recruitment.</h2>
          <p>We understand that every placement affects a service, a team and the people receiving care. Our approach keeps quality, communication and suitability at the centre.</p>
          <div className="home-premium-recruitment-points">
            <span><ShieldCheck size={20} /><strong>Compliance-aware screening</strong><small>Practical checks and clear candidate records.</small></span>
            <span><Users size={20} /><strong>People-first matching</strong><small>Experience, availability and fit considered together.</small></span>
            <span><HeartHandshake size={20} /><strong>Responsive partnership</strong><small>Clear updates from requirement to interview.</small></span>
          </div>
          <Link className="button" to="/hire-staff">Talk to our recruitment team <ArrowRight size={18} /></Link>
        </div>
        <div className="home-premium-process">
          <span className="home-premium-process-label">How we support you</span>
          {[['01', 'Understand the requirement', 'We start with the role, service and priorities—not a generic brief.'], ['02', 'Source and screen', 'Candidates are reviewed against the information that matters to your team.'], ['03', 'Coordinate the next step', 'We keep communication moving through submission and interview.']].map(([number, title, text]) => (
            <article key={number}><strong>{number}</strong><div><h3>{title}</h3><p>{text}</p></div></article>
          ))}
        </div>
      </section>

      <section className="section alt home-premium-jobs">
        <div className="section-heading-row">
          <SectionHeading eyebrow="Live opportunities" title="Find work where you can make a difference.">Explore current healthcare and care-sector vacancies across the UK.</SectionHeading>
          <Link className="button secondary" to="/jobs">View all jobs <ArrowRight size={17} /></Link>
        </div>
        <HomeJobsSlider jobs={jobs} loading={jobsLoading} />
      </section>

      <section className="section training-home-section home-premium-training">
        <div className="training-home-card">
          <div><span className="eyebrow">Healthcare training</span><h2>Build capability across your care team.</h2><p>Choose the training your staff need, share delegate numbers and location, and receive a tailored quotation from our team.</p></div>
          <div className="training-home-points"><span><GraduationCap size={18} /> Browse healthcare courses</span><span><Users size={18} /> Quotes for your team</span><span><CalendarCheck size={18} /> Plan your preferred dates</span></div>
          <Link className="button" to="/courses">Explore courses <ArrowRight size={17} /></Link>
        </div>
      </section>

      <section className="home-premium-digital">
        <div className="home-premium-digital-heading"><span><Sparkles size={18} /> Digital services</span><h2>Websites that attract enquiries. Systems that organise the work.</h2><p>Website development, search visibility and tailored CRM systems, designed around how your business works.</p><div><Link className="button" to="/website-development">Website projects</Link><Link className="button secondary" to="/crm-systems">Explore CRM systems</Link></div></div>
        <div className="home-premium-digital-grid">
          {digitalProof.map((item, index) => <article key={item.title}><small>0{index + 1}</small><h3>{item.title}</h3><p>{item.text}</p></article>)}
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
