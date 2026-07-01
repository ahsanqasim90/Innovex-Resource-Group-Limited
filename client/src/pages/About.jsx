import ComplianceBadges from "../components/ComplianceBadges.jsx";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import { company, values } from "../data/content.js";

const capabilities = [
  {
    title: "Recruitment",
    text: "Healthcare, social care, nursing and care-sector recruitment support across the UK."
  },
  {
    title: "Website Development",
    text: "Professional, responsive websites for organisations that need a clear online presence."
  },
  {
    title: "SEO & Digital Growth",
    text: "Search-friendly content structure, visibility improvements and practical digital support."
  }
];

export default function About() {
  return (
    <section className="section">
      <SEO title="About" path="/about" description="Learn about Innovex Resource Group Limited, a Cardiff-based company supporting healthcare recruitment, care-sector staffing, compliance, websites, and SEO." />
      <SectionHeading as="h1" eyebrow="About Innovex" title="Healthcare recruitment built around trust, compliance, and continuity">
        Innovex Resource Group Limited helps UK care providers find dependable healthcare professionals while helping candidates move into roles where they can do meaningful work.
      </SectionHeading>
      <article className="card about-snapshot-card">
        <div>
          <span className="eyebrow">What We Do</span>
          <h2>Recruitment expertise with digital growth support</h2>
          <p>Innovex combines care-sector recruitment knowledge with website development and SEO support, helping organisations hire well, present themselves professionally, and grow online.</p>
        </div>
        <div className="about-capability-grid">
          {capabilities.map((item) => (
            <div key={item.title}>
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </article>
      <div className="card-grid">
        <article className="card"><h3>Who We Are</h3><p>We are a healthcare recruitment partner focused on care homes, nurses, care assistants, registered managers, and compliance-aware staffing services.</p></article>
        <article className="card"><h3>Mission</h3><p>To connect healthcare providers with skilled, compassionate professionals through responsive and ethical recruitment.</p></article>
        <article className="card"><h3>Vision</h3><p>To become a trusted UK recruitment partner known for reliable staffing, strong candidate care, and long-term provider relationships.</p></article>
      </div>
      <div className="section-heading" style={{ marginTop: 42 }}><h2>Our Values</h2></div>
      <div className="card-grid">{values.map((value) => <div className="card" key={value}><h3>{value}</h3><p>Every placement is handled with professionalism, clarity, and respect for the care environment.</p></div>)}</div>
      <article className="card compliance-card" style={{ marginTop: 24 }}>
        <div>
          <span className="eyebrow">Compliance & Trust</span>
          <h3>Registered, accountable, and data-aware</h3>
          <p>{company.name} is registered with Companies House and registered with the ICO for data protection. We handle candidate, client, and recruitment information with care, confidentiality, and clear operational controls.</p>
        </div>
        <ComplianceBadges />
      </article>
      <article className="card" style={{ marginTop: 24 }}><h3>UK healthcare recruitment focus</h3><p>We understand the operational pressures facing care homes, including continuity of care, right-to-work checks, rota gaps, candidate screening, and the need for responsive staffing support.</p></article>
    </section>
  );
}
