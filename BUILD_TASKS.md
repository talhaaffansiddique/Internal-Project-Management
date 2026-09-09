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

- [ ] **1.0.4 — Users, Roles, Departments, Teams**
  Admin CRUD + role assignment + team membership. Access filtered by role.
  *Done when:* Super Admin can create a department, a team, and assign a user a role.

- [ ] **1.0.5 — Master Data module**
  Generic add/edit/deactivate of values for every configurable type.
  *Done when:* Super Admin adds "R&D" as a department from the UI, no code change.

- [ ] **1.0.6 — Shared building blocks**
  Attachments, chatter/comments, @mentions, followers, activities, audit trail —
  mountable on any record.
  *Done when:* posting a comment with a mention adds a follower + writes an audit row.

- [ ] **1.0.7 — Tickets: create / list / detail**
  Conditional forms per request type. My Tickets, Team Tickets, ticket detail.
  Visibility rules (private / team / admin).
  *Done when:* an employee raises an ERP-issue ticket; only authorized users see it.

- [ ] **1.0.8 — Ticket status flow + close/reopen**
  New → Assigned → In Progress → Waiting for User → Resolved → Closed.
  Records who closed + when. Reopen = Admin only, mandatory reason, audited.
  *Done when:* close/reopen behave exactly per brief §8.4.

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
