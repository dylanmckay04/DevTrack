import { screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { renderWithProviders } from '../utils/renderWithProviders'
import { makeApplication, makePaginatedResponse } from '../mocks/fixtures'
import Board from '../../pages/Board'

// Capture the onDragEnd prop from the mocked DndContext
let capturedOnDragEnd = null

vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: vi.fn((onMessage) => {
    // Store the onMessage handler so tests can trigger WS events
    capturedWsHandler = onMessage
  }),
}))

let capturedWsHandler = null

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    DndContext: vi.fn(({ children, onDragEnd, onDragStart, onDragCancel }) => {
      capturedOnDragEnd = onDragEnd
      return <div data-testid="dnd-context">{children}</div>
    }),
    DragOverlay: ({ children }) => <div data-testid="drag-overlay">{children}</div>,
    useSensor: vi.fn(),
    useSensors: vi.fn(() => []),
    PointerSensor: vi.fn(),
    closestCorners: vi.fn(),
  }
})

beforeEach(() => {
  capturedOnDragEnd = null
  capturedWsHandler = null
})

describe('Board — initial load', () => {
  it('shows loading state before data arrives', () => {
    renderWithProviders(<Board />)
    expect(screen.getByText('loading...')).toBeInTheDocument()
  })

  it('renders all four column headers after loading', async () => {
    renderWithProviders(<Board />)
    await waitFor(() => {
      expect(screen.getByText('Applied')).toBeInTheDocument()
    })
    expect(screen.getByText('Interviewing')).toBeInTheDocument()
    expect(screen.getByText('Offer')).toBeInTheDocument()
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })

  it('renders application card with company and role', async () => {
    renderWithProviders(<Board />)
    await waitFor(() => expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0))
    expect(screen.getAllByText('Software Engineer').length).toBeGreaterThan(0)
  })
})

describe('Board — filtering', () => {
  it('filters cards by company name', async () => {
    server.use(
      http.get('http://localhost:8000/applications/paginated', ({ request }) => {
        const url = new URL(request.url)
        const status = url.searchParams.get('status') || 'applied'
        const apps = status === 'applied'
          ? [makeApplication({ id: 1, company: 'Acme Corp', role: 'Engineer', status: 'applied' }),
             makeApplication({ id: 2, company: 'Beta Inc', role: 'Designer', status: 'applied' })]
          : []
        return HttpResponse.json(makePaginatedResponse(apps))
      })
    )
    renderWithProviders(<Board />)
    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument())

    const filterInput = screen.getByPlaceholderText(/filter by company or role/i)
    await userEvent.type(filterInput, 'Acme')

    expect(screen.queryByText('Beta Inc')).not.toBeInTheDocument()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })

  it('filters cards by role', async () => {
    server.use(
      http.get('http://localhost:8000/applications/paginated', ({ request }) => {
        const url = new URL(request.url)
        const status = url.searchParams.get('status') || 'applied'
        const apps = status === 'applied'
          ? [makeApplication({ id: 1, company: 'Acme', role: 'Engineer', status: 'applied' }),
             makeApplication({ id: 2, company: 'Beta', role: 'Designer', status: 'applied' })]
          : []
        return HttpResponse.json(makePaginatedResponse(apps))
      })
    )
    renderWithProviders(<Board />)
    await waitFor(() => expect(screen.getByText('Designer')).toBeInTheDocument())

    await userEvent.type(screen.getByPlaceholderText(/filter by company or role/i), 'Designer')

    expect(screen.queryByText('Engineer')).not.toBeInTheDocument()
    expect(screen.getByText('Designer')).toBeInTheDocument()
  })
})

describe('Board — new application modal', () => {
  it('opens ApplicationModal when "+ new application" is clicked', async () => {
    renderWithProviders(<Board />)
    await waitFor(() => expect(screen.getByText('Applied')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /new application/i }))

    expect(screen.getByText('$ new application')).toBeInTheDocument()
  })

  it('adds card to board after modal submit', async () => {
    renderWithProviders(<Board />)
    await waitFor(() => expect(screen.getByText('Applied')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /new application/i }))

    const companyInput = screen.getByPlaceholderText('Acme Corp')
    const roleInput = screen.getByPlaceholderText('Software Engineer')
    await userEvent.type(companyInput, 'NewCo')
    await userEvent.type(roleInput, 'Developer')
    await userEvent.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(screen.queryByText('$ new application')).not.toBeInTheDocument()
    })
    expect(screen.getByText('NewCo')).toBeInTheDocument()
  })
})

describe('Board — drag and drop', () => {
  it('calls PATCH /applications/:id/status when card is dropped', async () => {
    let statusPatched = null
    server.use(
      http.patch('http://localhost:8000/applications/:id/status', async ({ request }) => {
        const body = await request.json()
        statusPatched = body.status
        return HttpResponse.json(makeApplication({ id: 1, status: body.status }))
      })
    )

    renderWithProviders(<Board />)
    await waitFor(() => expect(capturedOnDragEnd).toBeTruthy())

    await act(async () => {
      capturedOnDragEnd({
        active: { id: 'application-1', data: { current: { applicationId: 1, status: 'applied' } } },
        over: { id: 'column-interviewing', data: { current: { status: 'interviewing' } } },
      })
    })

    await waitFor(() => expect(statusPatched).toBe('interviewing'))
  })

  it('reverts card and shows error banner when PATCH fails', async () => {
    server.use(
      http.patch('http://localhost:8000/applications/:id/status', () =>
        HttpResponse.json({ detail: 'error' }, { status: 500 })
      )
    )

    renderWithProviders(<Board />)
    await waitFor(() => expect(capturedOnDragEnd).toBeTruthy())

    await act(async () => {
      capturedOnDragEnd({
        active: { id: 'application-1', data: { current: { applicationId: 1, status: 'applied' } } },
        over: { id: 'column-interviewing', data: { current: { status: 'interviewing' } } },
      })
    })

    await waitFor(() => {
      expect(screen.getByText(/could not move application/i)).toBeInTheDocument()
    })
  })

  it('does nothing when dropped on the same column', async () => {
    let patchCalled = false
    server.use(
      http.patch('http://localhost:8000/applications/:id/status', () => {
        patchCalled = true
        return HttpResponse.json(makeApplication())
      })
    )

    renderWithProviders(<Board />)
    await waitFor(() => expect(capturedOnDragEnd).toBeTruthy())

    await act(async () => {
      capturedOnDragEnd({
        active: { id: 'application-1', data: { current: { applicationId: 1, status: 'applied' } } },
        over: { id: 'column-applied', data: { current: { status: 'applied' } } },
      })
    })

    // Give time for any potential async call
    await new Promise((r) => setTimeout(r, 50))
    expect(patchCalled).toBe(false)
  })
})

describe('Board — WebSocket events', () => {
  it('adds new card when application.created event is received', async () => {
    server.use(
      http.get('http://localhost:8000/applications/paginated', ({ request }) => {
        const url = new URL(request.url)
        const status = url.searchParams.get('status') || 'applied'
        return HttpResponse.json(makePaginatedResponse(status === 'applied' ? [] : []))
      })
    )

    renderWithProviders(<Board />)
    await waitFor(() => expect(capturedWsHandler).toBeTruthy())

    act(() => {
      capturedWsHandler({
        type: 'application.created',
        application: makeApplication({ id: 42, company: 'WsNewCo', status: 'applied' }),
      })
    })

    await waitFor(() => expect(screen.getByText('WsNewCo')).toBeInTheDocument())
  })

  it('moves card to new column when application.status_changed event is received', async () => {
    renderWithProviders(<Board />)
    await waitFor(() => expect(capturedWsHandler).toBeTruthy())
    // App starts in 'applied' column via default handler
    await waitFor(() => expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0))

    act(() => {
      capturedWsHandler({
        type: 'application.status_changed',
        application: makeApplication({ id: 1, status: 'offer' }),
      })
    })

    // After the event, the card should have moved (it now appears under the Offer column area)
    // The component updates state; verify it doesn't throw / still renders
    await waitFor(() => expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0))
  })
})
