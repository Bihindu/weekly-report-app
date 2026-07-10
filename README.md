# Weekly Report Generator & Team Dashboard

A full-stack app where team members submit structured weekly reports and managers analyze them through a consolidated dashboard.

**Stack:** React (Vite) · Node.js / Express · PostgreSQL · Prisma · Recharts · JWT auth (httpOnly cookies)

## Features

- **Auth & roles** — register, login/logout, bcrypt-hashed passwords, JWT sessions in httpOnly cookies, `MEMBER` / `MANAGER` roles enforced by Express middleware on every protected endpoint.
- **Personal report page** — fixed, identical report structure for every user (week, project, tasks completed, tasks planned, blockers, optional hours and notes). Create drafts, edit, submit, and browse history by week. One report per person per week is enforced by a unique database constraint.
- **Team dashboard (manager only)** — all reports for a selected week, filters by member / project / date range, and submitted / pending / late status per member.
- **Projects** — managers add, edit, and delete projects; deletion is blocked while reports reference the project.
- **Visual insights** — summary metrics (reports submitted, compliance rate, open blockers) plus Recharts charts: task trend over time, submissions by member, workload by project, and a recent activity feed.
- **AI assistant (bonus)** — manager-only chat widget. The backend pulls recent reports from Postgres, sends them as context to the Claude API, and answers grounded questions ("What did the team work on last week?"). See `backend/src/routes/assistant.js` for the approach and data-privacy notes.

## Repository layout

```
backend/            Express API
  prisma/           schema.prisma + seed script
  src/
    middleware/     requireAuth, requireRole (RBAC)
    routes/         auth, reports, projects, dashboard, assistant
    utils/          prisma client, week helpers, async wrapper
frontend/           React app (Vite)
  src/
    api/            fetch client
    context/        AuthContext
    components/     Layout, StatusBadge, AssistantWidget
    pages/          Login, Register, MyReports, TeamDashboard, Projects
docs/
  er-diagram.dbml   ER diagram source — paste into https://dbdiagram.io
```

## Setup

### 0. Prerequisites

- Node.js 20+
- PostgreSQL 14+ (local install or Docker)

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Run the database

With Docker Desktop installed, from the project root:

```bash
docker compose up -d
```

That starts PostgreSQL with the right database name, user, and password already configured — the default `DATABASE_URL` in `.env.example` matches it exactly. Data persists between restarts; stop it anytime with `docker compose down`.

(Alternative without Docker: install PostgreSQL from postgresql.org and create a database named `weekly_reports`, then adjust `DATABASE_URL` in `.env` to your credentials.)

### 3. Configure and migrate the backend

```bash
cd backend
cp .env.example .env          # adjust DATABASE_URL and JWT_SECRET
npx prisma migrate dev --name init
npm run db:seed               # optional but recommended demo data
```

Seeded logins (all use password `password123`):

| Role    | Email             |
| ------- | ----------------- |
| Manager | manager@demo.com  |
| Member  | kasun@demo.com    |
| Member  | ishara@demo.com   |
| Member  | tharindu@demo.com |
| Member  | nadia@demo.com    |

### 4. Run the backend

```bash
cd backend
npm run dev        # http://localhost:4000
```

### 5. Run the frontend

```bash
cd frontend
npm run dev        # http://localhost:5173 (proxies /api to the backend)
```

### 6. AI assistant (optional)

Set `ANTHROPIC_API_KEY` in `backend/.env`. Without it, the endpoint returns a clear "not configured" message and everything else works normally.

## API overview

| Method | Endpoint                    | Access       | Purpose                            |
| ------ | --------------------------- | ------------ | ---------------------------------- |
| POST   | /api/auth/register          | Public       | Create account (role at signup)    |
| POST   | /api/auth/login             | Public       | Log in, sets httpOnly JWT cookie   |
| POST   | /api/auth/logout            | Auth         | Clear session                      |
| GET    | /api/auth/me                | Auth         | Current user                       |
| GET    | /api/reports                | Auth         | Own report history                 |
| POST   | /api/reports                | Auth         | Create draft report                |
| PATCH  | /api/reports/:id            | Owner        | Edit report                        |
| POST   | /api/reports/:id/submit     | Owner        | Submit report                      |
| DELETE | /api/reports/:id            | Owner        | Delete own draft                   |
| GET    | /api/reports/team           | Manager      | Team reports + filters             |
| GET    | /api/reports/team/status    | Manager      | Submitted / pending / late by user |
| GET    | /api/projects               | Auth         | List projects                      |
| POST/PATCH/DELETE | /api/projects…   | Manager      | Manage projects                    |
| GET    | /api/dashboard/summary      | Manager      | Headline metrics                   |
| GET    | /api/dashboard/trends       | Manager      | Chart data series                  |
| POST   | /api/assistant/chat         | Manager      | AI Q&A over recent reports         |

## Design decisions

- **Fixed report structure as real columns**, not JSON — the schema itself enforces identical fields for every user and keeps dashboard aggregation as plain SQL.
- **Role as an enum column** — with two static roles, a roles table would be over-engineering; the extension path (extract a `roles` table) is straightforward if roles become dynamic.
- **Derived submission status** — `status` + `submitted_at` + the week's deadline compute submitted/pending/late at query time; no denormalized flags to keep in sync.
- **Weeks snap to Monday** — any date input normalizes to that week's Monday, and a unique `(user_id, week_start)` index guarantees one report per person per week at the database level.
- **JWT in an httpOnly cookie** — the token is never readable by JavaScript, which removes the most common XSS token-theft vector; CORS is locked to the frontend origin with credentials.
