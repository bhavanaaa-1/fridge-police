import { Router } from "express";
import { listPublicFridges, getPublicFridge } from "../controllers/fridge.controller.js";
import { optionalAuthenticate } from "../middleware/authenticate.js";

const router = Router();

// Public discovery endpoints
router.get("/", listPublicFridges);
router.get("/:fridgeId", optionalAuthenticate, getPublicFridge);

export default router;
