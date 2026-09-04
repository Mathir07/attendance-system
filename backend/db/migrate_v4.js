/**
 * migrate_v4.js
 * Run once: node db/migrate_v4.js
 *
 * What this does:
 *  1. Adds new columns to users table (address, emergency_contact_name,
 *     emergency_contact_phone, profile_photo_url)
 *  2. Adds login_history table
 *  3. Adds new company_settings keys (company profile, weekend days,
 *     leave/permission rules, notification toggles, policy text,
 *     departments list)
 *  4. Adds user_notification_prefs table (per-employee notification toggles)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

const safeAlter = async (sql) => {
  try { await db.runAsync(sql) } catch { /* column already exists — skip */ }
}

async function run() {
  console.log('▶ Running migrate_v4 (Settings feature)…')

  // ── 1. New columns on users ───────────────────────────────────────────────
  await safeAlter(`ALTER TABLE users ADD COLUMN address               TEXT`)
  await safeAlter(`ALTER TABLE users ADD COLUMN emergency_contact_name  TEXT`)
  await safeAlter(`ALTER TABLE users ADD COLUMN emergency_contact_phone TEXT`)
  await safeAlter(`ALTER TABLE users ADD COLUMN profile_photo_url     TEXT`)
  await safeAlter(`ALTER TABLE users ADD COLUMN personal_email        TEXT`)
  console.log('  ✓ users columns extended')

  // ── 2. login_history table ────────────────────────────────────────────────
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS login_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ip_address  TEXT,
      user_agent  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  await db.runAsync(
    `CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id)`
  )
  console.log('  ✓ login_history table created')

  // ── 3. user_notification_prefs table ─────────────────────────────────────
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS user_notification_prefs (
      user_id                  INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      leave_status_updates     INTEGER NOT NULL DEFAULT 1,
      permission_status_updates INTEGER NOT NULL DEFAULT 1,
      payslip_available        INTEGER NOT NULL DEFAULT 1,
      verification_reminders   INTEGER NOT NULL DEFAULT 1,
      notification_sound       INTEGER NOT NULL DEFAULT 1
    )
  `)
  console.log('  ✓ user_notification_prefs table created')

  // ── 4. New company_settings keys ─────────────────────────────────────────
  const newSettings = [
    // Company profile
    ['company_name',                    'My Company'],
    ['company_address',                 ''],
    ['company_logo_url',                ''],
    ['company_policy_text',
      'KiwiTrack records your check-in and check-out timestamps each working day. ' +
      'Verification checkout checks are performed at random intervals during work sessions ' +
      'to confirm active presence. This data is used solely for attendance management ' +
      'and payroll processing.'],

    // Weekend / work-week
    ['weekend_days',                    '0,6'],   // 0=Sun, 6=Sat (comma-separated)

    // Leave rules
    ['leave_carry_forward',             '0'],     // 0=disabled, 1=enabled
    ['max_permissions_per_month',       '4'],
    ['max_permission_hours',            '2'],

    // Notification toggles (HR-side)
    ['notify_hr_new_leave',             '1'],
    ['notify_hr_new_permission',        '1'],
    ['notify_hr_verification_no_response', '1'],
    ['notify_hr_daily_summary',         '0'],
    ['notify_hr_daily_summary_time',    '08:00'],

    // Verification enable/disable master toggle
    ['verification_enabled',            '1'],
    ['verification_excluded_departments', ''],   // comma-separated dept names
  ]

  for (const [key, value] of newSettings) {
    await db.runAsync(
      `INSERT OR IGNORE INTO company_settings (key, value) VALUES (?, ?)`,
      [key, value]
    )
  }
  console.log('  ✓ company_settings seeded with new settings defaults')

  console.log('\n✅ migrate_v4 complete\n')
  process.exit(0)
}

run().catch(err => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
