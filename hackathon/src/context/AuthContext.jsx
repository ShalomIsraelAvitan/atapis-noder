import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

const API_BASE = 'http://localhost:5000/api'

const demoAccessEnabled = import.meta.env.VITE_DEMO_ACCESS === 'true'

function isDemoRequest() {
  if (!demoAccessEnabled || typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('demo') === '1' || params.get('demo') === 'true'
}

const DEMO_USER = Object.freeze({
  id: 'demo-operator',
  username: 'demo',
  role: 'operator',
  email: '',
  isDemo: true,
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (isDemoRequest()) return DEMO_USER
    // Try to load from localStorage on mount
    try {
      const savedUser = localStorage.getItem('user')
      const savedAuth = localStorage.getItem('isAuthenticated')
      if (savedUser && savedAuth === 'true') {
        return JSON.parse(savedUser)
      }
    } catch (e) {
      console.error('Error loading user from localStorage:', e)
    }
    return null
  })
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (isDemoRequest()) return true
    try {
      return localStorage.getItem('isAuthenticated') === 'true'
    } catch (e) {
      return false
    }
  })
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  // Load users from API on mount
  useEffect(() => {
    if (isDemoRequest()) {
      setLoading(false)
      return
    }
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/users`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const login = async (username, password) => {
    try {
      if (!username || !password) {
        return { success: false, error: 'Username and password are required' }
      }

      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      })
      
      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError)
        return { 
          success: false, 
          error: response.status === 401 
            ? 'Invalid username or password' 
            : `Server error (${response.status}). Please check if server is running.` 
        }
      }
      
      if (response.ok && data.success) {
        setUser(data.user)
        setIsAuthenticated(true)
        // Save to localStorage for persistence
        localStorage.setItem('user', JSON.stringify(data.user))
        localStorage.setItem('isAuthenticated', 'true')
        return { success: true }
      } else {
        return { success: false, error: data.error || 'Login failed' }
      }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: 'Network error. Please check if server is running on http://localhost:5000' }
    }
  }

  const signup = async (username, password, email, role = 'pending') => {
    try {
      const response = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email, role })
      })
      
      const data = await response.json()
      
      if (data.success) {
        await fetchUsers() // Refresh users list
        return { success: true, user: data.user }
      } else {
        return { success: false, error: data.error || 'Signup failed' }
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please check if server is running.' }
    }
  }

  const updateUser = async (userId, updates) => {
    try {
      const response = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      
      const data = await response.json()
      
      if (data.success) {
        await fetchUsers() // Refresh users list
        
        // Update current user if it's the logged-in user
        if (user && user.id === userId) {
          setUser(data.user)
        }
        return { success: true }
      } else {
        return { success: false, error: data.error || 'Update failed' }
      }
    } catch (error) {
      return { success: false, error: 'Network error' }
    }
  }

  const deleteUser = async (userId) => {
    // Prevent deleting yourself
    if (user && user.id === userId) {
      return { success: false, error: 'Cannot delete your own account' }
    }
    
    try {
      const response = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        await fetchUsers() // Refresh users list
        return { success: true }
      } else {
        return { success: false, error: data.error || 'Delete failed' }
      }
    } catch (error) {
      return { success: false, error: 'Network error' }
    }
  }

  const logout = () => {
    setUser(null)
    setIsAuthenticated(false)
    // Clear localStorage
    localStorage.removeItem('user')
    localStorage.removeItem('isAuthenticated')
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      users,
      loading,
      login, 
      logout,
      signup,
      updateUser,
      deleteUser,
      fetchUsers
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
