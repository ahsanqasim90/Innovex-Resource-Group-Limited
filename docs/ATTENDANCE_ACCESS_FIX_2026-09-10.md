# Attendance access correction — 10 September 2026

## Cause and change

Personal attendance was behind generic HTTP-action permission inference. Check-in/check-out POST requests required attendance.create and daily PUT updates required attendance.edit. These permissions are not part of the My Attendance profile. Attendance Reports (attendance.manage) implicitly granted them, explaining the reported workaround.

The attendance router now checks My Attendance directly. Personal operations continue to select the signed-in user's own record and use the server's current London date. Employee report and PDF endpoints still require attendance.manage. Existing staff permissions and real attendance records were not changed.

## Validation

The new regression failed before the fix with HTTP 403 on check-in. After the fix, all 25 tests pass. The real attendance router is exercised with an injected staff identity and an in-memory database substitute, covering:

- Automatic attendance access with no explicit permissions: read today, check in, save daily totals, check out.
- Request-supplied user IDs and names cannot alter another employee's record.
- Duplicate check-ins/check-outs, invalid counts and updates after check-out remain blocked.
- Employee reports and PDF requests remain forbidden without report permission and do not query employee records.
- Explicit report access succeeds; revoking it denies reports again.

The production authentication middleware remains in place. No real staff attendance was marked as a test.

Deployment: published to https://www.innovexresourcegroup.co.uk. Vercel deployment dpl_AEhC9QKGxFgUgGG3uknsNADC1Vro is READY and the production domain alias is confirmed. Production build passed. Live health returns HTTP 200; unauthenticated personal attendance and employee reports return HTTP 401. Authenticated marking was verified using the isolated regression test, not by marking any real staff attendance.
