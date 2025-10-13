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

