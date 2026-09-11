# OpsHub — Phase-by-phase build plan

Rule (from brief §24): build one small step, test it, then continue.
Each step restates scope + success criteria before code is written.
`[x]` = done and tested · `[~]` = in progress · `[ ]` = not started

---

## Phase v1.0 — Core Platform

- [x] **1.0.1 — Project scaffold**
  NestJS API + React app + Prisma + git repo. Health check confirms DB connection.
  *Done:* `/api/v1/health` returns `{status: ok, db: connected}` against Neon.

- [x] **1.0.2 — Core database schema**
  18 tables: users, roles, user_roles, departments, teams, team_members, designations,
  branches, master_data_types, master_data_values, attachments, comments,
  comment_mentions, followers, activities, audit_log, notifications, system_settings.
  Seed: 7 roles, 8 departments, 5 designations, 17 master-data types / 56 values,
  1 Super Admin user.
  *Done:* migration applied clean, seed is idempotent, data verified.

- [x] **1.0.3 — Authentication**
  JWT in an httpOnly cookie (7-day). `POST /auth/login`, `POST /auth/logout`,
  `GET /auth/me`, `POST /auth/password/change`. Global guard protects every route
  by default; `@Public()` opts out; `@CurrentUser()` helper for controllers.
  React: login screen, auth context, logout.
  *Done:* verified end to end (9 API checks + browser login→home→logout).

- [x] **1.0.4 — Users, Roles, Departments, Teams**
  `@Roles()` decorator + RolesGuard (2nd global guard). API: users CRUD +
  status + role assignment + `/users/lookup`; departments CRUD; teams CRUD +
  members add/remove; read-only `/roles`, `/designations`. Privileged-role grants
  are Super-Admin-only; Super-Admin accounts are protected from lesser admins.
  Web: sidebar shell + Users / Departments / Teams screens with modals.
  *Done:* verified end to end — 13 API checks + browser flow (invite user →
  assign roles → create dept → create team → add member).

- [x] **1.0.5 — Master Data module**
  Generic `GET/POST/PATCH/DELETE /master-data/:type[/:id]` + `/:type/reorder`
  (auto slug keys, hierarchy via parentId, system values deactivate-only).
  Full CRUD for `/designations` and `/branches` (were read-only stubs).
  All writes Super-Admin-only. Web: "Master Data" screen — type picker +
  values table with add/edit/reorder/deactivate/delete.
  *Done:* verified — 15 API checks (409 on system delete, 404 unknown type,
  reorder, designation in-use guard) + browser flow (add "Critical" priority,
  reorder, delete).

- [x] **1.0.6 — Shared building blocks**
  Global SharedModule mounted via `/:entityType/:entityId/…`:
  - Attachments: upload (multipart, local-disk storage → swap for R2 later),
    download, link, list; 50 MB cap
  - Comments/chatter: post/edit/soft-delete; `GET …/chatter` = comments + audit
    events merged chronologically
  - @mentions → auto-follow + MENTION notification; other followers get GENERAL
  - Followers: list/add/remove
  - Activities: create/update/complete, `GET /me/activities`; assignment notifies
  - Audit: append-only `AuditService.record()`; `GET …/audit` + admin `GET /audit`
  - Notifications: list, unread-count, mark read/all
  Web: **My Work** (activities) + **Notifications** screens, sidebar unread badge.
  *Done:* verified — 20+ API checks across two users (mention→follow→notify,
  activity assign→complete→audit, upload→link→download, 403s) + browser
  (create activity, mark done, notifications page). Storage: local disk for now.

- [x] **1.0.7 — Tickets: create / list / detail**
  Ticket model (TKT-0001 numbering, statusKey/priority/type as master-data keys,
  conditional-form answers as JSON). Conditional forms per type (`/ticket-forms`).
  `GET /tickets` (views: all/mine/team/unassigned/following) + visibility-filtered
  per §8.3; `GET /tickets/:id` (403 if not authorized); create; edit;
  `PATCH /tickets/:id/assignee` (admin-only, auto-advances New→Assigned).
  RolesGuard now always populates `req.userRoles` (removed giant @Roles lists).
  Web: Tickets list (view tabs + filters), New-request modal with conditional
  fields, TicketDetail with Discussion/Activity/Files/History tabs reusing 1.0.6.
  Demo data: `npm run db:seed:demo` — 8 users (password Demo!2345), 3 teams,
  14 tickets, sample comments/activity.
  *Done:* verified — visibility API suite + browser (admin sees 14, Lena sees
  her 2; open ticket, post comment, conditional fields render).

- [x] **1.0.8 — Ticket status flow + close/reopen**
  `POST /tickets/:id/status` — validated transitions (New→Assigned→In Progress
  →Waiting for User→Resolved, plus sensible back-moves), optional comment,
  STATUS_CHANGED audit (old→new), notifies requester + assignee + followers.
  `POST /tickets/:id/close` — requester / assignee / admin; records closedBy +
  closedAt; CLOSED audit. `POST /tickets/:id/reopen` — ADMIN only, reason
  mandatory (min 3 chars), REOPENED audit with reason in meta, status → in_progress
  (or new). `get()` now returns `allowedTransitions` + `permissions`.
  Web: status bar on TicketDetail — status badge, "Move to…" dropdown, Close
  button, Reopen modal (reason). Status colour badges.
  *Done:* verified — 12 API checks (invalid transition 400, unrelated user 403,
  close-via-status 400, requester close, non-admin reopen 403, reopen-no-reason
  400, reopen with reason) + browser status change + audit trail.

- [x] **1.0.9 — In-app notifications**
  Triggers wired: @mention (1.0.6), ticket + activity assignment (1.0.6/1.0.7),
  ticket status change (1.0.8), and now **activity due-date reminders** —
  `RemindersService` `@Cron(EVERY_HOUR)` finds OPEN activities due within 24h
  (or overdue), notifies the assignee once per ~day (`lastRemindedAt` cooldown);
  `POST /admin/run-reminders` triggers it on demand (admin only).
  Web: notification **bell** in the top bar (dropdown: recent 8, mark-all-read,
  see-all); clicking a ticket notification (bell or Notifications page) opens
  that ticket.
  *Done:* verified — reminder API suite (overdue vs due-soon, cooldown→0,
  completed excluded, 403 non-admin) + browser (bell dropdown, click-through
  to TKT-0001).

- [x] **1.0.10 — Dashboard + My Work**
  `GET /dashboard` — visibility-scoped ticket status counts, unassigned,
  overdue-activity count, 6 recent tickets. `GET /me/work` — my open tickets
  (with requester/assignee/follower role), my open activities split into
  overdue / due-in-7-days / later.
  Web: Dashboard page (KPI cards + recent tickets, click → open ticket),
  My Work page rebuilt (cards + My tickets + activity groups + New activity).
  Sidebar footer shows the running build (`v1.0 · build 1.0.10`), driven by
  `web/src/version.ts` — bump per phase.
  *Done:* verified — API scoped (admin open 11 / lena open 2) + browser
  (Dashboard cards + recent-ticket click-through, My Work sections).

- [x] **1.0.11 — Final v1.0 integration pass**
  Real React UI was built screen-by-screen through 1.0.3–1.0.10, so there was
  no "swap" — this pass added loading states (chatter/audit panels), refreshed
  the demo dataset, and ran a cross-role smoke test.
  *Done:* all 8 demo roles verified — login / dashboard / me-work / tickets /
  notifications all 200; ticket visibility scales by role (admin 14 → director 1);
  `/users` is 200 for admin, 403 for everyone else. `mockup.html` retired
  (kept as a reference artefact). README carries the v1.0 status + deferred list.

---

## Change requests

- [x] **CR-2: Kanban + List views, theme switcher, rebrand** (build 1.2.2)
  - `<Board>` component (collapsible columns, ◀▶ card move, count badges).
    Projects page and Tasks page each get a **List / Board** toggle; Projects
    board columns = project statuses, Tasks board columns = task statuses.
  - Theme: `theme.tsx` (ThemeProvider + `useTheme` + `<ThemeSwitch>` ☀/☾/🖥),
    persisted in localStorage, "system" follows `prefers-color-scheme`.
    App.css fully tokenised (`--bg/--surface/--border/--text/…`) with a dark
    palette; switch in the top bar and on the login card.
  - Rebrand: "OP → C&C", "OpsHub → Captain Project Management" (sidebar, login,
    browser tab title).
  - Verified in browser: dark/light toggle across all pages, board card move
    persists, rebrand strings, `<title>`.

- [x] **CR-1: remove Priority entirely; show creation dates in every list** (build 1.2.1)
  - Dropped `Ticket.priority` and `Task.priority` columns (migration `remove_priority`);
    removed the `priorities` master-data type + values (core seed now deletes them).
  - Removed priority from every DTO, service, form, filter, table, and detail view.
  - Added a **Created** date column to: Tickets list, Projects list, Tasks list,
    the Project-detail task rows, Dashboard "recent tickets", My Work "my tickets";
    ticket detail shows "Created" instead of "Priority".
  - Brief updated (`Internal_Company_Operations_Project_Brief_v1_UPDATED.docx`):
    removed §8.5 Priority, the §8.2 "optional priority" line, "Priorities" from
    §5.1 Ticket Masters, "Priority" from §11 task fields; added a "Visible
    creation dates" principle to §2.
  - Verified: master-data types 17→16, ticket/task payloads have no `priority`
    and carry `createdAt`, create-without-priority → 201.

---

## ✅ v1.0 — Core Platform: COMPLETE (build 1.0.11)

---

## Later phases (not started)

- [x] **v1.1 — Projects & Tasks** (build 1.1.0)
  Schema: Project (PRJ-0001, type/status as master-data keys, owner + members),
  ProjectMember, Task (TSK-0001, project-scoped, self-ref subtasks, status/priority).
  API: `/projects` CRUD + `/status` + members add/remove + `/stats`;
  `/projects/:id/tasks` + `/tasks` (cross-project) + `/me/tasks` + task
  `/status`; visibility = owner / member / admin; progress % = done ÷ total tasks;
  task events audit onto the parent PROJECT; task assignment notifies.
  Web: Projects list (progress bars) → ProjectDetail (status dropdown, progress
  bar, team add/remove, tasks grouped To Do/In Progress/In Review/Done with
  per-task assignee+status selects + subtasks, Discussion/Activity/Files/History
  tabs). Tasks page (My Tasks / All, grouped, → open project).
  *Done:* verified — API suite (visibility 403s, subtasks, status flow,
  progress 20%→29%, audit onto project) + browser (list, detail, task add,
  progress recompute).
- [x] **v1.2 — Meetings & Calendar** (build 1.2.0)
  Schema: Meeting (MTG-0001, startsAt/endsAt, organizer, location + onlineLink,
  related project, minutes, lastRemindedAt), MeetingParticipant (response
  PENDING/ACCEPTED/DECLINED/TENTATIVE + respondedAt + attended).
  API: `/meetings` list (from/to range for calendar) + CRUD; visibility =
  organizer / participant / admin; `POST /meetings/:id/rsvp` (records who + when,
  notifies organizer); `POST /:id/attendance` (organizer); `PUT /:id/minutes`;
  `POST /:id/action-items` → creates an Activity (entityType MEETING) + notifies
  assignee; `GET /me/meetings?upcoming=true`. Invitations on create.
  Reminder job extended: meetings starting within 24h notify all participants.
  Web: month calendar (prev/next/today, meeting chips) → MeetingDetail
  (RSVP bar, participants + attendance, minutes editor, action-items list + add,
  Files). "Meetings & Calendar" nav.
  *Done:* verified — API suite (visibility 403, RSVP recorded+notified,
  attendance, minutes, action-item→Activity→My Work+notification, reminder job,
  full audit trail) + browser (calendar grid, meeting detail layout).
- [x] **v1.3 — Training Management** (build 1.3.0)
  Schema: Training (TRN-0001, topic, categoryKey, type INDIVIDUAL|GROUP, trainer,
  scheduledAt, statusKey, completedAt, lastRemindedAt), TrainingParticipant
  (ackStatus PENDING|CONFIRMED|NEEDS_FOLLOW_UP + ackAt + ackComment),
  TrainingChecklistItem.
  API: `/trainings` CRUD; visibility = trainer / participant / creator / admin;
  `POST /trainings/:id/status` — brief §13.1 flow (Requested→Scheduled→In Progress
  →Trainer Checklist→Waiting for Acknowledgement→Completed) + one step back;
  **completion blocked until every participant has CONFIRMED**. Checklist
  add/toggle/remove (trainer/creator/admin). Participants add/remove.
  `POST /trainings/:id/acknowledge` — participant CONFIRMED / NEEDS_FOLLOW_UP
  (+ comment); notifies trainer + creator; audited. Materials via shared
  attachments (entityType TRAINING). `GET /me/trainings`. Reminder job extended
  for scheduled trainings within 24h.
  Web: Training list + New-training modal (topic, category, type, trainer,
  schedule, checklist lines, participants) → TrainingDetail (status bar,
  participants+ack, trainer checklist, materials, acknowledgement panel for
  participants when waiting_ack, Discussion/History tabs). "Training" nav.
  *Done:* verified — API suite (visibility 403, ack recorded, complete-blocked-
  until-all-confirmed 400, status flow, checklist toggle, notifications, audit)
  + browser (list, detail, participant "Confirm completed" updates the badge).

  Also: dev web port 5173 → **5180** (`strictPort`) — 5173 was taken by another
  local project; WEB_ORIGIN + README updated.
- [x] **v1.4 — Procurement** (build 1.4.0)
  Schema: ProcurementRequest (PR-0001, type PRODUCT|SERVICE, item description,
  business reason, quantity, department, statusKey enum), ProcurementQuotation
  (vendor, amount, terms, delivery, status PENDING|SELECTED|REJECTED).
  API: role-stage routing per §14.1 — Employee submits (SUBMITTED, visible to
  any SUPERVISOR) → supervisor-decision (approve to purchasing / forward to
  director / reject) → director-decision (any DIRECTOR, when AWAITING_DIRECTOR)
  → WITH_PURCHASING (any PURCHASING_FINANCE adds/selects quotations, selecting
  one auto-rejects the rest) → purchase-status ORDERED (blocked without a
  selected quotation) → DELIVERED. Every stage change dated + audited +
  notifies the requester; entering a stage notifies the role that owns it.
  Web: Procurement list + New-request modal → ProcurementDetail with
  role-and-stage-aware action bar (supervisor buttons / director buttons /
  purchasing quotations table + add form) plus Discussion/Files/History tabs.
  *Done:* verified — full routing chain via API (submit → forward → director
  approve → 2 quotations → select → ordered → delivered, with 403s at each
  wrong-role/wrong-stage attempt) + browser (quotations table, select, mark
  ordered live-updates the stage).
- [x] **CR-3 — Drag-and-drop file upload**
  `EntityAttachments` (apps/web/src/components/entity-panels.tsx) — the single
  shared attachments component used by every Files/Materials tab (Tickets,
  Projects, Meetings, Trainings, Procurement) — now renders a dashed dropzone
  supporting drag-over/drop as well as click-to-choose, with multi-file
  select, an uploading state, and inline error text; the plain `<input
  type="file">` remains available (hidden) inside the dropzone label as the
  fallback control. New `.dropzone` styles added to App.css using the
  existing theme tokens (dark/light/system all covered). Applies everywhere
  in the app from this one file — no per-module changes needed.
  *Done:* `npm run build --workspace apps/web` clean; verified in browser on
  Procurement PR-0012's Files tab (dropzone renders, themed correctly).
- [x] **CR-4 — File-upload contrast + audit trail for attachments**
  Dropzone text color switched from `--text-muted` to `--text` (bold) so it's
  clearly legible on light backgrounds, not just dark.
  Backend: `AttachmentsService.linkToEntity` and `.remove`
  (apps/api/src/shared/attachments.service.ts) now write to the AuditLog
  (`ATTACHMENT_ADDED` / `ATTACHMENT_REMOVED`, e.g. "Priya Nair uploaded a
  file — quote.pdf") and notify followers, exactly like comments/status
  changes already do — so every file add/remove now shows up in the
  entity's History tab (and Discussion feed) for anyone who can view the
  record, per brief §17 (audit log).
  *Done:* `npm run build` clean for both apps; verified via API — uploaded +
  linked a file to PR-0012 as Priya Nair, confirmed `/procurement-
  requests/:id/audit` returns `ATTACHMENT_ADDED — uploaded a file —
  dnd-test.txt`; test attachment cleaned up afterward.
- [x] **CR-5 — Multiple line items per procurement request**
  Schema: new `ProcurementItem` model (type PRODUCT|SERVICE, description,
  quantity) with a many-to-one relation to `ProcurementRequest`; `type`,
  `itemDescription`, `quantity` moved off the request onto its items
  (migration `20260911120036_procurement_line_items`, with a data backfill
  so existing requests each get one item before the old columns are
  dropped).
  API: `CreateProcurementDto`/`UpdateProcurementDto` now take an `items[]`
  array (min 1, each validated) instead of a single type/description/qty;
  list/stats/notification titles summarize as "first item +N more"; the
  `type` list filter now matches "any item of this type."
  Web: the New-request modal is now a repeatable item-row list (type ·
  description · qty · remove), "+ Add another item"; the list table and
  detail header show the first item + "+N more" and "Mixed" when types
  differ; the Details tab shows a full items table (type/description/qty)
  instead of one quantity field.
  *Done:* `npm run build` clean for both apps; migration applied + demo data
  reseeded (`seed.ts` + `seed-demo.ts`, one seeded request now has 3 mixed
  items); verified via API (created a 3-item mixed request) and in-browser
  (list shows "router +2 more / Mixed", detail shows all 3 rows, New-request
  modal adds/removes item rows correctly).
- [x] **CR-6 — Assigned RFQ ownership, post-RFQ Director approval, and Director standing override**
  Schema: `ProcurementRequest.assignedToId` (nullable, FK to `users`) — the
  Purchasing/Finance user the creator picked to gather RFQs; nullable so
  older/unassigned requests fall back to "any Purchasing/Finance user."
  New `AWAITING_FINAL_APPROVAL` status between WITH_PURCHASING and ORDERED
  (migration `20260911130500_procurement_rfq_workflow`).
  API (`procurement.service.ts`):
  - `create` accepts an optional `assignedToId`, validated to hold the
    PURCHASING_FINANCE role.
  - A new `assertPurchasingActor` gate replaces the old role-only check for
    quotations/send-for-approval/mark-delivered: if a request has an
    assigned owner, only they (or an admin) may act; unassigned requests
    keep the old "any Purchasing/Finance user" behavior.
  - `sendForApproval` (WITH_PURCHASING → AWAITING_FINAL_APPROVAL, requires a
    selected quotation) replaces the old direct "mark order placed" — the
    RFQ owner explicitly hands it to the Director instead.
  - `finalApproval` (Director, AWAITING_FINAL_APPROVAL → ORDERED on approve
    / REJECTED on reject) is the new gate before every order.
  - `stopPurchase` and `reassign` are the Director's standing override,
    available whenever a request is WITH_PURCHASING /
    AWAITING_FINAL_APPROVAL / ORDERED — Stop cancels it (REJECTED, mandatory
    comment); Reassign swaps the RFQ owner (comment optional). Both notify
    the requester + old/new assignee and are fully audited.
  - `/users/lookup` now takes an optional `role` filter (used to populate
    the Purchasing/Finance pickers).
  - Editing (requester can edit items/reason) is unchanged — still limited
    to the SUBMITTED stage, per your call to keep current behavior there.
  Web: New-request modal has an "Assign RFQ to" picker (optional, defaults
  to "any Purchasing/Finance user"); detail header shows the assignee;
  WITH_PURCHASING's action bar is now "Send for director approval"; a new
  AWAITING_FINAL_APPROVAL approve/reject bar for Directors; a "Director
  oversight" panel (Stop purchase / Re-assign RFQ owner) shown to Directors
  whenever the request is at a stoppable stage.
  *Done:* `npm run build` clean for both apps; migration applied + demo data
  reseeded (one request now sits at AWAITING_FINAL_APPROVAL with an assigned
  owner, to exercise the new stage). Verified the full chain via API: create
  with assignedToId → non-assignee blocked (403) from adding quotations →
  assignee adds + selects a quotation → send-for-approval blocked (400)
  before selecting, succeeds after → Director final-approval → ORDERED →
  Director reassign → Director stop (→ REJECTED, non-Director blocked 403)
  → confirmed every step in the audit log. Verified in-browser on the
  seeded forklift request: Final-approval bar and Director-oversight panel
  render correctly, Re-assign dropdown populates from the Purchasing/Finance
  role.
- [x] **CR-7 — Quotation authorship/attachments, "History"→"Activity" rename, editable select/reject**
  - Every quotation add/edit/select/reject now writes to the audit log with
    the actor's name (`QUOTATION_ADDED` already did; added `QUOTATION_EDITED`
    and a new explicit `QUOTATION_REJECTED`) — all visible on the Activity
    tab, and the quotations table itself now shows "by {who added it}"
    under each vendor name.
  - Quotations can now carry an attached document: the "Add quotation" form
    and the inline "Edit" form both take an optional file, uploaded via the
    existing attachments pipeline and stored as `attachmentId` on the
    quotation (`UpdateQuotationDto` gained `attachmentId` to match
    `CreateQuotationDto`).
  - Clicking a vendor's name opens that quotation's actual document
    (`/attachments/:id/download`) if one was attached; otherwise it opens a
    modal with the quotation's full details plus the request's items table,
    so there's still enough context to decide without a document.
  - Select/Reject are now both always available (not just one-shot) for any
    quotation while a request is WITH_PURCHASING — a SELECTED quote can be
    Rejected, a REJECTED one can be re-Selected, freely, right up until
    "Send for director approval" locks the stage. Added a matching
    `POST /procurement-quotations/:id/reject` endpoint (explicit reject,
    not just "select a different one").
  - Renamed the "History" tab to **"Activity"** everywhere it appears
    (Procurement, Tickets, Projects, Training). Tickets and Projects already
    had an unrelated "Activity" tab (todo-style follow-ups with due dates) —
    that one is now labeled **"To-dos"** to avoid a naming collision; the
    audit-trail tab (what used to be "History") takes the "Activity" name.
  *Done:* `npm run build` clean for both apps. Verified via API: created a
  request, added one quotation with an attached file and one without,
  selected one → rejected it explicitly → re-selected the other → edited a
  quotation's vendor name — every step appended to the audit log with the
  actor's name. Verified in-browser: vendor rows show "by {name}", the tab
  bar reads Discussion/To-dos/Files/Activity on a ticket with no collision,
  and Details/Discussion/Files/Activity on Procurement/Training.
- [x] **CR-8 — Per-item quotation costs (AED), full add/edit modal, seed-data audit gaps**
  Schema: new `ProcurementQuotationItem` model (quotationId, itemId, cost) —
  a quotation now breaks its cost down per request item instead of one lump
  sum; `ProcurementQuotation.amount` is the computed total (migration
  `20260911140000_procurement_quotation_line_items`, with a backfill that
  splits every existing quote's amount evenly across its request's items).
  API: `CreateQuotationDto`/`UpdateQuotationDto` take `items: [{itemId,
  cost}]` (validated to belong to the request) instead of a flat `amount`;
  the service computes and stores the total. `DETAIL_INCLUDE` now returns
  `lineItems` (with each item's type/description/qty) on every quotation.
  Web: currency is AED everywhere (new `aed()` helper in `ui.tsx`, replacing
  the old hardcoded `$`). "Add quotation" and "Edit" both now open a
  dedicated modal (`QuotationFormModal`) listing every item in the request
  with its own cost field and a live-computed total, plus vendor name,
  terms, delivery, comments, and an optional quote-document upload — this
  replaces the old single inline "vendor + amount" row. The no-attachment
  "view quote" modal now shows the actual per-item breakdown instead of a
  generic items table.
  Fixed: `seed-demo.ts` was creating quotations directly via Prisma,
  bypassing the audit trail entirely — so seeded requests showed no
  "who added/selected this quotation" in Activity. It now logs the same
  CREATED → SUPERVISOR_DECISION → QUOTATION_ADDED (×N) → QUOTATION_SELECTED
  → SENT_FOR_APPROVAL → FINAL_APPROVAL → STATUS_CHANGED chain a real user
  would produce, matched to each seeded request's stage, and gives every
  seeded quotation a per-item cost split. Also fixed `reset()` leaving
  demo-user-owned attachments behind (blocked user deletion on reseed via
  quotation-document FK) by clearing them before deleting the users.
  *Done:* `npm run build` clean for both apps; migration applied, both
  seeds reseeded successfully. Verified via API: created a 3-item quote
  with per-item costs (500+600+700 → amount 1800, confirmed). Verified in
  browser: quotations table shows AED amounts and "by {name}"; Add/Edit
  modals render every item with its own cost input and a live total;
  Edit correctly pre-fills a real quotation's per-item costs (700/700/700
  → AED 2,100) and terms; seeded PR-0029's Activity tab now shows the full
  CREATED → SUPERVISOR_DECISION → QUOTATION_ADDED → QUOTATION_SELECTED
  chain with names.
- [ ] **v1.5 — Management Reporting**
- [ ] **v2.0 — Integrations & AI** (email/WhatsApp, workflow engine, AI, mobile)
