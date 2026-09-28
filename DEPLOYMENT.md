# DEPLOYMENT

Zero-cost production deployment: **Supabase** (database + file storage) and **Netlify** (hosting),
both on free tiers. Budget about 15 minutes, most of it waiting for the build.

Nothing here requires a credit card, a server, or DevOps knowledge.

---

## Overview

```
GitHub repo ──► Netlify (Next.js app) ──► Supabase (Postgres + Storage)
                      │
                      └──► Resend (transactional email, optional)
                        └──► /api/health  ← post-deploy self-check
```

| Step | Time | Where |
| --- | --- | --- |
| 1. Code is on GitHub | — | Already done (`main` branch) |
| 2. Create the Supabase project *(skip — you already have one)* | 3 min | supabase.com |
| 3. Run the database SQL (fresh schema, or the migration script) | 2 min | Supabase SQL editor |
| 4. Set the environment variables in Netlify | 5 min | app.netlify.com |
| 5. Trigger the deploy (merge PR / push to `main`) | 3 min | Netlify builds |
| 6. Create your admin account and verify | 2 min | Your live URL |
| 7. (Optional) Turn on email | 5 min | resend.com |

> **Already have a Supabase project?** Use [`supabase-migrate.sql`](supabase-migrate.sql) in step 3
> instead of the schema file — it drops and rebuilds the PITCHATON tables on a project that already
> holds older ones. Both files are idempotent, so re-running is safe.

---

## 1. Code on GitHub

The repository is `cndubuisi504-pixel/PITCHATON`. `.gitignore` already excludes `node_modules`,
`.next` and `.data/`, so no secrets or local demo data are committed. Double-check `.env.local` is
never in the repo.

Netlify deploys whatever is on the **production branch** (`main`). Merging a pull request into `main`
is what triggers a production build; every other branch and PR gets its own **Deploy Preview** URL
automatically, which is handy for checking a change before it goes live.

---

## 2. Supabase project

If you are reusing an existing project, skip the creation step and just collect the keys below.

1. <https://supabase.com> → **New project** (free plan) — only if you need a fresh one.
2. Region: pick the closest to your users — `West EU (Ireland)` or `South Africa` are nearest to Enugu.
3. Wait ~2 minutes for provisioning.

Then collect your keys: **Project Settings → API**

| Value | Where to copy it |
| --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` / publishable key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` — safe to expose |
| `service_role` / secret key | `SUPABASE_SERVICE_ROLE_KEY` — **server only, never expose, never commit** |

**The publishable key will not work in the `SUPABASE_SERVICE_ROLE_KEY` slot.** Supabase issues two
different key pairs; the app needs the *secret* one to write to Postgres and Storage. If you paste the
wrong one, `/api/health` and `npm run check:supabase` both answer `Invalid API key` and tell you so —
that is the intended failure, not a silent one.

---

## 3. Run the database SQL

**A. Existing project (the Hub's)** — Supabase → **SQL Editor → New query**:

1. Optional but advised: `select count(*) from public.pitches;` to see whether old rows exist.
2. Paste the whole of [`supabase-migrate.sql`](supabase-migrate.sql) and **Run**.
3. It drops only the PITCHATON tables (`users`, `pitches`, `founders`, `files`, `results`,
   `hub_news`, `admin_settings`, `email_log`) and rebuilds them. `auth.users`, storage objects and
   unrelated tables are left untouched.

**B. Fresh project** — paste [`supabase-schema.sql`](supabase-schema.sql) instead.

Either way you should see “Success. No rows returned”. This creates the eight tables, indexes, the
`updated_at` trigger, the auto pitch-code sequence (`PCH-0001`, `PCH-0002`, …), the `leaderboard`
view, Row Level Security with deny-all policies, and the **private** `pitch-files` storage bucket.

Verify: **Table Editor** should list `users`, `pitches`, `founders`, `files`, `results`, `hub_news`,
`admin_settings`, `email_log`.

> **Why the bucket is private.** Attachments are never on a public URL. `GET /api/files/:id` checks
> that you own the file (or are an admin) and only then mints a **120-second signed URL** and redirects
> the browser to Storage. 50 MB decks therefore stream straight from Supabase instead of through a
> serverless function, and a leaked link dies two minutes later.

---

## 4. Netlify environment variables

Netlify → your site → **Site configuration → Environment variables → Add a variable**.

`netlify.toml` already pins Node 22, the build command and the publish directory, so nothing else
needs configuring. **Never put secrets in `netlify.toml`** — it is committed to the repo.

### Required

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://gqggririspqrzgzwrbyh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the `anon` / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | the **secret** key (Settings → API keys → `service_role`) |
| `SESSION_SECRET` | random 64+ char string — see below |
| `NEXT_PUBLIC_SITE_URL` | `https://your-site.netlify.app` (update once you know the domain) |

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Strongly recommended

| Variable | Value | Why |
| --- | --- | --- |
| `ADMIN_EMAILS` | `contacteihpitchaton@gmail.com` | This address is always an admin |
| `ADMIN_ACCESS_CODE` | e.g. `HUB-ENUGU-a1b2c3` | Required for any *other* admin account. There is no built-in default — leave it unset and only `ADMIN_EMAILS` can be admins. |
| `NEXT_PUBLIC_HUB_NAME` | `ICT Hub` | Header, footer, emails |
| `NEXT_PUBLIC_INSTITUTION_NAME` | `ICT Hub · Enugu, Nigeria` | Footer and email footer |

### Optional (email)

| Variable | Value |
| --- | --- |
| `RESEND_API_KEY` | from resend.com (free, 3,000 emails/month) |
| `EMAIL_FROM` | `PITCHATON <onboarding@resend.dev>` until you verify a domain |
| `EMAIL_ADMIN_FROM` | where internal “new submission” alerts go (defaults to `ADMIN_EMAILS[0]`) |
| `EMAIL_DEV_OVERRIDE` | any address — routes **all** email there for testing |

Applies to Production, Deploy Previews and Branch deploys by default. Environment changes take effect
on the **next build**, so redeploy after editing them (**Deploys → Trigger deploy → Deploy site** — or
just merge the pending tip of `main`).

> **The storage driver switches automatically.** As soon as `SUPABASE_SERVICE_ROLE_KEY` is present the
> app writes to Postgres and Supabase Storage. Without it, it falls back to the local file store —
> fine for a laptop preview, useless in production because Netlify's filesystem is ephemeral and
> read-only. If you ever see demo data on the live site, that variable is missing.

---

## 5. Deploy and verify

1. Netlify builds on every push to `main`. First build takes 1–3 minutes.
2. Open the **Deploy log** — a successful build ends with `Deploy is live`.

Then run the two self-checks:

**On the live site** → sign in as an admin and open **`/api/health`**. Anonymous visitors get a
one-line status; an admin gets host, one row per table (`✓ reachable` / `✗ missing — run
supabase-schema.sql`), the storage bucket, the settings row, and a plain-English `verdict`.

**Or from your machine**, against the same credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://gqggririspqrzgzwrbyh.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<secret key> \
npm run check:supabase
```

Either one tells you *exactly* what is wrong — missing table, wrong key, missing bucket — instead of
leaving you with a blank page. Both are safe to run repeatedly.

---

## 6. Create your admin account

1. Open your live URL → **Submit a pitch** (top-right) → **Create your account**.
2. Sign up with **`contacteihpitchaton@gmail.com`**.
   * The Hub address is recognised as an admin on the **server** — nothing is decided in the browser
     and no code is needed.
   * While the database has no admin at all, this first account is bootstrapped automatically.
3. You land in the **admin console** (`/admin`). The header also shows an **Admin** button from now on.

**Done.** For a second organiser, see [SETUP_ADMIN.md](SETUP_ADMIN.md).

---

## 7. Optional: enable email notifications

1. <https://resend.com> → sign up → **API Keys → Create API key**.
2. Add `RESEND_API_KEY` to Netlify → redeploy (env changes need a new build).
3. Verify in **Admin → Settings → Platform health**: *Email delivery* should read **Resend live**.
4. Press **Send test email** — it goes to the admin inbox.

Without a verified domain, Resend only delivers to the address that owns the account. For real
delivery to any founder, add and verify your domain under **Resend → Domains**, then set
`EMAIL_FROM=PITCHATON <pitchaton@yourdomain.com>`.

If you skip this step entirely: notifications are still generated, rendered and stored — read them in
**Admin → Settings → Email log**, where each row explains why it was not delivered.

---

## 8. Custom domain (optional)

1. Netlify → your site → **Domain management → Add a domain** → e.g. `pitchaton.yourdomain.com`.
2. Add the DNS record Netlify shows you (usually a `CNAME` to `your-site.netlify.app`).
3. Update `NEXT_PUBLIC_SITE_URL` to the new domain and redeploy — email links and metadata use it.

HTTPS is automatic and free on Netlify.

---

## Post-deploy checklist

- [ ] `/api/health` shows every table `✓` and the bucket `✓` (admin view)
- [ ] Homepage loads in under 2 seconds
- [ ] Countdown renders with the deadline you set in **Admin → Settings**
- [ ] Sign up as a founder, submit a pitch with a real file attachment, open **Details**, download it
      (you should be redirected to a `…/object/sign/…` URL that expires)
- [ ] Open that same download link in a logged-out browser — you must be refused, not served
- [ ] As admin: change a status, confirm the email log grows
- [ ] Publish results and check `/leaderboard` from a logged-out browser
- [ ] Publish a news post and check `/news`
- [ ] Export CSV from the Pitches tab and open it in Excel/Sheets
- [ ] Log in as the founder and confirm `/admin` bounces to `/dashboard?denied=admin`
- [ ] Check `/dashboard` on a phone — the layout should be single-column and comfortable

---

## Operations

### Rotating the admin access code

Netlify → Site configuration → Environment variables → edit `ADMIN_ACCESS_CODE` → redeploy. Existing
admin sessions stay valid; the new code is required for the next admin signup.

### Rotating the Supabase secret key

Supabase → Project Settings → API keys → **Rotate** `service_role` → paste the new value into Netlify
→ redeploy. Do this immediately if the key ever appears in a repo, screenshot or chat.

### Backups

Supabase free tier includes daily backups for a limited window. For semester records, also use
**Admin → Pitches → Export CSV** at the end of each round and keep the file in the Hub's records.

### Starting a new semester

1. Export the previous semester to CSV (archive).
2. Delete or keep last round's pitches (Pitches tab → delete icon removes files and results too).
3. Set the new dates in **Settings**.
4. Unpublish results (**Results → Unpublish**) until the new judging closes.
5. Flip **Allow new submissions** back on.

### Costs

Everything above sits inside free tiers: Supabase (500 MB database, 1 GB storage, 5 GB bandwidth) and
Netlify (100 GB bandwidth, 300 build minutes/month). Resend adds 3,000 emails/month, 100/day. A
semester of <100 submissions and 100+ concurrent readers is comfortably within them.

### Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Site shows demo data, submissions vanish | `SUPABASE_SERVICE_ROLE_KEY` not set on Netlify | Add it, redeploy |
| `/api/health` → `Invalid API key` | publishable key pasted into the secret slot | Copy the `service_role` key |
| `/api/health` → `run supabase-schema.sql` | tables missing (new project, or legacy project never migrated) | Run `supabase-schema.sql` or `supabase-migrate.sql` |
| `/api/health` → bucket missing | schema ran but the storage bucket was not created | Re-run the SQL, then check Storage → `pitch-files` exists |
| Everyone is logged out after a redeploy | `SESSION_SECRET` is unset or changed | Set it once in Netlify and keep it stable |
| Large upload fails instantly | file is over the 50 MB cap, or the bucket is still public/absent | Check the size, re-run the SQL |
| Emails say “logged, not sent” | `RESEND_API_KEY` missing (expected on free plan) | Add it, or read the email log instead |
