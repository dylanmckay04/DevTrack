const WS_URL = 'ws://localhost:8000/ws/board'

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

  return ws
}
