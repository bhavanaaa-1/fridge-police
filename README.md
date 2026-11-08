# FridgePolice 

> **Intelligent Communal Refrigerator Governance & Food Inventory Platform**<br/>
> Built for shared households, co-living spaces, and community food pantries.

[![Live Frontend](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://fridge-police.vercel.app)
[![Live Backend API](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render)](https://fridge-police.onrender.com)
[![API Health](https://img.shields.io/badge/Health%20Check-Passing-success)](https://fridge-police.onrender.com/api/health)
[![Database](https://img.shields.io/badge/PostgreSQL-Neon%20Serverless-00E599?logo=postgresql)](https://neon.tech)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Quick Links

- **Live Application:** [https://fridge-police.vercel.app](https://fridge-police.vercel.app)
- **Backend API:** [https://fridge-police.onrender.com](https://fridge-police.onrender.com)
- **API Health Endpoint:** [https://fridge-police.onrender.com/api/health](https://fridge-police.onrender.com/api/health)
- **GitHub Repository:** [https://github.com/bhavanaaa-1/fridge-police](https://github.com/bhavanaaa-1/fridge-police)

### Core Documentation
- [Product Requirements Document (PRD)](PRD.md) - Product vision, user roles, functional & non-functional requirements.
- [High-Level Design (HLD)](HLD.md) - System architecture, technology choices, data flows, and trade-offs.
- [Low-Level Design (LLD)](LLD.md) - Implementation details, state machines, concurrency locks, and schemas.
- [Engineering Scenarios & Challenge #8 (Changes.md)](Changes.md) - Solutions to Concurrency Collisions, Spoilage Ghosts, Identical Items, and Phantom Eaters.
- [Comprehensive Technical Documentation](docs/TECHNICAL_DOCUMENTATION.md) - Full API reference, database schema, deployment guide, and codebase structure.

---

## Problem Statement

Communal refrigerators in dormitories, shared apartments, and community initiatives suffer from the classic **tragedy of the commons**:
- **Food Theft & Ambiguity:** Uncertainty around what is shared vs. personal leads to accidental consumption or hoarding.
- **Double-Allocation Conflicts:** Two roommates claiming the last portion of food at the same time leaves one disappointed.
- **Ghost Reservations:** Food reserved digitally but never eaten spoils in the fridge while others are blocked from consuming it.
- **Physical vs. Digital Drift:** Snacks eaten offline or spilled food cause digital tracking to diverge from physical reality.
- **Lack of Privacy in Community Pantries:** Community fridges need to announce their presence without exposing member identities.

FridgePolice provides a transactional, multi-tenant digital mediator with financial-grade concurrency safety and non-repudiable audit logging.

---

## Key Features

- **Multi-Tenant Fridge Workspaces:** Create separate fridge workspaces for home, work, or community pantries.
- **Role-Based Access Control (RBAC):** Distinct permissions for `OWNER`, `ADMIN`, and `MEMBER` roles per fridge.
- **High-Precision Inventory Tracking:** Decimal quantities (`Decimal(10, 2)`), units, categories, notes, and expiration dates.
- **ACID Concurrency Protection:** Zero double-booking via PostgreSQL `SELECT ... FOR UPDATE` row locks and `Serializable` transaction isolation.
- **Automated 24-Hour Reservation Lease:** Approved portions automatically expire after 24 hours if unconsumed, instantly liberating stock.
- **Physical Inventory Reconciliation:** Direct quantity adjustments and item removals paired with an immutable `ActivityLog` timeline.
- **Public Community Discovery:** Search nearby public fridges, view public item previews, and submit join applications with privacy firewalls.
- **Modern Stitch UI:** Polished, responsive interface with dark mode support, quick stats dashboard, and responsive mobile navigation.

---

## Technology Stack

- **Frontend:** React 19, Vite 8, Modern CSS Variables, Oxlint
- **Backend:** Node.js 20+, Express 5, Zod 4, bcryptjs, jsonwebtoken
- **ORM:** Prisma 7 (`@prisma/adapter-pg`)
- **Database:** Neon Serverless PostgreSQL 16 (with PgBouncer connection pooling)
- **Hosting:** Vercel (Frontend SPA) + Render (Containerized Backend API)
- **Testing:** Node.js Native Test Runner (`node --test`) - 66 Integration Tests

---

## System Architecture

```mermaid
graph TD
    subgraph Client ["Client Tier (Browser)"]
        Browser["User Desktop / Mobile"]
    end

    subgraph Hosting ["Vercel & Render Cloud Infrastructure"]
        VercelEdge["Vercel Global CDN<br/>(React 19 + Vite Static Assets)"]
        RenderService["Render Web Service<br/>(Express 5 REST API)"]
    end

    subgraph Database ["Neon Cloud Persistence Tier"]
        PgBouncer["Neon PgBouncer Pooler<br/>(DATABASE_URL)"]
        DirectDB["PostgreSQL 16 Engine<br/>(DATABASE_URL_UNPOOLED)"]
    end

    Browser -->|"1. Load Static UI"| VercelEdge
    Browser -->|"2. REST Calls (/api/*)"| RenderService
    RenderService -->|"Runtime Pooled Queries"| PgBouncer
    PgBouncer --> DirectDB
    RenderService -.->|"Prisma Migrations (Direct Session Locks)"| DirectDB
```

---

## Getting Started (Local Development)

### Prerequisites

Ensure you have the following installed on your local workstation:
- **Node.js:** `v20.0.0` or higher ([Download Node.js](https://nodejs.org/))
- **npm:** `v10.0.0` or higher
- **PostgreSQL Database:** A free [Neon](https://neon.tech) PostgreSQL instance or local PostgreSQL 16 server.

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/bhavanaaa-1/fridge-police.git
cd fridge-police
```

---

### Step 2: Install Dependencies

Install root (frontend) dependencies:
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
# Neon PostgreSQL pooled connection string for runtime
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DB?sslmode=require"

# Neon PostgreSQL direct connection string for Prisma CLI / migrations
DATABASE_URL_UNPOOLED="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DB?sslmode=require"

# JWT Authentication
JWT_SECRET="your-super-secret-jwt-key-must-be-at-least-32-chars-long"
JWT_EXPIRES_IN="1d"
```

Also create `server/.env`:
```env
PORT=5000
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DB?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DB?sslmode=require"
JWT_SECRET="your-super-secret-jwt-key-must-be-at-least-32-chars-long"
JWT_EXPIRES_IN="1d"
```

> **Security Note:** The server validates `JWT_SECRET` at boot and refuses to start if it is under 32 characters or set to a placeholder.

---

### Step 4: Run Database Migrations

Generate the Prisma Client and run the database migrations:
```bash
cd server
npm run db:generate
npm run db:migrate
cd ..
```

---

### Step 5: Start the Development Servers

Open two terminal tabs:

**Terminal 1 — Backend API Server:**
```bash
cd server
npm run dev
# Server running at http://localhost:5000
```

**Terminal 2 — Frontend Development Server:**
```bash
npm run dev
# Frontend running at http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173) in your browser. The Vite development proxy forwards all `/api/*` calls directly to the Express backend on port 5000.

---

## Environment Variables Reference

| Variable Name | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | No | `5000` | The port the Express HTTP server binds to. |
| `DATABASE_URL` | **Yes** | - | Neon connection-pooled PostgreSQL URL for runtime queries. |
| `DATABASE_URL_UNPOOLED` | **Yes** | - | Direct unpooled PostgreSQL URL required for Prisma migrations. |
| `JWT_SECRET` | **Yes** | - | Secret key for signing JWT tokens (minimum 32 characters). |
| `JWT_EXPIRES_IN` | No | `1d` | Token validity duration. |
| `TEST_DATABASE_URL` | For tests | - | Pooled connection string to dedicated test database. |
| `TEST_DATABASE_URL_UNPOOLED` | For tests | - | Unpooled connection string to dedicated test database. |

---

## Running the Automated Test Suite

The backend includes a comprehensive integration test suite verifying authentication, RBAC, inventory CRUD, concurrent approvals, and 24-hour expiration sweeps:

```bash
cd server
npm test
```

To run a specific test suite:
```bash
node --test tests/request.test.mjs
node --test tests/inventory.test.mjs
node --test tests/auth.test.mjs
```

---

## API Overview

| Domain | Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/register` | Public | Register new user account |
| **Auth** | `POST` | `/api/auth/login` | Public | Authenticate user & receive JWT |
| **Auth** | `GET` | `/api/auth/me` | Authenticated | Get current user profile & fridges |
| **Fridges** | `POST` | `/api/fridges` | Authenticated | Create a new fridge workspace |
| **Fridges** | `GET` | `/api/fridges` | Authenticated | List all user's fridges |
| **Fridges** | `PATCH` | `/api/fridges/:id/settings` | Owner / Admin | Update privacy & preview settings |
| **Fridges** | `GET` | `/api/fridges/:id/activity` | Member | View immutable activity log |
| **Inventory** | `GET` | `/api/fridges/:id/items` | Member | Search and filter food items |
| **Inventory** | `POST` | `/api/fridges/:id/items` | Owner / Admin | Add new food item |
| **Inventory** | `PATCH` | `/api/fridges/:id/items/:itemId` | Owner / Admin | Reconcile physical inventory |
| **Inventory** | `DELETE` | `/api/fridges/:id/items/:itemId` | Owner / Admin | Discard/delete food item |
| **Requests** | `POST` | `/api/fridges/:id/requests` | Member | Request a portion of food |
| **Requests** | `PATCH` | `/api/fridges/:id/requests/:reqId/approve` | Owner / Admin | Approve portion with row lock |
| **Requests** | `PATCH` | `/api/fridges/:id/requests/:reqId/complete`| Owner / Admin | Record physical consumption |
| **Discovery** | `GET` | `/api/discover/fridges` | Public | Explore public community fridges |
| **Health** | `GET` | `/api/health` | Public | Liveness health probe |

*For complete endpoint schemas, parameters, and status codes, consult the [Comprehensive Technical Documentation](docs/TECHNICAL_DOCUMENTATION.md).*

---

## Production Deployment Architecture

```
Frontend (Vercel):
  - Repository Branch: main
  - Build Command: npm run build
  - Output Directory: dist

Backend (Render):
  - Root Directory: server
  - Build Command: npm install && npm run db:generate
  - Start Command: npm start
  - Health Check: /api/health
  - Host Binding: 0.0.0.0
```

---

## Repository Structure

```
fridge-police/
|-- HLD.md                           # High-Level Design document
|-- LLD.md                           # Low-Level Design document
|-- PRD.md                           # Product Requirements Document
|-- README.md                        # Master project README
|-- package.json                     # Frontend dependencies
|-- vite.config.js                   # Vite config with API dev proxy
|-- docs/
|   `-- TECHNICAL_DOCUMENTATION.md   # Architectural and technical reference
|-- src/                             # React 19 Frontend
|   |-- App.jsx                      # Main view orchestration & modal router
|   |-- components/                  # View components (Inventory, Requests, Discovery, Activity)
|   `-- lib/api.js                   # Unified fetch API client
`-- server/                          # Express 5 Backend
    |-- prisma/schema.prisma         # Relational database models & indexes
    |-- src/
    |   |-- app.js                   # Express application pipeline
    |   |-- server.js                # Server entry point & JWT guard
    |   |-- controllers/             # HTTP controller handlers
    |   |-- middleware/              # Authentication & RBAC guards
    |   |-- routes/                  # Express route definitions
    |   |-- services/                # Business logic, concurrency locks, auto-expiry
    |   `-- validators/              # Zod validation schemas
    `-- tests/                       # Automated integration tests
```

---

## Author & Project Information

- **Developer:** [bhavanaaa-1](https://github.com/bhavanaaa-1)
- **Repository:** [https://github.com/bhavanaaa-1/fridge-police](https://github.com/bhavanaaa-1/fridge-police)
