import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const HAS_TEST_DB = Boolean(process.env.TEST_DATABASE_URL);

if (!HAS_TEST_DB) {
  test("security tests skipped (no TEST_DATABASE_URL)", () => {
    console.warn("Set TEST_DATABASE_URL to run security tests.");
  });
} else {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_URL_UNPOOLED = process.env.TEST_DATABASE_URL;

  const { default: app } = await import("../src/app.js");
  const prismaModule = await import("../src/lib/prisma.js");
  const prisma = prismaModule.default;

  let server;
  let baseUrl;
  let userA, userB, fridgeA, fridgeB, tokenA;

  function signToken(userId) {
    return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "1d" });
  }

  test.before(async () => {
    await prisma.$connect();
    userA = await prisma.user.create({ data: { name: "SecA", email: `seca-${crypto.randomUUID()}@example.com`, passwordHash: "hash" } });
    userB = await prisma.user.create({ data: { name: "SecB", email: `secb-${crypto.randomUUID()}@example.com`, passwordHash: "hash" } });

    fridgeA = await prisma.fridge.create({ data: { name: "Fridge A" } });
    fridgeB = await prisma.fridge.create({ data: { name: "Fridge B" } });

    await prisma.fridgeMember.create({ data: { userId: userA.id, fridgeId: fridgeA.id, role: "OWNER" } });
    await prisma.fridgeMember.create({ data: { userId: userB.id, fridgeId: fridgeB.id, role: "OWNER" } });

    tokenA = signToken(userA.id);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  test.after(async () => {
    await prisma.activityLog.deleteMany({ where: { fridgeId: { in: [fridgeA.id, fridgeB.id] } } });
    await prisma.foodRequest.deleteMany({ where: { foodItem: { fridgeId: { in: [fridgeA.id, fridgeB.id] } } } });
    await prisma.foodItem.deleteMany({ where: { fridgeId: { in: [fridgeA.id, fridgeB.id] } } });
    await prisma.fridgeMember.deleteMany({ where: { fridgeId: { in: [fridgeA.id, fridgeB.id] } } });
    await prisma.fridge.deleteMany({ where: { id: { in: [fridgeA.id, fridgeB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  });

  async function req(path, token, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  }

  test("user cannot access another fridge's inventory", async () => {
    const item = await prisma.foodItem.create({
      data: { fridgeId: fridgeB.id, createdById: userB.id, name: "Secret", quantity: 5, unit: "kg" },
    });

    const res = await req(`/api/fridges/${fridgeB.id}/items`, tokenA);
    assert.equal(res.status, 403);

    const single = await req(`/api/fridges/${fridgeB.id}/items/${item.id}`, tokenA);
    assert.equal(single.status, 403);

    await prisma.foodItem.delete({ where: { id: item.id } });
  });

  test("user cannot access another fridge's requests", async () => {
    const item = await prisma.foodItem.create({
      data: { fridgeId: fridgeB.id, createdById: userB.id, name: "Item", quantity: 5, unit: "kg" },
    });
    const request = await prisma.foodRequest.create({
      data: { foodItemId: item.id, requesterId: userB.id, requestedQuantity: 1, status: "PENDING" },
    });

    const list = await req(`/api/fridges/${fridgeB.id}/requests`, tokenA);
    assert.equal(list.status, 403);

    const single = await req(`/api/fridges/${fridgeB.id}/requests/${request.id}`, tokenA);
    assert.equal(single.status, 403);

    await prisma.foodRequest.delete({ where: { id: request.id } });
    await prisma.foodItem.delete({ where: { id: item.id } });
  });

  test("MEMBER cannot perform OWNER-only operations", async () => {
    const member = await prisma.user.create({ data: { name: "SecMem", email: `secm-${crypto.randomUUID()}@example.com`, passwordHash: "hash" } });
    await prisma.fridgeMember.create({ data: { userId: member.id, fridgeId: fridgeA.id, role: "MEMBER" } });
    const memberToken = signToken(member.id);

    const itemRes = await req(`/api/fridges/${fridgeA.id}/items`, memberToken, {
      method: "POST",
      body: JSON.stringify({ name: "X", quantity: 1, unit: "u" }),
    });
    assert.equal(itemRes.status, 403);

    await prisma.fridgeMember.deleteMany({ where: { userId: member.id } });
    await prisma.user.delete({ where: { id: member.id } });
  });

  test("malformed JWT is rejected", async () => {
    const res = await req("/api/auth/me", "not-a-jwt");
    assert.equal(res.status, 401);
  });

  test("expired JWT is rejected", async () => {
    const expired = jwt.sign({ sub: userA.id }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "-1s" });
    const res = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${expired}` } });
    assert.equal(res.status, 401);
  });

  test("deleted user token is rejected", async () => {
    const tempUser = await prisma.user.create({ data: { name: "Temp", email: `temptok-${crypto.randomUUID()}@example.com`, passwordHash: "hash" } });
    const tempToken = signToken(tempUser.id);
    await prisma.user.delete({ where: { id: tempUser.id } });

    const res = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${tempToken}` } });
    assert.equal(res.status, 401);
  });

  test("invalid request payloads return 400", async () => {
    const reg = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", email: "bad", password: "short" }),
    });
    assert.equal(reg.status, 400);

    const item = await req(`/api/fridges/${fridgeA.id}/items`, tokenA, {
      method: "POST",
      body: JSON.stringify({ name: "", quantity: 0, unit: "" }),
    });
    assert.equal(item.status, 400);
  });

  test("failed transaction does not create activity log", async () => {
    const item = await prisma.foodItem.create({
      data: { fridgeId: fridgeA.id, createdById: userA.id, name: "Limited", quantity: 2, unit: "kg" },
    });

    // Reserve 2 via approved request.
    const r1 = await prisma.foodRequest.create({
      data: { foodItemId: item.id, requesterId: userA.id, requestedQuantity: 2, status: "APPROVED", expiresAt: new Date(Date.now() + 100000) },
    });

    // Second request cannot be approved due to insufficient stock.
    const r2 = await prisma.foodRequest.create({
      data: { foodItemId: item.id, requesterId: userA.id, requestedQuantity: 1, status: "PENDING" },
    });

    const beforeCount = await prisma.activityLog.count({ where: { fridgeId: fridgeA.id, action: "FOOD_REQUEST_APPROVED" } });

    const res = await req(`/api/fridges/${fridgeA.id}/requests/${r2.id}/approve`, tokenA, { method: "PATCH" });
    assert.equal(res.status, 409);

    const afterCount = await prisma.activityLog.count({ where: { fridgeId: fridgeA.id, action: "FOOD_REQUEST_APPROVED" } });
    assert.equal(afterCount, beforeCount);

    await prisma.foodRequest.deleteMany({ where: { id: { in: [r1.id, r2.id] } } });
    await prisma.foodItem.delete({ where: { id: item.id } });
  });
}
