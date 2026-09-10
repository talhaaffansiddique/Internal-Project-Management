# OpsHub — Internal Company Operations & Project Management Platform

Internal web app for 50+ employees: ticketing, projects, meetings, training, procurement,
approvals, activities, chatter, notifications, reporting and master data.

Source of truth: `Internal_Company_Operations_Project_Brief_v1.docx`
API plan: `API_Specification_v0.1.md`
Historical dummy-data mockup (superseded by the live app): `mockup.html`

## Status — v1.0 "Core Platform" is complete ✅

| Area | Built |
|---|---|
| Auth | email + password, JWT cookie, `/auth/me`, change password |
| People & org | users (invite / roles / status), roles, departments, teams + membership, designations, branches |
| Master data | 17 configurable list types + designations/branches — add/edit/reorder/deactivate, Super-Admin only |
| Shared blocks | attachments, chatter (comments + audit stream), @mentions, followers, activities, append-only audit trail |
| Tickets | conditional forms per type, My/Team/Unassigned views, **visibility rules (§8.3)**, detail with discussion/activity/files/history |
| Ticket workflow | validated status flow, close (records who + when), reopen (Admin only, mandatory reason) — §8.4 |
| Notifications | in-app only: mentions, assignments, status changes, activity due-date reminders (hourly job); bell + click-through |
| Home | Dashboard KPIs + recent tickets, My Work (my tickets + activities) — visibility-scoped |

**Deferred to later versions** (per brief §22, §23): Projects & Tasks (v1.1), Meetings & Calendar (v1.2), Training (v1.3), Procurement + approvals (v1.4), management reporting (v1.5), email/WhatsApp + AI + native mobile (v2.0). File storage is local-disk in dev — swap `StorageService` for S3/Cloudflare R2 before go-live.

## Tech stack

| Layer | Choice |
|---|---|
| Backend API | NestJS (Node.js + TypeScript) — `apps/api` |
| Frontend | React + Vite (TypeScript) — `apps/web` |
| Database | PostgreSQL (Neon, free cloud tier for now) |
| ORM / migrations | Prisma |

## Project layout

```
apps/
  api/   NestJS API  (runs on http://localhost:4000, prefix /api/v1)
  web/   React app   (runs on http://localhost:5180, proxies /api → api)
```

## First-time setup

### 1. Install dependencies (from the project root)

```
npm install
```

### 2. Create a free database on Neon

1. Go to https://console.neon.tech and sign up (free).
2. Create a new project (any name, closest region).
3. Open **Connection Details** → copy the **connection string**
   (the pooled, Prisma-compatible one).

### 3. Add the connection string

```
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and paste your Neon string into `DATABASE_URL`.

### 4. Create the database tables

```
npm run prisma:migrate
```

Load starter data (roles, departments, master data, a Super Admin user):

```
npm run db:seed
```

Default login created by the seed: **talhaaffansiddique@gmail.com** / **ChangeMe!123**
(change it after first login; override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `apps/api/.env`).

Browse the database any time with:

```
npm run prisma:studio
```

### Demo data (optional, for manual testing)

```
npm run db:seed:demo
```

Resets tickets + demo users and loads 8 people, 3 teams and 14 sample tickets.
**All demo logins use the password `Demo!2345`:**

| Email | Role | Department |
|---|---|---|
| `admin@demo.opshub` | Admin | IT |
| `sara.k@demo.opshub` | Team Member | Finance |
| `omar.d@demo.opshub` | Supervisor | Warehouse |
| `nadia.f@demo.opshub` | Supervisor | HR |
| `lena.m@demo.opshub` | Employee | Sales |
| `yusuf.a@demo.opshub` | Director | Management |
| `priya.n@demo.opshub` | Purchasing / Finance | Purchase |
| `hassan.r@demo.opshub` | Employee | R&D |

Log in as `admin@demo.opshub` to see everything, or `lena.m@demo.opshub` to see
how ticket visibility limits a regular employee.

## Running the app (every day)

From the project root:

```
npm run dev
```

- API:  http://localhost:4000/api/v1/health
- App:  http://localhost:5180

**Step 1.0.1 is done when** the web page shows both *API status* and *Database* in green.

## Build phases

See `BUILD_TASKS.md` for the phase-by-phase plan. We build one step, test it, then continue.
