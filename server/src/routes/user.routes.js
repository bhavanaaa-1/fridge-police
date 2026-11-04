import { Router } from "express";
import {
  getUserDashboard,
  getUserRequests,
  listUserJoinRequests,
  cancelUserJoinRequest,
} from "../controllers/fridge.controller.js";
import authenticate from "../middleware/authenticate.js";

const router = Router();

router.use(authenticate);

router.get("/me/dashboard", getUserDashboard);
router.get("/me/requests", getUserRequests);
router.get("/me/join-requests", listUserJoinRequests);
router.patch("/me/join-requests/:requestId/cancel", cancelUserJoinRequest);

export default router;
