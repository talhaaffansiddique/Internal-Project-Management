# Internal Operations Platform — API Specification (draft v0.1)

Derived from *Internal Company Operations & Project Management Platform — Project Brief v1.0*.
This is a **planning list**, not final. Build endpoints module-by-module following the roadmap (§23 of the brief).
Nothing here is implemented yet — the current deliverable is the clickable HTML mockup.

---

## 0. Conventions (apply to every endpoint)

| Item | Decision |
|---|---|
| Base path | `/api/v1` |
| Format | JSON request + response |
| Auth | `Authorization: Bearer <access_token>` on every call except login/refresh |
| IDs | UUID strings |
| Lists | Paginated: `?page=`, `?page_size=`, `?sort=`, plus filters. Response: `{ "results": [...], "page": 1, "page_size": 25, "total": 240 }` |
| Errors | `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": {...} } }` with proper HTTP status (400 / 401 / 403 / 404 / 409 / 422 / 500) |
| Filtering | Most list endpoints accept `?status=`, `?assignee_id=`, `?department_id=`, `?team_id=`, `?created_from=`, `?created_to=`, `?q=` |
| Access control | Every read/write is filtered by the caller's role + record visibility rules (brief §2, §8.3). The server never returns records the user is not authorized to see. |
| Audit | Every state-changing endpoint writes an audit entry automatically (brief §17). |
| Soft delete | Records are archived/deactivated, not hard-deleted (brief §17: "should not be silently overwritten"). |

---

## 1. Authentication & Session  *(Roadmap v1.0)*

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | Email + password → access token + refresh token |
| POST | `/auth/refresh` | Exchange refresh token for a new access token |
| POST | `/auth/logout` | Invalidate the current session/refresh token |
| GET  | `/auth/me` | Current user: profile, role, departments, teams, permissions |
| POST | `/auth/password/change` | Change own password (old + new) |
| POST | `/auth/password/forgot` | Request reset email (deferred if no email infra — Super Admin resets manually) |
| POST | `/auth/password/reset` | Complete reset with token |

> Login is tied to an individual user account so actions are always attributable (brief §4).

---

## 2. Users  *(v1.0)*

| Method | Path | Purpose |
|---|---|---|
| GET | `/users` | List/search users (filters: department, team, role, status) |
| POST | `/users` | Create / invite user (Super Admin). Fields: name, company email, department, teams[], designation, role, supervisor_id |
| GET | `/users/{id}` | User detail |
| PATCH | `/users/{id}` | Update profile / department / teams / designation |
| PATCH | `/users/{id}/role` | Change role assignment (Super Admin only) |
| PATCH | `/users/{id}/status` | Activate / deactivate / mark invited |
| GET | `/users/{id}/activities` | Activities assigned to this user (for My Work) |
| GET | `/users/{id}/workload` | Open tickets, tasks, activities counts (for reports) |
| GET | `/users/lookup?q=` | Lightweight name search for @mention and assignee pickers |

---

## 3. Roles & Permissions  *(v1.0, expanded in v2.0)*

| Method | Path | Purpose |
|---|---|---|
| GET | `/roles` | List roles (Employee, Team Member, Supervisor, Purchasing/Finance, Director, Admin, Super Admin) |
| GET | `/roles/{id}/permissions` | Permission set for a role |
| PATCH | `/roles/{id}/permissions` | Adjust permissions (Super Admin). Full matrix is "open for later" per brief §27 |
| GET | `/permissions` | Master list of permission keys the app checks |

---

## 4. Master Data  *(v1.0 — core to the whole system, brief §5.1)*

One generic pattern, repeated per master-data **type**. Super Admin adds values with **no code change**.

| Method | Path | Purpose |
|---|---|---|
| GET | `/master-data/types` | List all configurable types + counts |
| GET | `/master-data/{type}` | List values for a type (e.g. `/master-data/departments`) |
| POST | `/master-data/{type}` | Add a value (name, code, sort_order, parent_id, active, notes) |
| GET | `/master-data/{type}/{id}` | Value detail |
| PATCH | `/master-data/{type}/{id}` | Rename / reorder / activate / deactivate |
| DELETE | `/master-data/{type}/{id}` | Deactivate (only if unused; otherwise 409) |

**Types required (from §5.1):**

- **Organization:** `departments`, `teams`, `designations`, `branches`, `supervisors`, `directors`
- **Tickets:** `ticket-types`, `categories`, `subcategories`, `tags`, `priorities`, `ticket-statuses`
- **Projects:** `project-types`, `project-statuses`, `task-statuses`, `meeting-types`
- **Procurement:** `item-categories`, `service-categories`, `vendors`, `approval-types`
- **Training:** `training-categories`, `training-topics`, `trainers`, `training-statuses`

> `categories` → `subcategories` and `departments` → `teams` need a `parent_id`.
> Some types (departments, teams, users) also have their own richer endpoints above/below.

### 4a. Departments & Teams (richer than plain master data)

| Method | Path | Purpose |
|---|---|---|
| GET | `/departments` / `POST` / `GET /{id}` / `PATCH` | Org units |
| GET | `/teams` / `POST` / `GET /{id}` / `PATCH` | Working groups (drive shared visibility) |
| GET | `/teams/{id}/members` | Team roster |
| POST | `/teams/{id}/members` | Add member `{ user_id }` |
| DELETE | `/teams/{id}/members/{user_id}` | Remove member |

---

## 5. Shared sub-resources (reused by tickets, projects, meetings, training, procurement)

These are the "common concepts" from brief §2. Implement **once**, mount under each parent via a polymorphic `entity_type` + `entity_id`.

### 5.1 Comments / Chatter  *(v1.0, brief §9)*

| Method | Path | Purpose |
|---|---|---|
| GET | `/{entity_type}/{entity_id}/chatter` | Combined chronological stream: comments + system events (status change, assignment, upload, approval, close/reopen) |
| POST | `/{entity_type}/{entity_id}/comments` | Post comment `{ body, mentions: [user_id], attachments: [file_id] }` |
| PATCH | `/comments/{id}` | Edit own comment (kept in history) |
| DELETE | `/comments/{id}` | Remove own comment (soft) |

`entity_type` ∈ `tickets | projects | tasks | meetings | trainings | procurement-requests`

### 5.2 Followers & Mentions  *(v1.0, brief §8.3, §9)*

| Method | Path | Purpose |
|---|---|---|
| GET | `/{entity_type}/{entity_id}/followers` | List followers |
| POST | `/{entity_type}/{entity_id}/followers` | Add follower `{ user_id }` — a mentioned user can be granted access this way |
| DELETE | `/{entity_type}/{entity_id}/followers/{user_id}` | Remove follower |

> Posting a comment with `mentions[]` auto-creates follower + notification (where permitted).

### 5.3 Attachments / File Management  *(v1.0, brief §16)*

| Method | Path | Purpose |
|---|---|---|
| POST | `/attachments` | Upload (multipart). Records original filename, uploader, upload datetime, MIME type, size |
| GET | `/attachments/{id}` | Metadata |
| GET | `/attachments/{id}/download` | Signed download URL / stream |
| DELETE | `/attachments/{id}` | Soft delete |
| POST | `/{entity_type}/{entity_id}/attachments` | Link an uploaded file to a record |
| GET | `/{entity_type}/{entity_id}/attachments` | List a record's files |

Allowed types: images, PDF, Word, Excel, short video, other approved types.

### 5.4 Activities / Follow-ups  *(v1.1, brief §10 — separate from chatter)*

| Method | Path | Purpose |
|---|---|---|
| GET | `/activities` | List (filters: assignee, status, due_before, entity) |
| POST | `/activities` | Create `{ title, assigned_user_id, due_at, entity_type, entity_id }` |
| GET | `/activities/{id}` | Detail |
| PATCH | `/activities/{id}` | Reassign / reschedule / edit |
| POST | `/activities/{id}/complete` | Mark done → records completion date |
| GET | `/me/activities` | Current user's activities for My Work + reminders |

### 5.5 Audit Trail  *(v1.0, brief §17)*

| Method | Path | Purpose |
|---|---|---|
| GET | `/{entity_type}/{entity_id}/audit` | Read-only history for one record: created, status old→new, assignment change, due-date change, comment/mention, upload, approval/rejection, RSVP, training ack, close/reopen (+ mandatory reopen reason) |
| GET | `/audit` | Global audit log (Admin / Super Admin), filterable by user, entity, action, date |

*No write endpoints — audit entries are produced as a side effect of other calls and are never overwritten.*

---

## 6. Tickets & Requests  *(v1.0, brief §8)*

| Method | Path | Purpose |
|---|---|---|
| GET | `/tickets` | List with filters: `type`, `status`, `priority`, `assignee_id`, `requester_id`, `department_id`, `team_id`, `visibility`, `q`, date range. Views: all / mine / team / unassigned / waiting / closed |
| POST | `/tickets` | Create. Body varies by `type` (conditional form) — common: `title`, `type`, `visibility` (private/team), `team_id?`, `priority?`, `description`, `attachments[]`, plus type-specific `fields{}` |
| GET | `/tickets/{id}` | Full detail incl. type-specific fields, followers, assignee, SLA-ish timestamps |
| PATCH | `/tickets/{id}` | Edit fields (subject, priority, category, tags, team, visibility) |
| PATCH | `/tickets/{id}/status` | Change status: New → Assigned → In Progress → Waiting for User → Resolved → Closed (+ future: Waiting for Vendor, Escalated) |
| PATCH | `/tickets/{id}/assignee` | Assign / reassign `{ assignee_id }` |
| POST | `/tickets/{id}/close` | Close. Records `closed_by` + timestamp. Allowed for employee and admin/support |
| POST | `/tickets/{id}/reopen` | **Admin only.** `{ reason }` mandatory → written to audit |
| GET | `/tickets/{id}/related` | Linked activities, meetings, assets (future) |
| GET | `/me/tickets` | Tickets created by / assigned to / followed by current user (My Work) |
| GET | `/tickets/stats` | Counts by status/type/department for dashboard |

### 6a. Conditional form schemas  *(v1.0, brief §8.1–8.2)*

| Method | Path | Purpose |
|---|---|---|
| GET | `/ticket-forms` | List request types + their field schema |
| GET | `/ticket-forms/{type}` | Field definitions for one type (drives the dynamic form UI): ERP Issue, IT/Computer Issue, Training Request, Procurement Request, Access/Account Request, General/Other |

> Example ERP-issue fields: erp_module, what_trying_to_do, what_went_wrong, error_message, screenshot/video, optional priority, attachments.
> Field schemas themselves should be master-data-editable so new question sets don't need code changes.

---

## 7. Notifications  *(v1.0, brief §15 — in-app only in Phase 1)*

| Method | Path | Purpose |
|---|---|---|
| GET | `/notifications` | Current user's notifications (`?unread=true`) |
| GET | `/notifications/unread-count` | Badge count |
| POST | `/notifications/{id}/read` | Mark one read |
| POST | `/notifications/read-all` | Mark all read |
| GET | `/notifications/preferences` | Per-type toggles (structure ready for email/WhatsApp later) |
| PATCH | `/notifications/preferences` | Update toggles |

Trigger events: mentions, assignments, meeting invitations, meeting reminders, approval requests, training acknowledgement, activity due dates, important status changes.

> Real-time delivery: add `GET /notifications/stream` (SSE) or a WebSocket `/ws` later; polling `unread-count` is fine for v1.0.

---

## 8. Projects & Tasks  *(v1.1, brief §11)*

| Method | Path | Purpose |
|---|---|---|
| GET | `/projects` | List (filters: type, status, owner, team, delayed) |
| POST | `/projects` | Create `{ title, type, owner_id, team_members[], start_date, target_date, status }` |
| GET | `/projects/{id}` | Detail incl. progress %, tasks summary |
| PATCH | `/projects/{id}` | Edit |
| PATCH | `/projects/{id}/status` | Change project status |
| GET | `/projects/{id}/tasks` | Tasks in project |
| POST | `/projects/{id}/tasks` | Create task `{ title, assignee_id, priority, due_date, parent_task_id? }` |
| GET | `/tasks` | Cross-project task list (My Tasks, board columns by status) |
| GET | `/tasks/{id}` | Task detail |
| PATCH | `/tasks/{id}` | Edit / reassign / reschedule |
| PATCH | `/tasks/{id}/status` | Move across task statuses |
| GET | `/tasks/{id}/subtasks` / `POST` | Subtasks |
| GET | `/me/tasks` | Current user's tasks |
| GET | `/projects/stats` | Active / on-track / at-risk / delayed counts |

*(Chatter, activities, attachments, audit via §5 shared endpoints.)*

---

## 9. Meetings & Calendar  *(v1.2, brief §12)*

| Method | Path | Purpose |
|---|---|---|
| GET | `/meetings` | List (`?from=`, `?to=`, `?participant_id=`, `?project_id=`) |
| GET | `/calendar` | Calendar view feed for a date range |
| POST | `/meetings` | Create `{ title, date, start_time, end_time, organizer_id, participants[], location, online_link, agenda, project_id?, attachments[] }` |
| GET | `/meetings/{id}` | Detail incl. RSVP states |
| PATCH | `/meetings/{id}` | Edit |
| DELETE | `/meetings/{id}` | Cancel (notifies participants) |
| POST | `/meetings/{id}/rsvp` | Current user responds `{ response: accepted \| declined \| tentative }` → records who + when |
| GET | `/meetings/{id}/attendance` / `POST` | Record actual attendance |
| GET | `/meetings/{id}/minutes` / `PUT` | Minutes of meeting |
| POST | `/meetings/{id}/action-items` | Convert outcome into task/activity `{ title, owner_id, due_date }` |
| GET | `/me/meetings?date=today` | My Meetings Today (My Work) |

> Reminders: scheduled job emits in-app notifications before `start_time` (timing is "open for later", brief §27).

---

## 10. Training  *(v1.3, brief §13)*

| Method | Path | Purpose |
|---|---|---|
| GET | `/trainings` | List (filters: status, category, trainer, participant) |
| POST | `/trainings` | Create/request by employee or admin `{ topic, category, type: individual\|group, trainer_id, participants[], scheduled_at }` |
| GET | `/trainings/{id}` | Detail incl. checklist, materials, per-participant status |
| PATCH | `/trainings/{id}` | Edit |
| PATCH | `/trainings/{id}/status` | Requested → Scheduled → In Progress → Trainer Checklist → Waiting for Employee Acknowledgement → Completed |
| GET | `/trainings/{id}/checklist` | Checklist items |
| POST | `/trainings/{id}/checklist` | Add item |
| PATCH | `/trainings/{id}/checklist/{itemId}` | Trainer marks progress / complete |
| GET | `/trainings/{id}/materials` / `POST` | Videos, PDFs, manuals (uses attachments) |
| POST | `/trainings/{id}/participants` / `DELETE .../{userId}` | Manage participants |
| POST | `/trainings/{id}/acknowledge` | Employee: `{ result: completed \| need_follow_up, comment? }` → training only "fully completed" after successful ack; records date + user |
| GET | `/me/trainings` | My Training (My Work) |

---

## 11. Procurement  *(v1.4, brief §14)*

| Method | Path | Purpose |
|---|---|---|
| GET | `/procurement-requests` | List (filters: stage, type, requester, department, value range) |
| POST | `/procurement-requests` | Create `{ request_type: product\|service, description, business_reason, quantity?, department_id, attachments[] }` |
| GET | `/procurement-requests/{id}` | Detail incl. routing stage + approval history |
| PATCH | `/procurement-requests/{id}` | Edit while in draft/supervisor stage |
| POST | `/procurement-requests/{id}/submit` | Employee submits → Supervisor review |
| POST | `/procurement-requests/{id}/supervisor-decision` | `{ decision: approve_to_purchasing \| forward_to_director \| reject, comment }` |
| POST | `/procurement-requests/{id}/director-decision` | `{ decision: approve \| reject, comment }` |
| POST | `/procurement-requests/{id}/purchasing-update` | Purchasing/Finance updates purchase + delivery status |
| GET | `/procurement-requests/{id}/quotations` | Vendor quotations |
| POST | `/procurement-requests/{id}/quotations` | Add `{ vendor_id, amount, quotation_date, validity, payment_terms, delivery_time, comments, attachment_id }` |
| PATCH | `/quotations/{id}` | Edit |
| POST | `/quotations/{id}/select` | Mark selected (others become rejected) → recorded in approval history |
| GET | `/procurement-requests/stats` | Counts by stage / pending approval |

> Routing: Employee → Supervisor → (Director **or** Purchasing/Finance) → Purchasing/Finance.
> Exact workflow + Director thresholds are "open for later" (brief §27) — keep the decision endpoints generic and make routing rules master-data/config driven.

---

## 12. Reports & Dashboards  *(v1.5, brief §18)*

| Method | Path | Purpose |
|---|---|---|
| GET | `/reports/tickets/summary` | Total / open / in-progress / waiting / closed |
| GET | `/reports/tickets/by-dimension?group_by=department\|team\|type\|status` | Breakdowns |
| GET | `/reports/tickets/resolution-time` | Average resolution time (+ trend) |
| GET | `/reports/overdue` | Overdue tickets + activities |
| GET | `/reports/projects/status` | Project status + delayed projects/tasks |
| GET | `/reports/meetings/attendance` | Attendance + pending acknowledgements |
| GET | `/reports/training/completion` | Completed + follow-up-required |
| GET | `/reports/procurement/status` | Requests by status + pending approval |
| GET | `/reports/workload?user_id=` | Employee workload + assigned activities |
| GET | `/reports/export?report=...&format=csv\|xlsx` | Export (optional) |

---

## 13. Dashboard / Home aggregates  *(v1.0)*

| Method | Path | Purpose |
|---|---|---|
| GET | `/dashboard` | Company snapshot cards for Admin home |
| GET | `/me/work` | My Work bundle: my tickets, my tasks, meetings today, pending approvals, my training, my activities, overdue + upcoming due dates (one call, brief §7) |

---

## 14. Deferred / future modules (design so they can be added — do **not** build in Phase 1)

| Area | Roadmap | Likely endpoints |
|---|---|---|
| **Global Search** (§21) | progressive | `GET /search?q=&types=tickets,projects,meetings,procurement,training,attachments,kb` |
| **Knowledge Base** (§19) | future | `GET/POST /kb/articles`, `GET/PATCH/DELETE /kb/articles/{id}`, `GET /kb/articles/{id}/related`, `GET /kb/suggest?ticket_type=` (AI phase) |
| **Asset Management** (§20) | future | `GET/POST /assets`, `GET/PATCH /assets/{id}`, `POST /assets/{id}/assign`, `GET /assets/{id}/tickets`, link `asset_id` on tickets |
| **Email / WhatsApp notifications** (§15, §22) | v2.0 | notification-channel config + provider webhooks; no new client API, extends `/notifications/preferences` |
| **Configurable approval engine** (§14.1, §22) | v2.0 | `GET/POST /workflows`, `/workflows/{id}/steps`, `/workflows/{id}/simulate` |
| **AI assistance** (§22) | v2.0 | `POST /ai/ticket/categorize`, `POST /ai/ticket/summarize`, `POST /ai/ticket/suggest-solutions`, `POST /ai/meeting/minutes`, `POST /ai/quotations/compare` |
| **SLA escalation** (§22) | v2.0 | `GET/POST /sla-policies`; escalation runs server-side |
| **Native mobile** (§1, §22) | v2.0 | reuses this same API |

---

## 15. Cross-cutting background jobs (not REST, but needed)

- Activity + meeting **reminder** scheduler → emits in-app notifications
- Overdue detection for tickets / tasks / activities
- Notification fan-out on mention / assignment / status change / approval / RSVP / training ack
- (v2.0) external channel dispatch, SLA escalation timers

---

## 16. Build order (matches brief §23 roadmap)

1. **v1.0** — §1 Auth, §2 Users, §3 Roles, §4 Master Data, §4a Dept/Teams, §5 shared sub-resources (chatter, followers, attachments, audit), §6 Tickets + conditional forms, §7 Notifications, §13 dashboard/my-work.
2. **v1.1** — §8 Projects & Tasks, §5.4 Activities.
3. **v1.2** — §9 Meetings & Calendar.
4. **v1.3** — §10 Training.
5. **v1.4** — §11 Procurement & Quotations.
6. **v1.5** — §12 Reports.
7. **v2.0** — §14 deferred modules.

> Per brief §24: restate feature + users + permissions + success criteria before implementing each endpoint group; keep each version working before starting the next.
