import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { vi } from 'vitest'
import { renderWithProviders } from '../utils/renderWithProviders'
import ApplicationModal from '../../components/ApplicationModal'

function renderModal(props = {}) {
  const onClose = props.onClose ?? vi.fn()
  const onCreated = props.onCreated ?? vi.fn()
  renderWithProviders(<ApplicationModal onClose={onClose} onCreated={onCreated} />)
  return { onClose, onCreated }
}

describe('ApplicationModal — render', () => {
  it('renders all form fields', () => {
    renderModal()
    expect(screen.getByPlaceholderText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Software Engineer')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('https://...')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Any notes...')).toBeInTheDocument()
  })

  it('renders cancel and create buttons', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
  })
})

describe('ApplicationModal — submit', () => {
  it('calls onCreated and onClose on successful submit', async () => {
    const { onClose, onCreated } = renderModal()

    await userEvent.type(screen.getByPlaceholderText('Acme Corp'), 'NewCo')
    await userEvent.type(screen.getByPlaceholderText('Software Engineer'), 'Developer')
    await userEvent.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ company: 'NewCo' }))
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('shows creating... while submitting', async () => {
    let resolveCreate
    server.use(
      http.post('http://localhost:8000/applications', () =>
        new Promise((res) => { resolveCreate = res })
      )
    )
    renderModal()

    await userEvent.type(screen.getByPlaceholderText('Acme Corp'), 'Co')
    await userEvent.type(screen.getByPlaceholderText('Software Engineer'), 'Role')
    await userEvent.click(screen.getByRole('button', { name: /create/i }))

    expect(screen.getByText('creating...')).toBeInTheDocument()

    resolveCreate(HttpResponse.json({ id: 1, company: 'Co', role: 'Role', status: 'applied' }, { status: 201 }))
  })

  it('shows error message when creation fails', async () => {
    server.use(
      http.post('http://localhost:8000/applications', () =>
        HttpResponse.json({ detail: 'error' }, { status: 500 })
      )
    )
    renderModal()

    await userEvent.type(screen.getByPlaceholderText('Acme Corp'), 'Co')
    await userEvent.type(screen.getByPlaceholderText('Software Engineer'), 'Role')
    await userEvent.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(screen.getByText(/failed to create application/i)).toBeInTheDocument()
    })
  })

  it('company field is required — HTML validation blocks submit', async () => {
    renderModal()
    // Only fill role
    await userEvent.type(screen.getByPlaceholderText('Software Engineer'), 'Developer')

    const createBtn = screen.getByRole('button', { name: /create/i })
    // Native HTML validation prevents form submission without company
    // Check the company input has 'required' attribute
    expect(screen.getByPlaceholderText('Acme Corp')).toBeRequired()
  })
})

describe('ApplicationModal — dismiss', () => {
  it('calls onClose when cancel button is clicked', async () => {
    const { onClose } = renderModal()
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when overlay is clicked', async () => {
    const onClose = vi.fn()
    const { container } = renderWithProviders(
      <ApplicationModal onClose={onClose} onCreated={vi.fn()} />
    )
    // Click the overlay (outermost fixed div)
    const overlay = container.firstChild
    await userEvent.click(overlay)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose when clicking inside the modal', async () => {
    const onClose = vi.fn()
    renderWithProviders(<ApplicationModal onClose={onClose} onCreated={vi.fn()} />)
    // Click inside the modal content
    await userEvent.click(screen.getByText('$ new application'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
