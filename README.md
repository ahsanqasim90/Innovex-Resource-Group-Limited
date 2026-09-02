# Innovex Resource Group Platform

A multi-tenant MERN platform combining the public Innovex website with a recruitment, sales, training, HR and finance CRM. The product is designed for UK recruitment operations, including care-sector compliance workflows.

## Product modules

- Public website: services, live vacancies, applications, CV registration, blogs, newsletters, testimonials, contact and legal/trust pages.
- Recruitment: ATS, talent pool, candidate communications, vacancy intelligence, maker/approver publishing and advanced funnel analytics.
- Healthcare compliance: role-aware compliance passports, DBS/right-to-work/references, nurse-specific NMC checks, expiry monitoring and quarantined evidence review.
- CRM: Organisation 360, business/web leads, calls, mailbox activity, meetings and client terms.
- Workflow automation: event/condition/action rules, task queues, in-app notifications, SLA reminders and run history.
- Portals: separately authenticated candidate and client workspaces with candidate progress, interviews, compliance status, vacancy review and client decisions.
- Platform administration: tenant branding/locale, granular permissions, MFA, session revocation, archive/retention/legal hold, audit trail, backup drills and error events.
- SaaS controls: plan status, server-enforced seat allocation, pending-invite reservations, trial/subscription access policy and usage UI.
- Developer platform: one-time scoped API keys, read-only API v1, signed webhooks, retry outbox and delivery log.

## Local setup

Requirements: Node.js 20+, MongoDB and npm.

```bash
npm install
npm run install:all
copy server\.env.example server\.env
npm run seed --prefix server
npm run dev
```

- Frontend: `http://localhost:5173`
- API health: `http://localhost:5000/api/health`

Use a long random `JWT_SECRET` and a separate `MFA_ENCRYPTION_KEY`. Never deploy the sample credentials.

## Quality checks

```bash
npm test
npm run build
npm audit
```

CI runs the server tests, production frontend build and dependency audit from `.github/workflows/ci.yml`.

## Multi-tenant deployment

Requests resolve the workspace from `X-Workspace-Slug` or a subdomain under `BASE_DOMAIN`. Tenant-scoped Mongoose queries, aggregates and distinct operations automatically add the organisation boundary. Do not use tenant-bypass options in application routes.

Older installations may still have global unique MongoDB indexes. Review the safe migration first:

```bash
npm run migrate:tenant-indexes
```

During a backed-up maintenance window, apply the reviewed changes:

```bash
npm run migrate:tenant-indexes:apply
```

The script only removes obsolete global **unique** indexes from an explicit model allow-list, then creates the declared tenant-aware indexes. It is dry-run-only unless `--apply` is supplied.

## Document security

Recruitment and compliance uploads are signature checked and fail closed. Until ClamAV `clamd` is configured and returns a clean result, new documents remain quarantined and cannot be viewed or downloaded. Production deployments should use private durable object storage instead of relying on an ephemeral application filesystem.

Required environment variables:

```text
CLAMAV_HOST=127.0.0.1
CLAMAV_PORT=3310
CLAMAV_TIMEOUT_MS=8000
```

## API and webhooks

Create credentials in **Admin → API & Webhooks**. API keys are shown once and only their SHA-256 hashes are stored. Send the key in `X-API-Key` and the workspace slug in `X-Workspace-Slug`.

Read endpoints:

- `GET /api/v1/jobs` — `jobs:read`
- `GET /api/v1/candidates` — `candidates:read`
- `GET /api/v1/clients` — `clients:read`

All lists support `page`, `limit` (maximum 100) and `updatedSince`. Webhooks are HMAC-SHA256 signed over `<timestamp>.<raw-body>` and include `X-Innovex-Signature`, `X-Innovex-Timestamp`, `X-Innovex-Event` and `X-Innovex-Event-Id`. The dispatcher blocks local/private destinations, does not follow redirects, times out requests and retries failed deliveries with backoff.

## Operations checklist

- Use HTTPS everywhere and configure exact frontend origins.
- Run MongoDB with authentication, TLS, point-in-time backups and tested restore drills.
- Configure ClamAV before accepting production uploads.
- Configure SMTP/IMAP credentials using secret storage, not committed files.
- Rotate JWT, MFA encryption, API and webhook secrets using an incident runbook.
- Schedule application processes continuously so reminders, compliance expiry checks and webhook retries can run.
- Run the tenant-index dry run and database backup before the first multi-tenant release.
- Connect a regulated payment provider before taking subscription payments. Current billing UI and enforcement are provider-neutral; they do not claim to collect funds.

## External integrations

Yay click-to-call uses the `YAY_*` environment values. Google/Microsoft calendar sync, commercial job-board distribution and regulated e-signatures require vendor OAuth/API agreements and are intentionally not represented as live without credentials. The API/webhook layer provides the secure integration boundary for those adapters.
