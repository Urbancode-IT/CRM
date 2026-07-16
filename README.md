# Tuition CRM

A CRM for a tuition tutor/manager to track students, payments, attendance, and
tasks, with automated email notifications, automated daily attendance/task
handling, and AI-based student progress analysis.

## Stack

- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT auth, Nodemailer (SMTP), node-cron
- **Frontend:** React (Vite), React Router, Tailwind CSS, Axios
- **AI analysis:** Google Gemini free-tier API (swappable — see `backend/src/config/ai.js`)

## Folder structure

```
tuition/
  backend/
    src/
      config/       # db, mailer (SMTP), ai (Gemini) connections
      models/        # User, Student, Payment, Attendance, Task (Mongoose schemas)
      controllers/    # request handlers per resource
      routes/         # Express routers per resource
      middleware/     # JWT auth guard, error handler
      services/       # emailService, aiService, dashboardService (business logic)
      jobs/           # cron-driven automation: reminders, attendance, tasks
      templates/      # email HTML templates
      utils/          # asyncHandler, generateToken
      app.js          # Express app + route wiring
      server.js       # entrypoint: connect DB, start cron scheduler, listen
      seed.js         # creates the initial tutor/admin login
  frontend/
    src/
      components/     # Layout, ProtectedRoute, StatCard
      context/        # AuthContext (JWT session)
      pages/          # Login, Dashboard, Students, StudentDetail, Attendance, Payments, Tasks
      services/       # axios API client
      App.jsx, main.jsx
```

## Features

- **Student records** — contact info, parent contact, subjects, grade, monthly fee, status, notes.
- **Payment history** — per-month payment records, manual entry or auto-generated monthly.
- **Automatic email notifications** — a receipt email fires the moment a payment is marked paid.
- **Overdue reminders** — a daily cron job flags payments past their due date as overdue and
  emails a reminder (with a cooldown so the same student isn't emailed every day).
- **Automated attendance tracking** — mark attendance day-by-day in the UI; any student left
  unmarked by end of day is auto-marked absent by a daily job, so nothing falls through the cracks.
- **Custom + recurring tasks** — one-off tasks, or a "recurring template" (daily/weekly/monthly)
  that a daily job uses to auto-spawn fresh task instances (e.g. "Send progress note").
- **Dashboard** — active student count, this month's fee collected vs. pending, today's
  attendance rate, overdue payments list, upcoming tasks.
- **AI progress analysis** — per-student attendance rate, payment reliability, and task
  completion are fed to Gemini, which returns a progress summary, strengths, areas to
  improve, and suggested actions for the tutor.

## Setup

### 1. Prerequisites

- Node.js 18+ (uses native `fetch`)
- A MongoDB instance — local (`mongod`) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### 2. Backend

```bash
cd backend
cp .env.example .env
# edit .env: set MONGO_URI, JWT_SECRET, ADMIN_EMAIL/ADMIN_PASSWORD
npm install
npm run seed     # creates the first tutor/admin login from .env
npm run dev       # starts on http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_URL defaults to http://localhost:5000/api
npm install
npm run dev             # starts on http://localhost:5173
```

Log in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in `backend/.env`.

## Turning on automation (optional but recommended)

These are off by default so the app runs immediately with zero external accounts.

### Email (payment receipts + overdue reminders)

In `backend/.env`:

```
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_char_app_password   # Gmail: Google Account > Security > App passwords
```

With `EMAIL_ENABLED=false` (default), emails are logged to the backend console instead of sent —
useful for development.

### AI progress analysis (free Gemini API)

1. Get a free key at https://aistudio.google.com/apikey
2. In `backend/.env`:
   ```
   AI_ENABLED=true
   GEMINI_API_KEY=your_key_here
   ```

With `AI_ENABLED=false` (default), the "Run analysis" button on a student's page still returns
their computed stats (attendance rate, payment reliability, task completion) with a message
explaining how to turn AI analysis on.

### Cron automation schedule

Also in `backend/.env` (standard cron syntax, defaults shown):

```
PAYMENT_REMINDER_CRON=0 8 * * *      # 8am daily: generate month's fees, flag+email overdue
ATTENDANCE_AUTOMARK_CRON=0 20 * * *  # 8pm daily: auto-mark unmarked students absent
TASK_AUTOMATION_CRON=0 6 * * *       # 6am daily: spawn due recurring task instances
```

## Deploy on Vercel (full stack)

You need **two Vercel projects** (same GitHub repo) plus a free **MongoDB Atlas** cluster.

### 1. MongoDB Atlas

1. Create a free cluster at https://www.mongodb.com/atlas
2. Create a DB user and allow network access `0.0.0.0/0`
3. Copy the connection string → use as `MONGO_URI`

### 2. Backend project

1. Vercel → **Add New Project** → import the repo
2. Settings:
   - **Root Directory:** `backend`
   - **Framework Preset:** Other
3. Environment variables:

```
NODE_ENV=production
MONGO_URI=mongodb+srv://...
JWT_SECRET=long_random_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=https://your-frontend.vercel.app
CRON_SECRET=long_random_cron_secret
ADMIN_NAME=Tutor Manager
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your_secure_password
EMAIL_ENABLED=false
AI_ENABLED=false
```

4. Deploy. API health check: `https://your-backend.vercel.app/api/health`
5. Seed the admin user once (from your machine, pointing at Atlas):

```bash
cd backend
# set MONGO_URI + ADMIN_* in .env to the same production values
npm run seed
```

Cron jobs (payments / attendance / tasks) are defined in `backend/vercel.json` and call `/api/cron/*` with `CRON_SECRET`. Schedules are UTC (IST ≈ UTC+5:30).

### 3. Frontend project

1. Vercel → **Add New Project** → same repo again
2. Settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
3. Environment variable:

```
VITE_API_URL=https://your-backend.vercel.app/api
```

4. Deploy, then set backend `CLIENT_URL` to the frontend URL and redeploy backend if needed.

### Local vs Vercel

- Local: `npm run dev` still uses `node-cron` via `server.js`
- Vercel: serverless Express (`api/index.js`) + Vercel Cron (no `app.listen`, no `node-cron`)

## Notes

- Payment and attendance records are unique per student per billing period / per day
  (enforced at the database level), so automation jobs are safe to run repeatedly.
- The AI and email providers are each isolated behind a single module
  (`config/ai.js`, `config/mailer.js` + `services/emailService.js`) so they can be swapped
  for a different provider without touching business logic.
