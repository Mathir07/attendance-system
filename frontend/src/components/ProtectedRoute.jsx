import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from './LoadingSpinner'

export default function ProtectedRoute({ role }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner full />

  if (!user) return <Navigate to="/login" replace />

  // HR/admin can both access the HR portal
  if (role === 'hr' && user.role !== 'hr' && user.role !== 'admin')
    return <Navigate to="/employee/dashboard" replace />

  if (role === 'employee' && user.role !== 'employee')
    return <Navigate to="/hr/dashboard" replace />

  return <Outlet />
}
