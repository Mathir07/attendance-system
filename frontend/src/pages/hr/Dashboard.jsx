import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import LoadingSpinner from '../../components/LoadingSpinner'

function StatCard({ label, value, sub, valueColor = 'var(--text-primary)', iconBg, icon, to }) {
  const content = (
    <div className="card-hover group cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
          {icon}
        </div>
        {to && (
          <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
      <p className="text-3xl font-bold tracking-tight mb-1" style={{ color: valueColor }}>{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
  return to ? <Link to={to}>{content}</Link> : content
}

export default function HRDashboard() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/hr/dashboard')
      .then(res => setStats(res.data))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const pct   = stats.attendance_pct
  const circumference = 2 * Math.PI * 54
  const dash  = (pct / 100) * circumference

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Hero — always dark navy regardless of theme */}
      <div className="rounded-2xl geo-bg overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg, #090B1A 0%, #0D1020 60%, #111426 100%)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <svg className="absolute right-0 top-0 h-full opacity-40" viewBox="0 0 400 200" preserveAspectRatio="xMaxYMid slice">
            <polygon points="400,0 200,0 400,200" fill="rgba(245,197,24,0.05)" />
            <polygon points="400,0 300,0 400,100" fill="rgba(245,197,24,0.04)" />
            <line x1="200" y1="0" x2="400" y2="200" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
            <circle cx="380" cy="20" r="60" fill="none" stroke="rgba(245,197,24,0.06)" strokeWidth="1"/>
          </svg>
        </div>
        <div className="relative z-10 p-6 md:p-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#F5C518' }}>HR Dashboard</p>
              <h1 className="text-2xl font-bold text-white tracking-tight">Overview</h1>
              <p className="text-sm mt-1" style={{ color: '#5B6B8A' }}>{today}</p>
            </div>
            <div className="flex items-center gap-4 rounded-xl px-5 py-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="relative w-16 h-16">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                  <circle cx="60" cy="60" r="54" fill="none" stroke="#F5C518" strokeWidth="8"
                    strokeDasharray={`${dash} ${circumference - dash}`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">{pct}%</span>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Today's Attendance</p>
                <p className="text-xs mt-0.5" style={{ color: '#5B6B8A' }}>{stats.present_today} present · {stats.on_leave_today} on leave</p>
                <p className="text-xs mt-0.5" style={{ color: '#5B6B8A' }}>{stats.absent_today} absent · {stats.total_employees} total</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Employees" value={stats.total_employees}
          iconBg="rgba(9,11,26,0.08)"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: 'var(--text-primary)' }}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          to="/hr/employees" />
        <StatCard label="Present Today" value={stats.present_today} valueColor="#059669"
          iconBg="#ECFDF5"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        <StatCard label="Pending Leaves" value={stats.pending_leave} valueColor="#D97706"
          iconBg="#FFFBEB"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#D97706" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
          to="/hr/leave" />
        <StatCard label="Pending Permissions" value={stats.pending_permission} valueColor="#EA580C"
          iconBg="#FFF7ED"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#EA580C" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          to="/hr/permission" />
      </div>

      {/* Quick actions */}
      <div className="card">
        <div className="accent-bar mb-5">
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Quick Actions</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Add Employee',    to: '/hr/employees',  icon: '👤' },
            { label: 'View Attendance', to: '/hr/attendance', icon: '📅' },
            { label: 'Upload Payslip',  to: '/hr/payslips',   icon: '📄' },
            { label: 'Manage Holidays', to: '/hr/holidays',   icon: '🎉' },
          ].map(q => (
            <Link key={q.to} to={q.to}
              className="flex items-center gap-3 p-4 rounded-xl text-sm font-medium transition-all duration-150 hover:shadow-card-hover group"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
              <span className="text-xl">{q.icon}</span>
              <span className="group-hover:translate-x-0.5 transition-transform">{q.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
