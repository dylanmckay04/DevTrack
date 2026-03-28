const defaultApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS_URL = import.meta.env.VITE_WS_URL || defaultApiUrl.replace(/^http/, 'ws') + '/ws/board'

export function createBoardSocket(onMessage) {
  const ws = new WebSocket(WS_URL)

  ws.onopen = () => console.log('[ws] connected')
  ws.onclose = () => console.log('[ws] disconnected')
  ws.onerror = (e) => console.error('[ws] error', e)
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onMessage(data)
    } catch (e) {
      console.error('[ws] failed to parse message', e)
    }
  }

  const keepAlive = window.setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('ping')
    }
  }, 25000)

  const originalClose = ws.close.bind(ws)
  ws.close = (...args) => {
    window.clearInterval(keepAlive)
    return originalClose(...args)
  }

  return ws
}
