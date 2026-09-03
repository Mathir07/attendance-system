require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

const schema = `
-- Users
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'employee' CHECK(role IN ('employee','hr','admin')),
  employee_id   TEXT    UNIQUE,
  department    TEXT,
  designation   TEXT,
  manager_id    INTEGER REFERENCES users(id),
  join_date     TEXT,
  phone         TEXT,
  status        TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  reset_token   TEXT,
  reset_expires INTEGER,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Leave types
CREATE TABLE IF NOT EXISTS leave_types (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL UNIQUE,
  max_per_year INTEGER NOT NULL DEFAULT 12,
  is_paid      INTEGER NOT NULL DEFAULT 1
);

-- Leave balances
CREATE TABLE IF NOT EXISTS leave_balances (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
  year          INTEGER NOT NULL,
  allocated     REAL    NOT NULL DEFAULT 0,
  used          REAL    NOT NULL DEFAULT 0,
  remaining     REAL    NOT NULL DEFAULT 0,
  UNIQUE(user_id, leave_type_id, year)
);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date                  TEXT    NOT NULL,
  check_in              TEXT,
  check_out             TEXT,
  first_check_in        TEXT,
  last_check_out        TEXT,
  total_working_minutes INTEGER NOT NULL DEFAULT 0,
  status                TEXT    DEFAULT 'absent' CHECK(status IN ('present','absent','half_day','late','on_leave','holiday','weekend')),
  remarks               TEXT,
  UNIQUE(user_id, date)
);

-- Leave requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
  start_date    TEXT    NOT NULL,
  end_date      TEXT    NOT NULL,
  days          REAL    NOT NULL DEFAULT 1,
  reason        TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  approved_by   INTEGER REFERENCES users(id),
  approved_at   TEXT,
  comment       TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Permission requests
CREATE TABLE IF NOT EXISTS permission_requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        TEXT    NOT NULL,
  from_time   TEXT    NOT NULL,
  to_time     TEXT    NOT NULL,
  hours       REAL    NOT NULL DEFAULT 1,
  reason      TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  approved_by INTEGER REFERENCES users(id),
  approved_at TEXT,
  comment     TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Salary structures
CREATE TABLE IF NOT EXISTS salary_structures (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  basic          REAL    NOT NULL DEFAULT 0,
  hra            REAL    NOT NULL DEFAULT 0,
  allowances     REAL    NOT NULL DEFAULT 0,
  deductions     REAL    NOT NULL DEFAULT 0,
  pf             REAL    NOT NULL DEFAULT 0,
  net_pay        REAL    NOT NULL DEFAULT 0,
  effective_from TEXT    NOT NULL DEFAULT (date('now')),
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Payslips
CREATE TABLE IF NOT EXISTS payslips (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month        INTEGER NOT NULL,
  year         INTEGER NOT NULL,
  file_path    TEXT    NOT NULL,
  net_pay      REAL,
  generated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  uploaded_by  INTEGER REFERENCES users(id),
  UNIQUE(user_id, month, year)
);

-- Holidays
CREATE TABLE IF NOT EXISTS holidays (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  is_optional INTEGER NOT NULL DEFAULT 0,
  type        TEXT    NOT NULL DEFAULT 'gazetted' CHECK(type IN ('national','gazetted','restricted')),
  category    TEXT    NOT NULL DEFAULT 'General'
);

-- Company settings (configurable thresholds)
CREATE TABLE IF NOT EXISTS company_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Attendance logs (multiple check-in/out per day)
CREATE TABLE IF NOT EXISTS attendance_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  attendance_id INTEGER NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  date          TEXT    NOT NULL,
  action        TEXT    NOT NULL CHECK(action IN ('check_in','check_out')),
  timestamp     TEXT    NOT NULL,
  source        TEXT    NOT NULL DEFAULT 'web',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_user_date ON attendance_logs(user_id, date);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id     INTEGER REFERENCES users(id),
  actor_name   TEXT,
  action       TEXT    NOT NULL,
  target_table TEXT,
  target_id    INTEGER,
  details      TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
`

db.exec(schema, (err) => {
  if (err) { console.error('Migration failed:', err.message); process.exit(1) }
  console.log('✓ All tables created successfully')
  process.exit(0)
})
