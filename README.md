# PITCHATON

**Semester pitch competition platform for the ICT Hub.** Founders submit ideas, reviewers move them
through a transparent pipeline, and the whole campus follows the leaderboard when results drop.

Dark UI, neon-lime accents, mobile-first, zero running cost.

```bash
npm install
npm run dev          # → http://localhost:3000
```

No environment variables are required to run it. The platform boots on a built-in local data store so
you can click through every feature immediately; add Supabase when you are ready to go live and the
storage driver switches automatically. See [QUICK_START.md](QUICK_START.md) for the 5-minute tour and
[DEPLOYMENT.md](DEPLOYMENT.md) for the 15-minute deploy.

---

## What it does

### Public
| Page | Purpose |
| --- | --- |
| `/` | Hero, live countdown to the deadline, how-it-works, stats, news teaser, podium teaser |
| `/leaderboard` | Official ranking — hidden until an admin publishes results, then opens automatically |
| `/news` · `/news/[id]` | Hub announcements and winner spotlights, newest first |

### Founders
| Page | Purpose |
| --- | --- |
| `/signup` · `/login` | One shared form for everyone — see [Roles](#roles--access-control) |
| `/dashboard` | Every own pitch, status pipeline, key dates, hub updates, result per pitch |
| `/submit-pitch` | Submission form: title, description, category, unlimited team members, file uploads |
| `/submit-pitch/[id]/edit` | Edit while the Hub has edits open (per-pitch lock or global window) |

### Admins (`/admin`)
| Tab | Purpose |
| --- | --- |
| **Pitches** | Search, filter, sort, inline status changes, per-pitch lock/unlock, mark winner, delete, CSV export |
| **Results** | Manual entry, batch paste-upload (CSV/TSV), CSV export, publish/unpublish the public leaderboard |
| **News** | Publish announcements and spotlights; optionally email the featured team |
| **Settings** | Deadlines, competition date, three platform switches, branding, platform health, email log + test send |

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router) + React 19 + TypeScript | Server-rendered, SEO-friendly, deploy-anywhere |
| Styling | Tailwind CSS 3 with custom design tokens | Matches the brand trio, no runtime CSS |
| Icons | lucide-react | Crisp at 16–24px, tree-shaken |
| Fonts | `@fontsource-variable/inter` + `jetbrains-mono` | Self-hosted: no external font CDN, no layout shift |
| Data | Supabase Postgres + Storage (free tier) | Managed, RLS-capable, generous free limits |
| Auth | Own session cookies (bcrypt + `jose` HS256 JWT) | No third-party auth dependency, fully server-side role checks |
| Email | Resend (free tier, 3,000/month) | Simple API, no card required |
| Hosting | Netlify (free tier) | Connected to this repo: merge to `main` to deploy, HTTPS by default |

**Two storage drivers, one interface.** `lib/store/local.ts` (JSON file + disk) and
`lib/store/supabase.ts` (Postgres + Storage) implement the same `Store` contract. The driver is picked
at runtime: if `SUPABASE_SERVICE_ROLE_KEY` is set, Supabase wins; otherwise local. No page or
component knows which one is active.

---

## Project structure

```
pitchaton/
├── app/
│   ├── layout.tsx                 Root shell: fonts, nav, footer, auth context
│   ├── page.tsx                   Homepage
│   ├── login/ · signup/           Shared auth pages
│   ├── dashboard/                 Founder dashboard
│   ├── submit-pitch/              Create + [id]/edit
│   ├── admin/                     Admin console (server-guarded)
│   ├── leaderboard/ · news/       Public pages
│   ├── not-found.tsx · error.tsx  Edge cases
│   └── api/                       All HTTP endpoints (see below)
├── components/
│   ├── ui/index.tsx               Design system: Button, Field, Modal, Tabs, Toast, …
│   ├── Navigation.tsx · Footer.tsx
│   ├── AuthProvider.tsx
│   ├── auth/AuthForm.tsx          Shared login/signup form + admin claim
│   ├── pitch/PitchForm.tsx        Submission + edit, upload progress
│   ├── pitch/FounderPitches.tsx   Founder list + shared detail panel
│   ├── admin/*                    AdminDashboard + four tabs
│   └── site/Countdown.tsx
├── lib/
│   ├── config.ts                  Every env var, read in one place (server-only)
│   ├── auth.ts                    Bcrypt + role resolution
│   ├── session.ts                 Cookie sessions, JWT sign/verify
│   ├── guards.ts                  requireUser / requireAdmin / API guards
│   ├── store/                     Local + Supabase drivers, shared interface
│   ├── storage.ts                 Upload, download, signed URLs
│   ├── uploads.ts                 Upload authorisation + limits
│   ├── email.ts                   Resend delivery + templates + log
│   ├── queries.ts                 Public read models (leaderboard, news, stats)
│   ├── validation.ts              Request validation helpers
│   ├── rate-limit.ts              Login/signup throttling
│   ├── api.ts · utils.ts · types.ts
├── middleware.ts                  Edge guard for /admin and /dashboard
├── supabase-schema.sql            Run once in Supabase — tables, RLS, trigger, storage
├── scripts/seed-demo.mjs          Fake semester for local demos
└── .env.local.example             Environment template
```

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on `0.0.0.0:3000` |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | Next.js lint |
| `npm run seed:demo` | Fill the local store with a realistic semester |

---

## Roles & access control

Everyone uses the same signup and login form. **The role is decided on the server — the browser never
sends or stores a role claim.**

| Situation | Result |
| --- | --- |
| Email is in `ADMIN_EMAILS` (default `contacteihpitchaton@gmail.com`) | **Admin**, no code needed |
| Signs up ticking “I'm an administrator” with the correct `ADMIN_ACCESS_CODE` | **Admin** (code must be configured — there is no built-in default) |
| Signs up ticking “I'm an administrator” without a valid code | **Rejected** (403) |
| Everyone else | **Founder** |

> **Deliberate change from the original brief.** The spec suggested treating *any* address containing
> `+admin` (e.g. `someone+admin@gmail.com`) as an admin automatically. That is a privilege-escalation
> hole on a public signup form — anyone could claim the admin console. PITCHATON replaces it with the
> allow-list + access code above, which still lets you create as many organiser accounts as you like.
> Test accounts work too: sign up `you+admin@gmail.com` **and enter the code**. See
> [SETUP_ADMIN.md](SETUP_ADMIN.md).

Layers of enforcement:

1. `middleware.ts` bounces cookie-less visitors away from `/admin` and `/dashboard`.
2. `lib/guards.ts` re-verifies the session *and* reloads the user from the database on every protected
   page — a demoted or deleted account loses access instantly.
3. Every API route calls `apiAdmin()`/`apiUser()` and re-checks ownership before touching data.
4. `supabase-schema.sql` enables RLS on all tables with deny-all policies, so even a leaked anon key
   cannot read another founder's pitch. The server uses the service-role key, which bypasses RLS.

---

## Data model

| Table | Notes |
| --- | --- |
| `users` | Platform accounts: email, bcrypt hash, full name, role |
| `pitches` | `code` (`PCH-0001`), title, description, category, status enum, `editable`, owner |
| `founders` | Team members per pitch: name, email, phone, year |
| `files` | Attachment metadata + Supabase Storage path |
| `results` | One row per pitch (unique `pitch_id`): rank, score, notes |
| `hub_news` | Announcements/spotlights, optional featured pitch |
| `admin_settings` | Singleton row: deadlines, toggles, branding |
| `email_log` | Every message the platform generated (sent / queued / failed) |

Status enum: `submitted → under_review → accepted → finalist → winner`, plus `rejected`.

The full DDL, indexes, `updated_at` trigger, pitch-code sequence, a public `leaderboard` view and the
storage bucket/policies live in [`supabase-schema.sql`](supabase-schema.sql).

---

## API reference

**Auth**
`POST /api/auth/signup` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`

**Pitches**
`GET|POST /api/pitches` · `GET|PATCH|DELETE /api/pitches/:id` ·
`POST /api/pitches/:id/status` (admin) · `POST /api/pitches/:id/editable` (admin) ·
`POST /api/pitches/:id/files` (proxied upload) · `POST /api/pitches/:id/files/sign` +
`POST /api/pitches/:id/files/register` (direct upload) · `GET /api/pitches/export?scope=all` (CSV)

**Files**
`GET /api/files/:id` (owner or admin) · `DELETE /api/files/:id`

**Public**
`GET /api/leaderboard` (returns rows only when published) · `GET /api/news`

**Admin**
`GET /api/admin/overview` · `GET|PATCH /api/admin/settings` · `GET|POST|DELETE /api/admin/results` ·
`POST /api/admin/results/bulk` · `GET|POST /api/admin/news` · `DELETE /api/admin/news/:id` ·
`GET|POST /api/admin/emails`

Every mutation returns `null`-safe JSON and forces `Cache-Control: no-store`.

---

## Uploads

* Any file type: PDF, PPTX, DOCX, ZIP, images, plain text.
* **50 MB per file**, 10 files per pitch, 120 MB total per pitch.
* **Production:** the browser uploads straight to Supabase Storage using a one-shot signed URL the
  server issues only after checking ownership and the edit window. That bypasses serverless
  request-body limits (Netlify functions buffer ~6 MB), so a 50 MB deck really does work.
* **Local dev:** uploads proxy through `/api/pitches/:id/files`.
* Downloads always route through `/api/files/:id`, which authorises the caller first. The bucket is
  **private**: the route mints a short-lived (120 s) signed URL and redirects. Internal storage paths
  are stripped from every API response.

---

## Email notifications

| Trigger | Recipient |
| --- | --- |
| Submission received | The submitting account |
| New submission (internal alert) | `ADMIN_EMAILS[0]` |
| Status change | Submitting account + every founder listed on the pitch |
| Spotlight published | Every founder on the featured pitch (opt-in per post) |

Set `RESEND_API_KEY` to start delivering. Without it the platform is still fully functional: every
message is rendered and written to the email log in **Admin → Settings**, and founders see the same
status changes in their dashboard.

---

## Design tokens

Defined once in `tailwind.config.ts` and `app/globals.css`:

```
lime      #d3ff01   primary action, winners, focus rings        (brand)
charcoal  #1a1a1a → #0f0f10   page background and surfaces
gray      #4d4d4d   hairlines and secondary surfaces (borders only —
                    raw #4d4d4d on charcoal fails contrast for text)
mute      #f4f4f5 … #6e6e6b   the legible text scale
status    per-status accent colours for the pipeline chips
```

Contrast targets: body copy ≥ 7:1, secondary copy ≥ 4.5:1, all interactive elements focus-visible
with a 2px lime ring. Motion respects `prefers-reduced-motion`.

To rebrand: change `lime`/`charcoal` in `tailwind.config.ts`, and the hub/institution strings in
**Admin → Settings** (no logo asset is required — the header is a typographic lockup).

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Data “disappeared” after adding Supabase keys | You switched drivers. Local demo data lives in `.data/db.json`; Supabase is a separate database. Run `supabase-schema.sql` and sign up again. |
| Everyone is logged out after a redeploy | `SESSION_SECRET` is unset. Set it in Netlify and redeploy. |
| Live site shows demo data, submissions vanish | `SUPABASE_SERVICE_ROLE_KEY` is missing, so the app fell back to the ephemeral local store. Netlify's filesystem is read-only. |
| Unsure whether Supabase is wired up correctly | Open `/api/health` as an admin, or run `npm run check:supabase` with the same credentials. Both name the exact fix. |
| Emails never arrive | `RESEND_API_KEY` unset, or the recipient domain is not verified in Resend. Messages still appear in **Settings → Email log** with status `queued`. |
| Upload fails on a huge file in production | Confirm the Supabase bucket exists and is private (the SQL creates `pitch-files` with a 50 MB cap). The client falls back to the proxied path if signing fails — keep files small when Supabase is not configured. |
| `npm run dev` port already in use | `npm run dev -- -p 3001` |
| Admin console says “restricted” | That account is a founder. Add it to `ADMIN_EMAILS` or re-sign-up with the admin access code. |
| Reset the local demo data | `npm run seed:demo` (local driver only; it refuses to run when Supabase keys are set) |

---

## Security notes

* Passwords hashed with bcrypt (10 rounds); login compares against a dummy hash on unknown emails so
  response timing never reveals whether an account exists.
* Sessions are httpOnly, SameSite=Lax, `Secure` in production, 7-day expiry, signed with HS256.
* Login and signup are rate limited per account and per IP.
* All input validated server-side (`lib/validation.ts`); SQL access goes through the Supabase client
  (parameterised), never string-concatenated.
* Security headers set in `next.config.mjs`: `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, HSTS.
* Admin paths are `noindex` and served `no-store`.
* No secrets in the client bundle: the Supabase service-role key, session secret and admin access code
  are imported only through server-only modules. Verify with
  `grep -rl "SUPABASE_SERVICE_ROLE_KEY" .next/static` after a build — it should return nothing.

**If you are upgrading from the earlier single-file prototype:** that build shipped a Supabase URL and
key inside the HTML, wrote to the database straight from the browser (no Row Level Security), and
never created its tables. Two things to do before going live:

1. Rotate the key that was in that file (Supabase → Project Settings → API keys).
2. Run [`supabase-migrate.sql`](supabase-migrate.sql) once to rebuild the PITCHATON tables with RLS
   enabled and deny-all policies, so the browser can no longer reach the data directly. It only
   touches those eight tables — `auth.users`, storage objects and unrelated tables are left alone.

This codebase reads every credential from environment variables and performs all role checks on the
server.

---

## Docs

* [QUICK_START.md](QUICK_START.md) — running locally in five minutes
* [DEPLOYMENT.md](DEPLOYMENT.md) — Supabase + Netlify in fifteen minutes, including the
  `/api/health` post-deploy check
* [ADMIN_GUIDE.md](ADMIN_GUIDE.md) — running a semester from the admin console
* [SETUP_ADMIN.md](SETUP_ADMIN.md) — admin accounts, the access code, and revoking access
