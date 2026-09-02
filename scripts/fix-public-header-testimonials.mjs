import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const srcRoot = path.join(root, "client", "src");

if (!fs.existsSync(srcRoot)) {
  throw new Error("client/src was not found");
}

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });

const sourceFiles = walk(srcRoot).filter((file) => /\.(jsx?|tsx?)$/i.test(file));

const addClass = (openingTag, className) => {
  if (openingTag.includes(className)) return openingTag;
  if (/className\s*=\s*"[^"]*"/.test(openingTag)) {
    return openingTag.replace(
      /className\s*=\s*"([^"]*)"/,
      (_match, classes) => `className="${classes} ${className}".trim()`,
    );
  }
  if (/className\s*=\s*'[^']*'/.test(openingTag)) {
    return openingTag.replace(
      /className\s*=\s*'([^']*)'/,
      (_match, classes) => `className="${classes} ${className}".trim()`,
    );
  }
  return openingTag.replace(/>$/, ` className="${className}">`);
};

for (const file of sourceFiles) {
  let source = fs.readFileSync(file, "utf8");
  const original = source;

  if (
    source.includes("Innovex Resource Group Limited") &&
    source.includes("/upload-cv") &&
    /<header\b/.test(source)
  ) {
    source = source.replace(/<header\b[^>]*>/, (tag) =>
      addClass(tag, "innovex-public-header"),
    );
    source = source.replace(/<nav\b[^>]*>/, (tag) =>
      addClass(tag, "innovex-public-nav"),
    );
    source = source.replace(
      /(<(?:span|strong|div|p)\b[^>]*>)\s*Innovex Resource Group Limited\s*(<\/(?:span|strong|div|p)>)/,
      (_match, start, end) =>
        `${addClass(start, "innovex-public-brand-name")}Innovex Resource Group Limited${end}`,
    );
  }

  const reviewExpressions = [
    "testimonial.review",
    "testimonial.message",
    "testimonial.content",
    "testimonial.text",
    "item.review",
    "item.message",
    "item.content",
    "item.text",
    "review.review",
    "review.message",
    "review.content",
    "review.text",
  ];

  for (const expression of reviewExpressions) {
    const escaped = expression.replace(".", "\\.");
    const paragraphPattern = new RegExp(
      `<p\\b([^>]*)>\\s*\\{${escaped}\\}\\s*<\\/p>`,
      "g",
    );
    source = source.replace(paragraphPattern, (_match, attrs) => {
      const opening = addClass(`<p${attrs}>`, "testimonial-review-copy");
      return `${opening}{${expression}}</p>`;
    });
  }

  if (source !== original) {
    fs.writeFileSync(file, source, "utf8");
  }
}

const cssCandidates = [
  path.join(srcRoot, "index.css"),
  path.join(srcRoot, "styles.css"),
  path.join(srcRoot, "App.css"),
];
const cssFile = cssCandidates.find((file) => fs.existsSync(file));

if (!cssFile) {
  throw new Error("No global client stylesheet was found");
}

const markerStart = "/* codex: compact public header and testimonials */";
const markerEnd = "/* codex: end compact public header and testimonials */";
const cssBlock = `${markerStart}
.innovex-public-header {
  min-height: 74px;
}

.innovex-public-header .innovex-public-brand-name {
  display: inline-block;
  max-width: none;
  white-space: nowrap;
  font-size: clamp(0.88rem, 1.1vw, 1rem);
  line-height: 1.15;
  letter-spacing: -0.01em;
}

.innovex-public-header .innovex-public-nav {
  gap: clamp(0.75rem, 1.25vw, 1.25rem);
}

.innovex-public-header .innovex-public-nav a {
  font-size: clamp(0.78rem, 0.95vw, 0.91rem);
  line-height: 1.2;
  white-space: nowrap;
}

.innovex-public-header .innovex-public-nav .button,
.innovex-public-header .innovex-public-nav button,
.innovex-public-header .innovex-public-nav a[class*="btn"] {
  min-height: 40px;
  padding: 0.68rem 1rem;
}

.testimonial-review-copy {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 8;
  line-clamp: 8;
  max-height: 12.4em;
  line-height: 1.55;
}

[class*="testimonial-card"],
[class*="testimonialCard"] {
  height: 390px;
  min-height: 390px;
  max-height: 390px;
  overflow: hidden;
}

[class*="testimonial-card"] .testimonial-review-copy,
[class*="testimonialCard"] .testimonial-review-copy {
  margin-block: auto;
}

@media (max-width: 1120px) {
  .innovex-public-header .innovex-public-brand-name {
    white-space: normal;
    max-width: 150px;
  }

  .innovex-public-header .innovex-public-nav {
    gap: 0.62rem;
  }

  .innovex-public-header .innovex-public-nav a {
    font-size: 0.76rem;
  }
}

@media (max-width: 820px) {
  .innovex-public-header {
    min-height: 66px;
  }

  .innovex-public-header .innovex-public-brand-name {
    max-width: 190px;
    font-size: 0.86rem;
  }

  [class*="testimonial-card"],
  [class*="testimonialCard"] {
    height: 350px;
    min-height: 350px;
    max-height: 350px;
  }
}
${markerEnd}`;

let css = fs.readFileSync(cssFile, "utf8");
const oldBlockPattern = new RegExp(
  `${markerStart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${markerEnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
);
css = oldBlockPattern.test(css)
  ? css.replace(oldBlockPattern, cssBlock)
  : `${css.trimEnd()}\n\n${cssBlock}\n`;
fs.writeFileSync(cssFile, css, "utf8");
