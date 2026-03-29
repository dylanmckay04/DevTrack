import { useEffect, useRef } from 'react'
import { getSocketToken } from '../services/api'
import { createBoardSocket } from '../services/websocket'

export function useWebSocket(onMessage) {
  const wsRef = useRef(null)

  useEffect(() => {
    let disposed = false

    async function connect() {
      try {
        const response = await getSocketToken()
        if (disposed) {
          return
        }
        wsRef.current = createBoardSocket(response.data.socket_token, onMessage)
      } catch (error) {
        console.error('[ws] failed to fetch socket token', error)
      }
    }

    connect()

    return () => {
      disposed = true
      wsRef.current?.close()
    }
  }, [onMessage])

  const send = (data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }

  return { send }
}
