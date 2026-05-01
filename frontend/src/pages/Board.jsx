import { useState, useEffect, useCallback } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core'
import { getPaginatedApplications } from '../services/api'
import { useWebSocket } from '../hooks/useWebSocket'
import KanbanColumn from '../components/KanbanColumn'
import ApplicationModal from '../components/ApplicationModal'
import ApplicationCard from '../components/ApplicationCard'
import { updateStatus } from '../services/api'

const STATUSES = ['applied', 'interviewing', 'offer', 'rejected']

const makeColumnState = () => STATUSES.reduce((acc, status) => ({
  ...acc,
  [status]: { items: [], nextCursor: null, hasMore: true, loading: false, loadingMore: false },
}), {})

export default function Board() {
  const [columns, setColumns] = useState(makeColumnState)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('')
  const [boardError, setBoardError] = useState('')
  const [activeApplicationId, setActiveApplicationId] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const fetchColumn = useCallback(async (status, cursor = null) => {
    const isInitial = !cursor
    if (isInitial) {
      setColumns((prev) => ({ ...prev, [status]: { ...prev[status], loading: true } }))
    } else {
      setColumns((prev) => ({ ...prev, [status]: { ...prev[status], loadingMore: true } }))
    }

    try {
      const res = await getPaginatedApplications({ status, cursor, limit: 20 })
      const { items, has_more, next_cursor } = res.data

      setColumns((prev) => ({
        ...prev,
        [status]: {
          items: cursor ? [...prev[status].items, ...items] : items,
          nextCursor: next_cursor,
          hasMore: has_more,
          loading: false,
          loadingMore: false,
        },
      }))
    } catch {
      setColumns((prev) => ({
        ...prev,
        [status]: { ...prev[status], loading: false, loadingMore: false },
      }))
    }
  }, [])

  useEffect(() => {
    Promise.all(STATUSES.map((s) => fetchColumn(s)))
      .finally(() => setLoading(false))
  }, [fetchColumn])

  const handleLoadMore = useCallback((status) => {
    const col = columns[status]
    if (col.nextCursor && !col.loadingMore) {
      fetchColumn(status, col.nextCursor)
    }
  }, [columns, fetchColumn])

  const handleWsMessage = useCallback((data) => {
    console.log('[Board] WebSocket message:', data.type)
    const incoming = data.application
    if (!incoming) return

    if (data.type === 'application.created') {
      setColumns((prev) => {
        const status = incoming.status
        if (!prev[status]) return prev
        const exists = prev[status].items.some((a) => a.id === incoming.id)
        if (exists) return prev
        return {
          ...prev,
          [status]: { ...prev[status], items: [incoming, ...prev[status].items] },
        }
      })
    }

    if (data.type === 'application.updated' || data.type === 'application.status_changed') {
      setColumns((prev) => {
        let found = false
        const updated = {}

        for (const status of STATUSES) {
          const idx = prev[status].items.findIndex((a) => a.id === incoming.id)
          if (idx !== -1) {
            found = true
            if (incoming.status === status) {
              updated[status] = {
                ...prev[status],
                items: prev[status].items.map((a) => a.id === incoming.id ? { ...a, ...incoming } : a),
              }
            } else {
              updated[status] = {
                ...prev[status],
                items: prev[status].items.filter((a) => a.id !== incoming.id),
              }
            }
          }
        }

        if (!found) {
          const targetStatus = incoming.status
          if (prev[targetStatus]) {
            updated[targetStatus] = {
              ...prev[targetStatus],
              items: [incoming, ...prev[targetStatus].items],
            }
          }
        }

        if (Object.keys(updated).length === 0) return prev
        return { ...prev, ...updated }
      })
    }

    if (data.type === 'application.deleted') {
      setColumns((prev) => {
        let changed = false
        const updated = {}
        for (const status of STATUSES) {
          const filtered = prev[status].items.filter((a) => a.id !== incoming.id)
          if (filtered.length !== prev[status].items.length) {
            changed = true
            updated[status] = { ...prev[status], items: filtered }
          }
        }
        if (!changed) return prev
        return { ...prev, ...updated }
      })
    }
  }, [])

  const fetchAllColumns = useCallback(() => {
    console.log('[Board] fetchAllColumns called')
    STATUSES.forEach((s) => fetchColumn(s))
  }, [fetchColumn])

  useWebSocket(handleWsMessage, fetchAllColumns)

  const handleCreated = useCallback((app) => {
    setColumns((prev) => {
      const col = prev[app.status]
      if (!col) return prev
      if (col.items.some((a) => a.id === app.id)) return prev
      return {
        ...prev,
        [app.status]: { ...col, items: [app, ...col.items] },
      }
    })
  }, [])

  const handleDragStart = (event) => {
    const applicationId = event.active.data.current?.applicationId
    setActiveApplicationId(applicationId ?? null)
  }

  const [dragKey, setDragKey] = useState(0)
  
  const handleDragEnd = async (event) => {
    setActiveApplicationId(null)
    const applicationId = event.active.data.current?.applicationId
    const fromStatus = event.active.data.current?.status
    const targetStatus = event.over?.data.current?.status
    
    // Force re-render to clear any stale drag states
    setDragKey(prev => prev + 1)

    if (!applicationId || !targetStatus || !fromStatus || targetStatus === fromStatus) {
      return
    }

    setBoardError('')

    setColumns((prev) => {
      const source = prev[fromStatus]
      const app = source.items.find((a) => a.id === applicationId)
      if (!app) return prev

      const updatedApp = { ...app, status: targetStatus }
      return {
        ...prev,
        [fromStatus]: { ...source, items: source.items.filter((a) => a.id !== applicationId) },
        [targetStatus]: { ...prev[targetStatus], items: [updatedApp, ...prev[targetStatus].items] },
      }
    })

    try {
      const response = await updateStatus(applicationId, targetStatus)
      const serverApp = response.data

      setColumns((prev) => {
        if (serverApp.status === targetStatus) {
          return {
            ...prev,
            [targetStatus]: {
              ...prev[targetStatus],
              items: prev[targetStatus].items.map((a) => a.id === applicationId ? serverApp : a),
            },
          }
        }
        return prev
      })
    } catch {
      setColumns((prev) => {
        const dest = prev[targetStatus]
        const app = dest.items.find((a) => a.id === applicationId)
        if (!app) return prev
        const reverted = { ...app, status: fromStatus }
        return {
          ...prev,
          [targetStatus]: { ...dest, items: dest.items.filter((a) => a.id !== applicationId) },
          [fromStatus]: { ...prev[fromStatus], items: [reverted, ...prev[fromStatus].items] },
        }
      })
      setBoardError('Could not move application. The board was restored to the previous state.')
    }
  }

  const handleDragCancel = () => {
    setActiveApplicationId(null)
  }

  const filteredColumns = {}
  for (const status of STATUSES) {
    const col = columns[status]
    filteredColumns[status] = {
      ...col,
      items: filter
        ? col.items.filter((a) =>
            a.company.toLowerCase().includes(filter.toLowerCase()) ||
            a.role.toLowerCase().includes(filter.toLowerCase())
          )
        : col.items,
    }
  }

  const totalApplications = STATUSES.reduce((sum, s) => sum + columns[s].items.length, 0)
  const activeApplication = STATUSES.flatMap((s) => columns[s].items).find((a) => a.id === activeApplicationId) || null

  return (
    <div style={styles.page}>
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <span style={styles.heading}>job board</span>
          <span style={styles.count}>{totalApplications} applications</span>
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
          <div style={styles.board} key={dragKey}>
            {STATUSES.map((status) => (
              <KanbanColumn
                key={`${status}-${dragKey}`}
                status={status}
                applications={filteredColumns[status].items}
                hasMore={filteredColumns[status].hasMore}
                loadingMore={filteredColumns[status].loadingMore}
                onLoadMore={() => handleLoadMore(status)}
              />
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
