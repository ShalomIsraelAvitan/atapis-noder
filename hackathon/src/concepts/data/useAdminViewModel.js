import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { demoOptionsFromLocation } from '../../design-lab/shared/useAtapisData'
import { useAuth } from '../../context/AuthContext'

// Admin view model — every action maps to a REAL backend call through
// AuthContext (/api/users CRUD). Destructive actions go through a confirm
// object consumed by the shared ConfirmDialog.

export function useAdminViewModel() {
  const location = useLocation()
  const demo = demoOptionsFromLocation(location.search)
  const { user: currentUser, users, fetchUsers, updateUser, deleteUser, signup } = useAuth()

  const [feedback, setFeedback] = useState(null) // {ok, message}
  const [busyId, setBusyId] = useState(null)
  const [confirm, setConfirm] = useState(null) // {title, body, confirmLabel, danger, onConfirm}
  const [editing, setEditing] = useState(null) // user object being edited
  const [adding, setAdding] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(null) // details-pane selection

  useEffect(() => {
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const flash = useCallback((ok, message) => {
    setFeedback({ ok, message })
    window.setTimeout(() => setFeedback(null), 3500)
  }, [])

  const stats = useMemo(() => {
    const list = users || []
    return {
      total: list.length,
      admins: list.filter((u) => u.role === 'admin').length,
      regular: list.filter((u) => u.role === 'user').length,
      pending: list.filter((u) => u.role === 'pending').length,
    }
  }, [users])

  const pendingUsers = useMemo(() => (users || []).filter((u) => u.role === 'pending'), [users])

  const selectedUser = useMemo(
    () => (users || []).find((u) => u.id === selectedUserId) || null,
    [users, selectedUserId]
  )

  const approve = useCallback(async (target) => {
    setBusyId(target.id)
    const result = await updateUser(target.id, { role: 'user' })
    setBusyId(null)
    flash(Boolean(result?.success), result?.success ? `Approved ${target.username}` : result?.error || 'Approve failed')
    if (result?.success) fetchUsers()
  }, [updateUser, fetchUsers, flash])

  const requestDelete = useCallback((target, reject = false) => {
    setConfirm({
      title: reject ? 'Reject pending user' : 'Delete user',
      titleHe: reject ? 'דחיית משתמש ממתין' : 'מחיקת משתמש',
      body: `This permanently removes "${target.username}" (${target.email || 'no email'}). This cannot be undone.`,
      bodyHe: `פעולה זו מוחקת לצמיתות את "${target.username}" (${target.email || 'ללא אימייל'}). לא ניתן לשחזר.`,
      confirmLabel: reject ? 'Reject & delete' : 'Delete',
      confirmLabelHe: reject ? 'דחייה ומחיקה' : 'מחיקה',
      danger: true,
      onConfirm: async () => {
        setBusyId(target.id)
        const result = await deleteUser(target.id)
        setBusyId(null)
        setConfirm(null)
        flash(Boolean(result?.success), result?.success ? `Deleted ${target.username}` : result?.error || 'Delete failed')
        if (result?.success) fetchUsers()
      },
    })
  }, [deleteUser, fetchUsers, flash])

  const saveEdit = useCallback(async (values) => {
    if (!editing) return
    setBusyId(editing.id)
    const result = await updateUser(editing.id, values)
    setBusyId(null)
    flash(Boolean(result?.success), result?.success ? `Updated ${values.username || editing.username}` : result?.error || 'Update failed')
    if (result?.success) {
      setEditing(null)
      fetchUsers()
    }
  }, [editing, updateUser, fetchUsers, flash])

  const addUser = useCallback(async ({ username, password, email, role }) => {
    const result = await signup(username, password, email, role || 'user')
    flash(Boolean(result?.success), result?.success ? `Created ${username}` : result?.error || 'Create failed')
    if (result?.success) {
      setAdding(false)
      fetchUsers()
    }
    return result
  }, [signup, fetchUsers, flash])

  return {
    demo,
    currentUser,
    users: users || [],
    pendingUsers,
    stats,
    feedback,
    busyId,
    confirm,
    setConfirm,
    editing,
    setEditing,
    adding,
    setAdding,
    selectedUser,
    selectedUserId,
    setSelectedUserId,
    actions: { approve, requestDelete, saveEdit, addUser, refresh: fetchUsers },
  }
}
