# MED Health Locker

MED Health Locker is a full-stack web application for uploading, organizing, searching and previewing medical reports. It uses React and TypeScript for the interface, Express for the API, and SQLite for account and report metadata.

## Features

- Upload PDF, JPEG and PNG reports up to 10 MB. Signed-in users can search, preview and delete their reports.
- Manage user profiles and sign in with email and password. Google sign-in and SMS delivery require service configuration.
- Browse the health library, track demo consultation requests and receive notifications.
- Use the Ask AI demo to view a sample conversation flow. The app returns a programmed response and performs no report analysis.
- Use the admin dashboard to review users, report records, consultation requests and audit events. The first account in a new database receives administrator access.

## Run the bundled website

From the repository root, run these commands with Node.js 20.19 or later and npm.

```sh
cd website
npm ci --omit=dev
cp .env.example .env
```

Set a unique, strong value for `JWT_SECRET` in `.env`, then run:

```sh
node --env-file=.env server/index.js
```

Open [the local website](http://localhost:3001). The Express service serves the bundled build from `dist/` and exposes its health check at `/api/health`. The server creates `server/medlocker.db` and `server/uploads/` on startup. Keep these paths together when backing up data.

For development, install the full dependencies with `npm ci`. Run the API and its bundled UI with the command above. To serve the source through Vite, configure its development server to proxy `/api` to `http://localhost:3001`. The package provides `npm test` for Vitest and `npm run build` for the TypeScript and Vite build. The deployment bundle includes prebuilt assets and omits the original TypeScript and Vite configuration files.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/` | React pages, UI components and API client |
| `server/index.js` | Express routes, SQLite schema and application logic |
| `public/` | Icons, media and web app manifest |
| `dist/` | Prebuilt frontend served by Express |
| `deploy/` | Oracle VM, systemd and Caddy setup |

Use HTTPS for a production deployment so browsers can send the Secure session cookie. See the [deployment guide](deploy/DEPLOY-ORACLE.md) and [HTTPS configuration](deploy/Caddyfile-HTTPS.md).

## Project report

The [Word project report](MED%20Health%20Locker%20Project%20Report.docx) covers requirements, architecture, database design, API workflows, deployment and local test results.

**Submitted by:** Yagyansh Singh Ahlawat, Roll No. 2501010120

**Project assistance:** Yuvraj Sehrawat, Roll No. 2501010xx

**Programme:** BTech CSE Core, Section B, K.R Mangalam University
