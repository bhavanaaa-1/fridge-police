import { Router } from "express";
import {
  createRequest,
  listRequests,
  getRequest,
  approveRequest,
  rejectRequest,
  cancelRequest,
  completeRequest,
} from "../controllers/request.controller.js";
import authenticate from "../middleware/authenticate.js";
import authorizeFridge from "../middleware/authorizeFridge.js";

const router = Router({ mergeParams: true });

router.use(authenticate);

// Viewing and creating are available to all members.
router.get("/", authorizeFridge(["OWNER", "ADMIN", "MEMBER"]), listRequests);
router.get("/:requestId", authorizeFridge(["OWNER", "ADMIN", "MEMBER"]), getRequest);
router.post("/", authorizeFridge(["OWNER", "ADMIN", "MEMBER"]), createRequest);

// Cancellation is member-accessible; service enforces ownership/privilege.
router.patch("/:requestId/cancel", authorizeFridge(["OWNER", "ADMIN", "MEMBER"]), cancelRequest);

// Approval, rejection and completion require OWNER or ADMIN.
router.patch("/:requestId/approve", authorizeFridge(["OWNER", "ADMIN"]), approveRequest);
router.patch("/:requestId/reject", authorizeFridge(["OWNER", "ADMIN"]), rejectRequest);
router.patch("/:requestId/complete", authorizeFridge(["OWNER", "ADMIN"]), completeRequest);

export default router;