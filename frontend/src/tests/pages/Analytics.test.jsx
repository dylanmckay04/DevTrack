import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { renderWithProviders } from '../utils/renderWithProviders'
import { makeApplication } from '../mocks/fixtures'
import Analytics from '../../pages/Analytics'

function getStatValue(labelText) {
  // Each stat card: <span statValue>N</span><span statLabel>label</span>
  const label = screen.getByText(labelText)
  return label.previousSibling?.textContent
}

describe('Analytics — loading', () => {
  it('shows loading indicator initially', () => {
    renderWithProviders(<Analytics />)
    expect(screen.getByText('loading...')).toBeInTheDocument()
  })
})

describe('Analytics — stats', () => {
  it('shows correct total application count', async () => {
    server.use(
      http.get('http://localhost:8000/applications', () =>
        HttpResponse.json([
          makeApplication({ id: 1, status: 'applied' }),
          makeApplication({ id: 2, status: 'interviewing' }),
          makeApplication({ id: 3, status: 'offer' }),
        ])
      )
    )

    renderWithProviders(<Analytics />)
    await waitFor(() => expect(screen.getByText('total applications')).toBeInTheDocument())
    expect(getStatValue('total applications')).toBe('3')
  })

  it('calculates offer rate correctly', async () => {
    server.use(
      http.get('http://localhost:8000/applications', () =>
        HttpResponse.json([
          makeApplication({ id: 1, status: 'applied' }),
          makeApplication({ id: 2, status: 'applied' }),
          makeApplication({ id: 3, status: 'offer' }),
          makeApplication({ id: 4, status: 'offer' }),
        ])
      )
    )

    renderWithProviders(<Analytics />)
    await waitFor(() => expect(screen.getByText('offer rate')).toBeInTheDocument())
    // 2 offers / 4 total = 50.0%
    expect(getStatValue('offer rate')).toBe('50.0%')
  })

  it('counts active applications (excludes rejected)', async () => {
    server.use(
      http.get('http://localhost:8000/applications', () =>
        HttpResponse.json([
          makeApplication({ id: 1, status: 'applied' }),
          makeApplication({ id: 2, status: 'interviewing' }),
          makeApplication({ id: 3, status: 'rejected' }),
          makeApplication({ id: 4, status: 'rejected' }),
        ])
      )
    )

    renderWithProviders(<Analytics />)
    await waitFor(() => expect(screen.getByText('active')).toBeInTheDocument())
    // 2 active (applied + interviewing)
    expect(getStatValue('active')).toBe('2')
  })

  it('shows 0 rates with no applications', async () => {
    server.use(
      http.get('http://localhost:8000/applications', () => HttpResponse.json([]))
    )

    renderWithProviders(<Analytics />)
    await waitFor(() => expect(screen.getByText('total applications')).toBeInTheDocument())
    expect(getStatValue('total applications')).toBe('0')
    expect(getStatValue('offer rate')).toBe('0%')
    expect(getStatValue('interview rate')).toBe('0%')
  })

  it('renders chart section headings', async () => {
    renderWithProviders(<Analytics />)
    await waitFor(() => expect(screen.getByText('// applications by status')).toBeInTheDocument())
    expect(screen.getByText('// applications per week')).toBeInTheDocument()
  })
})
