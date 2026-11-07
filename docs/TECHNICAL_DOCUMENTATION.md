# FridgePolice — Comprehensive Technical Documentation

**Target Audience:** Kalvium Project Assessor, Systems Architects, Backend & Frontend Engineers, DevOps Engineers  
**Document Version:** 1.0.0  
**Repository:** [https://github.com/bhavanaaa-1/fridge-police](https://github.com/bhavanaaa-1/fridge-police)  
**Live Frontend:** [https://fridge-police.vercel.app](https://fridge-police.vercel.app)  
**Live Backend API:** [https://fridge-police.onrender.com](https://fridge-police.onrender.com)  
**Live API Health Check:** [https://fridge-police.onrender.com/api/health](https://fridge-police.onrender.com/api/health)  

---

## Table of Contents
1. [Section 1: System Architecture](#section-1-system-architecture)
2. [Section 2: API Documentation](#section-2-api-documentation)
3. [Section 3: Database Design](#section-3-database-design)
4. [Section 4: Deployment Documentation](#section-4-deployment-documentation)
5. [Section 5: Codebase Structure](#section-5-codebase-structure)

---

## Section 1: System Architecture

FridgePolice is an enterprise-grade communal refrigerator inventory management platform built as a decoupled, multi-tenant cloud application. The architecture cleanly separates presentation, business logic execution, and relational data persistence.

```mermaid
graph TD
    subgraph Client_Tier ["Presentation Tier (Browser & CDN)"]
        ClientBrowser["Web Browser (Desktop / Mobile)"]
        VercelCDN["Vercel Global Edge Network<br/>(Hosts React 19 + Vite SPA)"]
    end

    subgraph App_Tier ["Application Tier (Render Container)"]
        RenderService["Render Web Service (Linux Container)<br/>Node.js 20+ Runtime"]
        ExpressRouter["Express 5 Router Pipeline<br/>(Security Headers, JSON 10KB Parser)"]
        AuthLayer["Auth & Role Guard Middlewares<br/>(JWT HS256, Fridge RBAC)"]
        DomainServices["Domain Services Layer<br/>(Inventory, Requests, Discovery)"]
        PrismaAdapter["Prisma 7 Client Engine<br/>(@prisma/adapter-pg)"]
    end

    subgraph Data_Tier ["Data Persistence Tier (Neon Serverless Cloud)"]
        PgBouncerPooler["Neon PgBouncer Connection Pooler<br/>(DATABASE_URL - Port 5432 / Pooled)"]
        DirectPostgresInstance["PostgreSQL 16 Database Cluster<br/>(DATABASE_URL_UNPOOLED - Direct DDL)"]
    end

    ClientBrowser -->|"1. Static Assets (HTTPS)"| VercelCDN
    ClientBrowser -->|"2. REST Calls (/api/*)"| RenderService
    RenderService --> ExpressRouter
    ExpressRouter --> AuthLayer
    AuthLayer --> DomainServices
    DomainServices --> PrismaAdapter
    PrismaAdapter -->|"Runtime Pooled Transactions"| PgBouncerPooler
    PgBouncerPooler --> DirectPostgresInstance
    RenderService -.->|"Schema Migrations (Direct Session Locks)"| DirectPostgresInstance
```

### 1.1 Architectural Tiers
1. **Client Tier:** A single-page application built with React 19 and Vite 8. All dynamic data fetching uses standard relative URLs (`/api/...`). Assets are served with immutable caching headers via Vercel's global CDN.
2. **Application Tier:** An asynchronous Express 5 API running in a container on Render. The server enforces defensive headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`), strict 10 KB body size limits, Zod schema validation, and granular role-based authorization.
3. **Data Persistence Tier:** A serverless PostgreSQL 16 cluster hosted on Neon. Neon's built-in PgBouncer multiplexes database connections, allowing high concurrent request volume while eliminating PostgreSQL connection starvation.

---

## Section 2: API Documentation

All API endpoints return standard JSON responses. Success responses follow `{ success: true, ... }`. Error responses follow `{ success: false, message: string, errors?: Array }`.

### 2.1 Authentication & Profile (`/api/auth`)

#### `POST /api/auth/register`
- **Description:** Registers a new user account and returns a signed JWT.
- **Auth:** Public.
- **Request Body:**
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "securePassword123"
  }
  ```
- **Validation Rules:**
  - `name`: string, min 1 char, trimmed.
  - `email`: string, RFC-compliant email, converted to lowercase.
  - `password`: string, min 8 chars.
- **Responses:**
  - `201 Created`: `{ "success": true, "token": "...", "user": { "id": "...", "name": "...", "email": "..." } }`
  - `400 Bad Request`: Validation failure or duplicate email address (`"A user with this email already exists"`).

#### `POST /api/auth/login`
- **Description:** Authenticates credentials and returns a signed JWT.
- **Auth:** Public.
- **Request Body:**
  ```json
  {
    "email": "jane@example.com",
    "password": "securePassword123"
  }
  ```
- **Responses:**
  - `200 OK`: `{ "success": true, "token": "...", "user": { "id": "...", "name": "...", "email": "..." } }`
  - `400 Bad Request`: Validation failure.
  - `401 Unauthorized`: Invalid credentials.

#### `GET /api/auth/me`
- **Description:** Returns the authenticated user profile along with active fridge memberships.
- **Auth:** Bearer JWT required.
- **Responses:**
  - `200 OK`: `{ "success": true, "user": { "id": "...", "name": "...", "email": "...", "fridgeMemberships": [...] } }`
  - `401 Unauthorized`: Missing, invalid, or expired token.

---

### 2.2 Fridge Workspaces & Membership (`/api/fridges`)

#### `POST /api/fridges`
- **Description:** Provisions a new fridge workspace. The creating user is atomically assigned the `OWNER` role.
- **Auth:** Bearer JWT required.
- **Request Body:**
  ```json
  {
    "name": "Flat 42 Kitchen",
    "description": "Shared apartment fridge",
    "isDiscoverable": true,
    "publicFoodPreview": true,
    "acceptJoinRequests": true,
    "publicDescription": "Community-friendly fridge in Flat 42",
    "showMemberCount": true
  }
  ```
- **Responses:**
  - `201 Created`: `{ "success": true, "fridge": { ... } }`
  - `400 Bad Request`: Validation failure (name missing or empty).

#### `GET /api/fridges`
- **Description:** Lists all fridges the authenticated user is currently a member of.
- **Auth:** Bearer JWT required.
- **Responses:**
  - `200 OK`: `{ "success": true, "fridges": [ { "id": "...", "name": "...", "role": "OWNER", ... } ] }`

#### `GET /api/fridges/:fridgeId`
- **Description:** Retrieves detailed fridge metadata.
- **Auth:** Bearer JWT required. Role: `OWNER`, `ADMIN`, or `MEMBER`.
- **Responses:**
  - `200 OK`: `{ "success": true, "fridge": { ... } }`
  - `403 Forbidden`: User is not a member of this fridge.
  - `404 Not Found`: Fridge does not exist.

#### `PATCH /api/fridges/:fridgeId/settings`
- **Description:** Updates discoverability, preview flags, and public description.
- **Auth:** Bearer JWT required. Role: `OWNER` or `ADMIN`.
- **Request Body:**
  ```json
  {
    "name": "Flat 42 Main Fridge",
    "isDiscoverable": false,
    "publicFoodPreview": false,
    "acceptJoinRequests": false
  }
  ```
- **Responses:**
  - `200 OK`: `{ "success": true, "fridge": { ... } }`
  - `403 Forbidden`: User does not hold `OWNER` or `ADMIN` role.

#### `GET /api/fridges/:fridgeId/members`
- **Description:** Lists all members and their roles in this fridge.
- **Auth:** Bearer JWT required. Role: `OWNER`, `ADMIN`, or `MEMBER`.
- **Responses:**
  - `200 OK`: `{ "success": true, "members": [ { "userId": "...", "role": "MEMBER", "user": { "name": "..." } } ] }`

#### `POST /api/fridges/:fridgeId/members`
- **Description:** Directly adds an existing user to this fridge by email.
- **Auth:** Bearer JWT required. Role: `OWNER`.
- **Request Body:**
  ```json
  {
    "email": "roommate@example.com",
    "role": "MEMBER"
  }
  ```
- **Responses:**
  - `201 Created`: `{ "success": true, "member": { ... } }`
  - `403 Forbidden`: Only `OWNER` can directly add members.
  - `404 Not Found`: No user registered with that email.

#### `GET /api/fridges/:fridgeId/activity`
- **Description:** Retrieves paginated chronological audit logs for the fridge.
- **Auth:** Bearer JWT required. Role: `OWNER`, `ADMIN`, or `MEMBER`.
- **Query Parameters:** `page` (default 1), `limit` (default 20, max 100).
- **Responses:**
  - `200 OK`: `{ "success": true, "activity": [...], "pagination": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 } }`

---

### 2.3 Inventory Management (`/api/fridges/:fridgeId/items`)

#### `POST /api/fridges/:fridgeId/items`
- **Description:** Adds a new food item to the fridge inventory.
- **Auth:** Bearer JWT required. Role: `OWNER` or `ADMIN`.
- **Request Body:**
  ```json
  {
    "name": "Oat Milk",
    "category": "Dairy",
    "quantity": 2.0,
    "unit": "L",
    "expiryDate": "2026-11-20T00:00:00.000Z",
    "notes": "Unsweetened carton on top shelf"
  }
  ```
- **Responses:**
  - `201 Created`: `{ "success": true, "item": { "id": "...", "name": "Oat Milk", "quantity": "2.00", ... } }`
  - `400 Bad Request`: Invalid quantity ($\le 0$) or missing required name/unit.
  - `403 Forbidden`: `MEMBER` role is not permitted to create items.

#### `GET /api/fridges/:fridgeId/items`
- **Description:** Retrieves paginated inventory items with optional search and category filters.
- **Auth:** Bearer JWT required. Role: `OWNER`, `ADMIN`, or `MEMBER`.
- **Query Parameters:**
  - `search`: string (case-insensitive name substring match)
  - `category`: string (exact category match)
  - `page`: integer (default 1)
  - `limit`: integer (default 10, max 100)
- **Responses:**
  - `200 OK`: `{ "success": true, "items": [...], "pagination": { ... } }`

#### `GET /api/fridges/:fridgeId/items/:itemId`
- **Description:** Retrieves full details for a single inventory item.
- **Auth:** Bearer JWT required. Role: `OWNER`, `ADMIN`, or `MEMBER`.
- **Responses:**
  - `200 OK`: `{ "success": true, "item": { ... } }`
  - `404 Not Found`: Item does not exist in this fridge.

#### `PATCH /api/fridges/:fridgeId/items/:itemId`
- **Description:** Updates item attributes or reconciles physical quantity discrepancies.
- **Auth:** Bearer JWT required. Role: `OWNER` or `ADMIN`.
- **Request Body:** (at least one field required)
  ```json
  {
    "quantity": 1.5,
    "notes": "Half a liter consumed offline"
  }
  ```
- **Responses:**
  - `200 OK`: `{ "success": true, "item": { ... } }`
  - `403 Forbidden`: Insufficient permissions.
  - `404 Not Found`: Item not found.

#### `DELETE /api/fridges/:fridgeId/items/:itemId`
- **Description:** Deletes a food item (e.g., spoiled or discarded) and records an audit log.
- **Auth:** Bearer JWT required. Role: `OWNER` or `ADMIN`.
- **Responses:**
  - `200 OK`: `{ "success": true, "item": { ... } }`
  - `403 Forbidden`: Insufficient permissions.
  - `404 Not Found`: Item not found.

---

### 2.4 Food Portion Requests (`/api/fridges/:fridgeId/requests`)

#### `POST /api/fridges/:fridgeId/requests`
- **Description:** Submits a portion request for an available food item.
- **Auth:** Bearer JWT required. Role: `OWNER`, `ADMIN`, or `MEMBER`.
- **Request Body:**
  ```json
  {
    "foodItemId": "cuid_xyz123",
    "requestedQuantity": 1.0,
    "note": "Using for baking this afternoon"
  }
  ```
- **Responses:**
  - `201 Created`: `{ "success": true, "request": { "id": "...", "status": "PENDING", ... } }`
  - `400 Bad Request`: Requested quantity exceeds total recorded stock.
  - `404 Not Found`: Target item not found in this fridge.

#### `GET /api/fridges/:fridgeId/requests`
- **Description:** Lists food portion requests in the fridge (auto-sweeps expired reservations first).
- **Auth:** Bearer JWT required. Role: `OWNER`, `ADMIN`, or `MEMBER`.
- **Query Parameters:** `status` (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `EXPIRED`, `COMPLETED`), `requesterId`, `page`, `limit`.
- **Responses:**
  - `200 OK`: `{ "success": true, "requests": [...], "pagination": { ... } }`
  - `403 Forbidden`: `MEMBER` attempting to filter requests by another user's `requesterId`.

#### `PATCH /api/fridges/:fridgeId/requests/:requestId/approve`
- **Description:** Approves a pending request with row-level locking (`SELECT ... FOR UPDATE`) and `Serializable` isolation. Sets 24-hour expiration.
- **Auth:** Bearer JWT required. Role: `OWNER` or `ADMIN`.
- **Responses:**
  - `200 OK`: `{ "success": true, "request": { "id": "...", "status": "APPROVED", "expiresAt": "...", ... } }`
  - `409 Conflict`: Request is not `PENDING`, or insufficient unreserved stock exists.

#### `PATCH /api/fridges/:fridgeId/requests/:requestId/reject`
- **Description:** Rejects a pending request.
- **Auth:** Bearer JWT required. Role: `OWNER` or `ADMIN`.
- **Responses:**
  - `200 OK`: `{ "success": true, "request": { "id": "...", "status": "REJECTED", ... } }`
  - `409 Conflict`: Only `PENDING` requests can be rejected.

#### `PATCH /api/fridges/:fridgeId/requests/:requestId/cancel`
- **Description:** Cancels a pending request. Requesters can cancel their own requests; Owners/Admins can cancel any member's request.
- **Auth:** Bearer JWT required. Role: `OWNER`, `ADMIN`, or `MEMBER`.
- **Responses:**
  - `200 OK`: `{ "success": true, "request": { "id": "...", "status": "CANCELLED", ... } }`
  - `403 Forbidden`: Non-admin attempting to cancel another user's request.
  - `409 Conflict`: Request is no longer `PENDING`.

#### `PATCH /api/fridges/:fridgeId/requests/:requestId/complete`
- **Description:** Formally records physical food consumption. Decrements `FoodItem.quantity` by the requested amount and sets status to `COMPLETED`.
- **Auth:** Bearer JWT required. Role: `OWNER` or `ADMIN`.
- **Responses:**
  - `200 OK`: `{ "success": true, "request": { "id": "...", "status": "COMPLETED", ... } }`
  - `409 Conflict`: Request is not in `APPROVED` status, or reservation has expired.

---

### 2.5 Community Discovery & Join Requests (`/api/discover/fridges`)

#### `GET /api/discover/fridges`
- **Description:** Public directory of discoverable fridges (`isDiscoverable = true`). Returns sanitized public projection.
- **Auth:** Public.
- **Query Parameters:** `search`, `page`, `limit`.
- **Responses:**
  - `200 OK`: `{ "success": true, "fridges": [ { "id": "...", "name": "...", "publicDescription": "...", "acceptJoinRequests": true } ] }`

#### `GET /api/discover/fridges/:fridgeId`
- **Description:** Public view of a single discoverable fridge. Displays preview food items if `publicFoodPreview = true`.
- **Auth:** Optional Bearer token (returns `isMember` and `userRequestStatus` if authenticated).
- **Responses:**
  - `200 OK`: `{ "success": true, "fridge": { ... } }`
  - `404 Not Found`: Fridge not found or marked private.

#### `POST /api/fridges/:fridgeId/join-requests`
- **Description:** Submits an application to join a public fridge.
- **Auth:** Bearer JWT required.
- **Request Body:** `{ "note": "Hi, I live in Flat 4B and would like to share groceries." }`
- **Responses:**
  - `201 Created`: `{ "success": true, "request": { ... } }`
  - `409 Conflict`: User is already a member or has a pending join request.

#### `GET /api/fridges/:fridgeId/join-requests`
- **Description:** Lists all incoming join requests for this fridge.
- **Auth:** Bearer JWT required. Role: `OWNER` or `ADMIN`.
- **Responses:**
  - `200 OK`: `{ "success": true, "requests": [...] }`

#### `PATCH /api/fridges/:fridgeId/join-requests/:requestId/approve`
- **Description:** Approves a join request, atomically adding the applicant to `FridgeMember` with role `MEMBER`.
- **Auth:** Bearer JWT required. Role: `OWNER` or `ADMIN`.
- **Responses:**
  - `200 OK`: `{ "success": true, "member": { ... } }`

#### `PATCH /api/fridges/:fridgeId/join-requests/:requestId/reject`
- **Description:** Rejects a join request.
- **Auth:** Bearer JWT required. Role: `OWNER` or `ADMIN`.
- **Responses:**
  - `200 OK`: `{ "success": true, "request": { ... } }`

---

### 2.6 User Dashboard & Requests (`/api/users`)

#### `GET /api/users/me/dashboard`
- **Description:** Aggregates dashboard metrics for the user across all their fridges (total fridges, pending requests, expiring items).
- **Auth:** Bearer JWT required.
- **Responses:**
  - `200 OK`: `{ "success": true, "fridgesCount": 2, "pendingRequestsCount": 1, ... }`

#### `GET /api/users/me/requests`
- **Description:** Retrieves all food requests associated with the user across all fridges.
- **Auth:** Bearer JWT required.
- **Responses:**
  - `200 OK`: `{ "success": true, "myRequests": [...], "requestsToReview": [...] }`

#### `GET /api/users/me/join-requests`
- **Description:** Lists join requests submitted by the authenticated user.
- **Auth:** Bearer JWT required.

#### `PATCH /api/users/me/join-requests/:requestId/cancel`
- **Description:** Cancels an outgoing join request previously submitted by the user.
- **Auth:** Bearer JWT required.

---

### 2.7 System Health Check (`/api/health`)

#### `GET /api/health`
- **Description:** Operational liveness probe for load balancers and deployment monitoring.
- **Auth:** Public.
- **Responses:**
  - `200 OK`: `{ "success": true, "message": "FridgePolice API is running!" }`

---

## Section 3: Database Design

The persistence tier runs on PostgreSQL 16 managed by Neon. Schema migrations and models are managed using Prisma 7.

```mermaid
erDiagram
    User ||--o{ FridgeMember : "has"
    User ||--o{ FoodItem : "created"
    User ||--o{ FoodRequest : "requested"
    User ||--o{ FoodRequest : "approved"
    User ||--o{ MembershipRequest : "submitted"
    User ||--o{ MembershipRequest : "decided"
    User ||--o{ ActivityLog : "acted"

    Fridge ||--o{ FridgeMember : "enrolled"
    Fridge ||--o{ FoodItem : "contains"
    Fridge ||--o{ FoodRequest : "hosts"
    Fridge ||--o{ MembershipRequest : "received"
    Fridge ||--o{ ActivityLog : "recorded"

    FoodItem ||--o{ FoodRequest : "demanded"

    User {
        String id PK "cuid()"
        String name "VarChar"
        String email UK "VarChar (unique)"
        String passwordHash "VarChar (bcrypt 60 chars)"
        DateTime createdAt "DEFAULT now()"
        DateTime updatedAt "updatedAt"
    }

    Fridge {
        String id PK "cuid()"
        String name "VarChar"
        String description "VarChar (nullable)"
        Boolean isDiscoverable "DEFAULT false"
        Boolean publicFoodPreview "DEFAULT false"
        Boolean acceptJoinRequests "DEFAULT false"
        String publicDescription "VarChar (nullable)"
        Boolean showMemberCount "DEFAULT false"
        DateTime createdAt "DEFAULT now()"
        DateTime updatedAt "updatedAt"
    }

    FridgeMember {
        String userId PK, FK "references User.id"
        String fridgeId PK, FK "references Fridge.id"
        FridgeRole role "ENUM: OWNER, ADMIN, MEMBER"
        DateTime joinedAt "DEFAULT now()"
    }

    FoodItem {
        String id PK "cuid()"
        String fridgeId FK "references Fridge.id"
        String name "VarChar"
        String category "VarChar (nullable)"
        Decimal quantity "Decimal(10, 2)"
        String unit "VarChar"
        DateTime expiryDate "DateTime (nullable)"
        String notes "VarChar (nullable)"
        String createdById FK "references User.id"
        DateTime createdAt "DEFAULT now()"
        DateTime updatedAt "updatedAt"
    }

    FoodRequest {
        String id PK "cuid()"
        String foodItemId FK "references FoodItem.id"
        String requesterId FK "references User.id"
        Decimal requestedQuantity "Decimal(10, 2)"
        RequestStatus status "ENUM: PENDING, APPROVED, REJECTED, CANCELLED, EXPIRED, COMPLETED"
        String note "VarChar (nullable)"
        String approvedById FK "references User.id (nullable)"
        DateTime expiresAt "DateTime (nullable, +24h on approval)"
        DateTime decidedAt "DateTime (nullable)"
        DateTime createdAt "DEFAULT now()"
        DateTime updatedAt "updatedAt"
    }

    MembershipRequest {
        String id PK "cuid()"
        String fridgeId FK "references Fridge.id"
        String userId FK "references User.id"
        MembershipRequestStatus status "ENUM: PENDING, APPROVED, REJECTED, CANCELLED"
        String note "VarChar (nullable)"
        String decidedById FK "references User.id (nullable)"
        DateTime decidedAt "DateTime (nullable)"
        DateTime createdAt "DEFAULT now()"
        DateTime updatedAt "updatedAt"
    }

    ActivityLog {
        String id PK "cuid()"
        String fridgeId FK "references Fridge.id"
        String actorId FK "references User.id (nullable)"
        String action "VarChar"
        String entityType "VarChar"
        String entityId "VarChar (nullable)"
        Json details "Json (nullable)"
        DateTime createdAt "DEFAULT now()"
    }
```

### 3.1 Enumerations
1. **`FridgeRole`**: `OWNER` (full administrative rights), `ADMIN` (inventory and request management), `MEMBER` (request submission and inventory viewing).
2. **`RequestStatus`**: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `EXPIRED`, `COMPLETED`.
3. **`MembershipRequestStatus`**: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`.

### 3.2 Indexing Strategy
- **`Fridge`**: Index on `[isDiscoverable]` for high-performance public directory searches.
- **`FridgeMember`**: Primary composite key `[userId, fridgeId]`; individual indexes on `[fridgeId]` and `[userId]`.
- **`FoodItem`**: Indexes on `[fridgeId]` and `[createdById]` for fast inventory filtering.
- **`FoodRequest`**: Indexes on `[foodItemId]`, `[requesterId]`, `[status]`, and `[createdAt]` for sub-millisecond status lookups and lazy-expiry scans.
- **`ActivityLog`**: Indexes on `[fridgeId]`, `[actorId]`, and `[createdAt]` for chronological timeline rendering.
- **`MembershipRequest`**: Indexes on `[fridgeId]`, `[userId]`, `[status]`, and `[createdAt]`.

### 3.3 Referential Actions (Cascades)
- **`onDelete: Cascade`**: `FridgeMember` cascades with User/Fridge; `FoodItem` cascades with Fridge; `FoodRequest` cascades with FoodItem and requester User; `MembershipRequest` cascades with Fridge and User; `ActivityLog` cascades with Fridge.
- **`onDelete: Restrict`**: `FoodItem.createdById` prevents accidental deletion of a User while their items remain recorded.
- **`onDelete: SetNull`**: `FoodRequest.approvedById`, `MembershipRequest.decidedById`, and `ActivityLog.actorId` preserve historical and financial audit integrity if an administrative user is deleted.

---

## Section 4: Deployment Documentation

FridgePolice is deployed in production across three independent, purpose-built cloud services:

| Component | Platform | URL / Endpoint | Deployment Method |
| :--- | :--- | :--- | :--- |
| **Frontend SPA** | Vercel | [https://fridge-police.vercel.app](https://fridge-police.vercel.app) | Git integration on `main` branch |
| **Backend API** | Render | [https://fridge-police.onrender.com](https://fridge-police.onrender.com) | Containerized web service |
| **Database** | Neon Cloud | AWS Region (`us-east-1` / `eu-central-1`) | Managed Serverless PostgreSQL 16 |

---

### 4.1 Render Backend Service Configuration
- **Environment:** Node
- **Root Directory:** `server`
- **Build Command:** `npm install && npm run db:generate`
- **Start Command:** `npm start`
- **Health Check Path:** `/api/health`
- **Host Binding:** `0.0.0.0` (listening on `process.env.PORT`)
- **Auto-Deploy:** Enabled on pushes to GitHub `main`.

---

### 4.2 Production Environment Variables

| Variable Name | Required By | Environment | Description & Example Format |
| :--- | :--- | :--- | :--- |
| `PORT` | Render / Express | Render | The port Express listens on (dynamically set by Render, e.g., `10000`, local default `5000`). |
| `DATABASE_URL` | Express / Prisma Runtime | Render, Local | Neon **pooled** connection string (via PgBouncer). <br/>`postgresql://user:pass@ep-host-pooler.region.aws.neon.tech/neondb?sslmode=require` |
| `DATABASE_URL_UNPOOLED` | Prisma CLI Migrations | Render, Local | Neon **direct** connection string without pooling. Required for `prisma migrate` DDL lock commands. <br/>`postgresql://user:pass@ep-host.region.aws.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | Auth Token Service | Render, Local | Cryptographic secret for signing JWTs. Must be $\ge 32$ random characters. Server refuses to boot if insecure. |
| `JWT_EXPIRES_IN` | Auth Token Service | Render, Local | Expiration lifetime for issued tokens (e.g., `1d` for 24 hours). |
| `PRISMA_TRANSACTION_TIMEOUT` | Prisma Client | Render (optional) | Transaction timeout override in milliseconds (defaults to 25,000 ms in test/remote environments). |
| `TEST_DATABASE_URL` | Integration Tests | Test runner | Neon test branch pooled URL used by `server/tests/*.mjs`. |
| `TEST_DATABASE_URL_UNPOOLED` | Integration Tests | Test runner | Neon test branch unpooled URL for running migrations against test database. |

---

### 4.3 Database Migration Execution
In production, schema migrations should be applied using the unpooled direct connection:
```bash
cd server
npx prisma migrate deploy
```
This runs all pending migration files located in `server/prisma/migrations/` sequentially inside transactions without locking conflicts from PgBouncer.

---

## Section 5: Codebase Structure

The repository is structured as a clear, maintainable monorepo:

```
fridge-police/
|-- .env.example                     # Example environment variables for local development
|-- .gitignore                       # Git exclusion rules (node_modules, .env*, build artifacts)
|-- .oxlintrc.json                   # Oxlint configuration for ultra-fast static analysis
|-- Changes.md                       # Deep-dive on Kalvium Challenge #8 engineering solutions
|-- HLD.md                           # High-Level Design document
|-- LLD.md                           # Low-Level Design document
|-- PRD.md                           # Product Requirements Document
|-- README.md                        # Master project README
|-- index.html                       # Single Page Application HTML host file
|-- neon.ts                          # Neon database configuration helper
|-- package.json                     # Frontend dependencies & workspace scripts
|-- package-lock.json                # Locked frontend dependency tree
|-- vite.config.js                   # Vite bundler configuration & local dev proxy
|-- docs/
|   `-- TECHNICAL_DOCUMENTATION.md   # This comprehensive architectural reference
|-- public/
|   `-- favicon.svg                  # Application branding icon
|-- src/                             # React 19 Frontend Application
|   |-- App.css                      # Application component styles & design tokens
|   |-- App.jsx                      # Root application shell, state router, toasts
|   |-- index.css                    # Global CSS variables & Tailwind-style utilities
|   |-- main.jsx                     # DOM root bootstrapping
|   |-- assets/
|   |   |-- hero.png                 # Hero refrigerator illustration
|   |   |-- react.svg                # React logo
|   |   `-- vite.svg                 # Vite logo
|   |-- components/
|   |   |-- ActivityFeed.jsx         # Chronological audit log timeline component
|   |   |-- CreateFridgeModal.jsx    # Modal dialog to create new fridge workspace
|   |   |-- Discover.jsx             # Public community fridge directory & join modal
|   |   |-- HomeDashboard.jsx        # Stats overview, active fridge selector, quick cards
|   |   |-- Icons.jsx                # Handcrafted Lucide-style SVG icon components
|   |   |-- MyFridges.jsx            # Multi-fridge switcher & membership manager
|   |   |-- MyRequests.jsx           # Request management tabs (Submitted vs. Review)
|   |   |-- Navigation.jsx           # Responsive sidebar, user badge, dark mode switch
|   |   `-- Settings.jsx             # Fridge privacy settings & discoverability toggles
|   `-- lib/
|       `-- api.js                   # Unified fetch API client with 401 interception
`-- server/                          # Node.js Express 5 REST API Backend
    |-- .env.example                 # Example server environment variables
    |-- package.json                 # Backend dependencies (Express, Prisma, bcrypt, zod)
    |-- package-lock.json            # Locked backend dependency tree
    |-- prisma.config.ts             # Prisma 7 configuration file
    |-- prisma/
    |   |-- schema.prisma            # Declarative PostgreSQL schema & indexes
    |   `-- migrations/              # Chronological SQL migration files
    |-- generated/
    |   `-- prisma/                  # Generated Prisma Client runtime types
    |-- src/
    |   |-- app.js                   # Express app setup, security headers, middleware stack
    |   |-- server.js                # Server entry point, 0.0.0.0 binding, JWT startup check
    |   |-- controllers/
    |   |   |-- auth.controller.js       # Register, login, me endpoints
    |   |   |-- fridge.controller.js     # Fridge, member, join, discovery endpoints
    |   |   |-- health.controller.js     # Health probe endpoint
    |   |   |-- inventory.controller.js  # Item CRUD endpoints
    |   |   `-- request.controller.js    # Request lifecycle endpoints
    |   |-- lib/
    |   |   `-- prisma.js                # Reusable Prisma client with @prisma/adapter-pg
    |   |-- middleware/
    |   |   |-- authenticate.js          # JWT verification & optional auth middlewares
    |   |   |-- authorizeFridge.js       # Per-fridge RBAC authorization guard
    |   |   |-- errorHandler.js          # Centralized error handler & Zod formatter
    |   |   `-- notFound.js              # Catch-all 404 handler
    |   |-- routes/
    |   |   |-- auth.routes.js           # Auth route declarations
    |   |   |-- discover.routes.js       # Public discovery route declarations
    |   |   |-- fridge.routes.js         # Fridge workspace route declarations
    |   |   |-- health.routes.js         # Health route declarations
    |   |   |-- inventory.routes.js      # Inventory route declarations
    |   |   |-- request.routes.js        # Request lifecycle route declarations
    |   |   `-- user.routes.js           # User dashboard & join request route declarations
    |   |-- services/
    |   |   |-- auth.service.js          # Authentication, password hashing, JWT signing
    |   |   |-- fridge.service.js        # Fridge domain logic & public projection filtering
    |   |   |-- inventory.service.js     # Inventory CRUD & audit trail logging
    |   |   `-- request.service.js       # Concurrency locks, 24h expiration, completions
    |   |-- utils/
    |   |   `-- token.js                 # JWT sign and verify helpers
    |   `-- validators/
    |       |-- auth.validator.js        # Zod validation schemas for auth
    |       |-- fridge.validator.js      # Zod validation schemas for fridges & join requests
    |       |-- inventory.validator.js   # Zod validation schemas for food items
    |       `-- request.validator.js     # Zod validation schemas for food requests
    `-- tests/                       # Automated Integration Test Suite (66 tests)
        |-- auth.test.mjs                    # Authentication, registration, JWT tests
        |-- discovery-and-membership.test.mjs# Public discovery & privacy projection tests
        |-- email-validation.test.mjs        # Email RFC normalization & password rules
        |-- inventory.test.mjs               # Item CRUD, pagination, search, category tests
        |-- request.test.mjs                 # Concurrency locks, 24h auto-expiry tests
        `-- security.test.mjs                # Multi-tenant isolation & privilege escalation tests
```
