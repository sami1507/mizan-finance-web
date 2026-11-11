# Mizan delivery state

Updated: 2026-11-12. Baseline: `b412026`. Scope: finish and verify the existing four-language personal-finance product while preserving its ledger, manual-account model and established identity. No new public hosting, paid service or real mail was used in this delivery pass.

## Acceptance map

| Requirement | Delivered implementation | Verification/state |
| --- | --- | --- |
| Authentication, onboarding, owned ledger, accounts, budgets, goals, recurring, reports and notes | Existing features preserved; error/session recovery and submission guards hardened | 264 unit/integration and 23 production browser tests passed |
| Four languages, RTL/LTR, themes, responsive UI | Arabic/English/Hebrew/German; narrow-table keyboard focus repaired | 58 final samples: no reported Axe violations, overflow or browser errors; keyboard regression passed |
| Purchase simulator and maximum monthly savings | Exact calculation engines, real-data input, transparent temporary assumptions | Calculation and browser regressions passed |
| Brand/logo/assets/fonts | Shared vector mark; SVG/transparent PNG/monochrome/icon/social assets; font/license guide | Generated and visually reviewed |
| Safe retry after lost response | Owner-scoped persisted payload hash/result in atomic mutation; stale-workspace guard | Concurrent write, lost response, expired session and real restart checks passed |
| CSV export/import | Explicit formula-escape marker preserves notes and duplicate identity | Exact tests and real browser round trip passed |
| Optional SMTP recovery | TLS/timeouts/acceptance handling, scoped configuration, no automatic resend | 43 config/mail/health/recovery cases passed; live provider remains external |
| Configuration and operations | Matching `.env.example`, API_SETUP, health, migrations, backup/restore/rollback | Local success / missing-production failure verified; owner provider setup required |
| Static/build/dependencies | Clean installation, lint, types, production build | Passed; 264 tests in17 files; npm audit: 0 known vulnerabilities |
| Delivery GitHub CI | Private existing repository, normal main push | Published on main; implementation SHA `37c55a0` matched remote; [both CI jobs passed](https://github.com/sami1507/mizan-finance-web/actions/runs/43110075031) |
| Live hosted PostgreSQL/HTTPS/mail/backups | Fully documented provider configuration and acceptance steps | Owner settings + live verification required |

## Decisions and resume context

- Keep Next.js, TypeScript, Tailwind, Drizzle, Better Auth and PostgreSQL/PGlite. Financial records remain on the server; localStorage is only presentation preferences.
- The source checkout `mizan-finance-web/` is now also the working runtime after a successful clean `npm ci`. The previous D-drive runtime was much slower; do not synchronize its data, dependencies or Git metadata into this folder.
- Git's administrative directory remains at the location referenced by the existing `.git` file. Do not replace that pointer or create a second Git history.
- Production requires a configured PostgreSQL connection and HTTPS origin/secret. PGlite is local/single-process only. SMTP is optional for financial workflows but required for password recovery.
- Manual recurring posting and currency-separated totals are deliberate existing boundaries. No banking/payment/FX/AI integration or new public service is added.
- Delivery migration 0004 is additive. Never destructively reset a real database to apply it.
- Access review found and fixed the brand accessible-name mismatch and narrow scroll-table keyboard issue. Full Axe checks retain all WCAG 2/2.1 A/AA rules.
- Faster source-drive runs reached the intentional 10 demo/minute limit; test fixtures must respect 429 and wait/retry, not weaken production protection.

## Evidence and remaining work

Fresh install, lint, TypeScript,264 unit/database/integration tests, production build and actual stop/start persistence check passed. All 23 production browser tests passed after the demo fixture was made to respect the existing request limit. The final 58-sample visual/accessibility audit passed with no reported violations, overflow or browser errors; 15 fresh captures were reviewed. A separate read-only review found no actionable configuration/documentation/secret issues in 85 changed/new text files. The implementation was committed and pushed normally to the private repository. Local and remote SHA matched `37c55a09760184ae1bc8034063624de67020105a`; both [GitHub CI jobs](https://github.com/sami1507/mizan-finance-web/actions/runs/43110075031) passed (Linux quality/build/persistence/23 browser flows and PostgreSQL 17 integration). The final documentation follow-up records these observed results. Only provider configuration, operator setup and live acceptance remain external.

Documentation entry point: README. Detailed provider setup: docs/API_SETUP.md. Recovery/operations: docs/OPERATIONS.md. Brand: docs/BRAND.md. Final evidence: docs/DELIVERY_REPORT.md. Independent review coverage: docs/QA_REVIEW.md.

The final full tracked-file scan covered 233 files: no prohibited private-data paths, detected provider-token/private-key patterns or broken local documentation links. The manual contrast follow-up is in docs/verification/contrast-review.md. It resolves the sampled Axe incomplete items without hiding them or claiming full certification.
