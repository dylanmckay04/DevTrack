import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const styles = {
  nav: {
    background: 'var(--bg-surface)',
    borderBottom: '1px solid var(--border)',
    padding: '0 24px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  left: { display: 'flex', alignItems: 'center', gap: '24px' },
  logo: {
    color: 'var(--accent)',
    fontWeight: 700,
    fontSize: '13px',
    letterSpacing: '0.05em',
    textDecoration: 'none',
  },
  links: { display: 'flex', gap: '4px' },
  link: (active) => ({
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    textDecoration: 'none',
    padding: '4px 10px',
    borderRadius: 'var(--radius)',
    fontSize: '12px',
    background: active ? 'var(--bg-overlay)' : 'transparent',
    border: active ? '1px solid var(--border)' : '1px solid transparent',
    transition: 'all var(--transition)',
  }),
  right: { display: 'flex', alignItems: 'center', gap: '12px' },
  email: { color: 'var(--text-muted)', fontSize: '11px' },
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav style={styles.nav}>
      <div style={styles.left}>
        <Link to="/" style={styles.logo}>~/devtrack</Link>
        <div style={styles.links}>
          <Link to="/" style={styles.link(location.pathname === '/')}>board</Link>
          <Link to="/analytics" style={styles.link(location.pathname === '/analytics')}>analytics</Link>
        </div>
      </div>
      <div style={styles.right}>
        <span style={styles.email}>{user?.email}</span>
        <button onClick={handleLogout} className="danger" style={{ fontSize: '11px', padding: '4px 10px' }}>
          logout
        </button>
      </div>
    </nav>
  )
}
