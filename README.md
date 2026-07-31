# D'Resto Management System

The backend and web dashboard for **JJ D'Resto** — a digital ordering system for a **single**
resto-bar-hotel, built with a Node.js/Express API and a React dashboard.

Two order channels run through one shared pipeline:

- **Dine-in** — the guest orders from their phone at the table (QR / the mobile app). No signup.
- **Takeaway / delivery** — the customer orders from the same menu and provides a phone number
  (and address for delivery).

Both create the same `Order` and move through the same state machine. This is **not** a
multi-restaurant marketplace — one restaurant per deployment. The full product model is in
[`ordering-specs.md`](ordering-specs.md).

The customer/staff mobile app lives in a sibling repo: [`jj_dresto`](../jj_dresto) (Flutter).

---

## Project Structure

```
dresto-mgt/
├── backend/                        # Node.js + Express REST API (Prisma / PostgreSQL)
│   └── dresto-api-collection.json  # full request collection — source of truth for endpoints
├── frontend/                       # React + Vite admin / kitchen dashboard
└── ordering-specs.md               # product & domain spec
```

---

## Backend

### Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express 5
- **Database:** PostgreSQL (Neon) via Prisma 7 + `@prisma/adapter-pg`
- **Auth:** JWT access/refresh + bcryptjs
- **Security:** Helmet, CORS, express-rate-limit (tighter limits on login/register), express-validator
- **Email:** Resend (password reset)
- **Push:** FCM HTTP v1 for mobile (`src/lib/fcm.ts`, service-account JWT signed with `node:crypto`) and Web Push/VAPID + SSE for browsers (`src/lib/webPush.ts`, `src/lib/sseManager.ts`) — two separate stacks
- **Docs:** Swagger UI (`/api/v1/docs`)
- **Dev:** nodemon, ts-node

### Prerequisites

- Node.js >= 18
- PostgreSQL database

### Setup

```bash
cd backend
npm install     # runs prisma generate via postinstall
```

Create a `.env` file:

```env
DATABASE_URL="postgresql://user:password@host:5432/dresto"
JWT_SECRET="your-secret-key"
PORT=5000
FRONTEND_URL="http://localhost:5173"
NODE_ENV=development

# Optional
RESEND_API_KEY=...              # password-reset email
FCM_SERVICE_ACCOUNT=...         # base64 or raw service-account JSON — mobile push
VAPID_PUBLIC_KEY=...            # browser push
VAPID_PRIVATE_KEY=...
```

> **Deployment gotcha:** on Vercel, `FCM_SERVICE_ACCOUNT` must be set in the project env and
> the function **redeployed**. A local `.env` is not read by the deployed function — without
> it the backend only logs `[fcm] [dev] would push to user=…` and sends nothing.

### Database

```bash
npm run db:generate   # Generate Prisma client
npm run db:migrate    # Run migrations
npm run db:push       # Push schema (dev only)
npm run db:seed       # Seed
npm run db:studio     # Open Prisma Studio
```

### Running

```bash
npm run dev     # Development (nodemon)
npm run build   # Compile TypeScript
npm start       # Production (compiled JS)
```

### API

Base path: `/api/v1`. Interactive docs: `http://localhost:5000/api/v1/docs`.
The complete request collection — the source of truth — is
[`backend/dresto-api-collection.json`](backend/dresto-api-collection.json).

| Group | Endpoints |
|-------|-----------|
| **Health** | `GET /health` |
| **Auth** | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` · `PUT /auth/profile` · `PUT /auth/change-password` · `POST /auth/forgot-password` · `POST /auth/reset-password` |
| **Categories** | `GET /categories` · `GET /categories/:id` · `POST /categories` · `PUT /categories/:id` · `DELETE /categories/:id` (ADMIN) |
| **Menu** | `GET /menu` · `GET /menu/:id` · `POST /menu` · `PUT /menu/:id` · `DELETE /menu/:id` (ADMIN) · `PATCH /menu/bulk-availability` |
| **Orders** | `GET /orders` (role-filtered) · `GET /orders/mine` · `GET /orders/session/:sessionToken` · `GET /orders/track/:token` · `GET /orders/:id` · `POST /orders` (guest-friendly) · `PUT /orders/:id` · `PATCH /orders/:id/status` · `PATCH /orders/:id/cancel` · `DELETE /orders/:id` |
| **Order chat** | `GET /orders/:id/messages` · `POST /orders/:id/messages` |
| **Payments** | `POST /orders/:id/payment` · `PATCH /orders/:id/payment/confirm` (staff) |
| **Stats** | `GET /orders/stats/overview` · `GET /orders/stats/daily-sales` |
| **Tables** | `GET /tables` · `POST /tables` · `PUT /tables/:id` · `PATCH /tables/:id/status` · `DELETE /tables/:id` |
| **Floor plan** | `GET /floor-plan` (public) · `PUT /floor-plan` (ADMIN/MANAGER, full replace in one transaction) |
| **Notifications** | `GET /notifications/vapid-key` · `GET /notifications/stream` (SSE) · browser subscribe/unsubscribe · `POST /notifications/devices` · `DELETE /notifications/devices` (mobile FCM tokens) |
| **Restaurant** | `GET /restaurant` · `PUT /restaurant` |
| **Users** | `GET /users` · `POST /users` · `PUT /users/:id` · `PATCH /users/:id/password` · `DELETE /users/:id` |

Guests authenticate against their own order with an `X-Order-Token` header instead of a
Bearer token.

### Data Models

- **User** — roles: `ADMIN`, `MANAGER`, `STAFF`, `CUSTOMER`
- **DeviceToken** — a device's FCM token, attached to a user (mobile push)
- **PasswordResetToken**
- **Category** — groups menu items
- **MenuItem** — belongs to a category; price, availability, image, ingredients
- **ModifierGroup / Modifier / SelectedModifier** — per-item options
- **Order** — types `DINE_IN` / `TAKEAWAY` / `DELIVERY`; status `PENDING` → `CONFIRMED` →
  `PREPARING` → `READY` → `DELIVERED` / `CANCELLED`. Carries a unique `accessToken` (guest
  tracking), an optional `guestSessionToken` and `userId`, the customer-submitted
  `transactionId`, a `PaymentStatus` (`UNPAID` / `PENDING_VERIFICATION` / `PAID`), delivery
  fields (address, lat/lng, fee, zone, rider), and a `FulfillmentStatus`
  (`NONE` / `AWAITING_PICKUP` / `OUT_FOR_DELIVERY` / `DELIVERED` / `SERVED`) kept separate
  from prep status — the kitchen board reads `status`, the delivery board reads
  `fulfillmentStatus`
- **OrderItem** — line items, with a price snapshot and excluded ingredients
- **OrderMessage** — the per-order chat thread; `SenderType` is `CLIENT` or `STAFF`
- **PaymentEvent** — provider webhook event log, keyed on `providerRef` for idempotency
  (provider wiring is on hold; customers currently submit a MoMo transaction ID onto the
  order for staff to verify)
- **Table** — status `AVAILABLE` / `OCCUPIED` / `RESERVED`, plus its floor and position
- **Floor / Landmark** — the floor-plan layout; positions normalised to 0..1
- **Restaurant** — single-row config: name, logo, theme colour, currency, languages, channel
  toggles (dine-in/takeaway/delivery), service charge, VAT, delivery fee & minimum, enabled
  payment providers, opening hours, ordering base URL

---

## Frontend

### Tech Stack

- **Framework:** React 19 + TypeScript
- **Build tool:** Vite 8 (`@vitejs/plugin-react-oxc`)
- **Styling:** Tailwind CSS 4
- **Routing:** React Router DOM 7
- **HTTP client:** Axios
- **Charts:** Recharts · **Icons:** Lucide React · **QR:** `qrcode` · **Dates:** date-fns

### Setup

```bash
cd frontend
npm install
```

Create a `.env` file:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

### Running

```bash
npm run dev       # Development server (http://localhost:5173)
npm run build     # Production build
npm run preview   # Preview production build
```

### Pages

| Route | What it does | Access |
|-------|--------------|--------|
| `/login`, `/forgot-password`, `/reset-password` | JWT auth + email password reset | public |
| `/dashboard` | Overview stats and charts | all staff |
| `/dashboard/menu` | Menu item CRUD, availability, images | all staff |
| `/dashboard/orders` | Order list, status transitions, payment verification, order chat | all staff |
| `/dashboard/kitchen` | Kitchen/bar board — live queue of orders to prepare | all staff |
| `/dashboard/categories` | Category CRUD | all staff |
| `/dashboard/analytics` | Sales and order analytics | ADMIN/MANAGER |
| `/dashboard/tables` | Table CRUD and status | ADMIN |
| `/dashboard/floor-plan` | Drag-and-drop floor-plan editor — per-floor tabs with add/rename/reorder/delete, add table/landmark, right-click or ✕ to remove | ADMIN/MANAGER |
| `/dashboard/users` | Staff account management | ADMIN |
| `/dashboard/settings` | Restaurant config: branding, currency, channels, taxes, payment providers, hours | all staff |

The floor plan can be authored on the web **or** in the mobile app — both `PUT` the same
full-replace payload to `/floor-plan`.

Other frontend features: light/dark theme, real-time staff notifications (SSE + Web Push),
collapsible role-aware sidebar, responsive layout.

---

## Related

- **Mobile app:** [`jj_dresto`](../jj_dresto) — Flutter customer & staff app (ordering, live
  tracking, order chat, MoMo payment, floor map).
- **Spec:** [`ordering-specs.md`](ordering-specs.md)

---

## License

MIT
