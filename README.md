# FridgePolice 🧊👮

A shared-fridge food inventory and request management web application built for roommates, hostel students, and shared households.

FridgePolice helps people living together track what food is in the fridge, request portions fairly, prevent two people from taking the same item, and keep digital records matching physical fridge shelves.

---

## Live Links

- **Frontend App:** [https://fridge-police.vercel.app](https://fridge-police.vercel.app)
- **Backend API:** [https://fridge-police.onrender.com](https://fridge-police.onrender.com)
- **API Health Check:** [https://fridge-police.onrender.com/api/health](https://fridge-police.onrender.com/api/health)
- **GitHub Repository:** [https://github.com/bhavanaaa-1/fridge-police](https://github.com/bhavanaaa-1/fridge-police)

---

## Documentation Links

- [Product Requirements Document (PRD)](PRD.md) - Project objectives, user roles, functional requirements, and workflows.
- [High-Level Design (HLD)](HLD.md) - System architecture, components, data flows, and deployment.
- [Low-Level Design (LLD)](LLD.md) - Database schema, API routes, concurrency locks, and state lifecycles.
- [Technical Documentation (Viva Guide)](docs/TECHNICAL_DOCUMENTATION.md) - Concept explanations, code structure, test approach, and viva questions.

---

## The Problem It Solves

Living in a shared apartment or college hostel comes with common fridge problems:
1. **Unclear Food Ownership:** Roommates do not know whether an item is shared or private.
2. **Double Claiming:** Two roommates try to claim the last portion of food at the same time.
3. **Forgotten Reservations:** Someone reserves food, never eats it, and it goes bad while others are prevented from eating it.
4. **Physical Shelf Discrepancies:** Food gets eaten offline, spills, or spoils, causing the app inventory to differ from real shelves.
5. **Community Fridge Coordination:** Shared kitchens need a way to show available food without revealing private member contact details.

FridgePolice solves these issues with structured user roles, fair portion requests, database transactions that prevent double-booking, automatic 24-hour reservation expiry, and an activity log for physical corrections.

---

## Key Features

- **User Accounts & Authentication:** Secure sign-up and login with password hashing (`bcryptjs`) and JSON Web Tokens (`jsonwebtoken`).
- **Multi-Fridge Workspaces:** Users can create or belong to multiple fridges (e.g. "Flat 3B Fridge", "Office Kitchen").
- **Role-Based Permissions:** Every fridge has roles:
  - `OWNER`: Full administrative control, can add members by email and assign roles.
  - `ADMIN`: Can add/edit/delete food, approve/reject requests, and complete consumptions.
  - `MEMBER`: Can browse inventory, submit portion requests, and view the activity log.
- **Inventory Management:** Track food items with names, categories, decimal quantities, units, expiration dates, and notes.
- **Fair Portion Requests:** Members can request specific amounts of available items with an optional note.
- **Concurrency Protection:** Database row locking (`SELECT ... FOR UPDATE`) inside serializable transactions blocks conflicting updates, deletes, and locks on the target item, guaranteeing two concurrent approvals cannot over-allocate stock while non-locking `SELECT` reads continue unimpeded.
- **Automatic 24-Hour Expiry:** Approved reservations automatically expire after 24 hours if unconsumed via on-demand lazy checks during request operations, releasing reserved stock without any background cron job.
- **Physical Inventory Reconciliation:** Admins and Owners can adjust item quantities or delete spoiled items, automatically logging who made the change.
- **Activity Log:** Chronological audit trail showing all item additions, edits, requests, approvals, and completions.
- **Public Fridge Discovery:** Fridges can be marked discoverable so others can view public previews and submit join requests.
- **Responsive UI with Dark Mode:** Clean React interface with quick stats, search, filtering, and theme toggling.

---

## Tech Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React 19, Vite 8, CSS Variables, Oxlint |
| **Backend** | Node.js 20+, Express 5, Zod |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` |
| **Database & ORM** | PostgreSQL 16 on Neon, Prisma ORM 7 (`@prisma/adapter-pg`) |
| **Testing** | Node.js native test runner (`node --test`) with 81 test declarations across 6 test suites |
| **Hosting** | Vercel (Frontend), Render (Backend), Neon (Cloud PostgreSQL) |

---

## System Architecture

```mermaid
flowchart TD
    subgraph Browser ["User Browser"]
        ReactApp["React 19 Frontend<br/>(State-based Views & apiRequest Client)"]
    end

    subgraph Vercel ["Vercel Edge Network"]
        StaticAssets["Static Frontend Build<br/>(HTML, CSS, JS)"]
        VercelRewrite["Vercel API Rewrite<br/>(/api/:path* -> Render)"]
    end

    subgraph Render ["Render Web Service"]
        ExpressAPI["Express 5 REST API<br/>(Auth, RBAC, Validation, Controllers)"]
    end

    subgraph Neon ["Neon Cloud Database"]
        PgBouncer["Neon Connection Pooler (PgBouncer)<br/>(Runtime Queries: DATABASE_URL)"]
        DirectPostgres["Neon Direct Connection<br/>(Migrations: DATABASE_URL_UNPOOLED)"]
        PostgresDB["PostgreSQL 16 Database Engine"]
    end

    ReactApp -->|"1. Loads UI"| StaticAssets
    ReactApp -->|"2. API calls (/api/*)"| VercelRewrite
    VercelRewrite -->|"Proxies to Render"| ExpressAPI
    ExpressAPI -->|"Prisma Client queries"| PgBouncer
    PgBouncer -->|"Pooled connection"| PostgresDB
    PrismaCLI["Prisma CLI (Migrations)<br/>(prisma migrate deploy)"] -->|"Direct connection"| DirectPostgres
    DirectPostgres -->|"Applies schema migrations"| PostgresDB
```

---

## Getting Started Locally

### Prerequisites
- **Node.js:** version 20.0.0 or higher
- **npm:** version 10.0.0 or higher
- **PostgreSQL Database:** A free [Neon](https://neon.tech) cloud database account or local PostgreSQL.

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/bhavanaaa-1/fridge-police.git
cd fridge-police
```

---

### Step 2: Install Dependencies

Install root frontend dependencies:
```bash
npm install
```

Install backend dependencies:
```bash
cd server
npm install
cd ..
```

---

### Step 3: Configure Environment Variables

Create `.env.local` in the project root:
```env
# Neon pooled connection string for runtime queries
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DB?sslmode=require"

# Neon direct connection string for Prisma migrations
DATABASE_URL_UNPOOLED="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DB?sslmode=require"

# JWT configuration (must be at least 32 characters)
JWT_SECRET="your-secure-jwt-secret-at-least-32-chars-long"
JWT_EXPIRES_IN="1d"
```

Also create `server/.env`:
```env
PORT=5000
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DB?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DB?sslmode=require"
JWT_SECRET="your-secure-jwt-secret-at-least-32-chars-long"
JWT_EXPIRES_IN="1d"
```

> **Note:** The server checks `JWT_SECRET` at startup and will not start if it is missing or under 32 characters long.

---

### Step 4: Run Database Migrations

Generate the Prisma client and apply migrations using the Prisma CLI:
```bash
cd server
npm run db:generate
npm run db:migrate
cd ..
```

> **Note:** Database migrations are executed exclusively via Prisma CLI commands (`prisma migrate`), not by the running Express application.

---

### Step 5: Start the Application

Start the backend API server (Terminal 1):
```bash
cd server
npm run dev
# Backend runs at http://localhost:5000
```

Start the frontend development server (Terminal 2):
```bash
npm run dev
# Frontend runs at http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173) in your browser. Vite's development proxy routes `/api/*` requests to the Express server on port 5000.

---

## Running Backend Tests

The backend test suite consists of 81 test declarations across 6 test files covering authentication, email validation, inventory operations, food request concurrency, and security checks:

- `auth.test.mjs` (14 tests)
- `email-validation.test.mjs` (20 tests)
- `inventory.test.mjs` (15 tests)
- `request.test.mjs` (18 tests)
- `discovery-and-membership.test.mjs` (5 tests)
- `security.test.mjs` (9 tests)

Total: **81 test declarations**.

> **Note on Test Execution:** When running tests without a configured test database (`TEST_DATABASE_URL`), 19 tests run standalone without requiring database connectivity (14 in `auth.test.mjs` and 5 in `email-validation.test.mjs`). The full suite of 81 tests executes when `TEST_DATABASE_URL` is set to an active PostgreSQL database.

Run tests:
```bash
cd server
npm test
```

Run an individual test suite:
```bash
node --test tests/request.test.mjs
node --test tests/inventory.test.mjs
node --test tests/auth.test.mjs
```

---

## Deployment Summary

- **Frontend (Vercel):** Hosted as a static build from the repository root. `vercel.json` rewrites all `/api/*` traffic to `https://fridge-police.onrender.com/api/:path*`, so browser requests stay same-origin.
- **Backend (Render):** Express web service running on Node.js with root directory set to `server`. Start command is `npm start` and health check path is `/api/health`. Express listens via `app.listen(PORT)` on `process.env.PORT`.
- **Database (Neon):** Managed serverless PostgreSQL 16. Uses pooled connections (PgBouncer) for web requests and direct connections for Prisma CLI migrations. Express does not run migrations.

---

## Project Structure

```
fridge-police/
|-- README.md                    # Main project overview and setup guide
|-- PRD.md                       # Product requirements and user workflows
|-- HLD.md                       # High-level architecture and component design
|-- LLD.md                       # Low-level design, database schema, and APIs
|-- vercel.json                  # Vercel reverse proxy rewrite to Render backend
|-- package.json                 # Frontend dependencies and build scripts
|-- vite.config.js               # Vite config with local dev proxy
|-- docs/
|   `-- TECHNICAL_DOCUMENTATION.md # In-depth technical explanations and viva guide
|-- src/                         # React 19 Frontend
|   |-- App.jsx                  # Main view coordinator and modal manager
|   |-- components/              # UI components (Inventory, Requests, Discovery, Activity)
|   `-- lib/api.js               # Reusable API fetch helper
`-- server/                      # Express 5 Backend
    |-- prisma/schema.prisma     # Relational database schema
    |-- src/
    |   |-- app.js               # Express application configuration
    |   |-- server.js            # Server entry point and port listener
    |   |-- controllers/         # HTTP request handlers
    |   |-- middleware/          # JWT and role authorization middleware
    |   |-- routes/              # API route definitions
    |   |-- services/            # Business logic and database operations
    |   `-- validators/          # Zod input validation schemas
    `-- tests/                   # 81 automated test declarations across 6 test suites
```
