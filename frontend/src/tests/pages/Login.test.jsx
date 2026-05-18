import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { renderWithProviders, renderUnauthenticated } from '../utils/renderWithProviders'
import Login from '../../pages/Login'

beforeEach(() => {
  localStorage.clear()
})

describe('Login page — render', () => {
  it('renders email and password fields', () => {
    renderUnauthenticated(<Login />)
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
  })

  it('shows success message when ?registered=true', () => {
    renderUnauthenticated(<Login />, { initialEntries: ['/login?registered=true'] })
    expect(screen.getByText(/check your email/i)).toBeInTheDocument()
  })

  it('shows verified message when ?verified=true', () => {
    renderUnauthenticated(<Login />, { initialEntries: ['/login?verified=true'] })
    expect(screen.getByText(/email verified/i)).toBeInTheDocument()
  })

  it('renders OAuth links pointing to the API base URL', () => {
    renderUnauthenticated(<Login />)
    const links = screen.getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('http://localhost:8000/auth/google')
    expect(hrefs).toContain('http://localhost:8000/auth/github')
  })

  it('renders link to register page', () => {
    renderUnauthenticated(<Login />)
    expect(screen.getByRole('link', { name: /register/i })).toHaveAttribute('href', '/register')
  })
})

describe('Login page — successful submit', () => {
  it('calls login() and navigates to / on success', async () => {
    const loginFn = vi.fn()
    renderWithProviders(<Login />, {
      authValue: { user: null, loading: false, login: loginFn, logout: vi.fn() },
      initialEntries: ['/login'],
    })

    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(loginFn).toHaveBeenCalledWith('mock-jwt-token', expect.objectContaining({ email: 'test@example.com' }))
    })
  })

  it('shows authenticating... while loading', async () => {
    let resolveLogin
    server.use(
      http.post('http://localhost:8000/auth/login', () =>
        new Promise((res) => { resolveLogin = res })
      )
    )
    renderUnauthenticated(<Login />)

    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'pass')
    await userEvent.click(screen.getByRole('button', { name: /login/i }))

    expect(screen.getByText('authenticating...')).toBeInTheDocument()

    // cleanup
    resolveLogin(HttpResponse.json({ access_token: 'tok' }))
  })
})

describe('Login page — failed submit', () => {
  it('shows error message on invalid credentials', async () => {
    server.use(
      http.post('http://localhost:8000/auth/login', () =>
        HttpResponse.json({ detail: 'invalid' }, { status: 401 })
      )
    )
    renderUnauthenticated(<Login />)

    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'bad@example.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
  })
})
