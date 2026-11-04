import prisma from "../lib/prisma.js";

const safeItemSelect = {
  id: true,
  fridgeId: true,
  name: true,
  category: true,
  quantity: true,
  unit: true,
  expiryDate: true,
  notes: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
};

async function findItemInFridge(fridgeId, itemId) {
  return prisma.foodItem.findFirst({
    where: { id: itemId, fridgeId },
    select: safeItemSelect,
  });
}

export async function createItem(fridgeId, userId, data) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.foodItem.create({
      data: {
        fridgeId,
        createdById: userId,
        name: data.name,
        category: data.category,
        quantity: data.quantity,
        unit: data.unit,
        expiryDate: data.expiryDate,
        notes: data.notes,
      },
      select: safeItemSelect,
    });

    await tx.activityLog.create({
      data: {
        fridgeId,
        actorId: userId,
        action: "INVENTORY_ITEM_CREATED",
        entityType: "FoodItem",
        entityId: item.id,
        details: {
          name: item.name,
          quantity: item.quantity.toString(),
          unit: item.unit,
          category: item.category,
        },
      },
    });

    return item;
  });
}

export async function listItems(fridgeId, { search, category, page, limit }) {
  const where = { fridgeId };

  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  if (category) {
    where.category = category;
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.foodItem.findMany({
      where,
      select: safeItemSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.foodItem.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getItem(fridgeId, itemId) {
  return findItemInFridge(fridgeId, itemId);
}

export async function updateItem(fridgeId, itemId, userId, data) {
  const existing = await findItemInFridge(fridgeId, itemId);

  if (!existing) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.foodItem.update({
      where: { id: itemId },
      data: {
        name: data.name,
        category: data.category,
        quantity: data.quantity,
        unit: data.unit,
        expiryDate: data.expiryDate,
        notes: data.notes,
      },
      select: safeItemSelect,
    });

    await tx.activityLog.create({
      data: {
        fridgeId,
        actorId: userId,
        action: "INVENTORY_ITEM_UPDATED",
        entityType: "FoodItem",
        entityId: item.id,
        details: {
          updatedFields: Object.keys(data),
        },
      },
    });

    return item;
  });
}

export async function deleteItem(fridgeId, itemId, userId) {
  const existing = await findItemInFridge(fridgeId, itemId);

  if (!existing) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.foodItem.delete({ where: { id: itemId } });

    await tx.activityLog.create({
      data: {
        fridgeId,
        actorId: userId,
        action: "INVENTORY_ITEM_DELETED",
        entityType: "FoodItem",
        entityId: itemId,
        details: {
          name: existing.name,
          quantity: existing.quantity.toString(),
          unit: existing.unit,
        },
      },
    });
  });

  return existing;
}