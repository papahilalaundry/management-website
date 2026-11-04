import { Navigate, useLocation } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'

/** Requires a signed-in user; otherwise redirects to /login and comes back after. */
export function RequireAuth({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

/** Requires a permission (see utils/permissions.js). */
export function RequirePermission({ permission, children }) {
  const { can } = useAuth()
  if (!can(permission)) {
    return (
      <div className="card">
        <EmptyState
          icon={ShieldCheck}
          title="You don’t have access to this page"
          description="This area is restricted to other roles. If you believe you need access, please contact your administrator."
          action={<Button to="/dashboard" variant="secondary">Back to dashboard</Button>}
        />
      </div>
    )
  }
  return children
}

export function GuestOnly({ children }) {
  const { user } = useAuth()
  if (user) return <Navigate to="/dashboard" replace />
  return children
}
