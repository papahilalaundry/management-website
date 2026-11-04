import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import AppLayout from './components/layout/AppLayout'
import { GuestOnly, RequireAuth, RequirePermission } from './routes/guards'
import { PageSkeleton } from './components/ui/Skeleton'
import Login from './pages/Login'
import NotFound from './pages/NotFound'

// Route-level code splitting keeps the initial bundle small.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Orders = lazy(() => import('./pages/Orders'))
const CreateOrder = lazy(() => import('./pages/CreateOrder'))
const OrderDetails = lazy(() => import('./pages/OrderDetails'))
const Customers = lazy(() => import('./pages/Customers'))
const CustomerDetails = lazy(() => import('./pages/CustomerDetails'))
const Services = lazy(() => import('./pages/Services'))
const Payments = lazy(() => import('./pages/Payments'))
const Expenses = lazy(() => import('./pages/Expenses'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Staff = lazy(() => import('./pages/Staff'))
const Reports = lazy(() => import('./pages/Reports'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Settings = lazy(() => import('./pages/Settings'))

const guarded = (permission, element) => (
  <RequirePermission permission={permission}>
    <Suspense fallback={<PageSkeleton />}>{element}</Suspense>
  </RequirePermission>
)

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={guarded('dashboard.view', <Dashboard />)} />
              <Route path="/orders" element={guarded('orders.view', <Orders />)} />
              <Route path="/orders/new" element={guarded('orders.create', <CreateOrder />)} />
              <Route path="/orders/:id" element={guarded('orders.view', <OrderDetails />)} />
              <Route path="/orders/:id/edit" element={guarded('orders.edit', <CreateOrder />)} />
              <Route path="/customers" element={guarded('customers.view', <Customers />)} />
              <Route path="/customers/:id" element={guarded('customers.view', <CustomerDetails />)} />
              <Route path="/services" element={guarded('services.view', <Services />)} />
              <Route path="/payments" element={guarded('payments.view', <Payments />)} />
              <Route path="/expenses" element={guarded('expenses.view', <Expenses />)} />
              <Route path="/inventory" element={guarded('inventory.view', <Inventory />)} />
              <Route path="/staff" element={guarded('staff.view', <Staff />)} />
              <Route path="/reports" element={guarded('reports.view', <Reports />)} />
              <Route path="/notifications" element={guarded('notifications.view', <Notifications />)} />
              <Route path="/settings" element={guarded('settings.view', <Settings />)} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors closeButton toastOptions={{ className: 'font-sans' }} />
      </AuthProvider>
    </SettingsProvider>
  )
}
