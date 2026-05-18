import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { AuthContext } from '../../context/AuthContext'
import { vi } from 'vitest'
import { renderWithProviders } from '../utils/renderWithProviders'
import GitHubCallback from '../../pages/GitHubCallback'

const unauthValue = { user: null, loading: false, login: vi.fn(), logout: vi.fn() }

function renderCallbackWithRoutes(search = '') {
  Object.defineProperty(window, 'location', { writable: true, value: { search } })
  const loginFn = vi.fn()
  render(
    <MemoryRouter initialEntries={[`/auth/github/callback${search}`]}>
      <AuthContext.Provider value={{ ...unauthValue, login: loginFn }}>
        <Routes>
          <Route path="/auth/github/callback" element={<GitHubCallback />} />
          <Route path="/login" element={<div>login page</div>} />
          <Route path="/" element={<div>home page</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
  return { loginFn }
}

beforeEach(() => {
  localStorage.clear()
})

describe('GitHubCallback — with token', () => {
  it('shows authenticating... on mount', () => {
    Object.defineProperty(window, 'location', { writable: true, value: { search: '?token=abc123' } })
    renderWithProviders(<GitHubCallback />)
    expect(screen.getByText('authenticating...')).toBeInTheDocument()
  })

  it('calls login() and navigates to / when token is present', async () => {
    const { loginFn } = renderCallbackWithRoutes('?token=abc123')

    await waitFor(() => {
      expect(loginFn).toHaveBeenCalledWith('abc123', expect.objectContaining({ email: 'test@example.com' }))
    })
    await waitFor(() => {
      expect(screen.getByText('home page')).toBeInTheDocument()
    })
  })
})

describe('GitHubCallback — without token', () => {
  it('navigates to /login immediately when no token in URL', async () => {
    renderCallbackWithRoutes('')

    await waitFor(() => {
      expect(screen.getByText('login page')).toBeInTheDocument()
    })
  })
})

describe('GitHubCallback — GET /auth/me failure', () => {
  it('removes token and navigates to /login when API call fails', async () => {
    server.use(
      http.get('http://localhost:8000/auth/me', () =>
        HttpResponse.json({ detail: 'error' }, { status: 401 })
      )
    )
    localStorage.setItem('token', 'bad-token')
    renderCallbackWithRoutes('?token=bad-token')

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBeNull()
    })
    await waitFor(() => {
      expect(screen.getByText('login page')).toBeInTheDocument()
    })
  })
})
