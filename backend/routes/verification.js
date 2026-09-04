/**
 * backend/routes/verification.js
 *
 * Random Verification Checkout feature.
 *
 * Session windows (configurable via HR Settings → Verification Checks):
 *   Session 1: verification_session1_start – verification_session1_end  (default 10:00–13:00)
 *   Session 2: verification_session2_start – verification_session2_end  (default 14:30–18:30)
 *
 * Flow per session:
 *   1. Employee's first check-in in a session window → scheduleVerification() inserts trigger rows
 *   2. GET /poll — called by the employee client every ~30 s. Returns any pending trigger
 *      whose scheduled_time has passed. Side-effect: inserts the auto check-out log and
 *      marks the verification row actual_checkout_time.
 *   3. POST /respond — employee clicks "Check In" in the popup. Records checkin_time,
 *      delay, marks status = 'responded'. Also inserts a normal check_in log.
 *   4. Background: GET /poll also expires pending checks older than grace period →
 *      marks them no_response.
 *
 * HR endpoints:
 *   GET /hr/verifications/:userId/:date     — per-day detail
 *   GET /hr/verifications/:userId/summary   — monthly aggregates
 */

const router = require('express').Router()
const db     = require('../db/database')
const { auth, requireHR }          = require('../middleware/auth')
// All settings + session-window logic lives in the shared helper to avoid
// circular requires with attendance.js
const { getVerificationSettings }  = require('./verificationHelper')

// ── Minimal local helpers (pure functions, no DB) ─────────────────────────────
function hhmmToMins(t) {
  if (!t) return 0
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

// ── Shared: expire grace-period-exceeded pending checks ──────────────────────
async function expireOverdueChecks(userId, date, gracePeriodMinutes) {
  // A check is overdue when: status='pending' AND actual_checkout_time IS NOT NULL
  // AND (now - actual_checkout_time) > grace period
  const pending = await db.allAsync(
    `SELECT id, actual_checkout_time
     FROM verification_checks
     WHERE user_id=? AND date=? AND status='pending' AND actual_checkout_time IS NOT NULL`,
    [userId, date]
  )
  const nowMins = hhmmToMins(new Date().toTimeString().slice(0, 5))
  for (const row of pending) {
    const checkoutMins = hhmmToMins(row.actual_checkout_time)
    const elapsed      = nowMins - checkoutMins
    if (elapsed >= gracePeriodMinutes) {
      await db.runAsync(
        `UPDATE verification_checks SET status='no_response' WHERE id=?`,
        [row.id]
      )
    }
  }
}

// ── Shared: ensure attendance row + log helper (mirrors attendance.js) ────────
async function ensureAttendanceRow(userId, date) {
  let row = await db.getAsync(
    'SELECT * FROM attendance WHERE user_id=? AND date=?',
    [userId, date]
  )
  if (!row) {
    const result = await db.runAsync(
      `INSERT INTO attendance (user_id, date, status, total_working_minutes)
       VALUES (?, ?, 'absent', 0)`,
      [userId, date]
    )
    row = await db.getAsync('SELECT * FROM attendance WHERE id=?', [result.id])
  }
  return row
}

// ── POST /api/verification/schedule ──────────────────────────────────────────
// Thin HTTP wrapper around the shared scheduleVerification() helper.
// Idempotent — safe to call multiple times.
router.post('/schedule', auth, async (req, res) => {
  try {
    const settings = await getVerificationSettings()
    if (!settings.enabled) {
      return res.json({ scheduled: false, reason: 'Verification checks are disabled' })
    }

    const now      = new Date()
    const date     = now.toISOString().split('T')[0]
    const timeHHMM = now.toTimeString().slice(0, 5)
    const nowMins  = hhmmToMins(timeHHMM)

    const window = settings.sessionWindows.find(
      w => nowMins >= w.startMins && nowMins < w.endMins
    )
    if (!window) {
      return res.json({ scheduled: false, reason: 'Not within a session window' })
    }

    const existing = await db.getAsync(
      `SELECT id FROM verification_checks
       WHERE user_id=? AND date=? AND session=?`,
      [req.user.id, date, window.session]
    )
    if (existing) {
      return res.json({ scheduled: false, reason: 'Already scheduled for this session' })
    }

    // Re-use the helper's generateTriggerTimes via scheduleVerification
    const { scheduleVerification } = require('./verificationHelper')
    await scheduleVerification(req.user.id, date, timeHHMM)

    const count = await db.getAsync(
      `SELECT COUNT(*) as n FROM verification_checks
       WHERE user_id=? AND date=? AND session=?`,
      [req.user.id, date, window.session]
    )
    res.json({ scheduled: true, session: window.session, count: count?.n ?? 0 })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ── GET /api/verification/poll ────────────────────────────────────────────────
// Called by the employee client every ~30 s while logged in.
// Returns the earliest pending check whose scheduled_time has been reached,
// triggering the auto checkout side-effect on first detection.
// Also expires any overdue checks for today.
router.get('/poll', auth, async (req, res) => {
  try {
    const now      = new Date()
    const date     = now.toISOString().split('T')[0]
    const timeHHMM = now.toTimeString().slice(0, 5)

    const settings = await getVerificationSettings()

    // ── Master toggle: if HR disabled verifications, never trigger ────────
    if (!settings.enabled) {
      return res.json({ triggered: false })
    }

    // Expire overdue checks first
    await expireOverdueChecks(req.user.id, date, settings.gracePeriodMinutes)

    // Find the earliest pending check whose scheduled_time has passed but
    // actual_checkout_time has NOT been set yet (not yet triggered)
    const due = await db.getAsync(
      `SELECT * FROM verification_checks
       WHERE user_id=? AND date=? AND status='pending' AND actual_checkout_time IS NULL
         AND scheduled_time <= ?
       ORDER BY scheduled_time ASC LIMIT 1`,
      [req.user.id, date, timeHHMM]
    )

    if (!due) {
      return res.json({ triggered: false })
    }

    // ── Side-effect: auto checkout ────────────────────────────────────────
    // Only trigger if the employee is currently checked in
    const lastLog = await db.getAsync(
      `SELECT action FROM attendance_logs
       WHERE user_id=? AND date=?
       ORDER BY timestamp DESC, id DESC LIMIT 1`,
      [req.user.id, date]
    )

    if (!lastLog || lastLog.action !== 'check_in') {
      // Not currently checked in — mark this check as no_response and move on
      await db.runAsync(
        `UPDATE verification_checks SET actual_checkout_time=?, status='no_response' WHERE id=?`,
        [due.scheduled_time, due.id]
      )
      return res.json({ triggered: false })
    }

    // Insert the auto check-out log
    const attendance = await ensureAttendanceRow(req.user.id, date)
    await db.runAsync(
      `INSERT INTO attendance_logs (attendance_id, user_id, date, action, timestamp, source)
       VALUES (?, ?, ?, 'check_out', ?, 'verification')`,
      [attendance.id, req.user.id, date, due.scheduled_time]
    )

    // Recompute totals on attendance row
    const logs = await db.allAsync(
      `SELECT action, timestamp FROM attendance_logs
       WHERE user_id=? AND date=? ORDER BY timestamp ASC, id ASC`,
      [req.user.id, date]
    )
    let total = 0, openIn = null
    for (const l of logs) {
      if (l.action === 'check_in')  { openIn = hhmmToMins(l.timestamp) }
      if (l.action === 'check_out' && openIn !== null) {
        total += Math.max(0, hhmmToMins(l.timestamp) - openIn); openIn = null
      }
    }
    const lastOut = [...logs].reverse().find(l => l.action === 'check_out')?.timestamp

    await db.runAsync(
      `UPDATE attendance SET last_check_out=?, check_out=?, total_working_minutes=? WHERE id=?`,
      [lastOut?.slice(0,5) ?? null, lastOut?.slice(0,5) ?? null, total, attendance.id]
    )

    // Mark verification row with actual checkout time
    await db.runAsync(
      `UPDATE verification_checks SET actual_checkout_time=? WHERE id=?`,
      [due.scheduled_time, due.id]
    )

    res.json({
      triggered:        true,
      verificationId:   due.id,
      session:          due.session,
      scheduledTime:    due.scheduled_time,
      gracePeriodMinutes: settings.gracePeriodMinutes,
    })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ── POST /api/verification/respond ───────────────────────────────────────────
// Employee clicks "Check In" on the verification popup.
// Records response, inserts a check_in log, updates attendance totals.
router.post('/respond', auth, async (req, res) => {
  try {
    const { verificationId } = req.body
    if (!verificationId) return res.status(400).json({ message: 'verificationId required' })

    const check = await db.getAsync(
      `SELECT * FROM verification_checks WHERE id=? AND user_id=?`,
      [verificationId, req.user.id]
    )
    if (!check) return res.status(404).json({ message: 'Verification check not found' })
    if (check.status !== 'pending') {
      return res.status(400).json({ message: `Check already ${check.status}` })
    }
    if (!check.actual_checkout_time) {
      return res.status(400).json({ message: 'Checkout not yet triggered' })
    }

    const now         = new Date()
    const date        = now.toISOString().split('T')[0]
    const checkinTime = now.toTimeString().slice(0, 8)  // HH:MM:SS
    const checkinHHMM = checkinTime.slice(0, 5)

    const checkoutMins = hhmmToMins(check.actual_checkout_time)
    const checkinMins  = hhmmToMins(checkinHHMM)
    const delaySeconds = Math.max(0, (checkinMins - checkoutMins) * 60)

    // Update verification row
    await db.runAsync(
      `UPDATE verification_checks
       SET checkin_time=?, response_delay_seconds=?, status='responded'
       WHERE id=?`,
      [checkinHHMM, delaySeconds, verificationId]
    )

    // Insert check_in log (mirrors attendance.js check-in)
    const attendance = await ensureAttendanceRow(req.user.id, date)

    // Guard: don't double-insert if already checked in
    const lastLog = await db.getAsync(
      `SELECT action FROM attendance_logs
       WHERE user_id=? AND date=?
       ORDER BY timestamp DESC, id DESC LIMIT 1`,
      [req.user.id, date]
    )
    if (lastLog && lastLog.action === 'check_in') {
      // Already checked in somehow — just return the time
      return res.json({
        message: `Already checked in`,
        checkinTime: checkinHHMM,
        responseDelaySeconds: delaySeconds,
      })
    }

    await db.runAsync(
      `INSERT INTO attendance_logs (attendance_id, user_id, date, action, timestamp, source)
       VALUES (?, ?, ?, 'check_in', ?, 'verification')`,
      [attendance.id, req.user.id, date, checkinTime]
    )

    // Recompute totals
    const logs = await db.allAsync(
      `SELECT action, timestamp FROM attendance_logs
       WHERE user_id=? AND date=? ORDER BY timestamp ASC, id ASC`,
      [req.user.id, date]
    )
    let total = 0, openIn = null
    for (const l of logs) {
      if (l.action === 'check_in')  { openIn = hhmmToMins(l.timestamp) }
      if (l.action === 'check_out' && openIn !== null) {
        total += Math.max(0, hhmmToMins(l.timestamp) - openIn); openIn = null
      }
    }

    await db.runAsync(
      `UPDATE attendance SET total_working_minutes=? WHERE id=?`,
      [total, attendance.id]
    )

    res.json({
      message: `Checked back in at ${checkinHHMM}`,
      checkinTime: checkinHHMM,
      responseDelaySeconds: delaySeconds,
    })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ── GET /api/verification/today ───────────────────────────────────────────────
// Returns today's verification checks for the current employee (for the UI
// to know if it needs to show a pending popup after page reload).
router.get('/today', auth, async (req, res) => {
  try {
    const date = new Date().toISOString().split('T')[0]
    const rows = await db.allAsync(
      `SELECT * FROM verification_checks
       WHERE user_id=? AND date=?
       ORDER BY session ASC, scheduled_time ASC`,
      [req.user.id, date]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ── GET /api/verification/hr/:userId/:date ────────────────────────────────────
// Per-day verification checks for HR view.
router.get('/hr/:userId/:date', auth, requireHR, async (req, res) => {
  try {
    const { userId, date } = req.params
    const rows = await db.allAsync(
      `SELECT * FROM verification_checks
       WHERE user_id=? AND date=?
       ORDER BY session ASC, scheduled_time ASC`,
      [userId, date]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ── GET /api/verification/hr/:userId/summary?year=&month= ────────────────────
// Monthly summary: avg response time + no-response count for an employee.
router.get('/hr/:userId/summary', auth, requireHR, async (req, res) => {
  try {
    const { userId }   = req.params
    const year         = req.query.year  || new Date().getFullYear()
    const month        = req.query.month || (new Date().getMonth() + 1)
    const pad          = String(month).padStart(2, '0')

    const rows = await db.allAsync(
      `SELECT status, response_delay_seconds
       FROM verification_checks
       WHERE user_id=? AND date LIKE ?`,
      [userId, `${year}-${pad}-%`]
    )

    const responded   = rows.filter(r => r.status === 'responded')
    const noResponse  = rows.filter(r => r.status === 'no_response')
    const slow        = responded.filter(r => r.response_delay_seconds > 5 * 60)

    const avgDelaySec = responded.length
      ? Math.round(responded.reduce((s, r) => s + r.response_delay_seconds, 0) / responded.length)
      : null

    res.json({
      total:           rows.length,
      respondedCount:  responded.length,
      noResponseCount: noResponse.length,
      slowCount:       slow.length,
      avgDelaySeconds: avgDelaySec,
    })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ── GET /api/verification/hr/grid?year=&month= ───────────────────────────────
// Used by the HR Attendance grid to know which employee/date cells need a badge.
// Returns an array of { user_id, date } pairs that have at least one
// no_response or slow (>5 min) verification event.
router.get('/hr/grid', auth, requireHR, async (req, res) => {
  try {
    const year  = req.query.year  || new Date().getFullYear()
    const month = req.query.month || (new Date().getMonth() + 1)
    const pad   = String(month).padStart(2, '0')

    const rows = await db.allAsync(
      `SELECT user_id, date, status, response_delay_seconds
       FROM verification_checks
       WHERE date LIKE ?`,
      [`${year}-${pad}-%`]
    )

    // Group by user_id+date and flag cells
    const map = {}
    for (const r of rows) {
      const key = `${r.user_id}:${r.date}`
      if (!map[key]) map[key] = { user_id: r.user_id, date: r.date, hasNoResponse: false, hasSlow: false }
      if (r.status === 'no_response') map[key].hasNoResponse = true
      if (r.status === 'responded' && r.response_delay_seconds > 5 * 60) map[key].hasSlow = true
    }

    // Only return cells that actually have a flag
    const flagged = Object.values(map).filter(c => c.hasNoResponse || c.hasSlow)
    res.json(flagged)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

module.exports = router
