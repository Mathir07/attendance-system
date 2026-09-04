/**
 * sw.js — KiwiTrack Verification Service Worker
 *
 * This Service Worker exists for one purpose: handle notification clicks
 * from *outside* the browser (different app, minimised browser, different tab).
 *
 * Why a Service Worker is required:
 *   The Web Notifications API's `Notification.onclick` runs in the page script
 *   context. Browsers (Chrome, Edge) block `window.focus()` from page script
 *   unless it is called synchronously inside a trusted user-gesture handler.
 *   A Service Worker's `notificationclick` event IS a trusted context —
 *   `clients.focus()` and `clients.openWindow()` are explicitly allowed there.
 *
 * Flow:
 *   1. VerificationModal registers this SW on employee login.
 *   2. When a verification triggers, VerificationModal calls
 *      `registration.showNotification(...)` with `data: { type: 'verification', ... }`.
 *   3. User clicks the OS notification (from any app / any tab).
 *   4. This SW catches `notificationclick`, closes the notification, finds our
 *      tab (or opens a new one), focuses it, then posts a message so the React
 *      component shows the in-app popup immediately.
 */

/* ── Keep the SW alive for the notification click ── */
self.addEventListener('install',  () => self.skipWaiting())
self.addEventListener('activate', e  => e.waitUntil(self.clients.claim()))

/* ── Notification click ─────────────────────────────────────────────────── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data   = event.notification.data || {}
  const action = event.action  // 'checkin' | '' (body click)

  if (data.type !== 'verification') return

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      const appClient = windowClients.find(
        (c) => new URL(c.url).origin === self.location.origin
      )

      if (action === 'checkin') {
        // ── "Check In" action button pressed ─────────────────────────────
        // Call the API directly from the SW — no need to focus the tab.
        // The page will see the check disappear on the next poll and close
        // the in-app popup automatically (or the user can close it manually).
        try {
          // Retrieve the auth token stored by the page in localStorage.
          // SW cannot access localStorage directly, so the page must have
          // sent it via postMessage (stored in swTokenRef below).
          // We use the Cache API as a simple SW-accessible key-value store.
          const cache   = await caches.open('kiwitrack-auth')
          const stored  = await cache.match('/__sw_token__')
          const token   = stored ? await stored.text() : null

          if (token && data.verificationId) {
            await fetch('/api/verification/respond', {
              method:  'POST',
              headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ verificationId: data.verificationId }),
            })
          }
        } catch (err) {
          // Fetch failed — fall through and just focus the tab so the user
          // can check in via the normal in-app popup
        }

        // After direct check-in, post a message so the in-app popup closes
        if (appClient) {
          const focused = await appClient.focus()
          focused.postMessage({ type: 'VERIFICATION_CHECKED_IN_FROM_NOTIFICATION' })
        }
        return
      }

      // ── Body of notification clicked (no action) ──────────────────────
      // Focus the tab and show the in-app popup so the user can check in
      if (appClient) {
        const focused = await appClient.focus()
        focused.postMessage({
          type:           'SHOW_VERIFICATION_POPUP',
          verificationId: data.verificationId,
          scheduledTime:  data.scheduledTime,
          session:        data.session,
          gracePeriod:    data.gracePeriod,
        })
        return
      }

      // No existing tab — open a new one; poll will trigger the popup on load
      await self.clients.openWindow('/employee/dashboard')
    })()
  )
})

/* ── Message from page: close any open verification notification ─────────── */
// Called by VerificationModal after the user clicks Check In, so the OS
// notification is dismissed even if the user checked in via the in-app popup.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'DISMISS_VERIFICATION_NOTIFICATION') {
    self.registration.getNotifications({ tag: 'kiwitrack-verification' })
      .then((notifs) => notifs.forEach((n) => n.close()))
  }
})
