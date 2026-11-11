# API and service setup

This guide describes the integrations implemented in Mizan Finance. No banking, payment, AI, foreign-exchange or analytics provider is required or silently enabled. Better Auth runs inside this application; it does **not** require a Better Auth cloud account or an API key.

The remaining external setup is a Node.js hosting environment, PostgreSQL for production, and optionally an SMTP service for password recovery. The same checked-in code works after configuring these values and restarting/redeploying. Live provider credentials, sender authorization, inbox delivery and production backups still need verification in the owner's accounts.

## Configuration contract

Copy `.env.example` to **`.env` in the project root** for local CLI and Next.js consistency. Next.js also accepts `.env.local`, but migration/seed/configuration CLI commands deliberately read `.env` and exported shell variables only. Environment variables already exported by the host take precedence. Never commit `.env`, paste secrets into a client component or use a `NEXT_PUBLIC_` prefix for these values.

| Variable | Service / purpose | Where to get it | Where to enter it | Secret? / requirement |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | PostgreSQL database and persisted financial/auth records | Database provider: a **direct** or **session-pooled** PostgreSQL connection string | Server environment; local `.env` for CLI | **Secret**; required for production |
| `BETTER_AUTH_URL` | Canonical application origin, trusted origin, cookies and reset callbacks | Your final HTTPS application URL | Server environment and local `.env` as appropriate | Public value; explicit HTTPS required for production |
| `BETTER_AUTH_SECRET` | Signing/encryption secret for authentication | Generate locally using the command below | Server secret store; `.env` only for local preview | **Secret**; at least 32 characters, random, required for production |
| `SMTP_URL` | Password-reset SMTP delivery | SMTP provider: hostname, port, SMTP username and password/API credential | Server secret store | **Secret**; optional, paired with `MAIL_FROM` |
| `MAIL_FROM` | Sender address, optionally `Mizan Finance <no-reply@your-domain>` | A sender/domain verified in your SMTP provider | Server environment | Not a credential; required when SMTP is enabled |
| `PGLITE_DATA_DIR` | Local persistent database directory | Choose a private local directory; default `data/pglite` | Local `.env` / shell | Local only; not a replacement for production PostgreSQL |
| `ALLOW_LOCAL_DB` | Explicit single-process preview exception | Set `true` only for a local production-build preview | Local preview shell | Nonsecret; requires a loopback `BETTER_AUTH_URL`; keep `false` in public production |

Generate the authentication secret privately and copy its output directly into your secret store:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Rotating this secret can invalidate existing signed sessions. Coordinate the rotation with deployment and keep the previous value in your secure recovery process, never in Git.

The following variables are tooling/runtime controls, not external service credentials:

| Variable | Default / purpose |
| --- | --- |
| `NODE_ENV` | Set automatically by Next.js (`development`/`production`) or the test runner (`test`). `check:config --production` validates production rules. |
| `PORT` | Next.js listening port; normally 3000. A command-line `--port` can override it. Match the externally visible origin in `BETTER_AUTH_URL`. |
| `NEXT_TELEMETRY_DISABLED` | Set `1` to disable Next.js tooling telemetry; CI uses this. It is unrelated to product user analytics. |
| `CAPTURE_URL` | Screenshot scripts' preview origin; default `http://localhost:3000`. Use isolated demo data. |
| `PLAYWRIGHT_PORT` | Browser-test server port, default 3100. Tests start a separate database/server. |
| `PLAYWRIGHT_USE_PRODUCTION` | `true` runs tests against a previously built production bundle; otherwise development server. |
| `FINANCE_TEST_DATABASE_URL` | **Secret if set**. Dedicated disposable test database only. Unit/integration tests never use the developer's ordinary `DATABASE_URL`. |
| `CI` | Provided by the CI host; enables CI retries/guards. Do not set it as a production application setting. |
| `NODE_EXTRA_CA_CERTS` | Optional Node.js setting: path to a trusted provider-issued private CA PEM. Set before the Node process starts. Never disable certificate verification as a workaround. |

## 1. PostgreSQL and hosting

1. Provision a private PostgreSQL 16+ database (CI tests PostgreSQL 17). Keep development, test and production databases separate. Enable provider backups and select retention appropriate to your data.
2. Create a database/user for Mizan. Migrations require permission to create/alter application tables and indexes. The app uses this role for migrations and normal reads/writes; it does not require a PostgreSQL superuser.
3. Allow outbound database traffic from the application host and allowlist only the required host/network at the provider. Do not expose an unrestricted database merely to make a connection succeed.
4. Copy the direct or **session-pooled** PostgreSQL URL into `DATABASE_URL`. Session affinity is needed for migration advisory locks and transactions; do not supply a transaction-pooling endpoint as the only connection URL.
5. Use the provider's verified TLS settings. A typical public-CA URL ends with `?sslmode=verify-full`. Encode special characters in credentials. If the provider uses a private CA, install/trust its documented certificate using `NODE_EXTRA_CA_CERTS` or supported PostgreSQL SSL URL settings. Do not use `rejectUnauthorized=false` or downgrade TLS.
6. Set the final HTTPS `BETTER_AUTH_URL`, generated `BETTER_AUTH_SECRET`, and leave `ALLOW_LOCAL_DB=false`. Set the same server variables for migration commands and application startup. No OAuth callback registration is required: authentication is email/password.
7. Run the checks/migrations/build below, deploy the application **including `drizzle/`**, and point the host's readiness probe at `/api/health?check=ready`.

```sh
npm ci
npm run check:config -- --production --database
npm run db:migrate
npm run build
npm start
```

`--database` opens a bounded connection and runs only `SELECT 1`; it does not migrate or write financial records. Runtime PostgreSQL connections time out after 5 seconds; SQL statements time out after 15 seconds (client query timeout 20 seconds). Pool size is capped at 10 per application process. A migration timeout fails startup/readiness rather than allowing an incomplete schema. Do not repeatedly retry a failing migration without checking its reason; see the [operations guide](OPERATIONS.md) for backups and rollback.

`GET /api/health` checks liveness and returns `{"status":"alive"}`. `GET /api/health?check=ready` validates core configuration and database readiness, returning `{"status":"ready"}` (200) or `{"status":"unavailable"}` (503). Its five-second response deadline bounds asynchronous waits, including the production PostgreSQL path. It is **not** a hard wall-clock deadline during synchronous local PGlite bootstrap: fresh database initialization copies many files through the embedded engine and can block the JavaScript event loop, so even the timer cannot run then. Cold initialization on the reviewed Windows filesystem took minutes while files were actively being written. Run `npm run db:migrate` for the selected local directory **before** the first server start, allow it to finish, and never open a second process against the same directory. Once local initialization completes, subsequent asynchronous readiness probes use the five-second deadline. The endpoint never returns database URLs, provider errors, user data or credentials. Readiness does **not** prove SMTP delivery, backups or every user flow.

## 2. Optional password-reset email

Mizan implements SMTP through Nodemailer and keeps token creation, one-time use, expiration and session revocation in Better Auth. Only password recovery sends mail. No newsletter, invitations, payment notifications, email-verification requirement or third-party account creation is hidden in setup.

1. Choose a provider that supplies SMTP credentials (username/password or an API credential usable as the SMTP password). OAuth-only mailbox integrations are outside this adapter; use the provider's supported SMTP credentials/relay instead.
2. Enable SMTP sending in the provider account. Complete sender/domain verification and the provider's required DNS records (typically SPF/DKIM, with DMARC according to your domain policy). Remove sandbox recipient restrictions if you intend to reach real users.
3. Obtain the SMTP host/port and SMTP-specific credentials. Set one of:

   ```text
   SMTP_URL=smtps://URL_ENCODED_USERNAME:URL_ENCODED_PASSWORD@SMTP_HOST:465
   SMTP_URL=smtp://URL_ENCODED_USERNAME:URL_ENCODED_PASSWORD@SMTP_HOST:587
   MAIL_FROM=Mizan Finance <no-reply@YOUR_VERIFIED_DOMAIN>
   ```

   Use **one** SMTP_URL. These are placeholders, not working credentials. URL-encode `@`, `:`, `/`, `%` and other reserved characters in the username/password. Paths, query options and fragments are deliberately rejected, so TLS/logging safety cannot be bypassed by URL options. Remote port 587 requires STARTTLS; port 465 requires `smtps://`. Certificate validation stays enabled. An unauthenticated relay is supported only when your provider intentionally authorizes the host; omit both credentials together.
4. Allow SMTP egress on the chosen host/port from your Node.js host. Set the canonical HTTPS `BETTER_AUTH_URL`; outgoing reset links use it. The implemented callback is `/api/auth/reset-password/<token>`, which redirects to `/reset-password` on the trusted app origin. No provider webhook or OAuth redirect URI is needed for SMTP.
5. Restart/redeploy, then run this explicit connectivity/authentication check:

   ```sh
   npm run check:config -- --production --smtp
   ```

   This sends **no message**. It cannot prove sender authorization, spam placement or inbox delivery.
6. For live verification, create/use an account **you control**, request a reset through `/forgot-password`, inspect its inbox/spam folder, follow the link, set a new password, verify old password/session rejection and sign in with the new password. Reusing the reset link must fail. This is the required final live check in the owner's provider; automated tests send only to an ephemeral loopback SMTP peer.

Both missing values disable recovery explicitly with a translated unavailable message. Partial/invalid SMTP configuration also disables recovery, while registration, login and financial functions continue independently. SMTP send/rejection failures return unavailability rather than successful delivery, even though the underlying auth library catches email callback failures. Normal reset responses remain conditional ("if this email exists") and do not confirm account membership. During an actual delivery failure, recovery is unavailable; request rate limits still apply.

SMTP connection/greeting limits are 10 seconds, DNS 5 seconds and socket inactivity 15 seconds. There are no automatic sends/retries after an ambiguous provider response, avoiding duplicate emails. A successful SMTP acceptance means the provider accepted the message, not that it reached the inbox. Diagnostics never print provider error text, recipient addresses, mail content, reset tokens or secrets.

## Local and demo operation

`npm ci`, `npm run db:migrate`, `npm run dev` need no external services. Finish `db:migrate` before starting the app, especially for a fresh local directory; cold filesystem initialization can take minutes on Windows. If `DATABASE_URL` is absent in development, PGlite persists locally; this is a documented local mode, not fallback after a remote database fails. If a configured PostgreSQL server is unavailable, the app fails clearly and does not switch databases.

For a production-build preview only, set a generated secret, `BETTER_AUTH_URL=http://localhost:3000`, `ALLOW_LOCAL_DB=true`, and a persistent local PGlite directory. Do not share that directory between migration commands and a running server. Keep public production on PostgreSQL.

The **Try the platform** button is an explicit, separate demo with isolated database-backed sample accounts. It does not deliver email or operate on real account rows. Expired demos can be cleaned with `npx tsx scripts/cleanup-demos.ts`; configure that administrative command on the host's scheduler if desired. Recurring transactions are processed by an explicit in-app action, not an unattended external integration.

## Verification status and references

The suite includes configuration validation/redaction tests, SMTP adapter tests, actual SMTP protocol tests against a disposable loopback-only peer, and a real Better Auth reset flow through the HTTP handler and test database. These prove code behavior under controlled conditions; they do **not** validate any real provider credential or inbox. Actual run results are recorded in the delivery report.

Official implementation references checked on 11 November 2026: [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables), [Nodemailer SMTP and verification](https://nodemailer.com/smtp), [Better Auth email/password recovery](https://better-auth.com/docs/authentication/email-password), [node-postgres pooling](https://node-postgres.com/apis/pool), and [PostgreSQL TLS through node-postgres](https://node-postgres.com/features/ssl).

Test-only storage: `PERSISTENCE_TEST_ROOT` optionally chooses the parent directory for fresh `persistence-<random-id>` fixtures created by `npm run check:persistence`; default: `data` relative to the project. It is not secret and is never used by the deployed app. A fast local disk is useful on Windows. Each run always creates a new isolated child directory; it never takes over an existing financial database.
