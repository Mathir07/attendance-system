const router = require('express').Router()
const db     = require('../db/database')
const { auth, requireHR } = require('../middleware/auth')

// GET /api/leave/types
router.get('/types', auth, async (req, res) => {
  const types = await db.allAsync('SELECT * FROM leave_types ORDER BY name')
  res.json(types)
})

// GET /api/leave/balances — employee's own balances
router.get('/balances', auth, async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear()
    const rows = await db.allAsync(
      `SELECT lb.*, lt.name as leave_name, lt.is_paid
       FROM leave_balances lb
       JOIN leave_types lt ON lt.id = lb.leave_type_id
       WHERE lb.user_id = ? AND lb.year = ?`,
      [req.user.id, year]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// POST /api/leave/apply
router.post('/apply', auth, async (req, res) => {
  try {
    const { leave_type_id, start_date, end_date, reason } = req.body
    if (!leave_type_id || !start_date || !end_date || !reason)
      return res.status(400).json({ message: 'All fields required' })

    // Calculate working days
    const start = new Date(start_date)
    const end   = new Date(end_date)
    if (end < start) return res.status(400).json({ message: 'End date must be after start date' })

    let days = 0
    const cur = new Date(start)
    while (cur <= end) {
      const day = cur.getDay()
      if (day !== 0 && day !== 6) days++ // skip weekends
      cur.setDate(cur.getDate() + 1)
    }

    // Check balance
    const year    = start.getFullYear()
    const balance = await db.getAsync(
      'SELECT * FROM leave_balances WHERE user_id = ? AND leave_type_id = ? AND year = ?',
      [req.user.id, leave_type_id, year]
    )
    if (!balance || balance.remaining < days)
      return res.status(400).json({ message: `Insufficient leave balance. Available: ${balance?.remaining || 0} days` })

    // Check overlap
    const overlap = await db.getAsync(
      `SELECT id FROM leave_requests
       WHERE user_id = ? AND status != 'rejected'
       AND NOT (end_date < ? OR start_date > ?)`,
      [req.user.id, start_date, end_date]
    )
    if (overlap) return res.status(400).json({ message: 'You already have a leave request for this period' })

    const result = await db.runAsync(
      `INSERT INTO leave_requests (user_id,leave_type_id,start_date,end_date,days,reason)
       VALUES (?,?,?,?,?,?)`,
      [req.user.id, leave_type_id, start_date, end_date, days, reason]
    )

    res.status(201).json({ message: 'Leave request submitted', id: result.id, days })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// GET /api/leave/my — employee's own requests
router.get('/my', auth, async (req, res) => {
  try {
    const rows = await db.allAsync(
      `SELECT lr.*, lt.name as leave_name,
              u.name as approved_by_name
       FROM leave_requests lr
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       LEFT JOIN users u ON u.id = lr.approved_by
       WHERE lr.user_id = ?
       ORDER BY lr.created_at DESC`,
      [req.user.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// GET /api/leave/all — HR only, all pending requests
router.get('/all', auth, requireHR, async (req, res) => {
  try {
    const status = req.query.status || 'pending'
    const rows   = await db.allAsync(
      `SELECT lr.*, lt.name as leave_name, u.name as employee_name,
              u.employee_id, u.department,
              ab.name as approved_by_name
       FROM leave_requests lr
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       JOIN users u ON u.id = lr.user_id
       LEFT JOIN users ab ON ab.id = lr.approved_by
       WHERE lr.status = ?
       ORDER BY lr.created_at DESC`,
      [status]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// PUT /api/leave/:id/approve — HR only
router.put('/:id/approve', auth, requireHR, async (req, res) => {
  try {
    const { comment } = req.body
    const request = await db.getAsync('SELECT * FROM leave_requests WHERE id = ?', [req.params.id])
    if (!request) return res.status(404).json({ message: 'Request not found' })
    if (request.status !== 'pending') return res.status(400).json({ message: 'Request already processed' })

    await db.runAsync(
      `UPDATE leave_requests SET status='approved', approved_by=?, approved_at=datetime('now'), comment=? WHERE id=?`,
      [req.user.id, comment || null, req.params.id]
    )

    // Deduct from balance
    const year = new Date(request.start_date).getFullYear()
    await db.runAsync(
      `UPDATE leave_balances SET used = used + ?, remaining = remaining - ?
       WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
      [request.days, request.days, request.user_id, request.leave_type_id, year]
    )

    // Mark attendance as on_leave for each day
    const cur = new Date(request.start_date)
    const end = new Date(request.end_date)
    while (cur <= end) {
      const d = cur.toISOString().split('T')[0]
      await db.runAsync(
        `INSERT INTO attendance (user_id, date, status) VALUES (?,?,?)
         ON CONFLICT(user_id, date) DO UPDATE SET status='on_leave'`,
        [request.user_id, d, 'on_leave']
      )
      cur.setDate(cur.getDate() + 1)
    }

    // Audit log
    await db.runAsync(
      `INSERT INTO audit_logs (actor_id,actor_name,action,target_table,target_id,details)
       VALUES (?,?,?,?,?,?)`,
      [req.user.id, req.user.name, 'APPROVED_LEAVE', 'leave_requests', req.params.id,
       `Approved ${request.days} days for user ${request.user_id}`]
    )

    res.json({ message: 'Leave approved' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// PUT /api/leave/:id/reject — HR only
router.put('/:id/reject', auth, requireHR, async (req, res) => {
  try {
    const { comment } = req.body
    const request = await db.getAsync('SELECT * FROM leave_requests WHERE id = ?', [req.params.id])
    if (!request) return res.status(404).json({ message: 'Request not found' })
    if (request.status !== 'pending') return res.status(400).json({ message: 'Request already processed' })

    await db.runAsync(
      `UPDATE leave_requests SET status='rejected', approved_by=?, approved_at=datetime('now'), comment=? WHERE id=?`,
      [req.user.id, comment || null, req.params.id]
    )

    await db.runAsync(
      `INSERT INTO audit_logs (actor_id,actor_name,action,target_table,target_id,details)
       VALUES (?,?,?,?,?,?)`,
      [req.user.id, req.user.name, 'REJECTED_LEAVE', 'leave_requests', req.params.id, `Rejected leave for user ${request.user_id}`]
    )

    res.json({ message: 'Leave rejected' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

module.exports = router
