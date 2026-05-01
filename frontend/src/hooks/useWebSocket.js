import { useEffect, useRef } from 'react'
import { getSocketToken } from '../services/api'
import { createBoardSocket } from '../services/websocket'

const BASE_RECONNECT_DELAY_MS = 1000
const MAX_RECONNECT_DELAY_MS = 30000

function getReconnectDelay(attempt) {
  return Math.min(BASE_RECONNECT_DELAY_MS * (2 ** attempt), MAX_RECONNECT_DELAY_MS)
}

export function useWebSocket(onMessage, onReconnect) {
  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const reconnectAttemptRef = useRef(0)

  useEffect(() => {
    let disposed = false

    const scheduleReconnect = () => {
      if (disposed || reconnectTimerRef.current) {
        return
      }

      const delay = getReconnectDelay(reconnectAttemptRef.current)
      reconnectAttemptRef.current += 1

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        connect()
      }, delay)
    }

    async function connect() {
      try {
        const response = await getSocketToken()
        if (disposed) {
          return
        }

        wsRef.current?.close()
        wsRef.current = createBoardSocket(response.data.socket_token, onMessage, {
          onOpen: () => {
            const isReconnect = reconnectAttemptRef.current > 0
            reconnectAttemptRef.current = 0
            if (isReconnect && onReconnect) {
              onReconnect()
            }
          },
          onClose: () => {
            if (!disposed) {
              scheduleReconnect()
            }
          },
        })
      } catch (error) {
        console.error('[ws] failed to fetch socket token', error)
        scheduleReconnect()
      }
    }

    connect()

    return () => {
      disposed = true
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      wsRef.current?.close()
    }
  }, [onMessage, onReconnect])

  const send = (data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }

  return { send }
}
