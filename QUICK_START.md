# QUICK_START

The fastest path from zero to a running PITCHATON you can click through.

---

## 1. Run it locally (about 2 minutes)

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

That's it — **no environment variables are needed**. With none set, the platform uses the built-in
local data store (`.data/db.json` + `.data/uploads/`), so every feature works end to end: signup,
submission, uploads, review, results, leaderboard, news and email logging.

---

## 2. Load a demo semester (optional, 10 seconds)

An empty platform is a boring demo, so seed a realistic one:

```bash
npm run seed:demo
```

You get 6 pitches across categories, 3 published results, 2 news posts, and two accounts:

| Role | Email | Password |
| --- | --- | --- |
| **Admin** | `contacteihpitchaton@gmail.com` | `Cross0702` |
| Founder | `founder@example.com` | `pitchaton123` |

(The admin password can be overridden: `SEED_ADMIN_PASSWORD=… npm run seed:demo`.)

> Using Supabase already? Skip this step — `seed:demo` only writes to the local store and refuses to
> run when Supabase keys are present.

---

## 3. Walk the product (5 minutes)

**As the admin**
1. Log in with `contacteihpitchaton@gmail.com` / `Cross0702` → you land in `/admin`.
2. **Pitches** — search, filter by status, change a status with the dropdown, watch the toast confirm
   how many founder emails were sent. Try the lock icon (unlock a submission), then **Export CSV**.
3. **Results** — record a rank manually, or click **Batch upload** and paste:
   ```
   Pitch ID,Rank,Score,Notes
   PCH-0005,4,79,Great instinct, needs a sharper go-to-market
   ```
   Then hit **Publish results**.
4. **News** — publish a spotlight, link it to a pitch, and leave “email the team” ticked.
5. **Settings** — set the deadline, flip **Allow founder edits**, and check the email log.

**As a founder**
6. Log in with `founder@example.com` / `pitchaton123` → `/dashboard` shows the pipeline and any result.
7. **New pitch** → fill the form, add a second founder, drag a file in, submit. Watch the upload
   progress bar.
8. Back on the dashboard, open **Details** on a pitch to see the full pipeline, team and attachments.

**As the public**
9. Log out, then visit `/leaderboard` and `/news` — no login required.

---

## 4. Things worth trying (prove it is safe)

| Try this | Expected result |
| --- | --- |
| Visit `/admin` while logged out | Redirect to `/login?next=%2Fadmin` |
| Log in as the founder, then visit `/admin` | Redirect to `/dashboard?denied=admin` |
| Call `GET /api/admin/overview` with a founder cookie | `403 {"error":"Admins only."}` |
| Sign up and tick “I'm an administrator”, leave the code blank | `403` — the code is required |
| Sign up `someone+admin@gmail.com` without the code | Normal **founder** account (the `+admin` shortcut is intentionally not honoured) |
| Sign up with the code you set in `ADMIN_ACCESS_CODE` | Admin account, full console access |
| Sign up ticking “I'm an administrator” when no code is configured | `403` — only `ADMIN_EMAILS` addresses can be admins |
| Enter the wrong password 9 times | Rate limited (`429`) |

---

## 5. Make it yours

* **Deadlines & competition date** → Admin → Settings (drives the public countdown).
* **Branding** → Admin → Settings (hub name, institution line) and `tailwind.config.ts` for colours.
* **Admin access code** → `ADMIN_ACCESS_CODE` in `.env.local`. There is no default: leave it unset and
  only the addresses in `ADMIN_EMAILS` can be admins. Set it to invite another organiser.
* **Logo** → not required; the header is a typographic lockup. Drop an image into `public/` and swap it
  into `components/Navigation.tsx` if you want one.

---

## 6. Going live

Follow [DEPLOYMENT.md](DEPLOYMENT.md). Short version: create a Supabase project → run
`supabase-schema.sql` → paste three keys into Vercel → deploy → sign up with
`contacteihpitchaton@gmail.com` and you are the admin.

---

## Useful commands

```bash
npm run dev         # dev server on 0.0.0.0:3000
npm run build       # production build
npm run start       # serve the production build
npm run typecheck   # TypeScript check
npm run lint        # Next.js lint
npm run seed:demo   # reset + seed the local demo semester
```

Stuck? See the troubleshooting table in [README.md](README.md#troubleshooting).
