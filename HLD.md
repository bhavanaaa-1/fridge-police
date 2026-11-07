# FridgePolice â€” High-Level Design (HLD)

**Project Name:** FridgePolice
**Document Version:** 1.0.0
**Target Audience:** System Architects, Technical Evaluators, Full-Stack Engineers
**Repository:** [https://github.com/bhavanaaa-1/fridge-police](https://github.com/bhavanaaa-1/fridge-police)
**Live Application:** [https://fridge-police.vercel.app](https://fridge-police.vercel.app)
**Backend API:** [https://fridge-police.onrender.com](https://fridge-police.onrender.com)

---

## 1. System Architecture Overview

FridgePolice employs a decoupled, cloud-native three-tier architecture:
1. **Client Tier (Presentation):** A modern Single Page Application (SPA) built with React 19 and Vite 8, deployed globally via Vercel's Edge CDN.
2. **Application Tier (Business Logic):** A stateless RESTful API powered by Node.js and Express 5, deployed on Render's containerized infrastructure.
3. **Data Tier (Persistence):** A managed PostgreSQL instance provided by Neon Serverless Postgres, accessed via Prisma 7 ORM using the `@prisma/adapter-pg` driver adapter.

```mermaid
graph TD
    subgraph Client_Layer ["Client Tier (Browser & CDN)"]
        User["End User (Desktop / Mobile Browser)"]
        VercelCDN["Vercel Edge Network<br/>(Hosts React 19 + Vite Static Assets)"]
    end

    subgraph API_Layer ["Application Tier (Render Container)"]
        ExpressApp["Express 5 REST API Engine<br/>(Node.js Runtime on Render)"]
        AuthMiddleware["JWT Authentication & RBAC Middleware"]
        Controllers["Controllers (HTTP Handling & Validation)"]
        Services["Business Services (Domain Logic & Concurrency)"]
    end

    subgraph Data_Layer ["Data Tier (Neon Serverless Cloud)"]
        PgBouncer["Neon PgBouncer Connection Pooler<br/>(DATABASE_URL)"]
        DirectPostgres["Neon Direct PostgreSQL Instance<br/>(DATABASE_URL_UNPOOLED)"]
        PrismaClient["Prisma 7 ORM Client<br/>(@prisma/adapter-pg)"]
    end

    User -->|"1. HTTPS: Loads SPA Assets"| VercelCDN
    User -->|"2. API Calls (/api/*)"| ExpressApp
    ExpressApp --> AuthMiddleware
    AuthMiddleware --> Controllers
    Controllers --> Services
    Services --> PrismaClient
    PrismaClient -->|"Runtime Queries (Pooled)"| PgBouncer
    PgBouncer --> DirectPostgres
    ExpressApp -.->|"Schema Migrations (Direct Unpooled)"| DirectPostgres
```

---

## 2. Technology Stack

| Layer | Technology | Version | Purpose & Rationale |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `^19.3.1` | Declarative UI rendering, fast concurrent rendering, and modern hooks. |
| **Build Tool & Bundler** | Vite | `^8.3.5` | Instant HMR development server, lightning-fast tree-shaking and Rollup production builds. |
| **Linting & Quality** | Oxlint | `^1.89.0` | Ultra-fast Rust-based static code analysis ensuring clean code standards. |
| **Backend Runtime** | Node.js (ESM) | `20+` | Native ECMAScript Modules (`import`/`export`), asynchronous I/O, event-driven scalability. |
| **Web Server Framework** | Express | `^5.0.0` | Robust, lightweight HTTP routing with native async error propagation in version 5. |
| **Schema Validation** | Zod | `^4.6.7` | Type-safe, declarative runtime schema validation for incoming query parameters and JSON payloads. |
| **Security & Auth** | `bcryptjs` & `jsonwebtoken` | `3.0.3` / `9.0.3` | Industry-standard password hashing with salt work factor 10, signed stateless JWTs. |
| **ORM / Query Builder** | Prisma ORM | `^7.10.1` | Type-safe schema definition, declarative migrations, and PostgreSQL driver adapter support. |
| **Database Driver** | `@prisma/adapter-pg` & `pg` | `^7.10.1` / `^8.23.1` | Direct PostgreSQL wire protocol adapter enabling connection pooling compatibility. |
| **Database Hosting** | Neon Serverless PostgreSQL | `v16` | Cloud PostgreSQL with auto-scaling storage, branch isolation, and built-in PgBouncer pooling. |
| **Frontend Hosting** | Vercel | Global CDN | Global static asset caching, SSL termination, and continuous Git deployment. |
| **Backend Hosting** | Render | Docker/Node | Managed web service running containerized Express backend with health checks. |

---

## 3. Frontend Architecture

The frontend is structured as a client-side Single Page Application (SPA) adhering to component-driven design principles:

### 3.1 Component Hierarchy and View Routing
- **Entry Point (`src/main.jsx`):** Bootstraps the React DOM root with strict mode and global styling.
- **Root Shell (`src/App.jsx`):** Acts as the central state coordinator, managing:
  - Global authentication state (`user`, `token`, `activeFridge`).
  - Active view navigation (`home`, `inventory`, `requests`, `members`, `discover`, `settings`).
  - Dark/Light UI theme toggle and responsive sidebar controls.
  - Global toast notifications and modal presentation.
- **View Modules (`src/components/`):**
  - `HomeDashboard.jsx`: Displays key metrics (fridge stats, pending requests, expiring items, quick actions).
  - `MyFridges.jsx`: Multi-fridge switcher, creation modal trigger, and role indicator.
  - `MyRequests.jsx`: Unified requests view supporting tabs for "Requests by Me" and "Requests to Review" with approve/reject/complete triggers.
  - `Discover.jsx`: Public community fridge directory with search, food preview modal, and membership application form.
  - `ActivityFeed.jsx`: Real-time audit log timeline highlighting actors, actions, and timestamps.
  - `Settings.jsx`: Fridge configuration panel for discoverability, public previews, join permissions, and member count display.
  - `Navigation.jsx`: Responsive sidebar and mobile header incorporating user profile badge and dark mode switch.

### 3.2 Client API Layer & Token Management (`src/lib/api.js`)
All client communications go through a unified API client:
- **Base Route:** Relative path `/api`.
- **Development Routing:** Vite dev proxy (`vite.config.js`) forwards `/api/*` to `http://localhost:5000`.
- **Production Routing:** In production, client requests to `/api` are handled via Vercel rewrites to `https://fridge-police.onrender.com/api` or configured environment targets, maintaining same-origin behavior from the browser's security context.
- **Token Storage:** Tokens are stored in browser `sessionStorage` (`fridgepolice_token`), isolating credentials per browser tab and automatically clearing on window close to minimize token theft risks.
- **401 Interception:** Any response returning HTTP 401 triggers immediate token removal and redirects the view to the login modal.

---

## 4. Backend Architecture

The backend follows a strict layered separation of concerns:

```mermaid
graph LR
    Req["Incoming HTTP Request"] --> Security["Security Headers & JSON Parser<br/>(app.js)"]
    Security --> Router["Route Dispatcher<br/>(routes/*.routes.js)"]
    Router --> AuthMiddleware["Auth & RBAC Middleware<br/>(authenticate.js, authorizeFridge.js)"]
    AuthMiddleware --> Validator["Zod Schema Validation<br/>(validators/*.validator.js)"]
    Validator --> Controller["Controller Layer<br/>(controllers/*.controller.js)"]
    Controller --> Service["Service Layer (Domain Logic & ACID Tx)<br/>(services/*.service.js)"]
    Service --> Prisma["Prisma Client Instance<br/>(lib/prisma.js)"]
    Prisma --> DB[("Neon PostgreSQL Database")]
    Service -.-> ErrorMW["Error Handling Middleware<br/>(middleware/errorHandler.js)"]
```

### 4.1 Layer Responsibilities
1. **HTTP / Middleware Layer (`app.js`, `middleware/`):**
   - Applies security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`).
   - Parses incoming JSON with a strict 10 KB limit.
   - Decodes and validates JWTs (`authenticate.js`), extracting `req.user = { id: sub }`.
   - Enforces per-fridge role authorization (`authorizeFridge.js`), verifying membership and role (`OWNER`, `ADMIN`, `MEMBER`).
2. **Routing Layer (`routes/`):**
   - Maps URI patterns to controller methods with nested resource routing (`/api/fridges/:fridgeId/items`, `/api/fridges/:fridgeId/requests`).
3. **Controller Layer (`controllers/`):**
   - Extracts route parameters, query strings, and request bodies.
   - Executes Zod schema validations (`parse`), rejecting invalid data with HTTP 400.
   - Forwards sanitized parameters to the service layer.
   - Formats standardized JSON responses: `{ success: true, data: ... }`.
4. **Service Layer (`services/`):**
   - Encapsulates all domain logic and transactional boundaries.
   - Coordinates database transactions (`prisma.$transaction`).
   - Implements concurrency locks (`SELECT ... FOR UPDATE` under `Serializable` isolation).
   - Manages automatic 24-hour reservation expiration and audit logging.
5. **Persistence Layer (`lib/prisma.js`):**
   - Singleton Prisma Client utilizing `@prisma/adapter-pg`.
   - Configures adaptive transaction timeouts (accommodating remote cloud latency during integration tests).

---

## 5. Database Architecture

### 5.1 Dual-Connection Strategy for Neon
Neon Serverless Postgres provides both connection-pooled endpoints (via PgBouncer) and direct unpooled endpoints. FridgePolice configures a dual connection strategy:

1. **Runtime Database URL (`DATABASE_URL`):**
   - Format: `postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DB?sslmode=require`
   - Purpose: Serves all standard application queries. PgBouncer multiplexes connections efficiently, allowing hundreds of concurrent requests without exhausting Postgres process limits.
2. **Direct Migration Database URL (`DATABASE_URL_UNPOOLED`):**
   - Format: `postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DB?sslmode=require`
   - Purpose: Used by Prisma CLI (`prisma migrate dev`, `prisma migrate deploy`). DDL schema modifications require Postgres session-level advisory locks (`pg_advisory_lock`), which are incompatible with transaction-level connection pooling.

### 5.2 Relational Entity Schema
- **`User`:** Identity records storing name, unique email, bcrypt password hash, and created timestamps.
- **`Fridge`:** Top-level tenancy root holding discoverability settings, preview flags, and metadata.
- **`FridgeMember`:** Many-to-many join table between `User` and `Fridge` with composite primary key `(userId, fridgeId)` and role enumeration (`OWNER`, `ADMIN`, `MEMBER`).
- **`FoodItem`:** Individual food records with high-precision decimal quantity, unit, optional expiry, category, and foreign keys to `Fridge` and `User`.
- **`FoodRequest`:** Reservation state machine tracking requested quantities, approval status (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `EXPIRED`, `COMPLETED`), expiration timestamp (`expiresAt`), and approving user.
- **`MembershipRequest`:** Join requests submitted by prospective community members with status (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`).
- **`ActivityLog`:** Append-only audit log capturing `(fridgeId, actorId, action, entityType, entityId, details, createdAt)`.

---

## 6. Authentication & Authorization Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Frontend as React SPA (Vercel)
    participant API as Express API (Render)
    participant DB as Neon PostgreSQL

    Note over User, Frontend: User Login
    User->>Frontend: Enter email & password
    Frontend->>API: POST /api/auth/login { email, password }
    API->>DB: Query User by email
    DB-->>API: Return User with passwordHash
    API->>API: bcrypt.compare(password, passwordHash)
    API->>API: Generate JWT (signed with JWT_SECRET, 24h validity)
    API-->>Frontend: HTTP 200 { success: true, token, user }
    Frontend->>Frontend: Store token in sessionStorage

    Note over User, Frontend: Authenticated Operation (e.g. Approve Request)
    User->>Frontend: Click "Approve Request"
    Frontend->>API: PATCH /api/fridges/:id/requests/:reqId/approve<br/>[Header: Authorization: Bearer <token>]
    API->>API: authenticate() verifies JWT signature & expiry
    API->>DB: authorizeFridge() checks FridgeMember role (OWNER/ADMIN)
    DB-->>API: Role confirmed: OWNER
    API->>DB: Run Serializable Transaction with Row Lock (FOR UPDATE)
    DB-->>API: Transaction committed successfully
    API-->>Frontend: HTTP 200 { success: true, data: updatedRequest }
    Frontend-->>User: Update UI to "APPROVED" with 24h countdown
```

---

## 7. Main Data Flows

### 7.1 Food Portion Request & Approval Flow
1. **Creation:** Member submits a request for $Q_{\text{req}}$ units. Service validates $Q_{\text{req}} > 0$ and $Q_{\text{req}} \le Q_{\text{total}}$. Request created with status `PENDING`.
2. **Approval (Concurrency Controlled):**
   - Owner/Admin clicks "Approve".
   - Service initiates a PostgreSQL transaction at `Serializable` isolation level.
   - Service executes `SELECT id FROM "FoodItem" WHERE id = :id FOR UPDATE`, blocking other approvals for this item.
   - Calculates available stock:
     $$\text{Available} = \text{Total Physical Quantity} - \sum(\text{Active Approved Unexpired Reservations})$$
   - If $Q_{\text{req}} > \text{Available}$, the transaction aborts with HTTP 409 Conflict.
   - If sufficient, request status becomes `APPROVED`, `expiresAt` is set to $\text{now} + 24 \text{ hours}$, and an `ActivityLog` is written.
3. **Completion:** When the member consumes the food, Admin/Owner triggers "Complete". Inside a transaction, `FoodItem.quantity` is decremented by $Q_{\text{req}}$, request status transitions to `COMPLETED`, and an audit log is emitted.

### 7.2 Spoilage & Auto-Expiry Flow (Lazy Evaluation)
To avoid running expensive continuously-polling daemon workers on serverless infrastructure, FridgePolice implements **deterministic lazy expiration**:
- Before any request list, lookup, approval, or completion executes, `expireOverdueReservations(fridgeId)` is invoked.
- It finds all requests where `status = 'APPROVED'` and `expiresAt <= NOW()`.
- Overdue requests are transitioned to `status = 'EXPIRED'`, immediately liberating reserved inventory for subsequent requests.

### 7.3 Physical Discrepancy Reconciliation Flow
- When food is eaten without using the app, spoils, or goes missing, an Admin/Owner edits the item via `PATCH /api/fridges/:id/items/:itemId`.
- The new physical quantity is set directly.
- The service updates `FoodItem` and writes an `INVENTORY_ITEM_UPDATED` activity log documenting the change.

---

## 8. Important Architectural Decisions and Trade-Offs

| Decision | Alternative Considered | Selected Rationale & Trade-Off |
| :--- | :--- | :--- |
| **Row Locking (`FOR UPDATE`) + Serializable Isolation** | Optimistic Locking with version column | Optimistic locking fails after the fact and requires complex client-side reconciliation. Row-level pessimistic locking at the database level guarantees zero over-allocation even under high concurrent load, with automated 3x retry on serialization conflict. |
| **Lazy Expiration on Query / Action** | Background Cron Job / Queue Worker | A separate cron worker on free/starter tiers (Render) increases operational complexity, cost, and risks cold-start race conditions. Lazy evaluation guarantees that no user ever observes a stale reservation at the moment of evaluation. |
| **SessionStorage for JWT** | LocalStorage or HTTP-only Cookies | `localStorage` persists indefinitely and is vulnerable to persistent XSS. HTTP-only cookies complicate cross-origin deployment across Vercel and Render domains. `sessionStorage` confines the token to the active browser tab session, clearing automatically on window close. |
| **Dual Neon Connection URLs** | Single direct connection | Neon PgBouncer pooling prevents database connection starvation during traffic spikes, but PgBouncer does not support migration advisory locks. Using pooled for runtime and unpooled for migrations gives the best of both worlds. |
| **Decimal(10, 2) for Quantities** | Floating Point (Float / Double) | IEEE 754 floats introduce rounding errors (e.g., $0.1 + 0.2 = 0.30000000000000004$), which is unacceptable for inventory accounting. PostgreSQL `Decimal(10, 2)` guarantees exact numerical precision. |
| **Monorepo Layout** | Polyrepo (separate frontend & backend repos) | Keeping `src/` (Vite) and `server/` (Express) in a single repository allows unified schema awareness, shared validation contracts, coordinated atomic commits, and simpler CI/CD deployment pipelines. |
