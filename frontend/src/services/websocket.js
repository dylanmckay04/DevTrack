const defaultApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS_URL = defaultApiUrl.replace(/^http/, 'ws') + '/ws/board'

export function createBoardSocket(socketToken, onMessage, handlers = {}) {
  const wsUrl = `${WS_URL}?token=${encodeURIComponent(socketToken)}`
  const ws = new WebSocket(wsUrl)

  const keepAlive = window.setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('ping')
    }
  }, 25000)

  ws.onopen = (event) => {
    console.log('[ws] connected')
    handlers.onOpen?.(event)
  }

  ws.onclose = (event) => {
    window.clearInterval(keepAlive)
    console.log('[ws] disconnected')
    handlers.onClose?.(event)
  }

  ws.onerror = (event) => {
    console.error('[ws] error', event)
    handlers.onError?.(event)
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onMessage(data)
    } catch (e) {
      console.error('[ws] failed to parse message', e)
    }
  }

  return ws
}
