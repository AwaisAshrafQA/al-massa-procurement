# Test log — Al Massa Procurement MVP

**Date:** 25 Nov 2026 · **Database:** Supabase project (Mumbai), migrations 001–003 · **Build:** `npm run build` passes, no type errors

## Summary

| Check | Result |
|---|---|
| Type check and production build | Pass |
| Automated API tests (`npm test`) | **45 / 45 pass** |
| Browser scenarios S1–S8, all 6 demo users, phone size | **All pass** (S8 not yet timed with a real user) |
| Browser console on a fresh load of every screen | No errors (one expected 400 from a deliberate wrong-password test) |
| Secret key or demo password in the built app | **None found** |
| Requirements traceability (section 4) | All in-scope items met. Live link and GitHub push are still to do |

## 1. Automated API tests: 45 / 45 pass

The tests run against the real database, signed in as each demo user. Every workflow step is tried once by someone allowed to do it and once by someone who isn't.

**Workflow (22)**
- **Send:** `PR-YYYY-NNNN` is assigned on first send, and numbers are consecutive. Sending is refused with 0 lines, a past date, Urgent without a reason, someone else's draft, or a second send.
- **Procurement:** only Procurement or Admin can forward, and not from the wrong status. Return needs a real comment (blank or spaces are refused). The requester can resend after a return, and the number stays the same.
- **PM:** only the project's own PM or Admin can approve; a second approve is refused. **When two approvals arrive at the same moment, exactly one succeeds.** Return needs a comment, after which Procurement can re-forward or return to site. Reject needs a comment and closes the request.
- **Separation of duties:** a PM cannot approve or reject their own request. Admin can, and is logged "as Admin".
- **Order:** Procurement only; past delivery dates are refused; updates are logged; refused before PM approval.
- **Receipt:** only once ordered; refused for an engineer on another project and for Procurement; allowed once.
- **Cancel and delete:** the requester can cancel before PM review, but not after. Admin can cancel an ordered request. Only the owner can delete an unsent draft, and a sent request cannot be deleted.
- **Timeline:** every step is logged with the person, from/to status and comment.

**Access control (12)**
- An engineer or PM on another project sees no part of a request.
- Each user sees exactly their own projects; Procurement and Admin see all.
- Signed-out visitors can read nothing.
- Nobody, not even Admin, can set the status or request number directly.
- New requests always start as the caller's own draft. No one can raise a request on an unassigned project or without the Site Engineer role.
- Writing directly to the approval, order, receipt or log tables is refused, and the log cannot be deleted.
- Lines of a sent request cannot be changed or added to.
- Internal functions and the numbering table are unreachable.

**Requirement checks (11)**
- A line needs an item or a description; quantity must be above 0; the unit must exist in the unit list.
- Catalogue and free-text lines are stored together.
- A required date of today is accepted, and Urgent with a reason is accepted.
- A returned request: the requester can edit the header and lines and resend; others cannot edit it.
- Admin can act for Procurement and is logged "as Admin".
- Another Site Engineer on the same project can confirm receipt.
- **Closed project:** new requests cannot be raised on it, and drafts on it cannot be sent.

## 2. Browser scenarios (phone size 375 × 812, every role)

| # | Scenario | Result |
|---|---|---|
| Login | Wrong password shows "Wrong email or password."; opening a request link while signed out goes to the login page | Pass |
| S1 | **se1** creates a 3-line urgent request: catalogue search "water const"; a free-text line; quantity typed as Arabic ٢ becomes 2; unit and size fill in automatically. Then **proc1** forwards with a note → **pm1** approves → **proc1** records supplier and date → **se1** confirms receipt | Pass: reached Received; the timeline shows every step with name, role, time and comment |
| S2 | An empty form flags every field. **proc1** Return with a comment of only spaces is blocked. **se1** opens the returned PR-0006, sees Procurement's comment at the top, edits it and resends | Pass: same number kept, and the return/resend loop shows in the timeline |
| S3 | **pm1** returns PR-0004 to Procurement with a comment | Pass: the status changes and Procurement gets Forward and Return actions again |
| S4 | **Admin** forwards PR-0008 for Procurement → **pm2** tries to reject with an empty reason (blocked), then rejects with a reason | Pass: closed, "This request is now closed.", no buttons left |
| S5 | **se2** opens the link to a project 155 request; **pm2**'s Inbox shows only project 162 | Pass: "Request not found, or you do not have access to it." |
| S6 | **pm1** raises a GEN request: it is not in pm1's Inbox and its page has no Approve, Return or Reject buttons. **Admin** approves it | Pass: timeline shows "Technical Office Admin · as Admin" |
| S7 | **se1** cancels a request with a reason; deletes an unsent draft | Pass: Cancelled shows in the timeline; the draft is gone and returns the user to My requests |
| S8 | The new-request form at phone size | Pass for the flow. **Not yet timed with a real site engineer.** Do this in the pilot |
| Lists | My requests: "Open" filter hides closed requests; status and project filters work; "Raised by me / All on my projects" toggle. Inbox: urgent first, then oldest; the "All requests" tab for Procurement and Admin; the menu adapts to multi-role users | Pass |

**Issues found and fixed during testing (4):**
1. The success message was hidden when the user had no further actions.
2. The closing message after Receive, Reject or Cancel wrongly said the request had moved to the next person.
3. "Save draft" on a returned (already sent) request now reads **"Save changes"**.
4. The demo data lacked a request raised by a PM, which the separation-of-duties demo needs. Added as PR-2026-0009.

## 3. Security checks
- The built JavaScript contains neither the secret key nor the demo password. The only "sb_secret_" text is Supabase's own key-format check.
- Database privileges: users have no write access to status, request number, approvals, order details, receipts or the log. Only the workflow functions write them, and the tests above prove it.
- Public sign-up is disabled in Supabase Auth.

## 4. Requirements traceability (against the scope review sent to Al Massa, section 3)

| Promised in the MVP | Where | Status |
|---|---|---|
| Sign-in, four roles, project assignment, seeded demo users | `auth.tsx`, `user_roles`, `project_members`, seed (6 users) | Met |
| Request form: header and lines, catalogue search plus free text, draft and send | `RequestForm.tsx`, `ItemPicker.tsx` | Met |
| Procurement forward/return; PM approve/return/reject; mandatory comments enforced on the server | `003_workflow.sql` | Met |
| Procurement records supplier and delivery date; Site Engineer confirms receipt | `rpc_record_order`, `rpc_confirm_receipt` | Met |
| Inbox, My requests, Request detail with full timeline | `Inbox.tsx`, `MyRequests.tsx`, `RequestDetail.tsx` | Met |
| Row-level security: users see only their assigned projects | `002_security.sql` | Met |
| Data model with `company_id` on every table | `001_schema.sql` | Met |
| Sample data: 2–3 projects, about 50 items, a few suppliers | seed: 3 projects, 50 items, 6 suppliers, 10 requests | Met |
| A re-runnable seed so the demo can be reset | `npm run reset` | Met |
| Decisions D1–D15 for the open points | README "Decisions" section; covered by the tests above | Met |
| Short test log | This file | Met |
| Code in GitHub | Repo ready and staged; secrets excluded | **To do (awaiting go-ahead)** |
| Live link | Vercel import after the push | **To do** |

## 5. Not covered (by design in the MVP)
Emails and reminders, LPO PDF, Arabic interface, attachments, prices and VAT, Excel import/export, admin screens, and the other next-version items in the README.

## 6. Presentation extras (added after the MVP), checked 25 Nov 2026

| Check | Result |
|---|---|
| Build, type check, 45/45 API tests after the extras | Pass |
| **Live update:** proc1 forwards PR-2026-0030 in a separate session while pm1's Inbox is open | Pass: pop-up shown and card appeared within 3.5 s, no refresh |
| **Swipe:** drag a card on pm1's Inbox, then tap Approve | Pass: button revealed; status became `approved_sourcing` and a confirmation appeared. First attempt failed because the browser treated the drag as a link drag; fixed |
| Arabic: all UI strings and database messages translated | Pass: 268/268 (`scripts/i18n-check.ts`). Translations are a draft for Al Massa to review |
| Screens in English and Arabic, light and dark, phone and desktop (40 screenshots) | Pass, no console or page errors. Fixed along the way: map labels clipped and overlapping; dark-mode contrast (white buttons, pastel chips, dividers, tracker line, board outlines); board columns too narrow on desktop; palette badges cramped on phones |

## 7. Brand colours and rich demo data, checked 25 Nov 2026

| Check | Result |
|---|---|
| Al Massa logo in the header, login page, browser tab and app icons, visible in light and dark mode | Pass |
| Navy and orange theme across all screens (English and Arabic, light and dark, phone and desktop) | Pass. The dev server needed a restart to pick up the new colours |
| Rich seed: 10 users, 8 projects (1 closed), 87 items, 12 suppliers, about 106 requests | Pass (`scripts/coverage.ts`) |
| Every workflow path present in the data | Pass: delivered 60, returned to site and resent 7, PM returned 11, rejected 14, cancelled 12 (4 after ordering), supplier changed 3, Admin-approved 2, short delivery 3 |
| Waiting badges in every state | Pass: amber 4, red 5 |
| API tests after reseeding | **45/45 pass.** Two earlier runs straight after the heavy seed each had one 30-second timeout on a different test; both passed on rerun, and no locks or blocked queries were found. Cause: the free-tier database slows briefly after thousands of writes. The project-list test was updated for the new projects |
| Overview with 8 projects | Map labels re-placed to avoid overlap. The closed project is marked "Closed", listed last and left off the map |

## 8. Role-by-role screen check (`scripts/role-check.ts`), 26 Nov 2026: 20/20 pass

Each user signs in through the real login screen and opens a request at a given stage. The test checks that exactly the expected action buttons appear, or that the request is hidden. Nothing is clicked.
- **Site Engineer:** draft (Send, Edit, Delete); returned to site (Resend, Edit, Cancel); pending Procurement (Cancel only); pending PM (no actions); ordered on own project (Confirm receipt).
- **Other projects:** an engineer or PM on another project gets "not found".
- **Procurement (both buyers):** review (Forward, Return to site); returned by the PM (Forward, Return to site); approved (Record supplier); ordered (Update supplier); pending PM (no actions).
- **Project Manager:** own project (Approve, Return, Reject); a request they raised themselves (no actions); a third PM on their own projects (Approve, Return, Reject).
- **Admin:** a PM's own request (Approve, Return, Reject, Cancel); ordered (Confirm receipt, Update supplier, Cancel).
- **Closed requests** (received, rejected, cancelled): no actions for anyone.

## 9. Overview drill-downs (`scripts/drill-check.ts`), 26 Nov 2026: all pass

Every number on the Overview can be clicked to list the requests behind it (bottom sheet on phones, panel on desktop; Escape or tap outside closes; filter box when more than 6).

| Check | Result |
|---|---|
| Tiles: Open requests / Urgent open / Delivered | panel count matches tile (18 / 6 / 60) |
| Tile: Sent → PM decision | 84 requests listed with their own time, slowest first |
| Bars: Where requests are now (9), Requests by project (8) | each bar's value matches its panel count |
| Bars: Average time at each step (4) | each opens its requests with time spent at that step |
| Columns: Requests sent per day (13 non-empty days) | each column's value matches its panel count |
| Project card 155 Villa Complex | 29 total = 29 listed |
| Tapping a request in the panel | opens that request and closes the panel |

## 10. Bug hunt and edge cases, 26 Nov 2026

New suite `tests/edge.test.ts` (16 tests) plus browser check `scripts/save-check.ts` (3 checks). Full API suite now **61 / 61 pass**; role check 20/20 and drill-down check all pass on the live site.

| # | Bug found | Fix | Proof |
|---|---|---|---|
| 1 | Mandatory comments (return, reject, cancel) accepted a comment that was only a newline or tab when the API was called directly; `btrim()` only strips spaces. Same gap for the urgent reason and line descriptions. | Migration `20261126000006_blank_text.sql`: `_clean()` trims all whitespace; comment check uses it; triggers clean request, line, approval and receipt text on write. | edge tests: 5 blank variants refused for return, PM reject/return and cancel; blank line description refused; real comment stored trimmed |
| 2 | Saving an edited request deleted all lines before inserting the new ones; a failed insert left the request with no lines. | `saveRequest` inserts new lines first, then deletes the old ones by id. | save-check 1 and 2 |
| 3 | Saving after someone else had moved the request on showed "Saved" but changed nothing (RLS made the update a silent no-op). | Update now checks a row changed; otherwise shows "This request can no longer be edited…". | save-check 3 |
| 4 | "Save draft" silently removed any line with a mistake (e.g. a bad quantity). | Only completely empty lines are skipped; a started but incomplete line blocks the save and is highlighted. | save-check 2 |
| 5 | A quantity above the database limit (999,999,999.999) gave a raw "numeric field overflow" error. | Form checks the limit. | save-check 2 |

Also verified, no change needed: double-clicks and simultaneous actions (two approvals, two receipts, two sends) never create a second decision, receipt or number; requesters cannot edit after sending, move a draft to a project they are not on, or write status, numbers or approvals directly; delivery date today accepted, yesterday refused.

## 11. Responsiveness sweep (`scripts/responsive-check.ts`), 26 Nov 2026

Every screen and the main pop-ups (drill-down, search, notifications, account menu, return and order sheets) were checked at 320, 375, 414, 768, 1024 and 1440 px, in English and Arabic. The script flags any page or element that sticks out sideways; screen-sized captures (`scripts/viewport-shots.ts`) were reviewed by eye.

| # | Issue found | Fix |
|---|---|---|
| 1 | Overview on phones was ~410 px wide, so the whole page scrolled sideways (320–414 px, both languages). | Grids get an explicit `minmax(0,1fr)` column on phones (Overview, request page, request form). |
| 2 | On phones the bottom nav covered the action sheets (Save hidden on "Record supplier & delivery" and "Return to site") and the drill-down panel. | Sheets and the drill-down panel render at page level (portal), with scroll lock and a height cap so tall sheets scroll. |
| 3 | Request page action buttons squeezed labels onto three lines at 320 px. | Buttons keep one line and wrap to a new row instead. |
| 4 | Drill-down rows at 320 px: request number broke over two lines and the "Needed" date overlapped the status badge. | Number never breaks; on phones the date moves under the row text. |
| 5 | Request timeline was 5 px too wide at 320 px; long unbroken comments could overflow. | Grid fix above, and comments wrap anywhere if needed. |
| 6 | My requests at 320 px: both tab labels wrapped and the two filters had different widths. | Tabs full width on one line; filters side by side in a grid. |
| 7 | KPI tiles cramped at 320 px; the "↑ 142% vs last week" chip split in the middle. | Slightly tighter tiles below 380 px; the chip keeps "↑ 142%" together. |
| 8 | Tablet (768 px) Overview showed project cards one per row across the full width. | Two per row on tablets. |
| 9 | Dropdown arrow padding was on the wrong side in Arabic. | Logical padding (`pe-8`). |

After the fixes: 170 screens (17 per width × 5 widths × 2 languages), 0 with sideways overflow. Drill-down and save checks still pass.

## 12. Dropdowns, dark mode and accessibility, 26 Nov 2026

`scripts/responsive-check.ts` now also runs in dark mode (`THEME=dark`) and runs the axe-core WCAG 2.2 A/AA scan on every screen (`AXE=1`). `scripts/viewport-shots.ts` captures dropdowns open at phone size.

| # | Issue found | Fix |
|---|---|---|
| 1 | Dropdowns looked different on every phone: browser's own arrow jammed against the edge (grey bubble on iOS), thick black focus outline instead of the app's ring, long text ran under the arrow. | One custom style for every select: no native look, app chevron on the reading-end side (flips in Arabic), app focus ring, text ends with "…". |
| 2 | Item search on lines lower in the form opened its results behind the Save/Send bar and bottom nav, so they could not be seen or tapped. | On phones the search box scrolls near the top when focused; results list capped to the visible height. Same focus ring as other fields. |
| 3 | Low contrast (WCAG 1.4.3): faint grey captions, chart axis labels, bottom-nav labels, notification and nav badges, the "Closed" chip, progress-bar step labels, the Esc hint. | Darker text tokens (all now 4.5:1 or better); icon buttons raised to 3:1+. |
| 4 | Chart bars were list items acting as buttons, which breaks the list for screen readers. | Clickable element moved inside the list item. |
| 5 | "Requests sent per day" columns were 18 px wide on phones (below the 24 px tap minimum). | Phones show the last 7 days (about 32 px per column); wider screens keep 14. |
| 6 | Request details used nested wrappers inside the definition list. | Flattened to one wrapper per label and value. |

Drill-down and form-save checks still pass.

## 13. App-drawn dropdowns (`scripts/dropdown-check.ts`), 26 Nov 2026: all pass

Native dropdown lists are drawn by the browser, not the app: desktop Chrome showed them at desktop size inside a phone-sized window (spilling past the screen with oversized text), and each phone shows its own picker. All dropdowns (project, unit, supplier, the My requests and Inbox filters) now use one app-drawn list that:

- looks the same on every device, in light and dark, English and Arabic (opens right-to-left);
- always stays on screen and opens upwards when there is no room below; sits above sheets and the bottom bar;
- never offers prompts such as "Select project…" as a choice;
- works by keyboard (arrows, Home/End, type-ahead, Enter/Space, Esc) and is announced as a list box to screen readers.

Checked at 360 and 1280 px: tap to pick, keyboard pick, Esc leaves the value unchanged, type-ahead, tap outside closes, list fully on screen (top and lower fields, and inside the order sheet), status filter shows only matching requests.
