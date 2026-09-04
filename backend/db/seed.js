/**
 * seed.js
 *
 * Safe to re-run any time — uses INSERT OR IGNORE throughout.
 *
 * What this seeds:
 *   • Leave types  (Casual, Sick, Earned, Unpaid)
 *   • National holidays for the current year
 *
 * What this does NOT seed:
 *   • Users — add employees via the HR portal (HR → Employees → Add Employee)
 *   • Salary structures — set per-employee in HR → Employees → Edit
 *   • Attendance — generated live as employees check in/out
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function seed() {
  console.log('🌱 Seeding database...')

  // ── Leave types ─────────────────────────────────────────────────────────────
  const leaveTypes = [
    { name: 'Casual Leave',  max_per_year: 12, is_paid: 1 },
    { name: 'Sick Leave',    max_per_year: 12, is_paid: 1 },
    { name: 'Earned Leave',  max_per_year: 15, is_paid: 1 },
    { name: 'Unpaid Leave',  max_per_year: 30, is_paid: 0 },
  ]

  for (const lt of leaveTypes) {
    await db.runAsync(
      `INSERT OR IGNORE INTO leave_types (name, max_per_year, is_paid) VALUES (?,?,?)`,
      [lt.name, lt.max_per_year, lt.is_paid]
    )
  }
  console.log('✓ Leave types seeded')

  // ── National holidays for current year ──────────────────────────────────────
  const year = new Date().getFullYear()
  const holidays = [
    { date: `${year}-01-26`, name: 'Republic Day' },
    { date: `${year}-08-15`, name: 'Independence Day' },
    { date: `${year}-10-02`, name: 'Gandhi Jayanti' },
    { date: `${year}-12-25`, name: 'Christmas' },
  ]
  for (const h of holidays) {
    await db.runAsync(
      `INSERT OR IGNORE INTO holidays (date, name) VALUES (?,?)`,
      [h.date, h.name]
    )
  }
  console.log('✓ Holidays seeded')

  // ── Show current employees in DB ─────────────────────────────────────────────
  const users = await db.allAsync(
    `SELECT id, name, email, role, employee_id, status FROM users ORDER BY id`
  )
  console.log(`\n📋 Current users in database (${users.length}):`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  users.forEach(u =>
    console.log(`  [${u.id}] ${u.role.padEnd(9)} ${u.employee_id.padEnd(8)} ${u.name} <${u.email}>`)
  )
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n✅ Seed complete! Add employees via HR → Employees → Add Employee')
  process.exit(0)
}

seed().catch(err => { console.error(err); process.exit(1) })
