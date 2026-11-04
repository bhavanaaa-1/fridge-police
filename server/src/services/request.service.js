import prisma from "../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.ts";

const RESERVATION_DURATION_MS = 24 * 60 * 60 * 1000;

const safeRequestSelect = {
  id: true,
  foodItemId: true,
  requesterId: true,
  requestedQuantity: true,
  status: true,
  note: true,
  approvedById: true,
  expiresAt: true,
  decidedAt: true,
  createdAt: true,
  updatedAt: true,
  foodItem: {
    select: {
      id: true,
      name: true,
      fridgeId: true,
      quantity: true,
      unit: true,
    },
  },
  requester: {
    select: { id: true, name: true, email: true },
  },
};

// Expire overdue approved reservations. Returns number expired.
export async function expireOverdueReservations(fridgeId = null) {
  const where = {
    status: "APPROVED",
    expiresAt: { lte: new Date() },
  };

  if (fridgeId) {
    where.foodItem = { fridgeId };
  }

  const overdue = await prisma.foodRequest.findMany({
    where,
    select: { id: true, foodItem: { select: { fridgeId: true } } },
  });

  if (overdue.length === 0) return 0;

  let expiredCount = 0;

  for (const request of overdue) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.foodRequest.updateMany({
        where: {
          id: request.id,
          status: "APPROVED",
          expiresAt: { lte: new Date() },
        },
        data: {
          status: "EXPIRED",
          decidedAt: new Date(),
        },
      });

      if (updated.count === 0) return;

      await tx.activityLog.create({
        data: {
          fridgeId: request.foodItem.fridgeId,
          actorId: null,
          action: "FOOD_REQUEST_EXPIRED",
          entityType: "FoodRequest",
          entityId: request.id,
          details: {},
        },
      });

      expiredCount += 1;
    });
  }

  return expiredCount;
}

export async function createRequest(fridgeId, userId, data) {
  const foodItem = await prisma.foodItem.findFirst({
    where: { id: data.foodItemId, fridgeId },
  });

  if (!foodItem) {
    const error = new Error("Food item not found in this fridge");
    error.status = 404;
    throw error;
  }

  if (data.requestedQuantity > Number(foodItem.quantity)) {
    const error = new Error("Requested quantity exceeds available stock");
    error.status = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const request = await tx.foodRequest.create({
      data: {
        foodItemId: data.foodItemId,
        requesterId: userId,
        requestedQuantity: data.requestedQuantity,
        status: "PENDING",
        note: data.note,
      },
      select: safeRequestSelect,
    });

    await tx.activityLog.create({
      data: {
        fridgeId,
        actorId: userId,
        action: "FOOD_REQUEST_CREATED",
        entityType: "FoodRequest",
        entityId: request.id,
        details: {
          foodItemId: data.foodItemId,
          requestedQuantity: String(data.requestedQuantity),
        },
      },
    });

    return request;
  });
}

export async function listRequests(fridgeId, { status, foodItemId, requesterId, page, limit }) {
  await expireOverdueReservations(fridgeId);

  const where = {
    foodItem: { fridgeId },
  };

  if (status) where.status = status;
  if (foodItemId) where.foodItemId = foodItemId;
  if (requesterId) where.requesterId = requesterId;

  const skip = (page - 1) * limit;

  const [requests, total] = await Promise.all([
    prisma.foodRequest.findMany({
      where,
      select: safeRequestSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.foodRequest.count({ where }),
  ]);

  return {
    requests,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getRequest(fridgeId, requestId) {
  await expireOverdueReservations(fridgeId);

  return prisma.foodRequest.findFirst({
    where: {
      id: requestId,
      foodItem: { fridgeId },
    },
    select: safeRequestSelect,
  });
}

export async function approveRequest(fridgeId, requestId, userId) {
  await expireOverdueReservations(fridgeId);

  const attemptApproval = async () => {
    return prisma.$transaction(
      async (tx) => {
        const request = await tx.foodRequest.findFirst({
          where: {
            id: requestId,
            foodItem: { fridgeId },
          },
          select: {
            id: true,
            status: true,
            requestedQuantity: true,
            foodItemId: true,
            foodItem: { select: { id: true, quantity: true } },
          },
        });

        if (!request) {
          const error = new Error("Request not found");
          error.status = 404;
          throw error;
        }

        if (request.status !== "PENDING") {
          const error = new Error("Only pending requests can be approved");
          error.status = 409;
          throw error;
        }

        // Lock the food item row to prevent concurrent overbooking.
        await tx.$queryRaw`SELECT id FROM "FoodItem" WHERE id = ${request.foodItemId} FOR UPDATE`;

        const lockedItem = await tx.foodItem.findUnique({
          where: { id: request.foodItemId },
          select: { quantity: true },
        });

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

        const available = lockedItem.quantity.minus(reserved);

        if (request.requestedQuantity.greaterThan(available)) {
          const error = new Error("Insufficient stock to approve this request");
          error.status = 409;
          throw error;
        }

        const updated = await tx.foodRequest.update({
          where: { id: requestId },
          data: {
            status: "APPROVED",
            approvedById: userId,
            decidedAt: new Date(),
            expiresAt: new Date(Date.now() + RESERVATION_DURATION_MS),
          },
          select: safeRequestSelect,
        });

        await tx.activityLog.create({
          data: {
            fridgeId,
            actorId: userId,
            action: "FOOD_REQUEST_APPROVED",
            entityType: "FoodRequest",
            entityId: requestId,
            details: {
              requestedQuantity: request.requestedQuantity.toString(),
            },
          },
        });

        return updated;
      },
      { isolationLevel: "Serializable" }
    );
  };

  // Retry on serialization conflicts.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await attemptApproval();
    } catch (error) {
      if (error?.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
}

export async function rejectRequest(fridgeId, requestId, userId) {
  await expireOverdueReservations(fridgeId);

  const request = await prisma.foodRequest.findFirst({
    where: { id: requestId, foodItem: { fridgeId } },
    select: { id: true, status: true },
  });

  if (!request) {
    const error = new Error("Request not found");
    error.status = 404;
    throw error;
  }

  if (request.status !== "PENDING") {
    const error = new Error("Only pending requests can be rejected");
    error.status = 409;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.foodRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        decidedAt: new Date(),
      },
      select: safeRequestSelect,
    });

    await tx.activityLog.create({
      data: {
        fridgeId,
        actorId: userId,
        action: "FOOD_REQUEST_REJECTED",
        entityType: "FoodRequest",
        entityId: requestId,
        details: {},
      },
    });

    return updated;
  });
}

export async function cancelRequest(fridgeId, requestId, userId, isPrivileged) {
  await expireOverdueReservations(fridgeId);

  const request = await prisma.foodRequest.findFirst({
    where: { id: requestId, foodItem: { fridgeId } },
    select: { id: true, status: true, requesterId: true },
  });

  if (!request) {
    const error = new Error("Request not found");
    error.status = 404;
    throw error;
  }

  if (request.status !== "PENDING") {
    const error = new Error("Only pending requests can be cancelled");
    error.status = 409;
    throw error;
  }

  if (!isPrivileged && request.requesterId !== userId) {
    const error = new Error("You can only cancel your own requests");
    error.status = 403;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.foodRequest.update({
      where: { id: requestId },
      data: {
        status: "CANCELLED",
        decidedAt: new Date(),
      },
      select: safeRequestSelect,
    });

    await tx.activityLog.create({
      data: {
        fridgeId,
        actorId: userId,
        action: "FOOD_REQUEST_CANCELLED",
        entityType: "FoodRequest",
        entityId: requestId,
        details: {},
      },
    });

    return updated;
  });
}

export async function completeRequest(fridgeId, requestId, userId) {
  await expireOverdueReservations(fridgeId);

  const request = await prisma.foodRequest.findFirst({
    where: { id: requestId, foodItem: { fridgeId } },
    select: {
      id: true,
      status: true,
      requestedQuantity: true,
      foodItemId: true,
      expiresAt: true,
    },
  });

  if (!request) {
    const error = new Error("Request not found");
    error.status = 404;
    throw error;
  }

  if (request.status !== "APPROVED") {
    const error = new Error("Only approved requests can be completed");
    error.status = 409;
    throw error;
  }

  if (request.expiresAt && request.expiresAt <= new Date()) {
    // Mark expired if overdue.
    await prisma.foodRequest.update({
      where: { id: requestId },
      data: { status: "EXPIRED", decidedAt: new Date() },
    });
    const error = new Error("Reservation has expired");
    error.status = 409;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.foodItem.findUnique({
      where: { id: request.foodItemId },
      select: { quantity: true },
    });

    if (!item || item.quantity.lessThan(request.requestedQuantity)) {
      const error = new Error("Insufficient inventory to complete this request");
      error.status = 409;
      throw error;
    }

    await tx.foodItem.update({
      where: { id: request.foodItemId },
      data: {
        quantity: item.quantity.minus(request.requestedQuantity),
      },
    });

    const updatedRequest = await tx.foodRequest.update({
      where: { id: requestId },
      data: {
        status: "COMPLETED",
      },
      select: safeRequestSelect,
    });

    await tx.activityLog.create({
      data: {
        fridgeId,
        actorId: userId,
        action: "FOOD_REQUEST_COMPLETED",
        entityType: "FoodRequest",
        entityId: requestId,
        details: {
          consumedQuantity: request.requestedQuantity.toString(),
        },
      },
    });

    return updatedRequest;
  });
}