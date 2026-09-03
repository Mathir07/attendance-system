import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function HRPayslips() {
  const [employees,    setEmployees]    = useState([])
  const [selected,     setSelected]     = useState(null)
  const [slips,        setSlips]        = useState([])
  const [loadingEmps,  setLoadingEmps]  = useState(true)
  const [loadingSlips, setLoadingSlips] = useState(false)
  const [modal,        setModal]        = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const [downloading,  setDownloading]  = useState(null)
  const [search,       setSearch]       = useState('')
  const fileRef = useRef()
  const [form, setForm] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), net_pay: '', file: null })

  useEffect(() => {
    api.get('/hr/employees').then(res => setEmployees(res.data)).catch(() => toast.error('Failed to load employees')).finally(() => setLoadingEmps(false))
  }, [])

  useEffect(() => {
    if (!selected) { setSlips([]); return }
    setLoadingSlips(true)
    api.get(`/payslip/employee/${selected.id}`).then(res => setSlips(res.data)).catch(() => toast.error('Failed to load payslips')).finally(() => setLoadingSlips(false))
  }, [selected])

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!selected)  { toast.error('Select an employee first'); return }
    if (!form.file) { toast.error('Select a PDF file'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('payslip', form.file); fd.append('month', form.month); fd.append('year', form.year)
      if (form.net_pay) fd.append('net_pay', form.net_pay)
      await api.post(`/payslip/upload/${selected.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Payslip uploaded successfully')
      setModal(false); setForm(f => ({ ...f, file: null, net_pay: '' }))
      if (fileRef.current) fileRef.current.value = ''
      const res = await api.get(`/payslip/employee/${selected.id}`); setSlips(res.data)
    } catch (err) { toast.error(err.response?.data?.message || 'Upload failed') }
    finally       { setUploading(false) }
  }

  const handleDownload = async (slip) => {
    setDownloading(slip.id)
    try {
      const res  = await api.get(`/payslip/download/${slip.id}`, { responseType: 'blob' })
      const url  = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url; link.download = `payslip-${slip.employee_name || selected?.name}-${slip.year}-${String(slip.month).padStart(2,'0')}.pdf`
      link.click(); URL.revokeObjectURL(url)
    } catch { toast.error('Download failed') }
    finally   { setDownloading(null) }
  }

  const filteredEmps = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.employee_id||'').toLowerCase().includes(search.toLowerCase()) ||
    (e.department||'').toLowerCase().includes(search.toLowerCase())
  )

  if (loadingEmps) return <LoadingSpinner />

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="page-title">Payslip Management</h1>
        <p className="page-subtitle">Upload and manage employee payslips</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee list */}
        <div className="card p-0 overflow-hidden lg:col-span-1">
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <div className="relative">
              <input type="text" className="input pl-8 text-sm" placeholder="Search employees…" value={search} onChange={e => setSearch(e.target.value)} />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '480px' }}>
            {filteredEmps.map(emp => (
              <button key={emp.id} onClick={() => setSelected(emp)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-100"
                style={{
                  borderBottom: '1px solid var(--border-light)',
                  backgroundColor: selected?.id === emp.id ? 'var(--bg-surface)' : 'var(--bg-card)',
                  borderLeft: selected?.id === emp.id ? '3px solid #F5C518' : '3px solid transparent',
                }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}>
                  {emp.name[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{emp.name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{emp.employee_id} · {emp.department || '–'}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Payslips */}
        <div className="lg:col-span-2 space-y-4">
          {!selected ? (
            <div className="card py-24 text-center">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} style={{ color: 'var(--border)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Select an employee</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Choose from the list to view payslips</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{selected.name}</h3>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selected.designation} · {selected.department}</p>
                </div>
                <button onClick={() => setModal(true)} className="btn-primary btn-sm">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  Upload Payslip
                </button>
              </div>

              {loadingSlips ? <LoadingSpinner /> : slips.length === 0 ? (
                <div className="card py-12 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No payslips uploaded for {selected.name}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {slips.map(slip => (
                    <div key={slip.id} className="card-hover group">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #090B1A, #1E2540)' }}>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#F5C518" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}>PDF</span>
                      </div>
                      <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{MONTHS[slip.month - 1]} {slip.year}</p>
                      {slip.net_pay && <p className="text-lg font-bold mt-0.5" style={{ color: '#059669' }}>₹{Number(slip.net_pay).toLocaleString('en-IN')}</p>}
                      <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>{new Date(slip.generated_at).toLocaleDateString('en-IN')}</p>
                      <button onClick={() => handleDownload(slip)} disabled={downloading === slip.id}
                        className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                        style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
                        onMouseEnter={e => { e.currentTarget.style.background='#090B1A'; e.currentTarget.style.color='#F5C518'; e.currentTarget.style.border='1px solid transparent' }}
                        onMouseLeave={e => { e.currentTarget.style.background='var(--bg-surface)'; e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.border='1px solid var(--border-light)' }}>
                        {downloading === slip.id ? 'Downloading…' : 'Download PDF'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={`Upload Payslip — ${selected?.name}`} size="sm">
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Month</label>
              <select className="input" value={form.month} onChange={e => setForm(f => ({ ...f, month: +e.target.value }))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Year</label>
              <input type="number" className="input" value={form.year} onChange={e => setForm(f => ({ ...f, year: +e.target.value }))} min={2020} max={2030} />
            </div>
          </div>
          <div>
            <label className="label">Net Pay (₹) — optional</label>
            <input type="number" className="input" placeholder="e.g. 45000" value={form.net_pay} onChange={e => setForm(f => ({ ...f, net_pay: e.target.value }))} />
          </div>
          <div>
            <label className="label">Payslip PDF</label>
            <input ref={fileRef} type="file" accept="application/pdf"
              className="input py-1.5 text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:cursor-pointer"
              onChange={e => setForm(f => ({ ...f, file: e.target.files[0] || null }))} required />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
