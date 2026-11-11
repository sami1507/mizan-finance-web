# Delivery review

Reviewed source and running production build on 11–12 November 2026. This document records the focused delivery review and its regression coverage; it is not an independent security certification.

## Findings addressed in source

| Finding | Required behavior | Regression evidence |
| --- | --- | --- |
| An expense committed before a lost HTTP response could be created again on retry. | A stable, owner-scoped idempotency key replays without a second effect, including across an intervening session failure. Reusing a key for different changes fails. | `delivery.integration.test.ts`; the browser test lets the real server commit, aborts only its response, then retries the retained draft after a session failure and restoration. |
| Expired sessions left a failed form without a usable recovery path. | Keep the draft temporarily and offer sign-in recovery from inside the modal. A draft associated with another workspace cannot be posted after an account switch. | `delivery.spec.ts` checks the real invalid-session response, retained fields, recovery link and workspace-header rejection. |
| Spreadsheet formula escaping changed exported notes, allowing reimported rows to evade duplicate checks. | Decode only the explicit export encoding marker. Preserve ordinary apostrophes in external files. | `delivery-csv.test.ts`; the browser exports and reimports real `=`, `+`, `-`, `@` and literal-apostrophe notes. |
| Narrow read-only tables could scroll visually but not from the keyboard. | Named focusable regions, visible focus and actual arrow-key scrolling at 320px. | `accessibility.spec.ts`: four German dark-mode routes, optional chart tables and unfiltered Axe scans; final 58-sample audit passed. |

## Additional checks

- Simultaneous transfers cannot both spend the same available balance; simultaneous goal contributions cannot both allocate it. Allocations continue to leave balances and expense totals unchanged.
- Foreign budget, goal, note, recurring and category IDs are rejected. A mixed-owner import is atomic; submitted owner IDs, record IDs and source keys do not override trusted server values.
- Streamed request limits count actual bytes, including when `Content-Length` is absent or false. Split UTF-8 characters decode correctly. Malformed JSON, wrong origins and non-JSON mutations fail.
- Internal exceptions do not return or log their message payloads. Financial API errors remain private and non-cacheable.
- Browser checks cover failed loading and retry, failed writes without data loss, disabled pending submission, lost responses after real commits, session recovery, invalid import previews and CSV round trips.

## Execution status

The coordinated local run passed lint, TypeScript, all 264 unit/database/integration cases and the production build. The production browser flows passed, including real commit/lost-response/session-recovery checks and spreadsheet-safe CSV round trips. A separate process stop/start test confirmed persistence and retry identity. See the delivery report for the final browser/accessibility counts and the Actions run associated with the delivered commit; the presence of a test file alone is not treated as evidence.

The tests use disposable database fixtures and isolated demo sessions. Browser fault injection changes only test responses; a separate authenticated API context checks the actual stored ledger. Database concurrency cases also belong in the PostgreSQL CI job, because PGlite alone cannot exercise multiple PostgreSQL connections.

## Boundaries retained

Accounts remain manual, recurring posting is explicit, and currency totals remain separate. SMTP configuration and operational deployment controls are external prerequisites. Calculator assumptions and unsaved form drafts are temporary browser memory, not persisted financial records. These checks do not establish MFA, regulatory compliance, penetration-test completion or availability guarantees.
