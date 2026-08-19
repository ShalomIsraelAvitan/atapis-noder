import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import './Admin.css'

function Admin() {
  const { users, updateUser, deleteUser, user: currentUser, signup, fetchUsers } = useAuth()
  const [selectedUser, setSelectedUser] = useState(null)
  const [editForm, setEditForm] = useState({ username: '', email: '', role: 'user' })
  
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'user' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleEdit = (user) => {
    setSelectedUser(user)
    setEditForm({
      username: user.username,
      email: user.email,
      role: user.role
    })
    setError('')
    setSuccess('')
  }

  const handleUpdate = async () => {
    if (!editForm.username || !editForm.email) {
      setError('Username and email are required')
      return
    }

    const result = await updateUser(selectedUser.id, editForm)
    if (result.success) {
      setSuccess('User updated successfully')
      setSelectedUser(null)
    } else {
      setError(result.error || 'Update failed')
    }
    setTimeout(() => {
      setError('')
      setSuccess('')
    }, 3000)
  }

  const handleDelete = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      const result = await deleteUser(userId)
      if (result.success) {
        setSuccess('User deleted successfully')
        if (selectedUser && selectedUser.id === userId) {
          setSelectedUser(null)
        }
      } else {
        setError(result.error || 'Delete failed')
      }
      setTimeout(() => {
        setError('')
        setSuccess('')
      }, 3000)
    }
  }

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) {
      setError('All fields are required')
      return
    }

    const result = await signup(newUser.username, newUser.password, newUser.email, newUser.role)
    
    if (result.success) {
      setSuccess('User created successfully')
      setNewUser({ username: '', email: '', password: '', role: 'user' })
      setShowAddUser(false)
    } else {
      setError(result.error || 'Creation failed')
    }
    
    setTimeout(() => {
      setError('')
      setSuccess('')
    }, 3000)
  }

  const regularUsers = users.filter(u => u.role === 'user')
  const adminUsers = users.filter(u => u.role === 'admin')
  const pendingUsers = users.filter(u => u.role === 'pending')

  const handleApprove = async (userId) => {
    const result = await updateUser(userId, { role: 'user' })
    if (result.success) {
      setSuccess('User approved successfully')
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser(null)
      }
    } else {
      setError(result.error || 'Approval failed')
    }
    setTimeout(() => {
      setError('')
      setSuccess('')
    }, 3000)
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <header className="admin-header">
          <div>
            <h1>Admin Panel</h1>
            <p>Manage users and system configuration</p>
          </div>
          <button 
            className="add-user-btn"
            onClick={() => {
              setShowAddUser(true)
              setError('')
              setSuccess('')
            }}
          >
            + Add User
          </button>
        </header>

        {(error || success) && (
          <div className={`alert ${error ? 'alert-error' : 'alert-success'}`}>
            {error || success}
          </div>
        )}

        {showAddUser && (
          <div className="add-user-panel">
            <h2>Add New User</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="Enter username"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="Enter email"
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Enter password"
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="panel-actions">
              <button onClick={handleAddUser} className="save-btn">Create User</button>
              <button onClick={() => setShowAddUser(false)} className="cancel-btn">Cancel</button>
            </div>
          </div>
        )}

        <div className="admin-stats">
          <div className="stat-card">
            <div className="stat-value">{users.length}</div>
            <div className="stat-label">Total Users</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{adminUsers.length}</div>
            <div className="stat-label">Admins</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{regularUsers.length}</div>
            <div className="stat-label">Regular Users</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{pendingUsers.length}</div>
            <div className="stat-label">Pending Approval</div>
          </div>
        </div>

        {pendingUsers.length > 0 && (
          <div className="users-section">
            <h2>Pending Users</h2>
            <div className="users-table">
              <div className="table-header">
                <div className="table-cell">Username</div>
                <div className="table-cell">Email</div>
                <div className="table-cell">Created</div>
                <div className="table-cell">Actions</div>
              </div>
              {pendingUsers.map((user) => (
                <div key={user.id} className="table-row">
                  <div className="table-cell">{user.username}</div>
                  <div className="table-cell">{user.email}</div>
                  <div className="table-cell">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                  <div className="table-cell">
                    <div className="action-buttons">
                      <button 
                        onClick={() => handleApprove(user.id)} 
                        className="approve-btn"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => handleDelete(user.id)} 
                        className="delete-btn"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="users-section">
          <h2>All Users</h2>
          <div className="users-table">
            <div className="table-header">
              <div className="table-cell">Username</div>
              <div className="table-cell">Email</div>
              <div className="table-cell">Role</div>
              <div className="table-cell">Created</div>
              <div className="table-cell">Actions</div>
            </div>
            {users.map((user) => (
              <div key={user.id} className="table-row">
                <div className="table-cell">
                  {user.username}
                  {user.id === currentUser?.id && <span className="current-user-badge">You</span>}
                </div>
                <div className="table-cell">{user.email}</div>
                <div className="table-cell">
                  <span className={`role-badge ${user.role}`}>{user.role}</span>
                </div>
                <div className="table-cell">
                  {new Date(user.createdAt).toLocaleDateString()}
                </div>
                <div className="table-cell">
                  <div className="action-buttons">
                    <button 
                      onClick={() => handleEdit(user)} 
                      className="edit-btn"
                    >
                      Edit
                    </button>
                    {user.id !== currentUser?.id && (
                      <button 
                        onClick={() => handleDelete(user.id)} 
                        className="delete-btn"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedUser && (
          <div className="edit-panel">
            <h2>Edit User: {selectedUser.username}</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="pending">Pending</option>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="panel-actions">
              <button onClick={handleUpdate} className="save-btn">Save Changes</button>
              <button onClick={() => setSelectedUser(null)} className="cancel-btn">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Admin

