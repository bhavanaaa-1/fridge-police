import {
  createFridgeSchema,
  addMemberSchema,
  listQuerySchema,
  updateFridgeSettingsSchema,
  createJoinRequestSchema,
  discoverQuerySchema,
} from "../validators/fridge.validator.js";
import * as fridgeService from "../services/fridge.service.js";

export async function createFridge(req, res, next) {
  try {
    const data = createFridgeSchema.parse(req.body);
    const fridge = await fridgeService.createFridge(req.user.id, data);
    res.status(201).json({ success: true, fridge });
  } catch (error) {
    next(error);
  }
}

export async function listFridges(req, res, next) {
  try {
    const fridges = await fridgeService.listFridges(req.user.id);
    res.status(200).json({ success: true, fridges });
  } catch (error) {
    next(error);
  }
}

export async function getFridge(req, res, next) {
  try {
    const fridge = await fridgeService.getFridge(req.params.fridgeId, req.user.id);
    if (!fridge) {
      return res.status(404).json({ success: false, message: "Fridge not found" });
    }
    res.status(200).json({ success: true, fridge });
  } catch (error) {
    next(error);
  }
}

export async function updateFridgeSettings(req, res, next) {
  try {
    const data = updateFridgeSettingsSchema.parse(req.body);
    const fridge = await fridgeService.updateFridgeSettings(req.params.fridgeId, req.user.id, data);
    res.status(200).json({ success: true, fridge });
  } catch (error) {
    next(error);
  }
}

export async function addMember(req, res, next) {
  try {
    const data = addMemberSchema.parse(req.body);
    const member = await fridgeService.addMember(req.params.fridgeId, req.user.id, data);
    res.status(201).json({ success: true, member });
  } catch (error) {
    next(error);
  }
}

export async function listMembers(req, res, next) {
  try {
    const members = await fridgeService.listMembers(req.params.fridgeId);
    res.status(200).json({ success: true, members });
  } catch (error) {
    next(error);
  }
}

export async function getActivity(req, res, next) {
  try {
    const query = listQuerySchema.parse(req.query);
    const result = await fridgeService.getActivity(req.params.fridgeId, query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// PUBLIC DISCOVERY CONTROLLERS
// ==========================================

export async function listPublicFridges(req, res, next) {
  try {
    const query = discoverQuerySchema.parse(req.query);
    const result = await fridgeService.listPublicFridges(query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getPublicFridge(req, res, next) {
  try {
    const currentUserId = req.user?.id || null;
    const fridge = await fridgeService.getPublicFridge(req.params.fridgeId, currentUserId);
    if (!fridge) {
      return res.status(404).json({
        success: false,
        message: "Fridge not found or is private",
      });
    }
    res.status(200).json({ success: true, fridge });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// MEMBERSHIP REQUEST CONTROLLERS
// ==========================================

export async function createJoinRequest(req, res, next) {
  try {
    const data = createJoinRequestSchema.parse(req.body);
    const request = await fridgeService.createJoinRequest(req.params.fridgeId, req.user.id, data);
    res.status(201).json({ success: true, request });
  } catch (error) {
    next(error);
  }
}

export async function listFridgeJoinRequests(req, res, next) {
  try {
    const requests = await fridgeService.listFridgeJoinRequests(req.params.fridgeId, req.query);
    res.status(200).json({ success: true, requests });
  } catch (error) {
    next(error);
  }
}

export async function approveJoinRequest(req, res, next) {
  try {
    const result = await fridgeService.approveJoinRequest(
      req.params.fridgeId,
      req.params.requestId,
      req.user.id
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function rejectJoinRequest(req, res, next) {
  try {
    const result = await fridgeService.rejectJoinRequest(
      req.params.fridgeId,
      req.params.requestId,
      req.user.id
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listUserJoinRequests(req, res, next) {
  try {
    const requests = await fridgeService.listUserJoinRequests(req.user.id);
    res.status(200).json({ success: true, requests });
  } catch (error) {
    next(error);
  }
}

export async function cancelUserJoinRequest(req, res, next) {
  try {
    const result = await fridgeService.cancelUserJoinRequest(req.params.requestId, req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

// ==========================================
// USER DASHBOARD & REQUESTS CONTROLLERS
// ==========================================

export async function getUserDashboard(req, res, next) {
  try {
    const data = await fridgeService.getUserDashboard(req.user.id);
    res.status(200).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
}

export async function getUserRequests(req, res, next) {
  try {
    const data = await fridgeService.getUserRequests(req.user.id);
    res.status(200).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
}
