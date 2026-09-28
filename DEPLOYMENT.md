# DEPLOYMENT

Zero-cost production deployment: **Supabase** (database + file storage) and **Vercel** (hosting),
both on free tiers. Budget about 15 minutes, most of it waiting for the build.

Nothing here requires a credit card, a server, or DevOps knowledge.

---

## Overview

```
GitHub repo ──► Vercel (Next.js app) ──► Supabase (Postgres + Storage)
                        │
                        └──► Resend (transactional email, optional)
```

| Step | Time | Where |
| --- | --- | --- |
| 1. Push the code to GitHub | 2 min | Terminal |
| 2. Create the Supabase project | 3 min | supabase.com |
| 3. Run the schema | 1 min | Supabase SQL editor |
| 4. Deploy to Vercel with env vars | 6 min | vercel.com |
| 5. Create your admin account | 1 min | Your live URL |
| 6. (Optional) Turn on email | 5 min | resend.com |

---

## 1. Push to GitHub

```bash
git init                                  # if this is not already a repo
git add .
git commit -m "PITCHATON platform"
git branch -M main
git remote add origin https://github.com/<you>/pitchaton.git
git push -u origin main
```

`.gitignore` already excludes `node_modules`, `.next` and `.data/`, so no secrets or local demo data
are committed. Double-check `.env.local` is not in the repo.

---

## 2. Create the Supabase project

1. <https://supabase.com> → **New project** (free plan).
2. Name: `pitchaton`. Set a strong database password (you won't need it again).
3. Region: pick the closest to your users — `West EU (Ireland)` or `South Africa` are nearest to Enugu.
4. Wait ~2 minutes for provisioning.

Then collect your keys: **Project Settings → API**

| Value | Where to copy it |
| --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` key | `SUPABASE_SERVICE_ROLE_KEY` — **server only, never expose** |

---

## 3. Run the database schema

1. Supabase → **SQL Editor → New query**.
2. Paste the entire contents of [`supabase-schema.sql`](supabase-schema.sql).
3. **Run**. You should see “Success. No rows returned”.

This creates all eight tables, indexes, the `updated_at` trigger, the auto pitch-code sequence
(`PCH-0001`, `PCH-0002`, …), the public `leaderboard` view, Row Level Security with deny-all policies,
and the `pitch-files` storage bucket (50 MB per-file cap).

Verify: **Table Editor** should list `users`, `pitches`, `founders`, `files`, `results`, `hub_news`,
`admin_settings`, `email_log`.

---

## 4. Deploy to Vercel

1. <https://vercel.com> → **Add New → Project** → import your GitHub repo.
2. Framework preset: **Next.js** (detected automatically). Leave build settings alone.
3. Add the environment variables below (**Settings → Environment Variables** works too; apply them to
   Production, Preview and Development).

### Required

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the `anon public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` key (secret) |
| `SESSION_SECRET` | random 64+ char string — see below |
| `NEXT_PUBLIC_SITE_URL` | `https://your-project.vercel.app` (update after you know the domain) |

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

4. **Deploy**. First build takes 1–3 minutes.

> **The storage driver switches automatically.** As soon as `SUPABASE_SERVICE_ROLE_KEY` is present the
> app writes to Postgres and Supabase Storage; without it, it falls back to the local file store (great
> for previews, unsuitable for production because serverless filesystems are ephemeral).

---

## 5. Create your admin account

1. Open your live URL → **Submit a pitch** (top-right) → **Create your account**.
2. Sign up with **`contacteihpitchaton@gmail.com`**.
   * The Hub address is recognised as an admin on the server — no code needed.
   * While the database has no admin at all, this first account is bootstrapped automatically.
3. You land in the **admin console** (`/admin`). The header also shows an **Admin** button from now on.

**Done.** For a second organiser, see [SETUP_ADMIN.md](SETUP_ADMIN.md).

---

## 6. Optional: enable email notifications

1. <https://resend.com> → sign up → **API Keys → Create API key**.
2. Add `RESEND_API_KEY` to Vercel → redeploy (env changes need a new deployment).
3. Verify in **Admin → Settings → Platform health**: *Email delivery* should read **Resend live**.
4. Press **Send test email** — it goes to the admin inbox.

Without a verified domain, Resend only delivers to the address that owns the account. For real
delivery to any founder, add and verify your domain under **Resend → Domains**, then set
`EMAIL_FROM=PITCHATON <pitchaton@yourdomain.com>`.

If you skip this step entirely: notifications are still generated, rendered and stored — read them in
**Admin → Settings → Email log**, where each row explains why it was not delivered.

---

## 7. Custom domain (optional)

1. Vercel → your project → **Settings → Domains** → add `pitchaton.yourdomain.com`.
2. Add the DNS records Vercel shows you (usually a `CNAME`).
3. Update `NEXT_PUBLIC_SITE_URL` to the new domain and redeploy — email links use it.

HTTPS is automatic and free on Vercel.

---

## Post-deploy checklist

- [ ] Homepage loads in under 2 seconds
- [ ] Countdown renders with the deadline you set in **Admin → Settings**
- [ ] Sign up as a founder, submit a pitch with a real file attachment, open **Details**, download it
- [ ] As admin: change a status, confirm the email log grows
- [ ] Publish results and check `/leaderboard` from a logged-out browser
- [ ] Publish a news post and check `/news`
- [ ] Export CSV from the Pitches tab and open it in Excel/Sheets
- [ ] Log in as the founder and confirm `/admin` bounces to `/dashboard?denied=admin`
- [ ] Check `/dashboard` on a phone — the layout should be single-column and comfortable

---

## Operations

### Rotating the admin access code

Vercel → Settings → Environment Variables → edit `ADMIN_ACCESS_CODE` → **Redeploy**. Existing admin
sessions stay valid; the new code is required for the next admin signup.

### Rotating the Supabase service key

Supabase → Project Settings → API → **Rotate** `service_role` → paste the new value into Vercel →
redeploy. Do this immediately if the key ever appears in a repo, screenshot or chat.

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

Everything above sits inside free tiers: Supabase (500 MB database, 1 GB storage, 5 GB bandwidth),
Vercel Hobby, Resend (3,000 emails/month, 100/day). A semester of <100 submissions and 100+
concurrent readers is comfortably within them.
