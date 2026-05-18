import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithProviders } from '../utils/renderWithProviders'
import { makeApplication } from '../mocks/fixtures'
import ApplicationCard from '../../components/ApplicationCard'

const mockUseDraggable = vi.fn(() => ({
  attributes: {},
  listeners: {},
  setNodeRef: vi.fn(),
  transform: null,
  isDragging: false,
}))

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useDraggable: (...args) => mockUseDraggable(...args),
  }
})

vi.mock('@dnd-kit/utilities', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    CSS: { Translate: { toString: vi.fn(() => '') } },
  }
})

beforeEach(() => {
  mockUseDraggable.mockReturnValue({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  })
})

describe('ApplicationCard — render', () => {
  it('renders company name and role', () => {
    renderWithProviders(<ApplicationCard app={makeApplication()} />)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('Software Engineer')).toBeInTheDocument()
  })

  it('shows formatted applied_at date when present', () => {
    // Use noon UTC to avoid timezone-dependent off-by-one on the date
    renderWithProviders(<ApplicationCard app={makeApplication({ applied_at: '2026-01-15T12:00:00Z' })} />)
    expect(screen.getByText(/jan 15/i)).toBeInTheDocument()
  })

  it('falls back to created_at when applied_at is null', () => {
    renderWithProviders(<ApplicationCard app={makeApplication({ applied_at: null, created_at: '2026-03-20T12:00:00Z' })} />)
    expect(screen.getByText(/mar 20/i)).toBeInTheDocument()
  })

  it('shows link indicator when job_url is set', () => {
    renderWithProviders(<ApplicationCard app={makeApplication({ job_url: 'https://example.com' })} />)
    expect(screen.getByText('↗ link')).toBeInTheDocument()
  })

  it('does not show link indicator when job_url is empty', () => {
    renderWithProviders(<ApplicationCard app={makeApplication({ job_url: '' })} />)
    expect(screen.queryByText('↗ link')).not.toBeInTheDocument()
  })
})

describe('ApplicationCard — dragging state', () => {
  it('applies reduced opacity when isDragging is true', () => {
    mockUseDraggable.mockReturnValue({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      isDragging: true,
    })

    renderWithProviders(<ApplicationCard app={makeApplication()} />)
    // The card wrapper contains the company span — find the outer card div via its style
    const companySpan = screen.getByText('Acme Corp')
    const cardDiv = companySpan.closest('div')?.parentElement
    // opacity is applied on the outermost card div
    expect(cardDiv?.style?.opacity).toBe('0.45')
  })
})

describe('ApplicationCard — drag overlay mode', () => {
  it('renders without error when isDragOverlay is true', () => {
    renderWithProviders(<ApplicationCard app={makeApplication()} isDragOverlay />)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })
})

describe('ApplicationCard — click navigation', () => {
  it('does not throw when clicking a non-overlay card', async () => {
    renderWithProviders(<ApplicationCard app={makeApplication({ id: 5 })} />, {
      initialEntries: ['/'],
    })
    // Clicking should trigger navigate — just verify it doesn't throw
    const card = screen.getByText('Acme Corp').closest('div')?.parentElement
    if (card) await userEvent.click(card)
    // Navigation in MemoryRouter doesn't throw; the test passes if we get here
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })
})
