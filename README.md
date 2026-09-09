# OpsHub — Internal Company Operations & Project Management Platform

Internal web app for 50+ employees: ticketing, projects, meetings, training, procurement,
approvals, activities, chatter, notifications, reporting and master data.

Source of truth: `Internal_Company_Operations_Project_Brief_v1.docx`
API plan: `API_Specification_v0.1.md`
Clickable UI mockup (dummy data): `mockup.html`

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
  api/   NestJS API  (runs on http://localhost:3000, prefix /api/v1)
  web/   React app   (runs on http://localhost:5173, proxies /api → api)
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

## Running the app (every day)

From the project root:

```
npm run dev
```

- API:  http://localhost:3000/api/v1/health
- App:  http://localhost:5173

**Step 1.0.1 is done when** the web page shows both *API status* and *Database* in green.

## Build phases

See `BUILD_TASKS.md` for the phase-by-phase plan. We build one step, test it, then continue.
