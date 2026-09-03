export default function LoadingSpinner({ full = false, size = 'md' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-7 h-7', lg: 'w-10 h-10' }

  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <svg className={`animate-spin ${sizes[size]}`} fill="none" viewBox="0 0 24 24"
        style={{ color: '#F5C518' }}>
        <circle className="opacity-20" cx="12" cy="12" r="10"
          stroke="currentColor" strokeWidth="3" />
        <path className="opacity-90" fill="currentColor"
          d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      {full && (
        <p className="text-sm font-medium text-gray-400">Loading…</p>
      )}
    </div>
  )

  if (full) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F3F4F6' }}>
        {spinner}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-12">
      {spinner}
    </div>
  )
}
