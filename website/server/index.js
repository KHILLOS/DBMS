/* MED – Health Locker · Backend API
   Express 5 + better-sqlite3, JWT auth in httpOnly cookies, secured defaults:
   helmet headers, rate limiting, CSRF header check, validated uploads stored outside the public dir.
   OPTIMIZED: prepared statement caching, FTS5 search, magic-byte validation, pagination, strict CSP. */
import express from 'express'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.join(__dirname, 'uploads')
fs.mkdirSync(UPLOADS_DIR, { recursive: true })

/* ---- Config & Secrets ---- */
const JWT_SECRET = process.env.JWT_SECRET || ''
if (process.env.NODE_ENV === 'production' && !JWT_SECRET) {
  console.error('[fatal] JWT_SECRET env var is required in production')
  process.exit(1)
}
const DEV_SECRET = JWT_SECRET || 'med-locker-dev-secret-change-me'
if (!JWT_SECRET) console.warn('[warn] JWT_SECRET not set — using built-in dev secret. Set JWT_SECRET before going live.')

const IS_PROD = process.env.NODE_ENV === 'production'
const PORT = process.env.PORT || 3001

/* ---- Database with optimized pragmas ---- */
const db = new Database(path.join(__dirname, 'medlocker.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('synchronous = NORMAL')
db.pragma('cache_size = -32768')        // 32MB page cache
db.pragma('temp_store = MEMORY')
db.pragma('mmap_size = 268435456')      // 256MB mmap
db.pragma('page_size = 4096')

/* ---- Schema + Indexes + FTS5 (idempotent) ---- */
db.exec(`
-- Core tables
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  age TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  report_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Uploaded',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS consult_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id TEXT NOT NULL,
  doctor_name TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT DEFAULT '',
  ip TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otp_codes (
  phone TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_consults_user ON consult_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_user ON ai_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone <> '';

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_reports_user_type ON reports(user_id, report_type);
CREATE INDEX IF NOT EXISTS idx_reports_user_created ON reports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_user_status ON reports(user_id, status);
CREATE INDEX IF NOT EXISTS idx_reports_created_desc ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC);

CREATE INDEX IF NOT EXISTS idx_consults_user_status ON consult_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_consults_user_date ON consult_requests(user_id, date);
CREATE INDEX IF NOT EXISTS idx_consults_doctor ON consult_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consults_status ON consult_requests(status);
CREATE INDEX IF NOT EXISTS idx_consults_date ON consult_requests(date);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_user_created ON ai_messages(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);

-- FTS5 Virtual Tables for Full-Text Search
CREATE VIRTUAL TABLE IF NOT EXISTS reports_fts USING fts5(
  file_name, report_type,
  content='reports',
  content_rowid='rowid',
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS reports_ai AFTER INSERT ON reports BEGIN
  INSERT INTO reports_fts(rowid, file_name, report_type) VALUES (new.rowid, new.file_name, new.report_type);
END;
CREATE TRIGGER IF NOT EXISTS reports_ad AFTER DELETE ON reports BEGIN
  INSERT INTO reports_fts(reports_fts, rowid, file_name, report_type) VALUES ('delete', old.rowid, old.file_name, old.report_type);
END;
CREATE TRIGGER IF NOT EXISTS reports_au AFTER UPDATE ON reports BEGIN
  INSERT INTO reports_fts(reports_fts, rowid, file_name, report_type) VALUES ('delete', old.rowid, old.file_name, old.report_type);
  INSERT INTO reports_fts(rowid, file_name, report_type) VALUES (new.rowid, new.file_name, new.report_type);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS consults_fts USING fts5(
  doctor_name, reason,
  content='consult_requests',
  content_rowid='id',
  tokenize='porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS consults_ai AFTER INSERT ON consult_requests BEGIN
  INSERT INTO consults_fts(rowid, doctor_name, reason) VALUES (new.id, new.doctor_name, new.reason);
END;
CREATE TRIGGER IF NOT EXISTS consults_ad AFTER DELETE ON consult_requests BEGIN
  INSERT INTO consults_fts(consults_fts, rowid, doctor_name, reason) VALUES ('delete', old.id, old.doctor_name, old.reason);
END;
CREATE TRIGGER IF NOT EXISTS consults_au AFTER UPDATE ON consult_requests BEGIN
  INSERT INTO consults_fts(consults_fts, rowid, doctor_name, reason) VALUES ('delete', old.id, old.doctor_name, old.reason);
  INSERT INTO consults_fts(rowid, doctor_name, reason) VALUES (new.id, new.doctor_name, new.reason);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS notifications_fts USING fts5(
  title, body,
  content='notifications',
  content_rowid='id',
  tokenize='porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS notif_ai AFTER INSERT ON notifications BEGIN
  INSERT INTO notifications_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;
CREATE TRIGGER IF NOT EXISTS notif_ad AFTER DELETE ON notifications BEGIN
  INSERT INTO notifications_fts(notifications_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
END;
CREATE TRIGGER IF NOT EXISTS notif_au AFTER UPDATE ON notifications BEGIN
  INSERT INTO notifications_fts(notifications_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
  INSERT INTO notifications_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;

-- Rebuild FTS for existing data (idempotent)
INSERT OR IGNORE INTO reports_fts(rowid, file_name, report_type) SELECT rowid, file_name, report_type FROM reports;
INSERT OR IGNORE INTO consults_fts(rowid, doctor_name, reason) SELECT id, doctor_name, reason FROM consult_requests;
INSERT OR IGNORE INTO notifications_fts(rowid, title, body) SELECT id, title, body FROM notifications;
`)

/* ---- Migration: token_version for session invalidation ----
   Bumping a user's token_version immediately invalidates every outstanding
   JWT for that account (password change, role demotion). */
{
  const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name)
  if (!cols.includes('token_version')) {
    db.exec('ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0')
    console.log('[db] migrated: users.token_version added')
  }
}

/* ---- Prepared Statements Cache (better-sqlite3 caches automatically) ---- */
const stmt = {
  // users
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  userByPhone: db.prepare('SELECT * FROM users WHERE phone = ?'),
  insertUser: db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?)'),
  updateUser: db.prepare('UPDATE users SET name = ?, phone = ?, age = ? WHERE id = ?'),
  updateUserPass: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
  updateLastLogin: db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?"),
  countUsers: db.prepare('SELECT COUNT(*) AS c FROM users'),
  countAdmins: db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'"),
  allUsersAdmin: db.prepare(`
    SELECT id, email, name, phone, age, role, created_at, last_login,
           (SELECT COUNT(*) FROM reports WHERE user_id = users.id) AS reports
    FROM users ORDER BY id ASC LIMIT ? OFFSET ?
  `),

  // reports
  reportsByUser: db.prepare('SELECT id, file_name, mime, size, report_type, status, created_at FROM reports WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'),
  insertReport: db.prepare('INSERT INTO reports (id, user_id, file_name, stored_name, mime, size, report_type, status) VALUES (?,?,?,?,?,?,?,?)'),
  reportById: db.prepare('SELECT * FROM reports WHERE id = ?'),
  deleteReport: db.prepare('DELETE FROM reports WHERE id = ?'),
  countUserReports: db.prepare('SELECT COUNT(*) AS c FROM reports WHERE user_id = ?'),
  adminReports: db.prepare(`
    SELECT r.id, r.file_name, r.mime, r.size, r.report_type, r.status, r.created_at, r.user_id, u.name AS user_name, u.email AS user_email
    FROM reports r JOIN users u ON u.id = r.user_id ORDER BY r.created_at DESC LIMIT ? OFFSET ?
  `),
  countAllReports: db.prepare('SELECT COUNT(*) AS c FROM reports'),
  totalStorage: db.prepare('SELECT COALESCE(SUM(size),0) AS c FROM reports'),

  // reports search (FTS5)
  searchReports: db.prepare(`
    SELECT r.id, r.file_name, r.mime, r.size, r.report_type, r.status, r.created_at
    FROM reports r JOIN reports_fts f ON f.rowid = r.rowid
    WHERE f.reports_fts MATCH ? AND r.user_id = ?
    ORDER BY rank LIMIT ? OFFSET ?
  `),
  searchReportsAdmin: db.prepare(`
    SELECT r.id, r.file_name, r.mime, r.size, r.report_type, r.status, r.created_at, u.name AS user_name, u.email AS user_email
    FROM reports r JOIN reports_fts f ON f.rowid = r.rowid JOIN users u ON u.id = r.user_id
    WHERE f.reports_fts MATCH ?
    ORDER BY rank LIMIT ? OFFSET ?
  `),

  // consults
  consultsByUser: db.prepare('SELECT * FROM consult_requests WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?'),
  insertConsult: db.prepare('INSERT INTO consult_requests (user_id, doctor_id, doctor_name, date, time, reason) VALUES (?,?,?,?,?,?)'),
  consultById: db.prepare('SELECT * FROM consult_requests WHERE id = ?'),
  updateConsultStatus: db.prepare('UPDATE consult_requests SET status = ? WHERE id = ?'),
  adminConsults: db.prepare(`
    SELECT c.*, u.name AS user_name, u.email AS user_email
    FROM consult_requests c JOIN users u ON u.id = c.user_id ORDER BY c.id DESC LIMIT ? OFFSET ?
  `),
  countUserConsults: db.prepare('SELECT COUNT(*) AS c FROM consult_requests WHERE user_id = ?'),
  countAllConsults: db.prepare('SELECT COUNT(*) AS c FROM consult_requests'),

  // consults search (FTS5)
  searchConsults: db.prepare(`
    SELECT c.* FROM consult_requests c JOIN consults_fts f ON f.rowid = c.id
    WHERE f.consults_fts MATCH ? AND c.user_id = ? ORDER BY rank LIMIT ? OFFSET ?
  `),

  // notifications
  notificationsByUser: db.prepare('SELECT id, title, body, read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?'),
  insertNotification: db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?,?,?)'),
  markAllRead: db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?'),
  countUnread: db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0'),
  countAllNotifications: db.prepare('SELECT COUNT(*) AS c FROM notifications'),

  // notifications search (FTS5)
  searchNotifications: db.prepare(`
    SELECT n.* FROM notifications n JOIN notifications_fts f ON f.rowid = n.id
    WHERE f.notifications_fts MATCH ? AND n.user_id = ? ORDER BY rank LIMIT ? OFFSET ?
  `),

  // ai messages
  aiHistory: db.prepare('SELECT role, text, created_at FROM ai_messages WHERE user_id = ? ORDER BY id ASC LIMIT 100'),
  insertAiMsg: db.prepare('INSERT INTO ai_messages (user_id, role, text) VALUES (?,?,?)'),
  countAiMessages: db.prepare('SELECT COUNT(*) AS c FROM ai_messages'),

  // otp
  otpByPhone: db.prepare('SELECT * FROM otp_codes WHERE phone = ?'),
  upsertOtp: db.prepare('INSERT INTO otp_codes (phone, code_hash, expires_at, attempts) VALUES (?,?,?,0) ON CONFLICT(phone) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at, attempts=0'),
  incrementOtpAttempts: db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ?'),
  deleteOtp: db.prepare('DELETE FROM otp_codes WHERE phone = ?'),
  cleanupExpiredOtp: db.prepare('DELETE FROM otp_codes WHERE expires_at < ?'),

  // audit
  insertAudit: db.prepare('INSERT INTO audit_log (user_id, action, detail, ip) VALUES (?,?,?,?)'),
  adminAudit: db.prepare('SELECT a.*, u.email AS user_email FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT ? OFFSET ?'),
  countAudit: db.prepare('SELECT COUNT(*) AS c FROM audit_log'),
}

/* ---- App Setup ---- */
const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)

/* ---- Helmet with strict CSP for production ---- */
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-origin' },
  contentSecurityPolicy: IS_PROD ? {
    useDefaults: false,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'img-src': ["'self'", 'data:', 'blob:'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'connect-src': ["'self'"],
      'media-src': ["'self'", 'blob:'],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'object-src': ["'none'"],
    },
  } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: IS_PROD ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  noSniff: true,
  xssFilter: true,
  frameguard: { action: 'deny' },
}))

app.use(express.json({ limit: '200kb' }))
app.use(express.urlencoded({ extended: false, limit: '200kb' }))
app.use(cookieParser())

/* ---- Rate Limits ---- */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 600,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
})
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many attempts — wait a few minutes and try again' },
})
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 60,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Upload limit reached — try again later' },
})
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30, // 30 searches/minute per IP
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Search rate limit exceeded' },
})

app.use('/api', apiLimiter)
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)
app.use('/api/auth/change-password', authLimiter)
app.use('/api/auth/phone/request', authLimiter)
app.use('/api/auth/phone/verify', authLimiter)
app.use('/api/reports', (req, res, next) => (req.method === 'POST' ? uploadLimiter(req, res, next) : next()))
app.use('/api/search', searchLimiter)

/* ---- CSRF-lite: SameSite=strict cookies + require custom header on mutations ---- */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
app.use('/api', (req, res, next) => {
  if (!SAFE_METHODS.has(req.method) && req.headers['x-requested-with'] !== 'XMLHttpRequest') {
    return res.status(403).json({ error: 'Missing request header' })
  }
  next()
})

/* ---- Helpers ---- */
const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim()) && s.length <= 254
const clean = (s, max = 200) => String(s ?? '').trim().slice(0, max)

/* ---- Timing-safe string compare ---- */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/* ---- Bot protection: honeypot + time-trap + self-hosted signed captcha ---- */
const CAPTCHA_TTL_MS = 2 * 60 * 1000
const hmac = (s) => crypto.createHmac('sha256', DEV_SECRET).update(s).digest('hex').slice(0, 32)

// Single-use captcha: a verified token can never be replayed (within its TTL)
const usedCaptchaTokens = new Map() // token -> expiry
function markCaptchaUsed(token, expiresAt) {
  usedCaptchaTokens.set(token, expiresAt)
  if (usedCaptchaTokens.size > 5000) {
    const now = Date.now()
    for (const [t, exp] of usedCaptchaTokens) if (exp < now) usedCaptchaTokens.delete(t)
  }
}
const isCaptchaUsed = (token) => usedCaptchaTokens.has(token)

function makeCaptcha() {
  const ops = [['+', (a, b) => a + b], ['−', (a, b) => a - b], ['×', (a, b) => a * b]]
  const [sym, fn] = ops[Math.floor(Math.random() * ops.length)]
  const a = 2 + Math.floor(Math.random() * 8)
  const b = 1 + Math.floor(Math.random() * 7)
  const exp = Date.now() + CAPTCHA_TTL_MS
  const payload = `${exp}.${a}.${b}.${sym}`
  const token = `${payload}.${hmac(payload)}`
  return { question: `${a} ${sym} ${b} = ?`, token, answer: String(fn(a, b)) }
}

function verifyCaptcha(token, answer) {
  if (typeof token !== 'string' || typeof answer !== 'string') return false
  if (isCaptchaUsed(token)) return false // replayed token — reject
  const parts = token.split('.')
  if (parts.length !== 5) return false
  const [exp, a, b, sym, sig] = parts
  if (Number(exp) < Date.now()) return false
  if (!timingSafeEqual(hmac(`${exp}.${a}.${b}.${sym}`), sig)) return false
  const na = Number(a), nb = Number(b)
  const expected = sym === '+' ? na + nb : sym === '−' ? na - nb : na * nb
  if (String(expected) !== answer.trim()) return false
  markCaptchaUsed(token, Number(exp))
  return true
}

/* ---- Login lockout: 5 failures per email+ip → 10 min cooldown ---- */
const loginAttempts = new Map()
function lockedUntil(key) { const v = loginAttempts.get(key); return v && v.until > Date.now() ? v.until : 0 }
function recordFail(key) {
  const v = loginAttempts.get(key) ?? { count: 0, until: 0 }
  v.count += 1
  if (v.count >= 5) { v.until = Date.now() + 10 * 60 * 1000; v.count = 0 }
  loginAttempts.set(key, v)
}
function clearFails(key) { loginAttempts.delete(key) }

/* ---- OTP: hash-only storage, 5-min expiry, 5 attempts ---- */
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')
function issueOtp(phone) {
  const code = String(Math.floor(100000 + Math.random() * 900000))
  stmt.upsertOtp.run(phone, sha256(code), Date.now() + 5 * 60 * 1000)
  return code
}
function verifyOtp(phone, code) {
  const row = stmt.otpByPhone.get(phone)
  if (!row) return { ok: false, error: 'Request a code first' }
  if (row.expires_at < Date.now()) return { ok: false, error: 'Code expired — request a new one' }
  if (row.attempts >= 5) return { ok: false, error: 'Too many attempts — request a new code' }
  stmt.incrementOtpAttempts.run(phone)
  if (!timingSafeEqual(sha256(clean(String(code), 8)), row.code_hash)) return { ok: false, error: 'Wrong code' }
  stmt.deleteOtp.run(phone)
  return { ok: true }
}

/* ---- Magic byte validation for uploads ---- */
const MAGIC_BYTES = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'image/jpeg': [0xFF, 0xD8, 0xFF],            // JPEG
  'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
}
function validateMagicBytes(buffer, mime) {
  const expected = MAGIC_BYTES[mime]
  if (!expected) return false
  if (buffer.length < expected.length) return false
  for (let i = 0; i < expected.length; i++) {
    if (buffer[i] !== expected[i]) return false
  }
  return true
}

/** Read only the first bytes of a file — never buffer a whole 10 MB upload. */
function readHead(filePath, n = 16) {
  const fd = fs.openSync(filePath, 'r')
  try {
    const buf = Buffer.alloc(n)
    const bytes = fs.readSync(fd, buf, 0, n, 0)
    return buf.subarray(0, bytes)
  } finally {
    fs.closeSync(fd)
  }
}

/* ---- Audit & Notify ---- */
function audit(userId, action, detail = '', ip = '') {
  stmt.insertAudit.run(userId ?? null, clean(action, 60), clean(detail, 300), clean(ip, 64))
}
function notify(userId, title, body) {
  stmt.insertNotification.run(userId, clean(title, 120), clean(body, 400))
}

/* ---- JWT ---- */
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, tv: user.token_version ?? 0 },
    DEV_SECRET,
    { expiresIn: '7d' },
  )
}
function setTokenCookie(res, token) {
  res.cookie('med_token', token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  })
}
function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, phone: u.phone ?? '', age: u.age ?? '', role: u.role, created_at: u.created_at, last_login: u.last_login }
}

/* ---- Auth Middleware ---- */
function authRequired(req, res, next) {
  const token = req.cookies?.med_token
  if (!token) return res.status(401).json({ error: 'Please sign in' })
  try {
    const payload = jwt.verify(token, DEV_SECRET)
    const user = stmt.userById.get(payload.id)
    if (!user) return res.status(401).json({ error: 'Account not found' })
    // Session invalidation: token must match the account's current token_version
    if ((payload.tv ?? 0) !== (user.token_version ?? 0)) {
      return res.status(401).json({ error: 'Session expired — sign in again' })
    }
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Session expired — sign in again' })
  }
}
function adminRequired(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  next()
}

/* ---- Upload config with magic-byte validation ---- */
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const EXT_BY_MIME = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' }

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (_req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}${EXT_BY_MIME[file.mimetype] || '.bin'}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) return cb(new Error('Only PDF, JPG or PNG files are allowed'))
    const ext = path.extname(file.originalname).toLowerCase()
    if (!['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) return cb(new Error('Bad file extension'))
    cb(null, true)
  },
})

/* ---- Routes ---- */

// Health check
app.get('/api/health', (_req, res) => res.json({
  ok: true,
  service: 'med-health-locker',
  version: '2.0.0',
  db: 'medlocker.db',
  uptime: process.uptime(),
  memory: process.memoryUsage(),
}))

/* ==================== AUTH ==================== */

// Captcha
app.get('/api/auth/captcha', (_req, res) => {
  const c = makeCaptcha()
  res.json({ question: c.question, token: c.token })
})

// Phone OTP
app.post('/api/auth/phone/request', (req, res) => {
  const phone = clean(req.body?.phone, 20).replace(/[^\d+]/g, '')
  if (!/^\+?\d{8,15}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid phone number with country code' })

  const code = issueOtp(phone)
  audit(null, 'otp_requested', phone, req.ip)

  const webhook = process.env.SMS_WEBHOOK_URL
  if (webhook) {
    fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code }) })
      .catch((e) => console.error('[sms webhook]', e?.message))
    return res.json({ sent: true, demo: false })
  }
  console.log(`[otp] demo code for ${phone}: ${code}`)
  res.json({ sent: true, demo: true, dev_code: code, note: 'SMS gateway not configured — showing code in dev mode' })
})

app.post('/api/auth/phone/verify', (req, res) => {
  const phone = clean(req.body?.phone, 20).replace(/[^\d+]/g, '')
  const code = clean(req.body?.code, 8)
  const v = verifyOtp(phone, code)
  if (!v.ok) { audit(null, 'otp_fail', phone, req.ip); return res.status(401).json({ error: v.error }) }

  let user = stmt.userByPhone.get(phone)
  if (!user) {
    const name = `User ${phone.slice(-4)}`
    const info = stmt.insertUser.run(`phone:${phone}@otp.local`, bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12), name,
      stmt.countUsers.get().c === 0 ? 'admin' : 'user')
    user = stmt.userById.get(info.lastInsertRowid)
    notify(user.id, 'Welcome to MED Health Locker', 'Signed up with phone OTP. Set a password anytime from your profile.')
    audit(user.id, 'register_phone', phone, req.ip)
  } else {
    audit(user.id, 'login_phone', phone, req.ip)
  }
  setTokenCookie(res, signToken(user))
  res.json({ user: publicUser(user) })
})

// Google OAuth
const GOOGLE_READY = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
const G_STATE_COOKIE = 'g_state'

app.get('/api/auth/google', (req, res) => {
  if (!GOOGLE_READY) {
    if (req.headers.accept?.includes('application/json')) return res.status(503).json({ error: 'Google sign-in not configured — ask your admin to set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET' })
    return res.status(503).json({ error: 'Google sign-in not configured yet' })
  }
  // CSRF: sign a random state and echo it in a path-scoped httpOnly cookie;
  // the callback must prove both halves match.
  const state = crypto.randomBytes(16).toString('hex')
  res.cookie(G_STATE_COOKIE, hmac(state), {
    httpOnly: true, secure: IS_PROD, sameSite: 'lax',
    maxAge: 10 * 60 * 1000, path: '/api/auth/google',
  })
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID)
  url.searchParams.set('redirect_uri', `${req.protocol}://${req.get('host')}/api/auth/google/callback`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', state)
  res.redirect(url.toString())
})

app.get('/api/auth/google/callback', async (req, res) => {
  if (!GOOGLE_READY) return res.status(503).json({ error: 'Google sign-in not configured' })
  // Verify the OAuth state against the signed cookie (CSRF protection)
  const expected = req.cookies?.[G_STATE_COOKIE]
  const got = String(req.query.state ?? '')
  if (!expected || !got || !timingSafeEqual(hmac(got), expected)) {
    return res.status(400).json({ error: 'Invalid OAuth state — please retry sign-in' })
  }
  res.clearCookie(G_STATE_COOKIE, { path: '/api/auth/google' })
  const code = String(req.query.code ?? '')
  if (!code) return res.status(400).json({ error: 'Missing code' })
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${req.protocol}://${req.get('host')}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    })
    const tokens = await tokenRes.json()
    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } })
    const g = await infoRes.json()
    const email = clean(g.email, 254).toLowerCase()
    const name = clean(g.name, 80) || email.split('@')[0]
    let user = stmt.userByEmail.get(email)
    if (!user) {
      const info = stmt.insertUser.run(email, bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12), name,
        stmt.countUsers.get().c === 0 ? 'admin' : 'user')
      user = stmt.userById.get(info.lastInsertRowid)
      notify(user.id, 'Welcome via Google', 'Your locker is ready. Upload your first report to get started.')
      audit(user.id, 'register_google', email, req.ip)
    } else {
      audit(user.id, 'login_google', email, req.ip)
    }
    setTokenCookie(res, signToken(user))
    res.redirect('/')
  } catch (e) {
    console.error('[google oauth]', e)
    res.status(500).json({ error: 'Google sign-in failed' })
  }
})

// Email/Password Register
app.post('/api/auth/register', (req, res) => {
  const email = clean(req.body?.email, 254).toLowerCase()
  const { password, captchaToken, captchaAnswer, website, formLoadedAt } = req.body ?? {}
  const name = clean(req.body?.name, 80)

  // Bot traps
  if (website) { audit(null, 'honeypot_hit', email, req.ip); return res.status(400).json({ error: 'Something went wrong' }) }
  if (typeof formLoadedAt === 'number' && Date.now() - formLoadedAt < 1500) {
    audit(null, 'too_fast_signup', email, req.ip)
    return res.status(400).json({ error: 'Please slow down' })
  }
  if (!verifyCaptcha(captchaToken, captchaAnswer)) {
    audit(null, 'captcha_fail', email, req.ip)
    return res.status(400).json({ error: 'Wrong captcha answer — try again' })
  }
  if (!isEmail(email)) return res.status(400).json({ error: 'Valid email required' })
  if (!name) return res.status(400).json({ error: 'Name required' })
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be 8–128 characters' })

  const first = stmt.countUsers.get().c === 0
  const role = first ? 'admin' : 'user'
  const hash = bcrypt.hashSync(password, 12)
  try {
    const info = stmt.insertUser.run(email, hash, name, role)
    const user = stmt.userById.get(info.lastInsertRowid)
    if (first) console.log(`[auth] first user ${email} granted admin`)
    notify(user.id, 'Welcome to MED Health Locker', 'Your health archive is ready. Upload your first report to get started.')
    audit(user.id, 'register', email, req.ip)
    setTokenCookie(res, signToken(user))
    return res.status(201).json({ user: publicUser(user) })
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(409).json({ error: 'Email already registered' })
    throw e
  }
})

// Email/Password Login
app.post('/api/auth/login', (req, res) => {
  const email = clean(req.body?.email, 254).toLowerCase()
  const { password, captchaToken, captchaAnswer, website, formLoadedAt } = req.body ?? {}
  if (!isEmail(email) || typeof password !== 'string') return res.status(400).json({ error: 'Email and password required' })

  const lockKey = `${email}|${req.ip}`
  const until = lockedUntil(lockKey)
  if (until) return res.status(429).json({ error: `Too many failed attempts — try again at ${new Date(until).toLocaleTimeString()}` })

  if (website) { audit(null, 'honeypot_hit', email, req.ip); return res.status(400).json({ error: 'Something went wrong' }) }
  if (typeof formLoadedAt === 'number' && Date.now() - formLoadedAt < 1500) {
    return res.status(400).json({ error: 'Please slow down' })
  }
  if (!verifyCaptcha(captchaToken, captchaAnswer)) {
    audit(null, 'captcha_fail', email, req.ip)
    return res.status(400).json({ error: 'Wrong captcha answer — try again' })
  }

  const user = stmt.userByEmail.get(email)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    recordFail(lockKey)
    audit(user?.id ?? null, 'login_failed', email, req.ip)
    return res.status(401).json({ error: 'Invalid email or password' })
  }
  clearFails(lockKey)
  stmt.updateLastLogin.run(user.id)
  audit(user.id, 'login', '', req.ip)
  setTokenCookie(res, signToken(user))
  res.json({ user: publicUser(stmt.userById.get(user.id)) })
})

// Logout
app.post('/api/auth/logout', (req, res) => {
  if (req.cookies?.med_token) audit(null, 'logout', '', req.ip)
  res.clearCookie('med_token', { path: '/' })
  res.json({ ok: true })
})

// Current user
app.get('/api/auth/me', authRequired, (req, res) => res.json({ user: publicUser(req.user) }))

// Update profile
app.put('/api/auth/me', authRequired, (req, res) => {
  const name = clean(req.body?.name, 80)
  const phone = clean(req.body?.phone, 24)
  const age = clean(req.body?.age, 8)
  if (!name) return res.status(400).json({ error: 'Name required' })
  stmt.updateUser.run(name, phone, age, req.user.id)
  res.json({ user: publicUser(stmt.userById.get(req.user.id)) })
})

// Change password
app.post('/api/auth/change-password', authRequired, (req, res) => {
  const { current, next } = req.body ?? {}
  if (typeof current !== 'string' || typeof next !== 'string' || next.length < 8 || next.length > 128) {
    return res.status(400).json({ error: 'New password must be 8–128 characters' })
  }
  if (!bcrypt.compareSync(current, req.user.password_hash)) {
    audit(req.user.id, 'password_change_failed', '', req.ip)
    return res.status(401).json({ error: 'Current password is wrong' })
  }
  // Bump token_version → every other session dies; issue a fresh token
  // for THIS session so the user stays signed in here.
  const newVersion = (req.user.token_version ?? 0) + 1
  stmt.updateUserPass.run(bcrypt.hashSync(next, 12), req.user.id)
  db.prepare('UPDATE users SET token_version = ? WHERE id = ?').run(newVersion, req.user.id)
  const fresh = stmt.userById.get(req.user.id)
  setTokenCookie(res, signToken(fresh))
  audit(req.user.id, 'password_changed', 'all sessions rotated', req.ip)
  res.json({ ok: true })
})

/* ==================== REPORTS ==================== */

// List with pagination
app.get('/api/reports', authRequired, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const offset = Number(req.query.offset) || 0
  const rows = stmt.reportsByUser.all(req.user.id, limit, offset)
  const total = stmt.countUserReports.get(req.user.id).c
  res.json({ data: rows, total, limit, offset })
})

// Upload with magic-byte validation
app.post('/api/reports', authRequired, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large — maximum 10 MB'
        : err.message || 'Upload failed'
      return res.status(400).json({ error: msg })
    }
    if (!req.file) return res.status(400).json({ error: 'No file received' })

    // Magic-byte check — reads only the first 16 bytes, not the whole file
    if (!validateMagicBytes(readHead(req.file.path), req.file.mimetype)) {
      fs.rmSync(req.file.path, { force: true })
      return res.status(400).json({ error: 'File content does not match declared type' })
    }

    const id = crypto.randomBytes(10).toString('hex')
    const name = clean(req.file.originalname, 180) || 'report'
    const type = guessReportType(name)
    stmt.insertReport.run(id, req.user.id, name, req.file.filename, req.file.mimetype, req.file.size, type, 'Uploaded')
    notify(req.user.id, 'Report uploaded', `${name} stored securely in your locker.`)
    audit(req.user.id, 'upload', name, req.ip)
    res.status(201).json({ id, file_name: name, mime: req.file.mimetype, size: req.file.size, report_type: type, status: 'Uploaded' })
  })
})

// Single report (internal storage filename is never exposed to clients)
app.get('/api/reports/:id', authRequired, (req, res) => {
  const row = stmt.reportById.get(req.params.id)
  if (!row || (row.user_id !== req.user.id && req.user.role !== 'admin')) return res.status(404).json({ error: 'Report not found' })
  const { stored_name, ...safe } = row
  res.json(safe)
})

// File download/stream
app.get('/api/reports/:id/file', authRequired, (req, res) => {
  const row = stmt.reportById.get(req.params.id)
  if (!row || (row.user_id !== req.user.id && req.user.role !== 'admin')) return res.status(404).json({ error: 'Report not found' })
  const filePath = path.join(UPLOADS_DIR, path.basename(row.stored_name))
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' })
  res.setHeader('Content-Type', row.mime)
  res.setHeader('Content-Disposition', `inline; filename="${row.file_name.replace(/["\\\r\n]/g, '_')}"`)
  res.setHeader('Cache-Control', 'no-store')
  audit(req.user.id, 'view_file', row.file_name, req.ip)
  fs.createReadStream(filePath).pipe(res)
})

// Delete report
app.delete('/api/reports/:id', authRequired, (req, res) => {
  const row = stmt.reportById.get(req.params.id)
  if (!row || (row.user_id !== req.user.id && req.user.role !== 'admin')) return res.status(404).json({ error: 'Report not found' })
  stmt.deleteReport.run(row.id)
  fs.rm(path.join(UPLOADS_DIR, path.basename(row.stored_name)), { force: true }, () => {})
  notify(req.user.id, 'Report deleted', `${row.file_name} was removed from your locker.`)
  audit(req.user.id, 'delete_report', row.file_name, req.ip)
  res.json({ ok: true })
})

// Search reports (FTS5)
app.get('/api/search/reports', authRequired, (req, res) => {
  const q = clean(req.query.q ?? '', 200)
  const limit = Math.min(Number(req.query.limit) || 20, 50)
  const offset = Number(req.query.offset) || 0
  if (!q) return res.json({ data: [], total: 0, limit, offset })

  // Escape FTS5 special characters
  const escaped = q.replace(/[^\w\s]/g, ' ').trim()
  if (!escaped) return res.json({ data: [], total: 0, limit, offset })

  const rows = req.user.role === 'admin'
    ? stmt.searchReportsAdmin.all(`${escaped}*`, limit, offset)
    : stmt.searchReports.all(`${escaped}*`, req.user.id, limit, offset)

  // For total count, run count query
  const countStmt = req.user.role === 'admin'
    ? db.prepare('SELECT COUNT(*) AS c FROM reports_fts WHERE reports_fts MATCH ?')
    : db.prepare('SELECT COUNT(*) AS c FROM reports r JOIN reports_fts f ON f.rowid = r.rowid WHERE f.reports_fts MATCH ? AND r.user_id = ?')
  const total = req.user.role === 'admin'
    ? countStmt.get(`${escaped}*`).c
    : countStmt.get(`${escaped}*`, req.user.id).c

  res.json({ data: rows, total, limit, offset })
})

function guessReportType(name) {
  const n = name.toLowerCase()
  if (/blood|cbc|hemoglobin/.test(n)) return 'Blood Test'
  if (/lipid|cholesterol/.test(n)) return 'Lipid Profile'
  if (/sugar|glucose|hba1c|diabet/.test(n)) return 'Sugar / HbA1c'
  if (/thyroid|tsh/.test(n)) return 'Thyroid'
  if (/vitamin|b12|d3/.test(n)) return 'Vitamin Panel'
  if (/x-?ray/.test(n)) return 'X-Ray'
  if (/mri|scan/.test(n)) return 'MRI / Scan'
  if (/prescription|rx/.test(n)) return 'Prescription'
  if (/report/.test(n)) return 'Medical Report'
  return 'General Document'
}

/* ==================== ASK AI ==================== */

app.get('/api/ai/history', authRequired, (req, res) => {
  res.json(stmt.aiHistory.all(req.user.id))
})

app.post('/api/ai/ask', authRequired, (req, res) => {
  const q = clean(req.body?.message, 1000)
  if (!q) return res.status(400).json({ error: 'Message required' })
  const reportCount = stmt.countUserReports.get(req.user.id).c
  const reply = `Demo mode — no AI service is connected yet, so I can't actually read or analyze your reports right now.\n\nYou have ${reportCount} report${reportCount === 1 ? '' : 's'} stored in your locker. Once the AI backend is wired in, I'll summarize findings from your files right here.\n\nMeanwhile, the Health Library has plain-language explanations of common lab terms (marked as demo content). For anything health-related, please confirm with your doctor.`
  stmt.insertAiMsg.run(req.user.id, 'user', q)
  stmt.insertAiMsg.run(req.user.id, 'assistant', reply)
  res.json({ reply, demo: true })
})

/* ==================== CONSULTS ==================== */

app.get('/api/consults', authRequired, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const offset = Number(req.query.offset) || 0
  const rows = stmt.consultsByUser.all(req.user.id, limit, offset)
  const total = stmt.countUserConsults.get(req.user.id).c
  res.json({ data: rows, total, limit, offset })
})

app.post('/api/consults', authRequired, (req, res) => {
  const doctorId = clean(req.body?.doctorId, 40)
  const doctorName = clean(req.body?.doctorName, 80)
  const date = clean(req.body?.date, 20)
  const time = clean(req.body?.time, 20)
  const reason = clean(req.body?.reason, 500)
  if (!doctorId || !doctorName || !date || !time || !reason) return res.status(400).json({ error: 'All fields are required' })
  const info = stmt.insertConsult.run(req.user.id, doctorId, doctorName, date, time, reason)
  notify(req.user.id, 'Consultation requested', `${doctorName} · ${date} at ${time} (demo request)`)
  audit(req.user.id, 'consult_request', doctorName, req.ip)
  res.status(201).json({ id: info.lastInsertRowid, status: 'pending' })
})

// Search consults (FTS5)
app.get('/api/search/consults', authRequired, (req, res) => {
  const q = clean(req.query.q ?? '', 200)
  const limit = Math.min(Number(req.query.limit) || 20, 50)
  const offset = Number(req.query.offset) || 0
  if (!q) return res.json({ data: [], total: 0, limit, offset })
  const escaped = q.replace(/[^\w\s]/g, ' ').trim()
  if (!escaped) return res.json({ data: [], total: 0, limit, offset })

  const rows = stmt.searchConsults.all(`${escaped}*`, req.user.id, limit, offset)
  const total = db.prepare('SELECT COUNT(*) AS c FROM consult_requests c JOIN consults_fts f ON f.rowid = c.id WHERE f.consults_fts MATCH ? AND c.user_id = ?')
    .get(`${escaped}*`, req.user.id).c

  res.json({ data: rows, total, limit, offset })
})

/* ==================== NOTIFICATIONS ==================== */

app.get('/api/notifications', authRequired, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const offset = Number(req.query.offset) || 0
  const rows = stmt.notificationsByUser.all(req.user.id, limit, offset)
  res.json(rows)
})

app.post('/api/notifications/read-all', authRequired, (req, res) => {
  stmt.markAllRead.run(req.user.id)
  res.json({ ok: true })
})

// Search notifications (FTS5)
app.get('/api/search/notifications', authRequired, (req, res) => {
  const q = clean(req.query.q ?? '', 200)
  const limit = Math.min(Number(req.query.limit) || 20, 50)
  const offset = Number(req.query.offset) || 0
  if (!q) return res.json({ data: [], total: 0, limit, offset })
  const escaped = q.replace(/[^\w\s]/g, ' ').trim()
  if (!escaped) return res.json({ data: [], total: 0, limit, offset })

  const rows = stmt.searchNotifications.all(`${escaped}*`, req.user.id, limit, offset)
  const total = db.prepare('SELECT COUNT(*) AS c FROM notifications n JOIN notifications_fts f ON f.rowid = n.id WHERE f.notifications_fts MATCH ? AND n.user_id = ?')
    .get(`${escaped}*`, req.user.id).c

  res.json({ data: rows, total, limit, offset })
})

/* ==================== ADMIN (with pagination) ==================== */

app.get('/api/admin/stats', authRequired, adminRequired, (_req, res) => {
  res.json({
    users: stmt.countUsers.get().c,
    admins: stmt.countAdmins.get().c,
    reports: stmt.countAllReports.get().c,
    storageBytes: stmt.totalStorage.get().c,
    consults: stmt.countAllConsults.get().c,
    notifications: stmt.countAllNotifications.get().c,
    aiMessages: stmt.countAiMessages.get().c,
  })
})

app.get('/api/admin/users', authRequired, adminRequired, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0
  const rows = stmt.allUsersAdmin.all(limit, offset)
  res.json(rows)
})

app.patch('/api/admin/users/:id/role', authRequired, adminRequired, (req, res) => {
  const id = Number(req.params.id)
  const role = req.body?.role
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Bad role' })
  if (id === req.user.id) return res.status(400).json({ error: "You can't change your own role" })
  const target = stmt.userById.get(id)
  if (!target) return res.status(404).json({ error: 'User not found' })
  if (target.role === 'admin' && role === 'user') {
    const admins = stmt.countAdmins.get().c
    if (admins <= 1) return res.status(400).json({ error: 'At least one admin must remain' })
  }
  db.prepare('UPDATE users SET role = ?, token_version = token_version + 1 WHERE id = ?').run(role, id)
  // Role demotion/promotion kills the target's existing sessions so the
  // new (or removed) admin powers apply immediately.
  notify(id, role === 'admin' ? 'You are now an admin' : 'Your admin access was removed',
    role === 'admin' ? 'Sign in again to open the Control Room.' : 'Sign in again to refresh your session.')
  audit(req.user.id, 'admin_role_change', `${target.email} → ${role}`, req.ip)
  res.json({ ok: true })
})

app.delete('/api/admin/users/:id', authRequired, adminRequired, (req, res) => {
  const id = Number(req.params.id)
  if (id === req.user.id) return res.status(400).json({ error: "You can't delete yourself" })
  const target = stmt.userById.get(id)
  if (!target) return res.status(404).json({ error: 'User not found' })
  if (target.role === 'admin') {
    const admins = stmt.countAdmins.get().c
    if (admins <= 1) return res.status(400).json({ error: 'At least one admin must remain' })
  }
  const files = db.prepare('SELECT stored_name FROM reports WHERE user_id = ?').all(id)
  for (const f of files) fs.rm(path.join(UPLOADS_DIR, path.basename(f.stored_name)), { force: true }, () => {})
  db.prepare('DELETE FROM users WHERE id = ?').run(id)
  audit(req.user.id, 'admin_delete_user', target.email, req.ip)
  res.json({ ok: true })
})

app.get('/api/admin/reports', authRequired, adminRequired, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0
  const rows = stmt.adminReports.all(limit, offset)
  res.json(rows)
})

app.get('/api/admin/consults', authRequired, adminRequired, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0
  const rows = stmt.adminConsults.all(limit, offset)
  res.json(rows)
})

app.patch('/api/admin/consults/:id/status', authRequired, adminRequired, (req, res) => {
  const id = Number(req.params.id)
  const status = req.body?.status
  if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Bad status' })
  const c = stmt.consultById.get(id)
  if (!c) return res.status(404).json({ error: 'Request not found' })
  stmt.updateConsultStatus.run(status, id)
  notify(c.user_id, `Consultation ${status}`, `${c.doctor_name} · ${c.date} at ${c.time}`)
  audit(req.user.id, 'admin_consult_status', `#${id} → ${status}`, req.ip)
  res.json({ ok: true })
})

app.get('/api/admin/audit', authRequired, adminRequired, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500)
  const offset = Number(req.query.offset) || 0
  const rows = stmt.adminAudit.all(limit, offset)
  res.json(rows)
})

/* ---- Catch-all for unknown API routes ---- */
app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown endpoint' }))

/* ---- Production: serve the built frontend (dist/) + SPA fallback ----
   Registered after the API catch-all so /api/* always returns JSON. */
const DIST_DIR = path.join(__dirname, '..', 'dist')
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { index: false, maxAge: '1h', setHeaders: (res, p) => {
    if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache')
  } }))
  app.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) || req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })
  console.log('[api] serving built frontend from dist/')
}

/* ---- Central error handler ---- */
app.use((err, _req, res, _next) => {
  console.error('[api error]', err)
  res.status(500).json({ error: 'Something went wrong' })
})

/* ---- Start ---- */
app.listen(PORT, () => console.log(`[api] MED Health Locker ready → http://localhost:${PORT} (db: server/medlocker.db)`))