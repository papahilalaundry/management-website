# Papa Hila Laundry — Management System

Internal laundry management system for **Papa Hila Laundry** (orders, garment tracking,
customers, M-Pesa/cash payments, receipts, expenses, inventory, staff, reports).

> ⚠️ **This is a front-end prototype with a simulated backend.**
> Authentication, M-Pesa payments and customer SMS are **simulated**. Data lives in the
> browser's `localStorage`. See [Going to production](#going-to-production).

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run lint
```

### Demo accounts

| Role    | Email                  | Password      |
|---------|------------------------|---------------|
| Admin   | admin@papahila.com     | `Admin123!`   |
| Manager | manager@papahila.com   | `Manager123!` |
| Staff   | staff@papahila.com     | `Staff123!`   |

Staff added through **Staff Management** get the demo password `Welcome123!`.

To restore the original sample data, go to **Settings → System → Reset demo data** (admin only).

## Phones and tablets

The system is built mobile-first and behaves like an app on phones (below 1024px wide):

- **Bottom tab bar** — Home, Orders, a raised **+** for a new order, Customers, and **More**
  (opens the full menu). Desktop keeps the sidebar.
- **App-style top bar** — back button on detail screens, full-screen search, notifications.
- **Lists become cards** — orders, customers, payments, expenses, inventory and staff show as
  tappable cards with a "Sort by" picker instead of wide tables (`DataTable`'s `mobileCard` prop).
- **Thumb-reach actions** — the order form has a sticky Save bar with the running total; order
  details has a bottom bar with **Pay** and **Mark as …**. Dialogs open as bottom sheets.
- **Install it like an app** — open the site in Chrome (Android) and choose *Add to Home screen* /
  *Install app*, or in Safari (iPhone) use *Share → Add to Home Screen*. It opens full-screen with
  its own icon, and keeps working without internet (the service worker in `public/sw.js` caches
  the app; data is already stored on the device). Install/offline needs the production build
  served over HTTPS (or `localhost`) — run `npm run build` and host `dist/`. The service worker is
  not active during `npm run dev`.

## Stack

React 19 · Vite · React Router 7 · Tailwind CSS 4 · lucide-react · Recharts · Sonner ·
date-fns · jsPDF + jspdf-autotable · SheetJS (xlsx, installed from the official SheetJS CDN).

Forms use a small shared validator module (`src/utils/validators.js`) instead of React Hook
Form + Zod. The same rules run in the form (inline errors) and in the mock API.

## Architecture

```
src/
  data/          constants.js (statuses, categories, SMS templates), mockData.js (seed generator), statusMeta.js
  services/      the "backend": one module per resource + shared helpers
    storage.js     localStorage persistence (one key per collection) + change events
    mockApi.js     request(): latency, simulated errors, auth & permission checks, ApiError
    *Service.js    orderService, customerService, paymentService, catalogService, expenseService,
                   inventoryService, staffService, notificationService, settingsService,
                   reportService, activityService, authService
    index.js       public API — UI imports only from here
  context/       AuthContext, SettingsContext, NotificationContext, SmsContext
  hooks/         useAsync (loading/error + live refresh), useTable (sort/paginate/select), useDebounce, useMediaQuery
  utils/         formatCurrency, formatDate, calculations, permissions, validators, pdf, exporters, print, dateRanges
  components/
    ui/          Button, Field/Input/Select/Textarea/Checkbox/Switch, Card, Modal/ConfirmDialog, Dropdown,
                 Tooltip, Tabs, Pagination, Skeleton, EmptyState, SearchInput, DataTable, Badge, Avatar
    layout/      AppLayout, Sidebar (collapsible + mobile drawer), BottomNav (phone tab bar), Topbar, GlobalSearch,
                 PageHeader/Breadcrumbs
    charts/      RevenueExpenseChart, VolumeBarChart, DonutChart, BarList
    orders/      OrderTable, GarmentRow, OrderProgress, UpdateStatusModal, useOrderActions
    customers/   CustomerPicker, CustomerFields, CustomerFormModal
    payments/    RecordPaymentModal, MethodToggle
    receipts/    ReceiptPreview (order + payment receipts), ReceiptModal (print / PDF)
    shared/      StatCard, StatusBadges, ActivityFeed, DateRangeFilter, NotificationIcon, SmsPreviewModal
  pages/         Login, Dashboard, Orders, CreateOrder (also edit), OrderDetails, Customers, CustomerDetails,
                 Services, Payments, Expenses, Inventory, Staff, Reports, Notifications, Settings
  routes/        navigation config, route guards
```

### Key business rules

- **Order pricing** — the agreed unit price is saved on each garment line. Changing a
  service price later never changes historical orders.
- **Totals** — subtotal + priority surcharge (express/urgent %) + extra charges − discount + tax
  (tax default 0%, configurable). Shared by the form and the API (`utils/calculations.js`).
- **Order status** — Received → Washing → Drying → Ironing → Ready → Delivered (+ Cancelled).
  Every garment has its own status; the order status is the least-advanced garment.
  Advancing the order moves lagging garments forward. Only managers/admins can move backwards.
- **Payments** — amount paid, balance and payment status are always *derived* from payment
  records, so they can't drift out of sync. Payments can't exceed the outstanding balance.
- **Reporting (cash basis)** — Revenue = payments recorded in the period. Unpaid balances are
  receivables, not revenue. Net profit = Revenue − recorded expenses.
- **Permissions** — defined once in `utils/permissions.js`; the UI hides what a role can't use
  and the mock API re-checks on every call. Nobody can change their own role or deactivate
  themselves, and at least one active admin must remain.

### Demo data

`data/mockData.js` generates ~12 months of consistent history (≈900 orders, 1,000+ payments,
130 expenses, 25 customers, 14 inventory items, 6 staff) with a seeded random generator,
relative to the first time the app is opened — so there are always orders received today,
in progress, overdue, etc. Every dashboard figure is calculated from these records.

## Going to production

1. **Backend API** — every UI call goes through `src/services/*`. Replace each function body
   with an HTTP call that returns the same shape, e.g.

   ```js
   // services/orderService.js
   getOrders: (params) => http.get('/orders', { params }),
   createOrder: (data) => http.post('/orders', data),
   ```

   Keep throwing `ApiError` (with `fields` for validation errors) so forms keep showing inline
   errors. `storage.js`, `mockApi.js`, `helpers.js` and `data/mockData.js` can then be deleted.
   Move business logic (totals, status derivation, report aggregation) to the server.
   `useAsync({ live: true })` currently refreshes on local change events; swap that for
   refetch-on-focus/polling or websockets.
2. **Authentication** — `authService.js` is SIMULATED (plain-text passwords in localStorage).
   Use a real identity backend: hashed passwords, httpOnly session cookies or short-lived
   tokens, server-side permission checks on every endpoint, rate-limited login.
3. **M-Pesa** — payments are only recorded manually. Integrate Safaricom Daraja (STK Push +
   callback confirmation) on the server; never trust a client-supplied reference.
4. **SMS** — messages are rendered from templates and logged only. Connect an SMS provider
   (e.g. Africa's Talking) server-side, triggered by the same events.
5. **File uploads** — expense receipts, logos and staff photos are placeholders; they need storage.

## Known limitations

- Single-browser data: nothing is shared between devices or users until a backend is connected.
- Dark mode is not implemented (the preference is shown as "planned").
- Receipt printing uses the browser print dialog with print-only CSS (A5).
- Selecting several orders for a bulk export is desktop-only; on phones, export uses the current filters.
