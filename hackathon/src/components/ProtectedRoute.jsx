import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function ProtectedRoute({ children }) {
  const { isAuthenticated, user } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Block pending users
  if (user?.role === 'pending') {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <h2>Account Pending Approval</h2>
        <p>Your account is pending admin approval. Please wait for an administrator to approve your access.</p>
      </div>
    )
  }

  return children
}

export default ProtectedRoute

