import { Router } from "express";
import {
  createItem,
  listItems,
  getItem,
  updateItem,
  deleteItem,
} from "../controllers/inventory.controller.js";
import authenticate from "../middleware/authenticate.js";
import authorizeFridge from "../middleware/authorizeFridge.js";

const router = Router({ mergeParams: true });

// All inventory routes require authentication.
router.use(authenticate);

// Viewing is allowed for all fridge members.
router.get("/", authorizeFridge(["OWNER", "ADMIN", "MEMBER"]), listItems);
router.get("/:itemId", authorizeFridge(["OWNER", "ADMIN", "MEMBER"]), getItem);

// Creating, updating and deleting require OWNER or ADMIN.
router.post("/", authorizeFridge(["OWNER", "ADMIN"]), createItem);
router.patch("/:itemId", authorizeFridge(["OWNER", "ADMIN"]), updateItem);
router.delete("/:itemId", authorizeFridge(["OWNER", "ADMIN"]), deleteItem);

export default router;