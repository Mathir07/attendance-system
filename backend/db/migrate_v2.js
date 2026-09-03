/**
 * migrate_v2.js
 * Run once: node db/migrate_v2.js
 *
 * What this does:
 *  1. Creates company_settings table with configurable time thresholds
 *  2. Creates attendance_logs table (child of attendance)
 *  3. Adds first_check_in, last_check_out, total_working_minutes to attendance
 *  4. Backfills existing single check_in / check_out rows into attendance_logs
 *  5. Backfills first_check_in / last_check_out / total_working_minutes on attendance
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function run() {
  console.log('▶ Running migrate_v2…')

  // ── 1. company_settings ───────────────────────────────────────────────────
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS company_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  const defaults = [
    ['work_start_time',       '09:30'],   // on-time window starts here
    ['late_threshold_time',   '10:00'],   // after this → Late
    ['half_day_threshold_time','12:30'],  // after this → Half Day
    ['work_end_time',         '18:30'],
    ['lunch_start_time',      '13:00'],
    ['lunch_end_time',        '14:00'],
    ['min_full_day_minutes',  '270'],     // 4.5 hours net = full day
  ]
  for (const [key, value] of defaults) {
    await db.runAsync(
      `INSERT OR IGNORE INTO company_settings (key, value) VALUES (?, ?)`,
      [key, value]
    )
  }
  console.log('  ✓ company_settings seeded with defaults')

  // ── 2. attendance_logs ────────────────────────────────────────────────────
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS attendance_logs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      attendance_id INTEGER NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
      user_id       INTEGER NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
      date          TEXT    NOT NULL,
      action        TEXT    NOT NULL CHECK(action IN ('check_in','check_out')),
      timestamp     TEXT    NOT NULL,
      source        TEXT    NOT NULL DEFAULT 'web',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `)
  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_logs_user_date ON attendance_logs(user_id, date)`)
  console.log('  ✓ attendance_logs created')

  // ── 3. New columns on attendance ──────────────────────────────────────────
  const safeAlter = async (sql) => { try { await db.runAsync(sql) } catch { /* column exists */ } }
  await safeAlter(`ALTER TABLE attendance ADD COLUMN first_check_in        TEXT`)
  await safeAlter(`ALTER TABLE attendance ADD COLUMN last_check_out        TEXT`)
  await safeAlter(`ALTER TABLE attendance ADD COLUMN total_working_minutes INTEGER NOT NULL DEFAULT 0`)
  console.log('  ✓ attendance columns extended')

  // ── 4. Backfill attendance_logs from existing check_in / check_out ────────
  const rows = await db.allAsync(
    `SELECT id, user_id, date, check_in, check_out FROM attendance
     WHERE check_in IS NOT NULL`
  )

  let backfilled = 0
  for (const row of rows) {
    // check_in log
    const existing = await db.getAsync(
      `SELECT id FROM attendance_logs WHERE attendance_id = ? AND action = 'check_in'`,
      [row.id]
    )
    if (!existing) {
      await db.runAsync(
        `INSERT INTO attendance_logs (attendance_id, user_id, date, action, timestamp)
         VALUES (?, ?, ?, 'check_in', ?)`,
        [row.id, row.user_id, row.date, row.check_in]
      )
    }

    // check_out log
    if (row.check_out) {
      const existingOut = await db.getAsync(
        `SELECT id FROM attendance_logs WHERE attendance_id = ? AND action = 'check_out'`,
        [row.id]
      )
      if (!existingOut) {
        await db.runAsync(
          `INSERT INTO attendance_logs (attendance_id, user_id, date, action, timestamp)
           VALUES (?, ?, ?, 'check_out', ?)`,
          [row.id, row.user_id, row.date, row.check_out]
        )
      }
    }

    // Backfill first_check_in / last_check_out / total_working_minutes
    const totalMins = row.check_out ? (() => {
      const [ih, im] = row.check_in.split(':').map(Number)
      const [oh, om] = row.check_out.split(':').map(Number)
      return Math.max(0, (oh * 60 + om) - (ih * 60 + im))
    })() : 0

    await db.runAsync(
      `UPDATE attendance SET first_check_in = ?, last_check_out = ?, total_working_minutes = ?
       WHERE id = ?`,
      [row.check_in, row.check_out || null, totalMins, row.id]
    )

    backfilled++
  }
  console.log(`  ✓ Backfilled ${backfilled} attendance row(s) into attendance_logs`)

  console.log('\n✅ migrate_v2 complete\n')
  process.exit(0)
}

run().catch(err => { console.error('Migration failed:', err.message); process.exit(1) })
