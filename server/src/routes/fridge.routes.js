import { Router } from "express";
import {
  createFridge,
  listFridges,
  getFridge,
  updateFridgeSettings,
  addMember,
  listMembers,
  getActivity,
  createJoinRequest,
  listFridgeJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
} from "../controllers/fridge.controller.js";
import authenticate from "../middleware/authenticate.js";
import authorizeFridge from "../middleware/authorizeFridge.js";

const router = Router();

router.use(authenticate);

// Fridge collection
router.post("/", createFridge);
router.get("/", listFridges);

// Single fridge
router.get("/:fridgeId", authorizeFridge(["OWNER", "ADMIN", "MEMBER"]), getFridge);
router.patch("/:fridgeId/settings", authorizeFridge(["OWNER", "ADMIN"]), updateFridgeSettings);

// Members
router.get("/:fridgeId/members", authorizeFridge(["OWNER", "ADMIN", "MEMBER"]), listMembers);
router.post("/:fridgeId/members", authorizeFridge(["OWNER"]), addMember);

// Activity
router.get("/:fridgeId/activity", authorizeFridge(["OWNER", "ADMIN", "MEMBER"]), getActivity);

// Membership Join Requests (managed by OWNER / ADMIN)
router.post("/:fridgeId/join-requests", createJoinRequest);
router.get("/:fridgeId/join-requests", authorizeFridge(["OWNER", "ADMIN"]), listFridgeJoinRequests);
router.patch("/:fridgeId/join-requests/:requestId/approve", authorizeFridge(["OWNER", "ADMIN"]), approveJoinRequest);
router.patch("/:fridgeId/join-requests/:requestId/reject", authorizeFridge(["OWNER", "ADMIN"]), rejectJoinRequest);

export default router;
