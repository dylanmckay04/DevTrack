import { http, HttpResponse } from 'msw'
import { mockUser, mockToken, makeApplication, makeDocument, makeReminder, makePaginatedResponse } from './fixtures'

const BASE = 'http://localhost:8000'

export const handlers = [
  // Auth
  http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json({ access_token: mockToken })
  ),

  http.post(`${BASE}/auth/register`, () =>
    HttpResponse.json({ message: 'registered' }, { status: 201 })
  ),

  http.get(`${BASE}/auth/me`, () =>
    HttpResponse.json(mockUser)
  ),

  http.post(`${BASE}/auth/socket-token`, () =>
    HttpResponse.json({ socket_token: 'mock-socket-token' })
  ),

  // Applications
  http.get(`${BASE}/applications`, () =>
    HttpResponse.json([makeApplication()])
  ),

  http.get(`${BASE}/applications/paginated`, ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') || 'applied'
    return HttpResponse.json(makePaginatedResponse([makeApplication({ status })]))
  }),

  http.get(`${BASE}/applications/:id`, ({ params }) =>
    HttpResponse.json(makeApplication({ id: Number(params.id) }))
  ),

  http.post(`${BASE}/applications`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(makeApplication({ ...body, id: 99 }), { status: 201 })
  }),

  http.patch(`${BASE}/applications/:id`, async ({ params, request }) => {
    const body = await request.json()
    return HttpResponse.json(makeApplication({ id: Number(params.id), ...body }))
  }),

  http.patch(`${BASE}/applications/:id/status`, async ({ params, request }) => {
    const { status } = await request.json()
    return HttpResponse.json(makeApplication({ id: Number(params.id), status }))
  }),

  http.delete(`${BASE}/applications/:id`, () =>
    new HttpResponse(null, { status: 204 })
  ),

  // Documents
  http.get(`${BASE}/applications/:id/documents`, () =>
    HttpResponse.json([makeDocument()])
  ),

  http.post(`${BASE}/applications/:id/documents`, () =>
    HttpResponse.json(makeDocument({ id: 2, filename: 'cover_letter.pdf' }), { status: 201 })
  ),

  http.delete(`${BASE}/applications/:appId/documents/:docId`, () =>
    new HttpResponse(null, { status: 204 })
  ),

  http.get(`${BASE}/applications/:appId/documents/:docId/preview`, () =>
    HttpResponse.json({ url: 'https://s3.example.com/mock-preview.pdf' })
  ),

  // Reminders
  http.get(`${BASE}/reminders`, () =>
    HttpResponse.json([makeReminder()])
  ),

  http.post(`${BASE}/reminders`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(makeReminder({ ...body, id: 10 }), { status: 201 })
  }),

  http.delete(`${BASE}/reminders/:id`, () =>
    new HttpResponse(null, { status: 204 })
  ),
]
