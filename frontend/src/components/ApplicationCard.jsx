import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useNavigate } from 'react-router-dom'

const STATUS_COLORS = {
  applied:      'var(--blue)',
  interviewing: 'var(--yellow)',
  offer:        'var(--accent)',
  rejected:     'var(--red)',
}

export default function ApplicationCard({ app, isDragOverlay = false }) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `application-${app.id}`,
    disabled: isDragOverlay,
    data: {
      applicationId: app.id,
      status: app.status,
    },
  })
  const date = app.applied_at
    ? new Date(app.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const dragStyle = isDragOverlay ? { cursor: 'grabbing' } : {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={{ ...styles.card, ...dragStyle }}
      onClick={() => !isDragOverlay && !isDragging && navigate(`/applications/${app.id}`)}
      {...(isDragOverlay ? {} : listeners)}
      {...(isDragOverlay ? {} : attributes)}
    >
      <div style={styles.top}>
        <span style={styles.company}>{app.company}</span>
        <span style={{ ...styles.dot, background: STATUS_COLORS[app.status] }} title={app.status} />
      </div>
      <div style={styles.role}>{app.role}</div>
      <div style={styles.meta}>
        <span>{date}</span>
        {app.job_url && <span style={styles.link}>↗ link</span>}
      </div>
    </div>
  )
}

const styles = {
  card: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '12px',
    cursor: 'grab',
    transition: 'border-color var(--transition), background var(--transition)',
    marginBottom: '8px',
    touchAction: 'none',
  },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' },
  company: { fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)' },
  dot: { width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0 },
  role: { color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '8px' },
  meta: { display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '10px' },
  link: { color: 'var(--accent)' },
}
