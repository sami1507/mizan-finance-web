# Mizan Finance — installation and operations

Start with the repository [README](../README.md), then [API_SETUP](API_SETUP.md) for exact environment variables and provider setup. This runbook covers the existing Next.js application and its manual personal-finance workflow; it does not add banking, payment, analytics or a new infrastructure platform.

## 1. Install from a clean checkout

Use Node.js **24** (the CI runtime), npm and a modern browser. The package supports Node.js 22.12+, but use the same major version as CI when reproducing a release. Keep `package-lock.json`; use `npm ci` rather than regenerating the lockfile. A PostgreSQL client is needed only for production backup/restore commands.

```sh
git clone <YOUR_PRIVATE_REPOSITORY_URL> mizan-finance-web
cd mizan-finance-web
npm ci
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`. Register a test account and finish onboarding, or explicitly choose **Try the platform** for an isolated sample workspace. No external service is required for local development. If a `.env` is needed, copy `.env.example` to `.env` and configure values as described in API_SETUP. Do not copy another environment's real database URL into local tests.

Without `DATABASE_URL`, development uses PGlite under `data/pglite/`. A missing PostgreSQL service does **not** cause a silent fallback: once `DATABASE_URL` is configured, that connection must work. Local data survives a browser refresh, sign-out and server restart. The generated development authentication secret is under `data/`; preserve it if preserving local sessions. Only one process may open a given PGlite directory. Stop the app before running migrations, seeding, cleanup, copying or restoring that directory.

For a fresh local directory, finish `npm run db:migrate` **before** the first app start. PGlite initializes an embedded PostgreSQL database and synchronously copies its system files to disk. On the reviewed Windows filesystem this cold step took minutes with observable write progress; it can block the server's JavaScript event loop if deferred until the first request. Allow initialization to finish rather than opening a second connection or repeatedly restarting it. A configured production PostgreSQL database uses the asynchronous network driver instead of this local bootstrap. Preserve any directory after an unexpected failure and inspect the cause; do not delete database files to bypass initialization errors.

`npm run db:seed` is optional and creates a dedicated sample-data workspace. Do not use seed as part of production release commands. Tests use separate disposable databases and screenshot scripts use explicit demo sessions; neither should point to a real user's session.

## 2. Check a release locally

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

To exercise the production build, set `PLAYWRIGHT_USE_PRODUCTION=true` in the command environment before the last command. Playwright starts its own server on port 3100 (or `PLAYWRIGHT_PORT`) and uses its own test data directory. Do not point `FINANCE_TEST_DATABASE_URL` to production: it is an explicit **disposable integration-test database** setting.

For a manual local preview of the production bundle, configure these values in the local environment:

```text
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=<GENERATED_RANDOM_SECRET>
ALLOW_LOCAL_DB=true
PGLITE_DATA_DIR=./data/preview
```

Leave `DATABASE_URL` unset for that local preview, initialize its directory while the app is stopped, then run `npm run build` and `npm start`. This exception is accepted only with a loopback origin. Public production requires PostgreSQL and must leave `ALLOW_LOCAL_DB=false`.

## 3. Prepare and release to production

Use a Node.js host with Next.js server rendering, access to your PostgreSQL instance and optional SMTP egress. Keep the application and database close enough to avoid unnecessary latency. Do not publish the database itself or put database credentials in a browser environment variable.

1. Provision PostgreSQL 16+ (the CI integration service uses 17), a database and an application role with required migration permissions. Obtain the provider's direct or session-pooled connection URL and verified TLS settings.
2. Configure the final HTTPS `BETTER_AUTH_URL`, a random `BETTER_AUTH_SECRET`, `DATABASE_URL` and optional SMTP values in the host's **server** secret/environment settings. See API_SETUP for details and sender/DNS verification. Put the same values in the environment used by migration commands.
3. Configure HTTPS and a reverse proxy or the host's managed ingress. Forward only the intended application hostname. The canonical URL must match the address users open. Set it before the build because public metadata and sitemap use it at build time.
4. Take and verify a pre-release database backup. Keep the prior tested application artifact/commit and its compatible lockfile. Review migration files before running them.
5. Install, check configuration/connectivity, migrate and build:

   ```sh
   npm ci
   npm run check:config -- --production --database
   npm run db:migrate
   npm run build
   npm start
   ```

6. Deploy the application with `drizzle/`, static assets and its runtime dependencies. Do not ship `.env`, development databases, logs, test output or backup files as public assets. Do not use `next export`: this product needs its server and database.
7. Configure liveness/readiness probes and perform the release smoke test below before routing normal users to the new instance. A startup command succeeding alone is not sufficient.

Pending migrations are also applied when the database opens. PostgreSQL migration execution uses a session advisory lock, so direct/session-pooled connections are required; transaction-pooling endpoints are not interchangeable here. A migration failure fails readiness instead of permitting partial operation. Avoid launching repeated failing instances without inspecting the cause.

When self-hosting, place the Node process behind a reverse proxy. The proxy should overwrite client-supplied forwarding headers, apply reasonable request/body/time limits, terminate HTTPS correctly and forward only trusted client-address information. Application auth/demo limits are process-local and are not a shared distributed limiter. For multiple instances, configure host/ingress limits for sign-in, sign-up, password recovery and demo creation; do not trust arbitrary `X-Forwarded-For` headers from direct internet traffic. Keep the app port reachable only through the trusted ingress when possible. This follows the deployment model described in [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting).

The database pool is limited per process; budget the total across all replicas against the provider's connection limit. Do not add public CDN caching to authenticated pages or financial API responses. Static versioned assets may be cached. Financial responses explicitly use private/no-store headers.

## 4. Health, diagnostics and routine tasks

| Check/task | Expected behavior | Operator action |
| --- | --- | --- |
| `GET /api/health` | 200, `{"status":"alive"}` | Process liveness only; not a database/mail guarantee |
| `GET /api/health?check=ready` | 200 `ready`, or 503 `unavailable` | Validates core config and a database probe; asynchronous waits have a five-second response deadline, but synchronous fresh PGlite initialization can block that timer. Initialize local data with `db:migrate` before starting the server. |
| `npm run check:config -- --production` | Syntax/required values pass with no secret output | Resolve named configuration errors; optional SMTP absence is reported |
| Add `--database` | Bounded connection + `SELECT 1`, no writes | Verify network, TLS and credentials before migrating |
| Add `--smtp` | Connect/authenticate, **no mail sent** | Does not prove sender authorization or inbox delivery |
| `npx tsx scripts/cleanup-demos.ts` | Removes expired demo-owned datasets | Run periodically using the host's task scheduler; use the production environment and one process at a time for local PGlite |
| Record due recurring items | Explicit action inside the user's workspace | Schedules are not posted automatically in the background; the action is intentional product behavior |

Demo sessions expire after 24 hours. Expiry prevents further session use; physical removal occurs when cleanup runs. Set cleanup frequency and monitor its exit status. The command is an administrative maintenance task, not a public unauthenticated endpoint. Do not expose the CLI through an HTTP route.

Use host monitoring for availability, response latency, resource use and database saturation. Store logs with access control and retention. Safe application diagnostics intentionally avoid database connection strings, financial request payloads, email bodies and reset tokens. Review reverse-proxy logging too: password-reset URLs contain tokens, so redact query strings and the `/api/auth/reset-password/<token>` path segment in access/error logs. Never enable SMTP protocol debug logging in production.

If readiness fails, check configuration syntax, provider reachability/TLS, connection limits and migration permissions in that order. Do not delete database files, disable TLS, bypass authentication, or repeat writes to resolve a generic error. If a mutation response was lost, the UI's idempotency mechanism allows retrying the same request; do not manually repeat a financial action with a new identifier before checking its result.

## 5. PostgreSQL backup and restore

Enable provider-managed backups/point-in-time recovery where available. Choose retention, backup frequency and recovery objectives according to the data actually held. Keep at least one recovery copy outside the application host and test restoration periodically. Database backups contain private financial records, account identifiers and password hashes; encrypt them, restrict access and never commit or place them under `public/`.

The following portable logical-backup workflow supplements provider backups. It has **not** been exercised against the owner's managed production provider. Use PostgreSQL client tools compatible with the server (prefer the matching major version); `pg_dump` must not be older than the server major version. Provider roles, extensions and restore privileges must be checked in a separate database before relying on this procedure.

### Keep credentials out of command lines

Create a private `pg_service.conf` outside the repository. Use the documented libpq location or set `PGSERVICEFILE` to its absolute path. Define services for the source and a **new, empty restore-test database**; values below are placeholders:

```ini
[mizan_backup]
host=YOUR_DATABASE_HOST
port=5432
dbname=YOUR_PRODUCTION_DATABASE
user=YOUR_AUTHORIZED_BACKUP_ROLE
sslmode=verify-full

[mizan_restore]
host=YOUR_DATABASE_HOST
port=5432
dbname=YOUR_NEW_EMPTY_RESTORE_DATABASE
user=YOUR_AUTHORIZED_RESTORE_ROLE
sslmode=verify-full
```

Add the provider's `sslrootcert` setting if its certificate chain requires it. Put passwords in a separately protected passfile, never in this document or shell history. Set `PGPASSFILE` to that file's absolute path; each entry follows the provider's host/port/database/user with the password in libpq passfile format. Set owner-only access (0600 on Unix; a restricted user ACL on Windows). Do not share this file, print it in CI or store it in Git. Environment values `PGSERVICEFILE`, `PGSERVICE` and `PGPASSFILE` reference paths/service names, not inline credentials. See the official [connection service-file](https://www.postgresql.org/docs/current/libpq-pgservice.html) and [password-file](https://www.postgresql.org/docs/current/libpq-pgpass.html) documentation for the format and platform-specific locations.

### Produce and inspect a backup

Set `PGSERVICE=mizan_backup` and the two file-path variables in the shell/host environment. For example, in PowerShell:

```powershell
$env:PGSERVICEFILE = 'C:/Private/Mizan/pg_service.conf'
$env:PGPASSFILE = 'C:/Private/Mizan/pgpass.conf'
$env:PGSERVICE = 'mizan_backup'
pg_dump --format=custom --file='C:/Private/Mizan/backups/mizan-pre-release.dump'
pg_restore --list 'C:/Private/Mizan/backups/mizan-pre-release.dump'
```

Choose an existing restricted backup directory and a unique file name for each backup; do not overwrite the last known good copy. Check command exit codes, size and storage integrity, and record the application commit/migration set with the backup. Listing the archive proves it can be read, **not** that restoration succeeds. The custom archive format supports inspection and selective restoration; its behavior is documented in [PostgreSQL SQL dumps](https://www.postgresql.org/docs/current/backup-dump.html).

### Restore without touching the source

1. In the provider console, create a new, empty database dedicated to restoration. Do not use the production database name. Confirm its host, name and intended role before writing anything.
2. Point `mizan_restore` at that database. Keep the source backup service unchanged. Grant the restore role the permissions required to create Mizan's schema.
3. Run the following against the restore service. It omits ownership/ACL restoration to avoid applying provider-specific roles. Reapply the intended least-privilege access separately.

   ```sh
   pg_restore --dbname=service=mizan_restore --no-owner --no-acl --exit-on-error --single-transaction /PRIVATE/BACKUP/PATH/mizan-pre-release.dump
   ```

   This intentionally has no `--clean`, `--create`, `DROP` or source-database overwrite. `--single-transaction` makes a failed restore roll back rather than leave a partly restored database; it is incompatible with parallel restore jobs. See the official [pg_restore reference](https://www.postgresql.org/docs/current/app-pgrestore.html).
4. Run an isolated application instance against the restored database with a distinct staging origin/secret and **SMTP disabled**. Restrict access to that instance; restored data remains personal data even during recovery testing. Do not let it send real reset emails or share production cookies.
5. Check migrations, table/record counts, readiness and the intended financial relationships. Confirm representative balances/transactions under authorized account access, not by publishing dumps or user data in logs. Use a synthetic account for destructive test workflows. Run any required forward migration against this restored copy first.
6. Record restore duration, application commit, checks and results. Keep the active production service unchanged until an authorized cutover is planned. A successful test should not automatically replace production.

If the provider only supports managed snapshot restoration, use its restore-to-new-instance workflow, then follow the isolated verification steps. Do not infer that a backup is recoverable solely because a provider labels it successful.

### Local PGlite copies

For local development only, stop every process using the chosen PGlite directory, copy the complete directory to a private backup location, and preserve the development auth secret separately if session continuity matters. Test a copy under a **different** `PGLITE_DATA_DIR`; never replace a live/open directory. PGlite file copies are not a substitute for the supported PostgreSQL production backup plan.

## 6. Rollback and failed releases

An application rollback and a data restore are different actions. Prefer rolling back the application artifact first when the old version is schema-compatible. Keep the last tested commit/artifact and lockfile; deploy them without force-pushing or rewriting repository history.

The delivery migration `0004_mutation_requests.sql` is additive: it creates retry-identity bookkeeping and an owner-scoped unique index. Rolling the application back to the immediately preceding version can leave this table in place; do not drop it or delete user data merely to match the older schema. Check the actual migration set for every future release rather than assuming all migrations are additive. An older application also lacks newer fixes, including retry protection, so assess that tradeoff before reopening write traffic.

For a failed migration, stop new write traffic, retain the failed release logs with secrets redacted, and investigate the recorded migration state. PostgreSQL migrations execute transactionally one file at a time; never manually mark a failed migration as applied. Test a corrective forward migration against a restored copy first.

If a data restore is required, restore the verified backup to a **distinct database**, validate it as above, then plan an explicit connection cutover. Account for writes made after the backup; a blind restore can lose valid transactions. Keep the original database intact until reconciliation and recovery are confirmed. This runbook does not authorize destructive production actions.

## 7. Privacy and operator responsibilities

This section describes product behavior, not a lawyer-approved privacy policy or terms of service.

- The server stores authentication records/sessions, profile preferences, manually entered accounts, transactions, categories, transfers, budgets, goals/contributions, recurring definitions, notes and retry/processing bookkeeping. Password handling is delegated to Better Auth; raw passwords are not financial records.
- Browser storage is limited to presentation preferences. Authentication uses cookies; simulator and savings-calculator assumptions are temporary UI state and are not written to the financial ledger or browser storage. Financial data comes from authenticated, owner-scoped server operations.
- An explicit demo creates a separate database-backed sample workspace. It does not silently become a real account or fall back into an authenticated user's data. Demo expiry and cleanup are described above.
- There is no bank connection, payment execution, advertising tracker, external AI model or investment-advice integration. Optional SMTP sends password-reset messages to the configured provider; the provider necessarily receives recipient and reset-email contents for delivery. Fonts and brand assets are self-hosted.
- Users can download their own financial data as CSV/JSON and request account deletion with explicit confirmation. Application deletion removes the owner's live records/sessions. It cannot instantly erase older operator backups; backup retention and eventual expiration are operational responsibilities.
- CSV import duplicate detection compares row content; genuinely identical purchases may require manual entry of the second transaction. Do not silently discard a user's original CSV file based only on successful import.

Before opening the service to real users, the operator must provide its identity/contact channel, hosting/database/mail providers and locations, support/deletion contact, retention/backup policy and any applicable legal notices. Review these with appropriate advice for the actual audience/jurisdiction. Do not publish placeholder legal claims or say the product has an independent security certification, MFA or email verification that is not implemented.

## 8. Final live acceptance checklist

Complete this in the owner's configured environment, using controlled test accounts and synthetic transactions:

1. Configuration and direct PostgreSQL connectivity checks succeed; readiness returns 200 over the final HTTPS origin.
2. Register, sign in, complete onboarding, record income/expense, transfer within one currency, create a budget and a goal, export data, sign out/in and restart the app. Confirm balances and persistence.
3. Use a second test account to confirm isolation. Confirm private pages/API responses are not publicly cached or indexed.
4. If SMTP is enabled, perform the real reset/inbox/one-time-token/session-revocation checks in API_SETUP. An SMTP connection check alone does not complete this step.
5. Check Arabic, English, Hebrew and German, light/dark modes and a phone-size viewport on the deployed host; inspect browser/server errors without logging sensitive payloads.
6. Restore a backup into a new empty database and record the successful recovery test. Confirm demo cleanup and monitoring run as intended.

The repository's CI and local test results belong in the current delivery report/PROJECT_STATE. This runbook does not claim that a managed provider deployment, real inbox delivery or production backup restoration has already been tested. Until those owner-environment checks pass, the accurate status is **ready for configuration and live verification**.
