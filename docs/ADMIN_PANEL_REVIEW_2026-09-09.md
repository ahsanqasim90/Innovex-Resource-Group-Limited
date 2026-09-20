# Innovex workspace review and improvements

The existing platform contains substantial recruitment, CRM, training, finance and administration functionality. This update improves the shared working experience, adds an operational task register, and closes concrete dashboard and reliability gaps. Published to production on 10 September 2026 at https://www.innovexresourcegroup.co.uk. Vercel deployment: dpl_C51TSHCzeUuiK1wGv5CMv35YYSPE (READY).

## Changes delivered

| Area | Improvement |
| --- | --- |
| Recruitment | Dashboard priorities for new CVs, pending compliance reviews and past interviews needing an outcome. Upcoming interviews join the shared seven-day agenda. Live vacancy totals exclude unapproved and expired public listings. |
| Sales | New enquiries, business leads, follow-up leads and callbacks are visible together. Due callbacks include overdue dates. Meetings appear in the shared agenda. |
| Training | Bookings, upcoming sessions and draft quotations are accessible from the overview. Training sessions appear alongside meetings and interviews. |
| Finance | Issued invoice value, recorded payments, outstanding balances and overdue invoices appear for finance-authorised owners. Draft and cancelled invoices are excluded from the financial totals. These are operational invoice figures, not recognised accounting revenue. |
| Team operations | A new Team tasks module supports creating, assigning, editing, prioritising, completing, cancelling and reopening tasks. Search, status/priority filters, “assigned to me”, overdue filtering and pagination are included. Automated tasks use the same register. Changes produce audit entries. |
| Navigation | Pin up to eight modules. Recent modules appear in search. Ctrl/Cmd+K, arrow keys, Enter and Escape work. The palette contains focus and returns focus when closed. Settings opens Workspace Settings. |
| Shared interface | Consistent panels, readable metrics, compact table spacing, visible keyboard focus, mobile layouts and reduced-motion support. An error boundary keeps navigation available when a module fails. |
| Reliability | Dashboard failures have retry controls instead of false zero totals. Refresh failures retain the last successful data with an explicit error. Notifications show errors and wait for server confirmation before marking items read. Reports, workspace settings and operations show initial-load errors. An offline banner explains connectivity loss. |

## Permission correction

Previously, dashboard access could return records from modules a staff member could not otherwise open. The dashboard now checks the relevant permission before executing each query. Returned recent records use explicit field projections. Existing tenant query middleware remains in place.

Task access follows the existing automation permissions:

- `automations.view`: read the shared task register.
- `automations.manage`: create, edit and assign tasks; management also grants the existing module actions.
- `automations.execute`: complete, cancel or reopen tasks.

Assignees must be active members of the current workspace. Task titles, descriptions, priority, due dates and status are validated.

## Team Access simplification

The landing screen is now a searchable member directory with role and account-status filters. Add/Manage opens an editor with account details and clearly described role cards. Individual permissions, caller numbers, email senders and data copying are collapsed under Advanced settings. Permission groups can be searched, with a reset to the selected role defaults.

Existing custom permissions and assignments are preserved when opening a member. Required role permissions and permissions implied by broader access are shown as included. Primary administrator and self-suspension protections remain visible. Archiving is labelled accurately and retains the account recovery path.

Local fixture checks confirmed the desktop/mobile directory, collapsed advanced settings, preserved assignments and successful save. No production member accounts or permission assignments were changed during testing.

## Public website

The header has a compact service menu and clearer visitor routes. The shorter hero consistently presents Recruitment, Training and Digital, with websites, SEO and CRM grouped under Digital. The first approved testimonial is brought forward when available. No fabricated client case study or business results were added.

Repeated homepage content, decorative effects, the cookie panel and the chat launcher were reduced. Training and CRM are also represented on the services overview. Public vacancy messages no longer refer to the admin panel.

## Existing features retained

The repository already contains ATS submissions/reviews, candidate communications, compliance passports, CV review, organisation records, business/web leads, email and newsletter tools, training bookings and quotations, invoices/expenses, HR documents, attendance, reports, team permissions, MFA/session controls, portals, audit events, archive/retention, automations and API/webhooks. This update integrates those areas rather than representing them as newly built modules.

## Validation and limits

- Production frontend build passed.
- All 22 server tests passed, followed by four passing Team Access tests after the final permission-display correction (23 tests in total). Coverage includes dashboard permissions, finance filtering, failure propagation, task validation, preservation of custom team access, and required role permissions.
- Local browser testing with explicitly labelled example data verified module pinning, keyboard navigation, task creation, assignment, editing, completion, reopening, overdue filtering, restricted viewer data and initial dashboard failure display.
- Public desktop/mobile layouts, mobile service navigation and the mobile admin dashboard were inspected.
- The UI fixture has no production credentials or database connection. It is under ignored `work/admin-review` and is not deployed. Real-database persistence and live authenticated workflows still require staging verification.

## Deployment verification

The production build and domain alias completed successfully. The live homepage serves the updated bundle and the new Team Access asset is available. API health returns HTTP 200; unauthenticated access to users returns HTTP 401. Live authenticated account changes were not tested.

The deployment dependency audit reported 8 root dependency vulnerabilities (6 moderate, 2 high) and 2 client dependency vulnerabilities (1 moderate, 1 high). These need a separate dependency review; they were not fixed by this interface update.

## Work that is not complete

“All missing features” is broader than this concrete upgrade. Record-wide global search, comprehensive saved views/bulk actions across every module, and full live end-to-end coverage are not delivered here.

The repository also identifies integrations requiring external configuration or agreements: Google/Microsoft calendar sync, commercial job-board distribution, regulated payment collection and vendor e-signatures. Those are not activated by this update. SMTP/IMAP, malware scanning and operational hosting configuration need verification in the deployment environment.

Approved portfolio examples, client permissions and real outcome figures are still needed for a substantive public case-study section.
