import prisma from "../lib/prisma.js";

export async function createFridge(userId, data) {
  return prisma.$transaction(async (tx) => {
    const fridge = await tx.fridge.create({
      data: {
        name: data.name,
        description: data.description,
        isDiscoverable: data.isDiscoverable ?? false,
        publicFoodPreview: data.publicFoodPreview ?? false,
        acceptJoinRequests: data.acceptJoinRequests ?? false,
        publicDescription: data.publicDescription ?? null,
        showMemberCount: data.showMemberCount ?? false,
      },
    });

    await tx.fridgeMember.create({
      data: {
        userId,
        fridgeId: fridge.id,
        role: "OWNER",
      },
    });

    await tx.activityLog.create({
      data: {
        fridgeId: fridge.id,
        actorId: userId,
        action: "FRIDGE_CREATED",
        entityType: "Fridge",
        entityId: fridge.id,
        details: { name: fridge.name },
      },
    });

    return { ...fridge, role: "OWNER", itemCount: 0, memberCount: 1 };
  });
}

export async function listFridges(userId) {
  const memberships = await prisma.fridgeMember.findMany({
    where: { userId },
    select: {
      role: true,
      fridge: {
        include: {
          _count: {
            select: { foodItems: true, members: true },
          },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  return memberships.map((m) => ({
    ...m.fridge,
    role: m.role,
    itemCount: m.fridge._count.foodItems,
    memberCount: m.fridge._count.members,
  }));
}

export async function getFridge(fridgeId, userId) {
  const membership = await prisma.fridgeMember.findUnique({
    where: { userId_fridgeId: { userId, fridgeId } },
  });

  if (!membership) return null;

  const fridge = await prisma.fridge.findUnique({
    where: { id: fridgeId },
    include: {
      _count: {
        select: { foodItems: true, members: true },
      },
    },
  });
  if (!fridge) return null;

  return {
    ...fridge,
    role: membership.role,
    itemCount: fridge._count.foodItems,
    memberCount: fridge._count.members,
  };
}

export async function updateFridgeSettings(fridgeId, actorId, data) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.fridge.update({
      where: { id: fridgeId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isDiscoverable !== undefined && { isDiscoverable: data.isDiscoverable }),
        ...(data.publicFoodPreview !== undefined && { publicFoodPreview: data.publicFoodPreview }),
        ...(data.acceptJoinRequests !== undefined && { acceptJoinRequests: data.acceptJoinRequests }),
        ...(data.publicDescription !== undefined && { publicDescription: data.publicDescription }),
        ...(data.showMemberCount !== undefined && { showMemberCount: data.showMemberCount }),
      },
    });

    await tx.activityLog.create({
      data: {
        fridgeId,
        actorId,
        action: "FRIDGE_SETTINGS_UPDATED",
        entityType: "Fridge",
        entityId: fridgeId,
        details: {
          isDiscoverable: updated.isDiscoverable,
          publicFoodPreview: updated.publicFoodPreview,
          acceptJoinRequests: updated.acceptJoinRequests,
        },
      },
    });

    return updated;
  });
}

export async function addMember(fridgeId, actorId, data) {
  const user = await prisma.user.findUnique({ where: { email: data.email } });

  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  const existing = await prisma.fridgeMember.findUnique({
    where: { userId_fridgeId: { userId: user.id, fridgeId } },
  });

  if (existing) {
    const error = new Error("User is already a member of this fridge");
    error.status = 409;
    throw error;
  }

  const member = await prisma.fridgeMember.create({
    data: {
      userId: user.id,
      fridgeId,
      role: data.role,
    },
  });

  await prisma.activityLog.create({
    data: {
      fridgeId,
      actorId,
      action: "FRIDGE_MEMBER_ADDED",
      entityType: "FridgeMember",
      entityId: `${user.id}:${fridgeId}`,
      details: { addedUserId: user.id, role: data.role },
    },
  });

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: member.role,
    joinedAt: member.joinedAt,
  };
}

export async function listMembers(fridgeId) {
  const members = await prisma.fridgeMember.findMany({
    where: { fridgeId },
    select: {
      role: true,
      joinedAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return members.map((m) => ({
    ...m.user,
    role: m.role,
    joinedAt: m.joinedAt,
  }));
}

export async function getActivity(fridgeId, { page, limit }) {
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where: { fridgeId },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.activityLog.count({ where: { fridgeId } }),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

// ==========================================
// PUBLIC DISCOVERY SERVICES
// ==========================================

export async function listPublicFridges({ search, category, page = 1, limit = 12 }) {
  const skip = (page - 1) * limit;

  const where = {
    isDiscoverable: true,
  };

  const andConditions = [];

  if (search) {
    andConditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { publicDescription: { contains: search, mode: "insensitive" } },
        {
          AND: [
            { publicFoodPreview: true },
            {
              foodItems: {
                some: {
                  name: { contains: search, mode: "insensitive" },
                  quantity: { gt: 0 },
                },
              },
            },
          ],
        },
      ],
    });
  }

  if (category) {
    andConditions.push({
      publicFoodPreview: true,
      foodItems: {
        some: {
          category: { equals: category, mode: "insensitive" },
          quantity: { gt: 0 },
        },
      },
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const [fridges, total] = await Promise.all([
    prisma.fridge.findMany({
      where,
      select: {
        id: true,
        name: true,
        publicDescription: true,
        isDiscoverable: true,
        publicFoodPreview: true,
        acceptJoinRequests: true,
        showMemberCount: true,
        createdAt: true,
        _count: {
          select: { members: true, foodItems: true },
        },
        foodItems: {
          where: {
            quantity: { gt: 0 },
            ...(category ? { category: { equals: category, mode: "insensitive" } } : {}),
          },
          select: {
            name: true,
            category: true,
            quantity: true,
            unit: true,
          },
          take: 6,
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.fridge.count({ where }),
  ]);

  // Transform into purpose-built, privacy-safe response objects.
  const safeFridges = fridges.map((f) => ({
    id: f.id,
    name: f.name,
    publicDescription: f.publicDescription,
    acceptJoinRequests: f.acceptJoinRequests,
    publicFoodPreview: f.publicFoodPreview,
    memberCount: f.showMemberCount ? f._count.members : null,
    availableItemCount: f.publicFoodPreview ? f._count.foodItems : null,
    publicFoodItems: f.publicFoodPreview
      ? f.foodItems.map((item) => ({
          name: item.name,
          category: item.category,
          quantity: Number(item.quantity),
          unit: item.unit,
          isAvailable: true,
        }))
      : [],
    createdAt: f.createdAt,
  }));

  return {
    fridges: safeFridges,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getPublicFridge(fridgeId, currentUserId = null) {
  const fridge = await prisma.fridge.findFirst({
    where: { id: fridgeId, isDiscoverable: true },
    select: {
      id: true,
      name: true,
      publicDescription: true,
      isDiscoverable: true,
      publicFoodPreview: true,
      acceptJoinRequests: true,
      showMemberCount: true,
      createdAt: true,
      _count: {
        select: { members: true, foodItems: true },
      },
      foodItems: {
        where: { quantity: { gt: 0 } },
        select: {
          name: true,
          category: true,
          quantity: true,
          unit: true,
        },
        take: 30,
      },
    },
  });

  if (!fridge) return null;

  let userStatus = {
    isMember: false,
    role: null,
    hasPendingJoinRequest: false,
    pendingRequestId: null,
  };

  if (currentUserId) {
    const [membership, pendingRequest] = await Promise.all([
      prisma.fridgeMember.findUnique({
        where: { userId_fridgeId: { userId: currentUserId, fridgeId } },
        select: { role: true },
      }),
      prisma.membershipRequest.findFirst({
        where: { fridgeId, userId: currentUserId, status: "PENDING" },
        select: { id: true },
      }),
    ]);

    if (membership) {
      userStatus.isMember = true;
      userStatus.role = membership.role;
    }
    if (pendingRequest) {
      userStatus.hasPendingJoinRequest = true;
      userStatus.pendingRequestId = pendingRequest.id;
    }
  }

  return {
    id: fridge.id,
    name: fridge.name,
    publicDescription: fridge.publicDescription,
    acceptJoinRequests: fridge.acceptJoinRequests,
    publicFoodPreview: fridge.publicFoodPreview,
    memberCount: fridge.showMemberCount ? fridge._count.members : null,
    availableItemCount: fridge.publicFoodPreview ? fridge._count.foodItems : null,
    publicFoodItems: fridge.publicFoodPreview
      ? fridge.foodItems.map((item) => ({
          name: item.name,
          category: item.category,
          quantity: Number(item.quantity),
          unit: item.unit,
          isAvailable: true,
        }))
      : [],
    createdAt: fridge.createdAt,
    userStatus,
  };
}

// ==========================================
// MEMBERSHIP REQUEST WORKFLOW SERVICES
// ==========================================

export async function createJoinRequest(fridgeId, userId, { note = null }) {
  const fridge = await prisma.fridge.findUnique({
    where: { id: fridgeId },
    select: { id: true, name: true, isDiscoverable: true, acceptJoinRequests: true },
  });

  if (!fridge) {
    const error = new Error("Fridge not found");
    error.status = 404;
    throw error;
  }

  if (!fridge.acceptJoinRequests) {
    const error = new Error("This fridge is not currently accepting membership requests");
    error.status = 403;
    throw error;
  }

  // An existing member cannot request membership again.
  const existingMember = await prisma.fridgeMember.findUnique({
    where: { userId_fridgeId: { userId, fridgeId } },
  });

  if (existingMember) {
    const error = new Error("You are already a member of this fridge");
    error.status = 409;
    throw error;
  }

  // Prevent duplicate pending requests.
  const existingPending = await prisma.membershipRequest.findFirst({
    where: { fridgeId, userId, status: "PENDING" },
  });

  if (existingPending) {
    const error = new Error("You already have a pending membership request for this fridge");
    error.status = 409;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const request = await tx.membershipRequest.create({
      data: {
        fridgeId,
        userId,
        status: "PENDING",
        note: note ? note.trim() : null,
      },
      select: {
        id: true,
        fridgeId: true,
        userId: true,
        status: true,
        note: true,
        createdAt: true,
      },
    });

    await tx.activityLog.create({
      data: {
        fridgeId,
        actorId: userId,
        action: "MEMBERSHIP_REQUEST_CREATED",
        entityType: "MembershipRequest",
        entityId: request.id,
        details: { note: request.note },
      },
    });

    return request;
  });
}

export async function listFridgeJoinRequests(fridgeId, { status = null } = {}) {
  const where = { fridgeId };
  if (status) {
    where.status = status;
  }

  const requests = await prisma.membershipRequest.findMany({
    where,
    select: {
      id: true,
      fridgeId: true,
      status: true,
      note: true,
      createdAt: true,
      decidedAt: true,
      user: {
        select: { id: true, name: true, email: true },
      },
      decidedBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests;
}

export async function approveJoinRequest(fridgeId, requestId, deciderId) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.membershipRequest.findFirst({
      where: { id: requestId, fridgeId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (!request) {
      const error = new Error("Membership request not found");
      error.status = 404;
      throw error;
    }

    if (request.status !== "PENDING") {
      const error = new Error(`Request has already been ${request.status.toLowerCase()}`);
      error.status = 400;
      throw error;
    }

    // Check if user is already a member (concurrency protection).
    const existing = await tx.fridgeMember.findUnique({
      where: { userId_fridgeId: { userId: request.userId, fridgeId } },
    });

    if (!existing) {
      // Create member record with strictly MEMBER role.
      await tx.fridgeMember.create({
        data: {
          userId: request.userId,
          fridgeId,
          role: "MEMBER",
        },
      });
    }

    const updatedRequest = await tx.membershipRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        decidedById: deciderId,
        decidedAt: new Date(),
      },
    });

    await tx.activityLog.create({
      data: {
        fridgeId,
        actorId: deciderId,
        action: "MEMBERSHIP_REQUEST_APPROVED",
        entityType: "MembershipRequest",
        entityId: requestId,
        details: { applicantId: request.userId, applicantName: request.user.name },
      },
    });

    return { success: true, message: "Membership approved", request: updatedRequest };
  });
}

export async function rejectJoinRequest(fridgeId, requestId, deciderId) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.membershipRequest.findFirst({
      where: { id: requestId, fridgeId },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!request) {
      const error = new Error("Membership request not found");
      error.status = 404;
      throw error;
    }

    if (request.status !== "PENDING") {
      const error = new Error(`Request has already been ${request.status.toLowerCase()}`);
      error.status = 400;
      throw error;
    }

    const updated = await tx.membershipRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        decidedById: deciderId,
        decidedAt: new Date(),
      },
    });

    await tx.activityLog.create({
      data: {
        fridgeId,
        actorId: deciderId,
        action: "MEMBERSHIP_REQUEST_REJECTED",
        entityType: "MembershipRequest",
        entityId: requestId,
        details: { applicantId: request.userId, applicantName: request.user.name },
      },
    });

    return { success: true, message: "Membership request rejected", request: updated };
  });
}

export async function listUserJoinRequests(userId) {
  const requests = await prisma.membershipRequest.findMany({
    where: { userId },
    select: {
      id: true,
      fridgeId: true,
      status: true,
      note: true,
      createdAt: true,
      decidedAt: true,
      fridge: {
        select: {
          id: true,
          name: true,
          publicDescription: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests;
}

export async function cancelUserJoinRequest(requestId, userId) {
  const request = await prisma.membershipRequest.findFirst({
    where: { id: requestId, userId },
  });

  if (!request) {
    const error = new Error("Membership request not found");
    error.status = 404;
    throw error;
  }

  if (request.status !== "PENDING") {
    const error = new Error("Only pending requests can be cancelled");
    error.status = 400;
    throw error;
  }

  const updated = await prisma.membershipRequest.update({
    where: { id: requestId },
    data: {
      status: "CANCELLED",
      decidedAt: new Date(),
    },
  });

  await prisma.activityLog.create({
    data: {
      fridgeId: request.fridgeId,
      actorId: userId,
      action: "MEMBERSHIP_REQUEST_CANCELLED",
      entityType: "MembershipRequest",
      entityId: requestId,
      details: {},
    },
  });

  return { success: true, message: "Membership request cancelled", request: updated };
}

// ==========================================
// USER DASHBOARD & AGGREGATED REQUESTS
// ==========================================

export async function getUserDashboard(userId) {
  // 1. User fridges with item and member counts
  const fridges = await listFridges(userId);

  // 2. Fridge IDs where the user is an OWNER or ADMIN
  const managedFridgeIds = fridges
    .filter((f) => f.role === "OWNER" || f.role === "ADMIN")
    .map((f) => f.id);

  // 3. Fridge IDs the user belongs to
  const allUserFridgeIds = fridges.map((f) => f.id);

  // 4. Concurrently query dashboard components
  const [
    pendingFoodRequestsToReview,
    pendingJoinRequestsToReview,
    userOutgoingFoodRequests,
    userOutgoingJoinRequests,
    recentActivity,
  ] = await Promise.all([
    // Pending food requests that user can approve/reject
    managedFridgeIds.length > 0
      ? prisma.foodRequest.findMany({
          where: {
            foodItem: { fridgeId: { in: managedFridgeIds } },
            status: "PENDING",
          },
          include: {
            foodItem: { select: { id: true, name: true, fridgeId: true } },
            requester: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : [],

    // Pending join requests that user can approve/reject
    managedFridgeIds.length > 0
      ? prisma.membershipRequest.findMany({
          where: {
            fridgeId: { in: managedFridgeIds },
            status: "PENDING",
          },
          include: {
            fridge: { select: { id: true, name: true } },
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : [],

    // User's own pending food requests
    prisma.foodRequest.findMany({
      where: { requesterId: userId, status: "PENDING" },
      include: {
        foodItem: {
          select: {
            id: true,
            name: true,
            unit: true,
            fridge: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),

    // User's own pending join requests
    prisma.membershipRequest.findMany({
      where: { userId, status: "PENDING" },
      include: {
        fridge: { select: { id: true, name: true, publicDescription: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),

    // Recent activity across all fridges user is part of
    allUserFridgeIds.length > 0
      ? prisma.activityLog.findMany({
          where: { fridgeId: { in: allUserFridgeIds } },
          include: {
            actor: { select: { id: true, name: true } },
            fridge: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        })
      : [],
  ]);

  return {
    fridges,
    pendingFoodRequestsToReview,
    pendingJoinRequestsToReview,
    userOutgoingFoodRequests,
    userOutgoingJoinRequests,
    recentActivity,
  };
}

export async function getUserRequests(userId) {
  const [foodRequests, joinRequests] = await Promise.all([
    prisma.foodRequest.findMany({
      where: { requesterId: userId },
      include: {
        foodItem: {
          select: {
            id: true,
            name: true,
            unit: true,
            fridge: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.membershipRequest.findMany({
      where: { userId },
      include: {
        fridge: { select: { id: true, name: true, publicDescription: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    foodRequests,
    joinRequests,
  };
}
