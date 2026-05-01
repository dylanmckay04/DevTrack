import { useEffect, useRef } from 'react'
import { getSocketToken } from '../services/api'

export function useWebSocket(onMessage, onReconnect) {
  const wsRef = useRef(null)
  const disposedRef = useRef(false)
  const reconnectTimerRef = useRef(null)
  
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
      // Clear any existing reconnect timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      
      try {
        const response = await getSocketToken()
        if (disposedRef.current) return

        console.log('[ws] connecting...')

        const ws = new WebSocket(`ws://localhost:8000/ws/board?token=${response.data.socket_token}`)
        wsRef.current = ws

        ws.onopen = () => {
          console.log('[ws] connected')
          if (onReconnectRef.current) {
            onReconnectRef.current()
          }
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

        ws.onclose = (event) => {
          console.log(`[ws] closed (code=${event.code})`)
          // ONLY clear ref if this is still the current WebSocket
          if (wsRef.current === ws) {
            wsRef.current = null
          }
          if (!disposedRef.current) {
            // Reconnect after 3 seconds
            reconnectTimerRef.current = setTimeout(() => {
              reconnectTimerRef.current = null
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
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null
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
      
      // Clear reconnect timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      
      // Close WebSocket without triggering reconnect
      if (wsRef.current) {
        const ws = wsRef.current
        ws.onclose = null // Prevent reconnect
        ws.close()
        wsRef.current = null
      }
    }
  }, []) // Empty deps - only run on mount

  return {}
}
