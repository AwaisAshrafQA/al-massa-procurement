# Al Massa Procurement — MVP

A mobile-first web app that moves site purchase requests off WhatsApp into one tracked cycle:

**Site Engineer → Procurement review → Project Manager approval → supplier and delivery date → receipt confirmed on site**

This is the agreed **MVP slice**: English only, no emails, sample data. It proves the core loop works end to end, with the business rules enforced in the database. Full version 1 (LPO PDF, emails, Arabic, Excel import and so on) builds on the same database and workflow functions.

## What it does

| Area | Included |
|---|---|
| Sign-in | Email and password; 4 roles; users see only the projects they are assigned to |
| Request form | Header and lines; catalogue search by code or name, with free text as a fallback; Arabic-Indic digits accepted in quantities; save draft or send |
| Approval cycle | Procurement forwards or returns; PM approves, returns or rejects; Procurement records supplier and delivery date; Site Engineer confirms receipt; cancel and delete-draft |
| Rules | Return, Reject and Cancel need a comment · nobody decides on a request they raised · Admin can act for an absent PM (logged "as Admin") · request number `PR-YYYY-NNNN` assigned when first sent |
| Screens | Login · **Overview** (live KPIs and charts: requests per day, time at each step, pipeline by status, requests by project, latest activity) · My requests · Inbox (waiting on me, urgent first, then oldest) · Request detail with lifecycle tracker and full timeline · New / edit request |
| Security | Row-level security on every table; status can change **only** through database functions; the approval, order, receipt and log tables are read-only to users |

## Demo accounts

All use the shared demo password (sent separately, never stored in this repo).

| Email | Role | Projects |
|---|---|---|
| se1@example.com | Site Engineer | 155 Villa Complex, GEN General |
| se2@example.com | Site Engineer | 162 Warehouse |
| proc1@example.com | Procurement | all |
| pm1@example.com | Project Manager (+ Site Engineer) | PM of 155 and GEN |
| pm2@example.com | Project Manager | PM of 162 |
| admin@example.com | Admin (Technical Office) | all |
| se3@example.com | Site Engineer | 168 School Extension, 171 Residential Tower, 149 (closed) |
| se4@example.com | Site Engineer | 171, 174 Labour Accommodation, 180 Road & Utilities |
| proc2@example.com | Procurement (second buyer) | all |
| pm3@example.com | Project Manager | PM of 168, 171, 149 |

## Decisions taken for open points

These follow the "simplest reading" stated in the scope review. Each can be changed later.

1. "Returned" is two statuses: returned to site, and returned to Procurement. After a PM return, Procurement can re-forward or return to site.
2. A **Cancelled** status exists. The requester can cancel before PM review; Admin can cancel any open request. A reason is always required.
3. "General / all sites" is a normal project (GEN) with its own PM.
4. The PM approves before price is known, as in the scope. There are no prices in the MVP.
5. There is no backup approver. Admin can take any Procurement or PM decision, and the timeline shows "as Admin".
6. Nobody can forward or decide on a request they raised.
7. Free-text items stay free text. Suppliers come from the seeded list only.
8. One supplier and one delivery date per request. Procurement can update them after ordering.
9. Receipt is all or nothing, with an optional note.
10. Procurement Engineers share one inbox.
11. Site Engineers see all requests on their projects. Any Site Engineer on the project can confirm receipt.
12. Urgent requests are flagged and sorted first. There is no separate fast track.
13. The request number is given when a request is first sent. Unsent drafts can be deleted.
14. A sent request cannot be recalled; Procurement returns it instead.
15. Procurement cannot edit lines; it returns the request to site instead.

## Tech

React 18 + TypeScript + Vite + Tailwind (the same stack Lovable generates), with Supabase (Postgres, Auth). Hosting is Vercel. Everything runs on free plans.

```
supabase/migrations/   001 schema · 002 security (RLS, privileges) · 003 workflow functions
scripts/seed.ts        demo users and master data, plus scripts/scenarios.ts: ~95 backdated history requests and 11 current ones (npm run seed / npm run reset)
scripts/coverage.ts    prints which data types and workflow paths exist in the database
tests/                 45 API tests run against the real database as each demo user
src/                   the app
```

## Run locally

1. Create `.env` in the project root with these 5 settings. Never commit this file.
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...          (public / publishable key)
   SUPABASE_SERVICE_ROLE_KEY=...       (secret; local scripts only, never in the app or Vercel)
   SUPABASE_PROJECT_REF=...
   DEMO_PASSWORD=...                   (8+ characters)
   ```
2. Install, then run:
   ```
   npm install
   npx supabase link --project-ref <ref>
   npm run db:push        # apply migrations
   npm run seed           # demo data
   npm test               # 45 tests
   npm run reset          # clean demo data again (tests use up request numbers)
   npm run dev            # http://localhost:5173
   ```

`npx tsx scripts/dev-session.ts <user>` prints a one-hour test sign-in for a demo user, for local browser testing without the password.

## Deploy (Vercel)

Import the GitHub repo in Vercel (framework: Vite). Add only the two **public** variables, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `vercel.json` makes page links work.

Before a demo, run `npm run reset`. The GitHub Action `keepalive.yml` pings Supabase daily so the free project does not pause; it needs the repo secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

## 5-minute demo script

Run `npm run reset` first. Use a phone, or a browser in phone view.

1. **se1** (Site Engineer) → **New request** → project 155 → tap **Urgent** and give a reason → line 1: search "W2" → qty 2 → **Add line** → type "Hessian cloth", choose *use as free text*, qty 10, unit ROLL → **Send**. Point out the number PR-2026-00xx and the timeline.
2. **proc1** (Procurement) → **Inbox**: urgent first. Open the request → try **Return to site** with no comment (blocked) → **Forward to PM**.
3. **pm1** (PM) → **Approve**.
4. **proc1** → **Record supplier & delivery** → pick a supplier and a date.
5. **se1** → **Confirm receipt** → show the full timeline: who, when, and what was said at each step.
6. **Security:** **se2** (another project) opens the same link → "not found". **pm1** opens the GEN request "Site office" (raised by pm1, waiting for PM approval) → no Approve button, and it is not in pm1's Inbox. **admin** approves it → the timeline says "as Admin".

## Next version (backlog, not in the MVP)

Email notifications and idle reminders · LPO PDF (Arabic) · Arabic RTL interface · safety requests and employees · attachments and camera · repeat last request · prices and VAT · admin screens and Excel import/export · full catalogue · PWA install · line edits by Procurement · several suppliers or LPOs per request · partial deliveries · reports.

## Extras beyond the agreed MVP (presentation polish)

These were added on top of the 2-day slice to make the demo more engaging. None of them changes an approval rule, and the 45 database tests are unchanged.

| Extra | What it does |
|---|---|
| **Live updates** | Supabase Realtime streams workflow events (same row-level security). Screens refresh by themselves, and the person whose turn it is gets a pop-up ("PR-2026-0030 · Forwarded to Project Manager · by Sara Ali") |
| **Notification bell** | The latest events from other people, with an unread count and "mark all read" |
| **Arabic / English** | Full right-to-left Arabic interface (user menu or login page). All 268 UI strings and database messages are translated in `src/lib/i18n.ar.ts`, a draft to be reviewed by an Al Massa Arabic speaker. `npx tsx scripts/i18n-check.ts` reports any missing strings |
| **Dark mode** | Follows the device setting, or the toggle in the user menu |
| **Pipeline board** | A board with one column per stage, kept live by Realtime |
| **Waiting badges** | "Waiting 1d 4h" on every open request, amber after 1 day and red after 2 (the scope's reminder threshold) |
| **Overview trends** | Sparklines, week-over-week change, project cards with a delivered % ring, and a schematic site map |
| **Quick search** | Ctrl/⌘ + K, or the search icon: jump to any request or run a command |
| **Swipe actions (phone)** | Swipe an Inbox card to reveal Forward or Approve. Nothing happens until the button is tapped, and the server still checks the rules |
| **Item icons, confetti, animated toasts** | Category icons for catalogue items, and a confetti burst when goods are received |
| **Install as an app** | Manifest, icons and an offline app shell (`public/manifest.webmanifest`, `public/sw.js`, active in production builds only) |

### Al Massa logo
The official logo (supplied as AVIF) is in use: the diamond mark appears in the header, login page, browser tab and app icons, always on a white tile so the navy mark stays visible on dark backgrounds. The wordmark is typed text, because the supplied image has its text cropped.
- Source files (not published): `brand-source/`
- To regenerate after receiving a better file (ideally SVG or a full-width PNG): put it in `brand-source/`, then run `npx tsx scripts/convert-logo.ts`, `npx tsx scripts/make-mark.ts` and `npx tsx scripts/make-icons.ts`, and re-export `public/brand/logo-mark-256.png`.
- Brand colours sampled from the logo: navy `#203050`, orange `#F09020`.

## Demo data (what `npm run reset` creates)

All invented. Every request goes through the real workflow functions; only the timestamps of history are moved back.

| Area | Contents |
|---|---|
| People | 10 users: 4 Site Engineers, 2 Procurement, 3 PMs (one also raises requests), 1 Admin |
| Projects | 8: Al Ain, Mussafah, Sharjah, Dubai Marina, Ruwais, Fujairah, the general "all sites" project, and one **closed** (handed-over) project |
| Catalogue | 87 items in 16 categories (water, fuel, debris, sand & aggregate, cement, steel, blocks, timber, fixings, waterproofing, plumbing, electrical, scaffolding, PPE, tools, paint), 16 units, 12 suppliers |
| Requests | About 106 over 6 weeks, every status (2 drafts), about 20% urgent, multi-line requests, free-text lines and line notes |
| Workflow paths | Delivered · returned to site and resent · PM returned to Procurement (then re-forwarded) · rejected · cancelled by the requester · cancelled by Admin after a supplier failed · supplier changed after ordering · short or damaged delivery noted on receipt · PM's own request approved by Admin |
| Waiting | Open requests left waiting so the badges show every state: under a day, amber (1–2 days) and red (over 2 days), including an overdue delivery |

Run `npx tsx scripts/coverage.ts` to see the exact counts.

## Brand
The colours follow the Al Massa logo: **navy #203050** (header, buttons, charts) and **orange #F09020** (badges, highlights). The chart series colour is a navy-blue (#2C4A8A, or #7F9AD6 in dark mode) chosen for contrast on chart surfaces.
