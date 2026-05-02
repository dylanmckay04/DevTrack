import { useDroppable } from '@dnd-kit/core'
import ApplicationCard from './ApplicationCard'

const COLUMN_META = {
  applied:      { label: 'applied',      color: 'var(--blue)' },
  interviewing: { label: 'interviewing', color: 'var(--yellow)' },
  offer:        { label: 'offer',        color: 'var(--accent)' },
  rejected:     { label: 'rejected',     color: 'var(--red)' },
}

export default function KanbanColumn({ status, applications, hasMore, loadingMore, onLoadMore, isDragActive }) {
  const meta = COLUMN_META[status]
  const { isOver, setNodeRef } = useDroppable({
    id: `column-${status}`,
    data: { status },
  })

  return (
    <div ref={setNodeRef} style={{ ...styles.column, ...(isOver && isDragActive ? styles.columnOver : null) }}>
      <div style={styles.header}>
        <span style={{ ...styles.indicator, background: meta.color }} />
        <span style={styles.label}>{meta.label}</span>
        <span style={styles.count}>{applications.length}</span>
      </div>
      <div style={styles.cards}>
        {applications.length === 0
          ? <p style={styles.empty}>no applications</p>
          : applications.map((app) => <ApplicationCard key={app.id} app={app} />)
        }
        {hasMore && (
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            style={{ ...styles.loadMore, opacity: loadingMore ? 0.5 : 1 }}
          >
            {loadingMore ? 'loading...' : 'load more'}
          </button>
        )}
      </div>
    </div>
  )
}

const styles = {
  column: {
    flex: '1 1 0',
    minWidth: '220px',
    maxWidth: '320px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'border-color var(--transition), background var(--transition)',
  },
  columnOver: {
    borderColor: 'var(--accent)',
    background: 'var(--bg-raised)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 14px',
    borderBottom: '1px solid var(--border)',
  },
  indicator: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
  label: { fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, flex: 1 },
  count: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    background: 'var(--bg-overlay)',
    border: '1px solid var(--border)',
    borderRadius: '3px',
    padding: '1px 6px',
  },
  cards: { padding: '12px', overflowY: 'auto', flex: 1 },
  empty: { color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', padding: '16px 0' },
  loadMore: {
    width: '100%',
    padding: '8px 0',
    marginTop: '8px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-muted)',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'border-color var(--transition), color var(--transition)',
  },
}
