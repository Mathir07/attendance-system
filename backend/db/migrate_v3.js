/**
 * migrate_v3.js
 * Run once: node db/migrate_v3.js
 *
 * What this does:
 *  1. Adds new company_settings keys for verification configuration
 *  2. Creates the verification_checks table
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function run() {
  console.log('▶ Running migrate_v3 (Random Verification Checkout)…')

  // ── 1. New company_settings keys ─────────────────────────────────────────
  const verificationDefaults = [
    ['verification_checks_per_session',    '2'],   // number of verification triggers per session
    ['verification_min_gap_minutes',       '30'],  // minimum gap between triggers in same session
    ['verification_grace_period_minutes',  '5'],   // minutes employee has to respond before "No Response"
    ['verification_exclude_start_minutes', '15'],  // exclude first N minutes of each session window
    ['verification_exclude_end_minutes',   '15'],  // exclude last N minutes of each session window
  ]
  for (const [key, value] of verificationDefaults) {
    await db.runAsync(
      `INSERT OR IGNORE INTO company_settings (key, value) VALUES (?, ?)`,
      [key, value]
    )
  }
  console.log('  ✓ company_settings seeded with verification defaults')

  // ── 2. verification_checks table ──────────────────────────────────────────
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS verification_checks (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date                    TEXT    NOT NULL,
      session                 INTEGER NOT NULL CHECK(session IN (1, 2)),
      scheduled_time          TEXT    NOT NULL,
      actual_checkout_time    TEXT,
      checkin_time            TEXT,
      response_delay_seconds  INTEGER,
      status                  TEXT    NOT NULL DEFAULT 'pending'
                              CHECK(status IN ('pending','responded','no_response')),
      created_at              TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `)
  await db.runAsync(
    `CREATE INDEX IF NOT EXISTS idx_vc_user_date ON verification_checks(user_id, date)`
  )
  console.log('  ✓ verification_checks table created')

  console.log('\n✅ migrate_v3 complete\n')
  process.exit(0)
}

run().catch(err => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
