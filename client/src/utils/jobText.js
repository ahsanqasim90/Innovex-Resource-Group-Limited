const sectionHeadings = [
  "Key Responsibilities",
  "Responsibilities",
  "Requirements",
  "Benefits",
  "What we offer",
  "About the role",
  "Role overview",
  "Experience",
  "Apply"
];

export function cleanJobText(text = "") {
  return text
    .replace(/Â£/g, "£")
    .replace(/\s+/g, " ")
    .trim();
}

export function previewJobText(text = "", maxLength = 230) {
  const cleaned = cleanJobText(text)
    .replace(/\s*•\s*/g, " ")
    .replace(/\s*-\s*/g, " ");

  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).trim()}...`;
}

export function formatJobText(text = "") {
  const withSections = sectionHeadings.reduce((value, heading) => {
    const pattern = new RegExp(`\\s+(${heading})\\s*:`, "gi");
    return value.replace(pattern, "\n$1:");
  }, text.replace(/Â£/g, "£"));

  const normalized = withSections
    .replace(/\r/g, "")
    .replace(/\s*•\s*/g, "\n• ")
    .replace(/\n{2,}/g, "\n")
    .trim();

  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const blocks = [];
  let currentList = null;

  function closeList() {
    if (currentList?.items.length) blocks.push(currentList);
    currentList = null;
  }

  lines.forEach((line) => {
    const headingMatch = line.match(/^([A-Za-z ]{3,40}):\s*(.*)$/);
    if (headingMatch && sectionHeadings.some((heading) => heading.toLowerCase() === headingMatch[1].toLowerCase())) {
      closeList();
      blocks.push({ type: "heading", text: headingMatch[1] });
      if (headingMatch[2]) blocks.push({ type: "paragraph", text: cleanJobText(headingMatch[2]) });
      return;
    }

    if (line.startsWith("•")) {
      if (!currentList) currentList = { type: "list", items: [] };
      currentList.items.push(cleanJobText(line.slice(1)));
      return;
    }

    closeList();
    blocks.push({ type: "paragraph", text: cleanJobText(line) });
  });

  closeList();
  return blocks;
}
