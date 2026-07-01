export default function SectionHeading({ eyebrow, title, children, as: Heading = "h2" }) {
  return (
    <div className="section-heading">
      {eyebrow && <span>{eyebrow}</span>}
      <Heading>{title}</Heading>
      {children && <p>{children}</p>}
    </div>
  );
}
