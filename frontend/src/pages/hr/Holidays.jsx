import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - 1 + i) // -1 to +5

// ── Style helpers ─────────────────────────────────────────────────────────────
const TYPE_STYLES = {
  national:   { bg: '#FEF3C7', color: '#B45309', label: 'National'   },
  gazetted:   { bg: '#ECFDF5', color: '#059669', label: 'Gazetted'   },
  restricted: { bg: '#EFF6FF', color: '#2563EB', label: 'Restricted' },
}

const CATEGORY_COLORS = {
  National:  '#B45309',
  Hindu:     '#DC2626',
  Islamic:   '#059669',
  Sikh:      '#7C3AED',
  Buddhist:  '#0891B2',
  Jain:      '#EA580C',
  Christian: '#6366F1',
  Regional:  '#0369A1',
  General:   '#6B7280',
}

function TypeBadge({ type }) {
  const s = TYPE_STYLES[type] || TYPE_STYLES.gazetted
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function CategoryDot({ category }) {
  const color = CATEGORY_COLORS[category] || '#6B7280'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium"
      style={{ color: 'var(--text-secondary)' }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {category}
    </span>
  )
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar({ holidays }) {
  const national   = holidays.filter(h => h.type === 'national').length
  const gazetted   = holidays.filter(h => h.type === 'gazetted').length
  const restricted = holidays.filter(h => h.type === 'restricted').length

  const items = [
    { label: 'Total Holidays',      value: holidays.length, color: '#6B7280' },
    { label: 'National',            value: national,        color: '#B45309' },
    { label: 'Gazetted',            value: gazetted,        color: '#059669' },
    { label: 'Restricted',          value: restricted,      color: '#2563EB' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(item => (
        <div key={item.label} className="card p-4 flex flex-col gap-1">
          <span className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</span>
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function HRHolidays() {
  const [year,     setYear]     = useState(CURRENT_YEAR)
  const [holidays, setHolidays] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [syncing,  setSyncing]  = useState(false)
  const [modal,    setModal]    = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [filter,   setFilter]   = useState('all') // 'all' | 'national' | 'gazetted' | 'restricted'
  const [form, setForm] = useState({
    date: '', name: '', is_optional: false, type: 'gazetted', category: 'General'
  })

  const fetchHolidays = async (y = year) => {
    setLoading(true)
    try {
      const res = await api.get(`/hr/holidays?year=${y}`)
      setHolidays(res.data)
    } catch {
      toast.error('Failed to load holidays')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchHolidays(year) }, [year])

  // ── Sync ────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await api.post(`/hr/holidays/sync/${year}`)
      const { inserted, skipped } = res.data
      if (inserted > 0) {
        toast.success(`✓ Added ${inserted} Indian govt holidays for ${year}${skipped > 0 ? ` (${skipped} already existed)` : ''}`)
      } else {
        toast(`All holidays for ${year} are already up to date`, { icon: 'ℹ️' })
      }
      fetchHolidays(year)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  // ── Manual add ──────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.date || !form.name.trim()) { toast.error('Date and name required'); return }
    setSaving(true)
    try {
      await api.post('/hr/holidays', form)
      toast.success('Holiday added')
      setModal(false)
      setForm({ date: '', name: '', is_optional: false, type: 'gazetted', category: 'General' })
      fetchHolidays(year)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    setDeleting(id)
    try {
      await api.delete(`/hr/holidays/${id}`)
      toast.success('Holiday removed')
      fetchHolidays(year)
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  // ── Filtered list ───────────────────────────────────────────────
  const filtered = filter === 'all' ? holidays : holidays.filter(h => h.type === filter)

  // Group by month for display
  const byMonth = filtered.reduce((acc, h) => {
    const month = new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    if (!acc[month]) acc[month] = []
    acc[month].push(h)
    return acc
  }, {})

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6 max-w-5xl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Holiday Calendar</h1>
          <p className="page-subtitle">Indian Government holidays — auto-updated by year</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Year selector */}
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="input w-28 text-sm"
            style={{ paddingTop: '0.45rem', paddingBottom: '0.45rem' }}>
            {YEAR_OPTIONS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
            style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}
            onMouseEnter={e => { if (!syncing) e.currentTarget.style.background = '#DBEAFE' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#EFF6FF' }}>
            {syncing ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Syncing…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync {year}
              </>
            )}
          </button>

          {/* Manual add */}
          <button onClick={() => setModal(true)} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Holiday
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <StatsBar holidays={holidays} />

      {/* ── Filter tabs ── */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
        style={{ backgroundColor: 'var(--bg-surface)' }}>
        {[
          { key: 'all',        label: 'All' },
          { key: 'national',   label: 'National' },
          { key: 'gazetted',   label: 'Gazetted' },
          { key: 'restricted', label: 'Restricted' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={filter === tab.key
              ? { backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
              : { color: 'var(--text-muted)' }}>
            {tab.label}
            <span className="ml-1.5 text-xs opacity-60">
              {tab.key === 'all' ? holidays.length : holidays.filter(h => h.type === tab.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* ── Holiday list ── */}
      {filtered.length === 0 ? (
        <div className="card py-16 text-center">
          <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
            style={{ backgroundColor: 'var(--bg-surface)' }}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"
              strokeWidth={1.5} style={{ color: 'var(--border)' }}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            No holidays for {year}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Click <strong>Sync {year}</strong> to auto-populate all Indian government holidays
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byMonth).map(([month, list]) => (
            <div key={month} className="card p-0 overflow-hidden">
              {/* Month header */}
              <div className="px-5 py-3 flex items-center justify-between"
                style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-light)' }}>
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{month}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{list.length} holiday{list.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
                {list.map((h, i) => {
                  const d   = new Date(h.date + 'T00:00:00')
                  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
                  const dd  = String(d.getDate()).padStart(2, '0')
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6

                  return (
                    <div key={h.id}
                      className="flex items-center gap-4 px-5 py-3.5 transition-colors"
                      style={{ backgroundColor: isWeekend ? 'rgba(239,68,68,0.03)' : undefined }}>

                      {/* Date block */}
                      <div className="w-12 text-center flex-shrink-0">
                        <p className="text-xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{dd}</p>
                        <p className="text-xs font-semibold uppercase tracking-wider"
                          style={{ color: isWeekend ? '#EF4444' : 'var(--text-muted)' }}>{day}</p>
                      </div>

                      {/* Divider */}
                      <div className="w-px h-10 flex-shrink-0" style={{ backgroundColor: 'var(--border-light)' }} />

                      {/* Name + category */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{h.name}</p>
                        <CategoryDot category={h.category || 'General'} />
                      </div>

                      {/* Type badge */}
                      <TypeBadge type={h.type || (h.is_optional ? 'restricted' : 'gazetted')} />

                      {/* Weekend indicator */}
                      {isWeekend && (
                        <span className="hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ background: '#FEE2E2', color: '#EF4444' }}>
                          Weekend
                        </span>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(h.id)}
                        disabled={deleting === h.id}
                        title="Remove holiday"
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-50"
                        style={{ background: '#FEF2F2', color: '#DC2626' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = '#fff' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626' }}>
                        {deleting === h.id
                          ? <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                          : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        }
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Sync info banner ── */}
      <div className="flex items-start gap-3 p-4 rounded-xl"
        style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" style={{ color: '#2563EB' }}>
          <path fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd" />
        </svg>
        <p className="text-sm" style={{ color: '#1D4ED8' }}>
          <strong>Auto-sync</strong> populates all Indian Government gazetted &amp; restricted holidays
          including Holi, Diwali, Eid, Dussehra and more — calculated year-by-year using the Indian calendar.
          Existing holidays are never overwritten. Use <strong>Sync {year}</strong> at the start of each year.
        </p>
      </div>

      {/* ── Manual Add modal ── */}
      <Modal open={modal} onClose={() => setModal(false)} title="Add Holiday" size="sm">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input"
              value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
          </div>

          <div>
            <label className="label">Holiday Name</label>
            <input type="text" className="input" placeholder="e.g. Pongal"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type}
                onChange={e => setForm(f => ({
                  ...f, type: e.target.value,
                  is_optional: e.target.value === 'restricted'
                }))}>
                <option value="national">National</option>
                <option value="gazetted">Gazetted</option>
                <option value="restricted">Restricted</option>
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {['National','Hindu','Islamic','Sikh','Buddhist','Jain','Christian','Regional','General']
                  .map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Adding…' : 'Add Holiday'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
