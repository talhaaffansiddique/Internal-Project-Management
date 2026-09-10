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
- [ ] **v1.3 — Training** (checklist, materials, employee acknowledgement)
- [ ] **v1.4 — Procurement** (supervisor routing, director path, quotations)
- [ ] **v1.5 — Management Reporting**
- [ ] **v2.0 — Integrations & AI** (email/WhatsApp, workflow engine, AI, mobile)
