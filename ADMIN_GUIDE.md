# ADMIN_GUIDE

How to run a PITCHATON semester from the admin console. Written for the Hub team — no technical
knowledge assumed.

Everything below happens at **`/admin`**, reachable from the **Admin** button that appears in the
header once you are signed in as an administrator.

---

## The semester at a glance

| Stage | What you do | Where |
| --- | --- | --- |
| 1. Open the round | Set the submission deadline and turn submissions on | **Settings** |
| 2. Announce it | Post the deadline, rules and pitch-day date | **News** |
| 3. Triage | Move pitches from *Submitted* to *Under review* as you read them | **Pitches** |
| 4. Shortlist | Mark the good ones *Accepted*, then *Finalist* | **Pitches** |
| 5. Judging | Enter ranks, scores and judge notes | **Results** |
| 6. Publish | Flip the leaderboard live | **Results** |
| 7. Spotlight | Post the winner story, email the team | **News** |
| 8. Archive | Export everything to CSV | **Pitches / Results** |

---

## Tab 1 · Pitches

A table of every submission: **Title · Category · Team size · Status · Date · Actions**.

**Find things fast**
* *Search* matches title, pitch ID (`PCH-0004`), category, founder names and emails.
* *Filter by status* to see only what needs attention.
* *Sort* by newest, oldest, title, largest team, or status.

**Move a pitch along**
Use the status dropdown directly in the row. The moment you change it:

* the founder who submitted **and** every founder listed on the pitch receive a status email
  (if email is configured — otherwise the message is written to the email log);
* the toast tells you how many notifications were delivered;
* the public leaderboard is **not** affected until you publish results.

Statuses: `Submitted → Under review → Accepted → Finalist → Winner`, plus `Not selected` (rejected).

**Row actions** (icons on the right)

| Icon | Meaning |
| --- | --- |
| 🔓 / 🔒 | Unlock this one pitch so its team can edit, or lock it again |
| 🏆 | Record it as rank #1 and set the status to Winner (confirms first) |
| 🗑 | Delete the pitch — removes its founders, files and result too |

**Read a pitch** — click the title for the full detail: description, pipeline position, every founder
with contacts, downloadable attachments, and any recorded result. The same panel has lock, winner and
delete actions.

**Export** — *Export CSV* downloads every pitch with founders, contacts, file counts, statuses and
results. Sixteen columns, spreadsheet-ready, ideal for semester records.

---

## Tab 2 · Results

**Publish switch (the important one).**
While **Hidden**, results are private — only you can see them; founders see their own rank on their
dashboard. Press **Publish results** and the ranking appears publicly at `/leaderboard` instantly.
Press **Unpublish** to take it down just as fast (useful if a score needs re-checking).

**Record a result manually**
1. Choose the pitch from the dropdown (shows its ID and current rank if it has one).
2. Enter **Rank** (required) and **Score** (optional, 0–1000).
3. Add **judge notes** — these are published verbatim on the leaderboard, so write them for the public.
4. Leave *“Notify the team if this is rank #1”* ticked to set the Winner status and email everyone.
5. **Save result**. Saving the same pitch again updates the existing row — no duplicates.

**Batch upload (a whole judging sheet at once)**
1. Click **Batch upload**.
2. From your spreadsheet, copy rows in this shape and paste them in:

   ```
   Pitch ID,Rank,Score,Notes
   PCH-0001,1,92.5,Sharp problem framing and a clear go-to-market
   PCH-0004,2,88,Winning demo — needs a pricing story
   PCH-0007,3,81,Strong team, early prototype
   ```

   Tab-separated pastes from Excel/Sheets work too, and the header row is optional.
   Use the **Pitch ID** column from the Pitches tab or the CSV export.
3. **Import rows**. You get a count of what was applied, and any row that could not be matched is
   listed with the reason (e.g. “No pitch found for PCH-9999”). Nothing is silently dropped.

**Export results CSV** downloads just the ranking: Pitch ID, Title, Category, Rank, Score, Notes, date.

---

## Tab 3 · News

Posts here appear publicly at `/news` and on the homepage immediately.

1. **Headline** and **Story**. Line breaks are preserved; write plainly.
2. **Featured image URL** — optional, any public `https://` image link.
3. **Spotlight a pitch** — optional; links the post to a submission and shows it on the post page.
4. If you picked a pitch, you can **email the team** about the spotlight (on by default).
5. **Publish post**.

Published posts are listed on the right with a link to their public page and a delete button. Deleting
removes it from the public feed permanently.

Good posts to write: submission window opened, deadline reminder, judging in progress, finalists
announced, winner spotlight, thank-you post.

---

## Tab 4 · Settings

**Competition calendar**
* **Submission deadline** — drives the public countdown; when it passes, founders can no longer submit.
* **Competition date** — shown on the homepage, dashboard and leaderboard.

Both are optional; leave them empty to hide the countdown. Times are your browser's local time.

**Platform switches**

| Switch | On | Off |
| --- | --- | --- |
| **Allow new submissions** | Founders can submit | Intake paused (you can still add pitches manually) |
| **Allow founder edits** | Every team can edit their pitch and files | Edits only where you unlocked a specific pitch |
| **Publish leaderboard publicly** | `/leaderboard` shows the ranking | Results private |

Changes apply immediately — no redeploy, no waiting.

**Branding** — hub name and institution line, used in the header, footer and every notification email.

**Platform health** — shows whether you are on Supabase Postgres + Storage (production) or the local
file store (development), and whether email delivery is live.

**Email log** — the last 100 messages the platform generated, with status:

| Status | Meaning |
| --- | --- |
| `sent` | Delivered by Resend |
| `queued` | Rendered but not delivered — no `RESEND_API_KEY` configured |
| `failed` | Rejected by the provider; the row shows the reason |

**Send test email** — confirms delivery works before you rely on it.

---

## Day-to-day answers

**A founder says they didn't get an email.**
Check **Settings → Email log**. If the row says `queued`, email isn't configured. If it says `failed`,
read the reason (usually an unverified recipient domain). Either way, the founder sees the same status
change on their dashboard, so nothing is lost.

**A team needs to fix a typo after submitting.**
Find their pitch in **Pitches** → click the unlock icon (or use **Open for edits** in the detail panel)
→ tell them to refresh their dashboard. Lock it again once they're done. To open edits for everybody
at once, use **Allow founder edits** in Settings.

**Someone submitted twice.**
Delete the duplicate: open it, confirm the **Delete** button. Their founders, files and result are
removed with it. Ask the team to keep the pitch they want.

**A submission arrived after the deadline.**
You can still create it yourself: with **Allow new submissions** off, admins can submit directly at
`/submit-pitch`. It behaves like any other pitch.

**A founder wants to withdraw.**
Delete their pitch (or set the status to *Not selected* and leave it in the archive).

**Scoring: what if two pitches tie?**
Give them different ranks — the leaderboard sorts by rank ascending, and ranks are unique per pitch. Use
the score column to show how close it was.

**Can I edit a founder's description for them?**
Not directly — the submission belongs to them. Unlock it and ask them to edit, or delete and re-enter
it as an admin if it's urgent.

**End of semester.**
Export the Pitches CSV and the Results CSV, keep them with the Hub records, then set up the next round
as described in [DEPLOYMENT.md → Starting a new semester](DEPLOYMENT.md#starting-a-new-semester).

---

## Quick reference

| I want to… | Go to | Do this |
| --- | --- | --- |
| Change the deadline | Settings | Set *Submission deadline* → Save |
| Stop accepting submissions | Settings | Switch *Allow new submissions* off |
| Let a team fix their pitch | Pitches | Unlock icon on that row |
| Let everyone edit | Settings | Switch *Allow founder edits* on |
| Move a pitch forward | Pitches | Status dropdown in the row |
| Announce something | News | Write → Publish post |
| Spotlight the winner | News | Link the pitch → Publish (team is emailed) |
| Show the world the ranking | Results | **Publish results** |
| Take the ranking down | Results | **Unpublish results** |
| Record scores | Results | Manual entry or Batch upload |
| Archive everything | Pitches | Export CSV |
