import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { AuthContext } from '../../context/AuthContext'
import { vi } from 'vitest'
import { renderUnauthenticated } from '../utils/renderWithProviders'
import Register from '../../pages/Register'

const unauthValue = { user: null, loading: false, login: vi.fn(), logout: vi.fn() }

function renderRegisterWithRoutes() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <AuthContext.Provider value={unauthValue}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

describe('Register page — render', () => {
  it('renders email and password fields', () => {
    renderUnauthenticated(<Register />)
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument()
  })

  it('renders OAuth links', () => {
    renderUnauthenticated(<Register />)
    const links = screen.getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('http://localhost:8000/auth/google')
    expect(hrefs).toContain('http://localhost:8000/auth/github')
  })

  it('renders link to login page', () => {
    renderUnauthenticated(<Register />)
    expect(screen.getByRole('link', { name: /login/i })).toHaveAttribute('href', '/login')
  })
})

describe('Register page — successful submit', () => {
  it('navigates to /login?registered=true after successful registration', async () => {
    renderRegisterWithRoutes()

    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'new@example.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(screen.getByText('login page')).toBeInTheDocument()
    })
  })

  it('shows creating account... while loading', async () => {
    let resolveRegister
    server.use(
      http.post('http://localhost:8000/auth/register', () =>
        new Promise((res) => { resolveRegister = res })
      )
    )
    renderUnauthenticated(<Register />)

    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'pass')
    await userEvent.click(screen.getByRole('button', { name: /register/i }))

    expect(screen.getByText('creating account...')).toBeInTheDocument()

    resolveRegister(HttpResponse.json({ message: 'registered' }, { status: 201 }))
  })
})

describe('Register page — failed submit', () => {
  it('shows detail from server error response', async () => {
    server.use(
      http.post('http://localhost:8000/auth/register', () =>
        HttpResponse.json({ detail: 'email already registered' }, { status: 409 })
      )
    )
    renderUnauthenticated(<Register />)

    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'dup@example.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(screen.getByText(/email already registered/i)).toBeInTheDocument()
    })
  })

  it('shows fallback error message on generic failure', async () => {
    server.use(
      http.post('http://localhost:8000/auth/register', () =>
        HttpResponse.json({}, { status: 500 })
      )
    )
    renderUnauthenticated(<Register />)

    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'pass')
    await userEvent.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(screen.getByText(/registration failed/i)).toBeInTheDocument()
    })
  })
})
