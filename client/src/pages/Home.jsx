import { ArrowRight, ShieldCheck, Users, HeartHandshake, MonitorSmartphone, Search, GraduationCap, CalendarCheck, BadgeCheck, BriefcaseBusiness, CheckCircle2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import BlogCard from "../components/BlogCard.jsx";
import HomeJobsSlider from "../components/HomeJobsSlider.jsx";
import PartnerLogoSlider from "../components/PartnerLogoSlider.jsx";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import TestimonialSlider from "../components/TestimonialSlider.jsx";

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
    title: "Digital Services",
    text: "Web development and SEO for organisations that need a credible, conversion-focused online presence.",
    points: ["Websites and web applications", "Technical and on-page SEO", "International project enquiries"],
    cta: "Discuss a Digital Project",
    to: "/website-development"
  },
  {
    icon: GraduationCap,
    title: "Healthcare Courses",
    text: "Training enquiry support for care homes, children's homes, nursing homes and healthcare teams.",
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
    api("/jobs?limit=9")
      .then((data) => setJobs(data))
      .catch(() => setJobs([]))
      .finally(() => setJobsLoading(false));
    api("/testimonials").then(setTestimonials).catch(() => {});
    api("/blogs").then((data) => setBlogs(data.slice(0, 3))).catch(() => {});
    api("/partners").then((data) => setPartners(data)).catch(() => {});
  }, []);

  return (
    <>
      <SEO title="Recruitment, Training, Websites & CRM Systems" path="/" description="Innovex Resource Group supports organisations with specialist recruitment, professional training, modern websites and tailored CRM systems." />
      <section className="home-premium-hero">
        <div className="home-premium-hero-copy">
          <span className="home-premium-kicker"><BadgeCheck size={17} /> Recruitment · Training · Websites · CRM</span>
          <h1>People, technology and training—built for your <em>growth.</em></h1>
          <p>One accountable team for specialist recruitment, professional healthcare training, modern websites and tailored CRM systems.</p>
          <div className="home-premium-actions">
            <Link className="button home-premium-primary" to="/services">Explore our services <ArrowRight size={18} /></Link>
            <Link className="button home-premium-secondary" to="/contact">Start a conversation</Link>
          </div>
          <div className="home-premium-capabilities" aria-label="Innovex capabilities">
            <span><ShieldCheck size={18} /><strong>Recruitment</strong></span>
            <span><MonitorSmartphone size={18} /><strong>Websites</strong></span>
            <span><BriefcaseBusiness size={18} /><strong>CRM systems</strong></span>
            <span><GraduationCap size={18} /><strong>Training</strong></span>
          </div>
        </div>

        <div className="home-premium-bento" aria-label="Explore Innovex services">
          <Link className="home-premium-bento-card" to="/healthcare-recruitment">
            <img src="/innovex-care-team-hero.jpg" alt="Healthcare professionals representing Innovex recruitment" width="960" height="640" loading="eager" fetchPriority="high" />
            <span><ShieldCheck size={18} /><strong>Recruitment</strong><small>Specialist UK staffing</small></span>
          </Link>
          <Link className="home-premium-bento-card" to="/website-development">
            <img src="/innovex-web-development-hero.jpg" alt="Digital team creating a modern business website" width="960" height="640" loading="eager" fetchPriority="high" />
            <span><MonitorSmartphone size={18} /><strong>Websites</strong><small>Modern digital experiences</small></span>
          </Link>
          <Link className="home-premium-bento-card" to="/crm-systems">
            <img src="/innovex-crm-systems-hero.jpg" alt="Tailored CRM dashboard and business workflow" width="960" height="640" loading="eager" fetchPriority="high" />
            <span><BriefcaseBusiness size={18} /><strong>CRM systems</strong><small>Smarter business workflows</small></span>
          </Link>
          <Link className="home-premium-bento-card" to="/courses">
            <img src="/innovex-training-hero.jpg" alt="Professional healthcare training session" width="960" height="640" loading="eager" fetchPriority="high" />
            <span><GraduationCap size={18} /><strong>Training</strong><small>Practical team development</small></span>
          </Link>
        </div>
      </section>

      <div className="home-premium-ribbon" aria-label="Innovex specialist divisions">
        <span>One accountable partner</span>
        <strong><ShieldCheck size={19} /> Recruitment</strong>
        <strong><GraduationCap size={19} /> Training</strong>
        <strong><MonitorSmartphone size={19} /> Digital growth</strong>
      </div>

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

      <section className="home-premium-values">
        <div className="home-premium-section-intro">
          <span className="eyebrow">Why Innovex</span>
          <h2>Professional delivery. Human service.</h2>
        </div>
        <div className="home-premium-value-grid">
          {[["Care-sector understanding", "We recognise the operational pressure behind every vacancy.", ShieldCheck], ["Clear communication", "Straightforward updates for employers and candidates at every stage.", Users], ["Partnership mindset", "Support designed around lasting working relationships, not quick transactions.", HeartHandshake]].map(([title, text, Icon]) => (
            <article key={title}><span><Icon size={23} /></span><h3>{title}</h3><p>{text}</p></article>
          ))}
        </div>
      </section>

      <section className="section training-home-section home-premium-training">
        <div className="training-home-card">
          <div><span className="eyebrow">Healthcare training</span><h2>Build capability across your care team.</h2><p>Choose the training your staff need, share delegate numbers and location, and receive a tailored quotation from our team.</p></div>
          <div className="training-home-points"><span><GraduationCap size={18} /> Active course library</span><span><Users size={18} /> Delegate-based enquiries</span><span><CalendarCheck size={18} /> Preferred date planning</span></div>
          <Link className="button" to="/courses">Explore courses <ArrowRight size={17} /></Link>
        </div>
      </section>

      <section className="home-premium-digital">
        <div className="home-premium-digital-heading"><span><Sparkles size={18} /> Digital services</span><h2>A stronger digital presence for organisations ready to grow.</h2><p>Modern websites and practical SEO support built around credibility, clarity and measurable business goals.</p><div><Link className="button" to="/website-development">Website projects</Link><Link className="button secondary" to="/seo-services">SEO support</Link></div></div>
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
