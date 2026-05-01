import { useEffect, useRef } from 'react'
import { getSocketToken } from '../services/api'

export function useWebSocket(onMessage, onReconnect) {
  const wsRef = useRef(null)
  const disposedRef = useRef(false)
  
  // Use refs for callbacks to avoid dependency issues
  const onMessageRef = useRef(onMessage)
  const onReconnectRef = useRef(onReconnect)
  
  // Update refs when callbacks change
  onMessageRef.current = onMessage
  onReconnectRef.current = onReconnect

  useEffect(() => {
    disposedRef.current = false
    console.log('[ws] mounting')

    const connect = async () => {
      try {
        const response = await getSocketToken()
        if (disposedRef.current) return

        console.log('[ws] connecting...')

        const ws = new WebSocket(`ws://localhost:8000/ws/board?token=${response.data.socket_token}`)

        // Store ref to this specific WebSocket
        wsRef.current = ws

        ws.onopen = () => {
          console.log('[ws] connected')
          onReconnectRef.current?.()
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            console.log('[ws] received:', data.type)
            onMessageRef.current?.(data)
          } catch (e) {
            console.error('[ws] error handling message:', e)
          }
        }

        ws.onclose = () => {
          console.log('[ws] closed')
          // ONLY clear ref if this is still the current WebSocket
          // (fixes StrictMode bug where old WebSocket onclose fires after new one is created)
          if (wsRef.current === ws) {
            wsRef.current = null
          }
          if (!disposedRef.current) {
            // Reconnect after 3 seconds
            setTimeout(() => {
              if (!disposedRef.current) {
                connect()
              }
            }, 3000)
          }
        }

        ws.onerror = (event) => {
          console.error('[ws] error:', event)
        }

      } catch (error) {
        console.error('[ws] connection error:', error)
        if (!disposedRef.current) {
          setTimeout(() => {
            if (!disposedRef.current) {
              connect()
            }
          }, 5000)
        }
      }
    }

    connect()

    return () => {
      console.log('[ws] unmounting')
      disposedRef.current = true
      if (wsRef.current) {
        const ws = wsRef.current
        // Remove onclose handler to prevent it from firing after cleanup
        ws.onclose = null
        ws.close()
        wsRef.current = null
      }
    }
  }, []) // Empty deps - only run on mount

  return {}
}
