import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'

const STATUS_STYLE = {
  pending:  { bg: '#FFFBEB', color: '#D97706' },
  approved: { bg: '#ECFDF5', color: '#059669' },
  rejected: { bg: '#FEF2F2', color: '#DC2626' },
}

export default function EmpPermission() {
  const [data,       setData]       = useState({ requests: [], monthly_used: 0, monthly_cap: 4 })
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ date: '', from_time: '', to_time: '', reason: '' })

  const fetchData = async () => {
    try { const res = await api.get('/permission/my'); setData(res.data) }
    catch { toast.error('Failed to load permissions') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.date || !form.from_time || !form.to_time || !form.reason.trim()) { toast.error('All fields required'); return }
    setSubmitting(true)
    try {
      const res = await api.post('/permission/apply', form)
      toast.success(`Permission request submitted (${res.data.hours}h)`)
      setModal(false); setForm({ date: '', from_time: '', to_time: '', reason: '' }); fetchData()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit') }
    finally       { setSubmitting(false) }
  }

  if (loading) return <LoadingSpinner />

  const { requests, monthly_used, monthly_cap } = data
  const remaining = monthly_cap - monthly_used
  const capPct    = Math.min((monthly_used / monthly_cap) * 100, 100)
  const capColor  = capPct >= 100 ? '#DC2626' : capPct >= 75 ? '#D97706' : '#059669'
  const capBg     = capPct >= 100 ? '#FEF2F2' : capPct >= 75 ? '#FFFBEB' : '#ECFDF5'

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Permission Requests</h1>
          <p className="page-subtitle">Short-leave / permission requests (max {monthly_cap}/month)</p>
        </div>
        <button onClick={() => setModal(true)} disabled={remaining <= 0} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Request Permission
        </button>
      </div>

      {/* Monthly cap card */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="accent-bar">
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>This Month's Usage</h3>
          </div>
          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold" style={{ background: capBg, color: capColor }}>
            {remaining > 0 ? `${remaining} remaining` : 'Limit reached'}
          </span>
        </div>
        <div className="flex items-end gap-6">
          <div>
            <p className="text-5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{monthly_used}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>of {monthly_cap} used this month</p>
          </div>
          <div className="flex-1 pb-1">
            <div className="progress-track h-2.5">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${capPct}%`, background: capColor }} />
            </div>
            <div className="flex justify-between text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              <span>0</span><span>{monthly_cap}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Requests table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <span className="w-0.5 h-4 rounded-full" style={{ background: '#F5C518' }} />
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>My Permission Requests</h3>
        </div>
        {requests.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-surface)' }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--border)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No permission requests yet</p>
          </div>
        ) : (
          <div className="table-wrapper rounded-none border-0">
            <table className="table">
              <thead><tr><th>Date</th><th>From</th><th>To</th><th>Hours</th><th>Reason</th><th>Status</th><th>Comment</th><th>Approved By</th></tr></thead>
              <tbody>
                {requests.map(r => {
                  const ss = STATUS_STYLE[r.status] || { bg: 'var(--bg-surface)', color: 'var(--text-muted)' }
                  return (
                    <tr key={r.id}>
                      <td className="font-medium">{r.date}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{r.from_time}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{r.to_time}</td>
                      <td className="font-semibold">{r.hours}h</td>
                      <td className="max-w-[160px] truncate" style={{ color: 'var(--text-secondary)' }} title={r.reason}>{r.reason}</td>
                      <td>
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: ss.bg, color: ss.color }}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                      </td>
                      <td className="text-xs italic" style={{ color: 'var(--text-muted)' }}>{r.comment || '–'}</td>
                      <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.approved_by_name || '–'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Request Permission">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} min={new Date().toISOString().split('T')[0]} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">From Time</label>
              <input type="time" className="input" value={form.from_time} onChange={e => setForm(f => ({ ...f, from_time: e.target.value }))} required />
            </div>
            <div>
              <label className="label">To Time</label>
              <input type="time" className="input" value={form.to_time} onChange={e => setForm(f => ({ ...f, to_time: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="label">Reason</label>
            <textarea className="input resize-none" rows={3} placeholder="Briefly explain your reason…" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Request'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
