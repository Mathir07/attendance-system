import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import LoadingSpinner from '../../components/LoadingSpinner'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'

// ── Shared helpers (mirrors HR Settings style) ────────────────────────────────
function SectionTitle({ children }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest mb-4"
      style={{ color: 'var(--text-muted)' }}>
      {children}
    </p>
  )
}

function SettingRow({ label, hint, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 py-4"
      style={{ borderBottom: '1px solid var(--border-light)' }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
        {hint && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
      </div>
      <div className="sm:w-64 flex-shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ value, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={!!value}
      onClick={() => onChange(!value)}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0"
      style={{ backgroundColor: value ? '#F5C518' : 'var(--border)' }}>
      <span className="sr-only">{label}</span>
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200
        ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'profile',       label: 'Profile' },
  { id: 'account',       label: 'Account & Security' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'appearance',    label: 'Appearance' },
  { id: 'mydata',        label: 'My Data' },
  { id: 'policy',        label: 'Attendance Policy' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Profile
// ═══════════════════════════════════════════════════════════════════════════════
function TabProfile() {
  const { updateUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [form,    setForm]    = useState({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    api.get('/settings/employee/profile')
      .then(r => {
        setProfile(r.data)
        setForm({
          phone:                   r.data.phone || '',
          personal_email:          r.data.personal_email || '',
          address:                 r.data.address || '',
          emergency_contact_name:  r.data.emergency_contact_name || '',
          emergency_contact_phone: r.data.emergency_contact_phone || '',
        })
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.put('/settings/employee/profile', form)
      updateUser({ phone: res.data.user.phone })
      toast.success('Profile saved')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="py-8 flex justify-center"><LoadingSpinner /></div>

  const f = (key) => ({
    value: form[key],
    onChange: e => setForm(p => ({ ...p, [key]: e.target.value }))
  })

  return (
    <div className="space-y-6">
      {/* Avatar + name hero */}
      <div className="flex items-center gap-4 p-4 rounded-xl"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
          style={{ background: 'rgba(245,197,24,0.15)', color: '#F5C518', border: '2px solid rgba(245,197,24,0.3)' }}>
          {profile?.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{profile?.name}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {profile?.employee_id && `${profile.employee_id} · `}
            {profile?.designation || profile?.department || 'Employee'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Editable fields */}
        <div>
          <SectionTitle>Contact Information</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Phone number</label>
              <input type="tel" className="input" placeholder="9876543210" {...f('phone')} />
            </div>
            <div>
              <label className="label">Personal email</label>
              <input type="email" className="input" placeholder="personal@email.com" {...f('personal_email')} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Address</label>
              <textarea className="input" rows={2} placeholder="Your home address" {...f('address')} />
            </div>
          </div>
        </div>

        <div>
          <SectionTitle>Emergency Contact</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Contact name</label>
              <input type="text" className="input" placeholder="Full name" {...f('emergency_contact_name')} />
            </div>
            <div>
              <label className="label">Contact phone</label>
              <input type="tel" className="input" placeholder="9876543210" {...f('emergency_contact_phone')} />
            </div>
          </div>
        </div>

        {/* Read-only fields */}
        <div>
          <SectionTitle>Work Information (read-only)</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ['Employee ID',   profile?.employee_id  || '–'],
              ['Department',    profile?.department   || '–'],
              ['Designation',   profile?.designation  || '–'],
              ['Manager',       profile?.manager_name || '–'],
              ['Date of Joining', profile?.join_date
                ? new Date(profile.join_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                : '–'],
              ['Work Email',    profile?.email],
            ].map(([label, val]) => (
              <div key={label}>
                <label className="label">{label}</label>
                <div className="input text-sm opacity-60 cursor-not-allowed"
                  style={{ backgroundColor: 'var(--bg-surface)' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Account & Security
// ═══════════════════════════════════════════════════════════════════════════════
function TabAccount() {
  const [pwForm,    setPwForm]    = useState({ current_password: '', new_password: '', confirm: '' })
  const [pwSaving,  setPwSaving]  = useState(false)
  const [showPw,    setShowPw]    = useState(false)
  const [history,   setHistory]   = useState([])
  const [hLoading,  setHLoading]  = useState(true)

  useEffect(() => {
    api.get('/settings/employee/login-history')
      .then(r => setHistory(r.data))
      .catch(() => {})
      .finally(() => setHLoading(false))
  }, [])

  const handleChangePw = async (e) => {
    e.preventDefault()
    if (pwForm.new_password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (pwForm.new_password !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    setPwSaving(true)
    try {
      await api.post('/auth/change-password', {
        current_password: pwForm.current_password,
        new_password:     pwForm.new_password,
      })
      toast.success('Password changed successfully')
      setPwForm({ current_password: '', new_password: '', confirm: '' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Change failed')
    } finally { setPwSaving(false) }
  }

  const strength = pwForm.new_password.length === 0 ? 0
    : pwForm.new_password.length < 6 ? 1
    : pwForm.new_password.length < 10 ? 2 : 3
  const strengthColors = ['', '#EF4444', '#F59E0B', '#059669']
  const strengthLabels = ['', 'Weak', 'Fair', 'Strong']

  return (
    <div className="space-y-8">
      {/* Change password */}
      <div>
        <SectionTitle>Change Password</SectionTitle>
        <form onSubmit={handleChangePw} className="space-y-4 max-w-sm">
          {[
            ['current_password', 'Current password'],
            ['new_password',     'New password'],
            ['confirm',          'Confirm new password'],
          ].map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                type={showPw ? 'text' : 'password'}
                className="input"
                value={pwForm[key]}
                onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                required
              />
              {key === 'new_password' && pwForm.new_password.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3].map(n => (
                      <div key={n} className="flex-1 h-1 rounded-full transition-all"
                        style={{ backgroundColor: strength >= n ? strengthColors[strength] : 'var(--border)' }} />
                    ))}
                  </div>
                  <p className="text-[11px] font-medium"
                    style={{ color: strengthColors[strength] }}>{strengthLabels[strength]}</p>
                </div>
              )}
            </div>
          ))}
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none"
            style={{ color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={showPw} onChange={e => setShowPw(e.target.checked)} />
            Show passwords
          </label>
          <button type="submit" disabled={pwSaving} className="btn-primary">
            {pwSaving ? 'Saving…' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Login history */}
      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '24px' }}>
        <SectionTitle>Login History (last 20)</SectionTitle>
        {hLoading ? <LoadingSpinner /> : history.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No login history yet.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Date & Time</th><th>IP Address</th><th>Device / Browser</th></tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td className="text-xs">{new Date(h.created_at).toLocaleString('en-IN')}</td>
                    <td className="text-xs font-mono">{h.ip_address || '–'}</td>
                    <td className="text-xs max-w-xs truncate" title={h.user_agent}
                      style={{ color: 'var(--text-muted)' }}>
                      {h.user_agent ? h.user_agent.slice(0, 60) + (h.user_agent.length > 60 ? '…' : '') : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Notifications
// ═══════════════════════════════════════════════════════════════════════════════
function TabNotifications() {
  const [prefs,   setPrefs]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    api.get('/settings/employee/notifications')
      .then(r => setPrefs(r.data))
      .catch(() => toast.error('Failed to load preferences'))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (key) => setPrefs(p => ({ ...p, [key]: p[key] ? 0 : 1 }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put('/settings/employee/notifications', prefs)
      toast.success('Preferences saved')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally { setSaving(false) }
  }

  if (loading || !prefs) return <div className="py-8 flex justify-center"><LoadingSpinner /></div>

  const items = [
    { key: 'leave_status_updates',      label: 'Leave request status updates',
      hint: 'Email when your leave is approved or rejected' },
    { key: 'permission_status_updates', label: 'Permission request status updates',
      hint: 'Email when your permission request is approved or rejected' },
    { key: 'payslip_available',         label: 'Payslip available',
      hint: 'Email when a new payslip is uploaded for you' },
    { key: 'verification_reminders',    label: 'Verification check reminders',
      hint: 'In-app alerts for upcoming verification windows' },
    { key: 'notification_sound',        label: 'Notification sound',
      hint: 'Play a sound for in-app notifications' },
  ]

  return (
    <div>
      <SectionTitle>Email & In-App Preferences</SectionTitle>
      {items.map(item => (
        <SettingRow key={item.key} label={item.label} hint={item.hint}>
          <Toggle value={!!prefs[item.key]} onChange={() => toggle(item.key)} label={item.label} />
        </SettingRow>
      ))}
      <div className="pt-4 flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Appearance
// ═══════════════════════════════════════════════════════════════════════════════
function TabAppearance() {
  const { dark, toggle } = useTheme()

  const options = [
    { id: 'light', label: 'Light',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      )
    },
    { id: 'dark',  label: 'Dark',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )
    },
  ]

  return (
    <div>
      <SectionTitle>Theme</SectionTitle>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
        Choose how KiwiTrack looks for you. Your preference is saved in this browser.
      </p>

      <div className="flex gap-3">
        {options.map(opt => {
          const active = (opt.id === 'dark') === dark
          return (
            <button key={opt.id} type="button"
              onClick={() => { if ((opt.id === 'dark') !== dark) toggle() }}
              className="flex flex-col items-center gap-2 px-6 py-4 rounded-xl transition-all"
              style={active
                ? { background: 'rgba(245,197,24,0.12)', border: '2px solid #F5C518', color: '#F5C518' }
                : { background: 'var(--bg-surface)', border: '2px solid var(--border)', color: 'var(--text-muted)' }}>
              {opt.icon}
              <span className="text-xs font-semibold">{opt.label}</span>
              {active && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#F5C518', color: '#090B1A' }}>Active</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: My Data
// ═══════════════════════════════════════════════════════════════════════════════
function TabMyData() {
  const now   = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [balances,  setBalances]  = useState([])
  const [permUsage, setPermUsage] = useState(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/settings/employee/leave-balances'),
      api.get('/settings/employee/permission-usage'),
    ]).then(([b, p]) => {
      setBalances(b.data)
      setPermUsage(p.data)
    }).catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  const downloadReport = () => {
    const token = localStorage.getItem('token')
    // Trigger a direct download via anchor
    const a = document.createElement('a')
    a.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/settings/employee/attendance-report?year=${year}&month=${month}`
    // Attach token via query param for simple download (server should accept it)
    a.href += `&token=${token}`
    a.download = `attendance-${year}-${String(month).padStart(2,'0')}.csv`
    a.click()
  }

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  if (loading) return <div className="py-8 flex justify-center"><LoadingSpinner /></div>

  return (
    <div className="space-y-8">
      {/* Leave balances */}
      <div>
        <SectionTitle>Leave Balances — {now.getFullYear()}</SectionTitle>
        {balances.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No leave balances found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {balances.map(b => {
              const pct = b.allocated > 0 ? Math.round((b.remaining / b.allocated) * 100) : 0
              return (
                <div key={b.id} className="rounded-xl p-4 space-y-2"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{b.name}</p>
                    <span className={`badge ${b.is_paid ? 'badge-green' : 'badge-gray'}`}>
                      {b.is_paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        {b.remaining}
                      </span>
                      <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                        / {b.allocated} days remaining
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {b.used} used
                    </p>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill"
                      style={{ width: `${pct}%`, backgroundColor: pct > 50 ? '#059669' : pct > 20 ? '#F59E0B' : '#DC2626' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Permission usage */}
      {permUsage && (
        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '24px' }}>
          <SectionTitle>Permission Usage — This Month</SectionTitle>
          <div className="flex items-center gap-4 p-4 rounded-xl"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
            <div className="text-center">
              <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{permUsage.used_count}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>used</p>
            </div>
            <div className="text-2xl" style={{ color: 'var(--border)' }}>/</div>
            <div className="text-center">
              <p className="text-3xl font-bold" style={{ color: '#059669' }}>{permUsage.max_per_month}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>allowed</p>
            </div>
            <div className="flex-1 ml-4">
              <div className="progress-track">
                <div className="progress-fill"
                  style={{
                    width: `${permUsage.max_per_month > 0
                      ? Math.min(100, Math.round((permUsage.used_count / permUsage.max_per_month) * 100))
                      : 0}%`,
                    backgroundColor: permUsage.remaining > 0 ? '#F5C518' : '#DC2626'
                  }} />
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {permUsage.remaining} permission{permUsage.remaining !== 1 ? 's' : ''} remaining this month
              </p>
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            View all your permission requests on the{' '}
            <Link to="/employee/permission" className="font-semibold hover:underline"
              style={{ color: '#F5C518' }}>Permissions page →</Link>
          </p>
        </div>
      )}

      {/* Download attendance report */}
      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '24px' }}>
        <SectionTitle>Download Attendance Report</SectionTitle>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Download your personal attendance as a CSV for any month.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Month</label>
            <select className="input w-28" value={month} onChange={e => setMonth(+e.target.value)}>
              {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select className="input w-24" value={year} onChange={e => setYear(+e.target.value)}>
              {[now.getFullYear() - 1, now.getFullYear()].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button onClick={downloadReport} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download CSV
          </button>
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
          View full attendance calendar on the{' '}
          <Link to="/employee/attendance" className="font-semibold hover:underline"
            style={{ color: '#F5C518' }}>Attendance page →</Link>
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Attendance Policy
// ═══════════════════════════════════════════════════════════════════════════════
function TabPolicy() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/settings/employee/policy')
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load policy'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-8 flex justify-center"><LoadingSpinner /></div>

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(245,197,24,0.12)', border: '1px solid rgba(245,197,24,0.25)' }}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#F5C518" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Attendance & Verification Policy
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {data?.company_name || 'KiwiTrack'} — Data collection notice
          </p>
        </div>
      </div>

      <div className="rounded-xl p-5 space-y-3"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
        {data?.policy_text ? (
          data.policy_text.split('\n').filter(Boolean).map((para, i) => (
            <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {para}
            </p>
          ))
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No policy text has been set by HR yet.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 text-xs p-3 rounded-xl"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
        <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          This policy is set by your HR administrator. If you have questions, contact your HR team.
        </span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN Employee Settings page
// ═══════════════════════════════════════════════════════════════════════════════
export default function EmployeeSettings() {
  const [activeTab, setActiveTab] = useState('profile')

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your profile, security, notifications, and preferences.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap p-1 rounded-xl"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150"
            style={activeTab === tab.id
              ? { backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-card)' }
              : { backgroundColor: 'transparent', color: 'var(--text-muted)' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="card">
        {activeTab === 'profile'       && <TabProfile />}
        {activeTab === 'account'       && <TabAccount />}
        {activeTab === 'notifications' && <TabNotifications />}
        {activeTab === 'appearance'    && <TabAppearance />}
        {activeTab === 'mydata'        && <TabMyData />}
        {activeTab === 'policy'        && <TabPolicy />}
      </div>
    </div>
  )
}
