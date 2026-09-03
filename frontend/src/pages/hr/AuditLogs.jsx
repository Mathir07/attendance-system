import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import LoadingSpinner from '../../components/LoadingSpinner'

const ACTION_STYLE = {
  APPROVED_LEAVE:      { bg: '#ECFDF5', color: '#059669', label: 'Approved Leave' },
  REJECTED_LEAVE:      { bg: '#FEF2F2', color: '#DC2626', label: 'Rejected Leave' },
  APPROVED_PERMISSION: { bg: '#ECFDF5', color: '#059669', label: 'Approved Permission' },
  REJECTED_PERMISSION: { bg: '#FEF2F2', color: '#DC2626', label: 'Rejected Permission' },
  CREATED_EMPLOYEE:    { bg: '#EFF6FF', color: '#2563EB', label: 'Created Employee' },
  UPLOADED_PAYSLIP:    { bg: '#F5F3FF', color: '#7C3AED', label: 'Uploaded Payslip' },
  GENERATED_PAYSLIP:   { bg: '#F5F3FF', color: '#7C3AED', label: 'Generated Payslip' },
}

export default function HRAuditLogs() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    api.get('/hr/audit-logs')
      .then(res => setLogs(res.data))
      .catch(() => toast.error('Failed to load audit logs'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = logs.filter(l => {
    const q = search.toLowerCase()
    return l.actor_name?.toLowerCase().includes(q) ||
           l.action?.toLowerCase().includes(q) ||
           l.details?.toLowerCase().includes(q)
  })

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">Track all approval and management actions</p>
        </div>
        <div className="relative">
          <input type="text" className="input pl-9 w-64" placeholder="Search logs…" value={search} onChange={e => setSearch(e.target.value)} />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-3 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-light)' }}>
          <span className="w-0.5 h-4 rounded-full" style={{ background: '#F5C518' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No audit logs found</p>
          </div>
        ) : (
          <div className="table-wrapper rounded-none border-0">
            <table className="table">
              <thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Details</th><th>Target</th></tr></thead>
              <tbody>
                {filtered.map(log => {
                  const as = ACTION_STYLE[log.action] || { bg: 'var(--bg-surface)', color: 'var(--text-muted)', label: log.action }
                  return (
                    <tr key={log.id}>
                      <td className="whitespace-nowrap text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(log.created_at).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}>
                            {log.actor_name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{log.actor_name || '–'}</span>
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: as.bg, color: as.color }}>
                          {as.label}
                        </span>
                      </td>
                      <td className="max-w-[240px] truncate text-xs" style={{ color: 'var(--text-secondary)' }} title={log.details}>{log.details || '–'}</td>
                      <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{log.target_table ? `${log.target_table}#${log.target_id}` : '–'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
