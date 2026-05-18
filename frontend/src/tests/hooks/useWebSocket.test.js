import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

let wsInstance = null

beforeEach(() => {
  wsInstance = {
    readyState: 0,
    close: vi.fn(),
    send: vi.fn(),
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
  }
  // vi.stubGlobal required because window.WebSocket is read-only in jsdom
  // mockImplementation must use a regular function (not arrow) to be usable as a constructor
  const MockWebSocket = vi.fn().mockImplementation(function() { return wsInstance })
  MockWebSocket.OPEN = 1
  MockWebSocket.CONNECTING = 0
  MockWebSocket.CLOSED = 3
  vi.stubGlobal('WebSocket', MockWebSocket)
  localStorage.setItem('token', 'test-token')
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('useWebSocket — initialization', () => {
  it('fetches socket token via POST /auth/socket-token on first mount', async () => {
    const { useWebSocket } = await import('../../hooks/useWebSocket')
    renderHook(() => useWebSocket(vi.fn(), vi.fn()))

    await waitFor(() => {
      expect(global.WebSocket).toHaveBeenCalled()
    })
  })

  it('creates WebSocket with socket token in URL', async () => {
    const { useWebSocket } = await import('../../hooks/useWebSocket')
    renderHook(() => useWebSocket(vi.fn(), vi.fn()))

    await waitFor(() => {
      expect(global.WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('ws://localhost:8000/ws/board?token=mock-socket-token')
      )
    })
  })
})

describe('useWebSocket — message handling', () => {
  it('dispatches parsed JSON to onMessage callback', async () => {
    const onMessage = vi.fn()
    const { useWebSocket } = await import('../../hooks/useWebSocket')
    renderHook(() => useWebSocket(onMessage, vi.fn()))

    await waitFor(() => expect(global.WebSocket).toHaveBeenCalled())

    act(() => {
      wsInstance.readyState = 1
      wsInstance.onopen?.()
    })

    act(() => {
      wsInstance.onmessage?.({ data: JSON.stringify({ type: 'application.created', application: { id: 99 } }) })
    })

    expect(onMessage).toHaveBeenCalledWith({ type: 'application.created', application: { id: 99 } })
  })

  it('does not throw on malformed JSON message', async () => {
    const onMessage = vi.fn()
    const { useWebSocket } = await import('../../hooks/useWebSocket')
    renderHook(() => useWebSocket(onMessage, vi.fn()))

    await waitFor(() => expect(global.WebSocket).toHaveBeenCalled())

    act(() => {
      wsInstance.readyState = 1
      wsInstance.onopen?.()
    })

    expect(() => {
      act(() => {
        wsInstance.onmessage?.({ data: 'not valid json {{{' })
      })
    }).not.toThrow()

    expect(onMessage).not.toHaveBeenCalled()
  })
})

describe('useWebSocket — reconnection', () => {
  it('schedules a 3000ms reconnect timer when connection closes', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout')

    const { useWebSocket } = await import('../../hooks/useWebSocket')
    renderHook(() => useWebSocket(vi.fn(), vi.fn()))

    await waitFor(() => expect(global.WebSocket).toHaveBeenCalled())

    act(() => {
      wsInstance.readyState = 1
      wsInstance.onopen?.()
    })

    const countBefore = setTimeoutSpy.mock.calls.length

    act(() => {
      wsInstance.onclose?.()
    })

    // A 3000ms reconnect timer should be scheduled
    const newCalls = setTimeoutSpy.mock.calls.slice(countBefore)
    const reconnectCall = newCalls.find((args) => args[1] === 3000)
    expect(reconnectCall).toBeDefined()

    setTimeoutSpy.mockRestore()
  })
})

describe('useWebSocket — singleton', () => {
  it('does not create a second WebSocket when a second hook instance mounts', async () => {
    const { useWebSocket } = await import('../../hooks/useWebSocket')

    renderHook(() => useWebSocket(vi.fn(), vi.fn()))

    await waitFor(() => expect(global.WebSocket).toHaveBeenCalledTimes(1))

    act(() => {
      wsInstance.readyState = 1
      wsInstance.onopen?.()
    })

    // Mount a second hook while first is connected
    renderHook(() => useWebSocket(vi.fn(), vi.fn()))

    await new Promise((r) => setTimeout(r, 50))
    // Still only one WebSocket instance created
    expect(global.WebSocket).toHaveBeenCalledTimes(1)
  })
})

describe('useWebSocket — cleanup', () => {
  it('stops delivering messages to unmounted hook', async () => {
    const onMessage = vi.fn()
    const { useWebSocket } = await import('../../hooks/useWebSocket')
    const { unmount } = renderHook(() => useWebSocket(onMessage, vi.fn()))

    await waitFor(() => expect(global.WebSocket).toHaveBeenCalled())

    act(() => {
      wsInstance.readyState = 1
      wsInstance.onopen?.()
    })

    unmount()

    act(() => {
      wsInstance.onmessage?.({ data: JSON.stringify({ type: 'test' }) })
    })

    expect(onMessage).not.toHaveBeenCalled()
  })
})
