# Raihan Portfolio

A React + TypeScript + Vite portfolio with Hero, About, Skills, Projects, AI & Research, Achievements, Contact, and a Go + MongoDB content API for `/admin`. Travel is postponed. The admin uses authenticated, revocable cookie sessions.

## Visual direction

A quiet developer and AI research aesthetic: near-black graphite, cool neutral text, restrained cyan highlights, and a secondary violet accent. Subtle radial gradients add depth to the page. Content will sit on bordered surfaces, with glass reserved for small areas that benefit from translucency.

System sans-serif typography prioritizes readable prose; monospace is available for technical labels and code. Fluid heading sizes and page gutters scale between mobile and desktop. A 72rem content limit and 65ch reading measure keep future sections focused.

Avoid decorative dashboards, glowing borders, background animation, and unverified metrics. Use whitespace, type hierarchy, and real work to establish the engineering and research character.

## Design foundation

`src/styles/global.css` is the source of truth for reusable design tokens:

| Purpose | Tokens |
| --- | --- |
| Background and surfaces | `--color-background`, `--color-surface`, `--color-surface-raised`, `--color-surface-glass`, `--gradient-page` |
| Text | `--color-text`, `--color-text-muted` |
| Accents | `--color-accent`, `--color-accent-hover`, `--color-accent-secondary`, `--color-accent-soft`, `--gradient-accent` |
| Borders and focus | `--color-border`, `--color-border-strong`, `--color-control-border`, `--border-width`, `--color-focus`, `--focus-width`, `--focus-offset` |
| Spacing and layout | `--space-*`, `--layout-max-width`, `--layout-gutter`, `--layout-section-space`, `--measure-text` |
| Shape and depth | `--radius-*`, `--shadow-*`, `--blur-surface` |
| Typography | `--font-sans`, `--font-mono`, `--text-*`, `--font-weight-*`, `--line-height-*`, `--tracking-*` |
| Motion | `--duration-fast`, `--duration-normal`, `--ease-out` |

Use semantic tokens in future component styles instead of copying color or spacing values. Shared opt-in classes cover the basics:

- `.container` provides centered content with fluid side gutters.
- `.stack` provides vertical spacing; override `--stack-gap` locally when needed.
- `.cluster` provides a wrapping horizontal group; override `--cluster-gap` locally when needed.
- `.surface` provides a solid bordered panel. Combine it with `.surface--raised` or `.surface--glass` for the corresponding treatment. Glass falls back to the solid surface without backdrop-filter support. Surface padding belongs to the component.

Use accent colors sparingly for links, focus, and meaningful emphasis. Keep secondary prose readable with `--color-text-muted`. Keyboard focus uses a visible cyan outline; links retain underlines. The CSS honors reduced-motion preferences. Future Framer Motion components should also honor them through `useReducedMotion` or `MotionConfig reducedMotion="user"`, since JavaScript animations need their own handling. Prefer short opacity or transform transitions over looping effects.

## Getting started

```sh
npm install
npm run dev
```

On Windows PowerShell, use `npm.cmd` instead of `npm` if script execution is disabled.

## Project structure

```text
src/
  main.tsx           React entry point
  App.tsx            App shell for future sections
  styles/
    global.css       Design tokens, base styles, and layout/surface primitives
```

Add shared components and portfolio sections when they are needed. Place imported images in `src/assets/` and files served directly in `public/`.

`lucide-react` and `framer-motion` remain installed for later milestones. Use Lucide icons consistently and keep Framer Motion animations restrained when components are introduced.

## Checks

```sh
npm run typecheck
npm run build
node --test tests/*.test.mjs
npm run preview
```

The build checks TypeScript and writes production output to `dist/`. Preview serves that output locally.

## Replacing the profile photo

Replace `src/assets/profile-400.jpg`, or use the same `profile-400` filename with `.jpeg`, `.png`, `.webp`, or `.avif`. Keep one matching photo file and refresh the page after replacing it; rebuild for production. The Hero preserves its circular crop and shows an accessible initials fallback if the photo is missing or fails to load.

## Optional GA4 analytics

Analytics runs only on the public portfolio, not on the `/admin` workspace.

Analytics is disabled when `VITE_GA_MEASUREMENT_ID` is empty, missing, or malformed. No Google script or analytics request is made in that case.

1. Later, [create a GA4 property and Web data stream](https://support.google.com/analytics/answer/9304153), then copy its Measurement ID (starting with `G-`) from **Admin → Data streams → your Web stream**.
2. Before enabling the ID, **turn off Enhanced measurement** for that stream. This prevents automatic outbound-link, form, search, and history tracking from capturing contact details or duplicating page views. See [Google's Enhanced Measurement settings](https://support.google.com/analytics/answer/9216061). Do not enable user-provided data collection or add custom events containing personal information.
3. Copy `.env.example` to `.env.local` and fill in `VITE_GA_MEASUREMENT_ID=` locally. Never commit the real configured value or local environment files. For a hosted build, set the same variable in the host's build environment.
4. Restart Vite after changing local configuration; rebuild production output after changing deployment configuration. [Vite embeds `VITE_*` values in the browser bundle](https://vite.dev/guide/env-and-mode), so the Measurement ID is public configuration, not a secret. Never put passwords or API secrets in these variables.

`src/lib/analytics.ts` loads Google's tag asynchronously from an application mount effect and queues one manual `page_view` per document, including under React StrictMode. Section anchors do not create extra page views. The event uses the configured base URL, a generic `Portfolio` title, and an empty referrer; it does not read URL queries/fragments, contact links, forms, or personal content. Do Not Track and Global Privacy Control disable initialization.

Analytics/ad storage consent remains denied, Google Signals and ad personalization are disabled, and URL passthrough is off. [Google can still send cookieless measurement pings](https://support.google.com/analytics/answer/13802165); this integration does not promise fully anonymous measurement or full visitor/session reporting. No user IDs, user properties, or personally identifying custom data are added.

## Admin authentication and Go + MongoDB backend

`/admin/login` signs in to `/admin`. The frontend checks `GET /api/auth/me` before mounting the dashboard, redirects anonymous or expired sessions to login, and rechecks on focus, visibility changes, and every minute. Projects, achievements, publication changes, loading/error states, and persisted CRUD remain API-backed. Public portfolio sections retain their existing design; admin routes do not initialize analytics.

Passwords are stored only as bcrypt hashes (cost 12) in MongoDB. A login creates a cryptographically random, HMAC-SHA256-signed session cookie; MongoDB stores a SHA-256 hash of the session identifier in `admin_sessions`. The cookie is HttpOnly, SameSite=Strict, host-only, and short-lived. Secure cookies use the `__Host-` prefix. The server checks expiry and admin authorization on every protected request, independently of MongoDB TTL cleanup. Login rotates a browser's previous session; logout deletes the server record before clearing the cookie. No credentials are placed in localStorage, sessionStorage, URLs, frontend environment variables, logs, or authentication JSON responses.

This approach follows [OWASP's session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). Exact-origin checks and a non-secret `X-Admin-Request: 1` header on unsafe requests supplement SameSite cookies and force browser CORS preflight, following [OWASP's custom-header guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). This header is a request marker, not an authentication credential.

Requirements: Go 1.25+, Node/npm, and a running MongoDB Community server or accessible Atlas database. The backend uses the [official MongoDB Go driver v2](https://www.mongodb.com/docs/drivers/go/current/).

```text
backend/
  main.go               startup, timeouts, graceful shutdown
  go.mod / go.sum       dependencies
  .env.example          configuration placeholders
  config/               environment validation
  auth/                 bcrypt, signed cookies, MongoDB sessions, middleware, rate limits
  cmd/create-admin/     explicit first-admin initialization
  models/               content validation
  repository/           MongoDB content persistence
  handlers/             JSON CRUD and health
  routes/               public/protected endpoints and credentialed CORS
```

### Local setup and first admin

From the repository root:

```sh
cd backend
cp .env.example .env
# Edit this ignored file locally; never commit credentials.
go mod download
```

PowerShell can use `Copy-Item .env.example .env`. Run backend commands inside `backend/` so `.env` loads correctly; existing process variables take precedence.

| Variable | Configuration |
| --- | --- |
| `MONGODB_URI` | Required private connection URI; no default |
| `MONGODB_DATABASE` | `raihan_portfolio` by default |
| `HOST`, `PORT` | `127.0.0.1`, `8080` for local use |
| `SESSION_SECRET` | Required base64-encoded 32–64 cryptographically random bytes |
| `SESSION_TTL_MINUTES` | 30 by default; allowed range 5–60 |
| `APP_ENV` | `development` or `production` |
| `COOKIE_SECURE` | `false` for local HTTP; **true required in production** |
| `CORS_ORIGINS` | Exact comma-separated frontend origins; local 5173/4173 origins default in development; explicit HTTPS origins required in production |
| `ADMIN_USERNAME` | First-admin setup only; 3–64 ASCII letters, digits, dots, underscores, or hyphens; normalized to lowercase |
| `ADMIN_PASSWORD` | First-admin setup only; at least 12 characters, at most 72 UTF-8 bytes, no control characters |

Generate the session secret locally and paste its output into the ignored backend `.env` or your backend host's private environment:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Set `MONGODB_URI`, `ADMIN_USERNAME`, and a strong unique `ADMIN_PASSWORD` locally, then explicitly initialize the first admin:

```sh
go run ./cmd/create-admin
```

The command creates a single admin in `admins`, stores only a bcrypt hash, and refuses to overwrite an existing account, even if repeated with different credentials. Server startup never creates or resets an admin. After successful setup, **remove `ADMIN_PASSWORD` and preferably `ADMIN_USERNAME` from the backend environment and `.env`**; save the password in your password manager. Login checks the initialized database record, not environment credentials. Configure `SESSION_SECRET`, then start:

```sh
go run .
```

In another terminal at the repository root:

```sh
cp .env.example .env.local
# Optionally set VITE_API_BASE_URL=/api for API-backed public content.
npm run dev
```

Open `/admin/login`. An unset `VITE_API_BASE_URL` keeps bundled public content and still uses `/api` for admin calls. Vite development and preview forward `/api` to the local Go server. Use the same hostname throughout development (for example, 127.0.0.1 on both ports) so SameSite cookies work. A full API URL must end with `/api`, use the same site as the frontend, and have its frontend origin allowed by `CORS_ORIGINS`. Do not put any MongoDB credentials, admin password, or session key in `VITE_*` values; Vite embeds them in browser bundles.

### Endpoints and data

| Method | Endpoint | Access and result |
| --- | --- | --- |
| GET | `/api/health` | Public database health |
| POST | `/api/auth/login` | Validated credentials; signed cookie and display-only session response |
| GET | `/api/auth/me` | Authenticated admin; username and absolute expiry |
| POST | `/api/auth/logout` | Revoke the supplied session and expire cookie; idempotent without a session |
| GET | `/api/projects`, `/api/achievements` | Public **published records only**, including default requests |
| GET | `/api/projects?scope=admin`, `/api/achievements?scope=admin` | Authenticated admin; all records |
| POST | `/api/projects`, `/api/achievements` | Authenticated admin; create, 201 |
| PUT | `/api/projects/:id`, `/api/achievements/:id` | Authenticated admin; update/publish, 200 |
| DELETE | `/api/projects/:id`, `/api/achievements/:id` | Authenticated admin; delete, 200 |

JSON responses use arrays for lists, records for create/update, and `{ "error": "…" }` for errors. Missing/invalid sessions return 401, forbidden roles/origins/request markers 403, invalid inputs 400, missing content 404, unsupported methods 405, rate limits 429 with Retry-After, and database/server errors 500. Authentication errors do not reveal whether a username exists. Credentialed CORS returns only configured exact origins, never wildcard origins.

Collections are `projects`, `achievements`, `admins`, and `admin_sessions`. Content retains ObjectID hex-string IDs, server-owned UTC timestamps, and existing confirmed fields. Updates preserve creation time. Session expiry has a MongoDB TTL index plus immediate server checks; TTL deletion can be delayed without extending access. Admin hashes are excluded from JSON serialization. MongoDB needs durable storage; browser state is not a database.

Project bodies accept required `title`, `status` (`Completed` or `In Progress`), `description`, `published`, plus `technologies`, `category`, `icon`, and `technologyLabel` (`Technologies` or `Proposed stack`). Achievement bodies accept required `title`, `event`, integer `year` (1900–9999), `result`, `published`, and optional `description`, `team`, `division`. POST/PUT require one JSON object, application/json, an explicit boolean publication flag, no unknown/client metadata fields, and a 64 KiB limit. Login bodies have a 4 KiB limit.

### Import confirmed portfolio content

The explicit `npm run seed:backend` command imports `src/data/projects.ts` and `src/data/achievements.ts` through protected API requests. It requires the existing admin username/password in **server-side CLI process environment variables** `ADMIN_USERNAME` and `ADMIN_PASSWORD`, signs in, keeps the cookie only in process memory, and signs out afterward. It does not automatically read `backend/.env`. Remove those process variables afterward. Never use `VITE_*` credential variables.

Optional CLI-only settings: `PORTFOLIO_API_BASE_URL` (defaults to `http://127.0.0.1:8080/api`) and `PORTFOLIO_FRONTEND_ORIGIN` (defaults to `http://127.0.0.1:5173`; must match a configured allowed origin). Matching project titles or achievement event/year pairs are skipped; existing edits and publication flags remain unchanged. Failed/partial imports report errors and can be retried. Rerunning after deleting/renaming a source record can intentionally re-import it.

Public content uses MongoDB only when `VITE_API_BASE_URL` is nonempty. Configured public reads omit credentials and never fall back to bundled content on errors/empty results, respecting publication and deletion. Rebuild or restart Vite after changing frontend environment configuration.

### Verification

From `backend/`:

```sh
gofmt -w main.go main_test.go auth cmd config models repository handlers routes
go test -count=1 ./...
go vet ./...
go build -o bin/portfolio-api .
go build -o bin/create-admin ./cmd/create-admin
```

Unit tests exercise authentication, validation, protected handlers, cookies, expiry/tampering, revocation, CSRF, credentialed CORS, rate limits, safe errors, and failed connections without MongoDB. Set `MONGODB_TEST_URI` to run real content/session persistence and graceful-shutdown tests; these create/drop only unique `portfolio_test_*` databases and require test database permissions.

From the repository root:

```sh
node --test tests/*.test.mjs
npm run typecheck
npm run build
git diff --check
```

For live HTTP authentication/CRUD checks, explicitly set `PORTFOLIO_API_TEST_URL` to a development/test API's full `/api` URL and provide its initialized `ADMIN_USERNAME` and `ADMIN_PASSWORD` in process environment. Run `node --test tests/backend-api.test.mjs`; this creates/deletes only its own fixture IDs and verifies anonymous writes are blocked, authenticated CRUD persists, unpublished records stay private, and logout prevents cookie replay. Do not run these mutation tests against production.

### Deployment requirements and limitations

Production must set `APP_ENV=production`, `COOKIE_SECURE=true`, explicit HTTPS `CORS_ORIGINS`, a fresh private random `SESSION_SECRET`, private MongoDB configuration, and HTTPS for both frontend and API. Prefer serving `/api` through the same site's reverse proxy; cross-site authentication is intentionally unsupported by SameSite=Strict. Set HOST appropriately for your host, keep MongoDB network access restricted, and configure SPA fallback for `/admin` and `/admin/login`. This repository does not deploy services or issue TLS certificates.

API responses set no-store, nosniff, frame denial, a restrictive API CSP, and no-referrer; production also sets HSTS. These headers do not configure the separately hosted React HTML: configure its CSP, frame protection, and HTTPS headers at the frontend host. HttpOnly prevents JavaScript from reading a session but does not prevent malicious same-origin code from sending authenticated requests; XSS prevention and trusted dependencies still matter.

Login limits are in-memory per process (5 attempts/source IP/minute and 30 total/minute) and reset on restart. Forwarded IP headers are deliberately ignored; behind a proxy, clients may share its IP quota. Multiple API instances need trusted-proxy configuration and shared/distributed rate limiting. Add deployment monitoring, dependency updates, backups, and appropriate account recovery/MFA before treating this as a production-hardened system. No password-reset or MFA UI is implemented. Absolute expiry is enforced; there is no sliding renewal or separate idle timer. Rotating SESSION_SECRET invalidates all previously signed cookies; logout revokes the current session only.

The server verifies MongoDB before listening, bounds operations with contexts, shuts down HTTP gracefully, and disconnects MongoDB. Database failures do not fake login, logout, or CRUD success. Logs use operation categories without raw driver messages, credentials, cookies, or request bodies.

## Production checklist

- **Frontend configuration:** set `VITE_SITE_URL` to your actual HTTPS homepage, including any deployment subpath. Leave it blank until the domain is known; canonical, `og:url`, and absolute sharing-image URLs are omitted rather than guessed. Set `VITE_API_BASE_URL=/api` when the host proxies the Go API, or supply its HTTPS URL on the same site. An unset API variable preserves bundled public content. Invalid URL configuration fails the build without echoing values. All `VITE_*` configuration is public; never include secrets. Rebuild after changes.
- **Metadata and assets:** the title, description, keywords, Open Graph, and Twitter/X metadata are injected into the built HTML, so social previews do not depend on React rendering. `public/favicon.svg` uses the RC identity; `public/social-card.jpg` is the 1200 × 630 sharing image. Vite copies both into `dist/`. The optimized Hero photo and its accessible fallback are retained.
- **Backend configuration:** set private `MONGODB_URI`, `MONGODB_DATABASE`, and a cryptographically random `SESSION_SECRET`. Use `APP_ENV=production`, `COOKIE_SECURE=true`, exact HTTPS `CORS_ORIGINS`, an appropriate `HOST`/`PORT`, and the desired `SESSION_TTL_MINUTES`. Provide HTTPS through the host/reverse proxy; cross-site cookie authentication is intentionally unsupported.
- **MongoDB and admin:** use durable storage, restricted database/network permissions, TLS, and tested backups. Initialize the first admin explicitly with `go run ./cmd/create-admin` using local/server-side setup credentials; remove the plaintext setup password afterward. Import confirmed portfolio data through `npm run seed:backend` only when needed. No account is created automatically on server startup.
- **Analytics:** leave `VITE_GA_MEASUREMENT_ID` blank to disable GA4. Before enabling a real ID, disable Enhanced measurement, Google Signals, and user-provided data collection as described above. Admin and unknown routes do not initialize analytics. Never send personal form/contact data as events.
- **Routing and indexing:** route `/api/*` to Go, and serve the SPA for `/`, `/admin`, and `/admin/login` (and their deployment subpaths). Unknown frontend paths show the 404 UI. Configure the host to return an actual HTTP 404 with that SPA document for unknown paths and an `X-Robots-Tag: noindex` header for admin/unknown routes. Client metadata also marks them noindex, but static fallback hosting alone returns HTTP 200 and cannot guarantee crawler behavior. Add an SPA fallback before testing direct route reloads.
- **Delivery and headers:** deploy `dist/` and the Go service separately. Compress HTML/JS/CSS, revalidate `index.html`, cache hashed assets immutably, and deploy atomically so open tabs do not lose old chunks. Add frontend CSP, frame protection, no-referrer, and HTTPS headers at the host. Public favicon/sharing filenames are unversioned; use appropriate cache revalidation when replacing them. Backend headers and auth behavior remain unchanged.
- **Release checks:** run frontend typecheck/build and all `tests/*.test.mjs`, backend tests and vet, and `git diff --check`. Verify public sections, direct routes, authentication/CRUD, API error/retry states, keyboard focus, reduced motion, and all five responsive widths. Live HTTP and MongoDB integration tests require the documented temporary/test database configuration.

The frontend is a client-rendered SPA; metadata is available in HTML, while portfolio content still requires JavaScript (and the API when configured). Deployment/domain configuration, search-engine indexing, distributed rate limiting, MFA/account recovery, monitoring, and backup operations remain hosting/security responsibilities. This checklist does not claim a fully hardened production deployment.
