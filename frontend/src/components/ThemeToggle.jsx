import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle({ compact = false }) {
  const { dark, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium
                 transition-all duration-150 select-none focus:outline-none focus-visible:ring-2
                 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
      style={{
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: '#8A9BB8',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.14)'
        e.currentTarget.style.color = '#fff'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
        e.currentTarget.style.color = '#8A9BB8'
      }}
    >
      {/* Track */}
      <div
        className="relative flex-shrink-0 rounded-full transition-colors duration-300"
        style={{
          width: 34,
          height: 18,
          background: dark ? '#F5C518' : 'rgba(255,255,255,0.15)',
          border: `1px solid ${dark ? '#D97706' : 'rgba(255,255,255,0.2)'}`,
        }}
      >
        {/* Thumb */}
        <div
          className="absolute top-0.5 rounded-full transition-all duration-300 flex items-center justify-center"
          style={{
            width: 14,
            height: 14,
            left: dark ? 17 : 2,
            background: dark ? '#090B1A' : '#fff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}
        >
          {dark ? (
            /* Moon */
            <svg width="8" height="8" viewBox="0 0 24 24" fill="#F5C518">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          ) : (
            /* Sun */
            <svg width="8" height="8" viewBox="0 0 24 24" fill="#F59E0B">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/>
              <line x1="12" y1="21" x2="12" y2="23" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/>
              <line x1="1" y1="12" x2="3" y2="12" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/>
              <line x1="21" y1="12" x2="23" y2="12" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}
        </div>
      </div>

      {!compact && (
        <span className="leading-none">{dark ? 'Dark' : 'Light'}</span>
      )}
    </button>
  )
}
