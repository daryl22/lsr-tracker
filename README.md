LSR Tracker (Node + React SPA)

System tracker with user registration/login, daily km and hours input, and file upload. Backend is Express + SQLite. Frontend is a React SPA served via `public/index.html` with Tailwind.

Prerequisites
- Node.js 18+

Setup (Windows PowerShell)
```powershell
cd C:\lsr-tracker
npm install
Copy-Item .env.example .env -Force
npm run dev
```

The app starts at `http://localhost:3000`.

Environment
Create `.env` (or copy from `.env.example`):
```
PORT=3000
SESSION_SECRET=change_me
```

Features
- Register/login with sessions
- Add/update daily entry (date, km run, hours)
- Upload files (saved to `uploads/`)
- Mobile responsive UI (Tailwind)

API Endpoints
- POST `/api/register` { email, password }
- POST `/api/login` { email, password }
- POST `/api/logout`
- GET `/api/me`
- GET `/api/entries`
- POST `/api/entries` { date, km, hours }
- POST `/api/uploads` (form-data `file`)

Project Scripts
- `npm run dev` – start with nodemon
- `npm start` – start production server

Notes
- SQLite files stored in `data/`
- Session store uses `connect-sqlite3`

## Vercel Deployment Notes

- This project is not fully compatible with Vercel serverless due to its use of SQLite and local file uploads, which require persistent storage.
- On Vercel:
  - The database (`data/app.db`) and uploaded files (`uploads/`) will NOT persist between requests or deployments.
  - Use only for demo/testing, not production.
  - For production, migrate to a cloud database (e.g., PostgreSQL) and cloud storage (e.g., AWS S3).
- If you see 404 errors, ensure `public/index.html` is present and all routes are handled by your Express app.
- The catch-all route in `src/routes/index.js` is set up for Vercel compatibility.

