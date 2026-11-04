import prisma from "../lib/prisma.js";

// Reusable role-based authorization for a fridge.
// Usage: authorizeFridge(["OWNER"]) or authorizeFridge(["OWNER", "ADMIN"])
export function authorizeFridge(allowedRoles = []) {
  return async (req, res, next) => {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { fridgeId } = req.params;

    if (!fridgeId) {
      return res.status(400).json({
        success: false,
        message: "Fridge ID is required",
      });
    }

    const membership = await prisma.fridgeMember.findUnique({
      where: {
        userId_fridgeId: {
          userId: req.user.id,
          fridgeId,
        },
      },
    });

    if (!membership || !allowedRoles.includes(membership.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }

    // Make the resolved role available to downstream handlers.
    req.fridgeRole = membership.role;
    next();
  };
}

export default authorizeFridge;