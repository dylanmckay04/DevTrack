import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getApplication, updateApplication, updateStatus, deleteApplication, getDocuments, uploadDocument, deleteDocument, getReminders, deleteReminder } from '../services/api'
import ReminderModal from '../components/ReminderModal'

const STATUSES = ['applied', 'interviewing', 'offer', 'rejected']
const STATUS_COLORS = { applied: 'var(--blue)', interviewing: 'var(--yellow)', offer: 'var(--accent)', rejected: 'var(--red)' }

export default function ApplicationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [app, setApp] = useState(null)
  const [documents, setDocuments] = useState([])
  const [reminders, setReminders] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showReminderModal, setShowReminderModal] = useState(false)

  useEffect(() => {
    Promise.all([getApplication(id), getDocuments(id), getReminders()])
      .then(([appRes, docsRes, remRes]) => {
        setApp(appRes.data)
        setForm({ notes: appRes.data.notes || '', job_url: appRes.data.job_url || '' })
        setDocuments(docsRes.data)
        setReminders(remRes.data.filter((r) => r.application_id === parseInt(id)))
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleStatusChange = async (status) => {
    const res = await updateStatus(id, status)
    setApp(res.data)
  }

  const handleSave = async () => {
    const res = await updateApplication(id, form)
    setApp(res.data)
    setEditing(false)
  }

  const handleDelete = async () => {
    if (!window.confirm('delete this application?')) return
    await deleteApplication(id)
    navigate('/')
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await uploadDocument(id, file)
      setDocuments((prev) => [...prev, res.data])
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteDoc = async (docId) => {
    await deleteDocument(id, docId)
    setDocuments((prev) => prev.filter((d) => d.id !== docId))
  }

  const handleReminderCreated = (reminder) => {
    setReminders((prev) => [...prev, reminder])
  }

  const handleDeleteReminder = async (remId) => {
    await deleteReminder(remId)
    setReminders((prev) => prev.filter((r) => r.id !== remId))
  }

  if (loading) return <p style={{ padding: '24px', color: 'var(--text-muted)' }}>loading...</p>
  if (!app) return <p style={{ padding: '24px', color: 'var(--red)' }}>not found</p>

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <button onClick={() => navigate('/')} style={styles.backBtn}>← board</button>
          <h1 style={styles.title}>{app.company}</h1>
          <p style={styles.role}>{app.role}</p>
        </div>
        <button className="danger" onClick={handleDelete}>delete</button>
      </div>

      <div style={styles.grid}>
        {/* Status */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>// status</h2>
          <div style={styles.statusRow}>
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                style={{
                  ...styles.statusBtn,
                  borderColor: app.status === s ? STATUS_COLORS[s] : 'var(--border)',
                  color: app.status === s ? STATUS_COLORS[s] : 'var(--text-muted)',
                  background: app.status === s ? `${STATUS_COLORS[s]}18` : 'transparent',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* Details */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>// details</h2>
            {!editing
              ? <button onClick={() => setEditing(true)}>edit</button>
              : <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setEditing(false)}>cancel</button>
                  <button className="primary" onClick={handleSave}>save</button>
                </div>
            }
          </div>
          {editing ? (
            <div style={styles.fields}>
              <div style={styles.field}>
                <label style={styles.label}>job url</label>
                <input value={form.job_url} onChange={(e) => setForm((f) => ({ ...f, job_url: e.target.value }))} placeholder="https://..." />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={5} style={{ resize: 'vertical' }} />
              </div>
            </div>
          ) : (
            <div style={styles.fields}>
              <div style={styles.kv}>
                <span style={styles.key}>job_url</span>
                <span style={styles.val}>{app.job_url || <em style={{ color: 'var(--text-muted)' }}>none</em>}</span>
              </div>
              <div style={styles.kv}>
                <span style={styles.key}>applied_at</span>
                <span style={styles.val}>{app.applied_at ? new Date(app.applied_at).toLocaleDateString() : <em style={{ color: 'var(--text-muted)' }}>none</em>}</span>
              </div>
              <div style={styles.kv}>
                <span style={styles.key}>created_at</span>
                <span style={styles.val}>{new Date(app.created_at).toLocaleDateString()}</span>
              </div>
              {app.notes && (
                <div style={styles.field}>
                  <label style={styles.label}>notes</label>
                  <p style={styles.notes}>{app.notes}</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Documents */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>// documents</h2>
            <label style={styles.uploadBtn}>
              {uploading ? 'uploading...' : '+ upload'}
              <input type="file" onChange={handleUpload} style={{ display: 'none' }} />
            </label>
          </div>
          {documents.length === 0
            ? <p style={styles.empty}>no documents uploaded</p>
            : documents.map((doc) => (
                <div key={doc.id} style={styles.docRow}>
                  <span style={styles.docName}>{doc.filename}</span>
                  <button className="danger" onClick={() => handleDeleteDoc(doc.id)} style={{ fontSize: '10px', padding: '2px 8px' }}>remove</button>
                </div>
              ))
          }
        </section>

        {/* Reminders */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>// reminders</h2>
            <button onClick={() => setShowReminderModal(true)}>+ add</button>
          </div>
          {reminders.length === 0
            ? <p style={styles.empty}>no reminders added</p>
            : reminders.map((rem) => (
                <div key={rem.id} style={styles.remRow}>
                  <span style={styles.remName}>{rem.message}</span>
                  <button className="danger" onClick={() => handleDeleteReminder(rem.id)} style={{ fontSize: '10px', padding: '2px 8px' }}>remove</button>
                </div>
              ))
          }
        </section>
      </div>
      {showReminderModal && (
        <ReminderModal onClose={() => setShowReminderModal(false)} onCreated={handleReminderCreated} appId={id}/>
      )}
    </div>
  )
}

const styles = {
  page: { padding: '24px', maxWidth: '900px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' },
  backBtn: { color: 'var(--text-muted)', fontSize: '11px', background: 'none', border: 'none', padding: 0, marginBottom: '8px', display: 'block', cursor: 'pointer' },
  title: { fontSize: '20px', fontWeight: 700 },
  role: { color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' },
  grid: { display: 'flex', flexDirection: 'column', gap: '16px' },
  section: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  sectionTitle: { color: 'var(--accent)', fontSize: '11px', fontWeight: 600 },
  statusRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  statusBtn: { fontSize: '11px', padding: '5px 14px', borderRadius: 'var(--radius)', border: '1px solid', cursor: 'pointer', background: 'transparent', fontFamily: 'var(--font)', transition: 'all var(--transition)' },
  fields: { display: 'flex', flexDirection: 'column', gap: '12px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { color: 'var(--text-muted)', fontSize: '10px' },
  kv: { display: 'flex', gap: '16px', fontSize: '12px' },
  key: { color: 'var(--text-muted)', width: '90px', flexShrink: 0 },
  val: { color: 'var(--text-primary)' },
  notes: { color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.7, whiteSpace: 'pre-wrap' },
  docRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-muted)' },
  remRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-muted)' },
  docName: { fontSize: '11px', color: 'var(--text-secondary)' },
  remName: { fontSize: '11px', color: 'var(--text-secondary)' },
  uploadBtn: { fontSize: '11px', color: 'var(--accent)', cursor: 'pointer', border: '1px solid var(--accent)', padding: '4px 10px', borderRadius: 'var(--radius)', background: 'var(--accent-dim)' },
  remindBtn: { fontSize: '11px', color: 'var(--accent)', cursor: 'pointer', border: '1px solid var(--accent)', padding: '4px 10px', borderRadius: 'var(--radius)', background: 'var(--accent-dim)' },
  empty: { color: 'var(--text-muted)', fontSize: '11px' },
}
