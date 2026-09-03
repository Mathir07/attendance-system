const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const crypto  = require('crypto')
const db      = require('../db/database')
const { auth } = require('../middleware/auth')

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

module.exports = router
