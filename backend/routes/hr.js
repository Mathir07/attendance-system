const router = require('express').Router()
const bcrypt = require('bcryptjs')
const db     = require('../db/database')
const { auth, requireHR } = require('../middleware/auth')
const { getIndianHolidays } = require('../db/indianHolidays')

// ── Employee Management ──────────────────────────────────────────

// GET /api/hr/employees
router.get('/employees', auth, requireHR, async (req, res) => {
  try {
    const rows = await db.allAsync(
      `SELECT u.id, u.name, u.email, u.role, u.employee_id, u.department,
              u.designation, u.join_date, u.phone, u.status, u.created_at,
              m.name as manager_name,
              ss.basic, ss.hra, ss.allowances, ss.deductions, ss.pf, ss.net_pay
       FROM users u
       LEFT JOIN users m ON m.id = u.manager_id
       LEFT JOIN salary_structures ss ON ss.user_id = u.id
       WHERE u.role = 'employee'
       ORDER BY u.name`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// POST /api/hr/employees — create employee
router.post('/employees', auth, requireHR, async (req, res) => {
  try {
    const { name, email, password, employee_id, department, designation,
            manager_id, join_date, phone, basic, hra, allowances, deductions, pf } = req.body

    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email, and password required' })

    const exists = await db.getAsync('SELECT id FROM users WHERE email = ?', [email.toLowerCase()])
    if (exists) return res.status(409).json({ message: 'Email already registered' })

    const hash   = await bcrypt.hash(password, 10)
    const result = await db.runAsync(
      `INSERT INTO users (name,email,password_hash,role,employee_id,department,designation,manager_id,join_date,phone)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [name, email.toLowerCase(), hash, 'employee', employee_id || null,
       department || null, designation || null, manager_id || null,
       join_date || null, phone || null]
    )

    const userId = result.id

    // Salary structure
    if (basic !== undefined) {
      const net = (+basic || 0) + (+hra || 0) + (+allowances || 0) - (+deductions || 0) - (+pf || 0)
      await db.runAsync(
        `INSERT INTO salary_structures (user_id,basic,hra,allowances,deductions,pf,net_pay)
         VALUES (?,?,?,?,?,?,?)`,
        [userId, basic || 0, hra || 0, allowances || 0, deductions || 0, pf || 0, net]
      )
    }

    // Create leave balances for current year
    const year  = new Date().getFullYear()
    const types = await db.allAsync('SELECT id, max_per_year FROM leave_types')
    for (const lt of types) {
      await db.runAsync(
        `INSERT OR IGNORE INTO leave_balances (user_id,leave_type_id,year,allocated,used,remaining)
         VALUES (?,?,?,?,0,?)`,
        [userId, lt.id, year, lt.max_per_year, lt.max_per_year]
      )
    }

    await db.runAsync(
      `INSERT INTO audit_logs (actor_id,actor_name,action,target_table,target_id,details)
       VALUES (?,?,?,?,?,?)`,
      [req.user.id, req.user.name, 'CREATED_EMPLOYEE', 'users', userId, `Created employee: ${name}`]
    )

    res.status(201).json({ message: 'Employee created successfully', id: userId })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// PUT /api/hr/employees/:id — update employee
router.put('/employees/:id', auth, requireHR, async (req, res) => {
  try {
    const { name, employee_id, department, designation, manager_id, phone, join_date,
            basic, hra, allowances, deductions, pf } = req.body

    // Check employee_id uniqueness if it's being changed
    if (employee_id) {
      const conflict = await db.getAsync(
        'SELECT id FROM users WHERE employee_id=? AND id!=?',
        [employee_id, req.params.id]
      )
      if (conflict)
        return res.status(409).json({ message: `Employee ID "${employee_id}" is already taken` })
    }

    await db.runAsync(
      `UPDATE users SET name=?, employee_id=?, department=?, designation=?, manager_id=?, phone=?, join_date=?
       WHERE id=? AND role='employee'`,
      [name, employee_id || null, department || null, designation || null,
       manager_id || null, phone || null, join_date || null, req.params.id]
    )

    if (basic !== undefined) {
      const net = (+basic || 0) + (+hra || 0) + (+allowances || 0) - (+deductions || 0) - (+pf || 0)
      const existing = await db.getAsync('SELECT id FROM salary_structures WHERE user_id=?', [req.params.id])
      if (existing) {
        await db.runAsync(
          `UPDATE salary_structures SET basic=?,hra=?,allowances=?,deductions=?,pf=?,net_pay=?
           WHERE user_id=?`,
          [basic || 0, hra || 0, allowances || 0, deductions || 0, pf || 0, net, req.params.id]
        )
      } else {
        await db.runAsync(
          `INSERT INTO salary_structures (user_id,basic,hra,allowances,deductions,pf,net_pay)
           VALUES (?,?,?,?,?,?,?)`,
          [req.params.id, basic || 0, hra || 0, allowances || 0, deductions || 0, pf || 0, net]
        )
      }
    }

    res.json({ message: 'Employee updated' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// DELETE /api/hr/employees/:id — permanently delete employee
router.delete('/employees/:id', auth, requireHR, async (req, res) => {
  try {
    const emp = await db.getAsync('SELECT id, name, role FROM users WHERE id=?', [req.params.id])
    if (!emp)               return res.status(404).json({ message: 'Employee not found' })
    if (emp.role !== 'employee') return res.status(403).json({ message: 'Can only delete employees' })

    // Cascade-delete all related records manually (SQLite may not enforce FK cascades without PRAGMA)
    await db.runAsync('DELETE FROM attendance            WHERE user_id=?', [req.params.id])
    await db.runAsync('DELETE FROM leave_requests        WHERE user_id=?', [req.params.id])
    await db.runAsync('DELETE FROM permission_requests   WHERE user_id=?', [req.params.id])
    await db.runAsync('DELETE FROM leave_balances        WHERE user_id=?', [req.params.id])
    await db.runAsync('DELETE FROM salary_structures     WHERE user_id=?', [req.params.id])
    await db.runAsync('DELETE FROM payslips              WHERE user_id=?', [req.params.id])
    await db.runAsync('DELETE FROM verification_checks   WHERE user_id=?', [req.params.id])
    await db.runAsync('DELETE FROM users                 WHERE id=?',      [req.params.id])

    await db.runAsync(
      `INSERT INTO audit_logs (actor_id,actor_name,action,target_table,target_id,details)
       VALUES (?,?,?,?,?,?)`,
      [req.user.id, req.user.name, 'DELETED_EMPLOYEE', 'users', req.params.id, `Deleted employee: ${emp.name}`]
    )

    res.json({ message: `${emp.name} has been permanently deleted` })
  } catch (err) {
    console.error('Delete employee error:', err.message)
    res.status(500).json({ message: err.message || 'Delete failed' })
  }
})
router.put('/employees/:id/deactivate', auth, requireHR, async (req, res) => {
  try {
    await db.runAsync(
      `UPDATE users SET status = CASE WHEN status='active' THEN 'inactive' ELSE 'active' END WHERE id=?`,
      [req.params.id]
    )
    const u = await db.getAsync('SELECT status FROM users WHERE id=?', [req.params.id])
    res.json({ message: `Employee ${u.status === 'active' ? 'activated' : 'deactivated'}`, status: u.status })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ── Attendance Grid ──────────────────────────────────────────────

// GET /api/hr/attendance?month=8&year=2026
router.get('/attendance', auth, requireHR, async (req, res) => {
  try {
    const year  = req.query.year  || new Date().getFullYear()
    const month = req.query.month || (new Date().getMonth() + 1)
    const pad   = String(month).padStart(2, '0')

    const employees = await db.allAsync(
      `SELECT id, name, employee_id, department FROM users WHERE role='employee' AND status='active' ORDER BY name`
    )

    // Fetch attendance rows with first/last times and total minutes
    const records = await db.allAsync(
      `SELECT user_id, date, status,
              first_check_in, last_check_out, total_working_minutes,
              check_in, check_out
       FROM attendance WHERE date LIKE ?`,
      [`${year}-${pad}-%`]
    )

    // Fetch all logs for the month (for the popover detail)
    const logs = await db.allAsync(
      `SELECT al.user_id, al.date, al.action, al.timestamp
       FROM attendance_logs al
       WHERE al.date LIKE ?
       ORDER BY al.timestamp ASC, al.id ASC`,
      [`${year}-${pad}-%`]
    )

    // Map records by user_id → date
    const map = {}
    records.forEach(r => {
      if (!map[r.user_id]) map[r.user_id] = {}
      map[r.user_id][r.date] = { ...r, logs: [] }
    })

    // Attach logs to their day entry
    logs.forEach(l => {
      if (map[l.user_id]?.[l.date]) {
        map[l.user_id][l.date].logs.push({ action: l.action, timestamp: l.timestamp })
      }
    })

    res.json({ employees, attendance: map, year, month })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// GET /api/hr/attendance/:userId/:date — full log detail for one employee on one day
router.get('/attendance/:userId/:date', auth, requireHR, async (req, res) => {
  try {
    const { userId, date } = req.params

    const attendance = await db.getAsync(
      `SELECT u.name, u.employee_id, u.department,
              a.date, a.status, a.first_check_in, a.last_check_out, a.total_working_minutes
       FROM attendance a
       JOIN users u ON u.id = a.user_id
       WHERE a.user_id = ? AND a.date = ?`,
      [userId, date]
    )

    const logs = await db.allAsync(
      `SELECT action, timestamp FROM attendance_logs
       WHERE user_id = ? AND date = ?
       ORDER BY timestamp ASC, id ASC`,
      [userId, date]
    )

    res.json({ attendance: attendance || null, logs })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// GET /api/hr/attendance/:userId/:year/:month — full month detail for one employee
router.get('/attendance/:userId/:year/:month', auth, requireHR, async (req, res) => {
  try {
    const { userId, year, month } = req.params
    const pad = String(month).padStart(2, '0')

    const emp = await db.getAsync(
      `SELECT name, employee_id, department, designation FROM users WHERE id = ?`,
      [userId]
    )
    if (!emp) return res.status(404).json({ message: 'Employee not found' })

    const rows = await db.allAsync(
      `SELECT a.date, a.status, a.first_check_in, a.last_check_out, a.total_working_minutes,
              (SELECT GROUP_CONCAT(timestamp, '|')
               FROM attendance_logs WHERE attendance_id = a.id AND action = 'check_in'
               ORDER BY timestamp) AS check_in_times,
              (SELECT GROUP_CONCAT(timestamp, '|')
               FROM attendance_logs WHERE attendance_id = a.id AND action = 'check_out'
               ORDER BY timestamp) AS check_out_times
       FROM attendance a
       WHERE a.user_id = ? AND a.date LIKE ?
       ORDER BY a.date ASC`,
      [userId, `${year}-${pad}-%`]
    )

    res.json({ employee: emp, records: rows, year, month })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// GET /api/hr/dashboard
router.get('/dashboard', auth, requireHR, async (req, res) => {
  try {
    const today       = new Date().toISOString().split('T')[0]
    const totalEmp    = await db.getAsync(`SELECT COUNT(*) as c FROM users WHERE role='employee' AND status='active'`)
    const presentToday= await db.getAsync(
      `SELECT COUNT(*) as c FROM attendance WHERE date=? AND status IN ('present','late')`, [today]
    )
    const onLeaveToday= await db.getAsync(
      `SELECT COUNT(*) as c FROM attendance WHERE date=? AND status='on_leave'`, [today]
    )
    const halfDayToday= await db.getAsync(
      `SELECT COUNT(*) as c FROM attendance WHERE date=? AND status='half_day'`, [today]
    )
    const pendingLeave = await db.getAsync(`SELECT COUNT(*) as c FROM leave_requests WHERE status='pending'`)
    const pendingPerm  = await db.getAsync(`SELECT COUNT(*) as c FROM permission_requests WHERE status='pending'`)

    // True absent = total active employees minus anyone who has ANY attendance record today
    const markedToday = await db.getAsync(
      `SELECT COUNT(DISTINCT user_id) as c FROM attendance WHERE date=?`, [today]
    )
    const absentToday = Math.max(0, totalEmp.c - markedToday.c)

    res.json({
      total_employees:    totalEmp.c,
      present_today:      presentToday.c,
      absent_today:       absentToday,
      on_leave_today:     onLeaveToday.c,
      half_day_today:     halfDayToday.c,
      pending_leave:      pendingLeave.c,
      pending_permission: pendingPerm.c,
      attendance_pct:     totalEmp.c > 0 ? Math.round((presentToday.c / totalEmp.c) * 100) : 0
    })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// GET /api/hr/audit-logs
router.get('/audit-logs', auth, requireHR, async (req, res) => {
  try {
    const rows = await db.allAsync(
      `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// GET /api/hr/holidays
router.get('/holidays', auth, async (req, res) => {
  const year = req.query.year || new Date().getFullYear()
  try {
    // Auto-migrate: add type/category columns if they don't exist yet (safe on older DBs)
    await db.runAsync(`ALTER TABLE holidays ADD COLUMN type TEXT NOT NULL DEFAULT 'gazetted'`).catch(() => {})
    await db.runAsync(`ALTER TABLE holidays ADD COLUMN category TEXT NOT NULL DEFAULT 'General'`).catch(() => {})

    const rows = await db.allAsync(
      `SELECT * FROM holidays WHERE date LIKE ? ORDER BY date`,
      [`${year}%`]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// POST /api/hr/holidays/sync/:year — auto-populate Indian govt holidays for a year
router.post('/holidays/sync/:year', auth, requireHR, async (req, res) => {
  try {
    const year     = parseInt(req.params.year, 10)
    if (isNaN(year) || year < 2000 || year > 2100)
      return res.status(400).json({ message: 'Invalid year' })

    const holidays = getIndianHolidays(year)

    let inserted = 0
    let skipped  = 0

    for (const h of holidays) {
      const is_optional = h.type === 'restricted' ? 1 : 0
      try {
        await db.runAsync(
          `INSERT INTO holidays (date, name, is_optional, type, category)
           VALUES (?, ?, ?, ?, ?)`,
          [h.date, h.name, is_optional, h.type, h.category]
        )
        inserted++
      } catch {
        // UNIQUE constraint — holiday already exists for that date, skip
        skipped++
      }
    }

    await db.runAsync(
      `INSERT INTO audit_logs (actor_id, actor_name, action, target_table, details)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, req.user.name, 'SYNC_HOLIDAYS', 'holidays',
       `Synced ${inserted} Indian govt holidays for ${year} (${skipped} already existed)`]
    )

    res.json({
      message: `Synced ${inserted} holidays for ${year}`,
      inserted,
      skipped,
      total: holidays.length
    })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// POST /api/hr/holidays — HR only (manual add)
router.post('/holidays', auth, requireHR, async (req, res) => {
  try {
    const { date, name, is_optional, type, category } = req.body
    if (!date || !name) return res.status(400).json({ message: 'Date and name required' })
    const htype    = type || (is_optional ? 'restricted' : 'gazetted')
    const hcat     = category || 'General'
    await db.runAsync(
      `INSERT OR REPLACE INTO holidays (date, name, is_optional, type, category) VALUES (?, ?, ?, ?, ?)`,
      [date, name, is_optional ? 1 : 0, htype, hcat]
    )
    res.status(201).json({ message: 'Holiday added' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// DELETE /api/hr/holidays/:id — HR only
router.delete('/holidays/:id', auth, requireHR, async (req, res) => {
  await db.runAsync('DELETE FROM holidays WHERE id=?', [req.params.id])
  res.json({ message: 'Holiday deleted' })
})

module.exports = router
