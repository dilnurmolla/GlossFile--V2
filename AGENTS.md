# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains Electron UI pages and renderer scripts (`index.html`, `dashboard.html`, `admin.html`, `*.js`).
- Electron main-process code lives in `src/index.js` with additional main/preload helpers in `src/main.js` and `src/preload.js`.
- `server.js` runs the Express API and serves static assets from `src/`.
- Database helpers live in `db.js` (server-side) and `src/db.js` (Electron-side); schema snapshots are in `DB/` and `glossfile.sql`.
- `uploads/` holds runtime file storage; treat it as generated data, not source.

## Coding Style & Naming Conventions
- Indentation is 2 spaces; use semicolons as in existing files.
- Follow the module style of the file you touch (CommonJS `require` vs. ES `import`).
- Keep page assets paired in `src/` (e.g., `dashboard.html` + `dashboard.js`) and name files in lowercase.


## Configuration & Secrets
- The app expects a `.env` file for DB and SMTP settings. Common keys: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MFA_FROM`, `PORT`.
- Do not commit secrets; use local environment variables or a secrets manager.
