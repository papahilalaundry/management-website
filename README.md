# Papa Hila Laundry — Management System

Internal laundry management system for **Papa Hila Laundry** (orders priced by weight with
garment tracking, clients, Paybill / M-Pesa number / cash payments, receipts, expenses,
inventory, staff, reports).

The app runs in the browser and stores its data in **Cloud Firestore** in the Firebase project
**`management-system-49171`**. Sign-in uses **Firebase Authentication**.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run lint
```

The Firebase web config is in `src/firebase.js`. Those values identify the project and are not
secrets; access is controlled by Firebase Auth and the Firestore security rules.

### Signing in

Staff type only a **username**. Behind the scenes the login email is
`username@papahilalaundry.com` (these addresses don't need to exist as mailboxes).

- Admins create accounts in **Staff Management** (username + temporary password).
- Everyone changes their own password in **Settings → My profile**.
- Admins **cannot reset another person's password** from the app — that needs the Firebase
  Admin SDK (Cloud Functions on the paid Blaze plan). To lock someone out, set them to
  *Inactive*; their access is blocked immediately by the security rules.
- Each Auth user is linked to a staff record through `users/{uid}`
  (`{ staffId, username, role, active }`), which the security rules read.

To replace the business data with a small sample set, an admin can use
**Settings → Demo data → Reset demo data**. It keeps staff accounts and settings.

## Phones and tablets

The system is built mobile-first and behaves like an app on phones (below 1024px wide):

- **Bottom tab bar** — Home, Orders, a raised **+** for a new order, Customers, and **More**
  (opens the full menu). Desktop keeps the sidebar.
- **App-style top bar** — back button on detail screens, full-screen search, notifications.
- **Lists become cards** — orders, customers, payments, expenses, inventory and staff show as
  tappable cards instead of wide tables (`DataTable`'s `mobileCard` prop).
- **Thumb-reach actions** — the order form has a sticky Save bar with the running total; order
  details has a bottom bar with **Pay** and **Mark as …**. Dialogs open as bottom sheets.
- **Install it like an app** — *Add to Home screen* in Chrome (Android) or Safari (iPhone).
  The service worker (`public/sw.js`) caches the app shell; Firestore keeps a copy of data it
  has already loaded in IndexedDB, so recently viewed pages work offline and changes sync when
  the connection returns. Needs the production build over HTTPS (or `localhost`).

## Stack

React 19 · Vite · React Router 7 · Tailwind CSS 4 · Firebase (Firestore + Auth) · lucide-react ·
Recharts · Sonner · date-fns · jsPDF + jspdf-autotable · SheetJS.

## Architecture

```
src/
  firebase.js    Firebase app, Auth, Firestore (with offline cache)
  data/          constants.js, defaults.js (default settings), seed.js (demo data + reset), statusMeta.js
  services/      data layer — UI imports only from services/index.js
    storage.js     Firestore helpers: live reference data (settings, staff, services, inventory),
                   paged queries, counts/sums, ID counters, daily stats
    stats.js       daily summary documents (stats/{yyyy-mm-dd}) used by dashboard, reports, payments
    mockApi.js     request(): signed-in user + role permission check, friendly errors
    *Service.js    orders, customers, payments, catalog, expenses, inventory, staff, auth,
                   notifications, settings, reports, activity
  hooks/         usePagedQuery (server-side pages), useAsync, useTable (client-side), useDebounce, ...
  context/       AuthContext, SettingsContext, NotificationContext, SmsContext
  components/    ui/, layout/, charts/, orders/, customers/, payments/, receipts/, shared/
  pages/         one file per screen
```

### How data is read

- **Small reference lists** (settings, staff, services, inventory) are loaded once after sign-in
  and kept live.
- **Everything else is paged.** Lists call `list*({ ...filters, pageSize, cursor })` and get back
  `{ rows, cursor, hasMore }`; `count*()` gives the total. `usePagedQuery` turns that into a
  table with Previous/Next. Searches return all matches at once (order ID, phone, or the start of
  a name — Firestore has no full-text search).
- **Running totals are stored on records** so lists need no joins: each order keeps the client's
  name/phone, amount paid, balance and payment status; each client keeps their order count,
  first/last visit, average days between visits, new/regular type and outstanding balance.
- **Daily stats** (`stats/{yyyy-mm-dd}`, Nairobi time) hold orders, kg, garments, amount billed,
  revenue by payment mode and expenses by category. They're updated in the same transaction as
  each order/payment/expense, and the dashboard, payment totals and charts read them instead of
  every record.

### Key business rules

- **Pricing by weight** — order total = kg × the service's rate per kg (default 50 KES/kg),
  plus priority surcharge, extra charges, minus discount, plus tax. Garments (trousers,
  t-shirts, …) are listed and counted on each order for tracking but not priced individually.
- **Clients** — *New* on their first order, *Regular* from their second. The interval between
  drop-offs is tracked per client.
- **Payments** — mode (Paybill, M-Pesa number or Cash), estimated amount, amount actually paid,
  date paid, and for M-Pesa the payer's name and optional M-Pesa code. A payment can't exceed
  the outstanding balance. M-Pesa is not integrated; staff record payments from the message.
- **Order status** — Received → Washing → Drying → Ironing → Ready → Delivered (+ Cancelled).
  Each garment has its own status; the order status is the least-advanced garment.
- **Reporting (cash basis)** — Revenue = payments received in the period. Unpaid balances are
  receivables. Net profit = Revenue − expenses.
- **Permissions** — `utils/permissions.js` for the UI, enforced on the server by the Firestore
  security rules. Nobody can change their own role or deactivate themselves.

## Backend (`../backend`)

`backend/` holds the Firebase project config:

- `firestore.rules` — only signed-in, active staff can read/write; role checks for staff,
  services, settings, expenses and inventory.
- `firestore.indexes.json` — composite indexes for the paged queries.
- `firebase.json` / `.firebaserc` — linked to `management-system-49171`.

Deploy rules and indexes from `backend/`:

```bash
cd ../backend
firebase deploy --only firestore
```

New indexes take a few minutes to build; until then the affected list shows a "database index is
still being built" message.

## Known limitations

- Admin password resets for other users need Cloud Functions (Blaze plan).
- SMS messages are simulated (rendered and logged, not sent).
- Lists in this browser refresh when you change data here; changes made on another device show
  after the page reloads or you navigate.
- File uploads (expense receipts, logos, staff photos) are placeholders.
- Dark mode is not implemented.
