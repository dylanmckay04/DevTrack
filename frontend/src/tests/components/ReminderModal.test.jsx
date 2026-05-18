import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { vi } from 'vitest'
import { renderWithProviders } from '../utils/renderWithProviders'
import ReminderModal from '../../components/ReminderModal'

function renderModal(props = {}) {
  const onClose = props.onClose ?? vi.fn()
  const onCreated = props.onCreated ?? vi.fn()
  const appId = props.appId ?? '1'
  renderWithProviders(<ReminderModal onClose={onClose} onCreated={onCreated} appId={appId} />)
  return { onClose, onCreated }
}

describe('ReminderModal — render', () => {
  it('renders message textarea and datetime-local input', () => {
    renderModal()
    expect(screen.getByPlaceholderText('Any message...')).toBeInTheDocument()
    expect(document.querySelector('input[type="datetime-local"]')).toBeInTheDocument()
  })

  it('renders cancel and create buttons', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
  })
})

describe('ReminderModal — submit', () => {
  it('calls onCreated and onClose on successful submit', async () => {
    const { onClose, onCreated } = renderModal()

    await userEvent.type(screen.getByPlaceholderText('Any message...'), 'Follow up tomorrow')
    fireEvent.change(document.querySelector('input[type="datetime-local"]'), { target: { value: '2026-03-01T10:00' } })
    await userEvent.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      // onCreated receives the server response (which echoes back the typed message)
      expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ message: 'Follow up tomorrow' }))
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('sends application_id in payload', async () => {
    let capturedBody = null
    server.use(
      http.post('http://localhost:8000/reminders', async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ id: 10, message: 'Test', remind_at: '2026-03-01T10:00:00.000Z', application_id: 1 }, { status: 201 })
      })
    )

    renderModal({ appId: '1' })

    await userEvent.type(screen.getByPlaceholderText('Any message...'), 'Test')
    fireEvent.change(document.querySelector('input[type="datetime-local"]'), { target: { value: '2026-03-01T10:00' } })
    await userEvent.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(capturedBody?.application_id).toBe(1)
    })
  })

  it('converts remind_at to ISO string before sending', async () => {
    let capturedBody = null
    server.use(
      http.post('http://localhost:8000/reminders', async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ id: 10, message: 'Test', remind_at: capturedBody.remind_at, application_id: 1 }, { status: 201 })
      })
    )

    renderModal()
    await userEvent.type(screen.getByPlaceholderText('Any message...'), 'Test')
    fireEvent.change(document.querySelector('input[type="datetime-local"]'), { target: { value: '2026-03-01T10:00' } })
    await userEvent.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      // ISO format ends with 'Z' or '+...'
      expect(capturedBody?.remind_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  it('shows error message when creation fails', async () => {
    server.use(
      http.post('http://localhost:8000/reminders', () =>
        HttpResponse.json({ detail: 'error' }, { status: 500 })
      )
    )
    renderModal()

    await userEvent.type(screen.getByPlaceholderText('Any message...'), 'Test')
    fireEvent.change(document.querySelector('input[type="datetime-local"]'), { target: { value: '2026-03-01T10:00' } })
    await userEvent.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(screen.getByText(/failed to create reminder/i)).toBeInTheDocument()
    })
  })
})

describe('ReminderModal — dismiss', () => {
  it('calls onClose when cancel is clicked', async () => {
    const { onClose } = renderModal()
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
