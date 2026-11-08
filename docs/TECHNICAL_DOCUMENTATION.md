# FridgePolice — Technical Documentation & Viva Preparation Guide

**Project Name:** FridgePolice
**Document Version:** 2.0 (Viva Edition)
**Target Audience:** Students, Viva Examiners, Project Evaluators
**Repository:** [https://github.com/bhavanaaa-1/fridge-police](https://github.com/bhavanaaa-1/fridge-police)
**Live Frontend:** [https://fridge-police.vercel.app](https://fridge-police.vercel.app)
**Live Backend API:** [https://fridge-police.onrender.com](https://fridge-police.onrender.com)

---

## Table of Contents
1. [Core Technical Concept Explanations (Viva Format)](#1-core-technical-concept-explanations-viva-format)
2. [Project Codebase Directory Structure](#2-project-codebase-directory-structure)
3. [Frontend Implementation Details](#3-frontend-implementation-details)
4. [Backend Implementation Details](#4-backend-implementation-details)
5. [Database & Concurrency Design](#5-database--concurrency-design)
6. [Testing Approach (66 Integration Tests)](#6-testing-approach-66-integration-tests)
7. [Deployment & Reverse Proxy Setup](#7-deployment--reverse-proxy-setup)
8. [Frequently Asked Viva Questions & Model Answers](#8-frequently-asked-viva-questions--model-answers)

---

## 1. Core Technical Concept Explanations (Viva Format)

### Concept 1: JWT Authentication
- **What it means:** A JSON Web Token (JWT) is a compact, cryptographically signed token containing user identity claims that proves a user has logged in.
- **Why we used it:** To maintain stateless authentication across HTTP requests without storing server-side session records in memory or a database.
- **How FridgePolice uses it:** When a user logs in (`POST /api/auth/login`), the server signs a JWT containing the user's ID (`sub: user.id`) using a secret key (`JWT_SECRET`). The frontend stores it in `sessionStorage` and sends it with every protected API call inside the `Authorization: Bearer <token>` header. The `authenticate` middleware verifies this token before allowing the request to proceed.

---

### Concept 2: Password Hashing with bcrypt
- **What it means:** Hashing is a one-way mathematical function that turns a plaintext password into an irreversible string of characters with a random salt.
- **Why we used it:** If the database is ever compromised, stored plaintext passwords would be stolen. Hashing protects user credentials.
- **How FridgePolice uses it:** When a user registers (`POST /api/auth/register`), `bcryptjs.hash(password, 10)` generates a salted hash with 10 rounds of key stretching. When logging in, `bcryptjs.compare(password, user.passwordHash)` checks if the entered password matches the stored hash in constant time to prevent timing attacks.

---

### Concept 3: Role-Based Authorization (RBAC)
- **What it means:** Restricting actions on resources based on the specific role assigned to a user within a group.
- **Why we used it:** In a shared fridge, regular flatmates should be able to request food, but only fridge managers should be able to approve requests, change settings, or discard items.
- **How FridgePolice uses it:** Every user enrolled in a fridge has a role in the `FridgeMember` table: `OWNER`, `ADMIN`, or `MEMBER`. The `authorizeFridge(["OWNER", "ADMIN"])` middleware queries this table and blocks unauthorized actions with `HTTP 403 Forbidden`.

---

### Concept 4: Request Validation with Zod
- **What it means:** Schema validation validates incoming data types and formats before any business logic or database queries run.
- **Why we used it:** Without validation, bad inputs (negative numbers, empty strings, malformed emails) could crash the server or corrupt database records.
- **How FridgePolice uses it:** We define declarative schemas in `server/src/validators/`. For example, `createItemSchema` ensures that `quantity` is a positive number and `name` is a non-empty string. If validation fails, Zod throws an error that our centralized error handler formats into a clean `HTTP 400 Bad Request` with field-level error messages.

---

### Concept 5: Express Middleware
- **What it means:** Middleware functions sit in the request-response cycle, receiving `(req, res, next)`. They can inspect, modify, pass along (`next()`), or reject requests.
- **Why we used it:** To avoid duplicating common code (like token verification, security headers, and error handling) in every single route handler.
- **How FridgePolice uses it:**
  - `authenticate.js`: Checks the Bearer token and attaches `req.user`.
  - `authorizeFridge.js`: Checks fridge role permissions and attaches `req.fridgeRole`.
  - `errorHandler.js`: Catches errors passed to `next(err)` and returns consistent JSON errors.

---

### Concept 6: REST API Design & HTTP Status Codes
- **What it means:** REST is an architectural style using standard HTTP verbs (`GET`, `POST`, `PATCH`, `DELETE`) on resource-oriented URLs, returning standardized HTTP status codes.
- **Why we used it:** It provides a clear, predictable interface for frontend and backend communication.
- **How FridgePolice uses it:**
  - `POST /api/fridges/:id/items` $\to$ `201 Created`
  - `GET /api/fridges/:id/items` $\to$ `200 OK`
  - `PATCH /api/fridges/:id/items/:itemId` $\to$ `200 OK`
  - `DELETE /api/fridges/:id/items/:itemId` $\to$ `200 OK`
  - Validation errors $\to$ `400 Bad Request`
  - Missing/invalid token $\to$ `401 Unauthorized`
  - Missing permissions $\to$ `403 Forbidden`
  - Resource not found $\to$ `404 Not Found`
  - Duplicate email or stock shortage $\to$ `409 Conflict`
  - Unhandled server failure $\to$ `500 Internal Server Error`

---

### Concept 7: React State Management (`useState`)
- **What it means:** A React hook that stores component data and triggers a re-render whenever the data changes.
- **Why we used it:** To make the user interface reactive to user actions without manual DOM manipulation.
- **How FridgePolice uses it:** In `src/App.jsx`, `useState` tracks `user`, `token`, `activeFridgeId`, and `currentView` (switching views between `home`, `inventory`, `requests`, `members`, `discover`, and `settings`).

---

### Concept 8: React Side Effects (`useEffect`)
- **What it means:** A React hook that runs asynchronous code (like fetching data) after a component renders.
- **Why we used it:** To synchronize our frontend components with the backend API.
- **How FridgePolice uses it:** In `HomeDashboard.jsx` and `MyRequests.jsx`, `useEffect` calls `loadDashboard()` or `loadRequests()` whenever the active fridge changes, updating state when the API response arrives.

---

### Concept 9: Controlled Form Inputs
- **What it means:** Form elements whose values are controlled directly by React state rather than the browser DOM.
- **Why we used it:** It enables instant client-side validation, prevents invalid submissions, and keeps form values predictable.
- **How FridgePolice uses it:** In the login and item creation modals, each `<input>` has `value={formData.email}` and `onChange={handleChange}` updating state on every keystroke.

---

### Concept 10: Relational Database Design & Foreign Keys
- **What it means:** Organizing data into tables where rows are related to one another through primary keys and foreign keys.
- **Why we used it:** To enforce relational integrity and prevent orphan records (for example, food items existing without a fridge).
- **How FridgePolice uses it:** `FoodItem` has a foreign key `fridgeId` referencing `Fridge.id`. If a fridge is deleted, `onDelete: Cascade` automatically deletes all its food items.

---

### Concept 11: Database Transactions (`prisma.$transaction`)
- **What it means:** A transaction executes multiple database queries as a single atomic unit of work: all queries succeed together, or all fail and roll back.
- **Why we used it:** To guarantee that database updates never leave the system in an inconsistent, half-finished state.
- **How FridgePolice uses it:** When completing a food request, a transaction decrements `FoodItem.quantity`, updates `FoodRequest.status` to `COMPLETED`, and writes an `ActivityLog` entry. If any step fails, all changes are rolled back.

---

### Concept 12: Row-Level Locking (`SELECT ... FOR UPDATE`)
- **What it means:** A database lock placed on a specific row that prevents any other concurrent transaction from reading or modifying that row until the locking transaction finishes.
- **Why we used it:** To prevent race conditions where two concurrent requests check available stock at the same time and both think there is enough food.
- **How FridgePolice uses it:** In `approveRequest`, we run:
  ```sql
  SELECT id FROM "FoodItem" WHERE id = :id FOR UPDATE;
  ```
  This locks the food item row, reads its current stock, checks all active unexpired reservations, and ensures stock is sufficient before committing the approval.

---

### Concept 13: Serializable Transaction Isolation
- **What it means:** The highest SQL transaction isolation level, guaranteeing that concurrent transactions execute with the exact same result as if they ran strictly one after another.
- **Why we used it:** It eliminates dirty reads, non-repeatable reads, and phantom reads during concurrent approvals.
- **How FridgePolice uses it:** `approveRequest` runs inside `{ isolationLevel: "Serializable" }`. If two transactions conflict, PostgreSQL throws code `P2034`, which our service automatically catches and retries up to 3 times.

---

### Concept 14: Lazy Reservation Expiry
- **What it means:** Instead of running a background cron worker or timer thread, expiration checks are evaluated on-demand whenever data is queried.
- **Why we used it:** Background workers on free serverless cloud hosts can go to sleep or suffer cold-start delays. Lazy checking guarantees that no user ever observes an expired reservation.
- **How FridgePolice uses it:** `expireOverdueReservations(fridgeId)` is called before listing, viewing, approving, or completing requests. It finds all requests where `status = "APPROVED"` and `expiresAt <= NOW()`, marks them `EXPIRED`, and releases their reserved quantity back into available stock.

---

### Concept 15: Vercel API Rewrites (Reverse Proxy)
- **What it means:** A web server rule that forwards requests matching a path pattern to a different destination server behind the scenes.
- **Why we used it:** It allows the frontend to call `/api/*` directly on the Vercel domain while Vercel forwards the requests to the Render backend.
- **How FridgePolice uses it:** `vercel.json` configures:
  ```json
  {
    "rewrites": [
      {
        "source": "/api/:path*",
        "destination": "https://fridge-police.onrender.com/api/:path*"
      }
    ]
  }
  ```
  Browser requests remain same-origin, eliminating the need for CORS headers and avoiding mixed-content warnings.

---

## 2. Project Codebase Directory Structure

```
fridge-police/
|-- README.md                    # Main project overview and setup guide
|-- PRD.md                       # Product requirements and user workflows
|-- HLD.md                       # High-level architecture and component design
|-- LLD.md                       # Low-level design, database schema, and APIs
|-- vercel.json                  # Reverse proxy rewrite from Vercel to Render backend
|-- package.json                 # Frontend dependencies (React 19, Vite 8, Oxlint)
|-- vite.config.js               # Vite development server config with local /api proxy
|-- docs/
|   `-- TECHNICAL_DOCUMENTATION.md # This viva and technical guide
|-- src/                         # Frontend Application Source Code
|   |-- main.jsx                 # React root entry point
|   |-- App.jsx                  # Main view router, state coordinator, toast alerts
|   |-- App.css / index.css      # CSS design tokens, typography, dark mode rules
|   |-- components/
|   |   |-- HomeDashboard.jsx    # Overview dashboard, stats cards, quick item view
|   |   |-- MyFridges.jsx        # Multi-fridge switcher and role badge
|   |   |-- MyRequests.jsx       # Tabbed request view (My Requests vs To Review)
|   |   |-- Discover.jsx         # Public community fridge directory & join modal
|   |   |-- ActivityFeed.jsx     # Chronological audit timeline component
|   |   |-- Settings.jsx         # Fridge privacy and join permissions settings
|   |   |-- Navigation.jsx       # Sidebar, profile badge, dark mode toggle
|   |   |-- CreateFridgeModal.jsx# Modal to provision new fridge workspace
|   |   `-- Icons.jsx            # SVG icon components
|   `-- lib/
|       `-- api.js               # Reusable fetch client with auth token injection
`-- server/                      # Backend Application Source Code
    |-- package.json             # Backend dependencies (Express 5, Prisma 7, Zod, bcrypt)
    |-- prisma.config.ts         # Prisma 7 configuration file
    |-- prisma/
    |   |-- schema.prisma        # Relational schema definition (PostgreSQL)
    |   `-- migrations/          # Chronological SQL migration files
    |-- src/
    |   |-- server.js            # Entry point: checks JWT_SECRET and starts listener
    |   |-- app.js               # Express application pipeline & security headers
    |   |-- lib/
    |   |   `-- prisma.js        # Prisma client singleton with adapter-pg
    |   |-- middleware/
    |   |   |-- authenticate.js  # JWT Bearer token verification
    |   |   |-- authorizeFridge.js # Per-fridge role check (RBAC)
    |   |   |-- errorHandler.js  # Centralized error handler
    |   |   `-- notFound.js      # 404 handler for unknown routes
    |   |-- routes/
    |   |   |-- auth.routes.js   # /api/auth routes (register, login, me)
    |   |   |-- fridge.routes.js # /api/fridges routes
    |   |   |-- inventory.routes.js # /api/fridges/:id/items routes
    |   |   |-- request.routes.js# /api/fridges/:id/requests routes
    |   |   |-- discover.routes.js # /api/discover/fridges routes
    |   |   |-- user.routes.js   # /api/users routes (dashboard, my requests)
    |   |   `-- health.routes.js # /api/health liveness probe
    |   |-- controllers/
    |   |   |-- auth.controller.js
    |   |   |-- fridge.controller.js
    |   |   |-- inventory.controller.js
    |   |   |-- request.controller.js
    |   |   `-- health.controller.js
    |   |-- services/
    |   |   |-- auth.service.js
    |   |   |-- fridge.service.js
    |   |   |-- inventory.service.js
    |   |   `-- request.service.js
    |   |-- utils/
    |   |   `-- token.js         # signToken & verifyToken helpers
    |   `-- validators/
    |       |-- auth.validator.js
    |       |-- fridge.validator.js
    |       |-- inventory.validator.js
    |       `-- request.validator.js
    `-- tests/                   # Automated Integration Tests
        |-- auth.test.mjs
        |-- discovery-and-membership.test.mjs
        |-- email-validation.test.mjs
        |-- inventory.test.mjs
        |-- request.test.mjs
        `-- security.test.mjs
```

---

## 3. Frontend Implementation Details

### State-Based View Switching (No External Router Needed)
Instead of adding heavy external routing dependencies, `src/App.jsx` uses a simple state variable:
```javascript
const [currentView, setCurrentView] = useState("home");
```
When the user clicks a navigation link in `Navigation.jsx`, `setCurrentView("inventory")` updates the state, and `App.jsx` conditionally renders `<HomeDashboard />`, `<MyRequests />`, or `<Discover />`.

### Centralized API Client (`src/lib/api.js`)
All HTTP calls pass through `apiRequest(path, options)`:
- Sets `Content-Type: application/json`.
- Automatically attaches `Authorization: Bearer ${token}` if a token exists in `sessionStorage`.
- Automatically catches `401 Unauthorized` responses, clears the invalid token, and prompts the user to log in again.
- Formats Zod validation errors into accessible field error lists for display in forms.

---

## 4. Backend Implementation Details

### Layered Separation of Concerns
1. **Routes (`routes/*.routes.js`):** Defines the URL path, HTTP method, and middleware chain.
2. **Middleware (`middleware/*.js`):** Enforces JWT authentication and fridge membership/role checks.
3. **Controllers (`controllers/*.controller.js`):** Parses parameters, calls Zod schemas (`.parse()`), and invokes services.
4. **Services (`services/*.service.js`):** Implements business logic, concurrency control, and database transactions.
5. **Database (`lib/prisma.js`):** Reusable Prisma client configured with Neon PostgreSQL connection pooling.

---

## 5. Database & Concurrency Design

### Prisma Schema Entities
- **`User`**: `id`, `name`, `email` (unique), `passwordHash`, timestamps.
- **`Fridge`**: `id`, `name`, `description`, `isDiscoverable`, `publicFoodPreview`, `acceptJoinRequests`, `publicDescription` (up to 1,000 characters), `showMemberCount`.
- **`FridgeMember`**: `userId`, `fridgeId`, `role` (`OWNER`, `ADMIN`, `MEMBER`), `joinedAt`.
- **`FoodItem`**: `id`, `fridgeId`, `name`, `category`, `quantity` (`Decimal(10, 2)`), `unit`, `expiryDate`, `notes`, `createdById`.
- **`FoodRequest`**: `id`, `foodItemId`, `requesterId`, `requestedQuantity`, `status` (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `EXPIRED`, `COMPLETED`), `note`, `approvedById`, `expiresAt`, `decidedAt`.
- **`MembershipRequest`**: `id`, `fridgeId`, `userId`, `status` (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`), `note`, `decidedById`.
- **`ActivityLog`**: `id`, `fridgeId`, `actorId`, `action`, `entityType`, `entityId`, `details` (JSON), `createdAt`.

---

## 6. Testing Approach (66 Integration Tests)

We verify our backend logic with 66 automated integration tests using Node.js's native test runner (`node --test tests/**/*.mjs`):

1. **`auth.test.mjs` (14 tests):** Tests user registration, duplicate email rejection (HTTP 409), password hashing, login token generation, invalid password rejection, and role enforcement.
2. **`email-validation.test.mjs` (11 tests):** Tests RFC email validation, uppercase-to-lowercase normalization, dots, plus signs, whitespace trimming, and minimum 8-character password length.
3. **`inventory.test.mjs` (14 tests):** Tests creating items, non-member denial, owner/admin permissions, decimal quantities, pagination, search filtering, and deletion activity logs.
4. **`request.test.mjs` (15 tests):** Tests submitting portion requests, approving, rejecting, cancelling, completing consumption, 24-hour expiration freeing stock, and concurrent approvals preventing overbooking.
5. **`discovery-and-membership.test.mjs` (5 tests):** Tests public fridge directory filtering, join request creation, and approval adding members.
6. **`security.test.mjs` (7 tests):** Tests multi-tenant isolation (user cannot read or edit another fridge's items), malformed token rejection, and transaction rollback on error.

To run tests:
```bash
cd server
npm test
```

---

## 7. Deployment & Reverse Proxy Setup

### Vercel (Frontend)
- Continuous deployment from the `main` branch.
- Build command: `npm run build` (`vite build`).
- Output directory: `dist/`.
- Reverse proxy rule in `vercel.json`:
  ```json
  {
    "rewrites": [
      {
        "source": "/api/:path*",
        "destination": "https://fridge-police.onrender.com/api/:path*"
      }
    ]
  }
  ```

### Render (Backend)
- Deployed as a Node Web Service.
- Root directory: `server`.
- Build command: `npm install && npm run db:generate`.
- Start command: `npm start`.
- Binds to host `0.0.0.0` and port `process.env.PORT`.
- Liveness health check: `/api/health`.

### Neon (PostgreSQL Database)
- `DATABASE_URL`: Pooled connection string using PgBouncer for high-concurrency runtime queries.
- `DATABASE_URL_UNPOOLED`: Direct connection string for Prisma migrations (`npx prisma migrate deploy`).

---

## 8. Frequently Asked Viva Questions & Model Answers

### Q1: What is the main problem FridgePolice solves?
**Answer:** It coordinates shared refrigerator usage in shared apartments and student hostels. It provides clear visibility into what food is available, enables fair portion requests, prevents two people from claiming the same food using database row locking, automatically releases forgotten reservations after 24 hours, and keeps an activity log when food is eaten offline.

### Q2: How does FridgePolice prevent two people from taking the last item simultaneously?
**Answer:** In `approveRequest`, we start a database transaction with `Serializable` isolation and issue a row lock: `SELECT id FROM "FoodItem" WHERE id = :id FOR UPDATE`. This locks the food item row. We then calculate `Available = Total Quantity - Active Approved Reservations`. If the requested amount is greater than available stock, the approval is rejected with `HTTP 409 Conflict`. If a serialization conflict occurs, our backend retries up to 3 times before failing safely.

### Q3: Why does your application use Vercel rewrites instead of CORS headers?
**Answer:** Because the frontend calls `/api/*` on `https://fridge-police.vercel.app`, Vercel's edge network proxies the request directly to Render behind the scenes. From the browser's view, all requests are strictly same-origin. This avoids CORS preflight requests, eliminates cross-origin header issues, and ensures authentication headers are forwarded securely.

### Q4: How is reservation expiration handled? Is there a cron job?
**Answer:** No background cron job is needed. We use lazy evaluation. Whenever requests are listed, viewed, approved, or completed, `expireOverdueReservations()` runs first. It queries requests with `status = "APPROVED"` where `expiresAt <= NOW()`, updates their status to `EXPIRED`, and logs the event. This guarantees that no user ever sees or is blocked by an expired reservation, without wasting server resources on idle polling.

### Q5: How do you handle password security?
**Answer:** Passwords are never stored in plaintext. During registration, we use `bcryptjs` with 10 salt rounds to hash the password before saving it to PostgreSQL. When logging in, `bcryptjs.compare` verifies the entered password against the stored hash in constant time.
