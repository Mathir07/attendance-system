import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'

const TABS = ['pending', 'approved', 'rejected']
const STATUS_STYLE = {
  pending:  { bg: '#FFFBEB', color: '#D97706' },
  approved: { bg: '#ECFDF5', color: '#059669' },
  rejected: { bg: '#FEF2F2', color: '#DC2626' },
}

export default function HRLeave() {
  const [tab,      setTab]      = useState('pending')
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(null)
  const [comment,  setComment]  = useState('')
  const [saving,   setSaving]   = useState(false)

  const fetchRequests = async (status = tab) => {
    setLoading(true)
    try { const res = await api.get(`/leave/all?status=${status}`); setRequests(res.data) }
    catch { toast.error('Failed to load requests') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchRequests(tab) }, [tab])

  const handleAction = async () => {
    if (!modal) return
    setSaving(true)
    try {
      await api.put(`/leave/${modal.request.id}/${modal.type}`, { comment })
      toast.success(`Leave ${modal.type}d successfully`)
      setModal(null); setComment(''); fetchRequests(tab)
    } catch (err) { toast.error(err.response?.data?.message || 'Action failed') }
    finally       { setSaving(false) }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="page-title">Leave Requests</h1>
        <p className="page-subtitle">Review and action employee leave applications</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: 'var(--bg-surface-2)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all duration-150"
            style={tab === t
              ? { background: '#090B1A', color: '#fff', boxShadow: '0 2px 8px rgba(9,11,26,0.2)' }
              : { background: 'transparent', color: 'var(--text-secondary)' }}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="card p-0 overflow-hidden">
          {requests.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-surface)' }}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--border)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No {tab} leave requests</p>
            </div>
          ) : (
            <div className="table-wrapper rounded-none border-0">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee</th><th>Dept</th><th>Leave Type</th>
                    <th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th>
                    {tab === 'pending' ? <th>Actions</th> : <><th>Comment</th><th>Actioned By</th></>}
                  </tr>
                </thead>
                <tbody>
                  {requests.map(r => {
                    const ss = STATUS_STYLE[r.status] || { bg: 'var(--bg-surface)', color: 'var(--text-muted)' }
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}>
                              {r.employee_name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>{r.employee_name}</p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.employee_id}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{r.department || '–'}</td>
                        <td className="font-medium">{r.leave_name}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{r.start_date}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{r.end_date}</td>
                        <td className="font-semibold">{r.days}</td>
                        <td className="max-w-[160px] truncate" style={{ color: 'var(--text-secondary)' }} title={r.reason}>{r.reason}</td>
                        <td>
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: ss.bg, color: ss.color }}>
                            {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          </span>
                        </td>
                        {tab === 'pending' ? (
                          <td>
                            <div className="flex gap-2">
                              <button onClick={() => { setModal({ type: 'approve', request: r }); setComment('') }}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                style={{ background: '#ECFDF5', color: '#059669' }}
                                onMouseEnter={e => e.currentTarget.style.background='#D1FAE5'}
                                onMouseLeave={e => e.currentTarget.style.background='#ECFDF5'}>Approve</button>
                              <button onClick={() => { setModal({ type: 'reject', request: r }); setComment('') }}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                style={{ background: '#FEF2F2', color: '#DC2626' }}
                                onMouseEnter={e => e.currentTarget.style.background='#FEE2E2'}
                                onMouseLeave={e => e.currentTarget.style.background='#FEF2F2'}>Reject</button>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="text-xs italic" style={{ color: 'var(--text-muted)' }}>{r.comment || '–'}</td>
                            <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.approved_by_name || '–'}</td>
                          </>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)}
        title={modal?.type === 'approve' ? 'Approve Leave' : 'Reject Leave'} size="sm">
        {modal && (
          <div className="space-y-4">
            <div className="rounded-xl p-4 space-y-2 text-sm" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
              <p><span style={{ color: 'var(--text-muted)' }}>Employee: </span><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{modal.request.employee_name}</span></p>
              <p><span style={{ color: 'var(--text-muted)' }}>Type: </span><span style={{ color: 'var(--text-secondary)' }}>{modal.request.leave_name}</span></p>
              <p><span style={{ color: 'var(--text-muted)' }}>Period: </span><span style={{ color: 'var(--text-secondary)' }}>{modal.request.start_date} → {modal.request.end_date} </span><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>({modal.request.days} days)</span></p>
              <p><span style={{ color: 'var(--text-muted)' }}>Reason: </span><span style={{ color: 'var(--text-secondary)' }}>{modal.request.reason}</span></p>
            </div>
            <div>
              <label className="label">Comment {modal.type === 'approve' ? '(optional)' : '(recommended)'}</label>
              <textarea className="input resize-none" rows={3} placeholder="Add a comment…" value={comment} onChange={e => setComment(e.target.value)} />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleAction} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                style={modal.type === 'approve'
                  ? { background: '#ECFDF5', color: '#059669', border: '1px solid #6EE7B7' }
                  : { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5' }}>
                {saving ? 'Saving…' : modal.type === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
