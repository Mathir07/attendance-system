const router = require('express').Router()
const db     = require('../db/database')
const { auth, requireHR } = require('../middleware/auth')

const MONTHLY_CAP = 4 // max permissions per month

// POST /api/permission/apply
router.post('/apply', auth, async (req, res) => {
  try {
    const { date, from_time, to_time, reason } = req.body
    if (!date || !from_time || !to_time || !reason)
      return res.status(400).json({ message: 'All fields required' })

    // Calculate hours
    const [fh, fm] = from_time.split(':').map(Number)
    const [th, tm] = to_time.split(':').map(Number)
    const hours    = ((th * 60 + tm) - (fh * 60 + fm)) / 60
    if (hours <= 0) return res.status(400).json({ message: 'to_time must be after from_time' })

    // Check monthly cap
    const month    = date.substring(0, 7) // YYYY-MM
    const count    = await db.getAsync(
      `SELECT COUNT(*) as c FROM permission_requests
       WHERE user_id = ? AND date LIKE ? AND status != 'rejected'`,
      [req.user.id, `${month}%`]
    )
    if (count.c >= MONTHLY_CAP)
      return res.status(400).json({ message: `Monthly permission limit (${MONTHLY_CAP}) reached` })

    const result = await db.runAsync(
      `INSERT INTO permission_requests (user_id,date,from_time,to_time,hours,reason)
       VALUES (?,?,?,?,?,?)`,
      [req.user.id, date, from_time, to_time, hours.toFixed(2), reason]
    )

    res.status(201).json({ message: 'Permission request submitted', id: result.id, hours })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// GET /api/permission/my
router.get('/my', auth, async (req, res) => {
  try {
    const rows = await db.allAsync(
      `SELECT pr.*, u.name as approved_by_name
       FROM permission_requests pr
       LEFT JOIN users u ON u.id = pr.approved_by
       WHERE pr.user_id = ?
       ORDER BY pr.created_at DESC`,
      [req.user.id]
    )

    // Monthly count
    const month = new Date().toISOString().substring(0, 7)
    const used  = await db.getAsync(
      `SELECT COUNT(*) as c FROM permission_requests
       WHERE user_id = ? AND date LIKE ? AND status != 'rejected'`,
      [req.user.id, `${month}%`]
    )

    res.json({ requests: rows, monthly_used: used.c, monthly_cap: MONTHLY_CAP })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// GET /api/permission/all — HR only
router.get('/all', auth, requireHR, async (req, res) => {
  try {
    const status = req.query.status || 'pending'
    const rows   = await db.allAsync(
      `SELECT pr.*, u.name as employee_name, u.employee_id, u.department,
              ab.name as approved_by_name
       FROM permission_requests pr
       JOIN users u ON u.id = pr.user_id
       LEFT JOIN users ab ON ab.id = pr.approved_by
       WHERE pr.status = ?
       ORDER BY pr.created_at DESC`,
      [status]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// PUT /api/permission/:id/approve — HR only
router.put('/:id/approve', auth, requireHR, async (req, res) => {
  try {
    const { comment } = req.body
    const request = await db.getAsync('SELECT * FROM permission_requests WHERE id = ?', [req.params.id])
    if (!request) return res.status(404).json({ message: 'Not found' })
    if (request.status !== 'pending') return res.status(400).json({ message: 'Already processed' })

    await db.runAsync(
      `UPDATE permission_requests SET status='approved', approved_by=?, approved_at=datetime('now'), comment=? WHERE id=?`,
      [req.user.id, comment || null, req.params.id]
    )

    await db.runAsync(
      `INSERT INTO audit_logs (actor_id,actor_name,action,target_table,target_id,details)
       VALUES (?,?,?,?,?,?)`,
      [req.user.id, req.user.name, 'APPROVED_PERMISSION', 'permission_requests', req.params.id,
       `Approved ${request.hours}h permission for user ${request.user_id}`]
    )

    res.json({ message: 'Permission approved' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// PUT /api/permission/:id/reject — HR only
router.put('/:id/reject', auth, requireHR, async (req, res) => {
  try {
    const { comment } = req.body
    const request = await db.getAsync('SELECT * FROM permission_requests WHERE id = ?', [req.params.id])
    if (!request) return res.status(404).json({ message: 'Not found' })
    if (request.status !== 'pending') return res.status(400).json({ message: 'Already processed' })

    await db.runAsync(
      `UPDATE permission_requests SET status='rejected', approved_by=?, approved_at=datetime('now'), comment=? WHERE id=?`,
      [req.user.id, comment || null, req.params.id]
    )

    await db.runAsync(
      `INSERT INTO audit_logs (actor_id,actor_name,action,target_table,target_id,details)
       VALUES (?,?,?,?,?,?)`,
      [req.user.id, req.user.name, 'REJECTED_PERMISSION', 'permission_requests', req.params.id, `Rejected permission for user ${request.user_id}`]
    )

    res.json({ message: 'Permission rejected' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

module.exports = router
