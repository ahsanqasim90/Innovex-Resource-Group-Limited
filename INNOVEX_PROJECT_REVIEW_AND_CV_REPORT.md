# Innovex Resource Group — Complete Implementation Review & CV Report

**Review date:** 30 August 2026  
**Project:** Innovex Resource Group Limited  
**Live website:** https://www.innovexresourcegroup.co.uk  
**Review basis:** current workspace source code, production build output, Git history, and read-only live-browser verification

## 1. Executive summary

Innovex is no longer just a recruitment brochure website. It is a production-oriented full-stack business platform consisting of:

- a public recruitment, digital-services and healthcare-training website;
- a secure multi-role administration portal;
- recruitment ATS, candidate and business-lead CRM workflows;
- vacancy and CV document intelligence;
- email, newsletter, call, interview and meeting operations;
- training, client terms, finance and HR document workflows;
- PDF, Excel and CSV generation;
- SEO, privacy, accessibility and deployment infrastructure.

The current workspace contains approximately **38,495 lines of application code** across **193 JavaScript, JSX and CSS files** in `client/src` and `server/src`. It includes **53 page files**, **23 reusable React components**, **38 MongoDB models**, **32 API route modules**, **24 backend service modules** and approximately **254 declared REST endpoints**. The frontend exposes roughly **20 public route patterns** and **38 protected admin route patterns**.

Git history contains **123 commits**, beginning on 3 June 2026. All 123 commits in the current history are attributed to variants of Muhammad Ahsan Qasim's Git identity. This provides strong repository evidence of sustained end-to-end ownership, although authorship is ultimately a personal/employment claim rather than something a code audit can independently certify.

## 2. Verification status

| Area | Status | Evidence |
|---|---|---|
| Production frontend | Verified live | 15 key public/login routes opened successfully |
| Dynamic public content | Verified live | Jobs, courses, blogs, testimonials and partners loaded from the API |
| Homepage browser health | Verified live | No console warnings or errors observed during the review |
| Production build | Passed | Vite transformed 1,676 modules and completed successfully |
| Public form presence | Verified live | Employer, training, jobs, newsletter, testimonial, contact and CV forms rendered |
| Protected admin UI | Code/build verified | Login page verified live; protected screens compiled successfully |
| Admin mutations and outbound messages | Not executed | Read-only review avoided changing production data or sending emails/calls |
| External integrations | Implementation verified | Configuration and service code inspected; credentials/provider delivery not retested |
| Automated regression suite | Not present | No formal unit, integration or end-to-end test suite was found |

## 3. Technical architecture

### Frontend

- React 19 with Vite and React Router.
- Route-level lazy loading for public and admin pages.
- Reusable layouts, headers, footers, SEO, status, upload, job, blog, partner, testimonial and chatbot components.
- Lucide icon system.
- Responsive layouts with desktop, tablet and mobile breakpoints.
- Reduced-motion handling for users who prefer fewer animations.
- Central API client with cookie credentials, CSRF headers, JSON/FormData support, protected downloads and blob previews.

### Backend

- Node.js and Express REST API.
- MongoDB with Mongoose schemas, indexes, validation and lifecycle statuses.
- Modular route, model, middleware, configuration and service layers.
- Serverless-compatible API entry points for Vercel.
- Scheduled cron endpoints for interview, finance and client-terms reminders.

### Data and document tooling

- PDFKit for invoices, quotations, salary slips, offer letters, attendance reports, expense ledgers and CRM exports.
- `pdf-lib`, `pdf-parse` and Mammoth for PDF/DOCX processing and protected CV review.
- ExcelJS for professional Excel exports.
- Multer memory storage for controlled uploads.

### Communications and integrations

- Nodemailer/SMTP for transactional and marketing email.
- IMAPFlow and Mailparser for mailbox sync and Sent-folder records.
- Yay.com outbound call integration.
- Postcodes.io location intelligence plus Haversine-distance calculation.
- Vercel hosting, rewrites, security headers, caching and cron configuration.

## 4. Public website — section-by-section implementation

### Global experience

- Skip-to-content accessibility link.
- Responsive branded header and mobile navigation.
- Clear navigation across Recruitment, Digital, SEO, Training, Jobs, Insights and Contact.
- Reusable footer with company registration details, ICO/Companies House trust statements, contact information and social links.
- Floating Innovex chatbot/contact assistant.
- Consistent CTA system for employers, candidates, training customers and digital-service leads.

### Homepage (`/`)

Implemented sections include:

1. Hero positioning Innovex across recruitment, digital growth and training.
2. Employer, digital-project, course and candidate conversion paths.
3. Three business-division cards.
4. Audience/sector tags for the organisations and candidates served.
5. Healthcare-training promotional section.
6. Six healthcare recruitment service cards.
7. Recruitment-quality and compliance checklist.
8. Website-design and SEO service cards.
9. Digital-delivery benefits.
10. Dynamic jobs carousel/list loaded from the admin-managed jobs API.
11. Why-choose-Innovex value cards.
12. Dynamic partner-logo slider.
13. Dynamic latest-blog cards.
14. Dynamic testimonial slider and feedback CTA.

### About (`/about`)

- Company story, scope and care-sector positioning.
- Who We Are, Mission and Vision cards.
- Values grid.
- Compliance and trust section.
- UK healthcare recruitment focus.

### Services and commercial landing pages

- `/services`: overview of recruitment and digital capabilities.
- `/healthcare-recruitment`: sector-focused recruitment proposition, outcomes, delivery process, FAQs and CTA.
- `/website-development`: website-development proposition, benefits, delivery process, FAQs and enquiry CTA.
- `/seo-services`: SEO/digital-growth proposition, benefits, process, FAQs and enquiry CTA.
- Shared landing-page architecture keeps content and design consistent while allowing service-specific metadata and schema.

### Employer funnel (`/hire-staff`)

- Employer-focused hero and trust proposition.
- Roles-supplied section.
- Vacancy-to-placement process.
- Eleven-field vacancy brief form.
- Employer FAQs.
- Server-side contact/enquiry processing and email notification path.

### Healthcare courses (`/courses`)

- Dynamic active course catalogue managed from the admin portal.
- Search/filter experience and individual course details.
- Training-process explanation.
- Multi-course quotation/enquiry form with delegates, organisation, location and preferred dates.
- Public rate limiting and backend notification workflow.

### Jobs and applications (`/jobs`, `/jobs/:jobId`)

- Dynamic vacancy list from MongoDB/admin jobs management.
- Search and filters.
- Dedicated, indexable job-detail URLs.
- Requirements, job description and application CTA.
- Job application form with optional CV upload.
- Admin-side application status tracking and protected CV download.
- Vacancy lifecycle support for Open, Paused, Closed and Filled states.

### Content marketing (`/blogs`, `/blogs/:slug`)

- Dynamic blog library with category/search filters.
- SEO-friendly slug detail pages.
- Structured article metadata.
- Admin CMS for draft/published state, editing and featured images.

### Newsletter (`/newsletters`, `/newsletters/:slug`, unsubscribe route)

- Public permission-based subscription form.
- Interest/topic selection and consent capture.
- Honeypot and rate-limit protections.
- Public campaign archive and shareable campaign pages.
- Tokenised unsubscribe preference centre.
- Privacy notice links and PECR-oriented wording.

### Privacy (`/privacy`)

- Information collected, purposes and lawful bases.
- Email marketing/PECR explanation.
- Recipients, retention, security and data-subject rights.
- Newsletter preference and change-notice sections.

### Testimonials (`/testimonials`)

- Dynamic approved testimonial display.
- Five-star visual rating.
- Public seven-input feedback form.
- Admin approval/rejection and deletion workflow.

### Partners (`/partners`)

- Dynamic active partner directory.
- Partner logo and service/location presentation.
- Partnership CTA.
- Admin CRUD and logo-upload management.

### Contact (`/contact`)

- Contact options and business details.
- Six-input enquiry form with service/reason routing.
- Server-side validation, persistence and transactional email path.

### CV registration (`/upload-cv`)

- Candidate details, desired role, location and consent.
- PDF/DOCX CV upload with a 5 MB limit.
- Secure database-backed CV record.
- Admin status tracking and protected download.

### Error handling

- Branded not-found route.
- Loading states and API fallbacks.
- Reusable status/error messaging across forms.

## 5. Admin portal — implemented business systems

### Secure workspace and dashboard

- Cookie-based JWT sessions.
- CSRF validation on state-changing authenticated requests.
- User activation checks and role/permission guards on client and server.
- Dashboard metrics, quick actions, recent activity and operational summaries.
- Portal notifications and read/read-all states.
- Activity logging with actor, module, action, IP address and user agent.

### Attendance and employee reporting

- Check-in/check-out workflow.
- Work location and daily CV/work report capture.
- Employee and admin report views.
- Date/user filters and PDF attendance reports.

### Jobs and applications

- Job creation, editing, deletion and lifecycle controls.
- Public/private job fields, compensation, location, priority and openings.
- Applications inbox, status workflow and protected CV access.

### Recruitment ATS

- Candidate submission with CV.
- Structured recruitment stages.
- Admin review and stage transitions.
- Interview details and notes within the workflow.

### Talent pool CRM

- Candidate CRUD and bulk CSV import.
- Search, status, role, postcode and availability filters.
- Bulk status updates.
- Candidate-to-job matching.
- Individual/bulk outreach email.
- Direct call initiation through the call centre.

### Secure CV library

- Admin CV upload and central candidate document library.
- Team access grants/revocation.
- Download-request and approval workflow.
- Protected review-text endpoint.
- Watermarked PDF preview with viewer identity and candidate ID.
- Security summary and access controls.

### Vacancy intelligence

- PDF/DOCX vacancy document validation and text extraction.
- Structured vacancy criteria analysis.
- Explainable, privacy-aware rules-based matching across skills, experience, qualifications, location, availability and recency.
- Configurable score profiles and match thresholds.
- Postcode radius/distance intelligence.
- Candidate feedback loop, vacancy pipeline and outreach email.

### Candidate communications

- IMAP mailbox sync.
- Inbox list and read states.
- Message-to-candidate linking.
- Candidate communication timeline.
- Notes, follow-ups, priorities, outcomes and completion states.
- Candidate email from approved sender accounts.

### Business-lead CRM

- Lead CRUD and CSV import.
- Category, status, postcode and search filters.
- KPI/summary cards.
- Bulk status actions.
- Email outreach and integrated calling.
- Outreach history and conversion-oriented statuses.

### Web Leads CRM

- Agent-specific and manager-wide dashboards.
- Prospect creation, editing, search, pagination and advanced filters.
- Duplicate detection and manager-controlled merge with retained history.
- Interactions, follow-ups, priorities and overdue views.
- Approved email templates and outbound email history.
- Lead qualification form with locking and manager review.
- Accept, reject, reopen and request-more-information decisions.
- Private internal manager notes.
- Meeting requests and approvals.
- Agent performance reports and conversion rates.
- Excel and branded PDF prospect exports, plus email delivery of exports.
- Manager notifications and configurable business categories.

### Email centre

- Multiple approved sender accounts.
- Composed email with To/CC/BCC.
- Central email log with scheduled/sent/failed state support.
- CRM entity linking and audit history.

### Newsletter centre

- Subscriber management and segmentation.
- Subscriber type, interests, consent/lawful basis and subscription status.
- Campaign draft/edit workflow.
- Audience estimation.
- Test email, preview and live campaign send.
- Public archive publishing and unsubscribe-token generation.

### Call centre

- Yay.com configuration status and connection testing.
- Normalised telephone numbers and approved outbound caller IDs.
- Call initiation, status, outcome, duration and provider diagnostics.
- Candidate, lead and manual call records.

### Interviews and meetings

- Interview/meeting CRUD and filters.
- Phone, Teams, Zoom and face-to-face modes.
- Confirmation-email sending/resending with CC tracking.
- One-day candidate reminders and follow-up messages.
- Interview outcome, selection status and placement-revenue calculation.
- Meeting reminders and upcoming/completed/cancelled states.

### Training operations

- Course CMS.
- Public training enquiry intake.
- Training booking lifecycle, delegates, dates, trainers and payment state.
- Price, trainer-cost, expense and profit tracking.
- Upcoming training reminders.
- Professional quotation creation with multiple line items, discounts, validity and statuses.
- Branded quotation PDF and email delivery.

### Client terms

- Client terms creation/editing with dynamic fee tables.
- Branded multipage PDF generation from the Innovex template.
- Email sending with attachments and Sent-folder logging.
- Signature capture/mark-signed workflow.
- Cancellation, deletion and unsigned-reminder automation.

### Finance centre

- Owner-only finance access.
- Invoice types for recruitment, training, website, SEO, compliance and other work.
- Line items, VAT, balances, due dates and financial-year reporting.
- Draft, sent, partly paid, paid, overdue and cancelled statuses.
- Branded invoice PDF.
- Immediate or scheduled email delivery, reminders and Sent-folder sync.
- Expense records with receipt upload.
- Expense PDF, CSV and Excel exports.

### HR documents

- Salary slip CRUD, PDF generation and email delivery.
- Offer letter CRUD with percentage/fixed commission support.
- Branded, signed and stamped offer-letter PDFs.
- Sent/cancelled state tracking and email logs.

### Website content management

- Blog CMS with publish control and featured images.
- Testimonial moderation.
- Partner directory and logo management.
- Public API responses expose active/approved/published records while admin queries are protected.

### Team administration and suggestions

- Nine role types plus granular permission checkboxes.
- Sender-email and outbound-caller-ID assignments.
- Active/inactive user accounts and restricted finance access.
- Employee suggestions with review status, response and visibility controls.

## 6. Security and privacy controls already implemented

- Password hashing with bcrypt work factor 12.
- JWT expiry (eight-hour default) in an HttpOnly session cookie.
- `Secure`, `SameSite=Strict` and `__Host-` production-cookie controls.
- CSRF token validation for authenticated state changes.
- Login rate limit plus global and public-form-specific rate limits.
- Helmet, HSTS, no-sniff, frame denial, restrictive referrer and Permissions Policy headers.
- Vercel Content Security Policy.
- Role-based and permission-based server middleware.
- Owner-only finance gate.
- File-size and MIME allowlists for CVs, images, CSVs and receipts.
- Protected document endpoints and watermarked CV review.
- Consent, lawful-basis, retention/suppression and unsubscribe data structures.
- Admin areas blocked from search indexing.

## 7. SEO, accessibility and conversion implementation

- Unique page titles and meta descriptions.
- Canonical URLs.
- Open Graph and Twitter cards.
- JSON-LD support for organisation, website, page/article/job/service data.
- Dynamic XML sitemap including database-driven content.
- `robots.txt`, static sitemap, favicon set, web manifest and Apple icon.
- Semantic headings and section structure.
- Skip link, labels, alt text and keyboard-oriented native controls.
- Lazy-loaded routes/images and long-term immutable asset caching.
- Dedicated employer, candidate, training, digital and newsletter funnels.

## 8. Production/build evidence

The current codebase passed `npm run build` on 30 August 2026:

- 1,676 Vite modules transformed.
- Route-level JavaScript chunks generated successfully.
- Main JavaScript bundle: approximately 308.76 kB (96.50 kB gzip).
- CSS bundle: approximately 361.47 kB (65.39 kB gzip).
- Largest lazy admin chunk: Web Leads CRM at approximately 61.27 kB (14.94 kB gzip).
- No compile errors.

## 9. Honest gaps and recommended next work

### High priority

1. **Add automated testing.** The build passes, but no formal unit, API integration or browser end-to-end suite exists. Prioritise authentication/CSRF, permissions, application/CV uploads, email scheduling, invoices and CRM stage transitions.
2. **Strengthen upload inspection.** Current checks primarily trust reported MIME type and extension. Add file-signature validation, malware scanning and SVG sanitisation, or reject SVG uploads altogether.
3. **Verify external operations in a controlled staging environment.** SMTP, IMAP, Yay calls and cron delivery are implemented, but this review intentionally did not send production communications or alter live records.

### Medium priority

4. **Refactor the largest files.** The 11,000+ line stylesheet and several 600–900 line pages/routes should be split into feature-level modules for maintainability.
5. **Update the README.** It describes an earlier, much smaller version of the system and understates the actual public/admin scope.
6. **Improve content uniqueness.** Several homepage recruitment cards and value cards reuse identical descriptions. More specific copy would strengthen credibility and SEO.
7. **Add observability.** Introduce structured production logging, error monitoring and alerting for failed emails, calls, cron runs and serverless API failures.
8. **Document backup/recovery and data-retention operations.** Privacy text and database fields exist, but operational runbooks are not visible in the repository.

### Longer-term

9. Consider server-side rendering or prerendering for the most important marketing/job pages if organic search becomes a major acquisition channel.
10. Add performance budgets and CSS pruning as the admin portal grows.
11. Add WCAG-focused automated checks and manual contrast/screen-reader testing.

## 10. CV-ready project entry

### Recommended title

**Full-Stack Developer — Innovex Recruitment Operations Platform**

### Short CV description

Designed and developed a production full-stack platform from scratch for a UK healthcare recruitment business, combining a responsive public website with a secure multi-role CRM/ATS, finance, HR, training, communications and document-automation portal.

### Strong CV bullet points

- Built and deployed a full-stack React, Node.js, Express and MongoDB platform with approximately 20 public route patterns, 38 protected admin routes, 254 REST endpoints and 38 domain models.
- Designed a responsive, SEO-ready public website covering recruitment, jobs, healthcare training, website development and SEO, with dynamic content, structured metadata, sitemaps and conversion-focused forms.
- Developed end-to-end recruitment operations including job publishing, applications, ATS stages, a talent pool, protected CV management, candidate communications, interviews, meetings and placement-revenue tracking.
- Implemented explainable vacancy-to-candidate matching using document extraction, structured criteria, configurable score weights, postcode-radius intelligence and recruiter feedback.
- Created sales and web-lead CRM workflows with CSV import, duplicate detection/merge, follow-ups, qualification approvals, meeting management, agent analytics and Excel/PDF exports.
- Automated professional invoices, quotations, client terms, salary slips, offer letters, attendance reports and expense ledgers with branded PDF generation and email delivery.
- Integrated multi-account SMTP/IMAP email, newsletter campaigns, mailbox sync, scheduled reminders and Yay.com outbound calling.
- Secured the platform with bcrypt, HttpOnly JWT cookies, CSRF validation, granular role-based permissions, rate limiting, CSP/HSTS headers and protected document access.
- Deployed the application on Vercel with serverless API routing, SPA fallbacks, cache policies and scheduled cron jobs.

### Compact one-line version

Built a production MERN recruitment and business-operations platform from scratch, combining a public SEO website with a secure ATS/CRM, candidate intelligence, communications, finance, HR and automated document generation.

### Portfolio case-study headline

**How I built a healthcare recruitment website into a complete recruitment, sales and operations platform**

### Interview talking points

- Why a brochure website evolved into a role-based internal business system.
- How public forms flow into protected CRM records.
- How permission presets and server-side guards prevent inappropriate access.
- Why vacancy matching is explainable and recruiter-controlled rather than a black box.
- How PDFs, emails, IMAP history and scheduled reminders reduce manual operations.
- How public SEO/content funnels and back-office workflows share one data platform.
- What you would improve next: testing, modularisation, observability and stronger file scanning.

## 11. Skills and keywords supported by the repository

React 19, JavaScript, JSX, Vite, React Router, responsive UI, accessibility, Node.js, Express, REST APIs, MongoDB, Mongoose, authentication, JWT, CSRF, RBAC, bcrypt, data modelling, file uploads, PDF generation, Excel/CSV export, SMTP, IMAP, email automation, CRM, ATS, recruitment technology, document parsing, explainable candidate matching, SEO, JSON-LD, XML sitemaps, Vercel, serverless functions, cron jobs, security headers and production deployment.

## 12. Final assessment

This is a substantial commercial full-stack project and is absolutely suitable for a CV and portfolio. Its strongest differentiator is not the number of pages; it is the way the public acquisition website connects to real operational systems for recruitment, sales, training, finance, HR and communications.

For CV use, describe it as a **full-stack recruitment and business-operations platform**, not merely a company website. Keep the claims tied to the verified implementation above, and do not call the rules-based matching system generative AI unless a real model integration is added later.
