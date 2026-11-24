# MED – Health Locker

Premium healthcare frontend demo — React 19 + TypeScript + Vite + Tailwind v4 + Framer Motion + react-three-fiber.

## Commands
- `npm run dev:all` — **recommended**: Vite frontend (5173) + Express API (3001) together
- `npm run dev` / `npm run server` — each individually
- `npm run build` — typecheck + production build
- `npm test` — vitest suite (theme, app render, page render, API-envelope shapes)
- `node scripts/smoke-test.mjs` — 40-test backend+security suite (needs dev:all running). **Don't run twice within 15 min** — the auth rate limit counts failed auth calls.
- `scripts/visual-qa/` — Playwright visual/interaction/perf harness (see its README)

## Backend (server/index.js)
Express 5 + better-sqlite3 (server/medlocker.db, WAL + tuned pragmas + 30+ indexes). JWT auth in **httpOnly + SameSite=strict cookies** with **token_version invalidation** (password change / role change kills outstanding sessions; the changing session gets a fresh token). bcrypt(12) passwords, helmet headers (CSP in prod, HSTS, frameguard DENY), rate limits (600/15min API, 30 auth, 60 uploads/hr, 30 searches/min — all counting *failed* auth calls), CSRF header check (X-Requested-With) on mutations, multer uploads validated by MIME + extension + **magic bytes** (16-byte stream read) into `server/uploads/` (never statically served). FTS5 full-text search on reports/consults/notifications (porter tokenizer, prefix queries, per-user + admin scopes) at `/api/search/*`. Google OAuth with **signed state cookie** (HMAC + timing-safe compare). Pagination: list endpoints may return `{ data, total, limit, offset }` envelopes (frontend `asList()` normalizes both shapes). Ownership checks on every file/report route. Audit log + per-user notifications. First registered user = admin; can't demote/delete last admin.
Routes: /api/auth/*, /api/reports/* (CRUD + stream), /api/search/* (FTS5), /api/ai/* (honest demo), /api/consults, /api/notifications, /api/admin/* (stats, users role/delete, reports + delete, consults status, audit).

### Auth methods
- **Email + password** — self-signed math captcha (HMAC, fresh per attempt), honeypot field, 1.5s speed trap, 5-fail → 10-min lockout per email+IP.
- **Phone OTP** — 6-digit code, hashed in DB, 5-min expiry, 5 attempts, single-use. Demo mode shows `dev_code` + console via `SMS_WEBHOOK_URL` when set.
- **Google OAuth** — full code flow at `/api/auth/google/{,callback}`; returns honest 503 until `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set. State is signed + verified (CSRF-safe).

### Bot protection (frontend)
- `src/components/Captcha.tsx` — question + refresh, no external dependency.
- `AuthPage` sends `formLoadedAt` (speed trap) + hidden honeypot + captcha on register/login.

### Cursor & motion (frontend)
- Motion utilities: `staggerInView`, `riseItem`, `scalePop`, `listRow`, `CountUp`, `Magnetic`, `AnimatedCheck`, `TypingDots`, `useTilt` (3D tilt + mouse spotlight; no re-renders, reduced-motion aware).
- `AppShell` mounts scroll progress bar; page transitions via AnimatePresence.

## Dual-theme system (frontend)
- `src/lib/theme.tsx` — `ThemeProvider` + `useTheme()` → `{ theme, resolvedTheme, setTheme }`. Modes: `system` (default, follows `prefers-color-scheme`) / `light` / `dark`, persisted to `localStorage['med-theme']`, applied as `data-theme` on `<html>` + live `<meta theme-color>`. Provider lives inside `App` (self-contained, testable).
- `index.html` seeds `data-theme` before first paint (no flash of wrong theme).
- `src/components/layout/ThemeToggle.tsx` — segmented system/light/dark control in the TopBar (sliding pill).
- `src/components/layout/AmbientBackground.tsx` — themed ambient video background (`public/product_light.mp4` / `product_dark.mp4`). Only the active theme's video is fetched; 0.55s opacity crossfade; layered scroll parallax (video 9%, orbs 5% — GPU transforms); depth orbs (pre-softened radial gradients, zero filter cost); pauses when the tab is hidden; reduced-motion/Save-Data freeze the frame; static `.video-scrim` keeps text readable.
- Typography: Sora (display) + Inter (body) via `--font-display`; `.overline` eyebrows per page; `usePageTitle()` syncs the browser tab per route.
- Accessibility: every infinite framer loop is `useReducedMotion`-gated; CSS animations die under `@media (prefers-reduced-motion: reduce)`; `prefers-contrast: more` boosts borders/solid cards; `@media print` strips chrome; skip-to-content link; modal focus traps.

## Structure
- `src/components/layout/` — AppShell (ambient bg + footer + transitions), TopBar (bell dropdown + avatar + theme toggle), Sidebar (desktop rail; icon-only at md), BottomNav (mobile, animated pill + dot), AmbientBackground, ThemeToggle, BackToTop
- `src/components/ui.tsx` — Modal (glass, focus trap, optional reading-progress bar), EmptyState (orbit ring), Skeleton, StatusChip, AnimatedCheck, TypingDots, CountUp, Magnetic, PageSkeleton, useTilt
- `src/components/UploadCard.tsx` — drag-and-drop uploader (PDF/JPG/PNG ≤10MB), progress, success celebration burst, error states
- `src/lib/store.ts` — localStorage layer (reports, notifications, profile, consult requests)
- `src/lib/fileStore.ts` — IndexedDB blob storage for uploaded files (preview via object URLs)
- `src/lib/demo.ts` — clearly labelled demo content (articles, doctors, insights)
- `src/lib/motion.ts` — shared Framer Motion variants/springs
- `src/lib/usePageTitle.ts` — per-route browser tab titles
- `src/pages/` — Home, Reports, AskAI, Consult, Learn, Profile (all lazy-loaded; Login/Register share AuthPage; Admin)

## Design tokens (src/index.css)
- Dual-theme: every token redefined under `:root[data-theme="dark"]`. Core set: `--page`, `--page-elevated`, `--ink`, `--muted`, `--line`, `--green` (bright accent in dark), `--mint`, `--glass-bg`, `--glass-border`, `--card-bg`, `--panel-bg`, `--btn-grad`, `--shadow-*`, `--hero-*` (SVG art), `--grad-a/b/c`, `--spotlight`, `--orb-*`, fonts (`--font-display/body`).
- Utility classes: `.card` (translucent, no blur), `.glass` / `.modal-panel` (true glass — **only** for shell/chrome), `.card-glow` (+`.card-glow-slow` always-on), `.neu-card`, `.neu-inset`, `.btn-primary` (gradient-slide hover + sheen), `.btn-soft`, `.btn-ghost`, `.btn-danger`, `.glass-btn`, `.chip-*` (green/gray/amber/error/blue/violet/rose), `.icon-bubble(.blue/.amber/.violet/.rose)`, `.grad-text` (+`.grad-text-animated`), `.overline`, `.font-display`, `.report-row`, `.progress-shine`, `.ripple-ring`, `.pulse-dot`, `.greeting-mesh`, `.zoom-frame`, `.upload-zone`, `.card-danger`, `.table-card` (internal scroll + sticky glass header), `.admin-tabs` (sticky), `.spotlight`, `.theme-toggle*`, `.toast-glass`, `.video-scrim`, `.orb-*`, `.article-cover` (+`.cover-0..5`), `.avatar-ring`, `.msg-glow`, `.btn-spinner(-soft)`, `.page-spinner`, `.back-to-top`, `.skip-link`, `.site-footer`, `.hero-orbit`, `.empty-orbit`, `.search-clear`, `.link-underline`, `.nudge`, `.theme-flash`
- Perf rules: backdrop-filter only on shell elements; animations transform/opacity only; blur-free orbs; `@media (prefers-reduced-motion: reduce)` kills all CSS motion.

## Rules
- Demo content must stay labelled ("Demo" chips). Never invent medical findings. AI page returns honest demo-state text until the AI backend is connected.
- Medical files stay local (IndexedDB/localStorage). Nothing uploaded externally.
- Keep animations transform/opacity-based (no layout thrash). No new 3D/canvas layers — the ambient video background is the single ambient layer.
- Theme-awareness: use design tokens/classes, never hardcoded light colors, so both themes stay correct.
- Mobile: bottom nav must never cover content (`padding-bottom` + safe-area).

## SEO (public/)
- `robots.txt` (allows crawling, blocks `/api/`), `sitemap.xml` (SPA routes)
- `index.html`: description, keywords, robots, OG + twitter cards, JSON-LD `WebApplication` structured data
- Per-route document titles via `src/lib/usePageTitle.ts`

## Backups (while agents work concurrently)
- `~/website-backup/` — rsync mirror (auto-pruned; do NOT store extra files there)
- `~/website-archive/` — append-only tarballs + QA screenshots

## Dependency policy (2026-10-04)
- Everything is on latest majors: framer-motion 14, TypeScript 7 (Go engine — typecheck ~0.3s), vite 8.3.2, lucide-react 1.51, react 19.3, better-sqlite3 13, express 5, helmet 8, tailwind 4
- eslint/typescript-eslint stack removed: no config existed and its peer ranges don't accept TS 7 yet — `npm ci` was unresolvable. Re-add with `npm i -D typescript-eslint` etc. once it supports TS 7.

## Mobile performance (lite mode)
- `src/lib/perf.ts` — `useLiteMode()` true on ≤820px / coarse pointer / ≤4 cores.
  Every infinite JS animation is gated behind it (reduce-motion OR lite = still).
- CSS lite block in `index.css`: backdrop-filter removed from shells (blur over
  video = #1 mobile GPU cost), always-on conic spins / orb drift / gradient pan
  disabled, softer shadows, static rings.
- Background video: lite devices load `*/_mobile.mp4` — 960×540 ALL-KEYFRAME
  encodes (~2 MB) where every frame is instantly seekable; desktop keeps 1080p.
  Seek engine: `fastSeek()` + one-seek-in-flight queue + coarse quantization.
  Measured: 220 ms → 4 ms seek @ 4× CPU throttle; 60 fps scroll.
- `content-visibility: auto` (.cv-auto) on below-fold Home sections.
- Non-blocking Google Fonts via `public/boot.js` (CSP blocks inline onload).

## PWA
- `public/manifest.webmanifest` + `icon-192/512.png` + `apple-touch-icon.png` —
  "Add to Home Screen" gives an app-like standalone window.
- Social preview: `public/og-image.png` (1200×630) wired into OG/Twitter tags.

## Pistachio grass theme (2026-10-05)
- Full palette rewrite: "day meadow" light (#F7FAF0 page, #4A7A28 grass, #7CB342 pistachio) and "night meadow" dark (#0B120A page, #A8D97E accent). All legacy teal-greens swept.
- Background videos hue-graded to match: light 82° pistachio, dark 120° grass; mobile all-keyframe encodes regenerated from the graded masters; pistachio scrim tint.
- `src/components/GrassStrip.tsx` — realistic wind-swayed grass (tapered gradient blades, sun-kissed + back depth layers, deterministic per-blade sway durations, wind-gust light sweep). Blades animate ONLY while on screen (IntersectionObserver toggles animation-play-state) + `contain: layout paint style`.
- Grass placed: footer meadow, hero card bottom edge, signed-out CTA card, grass fringe along `.btn-primary` bottom edge.
- Grass tokens: `--grass-root/mid/tip/sun` + `--grass-back-*` per theme. Lite devices: static + fewer blades.
- Favicon / PWA icons / OG image regenerated in pistachio; social preview card in night-meadow colors.
