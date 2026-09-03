import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import LoadingSpinner from '../../components/LoadingSpinner'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function EmpPayslips() {
  const [slips,       setSlips]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [downloading, setDownloading] = useState(null)

  useEffect(() => {
    api.get('/payslip/my')
      .then(res => setSlips(res.data))
      .catch(() => toast.error('Failed to load payslips'))
      .finally(() => setLoading(false))
  }, [])

  const handleDownload = async (slip) => {
    setDownloading(slip.id)
    try {
      const res  = await api.get(`/payslip/download/${slip.id}`, { responseType: 'blob' })
      const url  = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url; link.download = `payslip-${slip.year}-${String(slip.month).padStart(2,'0')}.pdf`
      link.click(); URL.revokeObjectURL(url); toast.success('Payslip downloaded')
    } catch { toast.error('Download failed') }
    finally   { setDownloading(null) }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="page-title">Salary Slips</h1>
        <p className="page-subtitle">Download your monthly payslips</p>
      </div>

      {slips.length === 0 ? (
        <div className="card py-24 text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} style={{ color: 'var(--border)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>No payslips available yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>HR will upload your payslips monthly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {slips.map(slip => (
            <div key={slip.id} className="card-hover group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #090B1A, #1E2540)' }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#F5C518" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}>
                  PDF
                </span>
              </div>
              <h3 className="font-bold text-lg tracking-tight" style={{ color: 'var(--text-primary)' }}>{MONTHS[slip.month - 1]} {slip.year}</h3>
              {slip.net_pay && <p className="text-2xl font-bold mt-1 mb-1" style={{ color: '#059669' }}>₹{Number(slip.net_pay).toLocaleString('en-IN')}</p>}
              <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>Uploaded {new Date(slip.generated_at).toLocaleDateString('en-IN')}</p>
              <button onClick={() => handleDownload(slip)} disabled={downloading === slip.id}
                className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-50"
                style={{ background: '#090B1A', color: '#F5C518', border: '1px solid transparent' }}
                onMouseEnter={e => { if (downloading !== slip.id) { e.currentTarget.style.background = '#111426'; e.currentTarget.style.border = '1px solid rgba(245,197,24,0.3)' }}}
                onMouseLeave={e => { if (downloading !== slip.id) { e.currentTarget.style.background = '#090B1A'; e.currentTarget.style.border = '1px solid transparent' }}}>
                {downloading === slip.id ? (
                  <><svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Downloading…</>
                ) : (
                  <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Download PDF</>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
