import { createItemSchema, updateItemSchema, listItemsQuerySchema } from "../validators/inventory.validator.js";
import * as inventoryService from "../services/inventory.service.js";

export async function createItem(req, res, next) {
  try {
    const data = createItemSchema.parse(req.body);
    const item = await inventoryService.createItem(
      req.params.fridgeId,
      req.user.id,
      data
    );
    res.status(201).json({ success: true, item });
  } catch (error) {
    next(error);
  }
}

export async function listItems(req, res, next) {
  try {
    const query = listItemsQuerySchema.parse(req.query);
    const result = await inventoryService.listItems(req.params.fridgeId, query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getItem(req, res, next) {
  try {
    const item = await inventoryService.getItem(
      req.params.fridgeId,
      req.params.itemId
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    res.status(200).json({ success: true, item });
  } catch (error) {
    next(error);
  }
}

export async function updateItem(req, res, next) {
  try {
    const data = updateItemSchema.parse(req.body);
    const item = await inventoryService.updateItem(
      req.params.fridgeId,
      req.params.itemId,
      req.user.id,
      data
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    res.status(200).json({ success: true, item });
  } catch (error) {
    next(error);
  }
}

export async function deleteItem(req, res, next) {
  try {
    const item = await inventoryService.deleteItem(
      req.params.fridgeId,
      req.params.itemId,
      req.user.id
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Inventory item deleted",
    });
  } catch (error) {
    next(error);
  }
}