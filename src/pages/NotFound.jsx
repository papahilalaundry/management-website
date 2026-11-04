import { Compass } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'

export default function NotFound() {
  return (
    <div className="card">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you’re looking for doesn’t exist or may have been moved."
        action={<Button to="/dashboard">Go to dashboard</Button>}
      />
    </div>
  )
}
