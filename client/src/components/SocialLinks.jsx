import { Facebook, Linkedin } from "lucide-react";
import { contact } from "../data/content.js";

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm0 2A3.8 3.8 0 0 0 4 7.8v8.4A3.8 3.8 0 0 0 7.8 20h8.4a3.8 3.8 0 0 0 3.8-3.8V7.8A3.8 3.8 0 0 0 16.2 4H7.8Zm8.95 2.05a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4ZM12 7.25A4.75 4.75 0 1 1 12 16.75 4.75 4.75 0 0 1 12 7.25Zm0 2A2.75 2.75 0 1 0 12 14.75 2.75 2.75 0 0 0 12 9.25Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M13.9 10.4 21.4 2h-1.8l-6.5 7.3L7.2 2H1.2l7.9 10.1L1.2 22h1.8l6.9-7.8 6.4 7.8h6L13.9 10.4Zm-2.4 2.7-.8-1.1L4.3 3.3h2.4l5.8 7.8.8 1.1 6.7 9h-2.4l-6.1-8.1Z" />
    </svg>
  );
}

const socials = [
  ["Instagram", contact.socials.instagram, InstagramIcon],
  ["Facebook", contact.socials.facebook, Facebook],
  ["LinkedIn", contact.socials.linkedin, Linkedin],
  ["X / Twitter", contact.socials.twitter, XIcon]
];

export default function SocialLinks() {
  return (
    <div className="social-links">
      {socials.map(([label, href, Icon]) => (
        <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} title={label}>
          <Icon size={20} />
        </a>
      ))}
    </div>
  );
}
