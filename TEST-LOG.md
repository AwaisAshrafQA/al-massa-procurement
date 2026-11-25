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
