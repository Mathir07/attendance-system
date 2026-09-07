const router = require('express').Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const db = require('../db/database')
const { auth, requireHR } = require('../middleware/auth')

// Upload directory
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '../uploads')

// Multer config — only PDFs, per-employee folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(
      UPLOAD_DIR,
      'payslips',
      String(req.params.userId || req.body.user_id || 'temp')
    )

    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },

  filename: (req, file, cb) => {
    const { month, year } = req.body
    cb(null, `payslip-${year}-${String(month).padStart(2, '0')}.pdf`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Only PDF files allowed'))
    }
  }
})

// POST /api/payslip/upload/:userId — HR uploads for an employee
router.post(
  '/upload/:userId',
  auth,
  requireHR,
  upload.single('payslip'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'PDF file required' })
      }

      const { month, year, net_pay } = req.body

      if (!month || !year) {
        return res.status(400).json({
          message: 'Month and year required'
        })
      }

      const employee = await db.getAsync(
        'SELECT id,name FROM users WHERE id = ?',
        [req.params.userId]
      )

      if (!employee) {
        return res.status(404).json({
          message: 'Employee not found'
        })
      }

      const relativePath = path.join(
        'payslips',
        req.params.userId,
        req.file.filename
      )

      await db.runAsync(
        `INSERT INTO payslips
          (user_id, month, year, file_path, net_pay, uploaded_by)
         VALUES (?,?,?,?,?,?)
         ON CONFLICT(user_id,month,year) DO UPDATE SET
           file_path=excluded.file_path,
           net_pay=excluded.net_pay,
           generated_at=datetime('now'),
           uploaded_by=excluded.uploaded_by`,
        [
          req.params.userId,
          month,
          year,
          relativePath,
          net_pay || null,
          req.user.id
        ]
      )

      await db.runAsync(
        `INSERT INTO audit_logs
          (actor_id,actor_name,action,target_table,details)
         VALUES (?,?,?,?,?)`,
        [
          req.user.id,
          req.user.name,
          'UPLOADED_PAYSLIP',
          'payslips',
          `Uploaded ${month}/${year} payslip for ${employee.name}`
        ]
      )

      res.json({
        message: 'Payslip uploaded successfully'
      })
    } catch (err) {
      res.status(500).json({
        message: 'Server error',
        error: err.message
      })
    }
  }
)

// GET /api/payslip/my — employee's own payslips list
router.get('/my', auth, async (req, res) => {
  try {
    const rows = await db.allAsync(
      `SELECT id, month, year, net_pay, generated_at
       FROM payslips
       WHERE user_id = ?
       ORDER BY year DESC, month DESC`,
      [req.user.id]
    )

    res.json(rows)
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    })
  }
})

// GET /api/payslip/download/:id — download own payslip
router.get('/download/:id', auth, async (req, res) => {
  try {
    const slip = await db.getAsync(
      'SELECT * FROM payslips WHERE id = ?',
      [req.params.id]
    )

    if (!slip) {
      return res.status(404).json({
        message: 'Payslip not found'
      })
    }

    // Employees can only download their own; HR can download any
    if (
      req.user.role === 'employee' &&
      slip.user_id !== req.user.id
    ) {
      return res.status(403).json({
        message: 'Access denied'
      })
    }

    const filePath = path.join(UPLOAD_DIR, slip.file_path)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        message: 'File not found on server'
      })
    }

    res.download(
      filePath,
      `payslip-${slip.year}-${String(slip.month).padStart(2, '0')}.pdf`
    )
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    })
  }
})

// GET /api/payslip/employee/:userId — HR gets list for one employee
router.get('/employee/:userId', auth, requireHR, async (req, res) => {
  try {
    const rows = await db.allAsync(
      `SELECT p.*, u.name as employee_name
       FROM payslips p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = ?
       ORDER BY p.year DESC, p.month DESC`,
      [req.params.userId]
    )

    res.json(rows)
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    })
  }
})

module.exports = router