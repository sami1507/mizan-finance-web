# Mizan Finance — delivery evidence

Review window: 11–12 November 2026. The existing product, ledger and approved ivory/navy/emerald identity were retained. This is a source-and-runtime delivery, not a new public deployment.

**Readiness: ready for configuration and live verification.** The implemented application requires no provider-specific code changes for the documented PostgreSQL, HTTPS hosting and SMTP setup. The owner's managed infrastructure, real sender/inbox delivery and backup restoration have not been verified. No real email or payment was sent by the tests.

## What is delivered

- Four complete interface languages: Arabic and Hebrew RTL; English and German LTR. Light/dark themes, responsive navigation, exact currency formatting and keyboard operation remain integrated throughout the workspace.
- Registration, login, onboarding, password recovery, profile settings, separate demo sessions, owned accounts/transactions/transfers, budgets, savings goals, recurring schedules, reports, notes, CSV mapping/preview/import/export, JSON download and confirmed account deletion.
- The existing purchase simulator and monthly savings calculator remain connected to real ledger data. Their independently documented models use exact minor units and explicit assumptions; changing a scenario does not post financial records.
- A consistent SVG mark, complete logo variants, transparent PNGs, monochrome artwork, app/favicon/social assets and a regeneration script. Fonts are self-hosted; exact font/icon license notices are included. See [BRAND](BRAND.md).
- Durable mutation retry identities in an additive migration: a committed write with a lost response can be retried once without duplicating its effect. Conflicting payload reuse is rejected. A stale tab cannot post into a different signed-in workspace.
- Preserved draft inputs on errors, session-recovery action inside the modal, pending submission guards, unsaved-change confirmation and keyboard-focus restoration. Spreadsheet-safe exported notes round-trip with their original text and duplicate identity intact.
- SMTP delivery with TLS, timeouts, recipient acceptance checks, safe failure reporting and no ambiguous automatic resend. Configuration/readiness checks, provider setup, safe logging guidance, backup/restore and rollback instructions are included.
- Private-page/API indexing exclusions, public metadata derived from the configured HTTPS origin, permission headers, and reduced font subsets. No invented endorsements, bank connections, payment processing or security certifications.

## Verification record

| Check | Observed result |
| --- | --- |
| Clean dependency installation | `npm ci --no-fund` succeeded in the source checkout; lockfile retained |
| Dependency advisory audit | `npm audit --audit-level=high`: zero known vulnerabilities at review time |
| Lint / TypeScript | Passed |
| Unit, database and integration suite | 264 tests across 17 files passed |
| Production build | Passed |
| Actual process stop/start | Passed: persisted session, exact balance, ledger and retry identity; isolated demo removed afterward |
| Production browser workflows | **23 passed** against the final production build, including narrow-table keyboard navigation |
| All-page browser/layout/accessibility review | **58 page/profile samples passed**: no reported Axe violations, no page overflow, no browser runtime/console errors; 15 fresh captures |
| PostgreSQL 17 / Linux CI | **Passed** on implementation commit `37c55a09760184ae1bc8034063624de67020105a`: [both CI jobs](https://github.com/sami1507/mizan-finance-web/actions/runs/43110075031), including 23 browser tests and actual restart persistence |

Tests cover `5,000 + 2,000 − 300 = 6,700`, transfer conservation, transaction edits/deletes, goal allocations without double subtraction, recurring/import deduplication, concurrent writes, cross-user references, atomic failure, CSV formula-like notes, failed network responses and session recovery. The four-language calculator/simulator cases cover zero/invalid inputs, explicit overlaps, exact rounding, currency isolation and hypothetical-only state.

The SMTP tests use a real loopback SMTP protocol peer and the actual Better Auth HTTP handler. They check rejection, reset redirects, one-time token use, password change and session revocation. They prove controlled integration behavior, not a real provider account.

Browser checks use Chromium and isolated sample data. Axe scans use WCAG 2/2.1 A/AA tags without exclusions; automated checks do not establish full accessibility conformance. The incomplete contrast items received a [manual follow-up](verification/contrast-review.md) using browser-computed colors and reviewed screenshots: actual sampled ratios were 5.23:1–14.30:1, with no observed text/background overlap at the tested values. Incomplete entries remain in the raw audit rather than being hidden. Exact chart tables remain available. Real screenshots were visually inspected for hierarchy, typography, RTL/LTR and narrow-screen layout.

## Performance and operating limits

Measurements are local, unthrottled and against a production build, not field Core Web Vitals or a load test. The audit records per-route readiness and available LCP observations; an unobserved LCP is `null`, not a zero-time result. In the final 58-sample run, route readiness was 21–849ms (median 68ms, p95 790ms), including font readiness. These warm/local figures are not a production-speed guarantee. An earlier run alongside the full test suite had slow cold requests; its results were investigated before rerunning. The raw final observations are in [delivery-browser-audit.json](verification/delivery-browser-audit.json).

Fresh PGlite setup on the old slow runtime disk took minutes; initializing a separate clean local directory on the source drive took about three seconds, and the actual restart verification completed in under five seconds. The source checkout now runs directly after a clean install. Finish local migrations before starting the server. PGlite is a single-process local convenience; public multi-instance production uses PostgreSQL.

Accounts are manual. Recurring entries are posted by an explicit in-app action. Currency totals remain separate without FX. Scenario/calculator assumptions and failed form drafts are temporary memory. CSV content deduplication can treat truly identical purchases as duplicates; the documented manual-entry path handles intentional duplicates. PDF output uses the browser print dialog. Email verification, MFA, distributed application rate limiting, a native mobile app, bank feeds and independent security certification are not claimed. Multi-instance ingress limits, backups, monitoring and legal/operator details are hosting responsibilities documented in [OPERATIONS](OPERATIONS.md).

## Owner setup and acceptance

| Item | Enter/configure at | Required action and success check |
| --- | --- | --- |
| PostgreSQL | Host server environment: `DATABASE_URL` | Provision a private database, direct/session-pooled TLS URL and backup policy. Run `check:config -- --production --database`, migrate and verify readiness. |
| HTTPS host and authentication | `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` | Set the final HTTPS origin and random secret before building; configure domain/TLS, trusted ingress and host rate limits. Test signup/login/onboarding over HTTPS. Better Auth needs no external cloud account. |
| Password-reset SMTP | `SMTP_URL`, `MAIL_FROM` | Verify sender/domain and provider DNS, enable SMTP egress, run `check:config -- --production --smtp` (no mail), then perform one controlled real inbox/reset test. Optional for other financial workflows. |
| Operations | Host/provider dashboards and scheduler | Set readiness monitoring, expired-demo cleanup, protected log retention and backups; restore into a new empty test database and record the result. |
| Operator details | Actual deployment/support materials | Supply operator identity/contact, provider locations and retention/privacy details matching the live service. No lawyer-approved policy is fabricated. |

Exact variables, callback paths, provider requirements and verification steps: [API_SETUP](API_SETUP.md). Clean installation, production release, backup/restore and rollback: [OPERATIONS](OPERATIONS.md). Start locally with `npm ci`, `npm run db:migrate`, `npm run dev`, then open `http://localhost:3000`.

## Review artifacts

- [Arabic landing](screenshots/delivery-landing-ar-1440-light.png), [English dark dashboard](screenshots/delivery-dashboard-en-1440-dark.png), [Hebrew phone](screenshots/delivery-dashboard-he-390-light.png), [German phone savings](screenshots/delivery-savings-de-320-dark.png), [Arabic tablet](screenshots/delivery-dashboard-ar-768-light.png).
- [Brand board](screenshots/brand-board.png), ready-to-use assets under `public/brand/`, exact notices under `docs/licenses/`.
- [Focused source/security findings](QA_REVIEW.md), [acceptance/state record](../PROJECT_STATE.md), [simulator research](simulator-research.md), [simulator model](simulator-model.md), [savings model](savings-capacity-model.md).
- Reproduce visual evidence with `CAPTURE_URL` pointing to a local production preview and `npm run review:delivery`. Detailed raw results are generated under ignored `test-results/`; the reviewed run is preserved in `docs/verification/delivery-browser-audit.json`.

No known blocking financial-flow or data-isolation defect remained in the completed checks. Local acceptance checks and the final visual audit passed. The implementation also passed both remote CI jobs; the [recorded run](https://github.com/sami1507/mizan-finance-web/actions/runs/43110075031) identifies its exact SHA. Documentation-only follow-up commits retain that implementation and have their own Actions checks. The correct status remains **ready for configuration and live verification**, until the owner's external acceptance checks pass.
