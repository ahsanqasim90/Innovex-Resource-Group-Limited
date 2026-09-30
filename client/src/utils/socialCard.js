// Draws the branded job image (1080x1350, 4:5) in the browser and returns a JPEG blob.
// The client / care home name is never drawn: only role, area, pay and terms.

function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function wrapLines(context, text, maxWidth, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (context.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\s+\S*$/, "")}...`;
    return kept;
  }
  return lines;
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

export async function renderJobCard(job) {
  const width = 1080;
  const height = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const font = '"Segoe UI", Inter, Arial, sans-serif';

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#083b46");
  gradient.addColorStop(1, "#0f7a8a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(255,255,255,0.06)";
  context.beginPath(); context.arc(width - 120, 180, 320, 0, Math.PI * 2); context.fill();
  context.beginPath(); context.arc(80, height - 260, 220, 0, Math.PI * 2); context.fill();

  const logo = await loadImage("/Logo.png");
  context.fillStyle = "#ffffff";
  roundedRect(context, 80, 80, 150, 150, 32); context.fill();
  if (logo) {
    const scale = Math.min(118 / logo.width, 118 / logo.height);
    context.drawImage(logo, 80 + (150 - logo.width * scale) / 2, 80 + (150 - logo.height * scale) / 2, logo.width * scale, logo.height * scale);
  }
  context.fillStyle = "#ffffff";
  context.font = `700 34px ${font}`;
  context.fillText("Innovex Resource Group", 262, 142);
  context.fillStyle = "rgba(255,255,255,0.75)";
  context.font = `500 28px ${font}`;
  context.fillText("Recruitment | Training | Digital", 262, 188);

  context.fillStyle = "#ffc23d";
  roundedRect(context, 80, 320, 300, 70, 35); context.fill();
  context.fillStyle = "#3a2600";
  context.font = `800 34px ${font}`;
  context.fillText("WE'RE HIRING", 112, 367);

  context.fillStyle = "#ffffff";
  context.font = `800 84px ${font}`;
  const titleLines = wrapLines(context, job.title, width - 160, 3);
  titleLines.forEach((line, index) => context.fillText(line, 80, 500 + index * 100));

  const details = [
    ["LOCATION", [job.location, job.postcode && !String(job.location || "").includes(job.postcode) ? job.postcode : ""].filter(Boolean).join(" ")],
    ["SALARY", job.salary],
    ["TERMS", [job.type, job.shift].filter(Boolean).join("  |  ")]
  ].filter(([, value]) => value);
  let y = 500 + titleLines.length * 100 + 60;
  for (const [label, value] of details) {
    context.fillStyle = "rgba(255,255,255,0.65)";
    context.font = `700 26px ${font}`;
    context.fillText(label, 80, y);
    context.fillStyle = "#ffffff";
    context.font = `600 42px ${font}`;
    const lines = wrapLines(context, value, width - 160, 2);
    lines.forEach((line, index) => context.fillText(line, 80, y + 52 + index * 50));
    y += 52 + lines.length * 50 + 44;
  }

  context.fillStyle = "#ffffff";
  roundedRect(context, 80, height - 230, width - 160, 130, 28); context.fill();
  context.fillStyle = "#083b46";
  context.font = `700 30px ${font}`;
  context.fillText("Apply now", 116, height - 172);
  context.font = `800 44px ${font}`;
  context.fillText("innovexresourcegroup.co.uk/jobs", 116, height - 122);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The image could not be created."))), "image/jpeg", 0.9));
}
