import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import { mockUser } from '../mocks/fixtures'
import { vi } from 'vitest'

const defaultAuth = {
  user: mockUser,
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
}

export function renderWithProviders(
  ui,
  { initialEntries = ['/'], authValue = defaultAuth, ...opts } = {}
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={initialEntries}>
        <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
      </MemoryRouter>
    ),
    ...opts,
  })
}

// For pages that use useParams — wraps in a Route to supply route params
export function renderWithRoute(element, path, initialPath, authValue = defaultAuth) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthContext.Provider value={authValue}>
        <Routes>
          <Route path={path} element={element} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

export function renderUnauthenticated(ui, opts = {}) {
  return renderWithProviders(ui, {
    authValue: { user: null, loading: false, login: vi.fn(), logout: vi.fn() },
    ...opts,
  })
}
