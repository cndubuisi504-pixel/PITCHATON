# SETUP_ADMIN

Everything about administrator accounts: how to create them, how the rules work, and how to take access
away again.

There is **one login and one signup form for everybody**. Whether an account becomes a founder or an
admin is decided by the server — never by the browser.

---

## The Hub account (do this first)

`contacteihpitchaton@gmail.com` is the Hub's own address and is treated as an administrator
automatically.

1. Open your site (locally <http://localhost:3000>, or your Vercel URL).
2. **Submit a pitch** (top right) → **Create your account**.
3. Full name: whoever manages the Hub. Email: **`contacteihpitchaton@gmail.com`**. Choose a password.
4. Create the account. You land straight in the **admin console**.

No tick-box, no code, no secret needed — the address itself is the credential. A new **Admin** button
appears in the header from then on.

> Running locally after `npm run seed:demo`? That account already exists with the password
> `Cross0702`. Change it before going public, or delete `.data/` and sign up fresh.

**Bootstrap rule:** while the database contains no admin at all, that first allow-listed signup is
promoted automatically. Once one admin exists, every other admin needs the access code below.

---

## Adding another organiser

Anyone else becomes an admin by proving they know the admin access code:

1. They open the same **Create your account** page.
2. They tick **“I'm an administrator”** — an “Admin access code” field appears.
3. They enter the code and create the account.

**There is no built-in code.** You choose it, and until you do, only the allow-listed addresses can be
admins:

* Locally: add `ADMIN_ACCESS_CODE=your-code` to `.env.local`, then restart `npm run dev`.
* In production: Vercel → Settings → Environment Variables → `ADMIN_ACCESS_CODE` → **Redeploy**.

Generate something unguessable:

```bash
node -e "console.log('HUB-' + require('crypto').randomBytes(9).toString('hex'))"
```

If the code is unset, the admin console shows a reminder in **Settings → Access control**, and admin
claims from non-allow-listed addresses are refused with a clear message.

Test accounts work the same way: sign up `you+admin@gmail.com` **and enter the code**.

---

## Why `+admin` alone does not grant admin rights

The original brief suggested treating any address containing `+admin` as an administrator
automatically. That was left out on purpose.

The signup form is public. If `anything+admin@gmail.com` were an admin on sight, anyone on campus could
type such an address, create an account, and land inside the console — with the power to read every
founder's contact details, change statuses, publish results and post news. No code, no approval.

PITCHATON replaces it with two safe rules that still give you unlimited organiser accounts:

1. **Allow-list** — addresses in `ADMIN_EMAILS` are always admins (the Hub address by default).
2. **Access code** — anyone who knows `ADMIN_ACCESS_CODE` can create an admin account.

If you want a second permanent operator, add their address to the allow-list:

```bash
# .env.local
ADMIN_EMAILS=contacteihpitchaton@gmail.com,deputy@yourdomain.com
```

Both addresses then sign up normally and become admins without a code.

---

## How to tell which role an account has

* Sign in and look at the header: admins see an **Admin** button; founders see **Dashboard** only.
* A founder typing `/admin` is redirected to `/dashboard?denied=admin` with an explanation, and every
  admin API responds `403 {"error":"Admins only."}` — enforced server-side, not by hiding buttons.
* Need to check directly? Supabase → **Table Editor → users** → the `role` column.

---

## The three admin rules, end to end

| Attempt | Result |
| --- | --- |
| `contacteihpitchaton@gmail.com` signs up (any code, or none) | **Admin** |
| First ever signup on an empty database with an allow-listed address | **Admin** (bootstrap) |
| Any address + correct access code (once you have set one) | **Admin** |
| Claiming admin when no access code is configured | **Rejected** — allow-list only |
| Any address + wrong or missing code | **Rejected** — “An admin access code is required…” |
| Any address without claiming admin | **Founder** |
| `someone+admin@gmail.com` without a code | **Founder** (by design) |

---

## Changing or rotating the access code

1. Vercel → your project → **Settings → Environment Variables**.
2. Edit `ADMIN_ACCESS_CODE` → save.
3. **Deployments → … → Redeploy** (environment changes only apply to new deployments).
4. Tell the other organisers the new code.

Existing admin sessions are unaffected; the new code is required the next time an admin signs up.

---

## Revoking admin rights

**Demote someone to a founder** — Supabase → **Table Editor → users** → find the row → set `role` to
`founder`.

Take effect immediately: every request re-loads the role from the database, so their next page load
loses the console. They keep their own submissions.

**Remove the account entirely** — delete the row in `users`. Their pitches and files cascade away with
it, so prefer demotion if the person submitted anything.

**Lock out a lost password** — there is no self-service reset (deliberate: no email dependency for
account recovery). Update the password directly with a bcrypt hash:

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" 'NewStrongPassword'
```

Paste the result into `users.password_hash` in Supabase. Their old sessions expire within 7 days;
changing `SESSION_SECRET` invalidates every session immediately.

**Suspect the service-role key leaked?** Supabase → Project Settings → API → **Rotate**
`service_role`, paste the new value into Vercel, redeploy.

---

## Security posture (what is protecting the console)

* Sessions are httpOnly cookies signed with HS256 (`SESSION_SECRET`) — JavaScript cannot read or forge
  them.
* Passwords are bcrypt-hashed (10 rounds); unknown emails are compared against a dummy hash so
  response timing reveals nothing.
* Login is rate limited per account (8 attempts / 10 min) and per IP (30 / 10 min); signup is limited
  to 8 per IP per 10 minutes.
* Middleware drops cookie-less traffic before it reaches `/admin`; the page guard then verifies the
  token **and** reloads the user from the database on every request.
* Row Level Security is enabled on all tables with deny-all policies, so a leaked `anon` key still
  cannot read a founder's pitch.
* Admin pages are `noindex`, `no-store`, and the service-role key never reaches the browser.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| “An admin access code is required…” | Tick **“I'm an administrator”** on the signup form, or use an address from `ADMIN_EMAILS`. |
| “That admin access code is not valid.” | The value does not match `ADMIN_ACCESS_CODE` (check for trailing spaces, and redeploy after changing it). |
| “Admin signup is closed on this deployment…” | `ADMIN_ACCESS_CODE` is not set. Set it in your environment and redeploy. |
| Signed up as the Hub address but got founder access | That row was created before `ADMIN_EMAILS` included it — set `role = 'admin'` in Supabase → `users`. |
| `/admin` bounces to `/dashboard?denied=admin` | You are signed in as a founder. Log out, sign in as an admin, or promote the account. |
| Everyone was logged out | `SESSION_SECRET` changed or was never set. Set it and redeploy. |
| Locked out entirely | Create a new admin in Supabase: generate a bcrypt hash (command above) and insert the user with `role = 'admin'`. |
