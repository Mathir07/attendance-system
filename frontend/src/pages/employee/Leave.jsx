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

export default function EmpLeave() {
  const year = new Date().getFullYear()
  const [requests,   setRequests]   = useState([])
  const [balances,   setBalances]   = useState([])
  const [types,      setTypes]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ leave_type_id: '', start_date: '', end_date: '', reason: '' })

  const fetchAll = async () => {
    try {
      const [req, bal, typ] = await Promise.all([
        api.get('/leave/my'),
        api.get(`/leave/balances?year=${year}`),
        api.get('/leave/types'),
      ])
      setRequests(req.data); setBalances(bal.data); setTypes(typ.data)
    } catch { toast.error('Failed to load leave data') }
    finally   { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.leave_type_id || !form.start_date || !form.end_date || !form.reason.trim()) {
      toast.error('All fields are required'); return
    }
    setSubmitting(true)
    try {
      const res = await api.post('/leave/apply', form)
      toast.success(`Leave applied for ${res.data.days} day(s)`)
      setModal(false); setForm({ leave_type_id: '', start_date: '', end_date: '', reason: '' }); fetchAll()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to apply') }
    finally       { setSubmitting(false) }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Leave</h1>
          <p className="page-subtitle">Apply for leave and track your requests</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Apply for Leave
        </button>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {balances.map(b => {
          const pct = b.allocated > 0 ? (b.remaining / b.allocated) * 100 : 0
          return (
            <div key={b.id} className="card-hover">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{b.leave_name}</p>
              <p className="text-4xl font-bold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>{b.remaining}</p>
              <div className="progress-track mb-2">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>{b.used} used</span><span>{b.allocated} total</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Requests table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <span className="w-0.5 h-4 rounded-full" style={{ background: '#F5C518' }} />
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>My Leave Requests</h3>
        </div>
        {requests.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-surface)' }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--border)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No leave requests yet</p>
          </div>
        ) : (
          <div className="table-wrapper rounded-none border-0">
            <table className="table">
              <thead><tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th>Comment</th><th>Applied</th></tr></thead>
              <tbody>
                {requests.map(r => {
                  const ss = STATUS_STYLE[r.status] || { bg: 'var(--bg-surface)', color: 'var(--text-muted)' }
                  return (
                    <tr key={r.id}>
                      <td className="font-medium">{r.leave_name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{r.start_date}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{r.end_date}</td>
                      <td className="font-semibold">{r.days}</td>
                      <td className="max-w-[180px] truncate" style={{ color: 'var(--text-secondary)' }} title={r.reason}>{r.reason}</td>
                      <td>
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: ss.bg, color: ss.color }}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                      </td>
                      <td className="text-xs italic" style={{ color: 'var(--text-muted)' }}>{r.comment || '–'}</td>
                      <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Apply for Leave">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Leave Type</label>
            <select className="input" value={form.leave_type_id} onChange={e => setForm(f => ({ ...f, leave_type_id: e.target.value }))} required>
              <option value="">Select leave type</option>
              {types.map(t => {
                const bal = balances.find(b => b.leave_type_id === t.id)
                return <option key={t.id} value={t.id}>{t.name} {bal ? `(${bal.remaining} days left)` : ''}</option>
              })}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">From Date</label>
              <input type="date" className="input" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} min={new Date().toISOString().split('T')[0]} required />
            </div>
            <div>
              <label className="label">To Date</label>
              <input type="date" className="input" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} min={form.start_date || new Date().toISOString().split('T')[0]} required />
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
