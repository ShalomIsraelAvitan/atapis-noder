import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import './Navbar.css'

function Navbar() {
  const { user, isAuthenticated, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  // Full-site concept experiences render their own complete navigation shell;
  // the legacy navbar would create double navigation there. Active-site routes
  // are unaffected.
  if (location.pathname.startsWith('/concepts')) return null

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <Link to="/" className="brand-link">
            <span className="brand-text">Smart Security</span>
          </Link>
        </div>

        <div className="navbar-menu">
          <Link
            to="/"
            className={`nav-link ${isActive('/') ? 'active' : ''}`}
          >
            <span>About</span>
          </Link>
          {isAuthenticated ? (
            <>
              <Link
                to="/rooms"
                className={`nav-link ${isActive('/rooms') ? 'active' : ''}`}
              >
                <span>Dashboard</span>
              </Link>
              <Link
                to="/camera/1"
                className={`nav-link ${location.pathname.startsWith('/camera') ? 'active' : ''}`}
              >
                <span>Camera</span>
              </Link>
              <Link
                to="/design-lab"
                className={`nav-link ${location.pathname.startsWith('/design-lab') ? 'active' : ''}`}
              >
                <span>Design Lab</span>
              </Link>
              <Link
                to="/history"
                className={`nav-link ${isActive('/history') ? 'active' : ''}`}
              >
                <span>History</span>
              </Link>
              <Link
                to="/settings"
                className={`nav-link ${isActive('/settings') ? 'active' : ''}`}
              >
                <span>Settings</span>
              </Link>
              {user?.role === 'admin' && (
                <Link
                  to="/admin"
                  className={`nav-link ${isActive('/admin') ? 'active' : ''}`}
                >
                  <span>Admin</span>
                </Link>
              )}
            </>
          ) : (
            <>
              <Link
                to="/login"
                className={`nav-link ${isActive('/login') ? 'active' : ''}`}
              >
                <span>Login</span>
              </Link>
              <Link
                to="/signup"
                className={`nav-link ${isActive('/signup') ? 'active' : ''}`}
              >
                <span>Sign Up</span>
              </Link>
            </>
          )}
        </div>

        <div className="navbar-actions">
          <button onClick={toggleTheme} className="theme-toggle" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {isAuthenticated && (
            <div className="navbar-user">
              <span className="user-name">{user?.username || 'User'}</span>
              <button onClick={handleLogout} className="logout-btn">
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar

