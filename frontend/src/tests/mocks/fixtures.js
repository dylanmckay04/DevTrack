export const mockUser = { id: 1, email: 'test@example.com', is_verified: true }
export const mockToken = 'mock-jwt-token'

export const makeApplication = (overrides = {}) => ({
  id: 1,
  company: 'Acme Corp',
  role: 'Software Engineer',
  status: 'applied',
  job_url: 'https://acme.com/jobs/1',
  notes: '',
  applied_at: '2026-01-15T00:00:00Z',
  created_at: '2026-01-15T00:00:00Z',
  ...overrides,
})

export const makeDocument = (overrides = {}) => ({
  id: 1,
  filename: 'resume.pdf',
  application_id: 1,
  created_at: '2026-01-15T00:00:00Z',
  ...overrides,
})

export const makeReminder = (overrides = {}) => ({
  id: 1,
  message: 'Follow up',
  remind_at: '2026-02-01T10:00:00Z',
  application_id: 1,
  ...overrides,
})

export const makePaginatedResponse = (items, overrides = {}) => ({
  items,
  has_more: false,
  next_cursor: null,
  ...overrides,
})
