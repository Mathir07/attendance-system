/**
 * backend/routes/settings.js
 *
 * All settings endpoints — HR and Employee.
 *
 * HR routes  (require auth + requireHR):
 *   GET  /api/settings/hr                   — all company_settings as object
 *   PUT  /api/settings/hr                   — bulk-update company_settings keys
 *   GET  /api/settings/hr/leave-types       — list leave_types
 *   POST /api/settings/hr/leave-types       — create leave_type
 *   PUT  /api/settings/hr/leave-types/:id   — update leave_type
 *   DELETE /api/settings/hr/leave-types/:id — delete leave_type
 *   GET  /api/settings/hr/departments       — distinct department list from users
 *   GET  /api/settings/hr/profile           — HR's own user record
 *   PUT  /api/settings/hr/profile           — update HR's own profile fields
 *
 * Employee routes  (require auth, own-data only):
 *   GET  /api/settings/employee/profile     — own profile
 *   PUT  /api/settings/employee/profile     — update own editable fields
 *   GET  /api/settings/employee/notifications  — notification prefs
 *   PUT  /api/settings/employee/notifications  — update notification prefs
 *   GET  /api/settings/employee/login-history  — last 20 logins
 *   GET  /api/settings/employee/leave-balances — own current-year balances
 *   GET  /api/settings/employee/permission-usage — current-month permission count
 *   GET  /api/settings/employee/policy      — company policy text (public within app)
 *   GET  /api/settings/employee/attendance-report — CSV download (month/year)
 *
 * Shared (auth required):
 *   POST /api/settings/login-event          — called by login route to record history
 */

const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const db      = require('../db/database')
const { auth, requireHR } = require('../middleware/auth')

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getAllSettings() {
  const rows = await db.allAsync('SELECT key, value FROM company_settings')
  const map  = {}
  rows.forEach(r => { map[r.key] = r.value })
  return map
}

// ═══════════════════════════════════════════════════════════════════════════════
// HR SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/settings/hr
router.get('/hr', auth, requireHR, async (req, res) => {
  try {
    res.json(await getAllSettings())
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// PUT /api/settings/hr
// Body: { key1: value1, key2: value2, … }
router.put('/hr', auth, requireHR, async (req, res) => {
  try {
    const updates = req.body
    if (!updates || typeof updates !== 'object' || Array.isArray(updates))
      return res.status(400).json({ message: 'Body must be a key-value object' })

    for (const [key, value] of Object.entries(updates)) {
      await db.runAsync(
        `INSERT INTO company_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, String(value)]
      )
    }

    res.json({ message: 'Settings saved', settings: await getAllSettings() })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ── Leave Types ───────────────────────────────────────────────────────────────

// GET /api/settings/hr/leave-types
router.get('/hr/leave-types', auth, requireHR, async (req, res) => {
  try {
    const rows = await db.allAsync(
      'SELECT * FROM leave_types ORDER BY name'
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// POST /api/settings/hr/leave-types
router.post('/hr/leave-types', auth, requireHR, async (req, res) => {
  try {
    const { name, max_per_year, is_paid } = req.body
    if (!name) return res.status(400).json({ message: 'Leave type name is required' })

    const exists = await db.getAsync(
      'SELECT id FROM leave_types WHERE name = ?', [name.trim()]
    )
    if (exists) return res.status(409).json({ message: 'Leave type already exists' })

    const result = await db.runAsync(
      `INSERT INTO leave_types (name, max_per_year, is_paid) VALUES (?, ?, ?)`,
      [name.trim(), max_per_year || 12, is_paid === false || is_paid === 0 ? 0 : 1]
    )

    // Create leave balances for all active employees for the current year
    const year      = new Date().getFullYear()
    const employees = await db.allAsync(
      `SELECT id FROM users WHERE role='employee' AND status='active'`
    )
    for (const emp of employees) {
      await db.runAsync(
        `INSERT OR IGNORE INTO leave_balances (user_id, leave_type_id, year, allocated, used, remaining)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [emp.id, result.id, year, max_per_year || 12, max_per_year || 12]
      )
    }

    const created = await db.getAsync('SELECT * FROM leave_types WHERE id=?', [result.id])
    res.status(201).json(created)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// PUT /api/settings/hr/leave-types/:id
router.put('/hr/leave-types/:id', auth, requireHR, async (req, res) => {
  try {
    const { name, max_per_year, is_paid } = req.body
    if (!name) return res.status(400).json({ message: 'Name is required' })

    const conflict = await db.getAsync(
      'SELECT id FROM leave_types WHERE name=? AND id!=?', [name.trim(), req.params.id]
    )
    if (conflict) return res.status(409).json({ message: 'Name already in use' })

    await db.runAsync(
      `UPDATE leave_types SET name=?, max_per_year=?, is_paid=? WHERE id=?`,
      [name.trim(), max_per_year || 12, is_paid === false || is_paid === 0 ? 0 : 1, req.params.id]
    )
    const updated = await db.getAsync('SELECT * FROM leave_types WHERE id=?', [req.params.id])
    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// DELETE /api/settings/hr/leave-types/:id
router.delete('/hr/leave-types/:id', auth, requireHR, async (req, res) => {
  try {
    const lt = await db.getAsync('SELECT * FROM leave_types WHERE id=?', [req.params.id])
    if (!lt) return res.status(404).json({ message: 'Leave type not found' })

    // Check if any leave requests use this type
    const inUse = await db.getAsync(
      `SELECT id FROM leave_requests WHERE leave_type_id=? LIMIT 1`, [req.params.id]
    )
    if (inUse) {
      return res.status(400).json({
        message: 'Cannot delete — leave requests exist for this type. Disable it instead.'
      })
    }

    await db.runAsync('DELETE FROM leave_balances WHERE leave_type_id=?', [req.params.id])
    await db.runAsync('DELETE FROM leave_types WHERE id=?', [req.params.id])
    res.json({ message: `"${lt.name}" deleted` })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ── Departments ───────────────────────────────────────────────────────────────

// GET /api/settings/hr/departments
// Returns distinct department list from users + any custom ones in company_settings
router.get('/hr/departments', auth, requireHR, async (req, res) => {
  try {
    const rows = await db.allAsync(
      `SELECT DISTINCT department FROM users
       WHERE department IS NOT NULL AND department != ''
       ORDER BY department`
    )
    const depts = rows.map(r => r.department)

    // Also include any stored in company_settings (custom departments not yet assigned)
    const setting = await db.getAsync(
      `SELECT value FROM company_settings WHERE key='custom_departments'`
    )
    if (setting?.value) {
      const custom = setting.value.split(',').map(s => s.trim()).filter(Boolean)
      custom.forEach(d => { if (!depts.includes(d)) depts.push(d) })
    }

    res.json(depts.sort())
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// PUT /api/settings/hr/departments
// Body: { departments: ['Eng', 'HR', …] }
router.put('/hr/departments', auth, requireHR, async (req, res) => {
  try {
    const { departments } = req.body
    if (!Array.isArray(departments))
      return res.status(400).json({ message: 'departments must be an array' })

    await db.runAsync(
      `INSERT INTO company_settings (key, value) VALUES ('custom_departments', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [departments.filter(Boolean).join(',')]
    )
    res.json({ message: 'Departments saved' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ── Designations ─────────────────────────────────────────────────────────────

// GET /api/settings/hr/designations
// Returns distinct designation list from users + any custom ones in company_settings
router.get('/hr/designations', auth, requireHR, async (req, res) => {
  try {
    const rows = await db.allAsync(
      `SELECT DISTINCT designation FROM users
       WHERE designation IS NOT NULL AND designation != ''
       ORDER BY designation`
    )
    const designations = rows.map(r => r.designation)

    const setting = await db.getAsync(
      `SELECT value FROM company_settings WHERE key='custom_designations'`
    )
    if (setting?.value) {
      const custom = setting.value.split(',').map(s => s.trim()).filter(Boolean)
      custom.forEach(d => { if (!designations.includes(d)) designations.push(d) })
    }

    res.json(designations.sort())
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// PUT /api/settings/hr/designations
// Body: { designations: ['Engineer', 'Manager', …] }
router.put('/hr/designations', auth, requireHR, async (req, res) => {
  try {
    const { designations } = req.body
    if (!Array.isArray(designations))
      return res.status(400).json({ message: 'designations must be an array' })

    await db.runAsync(
      `INSERT INTO company_settings (key, value) VALUES ('custom_designations', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [designations.filter(Boolean).join(',')]
    )
    res.json({ message: 'Designations saved' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ── HR own profile ────────────────────────────────────────────────────────────

// GET /api/settings/hr/profile
router.get('/hr/profile', auth, requireHR, async (req, res) => {
  try {
    const user = await db.getAsync(
      `SELECT id, name, email, role, employee_id, department, designation,
              phone, personal_email, address,
              emergency_contact_name, emergency_contact_phone,
              profile_photo_url, join_date, status, created_at
       FROM users WHERE id=?`,
      [req.user.id]
    )
    res.json(user)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// PUT /api/settings/hr/profile
router.put('/hr/profile', auth, requireHR, async (req, res) => {
  try {
    const { name, phone, personal_email, address,
            emergency_contact_name, emergency_contact_phone } = req.body

    await db.runAsync(
      `UPDATE users SET name=?, phone=?, personal_email=?, address=?,
          emergency_contact_name=?, emergency_contact_phone=?
       WHERE id=?`,
      [name || req.user.name, phone || null, personal_email || null,
       address || null, emergency_contact_name || null,
       emergency_contact_phone || null, req.user.id]
    )

    const updated = await db.getAsync(
      `SELECT id, name, email, role, employee_id, department, designation,
              phone, personal_email, address,
              emergency_contact_name, emergency_contact_phone,
              profile_photo_url, join_date, status
       FROM users WHERE id=?`,
      [req.user.id]
    )
    res.json({ message: 'Profile updated', user: updated })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/settings/employee/profile
router.get('/employee/profile', auth, async (req, res) => {
  try {
    const user = await db.getAsync(
      `SELECT id, name, email, role, employee_id, department, designation,
              phone, personal_email, address,
              emergency_contact_name, emergency_contact_phone,
              profile_photo_url, join_date, status, created_at,
              (SELECT name FROM users m WHERE m.id = u.manager_id) AS manager_name
       FROM users u WHERE u.id=?`,
      [req.user.id]
    )
    res.json(user)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// PUT /api/settings/employee/profile  — only editable fields
router.put('/employee/profile', auth, async (req, res) => {
  try {
    const { phone, personal_email, address,
            emergency_contact_name, emergency_contact_phone } = req.body

    // Employees cannot change: name, email, role, employee_id, department,
    // designation, manager_id, join_date, status
    await db.runAsync(
      `UPDATE users SET phone=?, personal_email=?, address=?,
          emergency_contact_name=?, emergency_contact_phone=?
       WHERE id=?`,
      [phone || null, personal_email || null, address || null,
       emergency_contact_name || null, emergency_contact_phone || null,
       req.user.id]
    )

    const updated = await db.getAsync(
      `SELECT id, name, email, role, employee_id, department, designation,
              phone, personal_email, address,
              emergency_contact_name, emergency_contact_phone,
              profile_photo_url, join_date, status
       FROM users WHERE id=?`,
      [req.user.id]
    )
    res.json({ message: 'Profile updated', user: updated })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// GET /api/settings/employee/notifications
router.get('/employee/notifications', auth, async (req, res) => {
  try {
    let prefs = await db.getAsync(
      'SELECT * FROM user_notification_prefs WHERE user_id=?',
      [req.user.id]
    )
    if (!prefs) {
      // Return defaults without inserting yet
      prefs = {
        user_id:                   req.user.id,
        leave_status_updates:      1,
        permission_status_updates: 1,
        payslip_available:         1,
        verification_reminders:    1,
        notification_sound:        1,
      }
    }
    res.json(prefs)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// PUT /api/settings/employee/notifications
router.put('/employee/notifications', auth, async (req, res) => {
  try {
    const {
      leave_status_updates      = 1,
      permission_status_updates = 1,
      payslip_available         = 1,
      verification_reminders    = 1,
      notification_sound        = 1,
    } = req.body

    await db.runAsync(
      `INSERT INTO user_notification_prefs
         (user_id, leave_status_updates, permission_status_updates,
          payslip_available, verification_reminders, notification_sound)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(user_id) DO UPDATE SET
         leave_status_updates      = excluded.leave_status_updates,
         permission_status_updates = excluded.permission_status_updates,
         payslip_available         = excluded.payslip_available,
         verification_reminders    = excluded.verification_reminders,
         notification_sound        = excluded.notification_sound`,
      [req.user.id,
       leave_status_updates ? 1 : 0,
       permission_status_updates ? 1 : 0,
       payslip_available ? 1 : 0,
       verification_reminders ? 1 : 0,
       notification_sound ? 1 : 0]
    )

    res.json({ message: 'Notification preferences saved' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// GET /api/settings/employee/login-history
router.get('/employee/login-history', auth, async (req, res) => {
  try {
    const rows = await db.allAsync(
      `SELECT id, ip_address, user_agent, created_at
       FROM login_history
       WHERE user_id=?
       ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// GET /api/settings/employee/leave-balances
router.get('/employee/leave-balances', auth, async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear()
    const rows = await db.allAsync(
      `SELECT lb.*, lt.name, lt.is_paid, lt.max_per_year
       FROM leave_balances lb
       JOIN leave_types lt ON lt.id = lb.leave_type_id
       WHERE lb.user_id=? AND lb.year=?
       ORDER BY lt.name`,
      [req.user.id, year]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// GET /api/settings/employee/permission-usage
router.get('/employee/permission-usage', auth, async (req, res) => {
  try {
    const now   = new Date()
    const year  = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const pad   = `${year}-${month}-%`

    const row = await db.getAsync(
      `SELECT COUNT(*) AS used_count, COALESCE(SUM(hours),0) AS used_hours
       FROM permission_requests
       WHERE user_id=? AND date LIKE ? AND status != 'rejected'`,
      [req.user.id, pad]
    )

    const settings = await db.getAsync(
      `SELECT value FROM company_settings WHERE key='max_permissions_per_month'`
    )
    const maxPerMonth = parseInt(settings?.value || '4', 10)

    res.json({
      used_count:    row.used_count,
      used_hours:    row.used_hours,
      max_per_month: maxPerMonth,
      remaining:     Math.max(0, maxPerMonth - row.used_count),
    })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// GET /api/settings/employee/policy
router.get('/employee/policy', auth, async (req, res) => {
  try {
    const row = await db.getAsync(
      `SELECT value FROM company_settings WHERE key='company_policy_text'`
    )
    const nameRow = await db.getAsync(
      `SELECT value FROM company_settings WHERE key='company_name'`
    )
    res.json({
      policy_text:  row?.value || '',
      company_name: nameRow?.value || 'KiwiTrack',
    })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// GET /api/settings/employee/attendance-report?year=&month=&token=
// Returns a CSV of the employee's own attendance for that month.
// Accepts token via query param for direct <a> download (no custom headers possible).
router.get('/employee/attendance-report', async (req, res) => {
  try {
    // Auth: prefer header token, fall back to ?token= query param for direct downloads
    let userId
    const headerToken = req.headers.authorization?.split(' ')[1]
    const queryToken  = req.query.token
    const jwt         = require('jsonwebtoken')
    const tokenToUse  = headerToken || queryToken
    if (!tokenToUse) return res.status(401).json({ message: 'Unauthorised' })
    const decoded = jwt.verify(tokenToUse, process.env.JWT_SECRET)
    userId = decoded.id
    const year  = req.query.year  || new Date().getFullYear()
    const month = req.query.month || (new Date().getMonth() + 1)
    const pad   = String(month).padStart(2, '0')

    const user = await db.getAsync(
      'SELECT name, employee_id FROM users WHERE id=?', [userId]
    )

    const rows = await db.allAsync(
      `SELECT a.date, a.status, a.first_check_in, a.last_check_out,
              a.total_working_minutes
       FROM attendance a
       WHERE a.user_id=? AND a.date LIKE ?
       ORDER BY a.date`,
      [userId, `${year}-${pad}-%`]
    )

    const lines = [
      `Attendance Report — ${user.name} (${user.employee_id || 'N/A'}) — ${pad}/${year}`,
      `Date,Day,Status,First In,Last Out,Hours Worked`,
      ...rows.map(r => {
        const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(r.date + 'T00:00:00').getDay()]
        const hrs = r.total_working_minutes > 0
          ? `${Math.floor(r.total_working_minutes / 60)}h ${r.total_working_minutes % 60}m`
          : '–'
        return `${r.date},${dow},${r.status || 'absent'},${r.first_check_in || ''},${r.last_check_out || ''},${hrs}`
      })
    ]

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="attendance-${user.employee_id || userId}-${year}-${pad}.csv"`
    )
    res.send(lines.join('\n'))
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ── Login event recorder (called internally from auth/login) ──────────────────
// POST /api/settings/login-event
router.post('/login-event', auth, async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
           || req.socket?.remoteAddress
           || 'unknown'
    const ua = req.headers['user-agent'] || 'unknown'

    await db.runAsync(
      `INSERT INTO login_history (user_id, ip_address, user_agent) VALUES (?,?,?)`,
      [req.user.id, ip, ua]
    )

    // Keep only last 50 entries per user
    await db.runAsync(
      `DELETE FROM login_history WHERE user_id=? AND id NOT IN (
         SELECT id FROM login_history WHERE user_id=? ORDER BY created_at DESC LIMIT 50
       )`,
      [req.user.id, req.user.id]
    )

    res.json({ message: 'ok' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

module.exports = router
