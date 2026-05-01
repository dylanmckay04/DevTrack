import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register as registerApi, login as loginApi, getMe } from '../services/api'
import { useAuth } from '../hooks/useAuth'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await registerApi({ email, password })
      const res = await loginApi(email, password)
      const token = res.data.access_token
      localStorage.setItem("token", token)
      const me = await getMe()
      login(res.data.access_token, me.data)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.logo}>~/devtrack</span>
          <p style={styles.sub}>create a new account</p>
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <p style={styles.error}>$ error: {error}</p>}
          <button type="submit" className="primary" disabled={loading} style={{ width: '100%', padding: '8px' }}>
            {loading ? 'creating account...' : '$ register'}
          </button>
        </form>
        <div style={styles.divider}>or</div>
        <a
          href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/auth/github`}
          style={styles.githubBtn}
        >
          $ register with github
        </a>
        <a
          href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/auth/google`}
          style={styles.githubBtn}
        >
          $ register with google
        </a>
        <p style={styles.footer}>
          have an account? <Link to="/login">login</Link>
        </p>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '32px', width: '100%', maxWidth: '360px' },
  header: { marginBottom: '24px' },
  logo: { color: 'var(--accent)', fontWeight: 700, fontSize: '16px' },
  sub: { color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { color: 'var(--text-secondary)', fontSize: '11px' },
  error: { color: 'var(--red)', fontSize: '11px' },
  divider: { textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', margin: '16px 0 0' },
  githubBtn: {
    display: 'block',
    marginTop: '8px',
    padding: '8px',
    textAlign: 'center',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    textDecoration: 'none',
    fontFamily: 'inherit',
  },
  footer: { marginTop: '20px', color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center' },
}
