import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import { useAuth } from '../../context/AuthContext'

// ── Shared helpers ────────────────────────────────────────────────────────────
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
      <div className="sm:w-72 flex-shrink-0">{children}</div>
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

function SaveBar({ saving, onSave, dirty }) {
  if (!dirty) return null
  return (
    <div className="sticky bottom-0 z-10 -mx-6 px-6 py-3 flex items-center justify-between"
      style={{ backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border-light)' }}>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>You have unsaved changes.</p>
      <button onClick={onSave} disabled={saving} className="btn-primary btn-sm px-5 py-1.5">
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )
}

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'attendance',    label: 'Attendance Rules' },
  { id: 'verification',  label: 'Verification Checks' },
  { id: 'leave',         label: 'Leave & Permissions' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'company',       label: 'Company Profile' },
  { id: 'account',       label: 'Account & Security' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Attendance Rules
// ═══════════════════════════════════════════════════════════════════════════════
function TabAttendance({ settings, onChange }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weekend = (settings.weekend_days || '0,6').split(',').map(Number)

  const toggleDay = (d) => {
    const next = weekend.includes(d) ? weekend.filter(x => x !== d) : [...weekend, d]
    onChange('weekend_days', next.sort().join(','))
  }

  return (
    <div>
      <SectionTitle>Work Schedule</SectionTitle>

      <SettingRow label="Work start time" hint="Used as the baseline for on-time check-ins">
        <input type="time" className="input"
          value={settings.work_start_time || '09:30'}
          onChange={e => onChange('work_start_time', e.target.value)} />
      </SettingRow>

      <SettingRow label="Work end time">
        <input type="time" className="input"
          value={settings.work_end_time || '18:30'}
          onChange={e => onChange('work_end_time', e.target.value)} />
      </SettingRow>

      <SettingRow label="Late threshold" hint="Check-ins after this time are marked Late">
        <input type="time" className="input"
          value={settings.late_threshold_time || '10:00'}
          onChange={e => onChange('late_threshold_time', e.target.value)} />
      </SettingRow>

      <SettingRow label="Half-day threshold" hint="Check-ins after this time are marked Half Day">
        <input type="time" className="input"
          value={settings.half_day_threshold_time || '12:30'}
          onChange={e => onChange('half_day_threshold_time', e.target.value)} />
      </SettingRow>

      <SettingRow label="Lunch break start">
        <input type="time" className="input"
          value={settings.lunch_start_time || '13:00'}
          onChange={e => onChange('lunch_start_time', e.target.value)} />
      </SettingRow>

      <SettingRow label="Lunch break end">
        <input type="time" className="input"
          value={settings.lunch_end_time || '14:00'}
          onChange={e => onChange('lunch_end_time', e.target.value)} />
      </SettingRow>

      <SettingRow label="Minimum hours for full day"
        hint="Total net work minutes required to count as a full day">
        <div className="flex items-center gap-2">
          <input type="number" min="60" max="600" step="15" className="input"
            value={settings.min_full_day_minutes || '270'}
            onChange={e => onChange('min_full_day_minutes', e.target.value)} />
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>mins</span>
        </div>
      </SettingRow>

      <div className="py-4">
        <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Weekend days</p>
        <div className="flex flex-wrap gap-2">
          {days.map((d, i) => {
            const active = weekend.includes(i)
            return (
              <button key={i} type="button" onClick={() => toggleDay(i)}
                className="w-12 h-9 rounded-lg text-xs font-semibold transition-all"
                style={active
                  ? { background: '#F5C518', color: '#090B1A', border: '1px solid #F5C518' }
                  : { background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                {d}
              </button>
            )
          })}
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Selected days will be marked as weekends on the attendance grid.
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Verification Checks
// ═══════════════════════════════════════════════════════════════════════════════
function TabVerification({ settings, onChange }) {
  return (
    <div>
      <SectionTitle>Random Verification Checkout</SectionTitle>

      <SettingRow label="Enable verification checks"
        hint="Globally enable or disable random verification checkouts for all employees">
        <Toggle
          value={settings.verification_enabled === '1' || settings.verification_enabled === 1}
          onChange={v => onChange('verification_enabled', v ? '1' : '0')}
          label="Enable verification checks"
        />
      </SettingRow>

      {/* ── Session Windows ─────────────────────────────────────────────── */}
      <div className="py-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
        <p className="text-sm font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>
          Session windows
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Verification triggers are only scheduled when employees check in during these
          time windows. Set them to match your actual working hours.
        </p>

        {/* Session 1 */}
        <div className="mb-4">
          <p className="text-xs font-semibold mb-2 uppercase tracking-wide"
            style={{ color: 'var(--text-muted)' }}>Session 1</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="label text-xs">Start</label>
              <input type="time" className="input"
                value={settings.verification_session1_start || '10:00'}
                onChange={e => onChange('verification_session1_start', e.target.value)} />
            </div>
            <span className="text-xs mt-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>to</span>
            <div className="flex-1">
              <label className="label text-xs">End</label>
              <input type="time" className="input"
                value={settings.verification_session1_end || '13:00'}
                onChange={e => onChange('verification_session1_end', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Session 2 */}
        <div>
          <p className="text-xs font-semibold mb-2 uppercase tracking-wide"
            style={{ color: 'var(--text-muted)' }}>Session 2</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="label text-xs">Start</label>
              <input type="time" className="input"
                value={settings.verification_session2_start || '14:30'}
                onChange={e => onChange('verification_session2_start', e.target.value)} />
            </div>
            <span className="text-xs mt-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>to</span>
            <div className="flex-1">
              <label className="label text-xs">End</label>
              <input type="time" className="input"
                value={settings.verification_session2_end || '18:30'}
                onChange={e => onChange('verification_session2_end', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <SettingRow label="Checks per session"
        hint="Number of random verification checkouts per work session (Session 1 & 2)">
        <input type="number" min="1" max="5" className="input"
          value={settings.verification_checks_per_session || '2'}
          onChange={e => onChange('verification_checks_per_session', e.target.value)} />
      </SettingRow>

      <SettingRow label="Minimum gap between checks"
        hint="Minimum minutes between two verification triggers in the same session">
        <div className="flex items-center gap-2">
          <input type="number" min="1" max="120" className="input"
            value={settings.verification_min_gap_minutes || '30'}
            onChange={e => onChange('verification_min_gap_minutes', e.target.value)} />
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>mins</span>
        </div>
      </SettingRow>

      <SettingRow label="Response grace period"
        hint="Minutes the employee has to click Check In before it's marked No Response">
        <div className="flex items-center gap-2">
          <input type="number" min="1" max="30" className="input"
            value={settings.verification_grace_period_minutes || '5'}
            onChange={e => onChange('verification_grace_period_minutes', e.target.value)} />
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>mins</span>
        </div>
      </SettingRow>

      <SettingRow label="Exclude window at session start"
        hint="Don't trigger verification within the first N minutes of a session">
        <div className="flex items-center gap-2">
          <input type="number" min="0" max="60" className="input"
            value={settings.verification_exclude_start_minutes || '15'}
            onChange={e => onChange('verification_exclude_start_minutes', e.target.value)} />
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>mins</span>
        </div>
      </SettingRow>

      <SettingRow label="Exclude window at session end"
        hint="Don't trigger verification within the last N minutes of a session">
        <div className="flex items-center gap-2">
          <input type="number" min="0" max="60" className="input"
            value={settings.verification_exclude_end_minutes || '15'}
            onChange={e => onChange('verification_exclude_end_minutes', e.target.value)} />
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>mins</span>
        </div>
      </SettingRow>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Leave & Permissions
// ═══════════════════════════════════════════════════════════════════════════════
function TabLeave({ settings, onChange }) {
  const [leaveTypes,    setLeaveTypes]    = useState([])
  const [ltLoading,     setLtLoading]     = useState(true)
  const [ltModal,       setLtModal]       = useState(null)   // 'add' | { ...editObj }
  const [ltForm,        setLtForm]        = useState({ name: '', max_per_year: 12, is_paid: true })
  const [ltSaving,      setLtSaving]      = useState(false)
  const [deletingId,    setDeletingId]    = useState(null)

  const fetchLeaveTypes = useCallback(() => {
    setLtLoading(true)
    api.get('/settings/hr/leave-types')
      .then(r => setLeaveTypes(r.data))
      .catch(() => toast.error('Failed to load leave types'))
      .finally(() => setLtLoading(false))
  }, [])

  useEffect(() => { fetchLeaveTypes() }, [fetchLeaveTypes])

  const openAdd  = () => { setLtForm({ name: '', max_per_year: 12, is_paid: true }); setLtModal('add') }
  const openEdit = (lt) => { setLtForm({ name: lt.name, max_per_year: lt.max_per_year, is_paid: !!lt.is_paid }); setLtModal(lt) }

  const handleSave = async (e) => {
    e.preventDefault()
    setLtSaving(true)
    try {
      if (ltModal === 'add') {
        await api.post('/settings/hr/leave-types', ltForm)
        toast.success('Leave type created')
      } else {
        await api.put(`/settings/hr/leave-types/${ltModal.id}`, ltForm)
        toast.success('Leave type updated')
      }
      setLtModal(null)
      fetchLeaveTypes()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally { setLtSaving(false) }
  }

  const handleDelete = async (lt) => {
    if (!confirm(`Delete "${lt.name}"? This cannot be undone.`)) return
    setDeletingId(lt.id)
    try {
      await api.delete(`/settings/hr/leave-types/${lt.id}`)
      toast.success('Deleted')
      fetchLeaveTypes()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    } finally { setDeletingId(null) }
  }

  return (
    <div className="space-y-8">
      {/* Leave types management */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Leave Types</SectionTitle>
          <button onClick={openAdd} className="btn-primary btn-sm">+ Add Type</button>
        </div>

        {ltLoading ? (
          <div className="py-6 flex justify-center"><LoadingSpinner /></div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Days / year</th><th>Paid</th><th></th></tr>
              </thead>
              <tbody>
                {leaveTypes.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-6"
                    style={{ color: 'var(--text-muted)' }}>No leave types defined</td></tr>
                ) : leaveTypes.map(lt => (
                  <tr key={lt.id}>
                    <td className="font-medium">{lt.name}</td>
                    <td>{lt.max_per_year}</td>
                    <td>
                      <span className={`badge ${lt.is_paid ? 'badge-green' : 'badge-gray'}`}>
                        {lt.is_paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(lt)} className="btn-secondary btn-sm">Edit</button>
                        <button
                          onClick={() => handleDelete(lt)}
                          disabled={deletingId === lt.id}
                          className="btn-sm rounded-lg px-2 py-1.5 transition-colors"
                          style={{ background: '#FEF2F2', color: '#DC2626' }}>
                          {deletingId === lt.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Permission rules */}
      <div>
        <SectionTitle>Permission Rules</SectionTitle>

        <SettingRow label="Max permissions per month"
          hint="Maximum number of permission requests an employee can submit per month">
          <input type="number" min="0" max="20" className="input"
            value={settings.max_permissions_per_month || '4'}
            onChange={e => onChange('max_permissions_per_month', e.target.value)} />
        </SettingRow>

        <SettingRow label="Max hours per permission request"
          hint="Upper limit for a single permission request duration">
          <div className="flex items-center gap-2">
            <input type="number" min="1" max="8" step="0.5" className="input"
              value={settings.max_permission_hours || '2'}
              onChange={e => onChange('max_permission_hours', e.target.value)} />
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>hrs</span>
          </div>
        </SettingRow>
      </div>

      {/* Leave carry-forward */}
      <div>
        <SectionTitle>Year-End Rules</SectionTitle>
        <SettingRow label="Carry forward unused leave"
          hint="Allow unused leave days to roll over to the next year">
          <Toggle
            value={settings.leave_carry_forward === '1'}
            onChange={v => onChange('leave_carry_forward', v ? '1' : '0')}
            label="Carry forward"
          />
        </SettingRow>
      </div>

      {/* Add / Edit leave type modal */}
      <Modal open={!!ltModal} onClose={() => setLtModal(null)}
        title={ltModal === 'add' ? 'Add Leave Type' : `Edit — ${ltModal?.name}`} size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input type="text" className="input" placeholder="e.g. Sick Leave"
              value={ltForm.name}
              onChange={e => setLtForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Days per year</label>
            <input type="number" min="0" max="365" className="input"
              value={ltForm.max_per_year}
              onChange={e => setLtForm(f => ({ ...f, max_per_year: +e.target.value }))} />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Paid leave</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Counts toward paid salary</p>
            </div>
            <Toggle value={ltForm.is_paid} onChange={v => setLtForm(f => ({ ...f, is_paid: v }))} label="Paid" />
          </div>
          <div className="flex justify-end gap-3 pt-2" style={{ borderTop: '1px solid var(--border-light)' }}>
            <button type="button" onClick={() => setLtModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={ltSaving}>
              {ltSaving ? 'Saving…' : ltModal === 'add' ? 'Create' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Notifications
// ═══════════════════════════════════════════════════════════════════════════════
function TabNotifications({ settings, onChange }) {
  return (
    <div>
      <SectionTitle>HR Email Notifications</SectionTitle>
      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        Choose which events trigger an email notification to the HR inbox.
      </p>

      <SettingRow label="New leave request submitted">
        <Toggle value={settings.notify_hr_new_leave === '1'}
          onChange={v => onChange('notify_hr_new_leave', v ? '1' : '0')}
          label="New leave request" />
      </SettingRow>

      <SettingRow label="New permission request submitted">
        <Toggle value={settings.notify_hr_new_permission === '1'}
          onChange={v => onChange('notify_hr_new_permission', v ? '1' : '0')}
          label="New permission request" />
      </SettingRow>

      <SettingRow label="Verification — No Response flagged"
        hint="Notify HR when an employee doesn't respond to a verification checkout">
        <Toggle value={settings.notify_hr_verification_no_response === '1'}
          onChange={v => onChange('notify_hr_verification_no_response', v ? '1' : '0')}
          label="Verification no response" />
      </SettingRow>

      <SettingRow label="Daily attendance summary email"
        hint="Send a summary of today's attendance at the configured time">
        <Toggle value={settings.notify_hr_daily_summary === '1'}
          onChange={v => onChange('notify_hr_daily_summary', v ? '1' : '0')}
          label="Daily summary" />
      </SettingRow>

      {settings.notify_hr_daily_summary === '1' && (
        <SettingRow label="Daily summary send time">
          <input type="time" className="input"
            value={settings.notify_hr_daily_summary_time || '08:00'}
            onChange={e => onChange('notify_hr_daily_summary_time', e.target.value)} />
        </SettingRow>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Company Profile
// ═══════════════════════════════════════════════════════════════════════════════
function TabCompany({ settings, onChange, departments, setDepartments }) {
  const [newDept,    setNewDept]    = useState('')
  const [deptSaving, setDeptSaving] = useState(false)

  const addDept = async () => {
    const d = newDept.trim()
    if (!d || departments.includes(d)) return
    const next = [...departments, d].sort()
    setDepartments(next)
    setNewDept('')
    setDeptSaving(true)
    try {
      await api.put('/settings/hr/departments', { departments: next })
      toast.success('Department added')
    } catch { toast.error('Failed to save') }
    finally { setDeptSaving(false) }
  }

  const removeDept = async (dept) => {
    const next = departments.filter(d => d !== dept)
    setDepartments(next)
    try {
      await api.put('/settings/hr/departments', { departments: next })
    } catch { toast.error('Failed to save') }
  }

  return (
    <div className="space-y-8">
      <div>
        <SectionTitle>Company Profile</SectionTitle>

        <SettingRow label="Company name" hint="Displayed on payslip headers and emails">
          <input type="text" className="input" placeholder="My Company"
            value={settings.company_name || ''}
            onChange={e => onChange('company_name', e.target.value)} />
        </SettingRow>

        <SettingRow label="Company address">
          <textarea className="input" rows={3} placeholder="123 Main St, City, State"
            value={settings.company_address || ''}
            onChange={e => onChange('company_address', e.target.value)} />
        </SettingRow>

        <SettingRow label="Attendance & verification policy"
          hint="Shown to employees on their Settings → Attendance Policy page. Plain text.">
          <textarea className="input" rows={6}
            placeholder="Describe what data is collected and why…"
            value={settings.company_policy_text || ''}
            onChange={e => onChange('company_policy_text', e.target.value)} />
        </SettingRow>
      </div>

      {/* Departments */}
      <div>
        <SectionTitle>Departments</SectionTitle>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Manage the department list used when creating employees and filtering verification exclusions.
        </p>

        <div className="flex gap-2 mb-4">
          <input type="text" className="input" placeholder="Add department…"
            value={newDept}
            onChange={e => setNewDept(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDept() } }} />
          <button onClick={addDept} disabled={deptSaving || !newDept.trim()} className="btn-primary btn-sm px-4">
            Add
          </button>
        </div>

        {departments.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No departments added yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {departments.map(d => (
              <span key={d}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                {d}
                <button type="button" onClick={() => removeDept(d)}
                  className="text-xs opacity-50 hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--text-muted)' }}>✕</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Holidays link */}
      <div>
        <SectionTitle>Holiday Calendar</SectionTitle>
        <div className="flex items-center gap-3 p-4 rounded-xl"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24"
            stroke="#F5C518" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Manage holidays
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Add, edit, and delete company holidays from the dedicated Holidays page.
            </p>
          </div>
          <a href="/hr/holidays"
            className="btn-secondary btn-sm">Open →</a>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Account & Security
// ═══════════════════════════════════════════════════════════════════════════════
function TabAccount() {
  const { user, updateUser } = useAuth()
  const [profile,     setProfile]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [profForm,    setProfForm]    = useState({})
  const [profSaving,  setProfSaving]  = useState(false)
  const [pwForm,      setPwForm]      = useState({ current_password: '', new_password: '', confirm: '' })
  const [pwSaving,    setPwSaving]    = useState(false)
  const [showPw,      setShowPw]      = useState(false)
  const [loginHist,   setLoginHist]   = useState([])
  const [histLoading, setHistLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/settings/hr/profile'),
      api.get('/settings/employee/login-history'),
    ]).then(([p, h]) => {
      setProfile(p.data)
      setProfForm({
        name:                    p.data.name || '',
        phone:                   p.data.phone || '',
        personal_email:          p.data.personal_email || '',
        address:                 p.data.address || '',
        emergency_contact_name:  p.data.emergency_contact_name || '',
        emergency_contact_phone: p.data.emergency_contact_phone || '',
      })
      setLoginHist(h.data)
    }).catch(() => toast.error('Failed to load account info'))
      .finally(() => { setLoading(false); setHistLoading(false) })
  }, [])

  const saveProfile = async (e) => {
    e.preventDefault()
    setProfSaving(true)
    try {
      const res = await api.put('/settings/hr/profile', profForm)
      updateUser({ name: res.data.user.name })
      toast.success('Profile saved')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally { setProfSaving(false) }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    if (pwForm.new_password !== pwForm.confirm) {
      toast.error('Passwords do not match'); return
    }
    setPwSaving(true)
    try {
      await api.post('/auth/change-password', {
        current_password: pwForm.current_password,
        new_password:     pwForm.new_password,
      })
      toast.success('Password changed')
      setPwForm({ current_password: '', new_password: '', confirm: '' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Change failed')
    } finally { setPwSaving(false) }
  }

  if (loading) return <div className="py-8 flex justify-center"><LoadingSpinner /></div>

  return (
    <div className="space-y-8">
      {/* Profile */}
      <div>
        <SectionTitle>My Profile</SectionTitle>
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Full Name</label>
              <input type="text" className="input"
                value={profForm.name}
                onChange={e => setProfForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="label">Phone</label>
              <input type="tel" className="input"
                value={profForm.phone}
                onChange={e => setProfForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><label className="label">Personal Email</label>
              <input type="email" className="input"
                value={profForm.personal_email}
                onChange={e => setProfForm(f => ({ ...f, personal_email: e.target.value }))} /></div>
            <div><label className="label">Address</label>
              <input type="text" className="input"
                value={profForm.address}
                onChange={e => setProfForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div><label className="label">Emergency Contact Name</label>
              <input type="text" className="input"
                value={profForm.emergency_contact_name}
                onChange={e => setProfForm(f => ({ ...f, emergency_contact_name: e.target.value }))} /></div>
            <div><label className="label">Emergency Contact Phone</label>
              <input type="tel" className="input"
                value={profForm.emergency_contact_phone}
                onChange={e => setProfForm(f => ({ ...f, emergency_contact_phone: e.target.value }))} /></div>
          </div>
          {/* Read-only fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {[
              ['Work Email', profile?.email],
              ['Role', profile?.role],
              ['Department', profile?.department || '–'],
              ['Joined', profile?.join_date || '–'],
            ].map(([label, val]) => (
              <div key={label}>
                <label className="label">{label}</label>
                <div className="input opacity-60 cursor-not-allowed"
                  style={{ backgroundColor: 'var(--bg-surface)' }}>{val}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary" disabled={profSaving}>
              {profSaving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '24px' }}>
        <SectionTitle>Change Password</SectionTitle>
        <form onSubmit={changePassword} className="space-y-4 max-w-sm">
          {[
            ['current_password', 'Current password'],
            ['new_password',     'New password'],
            ['confirm',          'Confirm new password'],
          ].map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input type={showPw ? 'text' : 'password'} className="input"
                value={pwForm[key]}
                onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                required minLength={key !== 'current_password' ? 6 : 1} />
            </div>
          ))}
          <label className="flex items-center gap-2 text-xs cursor-pointer"
            style={{ color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={showPw} onChange={e => setShowPw(e.target.checked)} />
            Show passwords
          </label>
          <button type="submit" className="btn-primary" disabled={pwSaving}>
            {pwSaving ? 'Saving…' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Login history */}
      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '24px' }}>
        <SectionTitle>Recent Login Activity</SectionTitle>
        {histLoading ? <LoadingSpinner /> : loginHist.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No login history yet.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Date & Time</th><th>IP Address</th><th>Device / Browser</th></tr></thead>
              <tbody>
                {loginHist.map(h => (
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
// MAIN HR Settings page
// ═══════════════════════════════════════════════════════════════════════════════
export default function HRSettings() {
  const [activeTab,   setActiveTab]   = useState('attendance')
  const [settings,    setSettings]    = useState({})
  const [loading,     setLoading]     = useState(true)
  const [departments, setDepartments] = useState([])
  const [dirty,       setDirty]       = useState(false)
  const [saving,      setSaving]      = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/settings/hr'),
      api.get('/settings/hr/departments'),
    ]).then(([s, d]) => {
      setSettings(s.data)
      setDepartments(d.data)
    }).catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await api.put('/settings/hr', settings)
      setSettings(res.data.settings)
      setDirty(false)
      toast.success('Settings saved')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally { setSaving(false) }
  }

  if (loading) return <LoadingSpinner />

  const isAccountTab = activeTab === 'account'
  const isLeaveTab   = activeTab === 'leave'

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage company-wide rules, leave types, notifications, and your account.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap p-1 rounded-xl w-full"
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
      <div className="card relative">
        {activeTab === 'attendance' && (
          <TabAttendance settings={settings} onChange={handleChange} />
        )}
        {activeTab === 'verification' && (
          <TabVerification settings={settings} onChange={handleChange} />
        )}
        {activeTab === 'leave' && (
          <TabLeave settings={settings} onChange={handleChange} />
        )}
        {activeTab === 'notifications' && (
          <TabNotifications settings={settings} onChange={handleChange} />
        )}
        {activeTab === 'company' && (
          <TabCompany
            settings={settings} onChange={handleChange}
            departments={departments} setDepartments={setDepartments}
          />
        )}
        {activeTab === 'account' && (
          <TabAccount />
        )}

        {/* Sticky save bar — not shown on leave or account tabs (they have their own save) */}
        {!isAccountTab && !isLeaveTab && (
          <SaveBar dirty={dirty} saving={saving} onSave={handleSave} />
        )}
      </div>
    </div>
  )
}
