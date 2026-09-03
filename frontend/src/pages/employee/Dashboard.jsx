import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import { fmt12 } from '../../utils/time'

const STATUS_COLORS = {
  present: 'bg-emerald-500', late: 'bg-amber-400', absent: 'bg-red-400',
  half_day: 'bg-orange-400', on_leave: 'bg-blue-400', holiday: 'bg-purple-400', weekend: 'bg-gray-200',
}
const STATUS_LABEL = {
  present: 'Present', late: 'Late', absent: 'Absent',
  half_day: 'Half Day', on_leave: 'On Leave', holiday: 'Holiday', weekend: 'Weekend',
}
const STATUS_TEXT = {
  present: 'text-white', late: 'text-white', absent: 'text-white',
  half_day: 'text-white', on_leave: 'text-white', holiday: 'text-white', weekend: 'text-gray-400',
}

// ── Mini calendar (unchanged) ─────────────────────────────────────────────────
function MiniCalendar({ records, year, month }) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDay    = new Date(year, month - 1, 1).getDay()
  const recordMap   = {}
  records.forEach(r => { recordMap[parseInt(r.date.split('-')[2])] = r.status })
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      <div className="grid grid-cols-7 mb-2">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center text-xs font-semibold py-1" style={{ color: 'var(--text-muted)' }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />
          const dow       = (firstDay + day - 1) % 7
          const isWeekend = dow === 0 || dow === 6
          const status    = recordMap[day] || (isWeekend ? 'weekend' : 'absent')
          const today     = new Date()
          const isToday   = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day
          const isFuture  = new Date(year, month - 1, day) > today
          return (
            <div key={day} title={STATUS_LABEL[status] || status}
              className={`flex items-center justify-center rounded-lg h-8 text-xs font-medium transition-transform hover:scale-110 cursor-default
                ${isFuture ? 'text-gray-300' : `${STATUS_COLORS[status]} ${STATUS_TEXT[status]}`}
                ${isToday ? 'ring-2 ring-offset-1 ring-accent-500' : ''}`}
              style={isFuture ? { backgroundColor: 'var(--bg-surface)' } : {}}>
              {day}
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--border-light)' }}>
        {[['present','Present','bg-emerald-500'],['late','Late','bg-amber-400'],['absent','Absent','bg-red-400'],['on_leave','On Leave','bg-blue-400'],['weekend','Weekend','bg-gray-200']].map(([k,v,c]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${c}`} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Today's check-in/out timeline ─────────────────────────────────────────────
function TodayTimeline({ logs }) {
  if (!logs || logs.length === 0) return null
  return (
    <div className="space-y-1.5">
      {logs.map((log, i) => {
        const isIn = log.action === 'check_in'
        return (
          <div key={i} className="flex items-center gap-2.5">
            {/* dot + connector */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: isIn ? '#059669' : '#DC2626' }} />
              {i < logs.length - 1 && (
                <div className="w-px flex-1 mt-0.5" style={{ height: 14, backgroundColor: 'var(--border-light)' }} />
              )}
            </div>
            <span className="text-xs font-semibold" style={{ color: isIn ? '#059669' : '#DC2626' }}>
              {isIn ? 'Checked in' : 'Checked out'}
            </span>
            <span className="text-xs ml-auto font-mono" style={{ color: 'var(--text-muted)' }}>
              {fmt12(log.timestamp)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function EmpDashboard() {
  const { user } = useAuth()
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  const [today,    setToday]    = useState(null)
  const [summary,  setSummary]  = useState(null)
  const [calendar, setCalendar] = useState([])
  const [balances, setBalances] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [clocking, setClocking] = useState(false)

  const fetchAll = async () => {
    try {
      const [t, s, cal, bal] = await Promise.all([
        api.get('/attendance/today'),
        api.get(`/attendance/summary?year=${year}&month=${month}`),
        api.get(`/attendance/my?year=${year}&month=${month}`),
        api.get(`/leave/balances?year=${year}`),
      ])
      setToday(t.data); setSummary(s.data); setCalendar(cal.data); setBalances(bal.data)
    } catch { toast.error('Failed to load dashboard data') }
    finally   { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const handleClock = async (action) => {
    setClocking(true)
    try {
      const res = await api.post(`/attendance/${action}`)
      toast.success(res.data.message)
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error')
    } finally {
      setClocking(false)
    }
  }

  if (loading) return <LoadingSpinner />

  // Determine button state from last_action (multi-session aware)
  const lastAction  = today?.last_action   // 'check_in' | 'check_out' | null
  const canCheckIn  = lastAction !== 'check_in'   // no open session → show check-in
  const canCheckOut = lastAction === 'check_in'   // open session → show check-out
  const logs        = today?.logs || []

  const monthName = now.toLocaleString('default', { month: 'long' })
  const greeting  = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  const statusConfig = {
    present:  { bg: '#ECFDF5', color: '#059669', label: 'Present' },
    late:     { bg: '#FFFBEB', color: '#D97706', label: 'Late' },
    on_leave: { bg: '#EFF6FF', color: '#2563EB', label: 'On Leave' },
    absent:   { bg: '#FEF2F2', color: '#DC2626', label: 'Absent' },
    half_day: { bg: '#FFF7ED', color: '#EA580C', label: 'Half Day' },
  }
  const sc = statusConfig[today?.status] || { bg: 'var(--bg-surface-2)', color: 'var(--text-muted)', label: 'Not Marked' }

  // Total worked today formatted as Xh YYm
  const totalMins = today?.total_working_minutes || 0
  const workedStr = totalMins > 0
    ? `${Math.floor(totalMins / 60)}h ${String(totalMins % 60).padStart(2, '0')}m`
    : null

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="page-title">{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="page-subtitle">{now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* ── Clock card ── */}
        <div className="card flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Today's Status</h3>
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
          </div>

          {/* First check-in / last check-out summary */}
          <div className="grid grid-cols-2 gap-3">
            {[
              ['First In',  fmt12(today?.first_check_in  || today?.check_in),  '#059669'],
              ['Last Out',  fmt12(today?.last_check_out  || today?.check_out), '#DC2626'],
            ].map(([label, val, col]) => (
              <div key={label} className="rounded-xl p-4"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1"
                  style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className="text-xl font-bold"
                  style={{ color: val !== '–' ? col : 'var(--border)' }}>{val || '––:––'}</p>
              </div>
            ))}
          </div>

          {/* Total worked today */}
          {workedStr && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2} style={{ color: '#059669' }}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Worked today: <span style={{ color: '#059669' }}>{workedStr}</span>
                {canCheckOut && <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>(session open)</span>}
              </span>
            </div>
          )}

          {/* Single smart toggle button */}
          <button
            onClick={() => handleClock(canCheckIn ? 'check-in' : 'check-out')}
            disabled={clocking}
            className="w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            style={canCheckIn
              ? { background: '#ECFDF5', color: '#059669', border: '1px solid #6EE7B7' }
              : { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5' }}>
            {clocking ? '…' : canCheckIn ? '↑ Check In' : '↓ Check Out'}
          </button>

          {/* Today's activity timeline */}
          {logs.length > 0 && (
            <div className="pt-3" style={{ borderTop: '1px solid var(--border-light)' }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3"
                style={{ color: 'var(--text-muted)' }}>Today's Activity</p>
              <TodayTimeline logs={logs} />
            </div>
          )}
        </div>

        {/* ── Monthly summary ── */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{monthName} Summary</h3>
            <Link to="/employee/attendance"
              className="text-xs font-semibold hover:opacity-80 transition-colors"
              style={{ color: '#F5C518' }}>View all →</Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Present', value: (summary?.present||0)+(summary?.late||0), color: '#059669', bg: '#ECFDF5' },
              { label: 'Absent',  value: summary?.absent   || 0, color: '#DC2626', bg: '#FEF2F2' },
              { label: 'On Leave',value: summary?.on_leave || 0, color: '#2563EB', bg: '#EFF6FF' },
              { label: 'Late',    value: summary?.late     || 0, color: '#D97706', bg: '#FFFBEB' },
              { label: 'Half Day',value: summary?.half_day || 0, color: '#EA580C', bg: '#FFF7ED' },
            ].map(item => (
              <div key={item.label} className="rounded-xl p-3 text-center" style={{ background: item.bg }}>
                <p className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</p>
                <p className="text-xs font-medium mt-0.5" style={{ color: item.color, opacity: 0.75 }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Calendar ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <div className="accent-bar">
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{monthName} {year} — Attendance Calendar</h3>
          </div>
          <Link to="/employee/attendance"
            className="text-xs font-semibold hover:opacity-80 transition-colors"
            style={{ color: '#F5C518' }}>Full view →</Link>
        </div>
        <MiniCalendar records={calendar} year={year} month={month} />
      </div>

      {/* ── Leave balances ── */}
      {balances.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <div className="accent-bar">
              <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Leave Balances — {year}</h3>
            </div>
            <Link to="/employee/leave"
              className="text-xs font-semibold hover:opacity-80 transition-colors"
              style={{ color: '#F5C518' }}>Apply →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {balances.map(b => (
              <div key={b.id} className="rounded-xl p-4"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--text-muted)' }}>{b.leave_name}</p>
                <p className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{b.remaining}</p>
                <div className="progress-track mb-2">
                  <div className="progress-fill"
                    style={{ width: `${b.allocated > 0 ? (b.remaining / b.allocated) * 100 : 0}%` }} />
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.used} used of {b.allocated}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
