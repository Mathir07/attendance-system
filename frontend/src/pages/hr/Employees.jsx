import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import { useAuth } from '../../context/AuthContext'

// ── Verification summary widget ───────────────────────────────────────────────
// Shown inside the employee edit modal — loads current-month stats.
function VerificationSummary({ empId }) {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!empId) return
    setLoading(true)
    api.get(`/verification/hr/${empId}/summary?year=${year}&month=${month}`)
      .then(r => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [empId])

  const monthName = now.toLocaleString('default', { month: 'long' })

  // Format avg delay seconds → "Xm Ys" or "–"
  const fmtAvg = (sec) => {
    if (sec == null) return '–'
    const m = Math.floor(sec / 60)
    const s = sec % 60
    if (m > 0 && s > 0) return `${m}m ${s}s`
    if (m > 0)           return `${m} min`
    return `${s}s`
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest mb-3"
        style={{ color: 'var(--text-muted)' }}>
        Verification Summary — {monthName} {year}
      </p>

      {loading ? (
        <div className="py-3 text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      ) : !stats || stats.total === 0 ? (
        <div className="rounded-xl px-4 py-3 text-xs"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
          No verification checks recorded this month.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {/* Total checks */}
          <div className="rounded-xl p-4"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1"
              style={{ color: 'var(--text-muted)' }}>Total Checks</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {stats.total}
            </p>
          </div>

          {/* Responded */}
          <div className="rounded-xl p-4"
            style={{ backgroundColor: '#ECFDF5', border: '1px solid #6EE7B7' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1"
              style={{ color: '#065F46' }}>Responded</p>
            <p className="text-2xl font-bold" style={{ color: '#059669' }}>
              {stats.respondedCount}
              <span className="text-xs font-normal ml-1" style={{ color: '#6EE7B7' }}>
                / {stats.total}
              </span>
            </p>
          </div>

          {/* No Response */}
          <div className="rounded-xl p-4"
            style={stats.noResponseCount > 0
              ? { backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }
              : { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1"
              style={{ color: stats.noResponseCount > 0 ? '#991B1B' : 'var(--text-muted)' }}>
              No Response
            </p>
            <p className="text-2xl font-bold"
              style={{ color: stats.noResponseCount > 0 ? '#DC2626' : 'var(--text-muted)' }}>
              {stats.noResponseCount}
            </p>
          </div>

          {/* Avg response time */}
          <div className="rounded-xl p-4"
            style={stats.avgDelaySeconds != null && stats.avgDelaySeconds > 5 * 60
              ? { backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }
              : { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1"
              style={{ color: 'var(--text-muted)' }}>Avg Response</p>
            <p className="text-2xl font-bold"
              style={{ color: stats.avgDelaySeconds != null && stats.avgDelaySeconds > 5 * 60
                ? '#D97706' : 'var(--text-primary)' }}>
              {fmtAvg(stats.avgDelaySeconds)}
            </p>
          </div>

          {/* Slow responses — only show if any */}
          {stats.slowCount > 0 && (
            <div className="col-span-2 rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24"
                stroke="#D97706" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs" style={{ color: '#92400E' }}>
                <span className="font-semibold">{stats.slowCount}</span> check{stats.slowCount !== 1 ? 's' : ''} responded in over 5 minutes this month.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const EMPTY_FORM = {
  name: '', email: '', password: '', employee_id: '',
  department: '', designation: '', phone: '', join_date: '',
  basic: '', hra: '', allowances: '', deductions: '', pf: '',
}

const EMPTY_HR_FORM = {
  name: '', email: '', password: '', employee_id: '',
  phone: '', department: '', designation: '', join_date: '',
}

// ── HR Users management component ────────────────────────────────────────────
function HRUsers({ departments, designations }) {
  const { user: me } = useAuth()
  const [hrUsers,   setHrUsers]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(null) // 'add' | 'edit' | 'delete'
  const [selected,  setSelected]  = useState(null)
  const [form,      setForm]      = useState(EMPTY_HR_FORM)
  const [saving,    setSaving]    = useState(false)
  const [toggling,  setToggling]  = useState(null)
  const [deleting,  setDeleting]  = useState(false)
  const [search,    setSearch]    = useState('')

  const fetchHRUsers = async () => {
    try { const res = await api.get('/hr/hr-users'); setHrUsers(res.data) }
    catch { toast.error('Failed to load HR users') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchHRUsers() }, [])

  const openAdd = () => { setForm(EMPTY_HR_FORM); setSelected(null); setModal('add') }

  const openEdit = (u) => {
    setSelected(u)
    setForm({
      name: u.name || '', email: u.email || '', password: '',
      employee_id: u.employee_id || '', phone: u.phone || '',
      department: u.department || '', designation: u.designation || '',
      join_date: u.join_date || '',
    })
    setModal('edit')
  }

  const openDelete = (u) => { setSelected(u); setModal('delete') }

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      if (modal === 'add') {
        if (!form.name || !form.email || !form.password)
          throw new Error('Name, email and password are required')
        await api.post('/hr/hr-users', form)
        toast.success('HR user created')
      } else {
        await api.put(`/hr/hr-users/${selected.id}`, form)
        toast.success('HR user updated')
      }
      setModal(null); fetchHRUsers()
    } catch (err) { toast.error(err.response?.data?.message || err.message || 'Save failed') }
    finally { setSaving(false) }
  }

  const handleToggle = async (u) => {
    setToggling(u.id)
    try {
      const res = await api.put(`/hr/hr-users/${u.id}/toggle`)
      toast.success(res.data.message); fetchHRUsers()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update status') }
    finally { setToggling(null) }
  }

  const handleDelete = async () => {
    if (!selected) return
    setDeleting(true)
    try {
      const res = await api.delete(`/hr/hr-users/${selected.id}`)
      toast.success(res.data.message); setModal(null); fetchHRUsers()
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed') }
    finally { setDeleting(false) }
  }

  const f = (key) => ({ value: form[key], onChange: e => setForm(p => ({ ...p, [key]: e.target.value })) })

  const filtered = hrUsers
    .filter(u => {
      const q = search.toLowerCase()
      return u.name.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.employee_id || '').toLowerCase().includes(q)
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="page-title">HR Portal Users</h2>
          <p className="page-subtitle">
            {hrUsers.length} total · {hrUsers.filter(u => u.status === 'active').length} active
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input type="text" className="input pl-9 w-56" placeholder="Search HR users…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button onClick={openAdd} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add HR User
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
        style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24"
          stroke="#2563EB" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs" style={{ color: '#1D4ED8' }}>
          HR users have full access to the HR portal — attendance, employees, leaves, payslips and settings.
          Only add people you trust with this access.
        </p>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
              style={{ backgroundColor: 'var(--bg-surface)' }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                strokeWidth={1.5} style={{ color: 'var(--border)' }}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {search ? 'No HR users match your search' : 'No HR users yet'}
            </p>
          </div>
        ) : (
          <div className="table-wrapper rounded-none border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>ID</th><th>Department</th>
                  <th>Joined</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                          {u.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {u.name}
                            {u.id === me?.id && (
                              <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                style={{ background: '#EFF6FF', color: '#2563EB' }}>You</span>
                            )}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.designation || 'HR'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                      {u.employee_id || '–'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{u.department || '–'}</td>
                    <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {u.join_date
                        ? new Date(u.join_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '–'}
                    </td>
                    <td>
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={u.status === 'active'
                          ? { background: '#EFF6FF', color: '#2563EB' }
                          : { background: '#FEF2F2', color: '#DC2626' }}>
                        {u.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(u)} className="btn-secondary btn-sm">Edit</button>
                        <button
                          onClick={() => handleToggle(u)}
                          disabled={toggling === u.id || u.id === me?.id}
                          title={u.id === me?.id ? 'Cannot deactivate your own account' : ''}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
                          style={u.status === 'active'
                            ? { background: '#FEF2F2', color: '#DC2626' }
                            : { background: '#ECFDF5', color: '#059669' }}>
                          {toggling === u.id ? '…' : u.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => openDelete(u)}
                          disabled={u.id === me?.id}
                          title={u.id === me?.id ? 'Cannot delete your own account' : 'Delete HR user'}
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150 disabled:opacity-30"
                          style={{ background: '#FEF2F2', color: '#DC2626' }}
                          onMouseEnter={e => { if (u.id !== me?.id) { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = '#fff' } }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626' }}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
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

      {/* Add / Edit modal */}
      <Modal open={modal === 'add' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'add' ? 'Add HR User' : `Edit — ${selected?.name}`} size="lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-muted)' }}>Account Info</p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Full Name *</label>
                <input type="text" className="input" placeholder="Vinoth Ravi" required {...f('name')} /></div>
              <div><label className="label">Email *</label>
                <input type="email" className="input" placeholder="vinoth@company.com"
                  required={modal === 'add'} disabled={modal === 'edit'} {...f('email')} /></div>
              <div>
                <label className="label">
                  {modal === 'add' ? 'Password *' : 'New Password'}
                  {modal === 'edit' && <span className="ml-1 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>(leave blank to keep current)</span>}
                </label>
                <input type="password" className="input" placeholder="Min 6 chars"
                  required={modal === 'add'} {...f('password')} /></div>
              <div><label className="label">Employee ID</label>
                <input type="text" className="input" placeholder="HR003" {...f('employee_id')} /></div>
              <div><label className="label">Phone</label>
                <input type="tel" className="input" placeholder="9876543210" {...f('phone')} /></div>
              <div><label className="label">Join Date</label>
                <input type="date" className="input" {...f('join_date')} /></div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-muted)' }}>Work Info</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Department</label>
                <select className="input" {...f('department')}>
                  <option value="">— Select department —</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  {form.department && !departments.includes(form.department) && (
                    <option value={form.department}>{form.department}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="label">Designation</label>
                <select className="input" {...f('designation')}>
                  <option value="">— Select designation —</option>
                  {designations.map(d => <option key={d} value={d}>{d}</option>)}
                  {form.designation && !designations.includes(form.designation) && (
                    <option value={form.designation}>{form.designation}</option>
                  )}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3"
            style={{ borderTop: '1px solid var(--border-light)' }}>
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : modal === 'add' ? 'Create HR User' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal open={modal === 'delete'} onClose={() => setModal(null)}
        title="Delete HR User" size="sm">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl"
              style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor"
                viewBox="0 0 20 20" style={{ color: '#DC2626' }}>
                <path fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#DC2626' }}>This action cannot be undone</p>
                <p className="text-xs mt-1" style={{ color: '#EF4444' }}>
                  This HR user will lose all portal access immediately.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                {selected.name[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{selected.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{selected.email}</p>
              </div>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{selected.name}</span>?
            </p>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setModal(null)} className="btn-secondary" disabled={deleting}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="btn-danger disabled:opacity-50">
                {deleting ? (
                  <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>Deleting…</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>Delete Permanently</>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default function HREmployees() {
  const [tab,          setTab]          = useState('employees') // 'employees' | 'hr-users'
  const [employees,    setEmployees]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [modal,        setModal]        = useState(null) // 'add' | 'edit' | 'delete'
  const [selected,     setSelected]     = useState(null)
  const [saving,       setSaving]       = useState(false)
  const [toggling,     setToggling]     = useState(null)
  const [deleting,     setDeleting]     = useState(false)
  const [search,       setSearch]       = useState('')
  const [form,         setForm]         = useState(EMPTY_FORM)
  const [departments,  setDepartments]  = useState([])
  const [designations, setDesignations] = useState([])

  const fetchEmployees = async () => {
    try { const res = await api.get('/hr/employees'); setEmployees(res.data) }
    catch { toast.error('Failed to load employees') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchEmployees()
    api.get('/settings/hr/departments').then(r => setDepartments(r.data)).catch(() => {})
    api.get('/settings/hr/designations').then(r => setDesignations(r.data)).catch(() => {})
  }, [])

  const openAdd = () => { setForm(EMPTY_FORM); setSelected(null); setModal('add') }

  const openEdit = (emp) => {
    setSelected(emp)
    setForm({
      name: emp.name||'', email: emp.email||'', password: '',
      employee_id: emp.employee_id||'', department: emp.department||'',
      designation: emp.designation||'', phone: emp.phone||'', join_date: emp.join_date||'',
      basic: emp.basic??'', hra: emp.hra??'', allowances: emp.allowances??'',
      deductions: emp.deductions??'', pf: emp.pf??'',
    })
    setModal('edit')
  }

  const openDelete = (emp) => { setSelected(emp); setModal('delete') }

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      if (modal === 'add') {
        if (!form.name || !form.email || !form.password) throw new Error('Name, email and password required')
        await api.post('/hr/employees', form); toast.success('Employee created')
      } else {
        await api.put(`/hr/employees/${selected.id}`, form); toast.success('Employee updated')
      }
      setModal(null); fetchEmployees()
    } catch (err) { toast.error(err.response?.data?.message || err.message || 'Save failed') }
    finally       { setSaving(false) }
  }

  const handleToggle = async (emp) => {
    setToggling(emp.id)
    try {
      const res = await api.put(`/hr/employees/${emp.id}/deactivate`)
      toast.success(res.data.message); fetchEmployees()
    } catch { toast.error('Failed to update status') }
    finally   { setToggling(null) }
  }

  const handleDelete = async () => {
    if (!selected) return
    setDeleting(true)
    try {
      const res = await api.delete(`/hr/employees/${selected.id}`)
      toast.success(res.data.message)
      setModal(null); fetchEmployees()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = employees
    .filter(e => {
      const q = search.toLowerCase()
      return e.name.toLowerCase().includes(q) ||
        (e.employee_id||'').toLowerCase().includes(q) ||
        (e.department||'').toLowerCase().includes(q) ||
        (e.designation||'').toLowerCase().includes(q)
    })
    .sort((a, b) => (a.employee_id || '').localeCompare(b.employee_id || '', undefined, { numeric: true, sensitivity: 'base' }))

  const f = (key) => ({ value: form[key], onChange: e => setForm(p => ({ ...p, [key]: e.target.value })) })
  const netPay = (+form.basic||0) + (+form.hra||0) + (+form.allowances||0) - (+form.deductions||0) - (+form.pf||0)

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Tab switcher */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        {[
          { key: 'employees', label: 'Employees' },
          { key: 'hr-users',  label: 'HR Portal Users' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150"
            style={tab === t.key
              ? { background: '#090B1A', color: '#fff' }
              : { color: 'var(--text-secondary)', background: 'transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* HR Users tab */}
      {tab === 'hr-users' && (
        <HRUsers departments={departments} designations={designations} />
      )}

      {/* Employees tab */}
      {tab === 'employees' && (<>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">
            {employees.length} total · {employees.filter(e => e.status === 'active').length} active
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input type="text" className="input pl-9 w-56" placeholder="Search employees…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button onClick={openAdd} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Employee
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
              style={{ backgroundColor: 'var(--bg-surface)' }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                strokeWidth={1.5} style={{ color: 'var(--border)' }}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {search ? 'No employees match your search' : 'No employees yet'}
            </p>
          </div>
        ) : (
          <div className="table-wrapper rounded-none border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th><th>ID</th><th>Department</th><th>Designation</th>
                  <th>Joined</th><th>Net Pay</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => (
                  <tr key={emp.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}>
                          {emp.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{emp.name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {emp.employee_id || '–'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{emp.department  || '–'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{emp.designation || '–'}</td>
                    <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {emp.join_date
                        ? new Date(emp.join_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
                        : '–'}
                    </td>
                    <td className="font-semibold" style={{ color: '#059669' }}>
                      {emp.net_pay ? `₹${Number(emp.net_pay).toLocaleString('en-IN')}` : '–'}
                    </td>
                    <td>
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={emp.status === 'active'
                          ? { background: '#ECFDF5', color: '#059669' }
                          : { background: '#FEF2F2', color: '#DC2626' }}>
                        {emp.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {/* Edit */}
                        <button onClick={() => openEdit(emp)} className="btn-secondary btn-sm">
                          Edit
                        </button>

                        {/* Activate / Deactivate */}
                        <button
                          onClick={() => handleToggle(emp)}
                          disabled={toggling === emp.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                          style={emp.status === 'active'
                            ? { background: '#FEF2F2', color: '#DC2626' }
                            : { background: '#ECFDF5', color: '#059669' }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                          {toggling === emp.id ? '…' : emp.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => openDelete(emp)}
                          title="Delete employee"
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150"
                          style={{ background: '#FEF2F2', color: '#DC2626' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = '#fff' }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626' }}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
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

      {/* Add / Edit modal */}
      <Modal open={modal === 'add' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'add' ? 'Add Employee' : `Edit — ${selected?.name}`} size="lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-muted)' }}>Personal Info</p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Full Name *</label>
                <input type="text" className="input" placeholder="Arun Kumar" required {...f('name')} /></div>
              <div><label className="label">Email *</label>
                <input type="email" className="input" placeholder="arun@company.com"
                  required={modal === 'add'} disabled={modal === 'edit'} {...f('email')} /></div>
              {modal === 'add' && (
                <div><label className="label">Password *</label>
                  <input type="password" className="input" placeholder="Min 6 chars" required {...f('password')} /></div>
              )}
              <div><label className="label">Employee ID</label>
                <input type="text" className="input" placeholder="EMP004" {...f('employee_id')} /></div>
              <div><label className="label">Phone</label>
                <input type="tel" className="input" placeholder="9876543210" {...f('phone')} /></div>
              <div><label className="label">Join Date</label>
                <input type="date" className="input" {...f('join_date')} /></div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-muted)' }}>Work Info</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Department</label>
                <select className="input" {...f('department')}>
                  <option value="">— Select department —</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  {form.department && !departments.includes(form.department) && (
                    <option value={form.department}>{form.department}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="label">Designation</label>
                <select className="input" {...f('designation')}>
                  <option value="">— Select designation —</option>
                  {designations.map(d => <option key={d} value={d}>{d}</option>)}
                  {form.designation && !designations.includes(form.designation) && (
                    <option value={form.designation}>{form.designation}</option>
                  )}
                </select>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-muted)' }}>Salary Structure (₹/month)</p>
            <div className="grid grid-cols-3 gap-4">
              {[['basic','Basic'],['hra','HRA'],['allowances','Allowances'],['deductions','Deductions'],['pf','PF']].map(([key, label]) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input type="number" min="0" className="input" placeholder="0" {...f(key)} />
                </div>
              ))}
              <div className="rounded-xl p-4 flex flex-col justify-center"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1"
                  style={{ color: 'var(--text-muted)' }}>Net Pay</p>
                <p className="text-xl font-bold" style={{ color: '#059669' }}>
                  ₹{netPay.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>

          {/* Verification summary — edit mode only */}
          {modal === 'edit' && selected && (
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
              <VerificationSummary empId={selected.id} />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3"
            style={{ borderTop: '1px solid var(--border-light)' }}>
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : modal === 'add' ? 'Create Employee' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal open={modal === 'delete'} onClose={() => setModal(null)}
        title="Delete Employee" size="sm">
        {selected && (
          <div className="space-y-4">
            {/* Warning banner */}
            <div className="flex items-start gap-3 p-4 rounded-xl"
              style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor"
                viewBox="0 0 20 20" style={{ color: '#DC2626' }}>
                <path fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#DC2626' }}>
                  This action cannot be undone
                </p>
                <p className="text-xs mt-1" style={{ color: '#EF4444' }}>
                  All attendance records, leave history, payslips, and salary data for this employee will be permanently deleted.
                </p>
              </div>
            </div>

            {/* Employee info */}
            <div className="flex items-center gap-3 p-4 rounded-xl"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}>
                {selected.name[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{selected.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {selected.employee_id && `${selected.employee_id} · `}
                  {selected.designation || selected.department || selected.email}
                </p>
              </div>
            </div>

            {/* Confirmation text */}
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Are you sure you want to permanently delete <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{selected.name}</span>?
            </p>

            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setModal(null)} className="btn-secondary" disabled={deleting}>
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-danger disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Deleting…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
      </>)}
    </div>
  )
}
