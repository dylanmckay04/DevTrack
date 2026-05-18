import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { AuthProvider, AuthContext } from '../../context/AuthContext'
import { useAuth } from '../../hooks/useAuth'

function TestChild() {
  const { user, loading, login, logout } = useAuth()
  if (loading) return <div>loading...</div>
  return (
    <div>
      <div data-testid="user">{user?.email ?? 'null'}</div>
      <button onClick={() => login('tok', { id: 2, email: 'new@example.com' })}>do login</button>
      <button onClick={logout}>do logout</button>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div>loading...</div>
  return user ? children : <Navigate to="/login" replace />
}

function renderWithAuth(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route path="/" element={
            <ProtectedRoute>
              <TestChild />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('AuthProvider — no token', () => {
  it('resolves loading to false with null user when no token stored', async () => {
    renderWithAuth()
    await waitFor(() => {
      expect(screen.queryByText('loading...')).not.toBeInTheDocument()
    })
    // ProtectedRoute redirected to /login since user is null
    expect(screen.getByText('login page')).toBeInTheDocument()
  })
})

describe('AuthProvider — with valid token', () => {
  it('calls GET /auth/me and sets user when token is stored', async () => {
    localStorage.setItem('token', 'stored-token')
    render(
      <MemoryRouter>
        <AuthProvider>
          <TestChild />
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
    })
  })
})

describe('AuthProvider — with invalid token', () => {
  it('removes token and leaves user null when GET /auth/me returns 401', async () => {
    server.use(
      http.get('http://localhost:8000/auth/me', () =>
        HttpResponse.json({ detail: 'unauthorized' }, { status: 401 })
      )
    )
    localStorage.setItem('token', 'bad-token')
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>login page</div>} />
            <Route path="/" element={
              <ProtectedRoute><TestChild /></ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('login page')).toBeInTheDocument()
    })
    expect(localStorage.getItem('token')).toBeNull()
  })
})

describe('login() and logout()', () => {
  it('login() sets token in localStorage and updates user', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <TestChild />
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByTestId('user')).toBeInTheDocument())

    await userEvent.click(screen.getByText('do login'))

    expect(localStorage.getItem('token')).toBe('tok')
    expect(screen.getByTestId('user')).toHaveTextContent('new@example.com')
  })

  it('logout() removes token from localStorage and nulls user', async () => {
    localStorage.setItem('token', 'stored-token')
    render(
      <MemoryRouter>
        <AuthProvider>
          <TestChild />
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('test@example.com'))

    await userEvent.click(screen.getByText('do logout'))

    expect(localStorage.getItem('token')).toBeNull()
    expect(screen.getByTestId('user')).toHaveTextContent('null')
  })
})

describe('ProtectedRoute', () => {
  it('shows loading indicator while auth resolves', () => {
    localStorage.setItem('token', 'tok')
    render(
      <MemoryRouter>
        <AuthProvider>
          <ProtectedRoute><div>protected</div></ProtectedRoute>
        </AuthProvider>
      </MemoryRouter>
    )
    expect(screen.getByText('loading...')).toBeInTheDocument()
  })

  it('renders children when user is authenticated', async () => {
    localStorage.setItem('token', 'tok')
    render(
      <MemoryRouter>
        <AuthProvider>
          <ProtectedRoute><div>secret content</div></ProtectedRoute>
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('secret content')).toBeInTheDocument())
  })

  it('redirects to /login when unauthenticated', async () => {
    renderWithAuth()
    await waitFor(() => {
      expect(screen.getByText('login page')).toBeInTheDocument()
    })
  })
})
