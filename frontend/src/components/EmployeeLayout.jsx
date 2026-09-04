import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import ThemeToggle from './ThemeToggle'
import toast from 'react-hot-toast'

const navItems = [
  {
    to: '/employee/dashboard', label: 'Dashboard',
    icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  },
  {
    to: '/employee/attendance', label: 'Attendance',
    icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
  {
    to: '/employee/leave', label: 'Leave',
    icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  },
  {
    to: '/employee/permission', label: 'Permission',
    icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    to: '/employee/payslips', label: 'Payslips',
    icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  {
    to: '/employee/settings', label: 'Settings',
    icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
]

export default function EmployeeLayout() {
  const { user, logout } = useAuth()
  const { dark } = useTheme()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    toast.success('Logged out')
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full geo-bg geo-sidebar"
      style={{ background: 'linear-gradient(180deg, #090B1A 0%, #0D1020 60%, #111426 100%)' }}>

      {/* Brand */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(245,197,24,0.15)', border: '1px solid rgba(245,197,24,0.25)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#F5C518" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm tracking-tight leading-none">KiwiTrack</p>
            <p className="text-xs mt-0.5" style={{ color: '#5B6B8A' }}>Employee Portal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto sidebar-scroll">
        <p className="section-label">Navigation</p>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              isActive
                ? 'nav-item-active flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-150'
                : 'nav-item'
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="w-0.5 h-5 rounded-full flex-shrink-0" style={{ background: '#F5C518' }} />
                )}
                <span style={{ color: isActive ? '#F5C518' : 'inherit' }}>{item.icon}</span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Theme toggle + user + logout */}
      <div className="px-3 pb-4 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '12px' }}>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* User card */}
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
            style={{ background: 'rgba(245,197,24,0.2)', color: '#F5C518' }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-medium truncate leading-tight">{user?.name}</p>
            <p className="text-xs truncate mt-0.5" style={{ color: '#5B6B8A' }}>{user?.designation || 'Employee'}</p>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
          style={{ color: '#5B6B8A' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#5B6B8A'; e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-page)' }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-60 flex-shrink-0 shadow-nav">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex flex-col w-60 z-50 shadow-nav">
            <SidebarContent />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 shadow-sm"
          style={{ background: '#090B1A', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={() => setSidebarOpen(true)} style={{ color: '#8A9BB8' }}
            className="hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-white text-sm tracking-tight">KiwiTrack</span>
          {/* Mobile theme toggle — compact icon only */}
          <ThemeToggle compact />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
