import { useEffect, useRef } from 'react'
import { getSocketToken } from '../services/api'

// Singleton WebSocket manager to survive React StrictMode remounts
class WebSocketManager {
  constructor() {
    this.ws = null
    this.listeners = new Set()
    this.reconnectTimer = null
    this.disposed = false
    this.connecting = false
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN
  }

export function useWebSocket(onMessage, onReconnect) {
  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const reconnectAttemptRef = useRef(0)

    this.connecting = true

    getSocketToken()
      .then(response => {
        if (this.disposed) return

        const baseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
        const ws = new WebSocket(`${baseUrl}/ws/board?token=${response.data.socket_token}`)

        ws.onopen = () => {
          if (this.disposed) {
            ws.close()
            return
          }
          this.ws = ws
          this.connecting = false
          console.log('[ws] connected')
          this.notifyReconnect()
        }

        ws.onmessage = (event) => {
          if (this.ws === ws) {
            try {
              const data = JSON.parse(event.data)
              this.notifyMessage(data)
            } catch (e) {
              console.error('[ws] error handling message:', e)
            }
          }
        }

        ws.onclose = () => {
          if (this.ws === ws) {
            this.ws = null
          }
          if (!this.disposed) {
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = null
              if (!this.disposed) {
                this.connect()
              }
            }, 3000)
          }
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
          }, 5000)
        }
      })
  }

  notifyMessage(data) {
    this.listeners.forEach(listener => {
      if (listener.onMessage) {
        listener.onMessage(data)
      }
    })
  }

  notifyReconnect() {
    this.listeners.forEach(listener => {
      if (listener.onReconnect) {
        listener.onReconnect()
      }
    })
  }

  addListener(listener) {
    this.listeners.add(listener)
    // If already connected, trigger reconnect callback
    if (this.isConnected()) {
      listener.onReconnect?.()
    }
  }, [onMessage, onReconnect])

  removeListener(listener) {
    this.listeners.delete(listener)
  }

  dispose() {
    this.disposed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      const ws = this.ws
      ws.onclose = null
      ws.onerror = null
      ws.close()
      this.ws = null
    }
  }
}

// Singleton instance
let manager = null

export function useWebSocket(onMessage, onReconnect) {
  const listenerRef = useRef(null)

  useEffect(() => {
    // Create singleton on first use
    if (!manager) {
      manager = new WebSocketManager()
    }

    // Create listener object
    const listener = {
      onMessage,
      onReconnect,
    }
    listenerRef.current = listener
    manager.addListener(listener)

    // Start connection if not already connected
    if (!manager.isConnected()) {
      manager.connect()
    }

    return () => {
      // Remove listener but DON'T dispose the manager
      // This allows the connection to persist across StrictMode remounts
      if (listenerRef.current) {
        manager.removeListener(listenerRef.current)
        listenerRef.current = null
      }
    }
  }, [])

  return {}
}
