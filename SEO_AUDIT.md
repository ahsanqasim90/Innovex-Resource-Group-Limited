# Innovex Resource Group SEO & Conversion Audit

Audit date: 26 August 2026
Scope: repository-level audit of the React/Vite frontend, Express/MongoDB API, public routes, admin routes, SEO implementation, forms, security controls, content integrity, performance risks and accessibility. This audit does not claim live Google Search Console, GA4, backlink, field Core Web Vitals or live-server data that is not present in the repository.

## Executive summary

Innovex already has a functional MERN website, a consistent visual system, public recruitment/digital/training content, live-data jobs/courses/blogs, enquiry workflows and a large authenticated admin application. It should be improved in place rather than rebuilt.

The strongest existing foundations are reusable React components, unique page-level metadata, canonical tags, XML sitemaps, robots controls, lazy-loaded routes, responsive CSS, structured data on service/blog pages, public forms backed by MongoDB, role/permission checks, upload type/size limits and a deployment-level www redirect.

The most important verified problems are:

1. Unsupported commercial claims are rendered publicly: `24/7`, `128+ Placements`, `50+ Courses`, `All Include certificate` and `Nationwide delivery`. These conflict with the content-integrity requirement and must be removed or driven from verified data.
2. There is no public catch-all route. An unknown SPA URL renders an empty page instead of a useful, noindex 404 experience.
3. Employers do not have a dedicated `/hire-staff` conversion journey. Recruitment currently routes through a generic contact form.
4. Vacancies use query-string detail views (`/jobs?job=<id>`) rather than indexable detail routes, have no `JobPosting` schema, and are absent from the dynamic sitemap.
5. The navigation and homepage describe four services while the commercial brief requires three understandable divisions. SEO should sit within Digital Services, not appear as a fourth company division.
6. Analytics and conversion events are not implemented in the client repository. Verification tokens are also hard-coded manually or absent rather than supported through deployment configuration.
7. The SPA relies on client-side JavaScript for route metadata and content. Google can render it, but server-rendered/static HTML would be a future resilience improvement. A blind framework migration is not justified for this implementation.
8. Several public forms use placeholders instead of persistent labels. This is an accessibility and usability weakness.
9. The `WebSite` structured data advertises a site search action that actually searches jobs only; this does not accurately describe a general site-search feature.
10. There are no dedicated portfolio/case-study pages or verified case-study assets/results in the repository. They must not be fabricated.

## Architecture

### Frontend

- React 19 with React Router 7 and Vite 6.
- Client-rendered single-page application using `BrowserRouter`.
- Public routes are nested under `AppLayout`; admin routes use a separate authenticated `AdminLayout`.
- Public route modules except the homepage are lazy loaded. Admin modules are lazy loaded.
- Shared components include `SEO`, `Header`, `Footer`, `Chatbot`, cards, form feedback, file upload and content renderers.
- One global stylesheet provides the design system and responsive breakpoints. Existing Innovex teal/blue/pink branding is coherent and reusable.
- API requests use a central client with an optional `VITE_API_URL` and bearer-token support.

### Backend

- Node.js/Express 4 REST API backed by Mongoose/MongoDB.
- Vercel serverless entry points reuse the Express app and database connection.
- Models cover jobs, applications, CVs, courses, training bookings/quotations, blogs, testimonials, partners, contact messages, CRM, interviews, email and finance/HR operations.
- Public form routes create MongoDB records; contact and training enquiries can send email through the existing email service.
- Admin access uses JWT authentication plus permission checks.
- Helmet, CORS, JSON body limits, global rate limiting, Mongoose validation and multer upload controls are already present.

### Rendering and deployment

- SPA fallback is configured in Vercel and Netlify-style `_redirects`.
- The apex domain permanently redirects to `www` in `vercel.json`.
- Immutable caching is configured for hashed assets.
- Public route content and metadata are JavaScript-rendered. `client/index.html` supplies only homepage defaults before hydration.

## Current public URLs

| URL | Purpose | Current state |
| --- | --- | --- |
| `/` | Homepage / business overview | Exists; needs three-division clarity and removal of unverified claims |
| `/about` | Company/trust overview | Exists; team and verification evidence require business input |
| `/services` | Recruitment and digital service hub | Exists; useful but mixes clusters |
| `/healthcare-recruitment` | Employer recruitment landing page | Exists; needs stronger employer CTA and funnel |
| `/website-development` | Website service landing page | Exists; needs international positioning and proof |
| `/seo-services` | SEO service landing page | Exists; useful general page, no verified results/case studies |
| `/courses` | Dynamic course hub and training enquiry | Exists; functional; hard-coded claims and label issues need correction |
| `/jobs` | Dynamic vacancy list, detail query and application | Exists; detail SEO/schema architecture needs improvement |
| `/blogs` | Dynamic article hub | Exists |
| `/blogs/:slug` | Dynamic article detail | Exists with article and breadcrumb schema |
| `/testimonials` | Approved reviews and review submission | Exists; no fabricated aggregate review schema |
| `/partners` | Approved partner profiles | Exists |
| `/contact` | General enquiry | Exists and sends to backend |
| `/upload-cv` | Candidate CV submission | Exists |
| `/admin/*` | Authenticated business application | Exists and is blocked in robots; should remain noindex |

No public portfolio, case-study, employer hire-staff, course-detail or dedicated recruitment-role/location URLs currently exist.

## API and data-backed functionality

- Jobs: public active-job list/detail and application upload; admin CRUD.
- Courses: public active-course list; public training-enquiry creation; admin course/booking/quotation operations.
- Blogs: published list and slug detail; admin CRUD and featured images.
- Testimonials and partners: public approved/active data; admin moderation.
- Contact and chatbot: public lead creation and email notification using the existing contact model.
- Uploads: CVs restricted to PDF/DOC/DOCX at 5 MB; images have type/size allowlists.
- Admin: JWT, active-user validation and module permissions. Some large admin route modules were not changed as part of public SEO work.

## Technical SEO findings

### Implemented correctly (A)

- One reusable metadata component controls title, description, canonical, robots, Open Graph and Twitter tags.
- Important static pages pass explicit canonical paths and unique metadata.
- Homepage defaults exist in `index.html` for non-rendered fallbacks.
- `robots.txt` allows public crawling, blocks `/admin/`, and references the dynamic sitemap.
- Static and database-backed XML sitemap implementations exist.
- Apex-to-www canonical host redirect is permanent.
- Service pages have visible FAQ content matching their FAQ schema.
- Service, breadcrumb, blog/article and organisation schemas exist without review/rating fabrication.
- Published blog URLs are included in the dynamic sitemap.
- Hashed frontend assets receive long-lived immutable caching.
- SPA history fallback preserves client routes on direct visits.

### Exists but needs improvement (B)

- Titles/descriptions are generally unique, but homepage and cluster naming do not yet reflect the three-division commercial model.
- `Organization` schema is reused globally; service-specific geographic scope should be described on the relevant `Service`, not implied globally.
- The `WebSite` schema contains an inaccurate jobs-only `SearchAction`.
- The dynamic sitemap excludes active jobs and lacks the planned employer route.
- Static `sitemap.xml` can drift from the API sitemap and must be updated with new static routes.
- Jobs have useful content but no dedicated canonical URL or `JobPosting` schema.
- Unknown frontend routes have no 404 experience.
- The SPA is crawlable after rendering, but there is no SSR/prerender pipeline.
- Page schema scripts are updated client-side; route transitions remove only the optional page schema, which is acceptable but should be kept deliberate.
- Images generally use alt text and some dimensions, but dynamic blog images do not have explicit dimensions and the same icon is used as the social image for every page.
- Internal links exist but commercial CTAs frequently route to a generic contact form rather than a funnel-specific page.
- Blog CTAs are generic rather than category/service-aware.
- Course search and job filters work client-side/API-side, but search result URLs are not designed as indexable landing pages (correctly avoiding doorway pages).

### Missing and should be implemented (C)

- Dedicated `/hire-staff` employer landing page and enquiry form.
- Dedicated indexable job detail routes and active-job sitemap entries.
- Valid visible-content-matched `JobPosting` and breadcrumb data on vacancy detail pages.
- A noindex 404 route.
- Optional GA4 loading and conversion event helpers driven by environment variables, with no personal data sent.
- Environment-driven Google/Bing site-verification meta support.
- Persistent accessible labels on priority public forms.
- Explicit three-division navigation and homepage journey.

### Not appropriate now (D)

- Hundreds of city/role landing pages: there is not enough distinct verified content and they would risk doorway-page quality.
- Dozens of thin SEO/development/course pages: repository content does not support them yet.
- Review/rating schema: no basis for claiming eligibility or aggregating ratings for rich results.
- Course offers, accreditation, prices, dates or ratings in schema: these are not consistently verified in the public data model.
- Automatic redirects from expired jobs to the homepage: this would be misleading.
- A wholesale Next.js/SSR migration during this task: risk is disproportionate to safe P0/P1 improvements.
- Fabricated portfolio projects or results: prohibited and unsupported by repository evidence.

## Content and information architecture

### Recruitment

The existing content supports a main UK healthcare recruitment page and identifies care homes, nursing homes, children's residential services, supported living and several role types. The intended employer audience is present, but the homepage still gives “Browse Jobs” first position and lacks a dedicated vacancy brief form. The main page includes process, roles/audiences and FAQs, but should make the employer journey and CTA clearer.

There is not enough distinct repository evidence to justify separate care-home, nursing, children's-home and management pages without business input. These remain P2/P3 after content validation.

### Digital services

Website development and SEO pages exist and describe genuine design, content, responsive development, technical SEO, local SEO and lead-generation capabilities. The live codebase itself verifies React/MERN implementation capability, but there are no approved client projects, screenshots, case-study results, prices or delivery geography evidence beyond the user-provided worldwide objective. The main digital pages can be strengthened, but dedicated technology pages should wait for proof and fuller content.

### Courses and training

The course hub is connected to a real `Course` model and active-course API. It supports course selection and a B2B enquiry recorded as a `TrainingBooking`, with email notification. The data model verifies title, category, description, duration, certificate-included flag and internal default prices/costs. It does not verify accreditation, awarding body, modules, learning outcomes, delivery method, entry requirements, public price, dates or individual enrolment.

The public page currently overstates counts/certification/delivery through hard-coded stats. It should use actual active course data and describe an enquiry/quotation journey, not “Enrol Now”. Individual course pages would be thin with the current model.

### Blogs

Blog list/detail, slug, publishing state, metadata fields, author, featured image, article schema and admin editing exist. Content quality/cannibalisation cannot be fully assessed without live database records or Search Console query data. Existing articles should be exported and evaluated before bulk publication.

### Portfolio/case studies

No approved public project dataset or route exists. A public empty portfolio page would add little value. The owner should provide verified project briefs, screenshots, technology, permissions and outcomes before publication.

## Conversion audit

Existing conversion mechanisms:

- Generic contact form with enquiry-type routing.
- Chatbot flows for candidates, staffing, websites, SEO, training and general enquiries.
- Course selection and training quotation enquiry.
- Job application with optional CV.
- Standalone CV upload.
- Testimonial submission.
- Phone, email, social and WhatsApp links.

Weaknesses:

- No employer-specific landing page/form at `/hire-staff`.
- Homepage employer CTA does not go directly to an employer brief.
- Digital and SEO enquiries rely on query parameters to prefill the generic contact form.
- No event tracking is present for successful forms or contact clicks.
- Some forms depend on placeholder-only field identification.
- There is no privacy microcopy/link adjacent to data collection and no public policy routes in the repository.

## Performance audit

Verified positives:

- Route-level lazy loading for most public and all admin pages.
- Vite production bundling, CSS splitting and immutable caching for hashed assets.
- Below-fold logo/partner images generally lazy-load.
- Width/height are set on logo and hero assets, reducing layout shift.
- The production build succeeds.

Risks/limitations:

- Baseline production output includes an approximately 303 kB uncompressed main JS bundle and 200 kB uncompressed global CSS (about 95 kB and 35 kB gzip respectively).
- The global stylesheet contains extensive public and admin CSS in one bundle.
- The homepage performs four API calls after mount, so live-data sections are delayed and server response affects perceived completion.
- The chatbot is included in the main public bundle instead of being lazy-loaded after interaction.
- No repository test measures real LCP, INP or CLS. Field data and a live Lighthouse run are required before claiming Core Web Vitals thresholds.
- Dynamic image variants/compression are not implemented for uploaded blog/partner images.

## Accessibility audit

Implemented correctly:

- Semantic `header`, `nav`, `main`, `section`, `article`, headings and buttons are widely used.
- Mobile navigation has an accessible name, `aria-controls` and `aria-expanded`.
- Decorative icons are generally paired with visible text.
- Logo images have meaningful alt text and dimensions.
- Form submission status is centralised.

Needs improvement:

- Multiple contact, course, job and CV form controls use placeholders without persistent labels.
- No skip-to-content link is present.
- Focus-visible coverage is inconsistent; many controls rely on browser defaults or generic focus rules.
- Mobile menu focus containment/escape handling is not implemented.
- Dynamic route loading messages do not explicitly announce status.
- Automated and manual keyboard/contrast testing are not configured.

## Security audit (affected public functionality)

Implemented correctly:

- Helmet, restricted CORS, 1 MB JSON limit and global rate limiting.
- JWT verification and active-user/permission enforcement for admin routes.
- Upload file-size and MIME allowlists.
- React escapes ordinary text output and email helpers include HTML escaping.
- Server secrets are read from environment variables, not frontend source.

Needs improvement or verification:

- Public contact/testimonial/training/CV/application routes rely mainly on the global 300-request limit; lower route-specific limits would reduce spam.
- There is no bot challenge/honeypot. This is optional and should be selected with privacy/accessibility in mind.
- SVG upload is allowed for some admin image types. Because SVG can contain active content, production serving behavior and sanitisation should be reviewed.
- Authentication rate limiting is global rather than login-specific.
- Dependency audit output and live headers should be reviewed separately; no security claims are made solely from static inspection.

## Recommendation classification matrix

| Specification area | Class | Decision |
| --- | --- | --- |
| Audit before redesign | A | Existing architecture/design will be retained; this document records the audit |
| Three business clusters | B | Present in content but inconsistent; clarify homepage/header/footer and keep SEO within Digital |
| UK employer recruitment | B | Main landing exists; strengthen employer-first CTA and route |
| `/hire-staff` | C | Add focused page/form using existing contact storage/email backend |
| Recruitment role/location pages | D for now | Insufficient distinct verified copy; research and business input required |
| Website development service | B | Existing page; strengthen international and genuine technical capability copy |
| MERN/React/custom-app pages | D for now | Capability is credible, but separate full pages need portfolio/proof and richer service input |
| Portfolio/case studies | C, blocked by input | Architecture/content plan can be prepared; public cases require verified data |
| SEO service architecture | B | Main page exists; subpages should wait for deeper proof/content |
| Courses hub | B | Functional and data-backed; correct claims and labels |
| Individual course pages | D for now | Current model lacks enough visible fields for rich, non-thin pages |
| Course enquiry/B2B training | A/B | Existing working B2B quotation journey; improve labelling/tracking |
| Course structured data | D for now | Do not add incomplete/fabricated details; revisit after data model expansion |
| Titles/descriptions/canonicals | A/B | Core implementation exists; refine priority pages and 404/dynamic job metadata |
| Structured data | B | Keep valid existing types; remove inaccurate SearchAction; add job data |
| Job detail SEO | C | Add clean detail route, schema and sitemap inclusion |
| Expired job policy | B | Exclude inactive/expired jobs; no blanket homepage redirects |
| Core Web Vitals | B | Good build foundations; live measurements and bundle/CSS work remain |
| Image optimisation | B | Some dimensions/lazy loading; uploaded image pipeline requires future work |
| Mobile UX | B | Responsive CSS exists; manual live-browser regression check required |
| Internal linking | B | Existing links; improve cluster-to-funnel paths |
| Content strategies | C (plan only) | Create editorial plan; do not auto-publish bulk articles |
| E-E-A-T/trust | B/C | Company/contact/approved reviews exist; team, evidence and policies need input |
| Google Business Profile | D in code | Owner/off-site task; NAP consistency documented |
| Backlinks | D in code | Requires genuine outreach; addressed in `SEO_OFFSITE_PLAN.md` |
| Homepage conversion | B | Remove unsupported claims and make three journeys explicit |
| Analytics/conversion tracking | C | Add opt-in environment-driven GA4 and event helper; owner must supply ID |
| Security | B | Strong baseline; add focused public-route limiting and document remaining checks |
| Accessibility | B | Improve labels, skip link, focus and status semantics on priority journeys |
| URL preservation | A | Existing paths retained; new routes are additive |
| Black-hat tactics | A | None found and none planned |

## Baseline validation

- `npm.cmd run build`: passed before implementation (Vite 6.4.3, 1,661 modules transformed).
- There are no repository lint, type-check, unit-test or integration-test scripts.
- Live status codes, Search Console, analytics, backlink profile and field Core Web Vitals require production access/data and are not inferred from source.
