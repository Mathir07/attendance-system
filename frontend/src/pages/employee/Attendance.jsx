import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import LoadingSpinner from '../../components/LoadingSpinner'
import { fmt12 } from '../../utils/time'

const STATUS_COLORS = {
  present: 'bg-emerald-500', late: 'bg-amber-400', absent: 'bg-red-400',
  half_day: 'bg-orange-400', on_leave: 'bg-blue-400', holiday: 'bg-purple-400', weekend: 'bg-gray-200',
}
const STATUS_TEXT = {
  present: 'text-white', late: 'text-white', absent: 'text-white',
  half_day: 'text-white', on_leave: 'text-white', holiday: 'text-white', weekend: 'text-gray-400',
}
const STATUS_LABEL = {
  present: 'Present', late: 'Late', absent: 'Absent',
  half_day: 'Half Day', on_leave: 'On Leave', holiday: 'Holiday', weekend: 'Weekend',
}
const STATUS_BADGE_STYLE = {
  present:  { bg: '#ECFDF5', color: '#059669' },
  late:     { bg: '#FFFBEB', color: '#D97706' },
  absent:   { bg: '#FEF2F2', color: '#DC2626' },
  half_day: { bg: '#FFF7ED', color: '#EA580C' },
  on_leave: { bg: '#EFF6FF', color: '#2563EB' },
  holiday:  { bg: '#F5F3FF', color: '#7C3AED' },
  weekend:  { bg: 'var(--bg-surface)', color: 'var(--text-muted)' },
}

export default function EmpAttendance() {
  const now = new Date()
  const [year,    setYear]    = useState(now.getFullYear())
  const [month,   setMonth]   = useState(now.getMonth() + 1)
  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view,    setView]    = useState('calendar')

  const fetchData = async () => {
    setLoading(true)
    try {
      const [recs, sum] = await Promise.all([
        api.get(`/attendance/my?year=${year}&month=${month}`),
        api.get(`/attendance/summary?year=${year}&month=${month}`),
      ])
      setRecords(recs.data); setSummary(sum.data)
    } catch { toast.error('Failed to load attendance') }
    finally   { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [year, month])

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const years  = [now.getFullYear() - 1, now.getFullYear()]
  const recordMap = {}
  records.forEach(r => { recordMap[parseInt(r.date.split('-')[2])] = r })
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDay    = new Date(year, month - 1, 1).getDay()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const summaryItems = [
    { label: 'Present', value: summary?.present || 0, color: '#059669', bg: '#ECFDF5' },
    { label: 'Late',    value: summary?.late     || 0, color: '#D97706', bg: '#FFFBEB' },
    { label: 'Absent',  value: summary?.absent   || 0, color: '#DC2626', bg: '#FEF2F2' },
    { label: 'Half Day',value: summary?.half_day || 0, color: '#EA580C', bg: '#FFF7ED' },
    { label: 'On Leave',value: summary?.on_leave || 0, color: '#2563EB', bg: '#EFF6FF' },
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">Your monthly attendance record</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="input w-28 text-sm" value={month} onChange={e => setMonth(+e.target.value)}>
            {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select className="input w-24 text-sm" value={year} onChange={e => setYear(+e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {['calendar','list'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-4 py-2 text-xs font-semibold capitalize transition-all duration-150"
                style={view === v
                  ? { background: '#090B1A', color: '#fff' }
                  : { backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-5 gap-3">
          {summaryItems.map(s => (
            <div key={s.label} className="card py-4 text-center" style={{ background: s.bg, borderColor: 'transparent', boxShadow: 'none' }}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs font-medium mt-1" style={{ color: s.color, opacity: 0.75 }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? <LoadingSpinner /> : (
        <div className="card">
          {view === 'calendar' ? (
            <>
              <div className="grid grid-cols-7 mb-3">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} className="text-center text-xs font-semibold py-1" style={{ color: 'var(--text-muted)' }}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((day, i) => {
                  if (!day) return <div key={`e-${i}`} />
                  const rec = recordMap[day]
                  const dow = (firstDay + day - 1) % 7
                  const isWeekend = dow === 0 || dow === 6
                  const status = rec?.status || (isWeekend ? 'weekend' : 'absent')
                  const isToday  = now.getFullYear()===year && now.getMonth()+1===month && now.getDate()===day
                  const isFuture = new Date(year, month-1, day) > now
                  return (
                    <div key={day}
                      title={`${STATUS_LABEL[status]}${rec?.check_in?` | In: ${fmt12(rec.check_in)}`:''}${rec?.check_out?` | Out: ${fmt12(rec.check_out)}`:''}`}
                      className={`flex flex-col items-center justify-center rounded-xl h-16 text-xs font-semibold transition-all cursor-default
                        ${isFuture ? 'text-gray-300' : `${STATUS_COLORS[status]} ${STATUS_TEXT[status]} hover:scale-105`}
                        ${isToday ? 'ring-2 ring-offset-2 ring-accent-500' : ''}`}
                      style={isFuture ? { backgroundColor: 'var(--bg-surface)' } : {}}>
                      <span className="text-sm font-bold">{day}</span>
                      {!isFuture && <span className="text-[9px] opacity-75 leading-tight mt-0.5">{STATUS_LABEL[status]}</span>}
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-4 mt-5 pt-4" style={{ borderTop: '1px solid var(--border-light)' }}>
                {Object.entries(STATUS_LABEL).map(([k,v]) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-sm ${STATUS_COLORS[k]}`} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>Day</th><th>Status</th><th>First In</th><th>Last Out</th><th>Sessions</th><th>Hours</th></tr>
                </thead>
                <tbody>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                    const rec  = recordMap[day]
                    const date = new Date(year, month-1, day)
                    const dow  = date.getDay()
                    const isWeekend = dow===0 || dow===6
                    const status    = rec?.status || (isWeekend ? 'weekend' : 'absent')
                    const isFuture  = date > now

                    // Total worked from total_working_minutes (accurate for multi-session days)
                    const totalMins = rec?.total_working_minutes || 0
                    const hours     = totalMins > 0
                      ? `${Math.floor(totalMins / 60)}h ${String(totalMins % 60).padStart(2,'0')}m`
                      : '–'

                    // Count sessions: each check_in in the logs = 1 session
                    const checkIns = rec?.check_in_times
                      ? rec.check_in_times.split(',').filter(Boolean)
                      : (rec?.first_check_in ? [rec.first_check_in] : [])
                    const sessionCount = checkIns.length

                    const bs = STATUS_BADGE_STYLE[status] || { bg: 'var(--bg-surface)', color: 'var(--text-muted)' }
                    return (
                      <tr key={day} className={isFuture ? 'opacity-30' : ''}>
                        <td className="font-medium">{date.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow]}</td>
                        <td>
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                            style={{ background: bs.bg, color: bs.color }}>
                            {STATUS_LABEL[status]}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{fmt12(rec?.first_check_in || rec?.check_in)}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{fmt12(rec?.last_check_out || rec?.check_out)}</td>
                        <td className="text-center text-xs font-semibold" style={{ color: sessionCount > 1 ? '#7C3AED' : 'var(--text-muted)' }}>
                          {sessionCount > 0 ? `×${sessionCount}` : '–'}
                        </td>
                        <td className="font-medium" style={{ color: 'var(--text-table)' }}>{hours}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
