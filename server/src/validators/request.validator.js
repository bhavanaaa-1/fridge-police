import { z } from "zod";

const positiveQuantity = z
  .number({ invalid_type_error: "Requested quantity must be a number" })
  .positive("Requested quantity must be greater than zero");

export const createRequestSchema = z.object({
  foodItemId: z.string().min(1, "Food item ID is required"),
  requestedQuantity: positiveQuantity,
  note: z.string().trim().optional(),
});

export const listRequestsQuerySchema = z.object({
  status: z
    .enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED", "EXPIRED", "COMPLETED"])
    .optional(),
  foodItemId: z.string().optional(),
  requesterId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});