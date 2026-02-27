# D'Resto Management System

A full-stack restaurant management system for JJ D'Resto, built with a Node.js/Express backend and a React frontend.

---

## Project Structure

```
dresto-mgt/
├── backend/    # Node.js + Express REST API
└── frontend/   # React + Vite SPA
```

---

## Backend

### Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express 5
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** JWT + bcryptjs
- **Security:** Helmet, CORS, express-rate-limit
- **Docs:** Swagger UI (`/api/v1/docs`)
- **Dev:** nodemon, ts-node

### Prerequisites

- Node.js >= 18
- PostgreSQL database

### Setup

```bash
cd backend
npm install
```

Create a `.env` file:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/dresto"
JWT_SECRET="your-secret-key"
PORT=5000
FRONTEND_URL="http://localhost:5173"
NODE_ENV=development
```

### Database

```bash
npm run db:generate   # Generate Prisma client
npm run db:migrate    # Run migrations
npm run db:push       # Push schema (dev only)
npm run db:studio     # Open Prisma Studio
```

### Running

```bash
npm run dev     # Development (nodemon)
npm run build   # Compile TypeScript
npm start       # Production (compiled JS)
```

### API Endpoints

Base path: `/api/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/auth/register` | Register user |
| POST | `/auth/login` | Login |
| GET | `/menu` | List menu items |
| POST | `/menu` | Create menu item |
| PUT | `/menu/:id` | Update menu item |
| DELETE | `/menu/:id` | Delete menu item |
| GET | `/categories` | List categories |
| POST | `/categories` | Create category |
| GET | `/orders` | List orders |
| POST | `/orders` | Create order |
| PUT | `/orders/:id` | Update order |

Interactive docs available at: `http://localhost:5000/api/v1/docs`

### Data Models

- **User** — roles: `ADMIN`, `MANAGER`, `STAFF`
- **Category** — groups menu items
- **MenuItem** — belongs to a category, has price and availability
- **Order** — types: `DINE_IN`, `TAKEAWAY`, `DELIVERY`; statuses: `PENDING` → `CONFIRMED` → `PREPARING` → `READY` → `DELIVERED` / `CANCELLED`
- **OrderItem** — line items linking orders to menu items

---

## Frontend

### Tech Stack

- **Framework:** React 19 + TypeScript
- **Build tool:** Vite 8
- **Styling:** Tailwind CSS 4
- **Routing:** React Router DOM 7
- **HTTP client:** Axios
- **Charts:** Recharts
- **Icons:** Lucide React

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

### Features

- **Authentication** — login page with JWT-based session management
- **Dashboard** — overview with stats and charts
- **Menu management** — create, edit, and manage menu items by category
- **Order management** — view and update order statuses
- **Responsive layout** — collapsible sidebar navigation

---

## License

MIT
