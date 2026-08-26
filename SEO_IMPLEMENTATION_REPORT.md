# Innovex Resource Group SEO Implementation Report

Implementation date: 26 August 2026
Scope: safe, justified repository-level P0/P1 changes after audit. Existing branding, API architecture, admin application and public URLs were preserved.

## Outcome

The public website now presents three clear commercial divisions—UK Recruitment, worldwide Digital Services, and Courses & Training—while keeping candidate jobs/CV journeys available. Employers have a dedicated request-candidates funnel, active vacancies can use clean canonical detail URLs with `JobPosting` data, unsupported claims have been removed, unknown URLs render a noindex 404, priority forms have persistent labels, and analytics/search-verification support is environment-driven.

## Files changed

### New implementation files

- `client/src/pages/HireStaff.jsx`
- `client/src/pages/NotFound.jsx`
- `client/src/components/SiteIntegrations.jsx`
- `client/src/utils/analytics.js`
- `client/.env.example`
- `SEO_AUDIT.md`
- `SEO_IMPLEMENTATION_PLAN.md`
- `SEO_CONTENT_PLAN.md`
- `SEO_OFFSITE_PLAN.md`
- `BUSINESS_INPUT_REQUIRED.md`
- `SEO_IMPLEMENTATION_REPORT.md`

### Existing files improved by this implementation

- `client/src/main.jsx`
- `client/src/layouts/AppLayout.jsx`
- `client/src/components/SEO.jsx`
- `client/src/components/Header.jsx`
- `client/src/components/Footer.jsx`
- `client/src/components/JobCard.jsx`
- `client/src/pages/Home.jsx`
- `client/src/pages/ServiceLanding.jsx`
- `client/src/pages/Courses.jsx`
- `client/src/pages/Jobs.jsx`
- `client/src/pages/Contact.jsx`
- `client/src/pages/UploadCv.jsx`
- `client/src/pages/Partners.jsx`
- `client/src/styles.css`
- `client/public/innovex-hero-visual.svg`
- `client/public/sitemap.xml`
- `server/src/routes/jobRoutes.js`
- `server/src/routes/seoRoutes.js`
- `server/src/routes/contactRoutes.js`
- `server/src/routes/trainingBookingRoutes.js`
- `server/.env.example`
- `package-lock.json`
- `client/package-lock.json`
- `server/package-lock.json`

The repository contained unrelated pre-existing uncommitted admin, attendance, quotation, HR, finance and CRM changes. They were preserved and are not claimed as part of this SEO implementation.

## Pages added

- `/hire-staff` — employer-focused healthcare/social-care vacancy brief and request-candidates journey.
- `/jobs/:jobId` — canonical active-vacancy detail route using the existing job/application data.
- Catch-all frontend 404 experience — not an indexable URL template; unknown paths receive `noindex, nofollow` metadata in the SPA.

## Pages improved

- `/` — three-division hierarchy, employer-first CTA, candidate secondary journey, accurate metadata and unsupported-claim removal.
- `/healthcare-recruitment` — request-candidates CTA now enters the employer funnel; screening wording is more precise.
- `/website-development` — genuine React/MERN/custom web capability and worldwide digital enquiry positioning added to the existing page.
- `/seo-services` — clearer technical/on-page/local/content service scope.
- `/courses` — data-driven statistics, persistent form labels and training conversion events.
- `/jobs` — clean detail links retained alongside current search/application functionality.
- `/contact` — labelled fields, funnel-aware conversion event and clearer cluster links.
- `/upload-cv` — labelled fields and CV submission event.
- `/partners` — exact published profile count instead of a `count+` claim.
- Global header/footer — direct access to Recruitment, Digital, SEO, Training and Hire Staff while preserving supporting routes in the footer.

## Redirects

No new redirect was required because existing public URLs were preserved. The existing permanent apex-to-www redirect remains in `vercel.json`. Existing `/jobs?job=<id>` behavior remains readable for compatibility, while new internal detail links use `/jobs/:jobId`.

## Metadata

- Homepage title/description now represent recruitment, digital and training.
- `/hire-staff` has a unique employer-focused title, description and canonical.
- Active job details receive stored-title/location metadata and a clean canonical.
- Unknown routes receive a route-specific canonical plus `noindex, nofollow`.
- Google and Bing verification tokens can be supplied using client environment variables.

## Structured data

- Removed the global `WebSite` jobs-only `SearchAction` because the website has no general site search.
- Preserved Organization/WebSite global data and existing Service/FAQ/Breadcrumb/BlogPosting data.
- Added visible-content-matched Service, BusinessAudience, FAQ and Breadcrumb data to `/hire-staff`.
- Added `JobPosting` and Breadcrumb data to active vacancy detail routes using only stored title, description, identifier, dates, type, location and hiring organisation.
- Did not add review ratings, course offers, accreditations, prices, results or other unverified schema.

## Recruitment SEO

- Added a dedicated employer page and concise vacancy-brief form.
- Form captures company/contact, role, location, staff count, employment type, optional date/rate and requirements, then reuses the existing contact record/email workflow.
- Recruitment CTAs now use “Request Candidates”/“Hire Staff” and route directly to the employer journey.
- Added roles, process and employer FAQs with cautious, vacancy-specific screening language.
- Kept UK geographic focus and avoided thin role/city doorway pages.

## Digital SEO

- Kept one strong website-development page rather than generating thin MERN/React pages.
- Added React/MERN capability substantiated by the existing application architecture.
- Positioned digital project enquiries worldwide while keeping recruitment UK-specific.
- Preserved a dedicated SEO landing page and connected quote/audit journeys through the existing contact form.
- Portfolio/case studies remain blocked pending approved evidence.

## Course SEO

- Retained the working API-backed course hub and B2B training enquiry flow.
- Replaced hard-coded `50+`, universal-certificate and nationwide-delivery claims with actual loaded course/category/certificate counts and neutral quotation language.
- Added labelled fields and submission tracking.
- Did not create thin individual pages or unverified Course/offers/accreditation schema.

## Internal linking

- Homepage and header link directly to the three divisions.
- Recruitment landing, homepage, contact cards, footer and 404 route link to `/hire-staff`.
- Job cards link to clean vacancy detail URLs.
- Candidate jobs/CV links remain visible without dominating the employer funnel.
- Footer retains About-adjacent trust routes, testimonials, partners, insights and admin access.

## Performance

- Retained existing route-level lazy loading and hashed asset caching.
- New public pages are lazy loaded and no heavy dependency was added.
- Production output after implementation: main JS approximately 305 kB uncompressed / 95 kB gzip; global CSS approximately 204 kB / 36 kB gzip.
- The implementation adds roughly 1 kB gzip for 404 and 3 kB gzip for hire-staff as separate chunks.
- Live field CWV, backend timing and uploaded-image optimisation remain deployment/measurement tasks.

## Accessibility

- Added a keyboard skip link and stable `#main-content` target.
- Added global visible focus treatment and reduced-motion handling.
- Added persistent labels/autocomplete hints to hire-staff, training, contact and CV forms; labelled the dedicated job-detail application form.
- Verified the employer page has no horizontal overflow at 1280 px and 390 px rendered widths.
- Verified mobile navigation control visibility and single-column employer hero/form layouts at 390×844.

## Conversion and analytics

- Added optional GA4 loading only when `VITE_GA_MEASUREMENT_ID` is a valid `G-...` value.
- Added events: `employer_enquiry_started`, `employer_enquiry_submitted`, `contact_form_submitted`, `course_enquiry_started`, `course_enquiry_submitted`, `job_application_submitted`, `cv_submission`, `contact_click` and manual SPA `page_view`.
- Event payloads are categorical and the helper rejects keys associated with names, emails, phones, addresses, messages, subjects, CVs or salary.
- GA4 is not active without business-supplied configuration. Privacy/consent approval remains required before production enablement.

## Security

- Reused the existing server-side contact/email pipeline rather than creating a duplicate or exposing secrets.
- Added focused 20-per-hour rate limits to public contact/employer and training-enquiry endpoints, in addition to the global limiter.
- Active job detail/application access now excludes inactive and closing-date-expired vacancies.
- No backend secret was added to frontend code; example environment files contain placeholders only.
- Applied non-breaking dependency security updates in all three lockfiles. This resolved the high-severity React Router, PostCSS, Nanoid and server transitive advisories; the resulting installed versions include React Router DOM 7.18.2, Express 4.22.2 and Mongoose 8.24.4.
- Two moderate `uuid` advisories remain through ExcelJS. The audit proposes a forced ExcelJS downgrade, so it was not applied without regression analysis of finance/export features.

## Sitemap and indexability

- Added `/hire-staff` to static and dynamic sitemaps.
- Added active, non-expired `/jobs/:id` entries to the dynamic sitemap with update timestamps.
- Public job list/detail and applications now apply the same inactive/expired policy.
- Existing published blog sitemap generation remains unchanged.
- Admin remains disallowed in `robots.txt`.

## Testing

| Check | Result |
| --- | --- |
| Baseline `npm.cmd run build` | Passed; 1,661 modules transformed |
| Final production build after dependency fixes | Passed; 1,665 modules transformed |
| Express/route module import check with explicit exit | Passed: `server imports ok` |
| Unsupported claim source search | Found and corrected additional embedded SVG claims (`128+`, `24/7`, `4.2x`, `+3x`) |
| Rendered homepage DOM | Passed: one H1, three division cards, direct CTAs, skip link and global navigation present |
| Rendered `/hire-staff` desktop | Passed: correct H1/title/canonical/robots, Service/Breadcrumb/FAQ data, labelled form, no horizontal overflow |
| Rendered `/hire-staff` mobile 390×844 | Passed: mobile menu visible, hero/form single column, no horizontal overflow; visual screenshot reviewed |
| Rendered unknown route | Passed: 404 H1, route canonical, `noindex, nofollow`, no horizontal overflow |
| Live database-backed form submission | Not executed to avoid creating test leads; payload/API paths reviewed and existing server import passed |
| Live jobs/courses/blog data and API status | Not available through the frontend-only local preview; requires configured MongoDB production/staging check |
| Root/server/client dependency audit | Non-breaking fixes applied; client has 0 vulnerabilities; root/server retain two moderate ExcelJS→UUID advisories requiring a breaking forced change |
| Lint/type/unit/integration tests | No scripts exist in repository |

## Business input required

See `BUSINESS_INPUT_REQUIRED.md`. Highest-priority blockers are privacy/consent approval, analytics/search verification IDs, verified recruitment process/metrics, digital portfolio proof, complete course attributes/accreditation and an existing-blog/Search Console export.

## Future work

- Verify production status codes, response headers, sitemap output and structured data after deployment.
- Connect Search Console/GA4/Bing only after ownership and privacy approval.
- Audit real blog records and search queries before new publication.
- Add recruitment/digital/SEO/course subpages only when each can be distinct, useful and evidenced.
- Build approved portfolio/case studies.
- Measure field Core Web Vitals, then prioritise CSS splitting, chatbot lazy loading and dynamic image variants based on evidence.
- Execute the legitimate outreach plan in `SEO_OFFSITE_PLAN.md` and measure qualified enquiries, not link volume.
