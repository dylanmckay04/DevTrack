import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { renderWithRoute } from '../utils/renderWithProviders'
import ApplicationDetail from '../../pages/ApplicationDetail'

function render(authValue) {
  return renderWithRoute(<ApplicationDetail />, '/applications/:id', '/applications/1', authValue)
}

function renderDetail() {
  return render(undefined)
}

describe('ApplicationDetail — loading and render', () => {
  it('shows loading indicator initially', () => {
    renderDetail()
    expect(screen.getByText('loading...')).toBeInTheDocument()
  })

  it('renders company, role, and status after loading', async () => {
    renderDetail()
    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument())
    expect(screen.getByText('Software Engineer')).toBeInTheDocument()
    // 'applied' status button should be visible
    expect(screen.getByRole('button', { name: /applied/i })).toBeInTheDocument()
  })
})

describe('ApplicationDetail — status change', () => {
  it('calls PATCH /status and updates displayed status', async () => {
    let patchedStatus = null
    server.use(
      http.patch('http://localhost:8000/applications/:id/status', async ({ request }) => {
        const body = await request.json()
        patchedStatus = body.status
        return HttpResponse.json({ id: 1, company: 'Acme Corp', role: 'Software Engineer', status: 'interviewing', job_url: '', notes: '', applied_at: null, created_at: '2026-01-15T00:00:00Z' })
      })
    )

    renderDetail()
    await waitFor(() => expect(screen.getByRole('button', { name: /interviewing/i })).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /interviewing/i }))

    await waitFor(() => expect(patchedStatus).toBe('interviewing'))
  })
})

describe('ApplicationDetail — editing', () => {
  it('shows edit inputs when edit button is clicked', async () => {
    renderDetail()
    await waitFor(() => expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))

    expect(screen.getByPlaceholderText('https://...')).toBeInTheDocument()
  })

  it('calls PATCH and exits editing mode on save', async () => {
    let patched = false
    server.use(
      http.patch('http://localhost:8000/applications/:id', async () => {
        patched = true
        return HttpResponse.json({ id: 1, company: 'Acme Corp', role: 'Software Engineer', status: 'applied', job_url: 'https://new.com', notes: 'new note', applied_at: null, created_at: '2026-01-15T00:00:00Z' })
      })
    )

    renderDetail()
    await waitFor(() => expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))

    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(patched).toBe(true))
    // Edit button returns after saving
    await waitFor(() => expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument())
  })

  it('exits editing mode without API call on cancel', async () => {
    let patched = false
    server.use(
      http.patch('http://localhost:8000/applications/:id', async () => {
        patched = true
        return HttpResponse.json({})
      })
    )

    renderDetail()
    await waitFor(() => expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(patched).toBe(false)
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
  })
})

describe('ApplicationDetail — delete', () => {
  it('calls DELETE and navigates away when confirmed', async () => {
    window.confirm = vi.fn(() => true)
    let deleted = false
    server.use(
      http.delete('http://localhost:8000/applications/:id', () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      })
    )

    renderDetail()
    await waitFor(() => expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => expect(deleted).toBe(true))
    // After navigation, the page content disappears
    await waitFor(() => expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument())
  })

  it('does not call DELETE when confirm is cancelled', async () => {
    window.confirm = vi.fn(() => false)
    let deleted = false
    server.use(
      http.delete('http://localhost:8000/applications/:id', () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      })
    )

    renderDetail()
    await waitFor(() => expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))

    await new Promise((r) => setTimeout(r, 50))
    expect(deleted).toBe(false)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })
})

describe('ApplicationDetail — documents', () => {
  it('renders document filename', async () => {
    renderDetail()
    await waitFor(() => expect(screen.getByText('resume.pdf')).toBeInTheDocument())
  })

  it('shows iframe when preview button is clicked on a PDF', async () => {
    renderDetail()
    await waitFor(() => expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /preview/i }))

    await waitFor(() => {
      expect(screen.getByTitle('resume.pdf')).toBeInTheDocument()
    })
  })

  it('removes document from list when remove button is clicked', async () => {
    renderDetail()
    await waitFor(() => expect(screen.getByText('resume.pdf')).toBeInTheDocument())

    await userEvent.click(screen.getAllByRole('button', { name: /remove/i })[0])

    await waitFor(() => expect(screen.queryByText('resume.pdf')).not.toBeInTheDocument())
  })
})

describe('ApplicationDetail — reminders', () => {
  it('renders reminder message', async () => {
    renderDetail()
    await waitFor(() => expect(screen.getByText('Follow up')).toBeInTheDocument())
  })

  it('opens ReminderModal when "+ add" is clicked', async () => {
    renderDetail()
    await waitFor(() => expect(screen.getByRole('button', { name: /\+ add/i })).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /\+ add/i }))

    expect(screen.getByText('$ new reminder')).toBeInTheDocument()
  })

  it('removes reminder when remove button is clicked', async () => {
    renderDetail()
    await waitFor(() => expect(screen.getByText('Follow up')).toBeInTheDocument())

    // Find the remove button in the reminders section (last remove button)
    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    await userEvent.click(removeButtons[removeButtons.length - 1])

    await waitFor(() => expect(screen.queryByText('Follow up')).not.toBeInTheDocument())
  })
})
