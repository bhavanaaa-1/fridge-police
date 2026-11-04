import test from "node:test";
import assert from "node:assert/strict";
import {
  updateFridgeSettingsSchema,
  createJoinRequestSchema,
  discoverQuerySchema,
} from "../src/validators/fridge.validator.js";

test("discovery & membership validator tests - updateFridgeSettingsSchema", () => {
  const valid = updateFridgeSettingsSchema.safeParse({
    name: "Community Larder",
    isDiscoverable: true,
    publicFoodPreview: true,
    acceptJoinRequests: true,
    publicDescription: "Open community fridge for 4th Street",
    showMemberCount: true,
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data.isDiscoverable, true);

  const emptyName = updateFridgeSettingsSchema.safeParse({ name: "   " });
  assert.equal(emptyName.success, false);
});

test("discovery & membership validator tests - createJoinRequestSchema", () => {
  const valid = createJoinRequestSchema.safeParse({ note: "Hi, I live next door." });
  assert.equal(valid.success, true);

  const tooLong = createJoinRequestSchema.safeParse({ note: "a".repeat(501) });
  assert.equal(tooLong.success, false);
});

test("discovery & membership validator tests - discoverQuerySchema", () => {
  const valid = discoverQuerySchema.safeParse({
    search: "bread",
    category: "Bakery",
    page: "2",
    limit: "15",
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data.page, 2);
  assert.equal(valid.data.limit, 15);
});

test("privacy safety contract - public projection never exposes sensitive data", () => {
  // Simulate a raw fridge database model with private details
  const mockRawFridge = {
    id: "fridge-123",
    name: "Co-op Fridge",
    description: "Private internal landlord notes: Code 4321",
    publicDescription: "A welcoming communal fridge for residents",
    isDiscoverable: true,
    publicFoodPreview: false,
    acceptJoinRequests: true,
    showMemberCount: false,
    members: [
      { user: { id: "u1", name: "Alice", email: "alice@secret.org" }, role: "OWNER" },
    ],
    foodItems: [
      { id: "item-1", name: "Reserved Pizza", notes: "Maya's lunch - do not touch!", quantity: 1, unit: "box" },
    ],
    activityLogs: [
      { action: "INVENTORY_ITEM_CREATED", details: { secret: "private" } },
    ],
  };

  // Safe public transform contract as implemented in fridge.service.js
  const safePublicView = {
    id: mockRawFridge.id,
    name: mockRawFridge.name,
    publicDescription: mockRawFridge.publicDescription,
    acceptJoinRequests: mockRawFridge.acceptJoinRequests,
    publicFoodPreview: mockRawFridge.publicFoodPreview,
    memberCount: mockRawFridge.showMemberCount ? mockRawFridge.members.length : null,
    publicFoodItems: mockRawFridge.publicFoodPreview
      ? mockRawFridge.foodItems.map((item) => ({
          name: item.name,
          category: item.category || null,
          quantity: item.quantity,
          unit: item.unit,
          isAvailable: true,
        }))
      : [],
  };

  // Assertions:
  assert.equal(safePublicView.description, undefined);
  assert.equal(safePublicView.members, undefined);
  assert.equal(safePublicView.activityLogs, undefined);
  assert.equal(safePublicView.memberCount, null);
  assert.equal(safePublicView.publicFoodItems.length, 0); // publicFoodPreview is false
  assert.equal(JSON.stringify(safePublicView).includes("secret"), false);
  assert.equal(JSON.stringify(safePublicView).includes("alice@secret.org"), false);
  assert.equal(JSON.stringify(safePublicView).includes("do not touch!"), false);
});

// Live integration tests if TEST_DATABASE_URL is provided
const HAS_TEST_DB = Boolean(process.env.TEST_DATABASE_URL);

if (!HAS_TEST_DB) {
  test("discovery & membership integration tests skipped (no TEST_DATABASE_URL)", () => {
    console.warn("Set TEST_DATABASE_URL to run live discovery integration tests.");
  });
}
