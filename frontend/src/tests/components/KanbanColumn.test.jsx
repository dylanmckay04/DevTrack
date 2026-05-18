import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithProviders } from '../utils/renderWithProviders'
import { makeApplication } from '../mocks/fixtures'
import KanbanColumn from '../../components/KanbanColumn'

const mockUseDroppable = vi.fn(() => ({
  isOver: false,
  setNodeRef: vi.fn(),
}))

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
    useDroppable: (...args) => mockUseDroppable(...args),
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
  mockUseDroppable.mockReturnValue({ isOver: false, setNodeRef: vi.fn() })
  mockUseDraggable.mockReturnValue({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: null, isDragging: false })
})

function renderColumn(props = {}) {
  const defaults = {
    status: 'applied',
    applications: [],
    hasMore: false,
    loadingMore: false,
    onLoadMore: vi.fn(),
  }
  return renderWithProviders(<KanbanColumn {...defaults} {...props} />)
}

describe('KanbanColumn — render', () => {
  it('renders the column label', () => {
    renderColumn({ status: 'applied' })
    expect(screen.getByText('Applied')).toBeInTheDocument()
  })

  it('renders the application count badge', () => {
    renderColumn({ applications: [makeApplication(), makeApplication({ id: 2 })] })
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders one ApplicationCard per application', () => {
    renderColumn({
      applications: [
        makeApplication({ id: 1, company: 'Alpha' }),
        makeApplication({ id: 2, company: 'Beta' }),
      ],
    })
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('renders empty-state message when no applications', () => {
    renderColumn({ applications: [] })
    expect(screen.getByText('no applications')).toBeInTheDocument()
  })
})

describe('KanbanColumn — load more', () => {
  it('renders "load more" button when hasMore is true', () => {
    renderColumn({ hasMore: true })
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
  })

  it('does not render "load more" button when hasMore is false', () => {
    renderColumn({ hasMore: false })
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
  })

  it('calls onLoadMore when "load more" is clicked', async () => {
    const onLoadMore = vi.fn()
    renderColumn({ hasMore: true, onLoadMore })
    await userEvent.click(screen.getByRole('button', { name: /load more/i }))
    expect(onLoadMore).toHaveBeenCalledOnce()
  })

  it('disables button and shows loading... when loadingMore is true', () => {
    renderColumn({ hasMore: true, loadingMore: true })
    const btn = screen.getByRole('button', { name: /loading\.\.\./i })
    expect(btn).toBeDisabled()
  })
})
