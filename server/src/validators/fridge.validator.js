import { z } from "zod";

export const createFridgeSchema = z.object({
  name: z.string().trim().min(1, "Fridge name is required"),
  description: z.string().trim().optional(),
  isDiscoverable: z.boolean().optional(),
  publicFoodPreview: z.boolean().optional(),
  acceptJoinRequests: z.boolean().optional(),
  publicDescription: z.string().trim().max(1000).nullable().optional(),
  showMemberCount: z.boolean().optional(),
});

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email"),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateFridgeSettingsSchema = z.object({
  name: z.string().trim().min(1, "Fridge name cannot be empty").optional(),
  description: z.string().trim().nullable().optional(),
  isDiscoverable: z.boolean().optional(),
  publicFoodPreview: z.boolean().optional(),
  acceptJoinRequests: z.boolean().optional(),
  publicDescription: z.string().trim().max(1000).nullable().optional(),
  showMemberCount: z.boolean().optional(),
});

export const createJoinRequestSchema = z.object({
  note: z.string().trim().max(500, "Note cannot exceed 500 characters").optional(),
});

export const discoverQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});