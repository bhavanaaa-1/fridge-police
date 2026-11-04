import { createRequestSchema, listRequestsQuerySchema } from "../validators/request.validator.js";
import * as requestService from "../services/request.service.js";

export async function createRequest(req, res, next) {
  try {
    const data = createRequestSchema.parse(req.body);
    const request = await requestService.createRequest(
      req.params.fridgeId,
      req.user.id,
      data
    );
    res.status(201).json({ success: true, request });
  } catch (error) {
    next(error);
  }
}

export async function listRequests(req, res, next) {
  try {
    const query = listRequestsQuerySchema.parse(req.query);

    if (query.requesterId && query.requesterId !== req.user.id) {
      const privileged = ["OWNER", "ADMIN"].includes(req.fridgeRole);
      if (!privileged) {
        return res.status(403).json({
          success: false,
          message: "You can only filter by your own requests",
        });
      }
    }

    const result = await requestService.listRequests(req.params.fridgeId, query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getRequest(req, res, next) {
  try {
    const request = await requestService.getRequest(
      req.params.fridgeId,
      req.params.requestId
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Food request not found",
      });
    }

    res.status(200).json({ success: true, request });
  } catch (error) {
    next(error);
  }
}

export async function approveRequest(req, res, next) {
  try {
    const request = await requestService.approveRequest(
      req.params.fridgeId,
      req.params.requestId,
      req.user.id
    );
    res.status(200).json({ success: true, request });
  } catch (error) {
    next(error);
  }
}

export async function rejectRequest(req, res, next) {
  try {
    const request = await requestService.rejectRequest(
      req.params.fridgeId,
      req.params.requestId,
      req.user.id
    );
    res.status(200).json({ success: true, request });
  } catch (error) {
    next(error);
  }
}

export async function cancelRequest(req, res, next) {
  try {
    const isPrivileged = ["OWNER", "ADMIN"].includes(req.fridgeRole);
    const request = await requestService.cancelRequest(
      req.params.fridgeId,
      req.params.requestId,
      req.user.id,
      isPrivileged
    );
    res.status(200).json({ success: true, request });
  } catch (error) {
    next(error);
  }
}

export async function completeRequest(req, res, next) {
  try {
    const request = await requestService.completeRequest(
      req.params.fridgeId,
      req.params.requestId,
      req.user.id
    );
    res.status(200).json({ success: true, request });
  } catch (error) {
    next(error);
  }
}