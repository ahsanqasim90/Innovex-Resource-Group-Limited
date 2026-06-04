function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return part;
  });
}

export default function BlogContent({ content = "" }) {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="blog-content">
      {blocks.map((block, index) => {
        if (block.startsWith("### ")) return <h3 key={index}>{block.slice(4)}</h3>;
        if (block.startsWith("## ")) return <h2 key={index}>{block.slice(3)}</h2>;
        if (block.startsWith("# ")) return <h2 key={index}>{block.slice(2)}</h2>;
        if (block.startsWith("- ")) {
          return (
            <ul key={index}>
              {block.split("\n").map((item) => <li key={item}>{renderInline(item.replace(/^- /, ""))}</li>)}
            </ul>
          );
        }
        return <p key={index}>{renderInline(block)}</p>;
      })}
    </div>
  );
}
