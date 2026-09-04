const router = require('express').Router()
const db     = require('../db/database')
const { auth } = require('../middleware/auth')

// ── Settings helper ───────────────────────────────────────────────────────────
// Reads all rows from company_settings and returns a plain object.
// Falls back to hardcoded defaults if the table is empty / row is missing.
const SETTING_DEFAULTS = {
  work_start_time:        '09:30',
  late_threshold_time:    '10:00',
  half_day_threshold_time:'12:30',
  work_end_time:          '18:30',
  lunch_start_time:       '13:00',
  lunch_end_time:         '14:00',
  min_full_day_minutes:   '270',
}

async function getSettings() {
  try {
    const rows = await db.allAsync('SELECT key, value FROM company_settings')
    const map  = { ...SETTING_DEFAULTS }
    rows.forEach(r => { map[r.key] = r.value })
    return map
  } catch {
    return { ...SETTING_DEFAULTS }
  }
}

// Convert "HH:MM" string to total minutes since midnight
function toMins(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Format "HH:MM:SS" or "HH:MM" to "HH:MM" (strip seconds)
function hhmm(t) {
  if (!t) return null
  return t.slice(0, 5)
}

// ── Compute status from first check-in time ───────────────────────────────────
function computeStatus(firstCheckInTime, settings) {
  const mins       = toMins(hhmm(firstCheckInTime))
  const lateMin    = toMins(settings.late_threshold_time)
  const halfDayMin = toMins(settings.half_day_threshold_time)

  if (mins < lateMin)    return 'present'
  if (mins < halfDayMin) return 'late'
  return 'half_day'
}

// ── Recompute total_working_minutes from all log pairs for a day ──────────────
// Pairs up check_in→check_out in chronological order and sums intervals.
function computeWorkingMinutes(logs) {
  let total  = 0
  let openIn = null
  for (const log of logs) {
    if (log.action === 'check_in') {
      openIn = toMins(hhmm(log.timestamp))
    } else if (log.action === 'check_out' && openIn !== null) {
      total += Math.max(0, toMins(hhmm(log.timestamp)) - openIn)
      openIn = null
    }
  }
  return total
}

// ── Ensure an attendance row exists for today ─────────────────────────────────
async function ensureAttendanceRow(userId, date) {
  let row = await db.getAsync(
    'SELECT * FROM attendance WHERE user_id = ? AND date = ?',
    [userId, date]
  )
  if (!row) {
    const result = await db.runAsync(
      `INSERT INTO attendance (user_id, date, status, total_working_minutes)
       VALUES (?, ?, 'absent', 0)`,
      [userId, date]
    )
    row = await db.getAsync('SELECT * FROM attendance WHERE id = ?', [result.id])
  }
  return row
}

// ── POST /api/attendance/check-in ─────────────────────────────────────────────
router.post('/check-in', auth, async (req, res) => {
  try {
    const now    = new Date()
    const date   = now.toISOString().split('T')[0]
    const time   = now.toTimeString().slice(0, 8)   // HH:MM:SS server time

    // Validate: reject if already checked in (last log = check_in with no following check_out)
    const lastLog = await db.getAsync(
      `SELECT action FROM attendance_logs
       WHERE user_id = ? AND date = ?
       ORDER BY timestamp DESC, id DESC LIMIT 1`,
      [req.user.id, date]
    )
    if (lastLog && lastLog.action === 'check_in') {
      return res.status(400).json({ message: 'Already checked in. Please check out first.' })
    }

    const settings   = await getSettings()
    const attendance = await ensureAttendanceRow(req.user.id, date)

    // Insert log
    await db.runAsync(
      `INSERT INTO attendance_logs (attendance_id, user_id, date, action, timestamp)
       VALUES (?, ?, ?, 'check_in', ?)`,
      [attendance.id, req.user.id, date, time]
    )

    // Recompute all logs for the day
    const logs = await db.allAsync(
      `SELECT action, timestamp FROM attendance_logs
       WHERE user_id = ? AND date = ? ORDER BY timestamp ASC, id ASC`,
      [req.user.id, date]
    )

    const firstCheckIn     = logs.find(l => l.action === 'check_in')?.timestamp || time
    const totalMins        = computeWorkingMinutes(logs)

    // Only override status if it's not a special status (on_leave / holiday / weekend)
    const specialStatuses  = ['on_leave', 'holiday', 'weekend']
    let   newStatus        = attendance.status
    if (!specialStatuses.includes(attendance.status)) {
      newStatus = computeStatus(firstCheckIn, settings)
    }

    await db.runAsync(
      `UPDATE attendance
       SET first_check_in = ?, check_in = ?, total_working_minutes = ?, status = ?
       WHERE id = ?`,
      [hhmm(firstCheckIn), hhmm(firstCheckIn), totalMins, newStatus, attendance.id]
    )

    // ── Schedule verification triggers for this session (fire-and-forget) ──
    // Imported lazily to avoid circular-require issues
    try {
      const { scheduleVerification } = require('./verificationHelper')
      scheduleVerification(req.user.id, date, hhmm(time))
    } catch { /* never block check-in on this */ }

    res.json({
      message: 'Checked in successfully',
      time: hhmm(time),
      status: newStatus,
      date,
    })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ── POST /api/attendance/check-out ────────────────────────────────────────────
router.post('/check-out', auth, async (req, res) => {
  try {
    const now  = new Date()
    const date = now.toISOString().split('T')[0]
    const time = now.toTimeString().slice(0, 8)

    // Validate: must have an open check-in
    const lastLog = await db.getAsync(
      `SELECT action FROM attendance_logs
       WHERE user_id = ? AND date = ?
       ORDER BY timestamp DESC, id DESC LIMIT 1`,
      [req.user.id, date]
    )
    if (!lastLog || lastLog.action !== 'check_in') {
      return res.status(400).json({ message: 'You are not currently checked in.' })
    }

    const attendance = await db.getAsync(
      'SELECT * FROM attendance WHERE user_id = ? AND date = ?',
      [req.user.id, date]
    )
    if (!attendance) {
      return res.status(400).json({ message: 'No attendance record for today.' })
    }

    // Insert check_out log
    await db.runAsync(
      `INSERT INTO attendance_logs (attendance_id, user_id, date, action, timestamp)
       VALUES (?, ?, ?, 'check_out', ?)`,
      [attendance.id, req.user.id, date, time]
    )

    // Recompute totals
    const logs = await db.allAsync(
      `SELECT action, timestamp FROM attendance_logs
       WHERE user_id = ? AND date = ? ORDER BY timestamp ASC, id ASC`,
      [req.user.id, date]
    )

    const totalMins    = computeWorkingMinutes(logs)
    const lastCheckOut = [...logs].reverse().find(l => l.action === 'check_out')?.timestamp || time

    // Re-evaluate status based on total worked time
    const settings = await getSettings()
    const minFullDay = parseInt(settings.min_full_day_minutes, 10)
    const specialStatuses = ['on_leave', 'holiday', 'weekend']
    let newStatus = attendance.status

    if (!specialStatuses.includes(attendance.status)) {
      // If total minutes < minFullDay but status was present/late, downgrade to half_day
      if (totalMins < minFullDay && ['present', 'late'].includes(attendance.status)) {
        newStatus = 'half_day'
      }
      // Restore if they've now worked enough
      if (totalMins >= minFullDay && attendance.status === 'half_day') {
        // Re-derive from first check-in
        const firstCI = logs.find(l => l.action === 'check_in')?.timestamp
        newStatus = firstCI ? computeStatus(firstCI, settings) : 'present'
      }
    }

    await db.runAsync(
      `UPDATE attendance
       SET last_check_out = ?, check_out = ?, total_working_minutes = ?, status = ?
       WHERE id = ?`,
      [hhmm(lastCheckOut), hhmm(lastCheckOut), totalMins, newStatus, attendance.id]
    )

    res.json({
      message: 'Checked out successfully',
      time: hhmm(time),
      status: newStatus,
      total_working_minutes: totalMins,
      worked_hours: (totalMins / 60).toFixed(2),
      date,
    })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ── GET /api/attendance/today ─────────────────────────────────────────────────
// Returns attendance row + today's log entries + last action
router.get('/today', auth, async (req, res) => {
  try {
    const date   = new Date().toISOString().split('T')[0]
    const record = await db.getAsync(
      'SELECT * FROM attendance WHERE user_id = ? AND date = ?',
      [req.user.id, date]
    )

    const logs = record ? await db.allAsync(
      `SELECT id, action, timestamp FROM attendance_logs
       WHERE user_id = ? AND date = ? ORDER BY timestamp ASC, id ASC`,
      [req.user.id, date]
    ) : []

    const lastLog = logs.length ? logs[logs.length - 1] : null

    res.json({
      ...(record || { user_id: req.user.id, date, status: 'absent', total_working_minutes: 0 }),
      logs,
      last_action: lastLog?.action || null,
    })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ── GET /api/attendance/my?month=&year= ───────────────────────────────────────
router.get('/my', auth, async (req, res) => {
  try {
    const year  = req.query.year  || new Date().getFullYear()
    const month = req.query.month || (new Date().getMonth() + 1)
    const pad   = String(month).padStart(2, '0')

    const rows = await db.allAsync(
      `SELECT a.*,
              (SELECT GROUP_CONCAT(timestamp, ',')
               FROM attendance_logs WHERE attendance_id = a.id AND action = 'check_in'
               ORDER BY timestamp) AS check_in_times,
              (SELECT GROUP_CONCAT(timestamp, ',')
               FROM attendance_logs WHERE attendance_id = a.id AND action = 'check_out'
               ORDER BY timestamp) AS check_out_times
       FROM attendance a
       WHERE a.user_id = ? AND a.date LIKE ?`,
      [req.user.id, `${year}-${pad}-%`]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ── GET /api/attendance/summary ───────────────────────────────────────────────
router.get('/summary', auth, async (req, res) => {
  try {
    const year  = parseInt(req.query.year  || new Date().getFullYear(),  10)
    const month = parseInt(req.query.month || (new Date().getMonth() + 1), 10)
    const pad   = String(month).padStart(2, '0')

    const rows = await db.allAsync(
      `SELECT status, COUNT(*) as count FROM attendance
       WHERE user_id = ? AND date LIKE ?
       GROUP BY status`,
      [req.user.id, `${year}-${pad}-%`]
    )

    const recorded = { present: 0, absent: 0, late: 0, half_day: 0, on_leave: 0, holiday: 0, weekend: 0 }
    rows.forEach(r => { if (recorded[r.status] !== undefined) recorded[r.status] = r.count })

    const today   = new Date()
    const lastDay = (year === today.getFullYear() && month === today.getMonth() + 1)
      ? today.getDate()
      : new Date(year, month, 0).getDate()

    const holidayRows = await db.allAsync(
      `SELECT date FROM holidays WHERE date LIKE ?`, [`${year}-${pad}-%`]
    )
    const holidaySet = new Set(holidayRows.map(h => h.date))

    let workingDaysPassed = 0
    for (let d = 1; d <= lastDay; d++) {
      const dateStr   = `${year}-${pad}-${String(d).padStart(2, '0')}`
      const dow       = new Date(year, month - 1, d).getDay()
      const isWeekend = dow === 0 || dow === 6
      if (!isWeekend && !holidaySet.has(dateStr)) workingDaysPassed++
    }

    const accountedDays =
      recorded.present + recorded.late + recorded.half_day + recorded.on_leave + recorded.absent
    const totalAbsent = recorded.absent + Math.max(0, workingDaysPassed - accountedDays)

    res.json({
      present:  recorded.present,
      absent:   totalAbsent,
      late:     recorded.late,
      half_day: recorded.half_day,
      on_leave: recorded.on_leave,
    })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

// ── Legacy route aliases (keep old clock-in/clock-out URLs working) ───────────
router.post('/clock-in',  (req, res, next) => { req.url = '/check-in';  next('router') })
router.post('/clock-out', (req, res, next) => { req.url = '/check-out'; next('router') })

module.exports = router
