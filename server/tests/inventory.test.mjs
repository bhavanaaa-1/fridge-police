import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const HAS_TEST_DB = Boolean(process.env.TEST_DATABASE_URL);

if (!HAS_TEST_DB) {
  test("inventory tests skipped (no TEST_DATABASE_URL)", () => {
    console.warn("Set TEST_DATABASE_URL to run inventory integration tests.");
  });
} else {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_URL_UNPOOLED = process.env.TEST_DATABASE_URL;

  const { default: app } = await import("../src/app.js");
  const prismaModule = await import("../src/lib/prisma.js");
  const prisma = prismaModule.default;

  let server;
  let baseUrl;
  let owner;
  let admin;
  let member;
  let outsider;
  let fridge;
  let otherFridge;
  let ownerToken;
  let adminToken;
  let memberToken;
  let outsiderToken;

  function signToken(userId) {
    return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "1d",
    });
  }

  test.before(async () => {
    await prisma.$connect();

    owner = await prisma.user.create({
      data: { name: "Owner", email: `owner-${crypto.randomUUID()}@example.com`, passwordHash: "hash" },
    });
    admin = await prisma.user.create({
      data: { name: "Admin", email: `admin-${crypto.randomUUID()}@example.com`, passwordHash: "hash" },
    });
    member = await prisma.user.create({
      data: { name: "Member", email: `member-${crypto.randomUUID()}@example.com`, passwordHash: "hash" },
    });
    outsider = await prisma.user.create({
      data: { name: "Outsider", email: `outsider-${crypto.randomUUID()}@example.com`, passwordHash: "hash" },
    });

    fridge = await prisma.fridge.create({ data: { name: "Test Fridge" } });
    otherFridge = await prisma.fridge.create({ data: { name: "Other Fridge" } });

    await prisma.fridgeMember.createMany({
      data: [
        { userId: owner.id, fridgeId: fridge.id, role: "OWNER" },
        { userId: admin.id, fridgeId: fridge.id, role: "ADMIN" },
        { userId: member.id, fridgeId: fridge.id, role: "MEMBER" },
      ],
    });

    ownerToken = signToken(owner.id);
    adminToken = signToken(admin.id);
    memberToken = signToken(member.id);
    outsiderToken = signToken(outsider.id);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  test.after(async () => {
    await prisma.activityLog.deleteMany({ where: { fridgeId: { in: [fridge.id, otherFridge.id] } } });
    await prisma.foodItem.deleteMany({ where: { fridgeId: { in: [fridge.id, otherFridge.id] } } });
    await prisma.fridgeMember.deleteMany({ where: { fridgeId: { in: [fridge.id, otherFridge.id] } } });
    await prisma.fridge.deleteMany({ where: { id: { in: [fridge.id, otherFridge.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, admin.id, member.id, outsider.id] } } });

    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  });

  async function req(path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, options);
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  }

  test("creates an item successfully", async () => {
    const { status, body } = await req(`/api/fridges/${fridge.id}/items`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ownerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Milk", category: "Dairy", quantity: 2, unit: "liters" }),
    });

    assert.equal(status, 201);
    assert.equal(body.item.name, "Milk");
    assert.equal(body.item.fridgeId, fridge.id);
  });

  test("requires authentication", async () => {
    const { status } = await req(`/api/fridges/${fridge.id}/items`);
    assert.equal(status, 401);
  });

  test("denies non-member access", async () => {
    const { status } = await req(`/api/fridges/${fridge.id}/items`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    assert.equal(status, 403);
  });

  test("MEMBER cannot create an item", async () => {
    const { status } = await req(`/api/fridges/${fridge.id}/items`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bread", quantity: 1, unit: "loaf" }),
    });
    assert.equal(status, 403);
  });

  test("OWNER can create an item", async () => {
    const { status } = await req(`/api/fridges/${fridge.id}/items`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ownerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Eggs", quantity: 12, unit: "pieces" }),
    });
    assert.equal(status, 201);
  });

  test("ADMIN can update an item", async () => {
    const createRes = await req(`/api/fridges/${fridge.id}/items`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ownerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Cheese", quantity: 1, unit: "block" }),
    });
    const itemId = createRes.body.item.id;

    const { status, body } = await req(`/api/fridges/${fridge.id}/items/${itemId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: 2 }),
    });

    assert.equal(status, 200);
    assert.equal(Number(body.item.quantity), 2);
  });

  test("rejects invalid quantity", async () => {
    const { status } = await req(`/api/fridges/${fridge.id}/items`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ownerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bad", quantity: 0, unit: "x" }),
    });
    assert.equal(status, 400);
  });

  test("returns 404 for missing item", async () => {
    const { status } = await req(`/api/fridges/${fridge.id}/items/nonexistent-id`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(status, 404);
  });

  test("cannot access item from another fridge", async () => {
    const createRes = await req(`/api/fridges/${otherFridge.id}/items`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ownerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Remote", quantity: 1, unit: "x" }),
    });
    // owner is not a member of otherFridge, so creation should be forbidden
    assert.equal(createRes.status, 403);

    // Create item in otherFridge via prisma directly
    const item = await prisma.foodItem.create({
      data: { fridgeId: otherFridge.id, createdById: owner.id, name: "Remote2", quantity: 1, unit: "x" },
    });

    const { status } = await req(`/api/fridges/${fridge.id}/items/${item.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(status, 404);

    await prisma.foodItem.delete({ where: { id: item.id } });
  });

  test("supports search filter", async () => {
    await req(`/api/fridges/${fridge.id}/items`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ownerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Apple", quantity: 3, unit: "pieces" }),
    });
    await req(`/api/fridges/${fridge.id}/items`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ownerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Banana", quantity: 2, unit: "pieces" }),
    });

    const { status, body } = await req(`/api/fridges/${fridge.id}/items?search=app`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(status, 200);
    assert.ok(body.items.every((i) => i.name.toLowerCase().includes("app")));
  });

  test("supports category filter", async () => {
    await req(`/api/fridges/${fridge.id}/items`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ownerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Yogurt", category: "Dairy", quantity: 1, unit: "cup" }),
    });

    const { status, body } = await req(`/api/fridges/${fridge.id}/items?category=Dairy`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(status, 200);
    assert.ok(body.items.every((i) => i.category === "Dairy"));
  });

  test("supports pagination", async () => {
    const { status, body } = await req(`/api/fridges/${fridge.id}/items?page=1&limit=2`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(status, 200);
    assert.ok(body.items.length <= 2);
    assert.ok(body.pagination);
    assert.equal(body.pagination.page, 1);
    assert.equal(body.pagination.limit, 2);
  });

  test("creates activity log on create", async () => {
    await req(`/api/fridges/${fridge.id}/items`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ownerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "LogTest", quantity: 1, unit: "x" }),
    });

    const logs = await prisma.activityLog.findMany({
      where: { fridgeId: fridge.id, action: "INVENTORY_ITEM_CREATED" },
    });
    assert.ok(logs.length > 0);
  });

  test("deletes an item", async () => {
    const createRes = await req(`/api/fridges/${fridge.id}/items`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ownerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "ToDelete", quantity: 1, unit: "x" }),
    });
    const itemId = createRes.body.item.id;

    const delRes = await req(`/api/fridges/${fridge.id}/items/${itemId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(delRes.status, 200);

    const getRes = await req(`/api/fridges/${fridge.id}/items/${itemId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(getRes.status, 404);
  });
}
