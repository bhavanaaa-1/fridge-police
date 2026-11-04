import { z } from "zod";

const positiveQuantity = z
  .number({ invalid_type_error: "Quantity must be a number" })
  .positive("Quantity must be greater than zero");

export const createItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  category: z.string().trim().min(1).optional(),
  quantity: positiveQuantity,
  unit: z.string().trim().min(1, "Unit is required"),
  expiryDate: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
});

export const updateItemSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").optional(),
    category: z.string().trim().min(1).optional(),
    quantity: positiveQuantity.optional(),
    unit: z.string().trim().min(1, "Unit is required").optional(),
    expiryDate: z.coerce.date().optional(),
    notes: z.string().trim().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const listItemsQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});