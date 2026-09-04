const router   = require('express').Router()
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const crypto   = require('crypto')
const nodemailer = require('nodemailer')
const db       = require('../db/database')
const { auth } = require('../middleware/auth')

// ── Email transporter (lazy-initialised so missing SMTP config only breaks
//    forgot-password, not the rest of the app) ─────────────────────────────
function getTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,  // STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

const OTP_EXPIRY_MINUTES = 10

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required' })

    const user = await db.getAsync('SELECT * FROM users WHERE email = ?', [email.toLowerCase()])
    if (!user)
      return res.status(401).json({ message: 'Email address not found. Please check your email.', code: 'EMAIL_NOT_FOUND' })

    if (user.status === 'inactive')
      return res.status(403).json({ message: 'Account deactivated. Contact HR.' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid)
      return res.status(401).json({ message: 'Incorrect password. Please try again.', code: 'WRONG_PASSWORD' })

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    )

    const { password_hash, reset_token, reset_expires, ...safeUser } = user
    res.json({ token, user: safeUser })

    // Record login history (fire-and-forget — never block login on this)
    try {
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
                 || req.socket?.remoteAddress || 'unknown'
      const ua = req.headers['user-agent'] || 'unknown'
      db.runAsync(
        `INSERT INTO login_history (user_id, ip_address, user_agent) VALUES (?,?,?)`,
        [user.id, ip, ua]
      ).catch(() => {})
    } catch { /* ignore */ }
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  const { password_hash, reset_token, reset_expires, ...safeUser } = req.user
  res.json(safeUser)
})

// POST /api/auth/change-password
router.post('/change-password', auth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body
    if (!current_password || !new_password)
      return res.status(400).json({ message: 'Both passwords required' })
    if (new_password.length < 6)
      return res.status(400).json({ message: 'New password must be at least 6 characters' })

    const user = await db.getAsync('SELECT * FROM users WHERE id = ?', [req.user.id])
    const valid = await bcrypt.compare(current_password, user.password_hash)
    if (!valid)
      return res.status(401).json({ message: 'Current password incorrect' })

    const hash = await bcrypt.hash(new_password, 10)
    await db.runAsync('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id])
    res.json({ message: 'Password updated successfully' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
// Step 1: receive email → generate 6-digit OTP → email it
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: 'Email is required' })

    const user = await db.getAsync(
      'SELECT id, name, email, status FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    )

    // Always respond with 200 to avoid leaking whether an email exists
    if (!user || user.status === 'inactive') {
      return res.json({ message: 'If that email is registered, an OTP has been sent.' })
    }

    // Generate 6-digit numeric OTP
    const otp     = String(Math.floor(100000 + Math.random() * 900000))
    const expires = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000  // ms timestamp

    // Store hashed OTP (never store plain OTP in DB)
    const otpHash = await bcrypt.hash(otp, 10)
    await db.runAsync(
      'UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?',
      [otpHash, expires, user.id]
    )

    // Send email
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@kiwitrack.app'
    const transporter = getTransporter()
    await transporter.sendMail({
      from,
      to:      user.email,
      subject: 'KiwiTrack — Password Reset OTP',
      text: [
        `Hi ${user.name},`,
        ``,
        `Your KiwiTrack password reset OTP is:`,
        ``,
        `  ${otp}`,
        ``,
        `This code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
        `If you did not request a password reset, you can safely ignore this email.`,
        ``,
        `— KiwiTrack`,
      ].join('\n'),
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px">
          <div style="margin-bottom:24px">
            <span style="font-size:20px;font-weight:700;color:#090B1A;letter-spacing:-0.5px">
              KiwiTrack
            </span>
          </div>
          <h2 style="font-size:18px;font-weight:700;color:#090B1A;margin:0 0 8px">
            Password Reset OTP
          </h2>
          <p style="color:#6B7280;font-size:14px;margin:0 0 24px">
            Hi ${user.name}, use the code below to reset your password.
            It expires in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.
          </p>
          <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;
                      padding:24px;text-align:center;margin-bottom:24px">
            <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#090B1A">
              ${otp}
            </span>
          </div>
          <p style="color:#9CA3AF;font-size:12px;margin:0">
            If you didn't request this, you can safely ignore this email.
            Your password will not change.
          </p>
        </div>
      `,
    })

    res.json({ message: 'If that email is registered, an OTP has been sent.' })
  } catch (err) {
    console.error('forgot-password error:', err.message)
    res.status(500).json({ message: 'Failed to send OTP. Please check SMTP configuration.', error: err.message })
  }
})

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────
// Step 2 (optional validate-only call): check OTP without resetting — lets the
// frontend confirm the code is correct before asking for the new password.
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP required' })

    const user = await db.getAsync(
      'SELECT id, reset_token, reset_expires FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    )
    if (!user || !user.reset_token || !user.reset_expires) {
      return res.status(400).json({ message: 'No OTP requested for this email.' })
    }
    if (Date.now() > user.reset_expires) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.', code: 'OTP_EXPIRED' })
    }
    const valid = await bcrypt.compare(otp.trim(), user.reset_token)
    if (!valid) {
      return res.status(400).json({ message: 'Incorrect OTP. Please try again.', code: 'OTP_INVALID' })
    }

    res.json({ message: 'OTP verified.' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ── POST /api/auth/reset-password ────────────────────────────────────────────
// Step 3: verify OTP + set new password in one atomic call
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, new_password } = req.body
    if (!email || !otp || !new_password)
      return res.status(400).json({ message: 'Email, OTP and new password are required' })
    if (new_password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' })

    const user = await db.getAsync(
      'SELECT id, reset_token, reset_expires FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    )
    if (!user || !user.reset_token || !user.reset_expires) {
      return res.status(400).json({ message: 'No OTP requested for this email.' })
    }
    if (Date.now() > user.reset_expires) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.', code: 'OTP_EXPIRED' })
    }
    const valid = await bcrypt.compare(otp.trim(), user.reset_token)
    if (!valid) {
      return res.status(400).json({ message: 'Incorrect OTP. Please try again.', code: 'OTP_INVALID' })
    }

    // Hash and save new password, clear the OTP
    const hash = await bcrypt.hash(new_password, 10)
    await db.runAsync(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
      [hash, user.id]
    )

    res.json({ message: 'Password reset successfully. You can now log in.' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

module.exports = router
