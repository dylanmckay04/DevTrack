import { useState, useEffect, useCallback } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core'
import { getApplications } from '../services/api'
import { useWebSocket } from '../hooks/useWebSocket'
import KanbanColumn from '../components/KanbanColumn'
import ApplicationModal from '../components/ApplicationModal'
import ApplicationCard from '../components/ApplicationCard'
import { updateStatus } from '../services/api'

const STATUSES = ['applied', 'interviewing', 'offer', 'rejected']

function replaceApplication(applications, incoming) {
  const index = applications.findIndex((app) => app.id === incoming.id)
  if (index === -1) {
    return [...applications, incoming]
  }

  const next = [...applications]
  next[index] = { ...next[index], ...incoming }
  return next
}

function moveApplicationToStatus(applications, applicationId, status) {
  return applications.map((application) =>
    application.id === applicationId ? { ...application, status } : application
  )
}

export default function Board() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('')
  const [boardError, setBoardError] = useState('')
  const [activeApplicationId, setActiveApplicationId] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleWsMessage = useCallback((data) => {
    const incoming = data.application
    if (!incoming) return

    if (data.type === 'application.created' || data.type === 'application.updated' || data.type === 'application.status_changed') {
      setApplications((prev) => replaceApplication(prev, incoming))
    }

    if (data.type === 'application.deleted') {
      setApplications((prev) => prev.filter((application) => application.id !== incoming.id))
    }
  }, [])

  useWebSocket(handleWsMessage)

  useEffect(() => {
    getApplications()
      .then((res) => setApplications(res.data))
      .finally(() => setLoading(false))
  }, [])

  const handleCreated = (app) => setApplications((prev) => [...prev, app])

  const handleDragStart = (event) => {
    const applicationId = event.active.data.current?.applicationId
    setActiveApplicationId(applicationId ?? null)
  }

  const handleDragEnd = async (event) => {
    setActiveApplicationId(null)
    const applicationId = event.active.data.current?.applicationId
    const fromStatus = event.active.data.current?.status
    const targetStatus = event.over?.data.current?.status

    if (!applicationId || !targetStatus || !fromStatus || targetStatus === fromStatus) {
      return
    }

    setBoardError('')
    setApplications((prev) => moveApplicationToStatus(prev, applicationId, targetStatus))

    try {
      const response = await updateStatus(applicationId, targetStatus)
      setApplications((prev) => replaceApplication(prev, response.data))
    } catch {
      setApplications((prev) => moveApplicationToStatus(prev, applicationId, fromStatus))
      setBoardError('Could not move application. The board was restored to the previous state.')
    }
  }

  const handleDragCancel = () => {
    setActiveApplicationId(null)
  }

  const filtered = filter
    ? applications.filter((a) =>
        a.company.toLowerCase().includes(filter.toLowerCase()) ||
        a.role.toLowerCase().includes(filter.toLowerCase())
      )
    : applications

  const byStatus = (status) => filtered.filter((a) => a.status === status)
  const activeApplication = applications.find((application) => application.id === activeApplicationId) || null

  return (
    <div style={styles.page}>
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <span style={styles.heading}>job board</span>
          <span style={styles.count}>{applications.length} applications</span>
        </div>
        <div style={styles.toolbarRight}>
          <input
            style={{ width: '200px' }}
            placeholder="filter by company or role..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button className="primary" onClick={() => setShowModal(true)}>
            + new application
          </button>
        </div>
      </div>

      {boardError && <p style={styles.error}>{boardError}</p>}

      {loading ? (
        <p style={styles.loading}>loading...</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div style={styles.board}>
            {STATUSES.map((status) => (
              <KanbanColumn key={status} status={status} applications={byStatus(status)} />
            ))}
          </div>
          <DragOverlay>
            {activeApplication ? <ApplicationCard app={activeApplication} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {showModal && (
        <ApplicationModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 44px)', overflow: 'hidden' },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 24px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-surface)',
  },
  toolbarLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  heading: { fontWeight: 700, fontSize: '13px' },
  count: { color: 'var(--text-muted)', fontSize: '11px', background: 'var(--bg-overlay)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 'var(--radius)' },
  toolbarRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  error: {
    margin: '14px 24px 0',
    padding: '10px 12px',
    border: '1px solid var(--red)',
    background: 'rgba(248, 81, 73, 0.08)',
    color: 'var(--red)',
    borderRadius: 'var(--radius)',
    fontSize: '11px',
  },
  board: { display: 'flex', gap: '16px', padding: '20px 24px', flex: 1, overflowX: 'auto', overflowY: 'hidden', alignItems: 'stretch' },
  loading: { padding: '24px', color: 'var(--text-muted)' },
}
