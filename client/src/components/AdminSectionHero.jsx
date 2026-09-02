export default function AdminSectionHero({ icon: Icon, eyebrow = "Workspace module", title, description, aside, children }) {
  return (
    <section className="workspace-section-hero">
      <div className="workspace-section-heading">
        <span className="workspace-section-icon">{Icon && <Icon size={25} />}</span>
        <div><span className="workspace-section-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      </div>
      {(aside || children) && <div className="workspace-section-aside">{aside}{children}</div>}
    </section>
  );
}
