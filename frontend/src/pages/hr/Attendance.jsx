import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import { fmt12 } from '../../utils/time'

const STATUS_STYLE = {
  present:  { bg: 'bg-emerald-500', text: 'text-white',    short: 'P',  label: 'Present',  hex: '#059669' },
  late:     { bg: 'bg-amber-400',   text: 'text-white',    short: 'L',  label: 'Late',     hex: '#D97706' },
  absent:   { bg: 'bg-red-400',     text: 'text-white',    short: 'A',  label: 'Absent',   hex: '#DC2626' },
  half_day: { bg: 'bg-orange-400',  text: 'text-white',    short: 'H',  label: 'Half Day', hex: '#EA580C' },
  on_leave: { bg: 'bg-blue-400',    text: 'text-white',    short: 'OL', label: 'On Leave', hex: '#2563EB' },
  holiday:  { bg: 'bg-purple-400',  text: 'text-white',    short: 'HL', label: 'Holiday',  hex: '#7C3AED' },
  weekend:  { bg: 'bg-gray-200',    text: 'text-gray-400', short: '–',  label: 'Weekend',  hex: '#9CA3AF' },
}

// Format total_working_minutes → "Xh YYm"
function fmtMins(mins) {
  if (!mins || mins <= 0) return '–'
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`
}

// ── Day-cell popover ──────────────────────────────────────────────────────────
function DayPopover({ r, dateStr, status, isFut, onClose }) {
  const sv   = STATUS_STYLE[status]
  const logs = r?.logs || []

  // Build session pairs: [{ in: ts, out: ts|null }, …]
  const sessions = []
  let openIn = null
  for (const log of logs) {
    if (log.action === 'check_in')  { openIn = log.timestamp }
    if (log.action === 'check_out' && openIn) {
      sessions.push({ in: openIn, out: log.timestamp })
      openIn = null
    }
  }
  if (openIn) sessions.push({ in: openIn, out: null }) // still clocked in

  const statusReason = () => {
    if (!r) return null
    const first = r.first_check_in || r.check_in
    if (!first) return null
    const labels = { present: 'On time', late: `Late — first in at ${fmt12(first)}`, half_day: `Half day — first in at ${fmt12(first)}` }
    return labels[status] || null
  }

  return (
    <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-1 w-64 rounded-xl shadow-xl border text-xs"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-light)', minWidth: 220 }}
      onMouseLeave={onClose}>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 rounded-t-xl"
        style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-light)' }}>
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          {new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
        {sv && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: sv.hex + '22', color: sv.hex }}>{sv.label}</span>
        )}
      </div>

      <div className="p-3 space-y-2.5">
        {/* Status reason */}
        {statusReason() && (
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{statusReason()}</p>
        )}

        {/* Sessions */}
        {sessions.length > 0 ? (
          <div className="space-y-1.5">
            {sessions.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                  style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>{i + 1}</span>
                <span style={{ color: '#059669' }}>{fmt12(s.in)}</span>
                <span style={{ color: 'var(--text-muted)' }}>→</span>
                {s.out
                  ? <span style={{ color: '#DC2626' }}>{fmt12(s.out)}</span>
                  : <span className="italic" style={{ color: 'var(--text-muted)' }}>still in</span>
                }
              </div>
            ))}
          </div>
        ) : (
          !isFut && <p style={{ color: 'var(--text-muted)' }}>No check-in recorded</p>
        )}

        {/* Total */}
        {r?.total_working_minutes > 0 && (
          <div className="flex items-center justify-between pt-1"
            style={{ borderTop: '1px solid var(--border-light)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Total worked</span>
            <span className="font-bold" style={{ color: '#059669' }}>{fmtMins(r.total_working_minutes)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Employee detail modal ─────────────────────────────────────────────────────
function EmployeeDetailModal({ emp, year, month, onClose }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  useEffect(() => {
    if (!emp) return
    setLoading(true)
    api.get(`/hr/attendance/${emp.id}/${year}/${month}`)
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load detail'))
      .finally(() => setLoading(false))
  }, [emp, year, month])

  const STATUS_BADGE = {
    present:  { bg: '#ECFDF5', color: '#059669' },
    late:     { bg: '#FFFBEB', color: '#D97706' },
    absent:   { bg: '#FEF2F2', color: '#DC2626' },
    half_day: { bg: '#FFF7ED', color: '#EA580C' },
    on_leave: { bg: '#EFF6FF', color: '#2563EB' },
    holiday:  { bg: '#F5F3FF', color: '#7C3AED' },
    weekend:  { bg: 'var(--bg-surface)', color: 'var(--text-muted)' },
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  const now         = new Date()

  return (
    <Modal open={!!emp} onClose={onClose}
      title={`${emp?.name} — ${months[month - 1]} ${year}`} size="lg">
      {loading ? (
        <div className="py-12 flex items-center justify-center"><LoadingSpinner /></div>
      ) : !data ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No data</p>
      ) : (
        <div className="space-y-4">
          {/* Employee info strip */}
          <div className="flex items-center gap-3 p-3 rounded-xl"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}>
              {emp?.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{data.employee?.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {data.employee?.employee_id} · {data.employee?.department || 'N/A'} · {data.employee?.designation || ''}
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="table-wrapper max-h-[60vh] overflow-y-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th><th>Day</th><th>Status</th>
                  <th>Sessions</th><th>Hours</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d       = i + 1
                  const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                  const date    = new Date(year, month - 1, d)
                  const dow     = date.getDay()
                  const isW     = dow === 0 || dow === 6
                  const isFut   = date > now
                  const rec     = data.records?.find(r => r.date === dateStr)
                  const status  = rec?.status || (isW ? 'weekend' : (isFut ? null : 'absent'))
                  const bs      = STATUS_BADGE[status] || { bg: 'var(--bg-surface)', color: 'var(--text-muted)' }
                  const label   = STATUS_STYLE[status]?.label || (isFut ? '–' : 'Absent')

                  // Parse session timestamps from pipe-delimited strings
                  const checkIns  = rec?.check_in_times  ? rec.check_in_times.split('|').filter(Boolean)  : []
                  const checkOuts = rec?.check_out_times ? rec.check_out_times.split('|').filter(Boolean) : []
                  const sessionCount = checkIns.length

                  const sessionStr = checkIns.length > 0
                    ? checkIns.map((ci, idx) => `${fmt12(ci)}→${checkOuts[idx] ? fmt12(checkOuts[idx]) : '…'}`).join('  ')
                    : '–'

                  return (
                    <tr key={d} className={isFut ? 'opacity-30' : ''}>
                      <td className="font-medium text-xs">
                        {date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow]}
                      </td>
                      <td>
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: bs.bg, color: bs.color }}>{label}</span>
                      </td>
                      <td className="text-xs max-w-[180px] truncate" style={{ color: 'var(--text-secondary)' }}
                        title={sessionStr}>
                        {sessionCount > 1
                          ? <span><span style={{ color: '#7C3AED', fontWeight: 700 }}>×{sessionCount} </span>{sessionStr}</span>
                          : sessionStr}
                      </td>
                      <td className="text-xs font-semibold" style={{ color: rec?.total_working_minutes > 0 ? '#059669' : 'var(--text-muted)' }}>
                        {fmtMins(rec?.total_working_minutes)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── HR Attendance Grid ────────────────────────────────────────────────────────
export default function HRAttendance() {
  const now = new Date()
  const [year,      setYear]      = useState(now.getFullYear())
  const [month,     setMonth]     = useState(now.getMonth() + 1)
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [popover,   setPopover]   = useState(null)  // { empId, dateStr }
  const [detailEmp, setDetailEmp] = useState(null)  // employee object for modal

  const fetchGrid = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/hr/attendance?year=${year}&month=${month}`)
      setData(res.data)
    } catch { toast.error('Failed to load attendance grid') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchGrid() }, [year, month])

  const exportCSV = () => {
    if (!data) return
    const { employees, attendance } = data
    const daysInMonth = new Date(year, month, 0).getDate()
    const headers = ['Employee','ID','Department',...Array.from({ length: daysInMonth }, (_,i) => i+1)]
    const rows = employees.map(emp => {
      const rec = attendance[emp.id] || {}
      const days = Array.from({ length: daysInMonth }, (_,i) => {
        const d = `${year}-${String(month).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`
        return rec[d]?.status || '–'
      })
      return [emp.name, emp.employee_id, emp.department||'', ...days]
    })
    const csv  = [headers,...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = `attendance-${year}-${String(month).padStart(2,'0')}.csv`
    a.click(); URL.revokeObjectURL(url); toast.success('CSV exported')
  }

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  if (loading) return <LoadingSpinner />
  if (!data) return null
  const { employees, attendance } = data
  const daysInMonth = new Date(year, month, 0).getDate()

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Attendance Grid</h1>
          <p className="page-subtitle">Company-wide monthly attendance — click any cell or name for details</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="input w-28 text-sm" value={month} onChange={e => setMonth(+e.target.value)}>
            {months.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
          </select>
          <select className="input w-24 text-sm" value={year} onChange={e => setYear(+e.target.value)}>
            {[now.getFullYear()-1, now.getFullYear()].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={exportCSV} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_STYLE).map(([k,v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${v.bg} ${v.text}`}>{v.short}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{v.label}</span>
          </div>
        ))}
        <span className="text-xs ml-2 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          · Click cell or name for details
        </span>
      </div>

      {employees.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No active employees found</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-light)' }}>
                  <th className="sticky left-0 z-10 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap min-w-[180px]"
                    style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)', borderRight: '1px solid var(--border-light)' }}>
                    Employee
                  </th>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const d   = i + 1
                    const dow = new Date(year, month-1, d).getDay()
                    const isW = dow === 0 || dow === 6
                    return (
                      <th key={d} className="px-0.5 py-2 text-center w-9"
                        style={{ backgroundColor: isW ? 'var(--bg-surface-2)' : 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                        <div className="font-semibold">{d}</div>
                        <div className="text-[9px] font-normal">{['Su','Mo','Tu','We','Th','Fr','Sa'][dow]}</div>
                      </th>
                    )
                  })}
                  <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap"
                    style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface)' }}>P</th>
                  <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap"
                    style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface)' }}>A</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const rec = attendance[emp.id] || {}
                  let presentCount = 0, absentCount = 0

                  const cells = Array.from({ length: daysInMonth }, (_, i) => {
                    const d       = i + 1
                    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                    const r       = rec[dateStr]
                    const dow     = new Date(year, month-1, d).getDay()
                    const isW     = dow === 0 || dow === 6
                    const isFut   = new Date(year, month-1, d) > now
                    const status  = r?.status || (isW ? 'weekend' : (isFut ? null : 'absent'))
                    if (status === 'present' || status === 'late') presentCount++
                    if (status === 'absent') absentCount++
                    return { d, dateStr, status, r, isW, isFut }
                  })

                  return (
                    <tr key={emp.id}
                      style={{ borderBottom: '1px solid var(--border-light)' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor='var(--bg-surface)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'}>

                      {/* Employee name — click to open detail modal */}
                      <td className="sticky left-0 z-10 px-4 py-2.5 whitespace-nowrap cursor-pointer"
                        style={{ backgroundColor: 'var(--bg-card)', borderRight: '1px solid var(--border-light)' }}
                        onClick={() => setDetailEmp(emp)}>
                        <div className="flex items-center gap-2.5 group">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                            style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}>
                            {emp.name[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-xs group-hover:underline"
                              style={{ color: 'var(--text-primary)' }}>{emp.name}</p>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{emp.department || '–'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Day cells */}
                      {cells.map(({ dateStr, status, r, isW, isFut }) => {
                        const sv       = STATUS_STYLE[status]
                        const isOpen   = popover?.empId === emp.id && popover?.dateStr === dateStr
                        const hasLogs  = r?.logs?.length > 0
                        const multiSession = (r?.logs || []).filter(l => l.action === 'check_in').length > 1

                        return (
                          <td key={dateStr}
                            className="px-0.5 py-1 text-center relative"
                            style={{ backgroundColor: isW ? 'var(--bg-surface)' : 'inherit' }}
                            onMouseEnter={() => !isFut && setPopover({ empId: emp.id, dateStr })}
                            onMouseLeave={() => setPopover(null)}>

                            {isFut && !status ? (
                              <span className="w-7 h-7 flex items-center justify-center mx-auto"
                                style={{ color: 'var(--border)' }}>·</span>
                            ) : (
                              <span className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto font-bold text-[10px] cursor-pointer relative
                                ${sv ? `${sv.bg} ${sv.text}` : 'bg-gray-200 text-gray-400'}`}>
                                {sv?.short || '–'}
                                {/* Multi-session indicator dot */}
                                {multiSession && (
                                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-purple-500 border border-white" />
                                )}
                              </span>
                            )}

                            {/* Popover */}
                            {isOpen && (
                              <DayPopover
                                r={r} dateStr={dateStr} status={status} isFut={isFut}
                                onClose={() => setPopover(null)}
                              />
                            )}
                          </td>
                        )
                      })}

                      <td className="px-3 py-2 text-center font-bold text-xs" style={{ color: '#059669' }}>{presentCount}</td>
                      <td className="px-3 py-2 text-center font-bold text-xs" style={{ color: '#DC2626' }}>{absentCount}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Employee detail modal */}
      <EmployeeDetailModal
        emp={detailEmp}
        year={year}
        month={month}
        onClose={() => setDetailEmp(null)}
      />
    </div>
  )
}
