/**
 * fmt12 — converts a 24-hr "HH:MM" or "HH:MM:SS" string to 12-hr "H:MM AM/PM"
 * Returns '–' for null / undefined / empty values.
 */
export function fmt12(timeStr) {
  if (!timeStr) return '–'
  const [hStr, mStr] = timeStr.split(':')
  let h = parseInt(hStr, 10)
  const m   = mStr || '00'
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12          // convert 0 → 12, 13 → 1, etc.
  return `${h}:${m} ${ampm}`
}
