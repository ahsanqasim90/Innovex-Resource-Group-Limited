# Recruitment ATS access correction — 10 September 2026

## Confirmed causes

The shared permission middleware inferred actions from URL substrings. `GET /recruitment-workflow/overview` matched `review` and incorrectly required `recruitmentPipeline.approve`, which is not an ATS permission. The router-level guard similarly blocked submission and CV reading by expecting generic create/edit/approve actions before the ATS-specific checks ran.

The client also loaded account permissions only at initial sign-in/page load, so an open staff session could retain an old access-denied state after a manager saved new permissions.

## Correction

- ATS explicitly checks its module view permission without generic URL-based action inference. Existing record visibility filters remain enforced.
- Submission still requires submit access. Reviewer operations still require review access. Stage changes enforce submit/ownership or reviewer authority; a view-only account cannot change stages.
- Submit buttons only appear to members who can submit.
- Signed-in permissions refresh on window focus, visible-tab changes and every 30 seconds while visible. Denied pages provide Check updated access. The identity endpoint is not cacheable.
- No production member roles or assignments were modified during testing.

## Verification

All 24 automated tests pass. The new regression exercises the actual ATS router with an injected test identity and mock database records: denied access, view-only overview, CV read, submit validation, reviewer access, denied writes and revocation. The frontend production build passes.

Local browser testing confirmed that a denied staff session can receive view permission and open ATS without signing in again. The view-only account has no Submit candidate button. Removing permission also automatically returned the already-open session to Access restricted, without a reload. Testing uses example accounts only, not Mahelaka's real session.

Published and aliased to https://www.innovexresourcegroup.co.uk on 10 September 2026. Deployment dpl_HANytRzbfYurWQKAdyiC8vipaRqq is READY. Live API health: HTTP 200. Unauthenticated ATS overview: HTTP 401. Updated frontend bundle verified. Mahelaka’s real authenticated session has not been tested.
