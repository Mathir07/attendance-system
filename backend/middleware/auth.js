const jwt = require('jsonwebtoken')
const db  = require('../db/database')

const auth = async (req, res, next) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ message: 'No token provided' })

  const token = header.split(' ')[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user    = await db.getAsync('SELECT * FROM users WHERE id = ? AND status = ?', [decoded.id, 'active'])
    if (!user) return res.status(401).json({ message: 'User not found or inactive' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}

const requireHR = (req, res, next) => {
  if (req.user.role !== 'hr' && req.user.role !== 'admin')
    return res.status(403).json({ message: 'HR access required' })
  next()
}

const requireEmployee = (req, res, next) => {
  if (req.user.role !== 'employee')
    return res.status(403).json({ message: 'Employee access required' })
  next()
}

module.exports = { auth, requireHR, requireEmployee }
