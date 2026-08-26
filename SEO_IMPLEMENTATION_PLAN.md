# Innovex Resource Group SEO Implementation Plan

Plan date: 26 August 2026
Principle: preserve working functionality and branding; implement only evidence-backed, additive or low-risk changes. No fabricated claims, reviews, projects, course facts, locations or outcomes.

## P0 — Critical

### P0.1 Remove unsupported public claims

- Replace homepage `24/7` and `128+ placements` claims with factual division/service labels.
- Replace hard-coded course totals, certificate coverage and nationwide-delivery claims with actual API-derived values or neutral enquiry wording.
- Record all unsupported proof needs in `BUSINESS_INPUT_REQUIRED.md`.

Success check: repository search finds no unsupported hard-coded claims; displayed course totals/certificate counts reflect loaded records.

### P0.2 Add a real frontend 404

- Add a catch-all public route with a clear H1, useful navigation and `noindex, nofollow` metadata.
- Preserve API 404 behavior.

Success check: an unknown client route renders the 404 component and does not inherit indexable metadata.

### P0.3 Correct structured-data accuracy

- Remove the misleading jobs-only `SearchAction` from the global `WebSite` schema.
- Keep only data that matches visible content.

Success check: JSON-LD parses and contains no fake ratings/offers/search function.

### P0.4 Preserve current work and URLs

- Do not rewrite the application or alter existing public URL paths.
- Work around pre-existing uncommitted admin/HR/finance changes.
- New URLs are additive; old `/jobs?job=` links remain functional.

## P1 — High priority

### P1.1 Employer recruitment funnel

- Add `/hire-staff` with employer-focused copy, roles supplied, actual high-level process, cautious compliance wording, FAQs and a concise vacancy brief form.
- Reuse the existing contact route/email pipeline; encode vacancy details into the stored message rather than adding a duplicate lead system.
- Link the homepage, header/footer and recruitment landing page to the new funnel.
- Add `Service`, `FAQPage` and `BreadcrumbList` data matching visible copy.

Success check: valid submission reaches `/api/contact`; required fields are labelled; success/error feedback is visible; no candidate-first wording dominates the page.

### P1.2 Clear three-division information architecture

- Present Recruitment, Digital Services (website development + SEO) and Courses & Training as the three core homepage journeys.
- Refine public navigation so commercial clusters are directly accessible.
- Keep jobs and CVs as a candidate journey without making it the primary employer CTA.

Success check: the three divisions and their next actions are understandable in the first homepage sections and header/footer.

### P1.3 Vacancy search visibility

- Add `/jobs/:id` as a dedicated canonical detail route while retaining query-string compatibility.
- Give a selected vacancy a unique title, meta description, breadcrumb and `JobPosting` schema using only stored fields.
- Exclude inactive or closing-date-expired jobs from public detail responses and sitemap entries.
- Add active job detail URLs to the dynamic sitemap.
- Point job cards and application paths to the clean route.

Success check: active jobs render at a unique URL with schema; inactive/expired jobs are not returned publicly; `/jobs` remains the list canonical.

### P1.4 Courses funnel integrity and accessibility

- Use real API counts for courses/categories/certificate-included records.
- Keep public pricing described as quotation-based because delivery details are not fully verified.
- Add persistent labels and names to enquiry controls; keep only fields the backend actually needs mandatory.
- Track enquiry start/submission without personal data when analytics is configured.

Success check: statistics match loaded course data and the existing booking endpoint still receives the expected payload.

### P1.5 Digital and SEO commercial pages

- Strengthen the existing website page around verified responsive React/MERN/custom web application capability without spawning thin subpages.
- Position digital delivery for international businesses per the commercial brief, while keeping recruitment geography UK-specific.
- Route quote/audit CTAs to purpose-prefilled contact journeys.
- Add cross-links to SEO, website development and contact while keeping pages topically focused.

Success check: pages accurately describe service, audience, process, genuine technology capability, FAQs and one primary conversion.

### P1.6 Metadata, sitemap and internal links

- Update homepage title/description for Recruitment, Digital Services and Training.
- Add new static URLs to both sitemap implementations.
- Keep canonical host/path consistent and avoid query-parameter canonicals.
- Add contextual links from clusters to their relevant conversion pages.

### P1.7 Analytics and verification support

- Add an environment-driven GA4 loader that activates only when `VITE_GA_MEASUREMENT_ID` is configured.
- Add event helpers for employer enquiry, general contact, course enquiry, job application/CV and phone/email/WhatsApp clicks.
- Never send names, email addresses, phone numbers, free-text messages or CV details to analytics.
- Support Google and Bing site-verification tokens through environment variables without hard-coding credentials.

Success check: no analytics script is inserted without configuration; configured events contain only categorical context.

### P1.8 Accessibility and performance safeguards

- Add a skip link and stable `main` target.
- Add labels to priority public forms and preserve keyboard-visible focus.
- Keep existing image dimensions/lazy loading and route-level code splitting.
- Avoid adding heavy dependencies.

## P2 — Growth

- Expand recruitment service pages only after distinct role/process/compliance content is approved: care home, children's residential, nursing and management recruitment.
- Add portfolio/case-study architecture after at least two approved projects include problem, solution, technology, screenshots, permission and outcomes.
- Expand digital pages for MERN, React, custom applications, redesign and ecommerce only when delivery scope and proof are supplied.
- Expand SEO pages for technical, local, on-page and sector SEO only where service process and proof are sufficiently distinct.
- Extend the course model/page template with audience, learning outcomes, modules, delivery, requirements, certification/accreditation, pricing and availability fields; publish individual URLs only when complete.
- Audit/export existing database blog records for intent, quality, freshness, internal links and cannibalisation before publishing new content.
- Split public/admin CSS and lazy-load the chatbot after measurement shows this is worthwhile.
- Add an image-transformation/storage pipeline for responsive WebP/AVIF variants if supported by hosting.
- Consider prerendering or SSR for priority public pages after measuring crawl/rendering performance and migration risk.

## P3 — Future / business input

- Verified company registration/ICO identifiers and preferred public evidence links.
- Team biographies, headshots and recruitment/digital/training experience.
- Recruitment process, screening checks, Right to Work procedure, fee model, service terms and real coverage detail.
- Approved placement/client metrics, testimonials and case studies.
- Digital portfolio project briefs, screenshots, permissions, technology and verified outcomes.
- Course accreditation, awarding bodies, learning outcomes, modules, delivery methods, entry requirements, prices and dates.
- Privacy, cookie, accessibility, complaints and recruitment policies approved by the business/legal owner.
- GA4 measurement ID, Search Console and Bing verification tokens; consent requirements and analytics ownership.
- Google Business Profile access and verified NAP/opening-hour agreement.
- Search Console/GA4 baseline data and revenue attribution definitions.
- Genuine outreach, directories, partnerships, digital PR and backlink acquisition.

## Implementation sequence

1. Correct public content integrity and schema accuracy.
2. Add 404, analytics foundations and accessibility shell improvements.
3. Add `/hire-staff` using the existing lead pipeline.
4. Clarify homepage/header/footer commercial architecture.
5. Implement job detail routes/schema/sitemap policy.
6. Correct and label the course funnel.
7. Strengthen existing recruitment/digital/SEO landing pages and internal links.
8. Update static/dynamic sitemaps and metadata.
9. Produce content/off-site/business-input/report documents.
10. Run production build, server import checks and focused source/route/schema/form verification.

## Validation plan

- Production build using the repository script.
- Server module import/syntax check with explicit process exit.
- Source assertions for all public routes, metadata paths, sitemap entries and absence of unsupported claims.
- Rendered local-browser checks if the database-backed app can start with available environment configuration.
- Form payload review for contact, hire-staff, training, applications and CVs.
- JSON-LD source validation against visible fields; external rich-results validation remains a deployment step.
- Mobile CSS review at existing 1,180/900/760/620/520 px breakpoints.
- Git diff review to ensure pre-existing unrelated work is preserved.
