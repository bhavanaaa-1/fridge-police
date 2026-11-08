# FridgePolice — High-Level Design (HLD)

**Project Name:** FridgePolice
**Document Version:** 2.0 (Viva Edition)
**Target Audience:** Students, Viva Examiners, Project Reviewers
**Live Frontend:** [https://fridge-police.vercel.app](https://fridge-police.vercel.app)
**Backend API:** [https://fridge-police.onrender.com](https://fridge-police.onrender.com)

---

## 1. System Architecture Overview

FridgePolice uses a clean, standard three-tier architecture:

1. **Presentation Tier (Frontend):** A Single Page Application (SPA) built with React 19 and Vite 8, hosted on Vercel.
2. **Application Tier (Backend):** A REST API built with Node.js and Express 5, hosted as a containerized web service on Render.
3. **Data Tier (Database):** A PostgreSQL 16 database hosted on Neon, accessed through Prisma ORM 7.

```mermaid
flowchart TD
    subgraph Client ["Client Tier (Browser)"]
        User["User Browser<br/>(Desktop / Mobile)"]
        ReactSPA["React 19 Frontend<br/>(State Management, apiRequest Client)"]
    end

    subgraph Vercel ["Hosting & Edge Reverse Proxy"]
        VercelCDN["Vercel Static Hosting<br/>(HTML, CSS, JS Build Assets)"]
        VercelRewrite["Vercel Rewrite Rule<br/>(/api/:path* -> Render Backend)"]
    end

    subgraph Render ["Application Tier (Render)"]
        ExpressApp["Express 5 REST API Engine<br/>(Listens via app.listen(PORT))"]
        Middlewares["Auth Middleware & Role Check (RBAC)"]
        Controllers["Controllers & Zod Validation"]
        Services["Services (Business Logic & Transactions)"]
        PrismaORM["Prisma 7 ORM Client<br/>(@prisma/adapter-pg)"]
    end

    subgraph NeonDB ["Data Tier (Neon Cloud)"]
        PgBouncer["Neon Connection Pooler (PgBouncer)<br/>(Runtime Queries: DATABASE_URL)"]
        DirectPostgres["Neon Direct Connection<br/>(Migrations: DATABASE_URL_UNPOOLED)"]
        PostgresEngine["PostgreSQL 16 Database Engine"]
    end

    User -->|"1. Visits App (HTTPS)"| VercelCDN
    VercelCDN -->|"Loads SPA"| ReactSPA
    ReactSPA -->|"2. API calls to /api/*"| VercelRewrite
    VercelRewrite -->|"Proxies request to Render"| ExpressApp
    ExpressApp --> Middlewares
    Middlewares --> Controllers
    Controllers --> Services
    Services --> PrismaORM
    PrismaORM -->|"Runtime queries"| PgBouncer
    PgBouncer -->|"Pooled connection"| PostgresEngine
    PrismaCLI["Prisma CLI (Migrations)<br/>(npx prisma migrate deploy)"] -->|"Direct unpooled connection"| DirectPostgres
    DirectPostgres -->|"Applies schema migrations"| PostgresEngine
```

---

## 2. Responsibilities of Each Component

### 2.1 Frontend (React 19 + Vite 8)
- Renders the user interface and handles all user interactions.
- Manages client-side state using React's `useState` hook (current view, active fridge, open modals, dark mode).
- Uses `useEffect` to fetch data from the backend when components mount or when the active fridge changes.
- Stores the active authentication token in browser `sessionStorage` (`fridgepolice_token`).
- Sends all API requests through a central helper (`src/lib/api.js`) that automatically attaches the `Authorization: Bearer <token>` header.
- Displays friendly loading states, error banners, and toast notifications.

### 2.2 Backend (Node.js + Express 5)
- Defines RESTful API routes for authentication, fridges, inventory, requests, discovery, and user stats.
- Validates all incoming request bodies and query parameters with Zod schemas before running business logic.
- Verifies JWT tokens and attaches the authenticated user's ID to `req.user`.
- Checks per-fridge role authorization (`OWNER`, `ADMIN`, `MEMBER`) via the `authorizeFridge` middleware.
- Runs business logic inside services, managing database transactions (`prisma.$transaction`) and concurrency locks (`SELECT ... FOR UPDATE`).
- Centralizes error handling so clients receive clean, predictable JSON error responses.
- Listens using `app.listen(PORT)` (port provided by Render via `process.env.PORT`, or port 5000 in local development).

### 2.3 Database (Neon PostgreSQL 16 + Prisma ORM)
- Stores all relational data across tables: `User`, `Fridge`, `FridgeMember`, `FoodItem`, `FoodRequest`, `MembershipRequest`, and `ActivityLog`.
- Guarantees data integrity using foreign keys and cascade delete rules.
- Prisma ORM generates type-safe query methods for application services.
- Database schema migrations are executed through Prisma CLI commands (`prisma migrate dev` / `prisma migrate deploy`), not by the running Express application.
- Uses Neon's connection pooling (PgBouncer) via `DATABASE_URL` for standard web requests, preventing connection exhaustion under concurrent traffic.
- Uses a direct unpooled connection via `DATABASE_URL_UNPOOLED` for Prisma CLI migrations so PostgreSQL migration advisory locks function properly. Note that PgBouncer and the direct connection are distinct access routes to the PostgreSQL 16 database engine.

---

## 3. How the Frontend and Backend Communicate

A key engineering decision in FridgePolice is **how API requests travel from the browser to the backend**:

- In development: The frontend runs at `http://localhost:5173`. `vite.config.js` proxies `/api` to `http://localhost:5000`.
- In production: The frontend is at `https://fridge-police.vercel.app`. It makes requests to relative paths like `/api/auth/login` and `/api/fridges`.
- `vercel.json` rewrites all `/api/:path*` requests to `https://fridge-police.onrender.com/api/:path*`.
- **Why this is important:** Because the browser communicates directly with `https://fridge-police.vercel.app`, requests remain strictly **same-origin**. There is no need for complex Cross-Origin Resource Sharing (CORS) configurations, and headers and JSON payloads are forwarded seamlessly.

---

## 4. Authentication Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Frontend as React Frontend (Vercel)
    participant Backend as Express API (Render)
    participant DB as Neon PostgreSQL

    Note over User, DB: 1. Registration
    User->>Frontend: Enter Name, Email, Password
    Frontend->>Backend: POST /api/auth/register
    Backend->>Backend: Zod validates email format & password length (>=8)
    Backend->>DB: Check if email already exists
    alt Email exists
        DB-->>Backend: Existing user found
        Backend-->>Frontend: HTTP 409 (Email is already registered)
    else Email is new
        Backend->>Backend: bcrypt.hash(password, 10)
        Backend->>DB: Create User record
        DB-->>Backend: Saved User (without password)
        Backend-->>Frontend: HTTP 201 { success: true, user }
    end

    Note over User, DB: 2. Login
    User->>Frontend: Enter Email & Password
    Frontend->>Backend: POST /api/auth/login
    Backend->>DB: Find User by email
    Backend->>Backend: bcrypt.compare(password, user.passwordHash)
    alt Invalid credentials
        Backend-->>Frontend: HTTP 401 (Invalid email or password)
    else Valid credentials
        Backend->>Backend: signToken(user.id) -> Creates JWT (HS256, 1d expiry)
        Backend-->>Frontend: HTTP 200 { success: true, token, user }
        Frontend->>Frontend: Save token in sessionStorage
    end

    Note over User, DB: 3. Authenticated Request
    User->>Frontend: View Fridge Inventory
    Frontend->>Backend: GET /api/fridges/:id/items<br/>[Header: Authorization: Bearer <token>]
    Backend->>Backend: authenticate() verifies token signature & expiration
    Backend->>DB: authorizeFridge() checks user's role in FridgeMember
    DB-->>Backend: Role confirmed (MEMBER)
    Backend->>DB: Fetch food items for fridge
    DB-->>Backend: Return item list
    Backend-->>Frontend: HTTP 200 { success: true, items }
    Frontend-->>User: Render inventory cards in UI
```

---

## 5. Food Portion Request Workflow & Concurrency Protection

This workflow demonstrates how FridgePolice prevents two roommates from taking the same item at the same time:

```mermaid
sequenceDiagram
    autonumber
    actor Member as Roommate (Member)
    actor Admin as Fridge Owner / Admin
    participant Backend as Express Backend
    participant DB as Neon PostgreSQL

    Member->>Backend: POST /api/fridges/:id/requests { foodItemId, requestedQuantity: 2 }
    Backend->>DB: Create FoodRequest with status: "PENDING"
    DB-->>Backend: Request created
    Backend-->>Member: HTTP 201 (Request Submitted)

    Admin->>Backend: PATCH /api/fridges/:id/requests/:reqId/approve
    Note over Backend, DB: Serializable Transaction Begins
    Backend->>DB: SELECT id FROM "FoodItem" WHERE id = :id FOR UPDATE
    Note over DB: Target FoodItem row is locked against conflicting updates, deletes, and locks (ordinary SELECT reads still permitted)
    Backend->>DB: Query active approved unexpired reservations for this item
    Backend->>Backend: Calculate Available = Locked Quantity - Total Reserved
    alt Requested Quantity > Available
        Backend->>DB: Rollback transaction
        Backend-->>Admin: HTTP 409 (Insufficient stock to approve this request)
    else Sufficient Stock
        Backend->>DB: Update FoodRequest (status = APPROVED, expiresAt = NOW + 24 hours)
        Backend->>DB: Write ActivityLog (FOOD_REQUEST_APPROVED)
        Backend->>DB: Commit transaction
        Backend-->>Admin: HTTP 200 (Request Approved)
    end

    Note over Member, Admin: Physical Consumption
    Member->>Member: Physically takes 2 units from the fridge
    Admin->>Backend: PATCH /api/fridges/:id/requests/:reqId/complete
    Backend->>DB: Inside Transaction: Decrement FoodItem.quantity by 2
    Backend->>DB: Update FoodRequest status = "COMPLETED"
    Backend->>DB: Write ActivityLog (FOOD_REQUEST_COMPLETED)
    Backend-->>Admin: HTTP 200 (Request Completed)
```

---

## 6. Stale Reservation Expiry Workflow (Lazy Evaluation)

Instead of running an expensive background timer or cron process, FridgePolice uses **deterministic lazy expiration**:

```mermaid
flowchart TD
    UserAction["User requests item list / details / approval / completion"] --> TriggerLazy["Backend calls expireOverdueReservations(fridgeId)"]
    TriggerLazy --> QueryDB["Find all FoodRequests where:<br/>status = 'APPROVED' AND expiresAt <= NOW()"]
    QueryDB --> CheckAny{"Any overdue requests?"}
    CheckAny -- "No" --> Proceed["Proceed with main API operation"]
    CheckAny -- "Yes" --> Loop["For each overdue request:"]
    Loop --> UpdateStatus["Update status to 'EXPIRED'"]
    UpdateStatus --> WriteLog["Log FOOD_REQUEST_EXPIRED in ActivityLog"]
    WriteLog --> ReleaseStock["Reserved quantity automatically returns to Available Stock"]
    ReleaseStock --> Proceed
```

---

## 7. Public Discovery & Membership Join Workflow

1. A fridge owner enables `isDiscoverable = true` and `acceptJoinRequests = true` in fridge settings.
2. A visitor visits the Discover tab. The backend runs `GET /api/discover/fridges`, returning a safe public projection (name, description, member count if enabled). Private emails and internal member lists are never included.
3. The logged-in user clicks "Request to Join" (`POST /api/fridges/:id/join-requests`).
4. The fridge Owner or Admin sees the incoming application in their Requests tab.
5. Upon approval (`PATCH /api/fridges/:id/join-requests/:reqId/approve`), a database transaction adds the user as a `MEMBER` in the `FridgeMember` table and updates the request status to `APPROVED`.

---

## 8. Deployment Architecture

| Tier | Host | Details |
| :--- | :--- | :--- |
| **Frontend** | **Vercel** | - Built from Git repository root using `npm run build` (`vite build`).<br/>- Outputs static assets to `dist/`.<br/>- `vercel.json` proxies `/api/*` requests to the Render backend URL. |
| **Backend** | **Render** | - Containerized Node.js Web Service.<br/>- Root directory: `server`.<br/>- Build command: `npm install && npm run db:generate`.<br/>- Start command: `npm start`.<br/>- Server listens via `app.listen(PORT)` using `process.env.PORT` assigned by Render.<br/>- Health check path: `/api/health`. |
| **Database** | **Neon** | - Serverless PostgreSQL 16 in cloud.<br/>- `DATABASE_URL` connects through PgBouncer for runtime connection pooling.<br/>- `DATABASE_URL_UNPOOLED` connects directly for running schema migrations via Prisma CLI.<br/>- Note: Express does not run migrations. |
