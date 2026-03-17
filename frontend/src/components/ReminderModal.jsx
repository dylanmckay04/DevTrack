import { useState } from 'react'
import { createReminder } from '../services/api'

export default function ReminderModal({ onClose, onCreated, appId }) {
  const [form, setForm] = useState({ message: '', remind_at: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = { ...form }
      if (appId) payload.application_id = parseInt(appId)
      if (payload.remind_at) {
        payload.remind_at = new Date(payload.remind_at).toISOString()
      }
      if (!payload.application_id) delete payload.application_id
      const res = await createReminder(payload)
      onCreated(res.data)
      onClose()
    } catch {
      setError('failed to create reminder')
    } finally {
      setLoading(false)
    }
  }

    return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>$ new reminder</span>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>message</label>
            <textarea value={form.message} onChange={set('message')} placeholder="Any message..." rows={3} style={{ resize: 'vertical' }} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>remind me at</label>
            <input type="datetime-local" value={form.remind_at} onChange={set('remind_at')} required />
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
  field: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { color: 'var(--text-secondary)', fontSize: '11px' },
  error: { color: 'var(--red)', fontSize: '11px' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' },
}
