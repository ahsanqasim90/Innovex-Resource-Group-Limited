function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return part;
  });
}

function normaliseContent(content) {
  return String(content || "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+(#{2,3}\s+)/g, "\n\n$1")
    .replace(/\s+(-\s+)/g, "\n$1")
    .replace(/\s+(\d+\.\s+)/g, "\n$1")
    .trim();
}

function pushParagraph(blocks, paragraph) {
  const text = paragraph.join(" ").replace(/\s+/g, " ").trim();
  if (text) blocks.push({ type: "paragraph", text });
}

function pushList(blocks, list) {
  if (list.length) blocks.push({ type: "list", items: [...list] });
}

function parseBlocks(content) {
  const lines = normaliseContent(content).split("\n");
  const blocks = [];
  let paragraph = [];
  let list = [];

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      pushParagraph(blocks, paragraph);
      pushList(blocks, list);
      paragraph = [];
      list = [];
      return;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      pushParagraph(blocks, paragraph);
      pushList(blocks, list);
      paragraph = [];
      list = [];
      blocks.push({ type: heading[1].length === 3 ? "h3" : "h2", text: heading[2].trim() });
      return;
    }

    const bullet = line.match(/^[-•]\s+(.+)$/);
    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (bullet || numbered) {
      pushParagraph(blocks, paragraph);
      paragraph = [];
      list.push((bullet || numbered)[1].trim());
      return;
    }

    if (list.length) {
      pushList(blocks, list);
      list = [];
    }
    paragraph.push(line);
  });

  pushParagraph(blocks, paragraph);
  pushList(blocks, list);
  return blocks;
}

export default function BlogContent({ content = "" }) {
  const blocks = parseBlocks(content);

  return (
    <div className="blog-content">
      {blocks.map((block, index) => {
        if (block.type === "h2") return <h2 key={index}>{block.text}</h2>;
        if (block.type === "h3") return <h3 key={index}>{block.text}</h3>;
        if (block.type === "list") {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{renderInline(item)}</li>)}
            </ul>
          );
        }
        return <p key={index}>{renderInline(block.text)}</p>;
      })}
    </div>
  );
}
