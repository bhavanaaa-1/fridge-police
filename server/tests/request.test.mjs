import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const HAS_TEST_DB = Boolean(process.env.TEST_DATABASE_URL);

if (!HAS_TEST_DB) {
  test("request tests skipped (no TEST_DATABASE_URL)", () => {
    console.warn("Set TEST_DATABASE_URL to run request integration tests.");
  });
} else {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_URL_UNPOOLED = process.env.TEST_DATABASE_URL;

  const { default: app } = await import("../src/app.js");
  const prismaModule = await import("../src/lib/prisma.js");
  const prisma = prismaModule.default;
  const requestService = await import("../src/services/request.service.js");

  let server;
  let baseUrl;
  let owner, admin, member;
  let fridge, item;
  let ownerToken, adminToken, memberToken;

  function signToken(userId) {
    return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "1d" });
  }

  async function resetInventory() {
    await prisma.activityLog.deleteMany({ where: { fridgeId: fridge.id } });
    await prisma.foodRequest.deleteMany({ where: { foodItem: { fridgeId: fridge.id } } });
    await prisma.foodItem.deleteMany({ where: { fridgeId: fridge.id } });
    item = await prisma.foodItem.create({
      data: { fridgeId: fridge.id, createdById: owner.id, name: "Flour", quantity: 10, unit: "kg" },
    });
  }

  test.before(async () => {
    await prisma.$connect();
    owner = await prisma.user.create({ data: { name: "ReqOwner", email: `ro-${crypto.randomUUID()}@example.com`, passwordHash: "hash" } });
    admin = await prisma.user.create({ data: { name: "ReqAdmin", email: `ra-${crypto.randomUUID()}@example.com`, passwordHash: "hash" } });
    member = await prisma.user.create({ data: { name: "ReqMember", email: `rm-${crypto.randomUUID()}@example.com`, passwordHash: "hash" } });
    // no outsider needed for request tests

    fridge = await prisma.fridge.create({ data: { name: "Req Fridge" } });
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


    await resetInventory();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  test.after(async () => {
    await prisma.activityLog.deleteMany({ where: { fridgeId: fridge.id } });
    await prisma.foodRequest.deleteMany({ where: { foodItem: { fridgeId: fridge.id } } });
    await prisma.foodItem.deleteMany({ where: { fridgeId: fridge.id } });
    await prisma.fridgeMember.deleteMany({ where: { fridgeId: fridge.id } });
    await prisma.fridge.delete({ where: { id: fridge.id } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, admin.id, member.id] } } });
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  });

  async function req(path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, options);
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  }

  test("creates a pending request", async () => {
    await resetInventory();
    const { status, body } = await req(`/api/fridges/${fridge.id}/requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: item.id, requestedQuantity: 2, note: "please" }),
    });
    assert.equal(status, 201);
    assert.equal(body.request.status, "PENDING");
    assert.equal(body.request.requesterId, member.id);
  });

  test("rejects invalid requested quantity", async () => {
    await resetInventory();
    const { status } = await req(`/api/fridges/${fridge.id}/requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: item.id, requestedQuantity: 0 }),
    });
    assert.equal(status, 400);
  });

  test("cannot request item from another fridge", async () => {
    await resetInventory();
    const otherItem = await prisma.foodItem.create({
      data: { fridgeId: (await prisma.fridge.create({ data: { name: "Other" } })).id, createdById: owner.id, name: "X", quantity: 5, unit: "kg" },
    });
    const { status } = await req(`/api/fridges/${fridge.id}/requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: otherItem.id, requestedQuantity: 1 }),
    });
    assert.equal(status, 404);
    await prisma.foodItem.delete({ where: { id: otherItem.id } });
    await prisma.fridge.delete({ where: { id: otherItem.fridgeId } });
  });

  test("MEMBER can request food", async () => {
    await resetInventory();
    const { status } = await req(`/api/fridges/${fridge.id}/requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: item.id, requestedQuantity: 1 }),
    });
    assert.equal(status, 201);
  });

  test("MEMBER cannot approve", async () => {
    await resetInventory();
    const createRes = await req(`/api/fridges/${fridge.id}/requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: item.id, requestedQuantity: 1 }),
    });
    const { status } = await req(`/api/fridges/${fridge.id}/requests/${createRes.body.request.id}/approve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert.equal(status, 403);
  });

  test("OWNER can approve", async () => {
    await resetInventory();
    const createRes = await req(`/api/fridges/${fridge.id}/requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: item.id, requestedQuantity: 2 }),
    });
    const { status, body } = await req(`/api/fridges/${fridge.id}/requests/${createRes.body.request.id}/approve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(status, 200);
    assert.equal(body.request.status, "APPROVED");
  });

  test("ADMIN can reject", async () => {
    await resetInventory();
    const createRes = await req(`/api/fridges/${fridge.id}/requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: item.id, requestedQuantity: 1 }),
    });
    const { status, body } = await req(`/api/fridges/${fridge.id}/requests/${createRes.body.request.id}/reject`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(status, 200);
    assert.equal(body.request.status, "REJECTED");
  });

  test("requester can cancel own pending request", async () => {
    await resetInventory();
    const createRes = await req(`/api/fridges/${fridge.id}/requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: item.id, requestedQuantity: 1 }),
    });
    const { status, body } = await req(`/api/fridges/${fridge.id}/requests/${createRes.body.request.id}/cancel`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert.equal(status, 200);
    assert.equal(body.request.status, "CANCELLED");
  });

  test("cannot approve a rejected request", async () => {
    await resetInventory();
    const createRes = await req(`/api/fridges/${fridge.id}/requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: item.id, requestedQuantity: 1 }),
    });
    await req(`/api/fridges/${fridge.id}/requests/${createRes.body.request.id}/reject`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { status } = await req(`/api/fridges/${fridge.id}/requests/${createRes.body.request.id}/approve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(status, 409);
  });

  test("cannot complete a pending request", async () => {
    await resetInventory();
    const createRes = await req(`/api/fridges/${fridge.id}/requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: item.id, requestedQuantity: 1 }),
    });
    const { status } = await req(`/api/fridges/${fridge.id}/requests/${createRes.body.request.id}/complete`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(status, 409);
  });

  test("completing a reservation reduces inventory", async () => {
    await resetInventory();
    const createRes = await req(`/api/fridges/${fridge.id}/requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: item.id, requestedQuantity: 4 }),
    });
    await req(`/api/fridges/${fridge.id}/requests/${createRes.body.request.id}/approve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const completeRes = await req(`/api/fridges/${fridge.id}/requests/${createRes.body.request.id}/complete`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(completeRes.status, 200);
    assert.equal(completeRes.body.request.status, "COMPLETED");

    const updatedItem = await prisma.foodItem.findUnique({ where: { id: item.id } });
    assert.equal(Number(updatedItem.quantity), 6);
  });

  test("completing the same request twice does not reduce inventory twice", async () => {
    await resetInventory();
    const createRes = await req(`/api/fridges/${fridge.id}/requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: item.id, requestedQuantity: 3 }),
    });
    await req(`/api/fridges/${fridge.id}/requests/${createRes.body.request.id}/approve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    await req(`/api/fridges/${fridge.id}/requests/${createRes.body.request.id}/complete`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const second = await req(`/api/fridges/${fridge.id}/requests/${createRes.body.request.id}/complete`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(second.status, 409);

    const updatedItem = await prisma.foodItem.findUnique({ where: { id: item.id } });
    assert.equal(Number(updatedItem.quantity), 7);
  });

  test("expired reservation releases available stock", async () => {
    await resetInventory();
    const createRes = await req(`/api/fridges/${fridge.id}/requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: item.id, requestedQuantity: 6 }),
    });
    await req(`/api/fridges/${fridge.id}/requests/${createRes.body.request.id}/approve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    // Force expiration.
    await prisma.foodRequest.update({
      where: { id: createRes.body.request.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await requestService.expireOverdueReservations(fridge.id);

    // Now a 5 kg request should be approvable (stock fully available again).
    const createRes2 = await req(`/api/fridges/${fridge.id}/requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: item.id, requestedQuantity: 5 }),
    });
    const approveRes2 = await req(`/api/fridges/${fridge.id}/requests/${createRes2.body.request.id}/approve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(approveRes2.status, 200);
  });

  test("insufficient stock prevents approval", async () => {
    await resetInventory();
    // First reserve 8.
    const r1 = await req(`/api/fridges/${fridge.id}/requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: item.id, requestedQuantity: 8 }),
    });
    await req(`/api/fridges/${fridge.id}/requests/${r1.body.request.id}/approve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    // Second request of 5 should not be approvable.
    const r2 = await req(`/api/fridges/${fridge.id}/requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: item.id, requestedQuantity: 5 }),
    });
    const approveRes = await req(`/api/fridges/${fridge.id}/requests/${r2.body.request.id}/approve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(approveRes.status, 409);
  });

  test("two concurrent approvals cannot overbook inventory", async () => {
    await resetInventory();
    const r1 = await req(`/api/fridges/${fridge.id}/requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: item.id, requestedQuantity: 6 }),
    });
    const r2 = await req(`/api/fridges/${fridge.id}/requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: item.id, requestedQuantity: 5 }),
    });

    const [a1, a2] = await Promise.all([
      req(`/api/fridges/${fridge.id}/requests/${r1.body.request.id}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${ownerToken}` },
      }),
      req(`/api/fridges/${fridge.id}/requests/${r2.body.request.id}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${ownerToken}` },
      }),
    ]);

    const statuses = [a1.status, a2.status].sort();
    assert.deepEqual(statuses, [200, 409]);

    const approved = await prisma.foodRequest.findMany({
      where: { foodItemId: item.id, status: "APPROVED", expiresAt: { gt: new Date() } },
    });
    const totalReserved = approved.reduce((sum, r) => sum + Number(r.requestedQuantity), 0);
    assert.ok(totalReserved <= 10);
  });

  test("activity logs are created", async () => {
    await resetInventory();
    const createRes = await req(`/api/fridges/${fridge.id}/requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: item.id, requestedQuantity: 1 }),
    });
    const logs = await prisma.activityLog.findMany({
      where: { fridgeId: fridge.id, action: "FOOD_REQUEST_CREATED" },
    });
    assert.ok(logs.length > 0);
    // ensure request id referenced
    assert.ok(logs.some((l) => l.entityId === createRes.body.request.id));
  });

  test("pagination and filters work", async () => {
    await resetInventory();
    for (let i = 0; i < 3; i++) {
      await req(`/api/fridges/${fridge.id}/requests`, {
        method: "POST",
        headers: { Authorization: `Bearer ${memberToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ foodItemId: item.id, requestedQuantity: 1 }),
      });
    }
    const { status, body } = await req(`/api/fridges/${fridge.id}/requests?page=1&limit=2`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(status, 200);
    assert.ok(body.requests.length <= 2);
    assert.equal(body.pagination.page, 1);
    assert.equal(body.pagination.limit, 2);

    const filtered = await req(`/api/fridges/${fridge.id}/requests?status=PENDING`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(filtered.status, 200);
    assert.ok(filtered.body.requests.every((r) => r.status === "PENDING"));
  });
}
