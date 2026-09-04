/**
 * verificationHelper.js
 *
 * Shared scheduling logic called from attendance check-in.
 * Kept in a separate file to avoid circular require between
 * attendance.js and verification.js.
 *
 * ── What changed ─────────────────────────────────────────────────────────────
 *  • Session windows are now read from company_settings (keys:
 *    verification_session1_start / _end, verification_session2_start / _end)
 *    instead of being hardcoded. The old hardcoded values are the fallback
 *    defaults so existing installs that haven't run migrate_v5 still work.
 *  • getSessionWindows() is an async helper that reads the DB once per call.
 *  • scheduleVerification() now also checks verification_enabled and skips
 *    scheduling if it is '0'.
 */

const db = require('../db/database')

// ── Hardcoded fallbacks (used if DB rows are missing) ─────────────────────────
const DEFAULT_WINDOWS = [
  { session: 1, start: '10:00', end: '13:00' },
  { session: 2, start: '14:30', end: '18:30' },
]

const SETTING_DEFAULTS = {
  verification_enabled:                '1',
  verification_checks_per_session:     '2',
  verification_min_gap_minutes:        '30',
  verification_grace_period_minutes:   '5',
  verification_exclude_start_minutes:  '15',
  verification_exclude_end_minutes:    '15',
  verification_session1_start:         '10:00',
  verification_session1_end:           '13:00',
  verification_session2_start:         '14:30',
  verification_session2_end:           '18:30',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function hhmmToMins(t) {
  if (!t) return 0
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function minsToHHMM(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

/**
 * Load all verification-related settings from DB.
 * Returns a plain object with both numeric settings AND the session window
 * definitions as { session, startMins, endMins } array.
 */
async function getVerificationSettings() {
  try {
    const rows = await db.allAsync('SELECT key, value FROM company_settings')
    const map  = { ...SETTING_DEFAULTS }
    rows.forEach(r => { map[r.key] = r.value })

    const sessionWindows = [
      {
        session:    1,
        startMins:  hhmmToMins(map.verification_session1_start),
        endMins:    hhmmToMins(map.verification_session1_end),
      },
      {
        session:    2,
        startMins:  hhmmToMins(map.verification_session2_start),
        endMins:    hhmmToMins(map.verification_session2_end),
      },
    ]

    return {
      enabled:            map.verification_enabled === '1',
      checksPerSession:   parseInt(map.verification_checks_per_session,    10),
      minGapMinutes:      parseInt(map.verification_min_gap_minutes,       10),
      gracePeriodMinutes: parseInt(map.verification_grace_period_minutes,  10),
      excludeStart:       parseInt(map.verification_exclude_start_minutes, 10),
      excludeEnd:         parseInt(map.verification_exclude_end_minutes,   10),
      sessionWindows,
    }
  } catch {
    return {
      enabled:            true,
      checksPerSession:   2,
      minGapMinutes:      30,
      gracePeriodMinutes: 5,
      excludeStart:       15,
      excludeEnd:         15,
      sessionWindows: DEFAULT_WINDOWS.map(w => ({
        session:   w.session,
        startMins: hhmmToMins(w.start),
        endMins:   hhmmToMins(w.end),
      })),
    }
  }
}

/**
 * generateTriggerTimes(window, settings, userId, dateStr, sessionNum)
 *
 * Generates N random trigger times within the usable portion of the window
 * (after excludeStart buffer, before excludeEnd buffer) with a minimum gap
 * of minGapMinutes between any two, using a deterministic per-employee seed.
 */
function generateTriggerTimes(window, settings, userId, dateStr, sessionNum) {
  const { checksPerSession, minGapMinutes, excludeStart, excludeEnd } = settings

  const lo = window.startMins + excludeStart
  const hi = window.endMins   - excludeEnd

  // Guard: window too narrow to fit checks with the required gap
  if (hi <= lo) {
    // Completely degenerate window — place a single check at the midpoint
    return [minsToHHMM(Math.floor((window.startMins + window.endMins) / 2))]
  }

  if (hi - lo < minGapMinutes * (checksPerSession - 1)) {
    // Window is usable but too narrow for the gap constraint — use evenly spaced
    const slots = checksPerSession + 1
    const step  = Math.floor((hi - lo) / slots)
    return Array.from({ length: checksPerSession }, (_, i) => minsToHHMM(lo + step * (i + 1)))
  }

  // Deterministic seed unique per employee/date/session
  const seedStr = `${userId}-${dateStr}-${sessionNum}`
  let   seedNum = 0
  for (let i = 0; i < seedStr.length; i++) {
    seedNum = (Math.imul(31, seedNum) + seedStr.charCodeAt(i)) | 0
  }
  const rand = mulberry32(Math.abs(seedNum))

  const times    = []
  let   attempts = 0
  while (times.length < checksPerSession && attempts < 1000) {
    attempts++
    const candidate = lo + Math.floor(rand() * (hi - lo + 1))
    const tooClose  = times.some(t => Math.abs(t - candidate) < minGapMinutes)
    if (!tooClose) times.push(candidate)
  }

  return times.sort((a, b) => a - b).map(minsToHHMM)
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * scheduleVerification(userId, date, currentTimeHHMM)
 *
 * Called on every employee check-in (from attendance.js).
 * Reads the current session windows from DB, finds which window the check-in
 * falls into, and inserts trigger rows if not already scheduled.
 * Idempotent — safe to call on every check-in.
 *
 * Silently skips if:
 *  • verification_enabled = '0'
 *  • check-in time doesn't fall inside any session window
 *  • triggers already exist for this session today
 */
async function scheduleVerification(userId, date, currentTimeHHMM) {
  const settings = await getVerificationSettings()

  // Master toggle
  if (!settings.enabled) return

  const nowMins = hhmmToMins(currentTimeHHMM)
  const window  = settings.sessionWindows.find(
    w => nowMins >= w.startMins && nowMins < w.endMins
  )
  if (!window) return  // check-in is outside any configured session window

  // Idempotent: already scheduled for this session today
  const existing = await db.getAsync(
    `SELECT id FROM verification_checks WHERE user_id=? AND date=? AND session=?`,
    [userId, date, window.session]
  )
  if (existing) return

  const times = generateTriggerTimes(window, settings, userId, date, window.session)

  for (const t of times) {
    await db.runAsync(
      `INSERT INTO verification_checks (user_id, date, session, scheduled_time, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [userId, date, window.session, t]
    )
  }
}

module.exports = { scheduleVerification, getVerificationSettings }
