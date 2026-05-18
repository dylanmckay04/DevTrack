import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api.js — auth interceptor', () => {
  it('includes Authorization header when token is in localStorage', async () => {
    localStorage.setItem('token', 'my-token')
    const { getApplications } = await import('../../services/api')
    let capturedAuth = null
    server.use(
      http.get('http://localhost:8000/applications', ({ request }) => {
        capturedAuth = request.headers.get('Authorization')
        return HttpResponse.json([])
      })
    )

    await getApplications()

    expect(capturedAuth).toBe('Bearer my-token')
  })

  it('does not include Authorization header when no token stored', async () => {
    const { getApplications } = await import('../../services/api')
    let capturedAuth = 'not-checked'
    server.use(
      http.get('http://localhost:8000/applications', ({ request }) => {
        capturedAuth = request.headers.get('Authorization')
        return HttpResponse.json([])
      })
    )

    await getApplications()

    expect(capturedAuth).toBeNull()
  })

  it('removes token from localStorage on 401 response', async () => {
    localStorage.setItem('token', 'expired-token')
    vi.stubGlobal('location', { href: '' })

    // jsdom's XHR adapter causes Axios to see 401s as network errors (no err.response).
    // Force the Node.js http adapter so MSW can propagate the 401 status properly.
    const { default: axios } = await import('axios')
    axios.defaults.adapter = 'http'

    const { getApplications } = await import('../../services/api')

    server.use(
      http.get('http://localhost:8000/applications', () =>
        HttpResponse.json({ detail: 'unauthorized' }, { status: 401 })
      )
    )

    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem')
    try {
      await getApplications()
    } catch {
      // expected to throw
    }

    expect(removeSpy).toHaveBeenCalledWith('token')
  })
})
