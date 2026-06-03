export default function SectionHeading({ eyebrow, title, children }) {
  return (
    <div className="section-heading">
      {eyebrow && <span>{eyebrow}</span>}
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
