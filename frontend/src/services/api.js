import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const register = (data) => api.post('/auth/register', data)
export const login = (email, password) => {
  const form = new FormData()
  form.append('username', email)
  form.append('password', password)
  return api.post('/auth/login', form)
}
export const getMe = () => api.get('/auth/me')
export const getSocketToken = () => api.post('/auth/socket-token')

// Applications
export const getApplications = () => api.get('/applications')
export const getApplication = (id) => api.get(`/applications/${id}`)
export const createApplication = (data) => api.post('/applications', data)
export const updateApplication = (id, data) => api.patch(`/applications/${id}`, data)
export const updateStatus = (id, status) => api.patch(`/applications/${id}/status`, { status })
export const deleteApplication = (id) => api.delete(`/applications/${id}`)

// Documents
export const getDocuments = (appId) => api.get(`/applications/${appId}/documents`)
export const uploadDocument = (appId, file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/applications/${appId}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const deleteDocument = (appId, docId) => api.delete(`/applications/${appId}/documents/${docId}`)

// Reminders
export const getReminders = () => api.get('/reminders')
export const createReminder = (data) => api.post('/reminders', data)
export const deleteReminder = (id) => api.delete(`/reminders/${id}`)
