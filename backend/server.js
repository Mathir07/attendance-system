require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')

const app = express()

// Production-configurable settings
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads')

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Static — payslip downloads
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)))

// Routes
app.use('/api/auth', require('./routes/auth'))
app.use('/api/attendance', require('./routes/attendance'))
app.use('/api/verification', require('./routes/verification'))
app.use('/api/leave', require('./routes/leave'))
app.use('/api/permission', require('./routes/permission'))
app.use('/api/payslip', require('./routes/payslip'))
app.use('/api/hr', require('./routes/hr'))
app.use('/api/settings', require('./routes/settings'))

// Health
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Attendance System API'
  })
})

// 404
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found'
  })
})

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    message: err.message || 'Internal server error'
  })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`\n🚀 Attendance System API running on http://localhost:${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/health\n`)
})