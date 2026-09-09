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

- [ ] **1.0.9 — In-app notifications**
  Mentions, assignments, status changes, approvals, activity due dates.
  *Done when:* assigning a ticket notifies the assignee in-app.

- [ ] **1.0.10 — Dashboard + My Work**
  Real data: my tickets, my activities, pending approvals, overdue, upcoming.
  *Done when:* the home screen reflects your actual records.

- [ ] **1.0.11 — Swap mockup for working UI**
  Replace `mockup.html` screens with the real React app on live data.
  *Done when:* full click-through works end to end on v1.0 scope.

---

## Later phases (not started)

- [ ] **v1.1 — Projects & Tasks** (+ activities/follow-ups)
- [ ] **v1.2 — Meetings & Calendar** (invitations, RSVP, minutes, action items)
- [ ] **v1.3 — Training** (checklist, materials, employee acknowledgement)
- [ ] **v1.4 — Procurement** (supervisor routing, director path, quotations)
- [ ] **v1.5 — Management Reporting**
- [ ] **v2.0 — Integrations & AI** (email/WhatsApp, workflow engine, AI, mobile)
