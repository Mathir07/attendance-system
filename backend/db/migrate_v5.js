/**
 * migrate_v5.js
 * Run once: node db/migrate_v5.js
 *
 * What this does:
 *   Adds four new company_settings keys that control when each verification
 *   session window starts and ends. Previously these were hardcoded in the
 *   backend; now HR can change them via Settings → Verification Checks.
 *
 *   New keys (with sensible defaults matching the old hardcoded values):
 *     verification_session1_start  — default '10:00'
 *     verification_session1_end    — default '13:00'
 *     verification_session2_start  — default '14:30'
 *     verification_session2_end    — default '18:30'
 *
 *   Uses INSERT OR IGNORE so running it twice is safe.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function run() {
  console.log('▶ Running migrate_v5 (Configurable verification session windows)…')

  const newSettings = [
    ['verification_session1_start', '10:00'],
    ['verification_session1_end',   '13:00'],
    ['verification_session2_start', '14:30'],
    ['verification_session2_end',   '18:30'],
  ]

  for (const [key, value] of newSettings) {
    await db.runAsync(
      `INSERT OR IGNORE INTO company_settings (key, value) VALUES (?, ?)`,
      [key, value]
    )
  }

  // Verify they exist
  const rows = await db.allAsync(
    `SELECT key, value FROM company_settings WHERE key LIKE 'verification_session%'`
  )
  console.log('  ✓ Session window settings in DB:')
  rows.forEach(r => console.log(`    ${r.key} = ${r.value}`))

  console.log('\n✅ migrate_v5 complete\n')
  process.exit(0)
}

run().catch(err => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
