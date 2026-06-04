import { useEffect } from "react";
import { company, contact } from "../data/content.js";

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
}

function upsertLink(rel, href) {
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

function upsertJsonLd(id, data) {
  let element = document.getElementById(id);
  if (!element) {
    element = document.createElement("script");
    element.type = "application/ld+json";
    element.id = id;
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(data);
}

export default function SEO({ title, description, path, noIndex = false, jsonLd }) {
  useEffect(() => {
    const pageTitle = `${title} | ${company.name}`;
    const canonicalPath = path || window.location.pathname;
    const canonical = `${company.siteUrl}${canonicalPath === "/" ? "/" : canonicalPath}`;

    document.title = pageTitle;
    upsertMeta('meta[name="description"]', { name: "description", content: description });
    upsertMeta('meta[name="robots"]', { name: "robots", content: noIndex ? "noindex, nofollow" : "index, follow" });
    upsertLink("canonical", canonical);

    upsertMeta('meta[property="og:title"]', { property: "og:title", content: pageTitle });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: `${company.siteUrl}/Logo.png` });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: pageTitle });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });

    upsertJsonLd("innovex-organization-schema", {
      "@context": "https://schema.org",
      "@type": ["Organization", "LocalBusiness", "EmploymentAgency"],
      name: company.name,
      url: company.siteUrl,
      logo: `${company.siteUrl}/Logo.png`,
      email: contact.email,
      telephone: contact.phoneDisplay,
      address: {
        "@type": "PostalAddress",
        streetAddress: "33 Forsythia Drive",
        addressLocality: "Cardiff",
        postalCode: "CF23 7HP",
        addressCountry: "GB"
      },
      sameAs: [contact.socials.instagram, contact.socials.facebook, contact.socials.twitter],
      areaServed: "United Kingdom",
      description
    });

    upsertJsonLd("innovex-website-schema", {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: company.name,
      url: company.siteUrl,
      potentialAction: {
        "@type": "SearchAction",
        target: `${company.siteUrl}/jobs?search={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    });

    const articleElement = document.getElementById("innovex-page-schema");
    if (jsonLd) {
      upsertJsonLd("innovex-page-schema", jsonLd);
    } else if (articleElement) {
      articleElement.remove();
    }
  }, [title, description, path, noIndex, jsonLd]);

  return null;
}
