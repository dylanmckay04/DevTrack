import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMe } from '../services/api'
import { useAuth } from '../hooks/useAuth'

export default function GitHubCallback() {
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) {
      navigate('/login')
      return
    }
    localStorage.setItem('token', token)
    getMe()
      .then((res) => {
        login(token, res.data)
        navigate('/')
      })
      .catch(() => {
        localStorage.removeItem('token')
        navigate('/login')
      })
  }, [])

  return (
    <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>authenticating...</div>
  )
}
