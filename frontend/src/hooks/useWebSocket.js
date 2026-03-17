import { useEffect, useRef } from 'react'
import { createBoardSocket } from '../services/websocket'

export function useWebSocket(onMessage) {
  const wsRef = useRef(null)

  useEffect(() => {
    wsRef.current = createBoardSocket(onMessage)
    return () => wsRef.current?.close()
  }, [])

  const send = (data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }

  return { send }
}
