# FridgePolice — Low-Level Design (LLD)

**Project Name:** FridgePolice
**Document Version:** 2.0 (Viva Edition)
**Target Audience:** Students, Viva Examiners, Backend Engineers
**Repository:** [https://github.com/bhavanaaa-1/fridge-police](https://github.com/bhavanaaa-1/fridge-police)

---

## 1. Database Schema & Relational Design

The database uses PostgreSQL 16 hosted on Neon and managed via Prisma ORM (`server/prisma/schema.prisma`).

```mermaid
erDiagram
    User ||--o{ FridgeMember : "has memberships"
    User ||--o{ FoodItem : "created items"
    User ||--o{ FoodRequest : "submitted requests"
    User ||--o{ FoodRequest : "approved requests"
    User ||--o{ MembershipRequest : "submitted join requests"
    User ||--o{ ActivityLog : "performed actions"

    Fridge ||--o{ FridgeMember : "enrolled members"
    Fridge ||--o{ FoodItem : "contains food"
    Fridge ||--o{ MembershipRequest : "receives applications"
    Fridge ||--o{ ActivityLog : "logs events"

    FoodItem ||--o{ FoodRequest : "portion requests"

    User {
        String id PK "cuid()"
        String name
        String email UK "unique"
        String passwordHash
        DateTime createdAt
        DateTime updatedAt
    }

    Fridge {
        String id PK "cuid()"
        String name
        String description
        Boolean isDiscoverable "default: false"
        Boolean publicFoodPreview "default: false"
        Boolean acceptJoinRequests "default: false"
        String publicDescription "max 1000 chars"
        Boolean showMemberCount "default: false"
        DateTime createdAt
        DateTime updatedAt
    }

    FridgeMember {
        String userId PK, FK "references User.id"
        String fridgeId PK, FK "references Fridge.id"
        FridgeRole role "OWNER, ADMIN, MEMBER"
        DateTime joinedAt
    }

    FoodItem {
        String id PK "cuid()"
        String fridgeId FK "references Fridge.id"
        String name
        String category
        Decimal quantity "Decimal(10, 2)"
        String unit
        DateTime expiryDate
        String notes
        String createdById FK "references User.id"
        DateTime createdAt
        DateTime updatedAt
    }

    FoodRequest {
        String id PK "cuid()"
        String foodItemId FK "references FoodItem.id"
        String requesterId FK "references User.id"
        Decimal requestedQuantity "Decimal(10, 2)"
        RequestStatus status "PENDING, APPROVED, REJECTED, CANCELLED, EXPIRED, COMPLETED"
        String note
        String approvedById FK "references User.id"
        DateTime expiresAt "Set to +24h on approval"
        DateTime decidedAt
        DateTime createdAt
        DateTime updatedAt
    }

    MembershipRequest {
        String id PK "cuid()"
        String fridgeId FK "references Fridge.id"
        String userId FK "references User.id"
        MembershipRequestStatus status "PENDING, APPROVED, REJECTED, CANCELLED"
        String note
        String decidedById FK "references User.id"
        DateTime decidedAt
        DateTime createdAt
        DateTime updatedAt
    }

    ActivityLog {
        String id PK "cuid()"
        String fridgeId FK "references Fridge.id"
        String actorId FK "references User.id"
        String action
        String entityType
        String entityId
        Json details
        DateTime createdAt
    }
```

### 1.1 Database Models Explained

| Model | Purpose | Primary Key | Foreign Keys & Cascades |
| :--- | :--- | :--- | :--- |
| **`User`** | Stores user identity, login credentials, and timestamps. | `id` (CUID) | - |
| **`Fridge`** | Represents an isolated fridge workspace and its privacy settings. | `id` (CUID) | - |
| **`FridgeMember`** | Join table linking users to fridges with a specific role (`OWNER`, `ADMIN`, `MEMBER`). | Composite `[userId, fridgeId]` | `userId` $\to$ `User.id` (`onDelete: Cascade`)<br/>`fridgeId` $\to$ `Fridge.id` (`onDelete: Cascade`) |
| **`FoodItem`** | Individual food inventory records with quantity, unit, and optional expiry date. | `id` (CUID) | `fridgeId` $\to$ `Fridge.id` (`onDelete: Cascade`)<br/>`createdById` $\to$ `User.id` (`onDelete: Restrict`) |
| **`FoodRequest`** | State-tracked requests for food portions. Belongs directly to `FoodItem` and `User`. Scoped to a fridge via `FoodItem.fridgeId`. | `id` (CUID) | `foodItemId` $\to$ `FoodItem.id` (`onDelete: Cascade`)<br/>`requesterId` $\to$ `User.id` (`onDelete: Cascade`)<br/>`approvedById` $\to$ `User.id` (`onDelete: SetNull`) |
| **`MembershipRequest`** | Requests from users wanting to join an open fridge. | `id` (CUID) | `fridgeId` $\to$ `Fridge.id` (`onDelete: Cascade`)<br/>`userId` $\to$ `User.id` (`onDelete: Cascade`)<br/>`decidedById` $\to$ `User.id` (`onDelete: SetNull`) |
| **`ActivityLog`** | Chronological audit logs of actions taken within a fridge. | `id` (CUID) | `fridgeId` $\to$ `Fridge.id` (`onDelete: Cascade`)<br/>`actorId` $\to$ `User.id` (`onDelete: SetNull`) |

---

## 2. API Endpoints Reference

All API routes live under the `/api` prefix:

### 2.1 Authentication Routes (`server/src/routes/auth.routes.js`)

| Method | Endpoint | Auth Required | Role Required | Request Body | Success Response | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | None | None | `{ name, email, password }` | `{ success: true, user: { id, name, email } }` | `201`, `400`, `409` |
| `POST` | `/api/auth/login` | None | None | `{ email, password }` | `{ success: true, token, user }` | `200`, `400`, `401` |
| `GET` | `/api/auth/me` | Bearer JWT | None | None | `{ success: true, user }` | `200`, `401` |

### 2.2 Fridge Routes (`server/src/routes/fridge.routes.js`)

| Method | Endpoint | Auth Required | Role Required | Description | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/fridges` | Bearer JWT | None | Creates a new fridge; caller becomes `OWNER`. | `201`, `400`, `401` |
| `GET` | `/api/fridges` | Bearer JWT | None | Lists all fridges the user belongs to. | `200`, `401` |
| `GET` | `/api/fridges/:fridgeId` | Bearer JWT | `MEMBER`, `ADMIN`, `OWNER` | Gets single fridge details. | `200`, `401`, `403`, `404` |
| `PATCH` | `/api/fridges/:fridgeId/settings`| Bearer JWT | `ADMIN`, `OWNER` | Updates fridge privacy and settings. | `200`, `400`, `401`, `403` |
| `GET` | `/api/fridges/:fridgeId/members` | Bearer JWT | `MEMBER`, `ADMIN`, `OWNER` | Lists enrolled fridge members. | `200`, `401`, `403` |
| `POST` | `/api/fridges/:fridgeId/members` | Bearer JWT | `OWNER` | Adds member directly by email. | `201`, `400`, `401`, `403`, `404` |
| `GET` | `/api/fridges/:fridgeId/activity`| Bearer JWT | `MEMBER`, `ADMIN`, `OWNER` | Returns paginated activity log. | `200`, `400`, `401`, `403` |
| `POST` | `/api/fridges/:fridgeId/join-requests` | Bearer JWT | Any logged-in user | Submits request to join fridge. | `201`, `400`, `401`, `409` |
| `GET` | `/api/fridges/:fridgeId/join-requests` | Bearer JWT | `ADMIN`, `OWNER` | Lists incoming join requests. | `200`, `401`, `403` |
| `PATCH` | `/api/fridges/:fridgeId/join-requests/:requestId/approve` | Bearer JWT | `ADMIN`, `OWNER` | Approves join request, creates member. | `200`, `401`, `403` |
| `PATCH` | `/api/fridges/:fridgeId/join-requests/:requestId/reject` | Bearer JWT | `ADMIN`, `OWNER` | Rejects join request. | `200`, `401`, `403` |

### 2.3 Inventory Routes (`server/src/routes/inventory.routes.js`)

| Method | Endpoint | Auth Required | Role Required | Description | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/fridges/:fridgeId/items` | Bearer JWT | `MEMBER`, `ADMIN`, `OWNER` | Lists items with search and category filters. | `200`, `400`, `401`, `403` |
| `GET` | `/api/fridges/:fridgeId/items/:itemId` | Bearer JWT | `MEMBER`, `ADMIN`, `OWNER` | Retrieves single food item details. | `200`, `401`, `403`, `404` |
| `POST` | `/api/fridges/:fridgeId/items` | Bearer JWT | `ADMIN`, `OWNER` | Adds new food item to inventory. | `201`, `400`, `401`, `403` |
| `PATCH` | `/api/fridges/:fridgeId/items/:itemId` | Bearer JWT | `ADMIN`, `OWNER` | Reconciles quantity or edits item. | `200`, `400`, `401`, `403`, `404` |
| `DELETE` | `/api/fridges/:fridgeId/items/:itemId` | Bearer JWT | `ADMIN`, `OWNER` | Deletes/discards food item. | `200`, `401`, `403`, `404` |

### 2.4 Food Request Routes (`server/src/routes/request.routes.js`)

| Method | Endpoint | Auth Required | Role Required | Description | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/fridges/:fridgeId/requests` | Bearer JWT | `MEMBER`, `ADMIN`, `OWNER` | Requests a portion of food. | `201`, `400`, `401`, `403`, `404` |
| `GET` | `/api/fridges/:fridgeId/requests` | Bearer JWT | `MEMBER`, `ADMIN`, `OWNER` | Lists requests with status filter. | `200`, `400`, `401`, `403` |
| `GET` | `/api/fridges/:fridgeId/requests/:requestId` | Bearer JWT | `MEMBER`, `ADMIN`, `OWNER` | Gets details for a single request. | `200`, `401`, `403`, `404` |
| `PATCH` | `/api/fridges/:fridgeId/requests/:requestId/cancel` | Bearer JWT | Requester or `ADMIN`/`OWNER` | Cancels a pending request. | `200`, `401`, `403`, `404`, `409` |
| `PATCH` | `/api/fridges/:fridgeId/requests/:requestId/approve`| Bearer JWT | `ADMIN`, `OWNER` | Approves request with row lock. | `200`, `401`, `403`, `404`, `409` |
| `PATCH` | `/api/fridges/:fridgeId/requests/:requestId/reject` | Bearer JWT | `ADMIN`, `OWNER` | Rejects a pending request. | `200`, `401`, `403`, `404`, `409` |
| `PATCH` | `/api/fridges/:fridgeId/requests/:requestId/complete`| Bearer JWT | `ADMIN`, `OWNER` | Completes request & reduces stock. | `200`, `401`, `403`, `404`, `409` |

### 2.5 Discovery & User Routes
- `GET /api/discover/fridges`: Public search for discoverable fridges.
- `GET /api/discover/fridges/:fridgeId`: Public view of a single discoverable fridge (food preview if enabled).
- `GET /api/users/me/dashboard`: Summary stats across all user's fridges.
- `GET /api/users/me/requests`: Requests submitted by user and requests awaiting user's review.
- `GET /api/health`: Health probe returning `{"success": true, "message": "FridgePolice API is running!"}`.

---

## 3. Middleware Architecture

The backend request pipeline uses dedicated Express middlewares in `server/src/middleware/`:

### 3.1 Authentication Middleware (`authenticate.js`)
- Reads the `Authorization` header.
- Checks that the format is `Bearer <token>`.
- Calls `verifyToken(token)` using the `JWT_SECRET`.
- Attaches the decoded user ID to `req.user = { id: payload.sub }`.
- Returns `HTTP 401 Unauthorized` if token is missing, expired, or invalid.

### 3.2 Optional Authentication Middleware (`optionalAuthenticate`)
- Used on public endpoints (e.g. `GET /api/discover/fridges/:fridgeId`).
- If a valid token is provided, populates `req.user`. If not, sets `req.user = null` and proceeds without blocking.

### 3.3 Role-Based Authorization Middleware (`authorizeFridge.js`)
- Factory function: `authorizeFridge(["OWNER", "ADMIN"])`.
- Looks up the user's membership in the target fridge from `FridgeMember`.
- If the user is not a member or does not have one of the allowed roles, rejects with `HTTP 403 Forbidden`.
- Attaches the resolved role to `req.fridgeRole` for downstream route handlers.

### 3.4 Centralized Error Handler (`errorHandler.js`)
- Registered last in `server/src/app.js`.
- Automatically formats Zod validation errors into `HTTP 400 Bad Request` with an array of field errors.
- Handles custom HTTP errors via `err.status` or `err.statusCode`.
- Handles unexpected errors by logging the stack trace internally while returning a safe `HTTP 500 Internal server error` to clients.

---

## 4. Input Validation with Zod

All input data is validated before touching the database or running domain logic:

```javascript
// Example from server/src/validators/inventory.validator.js
const positiveQuantity = z
  .number({ invalid_type_error: "Quantity must be a number" })
  .positive("Quantity must be greater than zero");

export const createItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  category: z.string().trim().min(1).optional(),
  quantity: positiveQuantity,
  unit: z.string().trim().min(1, "Unit is required"),
  expiryDate: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
});
```

- String fields are trimmed automatically.
- Numbers are validated as strictly positive numbers (`> 0`).
- Emails are normalized to lowercase and validated with RFC email format.
- Dates are safely coerced from ISO strings.
- Passwords require a minimum length of 8 characters.

---

## 5. Food Request Lifecycle & Concurrency Locking

```mermaid
stateDiagram-v2
    [*] --> PENDING : Member submits request
    PENDING --> REJECTED : Admin rejects
    PENDING --> CANCELLED : Requester or Admin cancels
    PENDING --> APPROVED : Admin approves (Row Lock Acquired)
    APPROVED --> EXPIRED : 24 Hours Pass Unconsumed (Lazy Check)
    APPROVED --> COMPLETED : Admin confirms physical pickup
    REJECTED --> [*]
    CANCELLED --> [*]
    EXPIRED --> [*]
    COMPLETED --> [*]
```

### 5.1 Concurrency Locking Implementation (`approveRequest` in `request.service.js`)

When an Admin approves a food request, the system must guarantee that two admins approving different requests at the exact same time do not over-allocate the available food:

```javascript
// In server/src/services/request.service.js
export async function approveRequest(fridgeId, requestId, userId) {
  // 1. Run lazy expiration to sweep away any expired reservations first (on-demand, no cron)
  await expireOverdueReservations(fridgeId);

  const attemptApproval = async () => {
    return prisma.$transaction(
      async (tx) => {
        // 2. Fetch the request
        const request = await tx.foodRequest.findFirst({ ... });
        if (request.status !== "PENDING") {
          throw new Error("Only pending requests can be approved");
        }

        // 3. Acquire exclusive row lock on the target FoodItem
        // Blocks conflicting updates, deletes, and locks; ordinary SELECT reads still permitted
        await tx.$queryRaw`SELECT id FROM "FoodItem" WHERE id = ${request.foodItemId} FOR UPDATE`;

        // 4. Fetch the locked item's total quantity
        const lockedItem = await tx.foodItem.findUnique({
          where: { id: request.foodItemId },
          select: { quantity: true },
        });

        // 5. Aggregate all active, unexpired approved reservations
        const activeReservations = await tx.foodRequest.findMany({
          where: {
            foodItemId: request.foodItemId,
            status: "APPROVED",
            expiresAt: { gt: new Date() },
            id: { not: requestId },
          },
          select: { requestedQuantity: true },
        });

        const reserved = activeReservations.reduce(
          (sum, r) => sum.plus(r.requestedQuantity),
          new Prisma.Decimal(0)
        );

        // 6. Calculate available stock
        const available = lockedItem.quantity.minus(reserved);

        // 7. Enforce availability
        if (request.requestedQuantity.greaterThan(available)) {
          const error = new Error("Insufficient stock to approve this request");
          error.status = 409;
          throw error;
        }

        // 8. Update request status to APPROVED and start 24h lease
        const updated = await tx.foodRequest.update({
          where: { id: requestId },
          data: {
            status: "APPROVED",
            approvedById: userId,
            decidedAt: new Date(),
            expiresAt: new Date(Date.now() + RESERVATION_DURATION_MS),
          },
        });

        // 9. Write audit record
        await tx.activityLog.create({
          data: {
            fridgeId,
            actorId: userId,
            action: "FOOD_REQUEST_APPROVED",
            entityType: "FoodRequest",
            entityId: requestId,
            details: { requestedQuantity: request.requestedQuantity.toString() },
          },
        });

        return updated;
      },
      { isolationLevel: "Serializable" }
    );
  };

  // 10. Automatically retry up to 3 times on PostgreSQL serialization conflicts
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await attemptApproval();
    } catch (error) {
      if (error?.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
}
```

---

## 6. Physical Inventory Reconciliation

When groceries are eaten without using the app, or an egg breaks, or milk spoils, the recorded numbers need to be updated:

1. **Quantity Update (`updateItem` in `inventory.service.js`):**
   - Executed inside `prisma.$transaction`.
   - Modifies `FoodItem.quantity` directly.
   - Emits an `INVENTORY_ITEM_UPDATED` record into `ActivityLog`, noting which fields were changed.
2. **Item Deletion (`deleteItem` in `inventory.service.js`):**
   - Executed inside `prisma.$transaction`.
   - Deletes the `FoodItem` row from the database.
   - Emits an `INVENTORY_ITEM_DELETED` record into `ActivityLog` with the item's name and last known quantity.
