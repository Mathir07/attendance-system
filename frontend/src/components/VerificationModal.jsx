/**
 * VerificationModal.jsx
 *
 * Global verification-checkout popup. Mount ONCE at app root (App.jsx).
 *
 * ── How out-of-app alerting works ────────────────────────────────────────────
 *
 *  The browser blocks window.focus() from page scripts. The ONLY reliable way
 *  to focus a tab from an OS notification click (when the user is in another
 *  app, another tab, or has the browser minimised) is through a Service Worker:
 *
 *    1. We register /sw.js on employee login.
 *    2. When a verification fires we call registration.showNotification() — this
 *       is a SW-managed notification, not a plain `new Notification()`.
 *    3. User clicks the OS toast → SW's `notificationclick` fires (trusted context)
 *       → SW calls clients.focus() (always works) + postMessage to the tab.
 *    4. The tab receives the message and shows the in-app popup immediately.
 *    5. When the user clicks Check In we tell the SW to dismiss the OS notification
 *       so it doesn't linger.
 *
 * ── Fallback chain ────────────────────────────────────────────────────────────
 *  SW available + permission granted  → SW notification  (full cross-app focus)
 *  SW unavailable + permission granted → plain Notification() (best-effort focus)
 *  permission denied                  → in-app popup only (works if tab is open)
 *
 * ── What is unchanged ────────────────────────────────────────────────────────
 *  Popup UI, Check In button, API calls (/poll, /respond), confirm screen,
 *  timer/no-response logic, styles — all identical to the previous version.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

// ── Constants ─────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 30_000
const CONFIRM_CLOSE_MS = 2_000
const NOTIF_TITLE      = 'Attendance Verification Needed'
const NOTIF_BODY       = 'Click to check in and resume your session'
const NOTIF_TAG        = 'kiwitrack-verification'
const SW_PATH          = '/sw.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt12(t) {
  if (!t) return '–'
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour   = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

// ── Notification sound ────────────────────────────────────────────────────────
// Preload the WAV file once so it plays instantly with no delay when triggered.
const _notifAudio = new Audio('/notification.wav')
_notifAudio.preload = 'auto'

function playNotificationBeep() {
  return new Promise((resolve) => {
    try {
      // Reset to start in case it's still playing from a previous trigger
      _notifAudio.currentTime = 0
      _notifAudio.volume = 1.0
      const p = _notifAudio.play()
      if (p) p.then(resolve).catch(resolve)  // resolve even if autoplay is blocked
      else resolve()
    } catch {
      resolve()
    }
  })
}

// ── Service Worker registration ───────────────────────────────────────────────

/**
 * Register the SW and wait until it is fully active.
 * Returns the ServiceWorkerRegistration or null on failure.
 *
 * Key detail: after register() the SW goes installing → waiting → active.
 * We must wait for the active state before calling showNotification(),
 * otherwise Chrome throws "Registration failed or SW not active".
 */
async function getSwRegistration() {
  if (!('serviceWorker' in navigator)) return null
  try {
    let reg = await navigator.serviceWorker.getRegistration('/')
    if (!reg) {
      reg = await navigator.serviceWorker.register(SW_PATH, { scope: '/' })
    }

    // If already active, return immediately
    if (reg.active) return reg

    // Wait for the SW to become active (installing/waiting → active)
    return new Promise((resolve) => {
      const sw = reg.installing || reg.waiting
      if (!sw) { resolve(reg.active ? reg : null); return }

      sw.addEventListener('statechange', function handler() {
        if (sw.state === 'activated') {
          sw.removeEventListener('statechange', handler)
          resolve(reg)
        }
        if (sw.state === 'redundant') {
          sw.removeEventListener('statechange', handler)
          resolve(null)
        }
      })
    })
  } catch (err) {
    console.warn('[VerificationModal] SW registration failed:', err.message)
    return null
  }
}

// ── Notification permission ───────────────────────────────────────────────────

async function requestNotificationPermission() {
  if (!('Notification' in window)) return

  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission()
    if (result === 'denied') {
      toast(
        'Browser notifications blocked. Enable them in site settings to receive out-of-app alerts.',
        { duration: 6000, icon: '🔔' }
      )
    }
  } else if (Notification.permission === 'denied') {
    const key = 'notif-denied-hint-shown'
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, '1')
      toast(
        'Browser notifications are blocked. Enable them in site settings to get out-of-app alerts.',
        { duration: 7000, icon: '🔔' }
      )
    }
  }
}

// ── Send OS notification ──────────────────────────────────────────────────────

/**
 * Fire an OS notification via SW (preferred) or plain Notification() fallback.
 *
 * Always fires regardless of whether the tab is focused — the user may switch
 * away immediately after the trigger, and the OS toast needs to already be there.
 * Chrome/Windows will show the toast in the notification center even if the
 * browser is in the foreground; the user can act on it whenever they see it.
 */
async function sendOsNotification(swReg, notifData) {
  if (Notification.permission !== 'granted') return

  const options = {
    body:               NOTIF_BODY,
    tag:                NOTIF_TAG,
    icon:               '/favicon.svg',
    requireInteraction: true,
    // Action buttons shown directly on the OS notification
    actions: [
      { action: 'checkin', title: '✅ Check In' },
    ],
    data: {
      type:           'verification',
      verificationId: notifData.verificationId,
      scheduledTime:  notifData.scheduledTime,
      session:        notifData.session,
      gracePeriod:    notifData.gracePeriod,
    },
  }

  if (swReg?.active) {
    // Preferred: SW-managed — notificationclick can focus the tab cross-app
    try {
      await swReg.showNotification(NOTIF_TITLE, options)
      console.log('[KiwiTrack] SW notification sent ✓')
      return
    } catch (err) {
      console.warn('[KiwiTrack] SW showNotification failed:', err.message)
    }
  } else {
    console.warn('[KiwiTrack] SW not active — using fallback Notification(). swReg:', swReg)
  }

  // Fallback: plain Notification API (window.focus may be blocked cross-app
  // but the OS toast still appears and the in-app popup is already showing)
  try {
    const notif = new Notification(NOTIF_TITLE, options)
    notif.onclick = () => { window.focus(); notif.close() }
    console.log('[KiwiTrack] Fallback Notification sent ✓')
  } catch (err) {
    console.warn('[KiwiTrack] Notification() failed:', err.message)
  }
}

// ── Send auth token to SW (needed for direct Check In from notification) ─────
// Service Workers cannot read localStorage, so we cache the JWT in the Cache
// API where the SW can retrieve it during the notificationclick handler.
async function syncTokenToSw() {
  if (!('caches' in window)) return
  try {
    const token = localStorage.getItem('token')
    if (!token) return
    const cache = await caches.open('kiwitrack-auth')
    await cache.put('/__sw_token__', new Response(token, {
      headers: { 'Content-Type': 'text/plain' },
    }))
  } catch { /* best effort */ }
}

async function clearSwToken() {
  if (!('caches' in window)) return
  try {
    const cache = await caches.open('kiwitrack-auth')
    await cache.delete('/__sw_token__')
  } catch { /* best effort */ }
}

/** Ask the SW to dismiss the OS notification (called after user checks in). */
async function dismissSwNotification() {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_PATH)
    if (reg?.active) {
      reg.active.postMessage({ type: 'DISMISS_VERIFICATION_NOTIFICATION' })
    }
  } catch { /* best effort */ }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════
export default function VerificationModal() {
  const { user } = useAuth()

  // phase: null → hidden | 'pending' → popup | 'confirm' → success
  const [phase,          setPhase]          = useState(null)
  const [verificationId, setVerificationId] = useState(null)
  const [triggeredTime,  setTriggeredTime]  = useState(null)
  const [session,        setSession]        = useState(null)
  const [gracePeriod,    setGracePeriod]    = useState(5)
  const [checkedInTime,  setCheckedInTime]  = useState(null)
  const [responding,     setResponding]     = useState(false)

  const pollRef      = useRef(null)
  const confirmTimer = useRef(null)
  const activeRef    = useRef(false)
  const swRegRef     = useRef(null)   // holds the SW registration once ready
  // Called when SW checks in directly from the notification action button
  const checkedInFromNotifRef = useRef(() => {})

  const isEmployee = user?.role === 'employee'

  // ── Register Service Worker & listen for messages ─────────────────────────
  useEffect(() => {
    if (!isEmployee) return

    // Set up the message listener FIRST, before the async registration,
    // so no messages are missed during the registration await.
    const messageHandler = (event) => {
      if (event.data?.type === 'SHOW_VERIFICATION_POPUP') {
        const d = event.data
        showPopupRef.current({
          verificationId:     d.verificationId,
          scheduledTime:      d.scheduledTime,
          session:            d.session,
          gracePeriodMinutes: d.gracePeriod,
        })
      }
      // SW performed a direct Check In via the notification action button —
      // show the confirm screen briefly then close, without calling the API again
      if (event.data?.type === 'VERIFICATION_CHECKED_IN_FROM_NOTIFICATION') {
        checkedInFromNotifRef.current()
      }
    }
    navigator.serviceWorker?.addEventListener('message', messageHandler)

    // Register the SW asynchronously — store the registration for showNotification()
    getSwRegistration().then((reg) => {
      swRegRef.current = reg
      if (reg) {
        console.log('[KiwiTrack] Service Worker active:', reg.active?.scriptURL)
        // Share the auth token so the SW can call the API from the notification action
        syncTokenToSw()
      } else {
        console.warn('[KiwiTrack] Service Worker not available — OS notifications will use fallback')
      }
    })

    return () => {
      navigator.serviceWorker?.removeEventListener('message', messageHandler)
    }
  }, [isEmployee]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Notification permission ────────────────────────────────────────────────
  useEffect(() => {
    if (isEmployee) {
      requestNotificationPermission()
      // Keep the cached token fresh whenever the employee is logged in
      syncTokenToSw()
    } else {
      // Employee logged out — clear the cached token from the SW cache
      clearSwToken()
    }
  }, [isEmployee])

  // ── Pre-warm audio on first user gesture ─────────────────────────────────
  // Browsers block audio autoplay until the user interacts with the page.
  // We silently play + immediately pause on first gesture to unlock autoplay,
  // so the sound fires instantly when the verification triggers later.
  useEffect(() => {
    if (!isEmployee) return
    const unlock = () => {
      _notifAudio.play().then(() => _notifAudio.pause()).catch(() => {})
      // Only need to unlock once
      window.removeEventListener('click',      unlock)
      window.removeEventListener('keydown',    unlock)
      window.removeEventListener('touchstart', unlock)
    }
    window.addEventListener('click',      unlock, { passive: true })
    window.addEventListener('keydown',    unlock, { passive: true })
    window.addEventListener('touchstart', unlock, { passive: true })
    return () => {
      window.removeEventListener('click',      unlock)
      window.removeEventListener('keydown',    unlock)
      window.removeEventListener('touchstart', unlock)
    }
  }, [isEmployee])

  // ── Reset helper ───────────────────────────────────────────────────────────
  const resetAll = useCallback(() => {
    clearTimeout(confirmTimer.current)
    setPhase(null)
    setResponding(false)
    setVerificationId(null)
    setTriggeredTime(null)
    setCheckedInTime(null)
    activeRef.current = false
  }, [])

  // ── Handle direct check-in from SW notification action button ─────────────
  // Keep the ref up-to-date so the one-time SW message handler (above) always
  // calls the latest version that has the current resetAll and state setters.
  useEffect(() => {
    checkedInFromNotifRef.current = () => {
      const now = new Date().toTimeString().slice(0, 5)
      activeRef.current = true
      setCheckedInTime(now)
      setPhase('confirm')
      confirmTimer.current = setTimeout(resetAll, CONFIRM_CLOSE_MS)
    }
  }, [resetAll])

  // ── Show popup ─────────────────────────────────────────────────────────────
  const showPopup = useCallback((data) => {
    if (activeRef.current) return   // dedup guard
    activeRef.current = true

    setVerificationId(data.verificationId)
    setTriggeredTime(data.scheduledTime)
    setSession(data.session)
    setGracePeriod(data.gracePeriodMinutes ?? 5)
    setPhase('pending')

    // Sound
    playNotificationBeep()

    // OS notification (only when user is away from this tab)
    sendOsNotification(swRegRef.current, {
      verificationId: data.verificationId,
      scheduledTime:  data.scheduledTime,
      session:        data.session,
      gracePeriod:    data.gracePeriodMinutes ?? 5,
    })
  }, [])

  // Keep a stable ref so the SW message handler (set up in a one-time effect)
  // always calls the latest version of showPopup without needing to re-register.
  const showPopupRef = useRef(showPopup)
  useEffect(() => { showPopupRef.current = showPopup }, [showPopup])

  // ── Poll ───────────────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    if (activeRef.current) return
    try {
      const res = await api.get('/verification/poll')
      if (res.data.triggered) showPopup(res.data)
    } catch { /* swallow silently */ }
  }, [showPopup])

  // Start/stop interval on login/logout
  useEffect(() => {
    if (!isEmployee) {
      clearInterval(pollRef.current)
      return
    }
    poll()
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      clearInterval(pollRef.current)
      clearTimeout(confirmTimer.current)
    }
  }, [isEmployee, poll])

  // ── Immediate poll on tab focus / visibility restore ──────────────────────
  // visibilitychange  → different tab, minimised browser
  // window focus      → returned from a different application
  useEffect(() => {
    if (!isEmployee) return
    const onVisible = () => { if (!document.hidden) poll() }
    const onFocus   = () => poll()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [isEmployee, poll])

  // ── Check-in handler ───────────────────────────────────────────────────────
  const handleCheckIn = async () => {
    if (responding) return
    setResponding(true)
    try {
      const res = await api.post('/verification/respond', { verificationId })
      setCheckedInTime(res.data.checkinTime)
      setPhase('confirm')
      setResponding(false)
      // Dismiss the OS notification now that the user has responded
      dismissSwNotification()
      confirmTimer.current = setTimeout(resetAll, CONFIRM_CLOSE_MS)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not check in. Please try again.')
      setResponding(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (phase === null) return null

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 99999 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: 'rgba(9,11,26,0.82)' }}
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
      >
        {/* ── Pending ── */}
        {phase === 'pending' && (
          <>
            <div
              className="px-6 py-4 flex items-center gap-3"
              style={{
                borderBottom: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: 'rgba(245,197,24,0.12)',
                  border: '1px solid rgba(245,197,24,0.25)',
                }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24"
                  stroke="#F5C518" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight"
                  style={{ color: 'var(--text-primary)' }}>
                  Verification Check-out
                </h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Session {session} · {fmt12(triggeredTime)}
                </p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Please verify you're active — you were automatically checked out at{' '}
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {fmt12(triggeredTime)}
                </span>
                . Click{' '}
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Check In
                </span>{' '}
                to resume your session.
              </p>

              <div
                className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-xs"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-muted)',
                }}
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  style={{ color: 'var(--text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  Respond within{' '}
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {gracePeriod} minute{gracePeriod !== 1 ? 's' : ''}
                  </span>
                  {' '}or this check will be marked as no response.
                </span>
              </div>

              <button
                onClick={handleCheckIn}
                disabled={responding}
                className="w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: responding ? 'var(--bg-surface)' : '#ECFDF5',
                  color: '#059669',
                  border: '1px solid #6EE7B7',
                }}
              >
                {responding ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Checking in…
                  </span>
                ) : '↑ Check In'}
              </button>
            </div>
          </>
        )}

        {/* ── Confirm ── */}
        {phase === 'confirm' && (
          <div className="px-6 py-8 flex flex-col items-center gap-4 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#ECFDF5', border: '1px solid #6EE7B7' }}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24"
                stroke="#059669" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                Checked back in at {fmt12(checkedInTime)}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Closing automatically…
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
