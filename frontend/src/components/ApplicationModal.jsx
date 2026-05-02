import { useState } from 'react'
import { createApplication } from '../services/api'

export default function ApplicationModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ company: '', role: '', job_url: '', notes: '', applied_at: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = { ...form }
      if (!payload.applied_at) delete payload.applied_at
      if (!payload.job_url) delete payload.job_url
      if (!payload.notes) delete payload.notes
      const res = await createApplication(payload)
      onCreated(res.data)
    } catch {
      setError('failed to create application')
    } finally {
      setLoading(false)
      onClose()
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>$ new application</span>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>company *</label>
              <input value={form.company} onChange={set('company')} placeholder="Acme Corp" required autoFocus />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>role *</label>
              <input value={form.role} onChange={set('role')} placeholder="Software Engineer" required />
            </div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>job url</label>
            <input value={form.job_url} onChange={set('job_url')} placeholder="https://..." />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>date applied</label>
            <input type="date" value={form.applied_at} onChange={set('applied_at')} />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>notes</label>
            <textarea value={form.notes} onChange={set('notes')} placeholder="Any notes..." rows={3} style={{ resize: 'vertical' }} />
          </div>
          {error && <p style={styles.error}>$ error: {error}</p>}
          <div style={styles.actions}>
            <button type="button" onClick={onClose}>cancel</button>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? 'creating...' : '$ create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', width: '100%', maxWidth: '520px', padding: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  title: { color: 'var(--accent)', fontWeight: 700, fontSize: '13px' },
  closeBtn: { background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '14px', padding: '2px 6px' },
  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  field: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { color: 'var(--text-secondary)', fontSize: '11px' },
  error: { color: 'var(--red)', fontSize: '11px' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' },
}
