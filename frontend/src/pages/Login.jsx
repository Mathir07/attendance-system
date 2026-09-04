import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

// ── Shared left-panel geometric background ────────────────────────────────────
function LeftPanel() {
  return (
    <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative geo-bg"
      style={{ background: 'linear-gradient(135deg, #090B1A 0%, #0D1020 55%, #111426 100%)' }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 600"
          preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <polygon points="0,600 300,0 800,0 800,200"     fill="rgba(245,197,24,0.03)" />
          <polygon points="0,600 500,600 800,300 800,600" fill="rgba(255,255,255,0.02)" />
          <polygon points="200,600 600,0 800,0 800,300 500,600" fill="rgba(255,255,255,0.015)" />
          <line x1="0"   y1="0"   x2="800" y2="600" stroke="rgba(255,255,255,0.04)"  strokeWidth="1"/>
          <line x1="800" y1="0"   x2="0"   y2="600" stroke="rgba(255,255,255,0.04)"  strokeWidth="1"/>
          <line x1="400" y1="0"   x2="400" y2="600" stroke="rgba(255,255,255,0.025)" strokeWidth="1"/>
          <line x1="0"   y1="300" x2="800" y2="300" stroke="rgba(255,255,255,0.025)" strokeWidth="1"/>
          <circle cx="400" cy="300" r="250" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="1"/>
          <circle cx="400" cy="300" r="150" fill="none" stroke="rgba(245,197,24,0.06)"  strokeWidth="1"/>
          <circle cx="400" cy="300" r="60"  fill="none" stroke="rgba(245,197,24,0.08)"  strokeWidth="1"/>
          <polygon points="400,80 680,240 680,440 400,520 120,440 120,240"
            fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1"/>
        </svg>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(245,197,24,0.07) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 flex flex-col justify-between p-12 w-full">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(245,197,24,0.15)', border: '1px solid rgba(245,197,24,0.3)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#F5C518" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">KiwiTrack</span>
        </div>

        {/* Hero */}
        <div className="max-w-md">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(245,197,24,0.12)', border: '1px solid rgba(245,197,24,0.25)', color: '#F5C518' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse" />
            Enterprise HR Platform
          </div>
          <h1 className="text-5xl font-bold text-white leading-tight tracking-tight mb-4">
            Manage your<br />
            <span style={{ color: '#F5C518' }}>workforce</span><br />
            effortlessly.
          </h1>
          <p className="text-base leading-relaxed" style={{ color: '#8A9BB8' }}>
            Track attendance, manage leaves, handle permissions, and process payroll — all in one place.
          </p>
        </div>

        {/* Pills */}
        <div className="flex flex-wrap gap-3">
          {['Attendance Tracking', 'Leave Management', 'Payroll', 'Audit Logs'].map(label => (
            <span key={label} className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: 'rgba(255,255,255,0.07)', color: '#8A9BB8', border: '1px solid rgba(255,255,255,0.1)' }}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Inline error message ──────────────────────────────────────────────────────
function ErrorMsg({ msg }) {
  if (!msg) return null
  return (
    <div className="flex items-start gap-2 mt-2.5">
      <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="currentColor"
        viewBox="0 0 20 20" style={{ color: '#EF4444' }}>
        <path fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd" />
      </svg>
      <p className="text-xs font-medium leading-snug" style={{ color: '#EF4444' }}>{msg}</p>
    </div>
  )
}

// ── Step 1: enter email ───────────────────────────────────────────────────────
function StepEmail({ onSent, onBack }) {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) { setError('Please enter your email address.'); return }
    setLoading(true); setError('')
    try {
      await api.post('/auth/forgot-password', { email: email.trim() })
      onSent(email.trim())
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <>
      <div className="mb-8">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium mb-6 transition-colors hover:opacity-70"
          style={{ color: '#9CA3AF' }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to sign in
        </button>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Forgot password</h2>
        <p className="text-sm text-gray-400 mt-1">
          Enter your work email and we'll send a 6-digit OTP.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="fp-email" className="label">Email address</label>
          <div className="relative">
            <input id="fp-email" type="email" autoComplete="email" autoFocus
              className="input pl-9"
              placeholder="you@company.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              disabled={loading}
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
            </svg>
          </div>
          <ErrorMsg msg={error} />
        </div>

        <button type="submit" disabled={loading}
          className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 shadow-sm"
          style={{ background: loading ? '#D97706' : '#F5C518', color: '#090B1A' }}>
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Sending OTP…
            </>
          ) : 'Send OTP →'}
        </button>
      </form>
    </>
  )
}

// ── Step 2: enter OTP ─────────────────────────────────────────────────────────
const OTP_LENGTH = 6

function StepOTP({ email, onVerified, onBack }) {
  const [digits,    setDigits]    = useState(Array(OTP_LENGTH).fill(''))
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [resending, setResending] = useState(false)
  const [cooldown,  setCooldown]  = useState(0)   // seconds remaining
  const inputRefs  = useRef([])
  const timerRef   = useRef(null)

  // Start 30-second resend cooldown on mount
  useEffect(() => {
    startCooldown()
    return () => clearInterval(timerRef.current)
  }, [])

  function startCooldown() {
    setCooldown(30)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCooldown(c => { if (c <= 1) { clearInterval(timerRef.current); return 0 } return c - 1 })
    }, 1000)
  }

  const otp = digits.join('')

  const handleDigit = (i, val) => {
    const ch = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = ch
    setDigits(next)
    setError('')
    if (ch && i < OTP_LENGTH - 1) inputRefs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus()
    }
    if (e.key === 'ArrowLeft'  && i > 0)              inputRefs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1) inputRefs.current[i + 1]?.focus()
  }

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!text) return
    e.preventDefault()
    const next = Array(OTP_LENGTH).fill('')
    text.split('').forEach((ch, i) => { next[i] = ch })
    setDigits(next)
    inputRefs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus()
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (otp.length < OTP_LENGTH) { setError('Please enter all 6 digits.'); return }
    setLoading(true); setError('')
    try {
      await api.post('/auth/verify-otp', { email, otp })
      onVerified(otp)
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid OTP. Please try again.'
      setError(msg)
      if (err.response?.data?.code === 'OTP_EXPIRED') {
        setDigits(Array(OTP_LENGTH).fill(''))
        inputRefs.current[0]?.focus()
      }
    } finally { setLoading(false) }
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    setResending(true); setError('')
    try {
      await api.post('/auth/forgot-password', { email })
      setDigits(Array(OTP_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
      startCooldown()
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend OTP.')
    } finally { setResending(false) }
  }

  return (
    <>
      <div className="mb-8">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium mb-6 transition-colors hover:opacity-70"
          style={{ color: '#9CA3AF' }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Change email
        </button>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Enter OTP</h2>
        <p className="text-sm text-gray-400 mt-1">
          We sent a 6-digit code to{' '}
          <span className="font-semibold text-gray-600">{email}</span>.
          <br />It expires in 10 minutes.
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-6" noValidate>
        {/* OTP digit boxes */}
        <div>
          <div className="flex gap-2 justify-between" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el }}
                type="text" inputMode="numeric" maxLength={1}
                value={d}
                onChange={e => handleDigit(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                disabled={loading}
                className="w-11 h-12 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all"
                style={{
                  borderColor: error ? '#EF4444' : d ? '#F5C518' : '#E5E7EB',
                  boxShadow:   d && !error ? '0 0 0 3px rgba(245,197,24,0.15)' : 'none',
                  color: '#090B1A',
                  background: '#fff',
                }}
                autoFocus={i === 0}
              />
            ))}
          </div>
          <ErrorMsg msg={error} />
        </div>

        <button type="submit" disabled={loading || otp.length < OTP_LENGTH}
          className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          style={{ background: '#F5C518', color: '#090B1A' }}>
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Verifying…
            </>
          ) : 'Verify OTP →'}
        </button>

        {/* Resend */}
        <p className="text-center text-xs" style={{ color: '#9CA3AF' }}>
          Didn't receive it?{' '}
          {cooldown > 0 ? (
            <span style={{ color: '#D1D5DB' }}>Resend in {cooldown}s</span>
          ) : (
            <button type="button" onClick={handleResend} disabled={resending}
              className="font-semibold transition-colors hover:opacity-70 disabled:opacity-40"
              style={{ color: '#F5C518' }}>
              {resending ? 'Sending…' : 'Resend OTP'}
            </button>
          )}
        </p>
      </form>
    </>
  )
}

// ── Step 3: set new password ──────────────────────────────────────────────────
function StepNewPassword({ email, otp, onDone }) {
  const [pw,       setPw]       = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (pw.length < 6)       { setError('Password must be at least 6 characters.'); return }
    if (pw !== confirm)       { setError('Passwords do not match.'); return }
    setLoading(true); setError('')
    try {
      await api.post('/auth/reset-password', { email, otp, new_password: pw })
      onDone()
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. Please start over.')
    } finally { setLoading(false) }
  }

  const strength = pw.length === 0 ? 0 : pw.length < 6 ? 1 : pw.length < 10 ? 2 : 3
  const strengthLabel = ['', 'Weak', 'Fair', 'Strong']
  const strengthColor = ['', '#EF4444', '#F59E0B', '#059669']

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">New password</h2>
        <p className="text-sm text-gray-400 mt-1">
          Choose a new password for <span className="font-semibold text-gray-600">{email}</span>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* New password */}
        <div>
          <label htmlFor="np-pw" className="label">New password</label>
          <div className="relative">
            <input id="np-pw"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password" autoFocus
              className="input pl-9 pr-10"
              placeholder="Min. 6 characters"
              value={pw}
              onChange={e => { setPw(e.target.value); setError('') }}
              disabled={loading}
              style={error ? { borderColor: '#EF4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.12)' } : {}}
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: error ? '#EF4444' : '#D1D5DB' }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-300 hover:text-gray-500 transition-colors">
              {showPw ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          {/* Strength bar */}
          {pw.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3].map(n => (
                  <div key={n} className="flex-1 h-1 rounded-full transition-all duration-300"
                    style={{ backgroundColor: strength >= n ? strengthColor[strength] : '#E5E7EB' }} />
                ))}
              </div>
              <p className="text-[11px] font-medium" style={{ color: strengthColor[strength] }}>
                {strengthLabel[strength]}
              </p>
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label htmlFor="np-confirm" className="label">Confirm password</label>
          <div className="relative">
            <input id="np-confirm"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              className="input pl-9"
              placeholder="Repeat your password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError('') }}
              disabled={loading}
              style={error ? { borderColor: '#EF4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.12)' } : {}}
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: confirm && confirm === pw ? '#059669' : error ? '#EF4444' : '#D1D5DB' }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <ErrorMsg msg={error} />
        </div>

        <button type="submit" disabled={loading}
          className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          style={{ background: '#F5C518', color: '#090B1A' }}>
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Saving…
            </>
          ) : 'Set new password →'}
        </button>
      </form>
    </>
  )
}

// ── Step 4: success ───────────────────────────────────────────────────────────
function StepSuccess({ onBackToLogin }) {
  return (
    <div className="flex flex-col items-center text-center gap-5 py-6">
      <div className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ backgroundColor: '#ECFDF5', border: '2px solid #6EE7B7' }}>
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Password updated</h2>
        <p className="text-sm text-gray-400 mt-1">
          Your password has been reset successfully.<br />You can now sign in with your new password.
        </p>
      </div>
      <button onClick={onBackToLogin}
        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 shadow-sm"
        style={{ background: '#F5C518', color: '#090B1A' }}>
        Back to sign in →
      </button>
    </div>
  )
}

// ── Main Login page ───────────────────────────────────────────────────────────
// `view` drives which panel shows on the right:
//   'login' | 'fp-email' | 'fp-otp' | 'fp-newpw' | 'fp-done'
export default function Login() {
  const { login, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [view,     setView]     = useState('login')
  const [fpEmail,  setFpEmail]  = useState('')   // carries email across FP steps
  const [fpOtp,    setFpOtp]    = useState('')   // carries verified OTP to step 3

  // Login form state
  const [form,    setForm]    = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [showPw,  setShowPw]  = useState(false)
  const [errorMsg, setErrorMsgState] = useState(
    () => sessionStorage.getItem('login_error') || ''
  )

  const setErrorMsg = (msg) => {
    if (msg) sessionStorage.setItem('login_error', msg)
    else     sessionStorage.removeItem('login_error')
    setErrorMsgState(msg)
  }

  useEffect(() => {
    if (!authLoading && user) {
      sessionStorage.removeItem('login_error')
      navigate(user.role === 'employee' ? '/employee/dashboard' : '/hr/dashboard', { replace: true })
    }
  }, [user, authLoading, navigate])

  const handleChange = (e) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) { setErrorMsg('Please enter your email and password.'); return }
    setLoading(true); setErrorMsg('')
    try {
      const u = await login(form.email.trim(), form.password)
      sessionStorage.removeItem('login_error')
      navigate(u.role === 'employee' ? '/employee/dashboard' : '/hr/dashboard', { replace: true })
    } catch (err) {
      const msg = err.response?.data?.message || "Email or password doesn't match. Please check your credentials."
      setErrorMsg(msg)
    } finally { setLoading(false) }
  }

  // ── Right-panel content based on view ──────────────────────────────────────
  const renderRight = () => {
    // Forgot-password flow
    if (view === 'fp-email') {
      return (
        <StepEmail
          onSent={(email) => { setFpEmail(email); setView('fp-otp') }}
          onBack={() => setView('login')}
        />
      )
    }
    if (view === 'fp-otp') {
      return (
        <StepOTP
          email={fpEmail}
          onVerified={(otp) => { setFpOtp(otp); setView('fp-newpw') }}
          onBack={() => setView('fp-email')}
        />
      )
    }
    if (view === 'fp-newpw') {
      return (
        <StepNewPassword
          email={fpEmail}
          otp={fpOtp}
          onDone={() => setView('fp-done')}
        />
      )
    }
    if (view === 'fp-done') {
      return (
        <StepSuccess onBackToLogin={() => {
          setView('login'); setFpEmail(''); setFpOtp('')
        }} />
      )
    }

    // Default: login form
    return (
      <>
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome back</h2>
          <p className="text-sm text-gray-400 mt-1">Sign in to your account to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Email */}
          <div>
            <label htmlFor="email" className="label">Email address</label>
            <div className="relative">
              <input id="email" name="email" type="email"
                autoComplete="email" autoFocus
                className="input pl-9"
                placeholder="you@company.com"
                value={form.email}
                onChange={handleChange}
                disabled={loading}
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="label mb-0">Password</label>
              <button
                type="button"
                onClick={() => { setErrorMsg(''); setView('fp-email') }}
                className="text-xs font-medium transition-colors hover:opacity-70"
                style={{ color: '#F5C518' }}
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input id="password" name="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                className="input pl-9 pr-10"
                style={errorMsg
                  ? { borderColor: '#EF4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.12)' }
                  : {}}
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                disabled={loading}
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: errorMsg ? '#EF4444' : '#D1D5DB' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-300 hover:text-gray-500 transition-colors">
                {showPw ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <ErrorMsg msg={errorMsg} />
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 mt-2 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
            style={{ background: loading ? '#D97706' : '#F5C518', color: '#090B1A' }}>
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Signing in…
              </>
            ) : 'Sign in →'}
          </button>
        </form>

        {/* Demo credentials */}
        <div className="mt-8 p-4 rounded-xl border border-gray-100 bg-surface-50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Demo Credentials
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">HR Admin</span>
              <code className="text-xs text-navy-800 bg-white px-2 py-1 rounded border border-gray-100">
                hr@company.com / hr123456
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Employee</span>
              <code className="text-xs text-navy-800 bg-white px-2 py-1 rounded border border-gray-100">
                arun@company.com / emp123456
              </code>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-300 mt-6">
          © 2026 KiwiTrack. Enterprise Edition.
        </p>
      </>
    )
  }

  return (
    <div className="min-h-screen flex">
      <LeftPanel />

      {/* Right panel */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">

          {/* Mobile logo — only on login view to avoid cluttering FP steps */}
          {view === 'login' && (
            <div className="flex items-center gap-2 mb-10 lg:hidden">
              <div className="w-8 h-8 rounded-lg bg-navy-900 flex items-center justify-center">
                <svg className="w-4 h-4 text-accent-500" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="font-bold text-navy-900 tracking-tight">KiwiTrack</span>
            </div>
          )}

          {renderRight()}
        </div>
      </div>
    </div>
  )
}
