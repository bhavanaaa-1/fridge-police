import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const HAS_TEST_DB = Boolean(process.env.TEST_DATABASE_URL);

if (!HAS_TEST_DB) {
  test("auth tests skipped (no TEST_DATABASE_URL)", () => {
    console.warn("Set TEST_DATABASE_URL to run auth integration tests.");
  });
} else {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_URL_UNPOOLED = process.env.TEST_DATABASE_URL;

  const { default: app } = await import("../src/app.js");
  const prismaModule = await import("../src/lib/prisma.js");
  const prisma = prismaModule.default;

  let server;
  let baseUrl;

  test.before(async () => {
    await prisma.$connect();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  test.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  });

  async function request(path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, options);
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  }

  test("registers a new user successfully", async () => {
    const email = `user-${crypto.randomUUID()}@example.com`;
    const { status, body } = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email,
        password: "StrongPassword123",
      }),
    });

    assert.equal(status, 201);
    assert.equal(body.success, true);
    assert.equal(body.user.email, email);
    assert.ok(!body.user.passwordHash);

    await prisma.user.delete({ where: { email } });
  });

  test("rejects duplicate email registration", async () => {
    const email = `dup-${crypto.randomUUID()}@example.com`;
    await prisma.user.create({
      data: {
        name: "Dup",
        email,
        passwordHash: "hash",
      },
    });

    const { status, body } = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dup2",
        email,
        password: "StrongPassword123",
      }),
    });

    assert.equal(status, 409);
    assert.equal(body.success, false);

    await prisma.user.delete({ where: { email } });
  });

  test("rejects invalid registration data", async () => {
    const { status, body } = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "",
        email: "not-an-email",
        password: "short",
      }),
    });

    assert.equal(status, 400);
    assert.equal(body.success, false);
  });

  test("stores a hashed password, not plaintext", async () => {
    const email = `hash-${crypto.randomUUID()}@example.com`;
    const password = "StrongPassword123";

    await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hash User", email, password }),
    });

    const user = await prisma.user.findUnique({ where: { email } });
    assert.ok(user);
    assert.notEqual(user.passwordHash, password);
    assert.ok(user.passwordHash.startsWith("$2"));

    await prisma.user.delete({ where: { email } });
  });

  test("logs in with valid credentials", async () => {
    const email = `login-${crypto.randomUUID()}@example.com`;
    const password = "StrongPassword123";

    await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Login User", email, password }),
    });

    const { status, body } = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(body.token);
    assert.equal(body.user.email, email);
    assert.ok(!body.user.passwordHash);

    await prisma.user.delete({ where: { email } });
  });

  test("rejects invalid password", async () => {
    const email = `badpw-${crypto.randomUUID()}@example.com`;

    await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bad Pw",
        email,
        password: "StrongPassword123",
      }),
    });

    const { status, body } = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "WrongPassword123" }),
    });

    assert.equal(status, 401);
    assert.equal(body.success, false);
    assert.match(body.message, /invalid/i);

    await prisma.user.delete({ where: { email } });
  });

  test("rejects missing JWT on /me", async () => {
    const { status } = await request("/api/auth/me");
    assert.equal(status, 401);
  });

  test("rejects invalid JWT on /me", async () => {
    const { status } = await request("/api/auth/me", {
      headers: { Authorization: "Bearer not-a-real-token" },
    });
    assert.equal(status, 401);
  });

  test("rejects expired JWT on /me", async () => {
    const email = `expired-${crypto.randomUUID()}@example.com`;
    await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Expired",
        email,
        password: "StrongPassword123",
      }),
    });
    const user = await prisma.user.findUnique({ where: { email } });

    const expiredToken = jwt.sign(
      { sub: user.id },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "-1s" }
    );

    const { status } = await request("/api/auth/me", {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(status, 401);

    await prisma.user.delete({ where: { email } });
  });

  test("returns current user for valid JWT", async () => {
    const email = `me-${crypto.randomUUID()}@example.com`;
    const password = "StrongPassword123";

    await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Me User", email, password }),
    });

    const loginRes = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const { status, body } = await request("/api/auth/me", {
      headers: { Authorization: `Bearer ${loginRes.body.token}` },
    });

    assert.equal(status, 200);
    assert.equal(body.user.email, email);
    assert.ok(!body.user.passwordHash);

    await prisma.user.delete({ where: { email } });
  });

  test("denies non-member fridge access", async () => {
    const email = `nm-${crypto.randomUUID()}@example.com`;
    await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "NM", email, password: "StrongPassword123" }),
    });
    const user = await prisma.user.findUnique({ where: { email } });

    const fridge = await prisma.fridge.create({
      data: { name: "Test Fridge" },
    });

    const { authorizeFridge } = await import("../src/middleware/authorizeFridge.js");
    const express = (await import("express")).default;
    const testApp = express();
    testApp.use(express.json());
    const authMw = (await import("../src/middleware/authenticate.js")).default;
    testApp.get("/t/:fridgeId", authMw, authorizeFridge(["OWNER"]), (req, res) => {
      res.json({ success: true });
    });

    const httpServer = http.createServer(testApp);
    await new Promise((resolve) => httpServer.listen(0, resolve));
    const url = `http://127.0.0.1:${httpServer.address().port}`;

    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "1d",
    });

    const res = await fetch(`${url}/t/${fridge.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 403);

    await new Promise((resolve) => httpServer.close(resolve));
    await prisma.fridgeMember.deleteMany({ where: { fridgeId: fridge.id } });
    await prisma.fridge.delete({ where: { id: fridge.id } });
    await prisma.user.delete({ where: { email } });
  });

  test("MEMBER cannot perform OWNER-only action", async () => {
    const email = `mem-${crypto.randomUUID()}@example.com`;
    await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Mem", email, password: "StrongPassword123" }),
    });
    const user = await prisma.user.findUnique({ where: { email } });

    const fridge = await prisma.fridge.create({ data: { name: "F2" } });
    await prisma.fridgeMember.create({
      data: { userId: user.id, fridgeId: fridge.id, role: "MEMBER" },
    });

    const express = (await import("express")).default;
    const testApp = express();
    testApp.use(express.json());
    const authMw = (await import("../src/middleware/authenticate.js")).default;
    const { authorizeFridge } = await import("../src/middleware/authorizeFridge.js");
    testApp.get("/t/:fridgeId", authMw, authorizeFridge(["OWNER"]), (req, res) => {
      res.json({ success: true });
    });
    const httpServer = http.createServer(testApp);
    await new Promise((resolve) => httpServer.listen(0, resolve));
    const url = `http://127.0.0.1:${httpServer.address().port}`;

    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "1d",
    });
    const res = await fetch(`${url}/t/${fridge.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 403);

    await new Promise((resolve) => httpServer.close(resolve));
    await prisma.fridgeMember.deleteMany({ where: { fridgeId: fridge.id } });
    await prisma.fridge.delete({ where: { id: fridge.id } });
    await prisma.user.delete({ where: { email } });
  });

  test("OWNER is permitted for OWNER-only action", async () => {
    const email = `own-${crypto.randomUUID()}@example.com`;
    await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Own", email, password: "StrongPassword123" }),
    });
    const user = await prisma.user.findUnique({ where: { email } });

    const fridge = await prisma.fridge.create({ data: { name: "F3" } });
    await prisma.fridgeMember.create({
      data: { userId: user.id, fridgeId: fridge.id, role: "OWNER" },
    });

    const express = (await import("express")).default;
    const testApp = express();
    testApp.use(express.json());
    const authMw = (await import("../src/middleware/authenticate.js")).default;
    const { authorizeFridge } = await import("../src/middleware/authorizeFridge.js");
    testApp.get("/t/:fridgeId", authMw, authorizeFridge(["OWNER"]), (req, res) => {
      res.json({ success: true });
    });
    const httpServer = http.createServer(testApp);
    await new Promise((resolve) => httpServer.listen(0, resolve));
    const url = `http://127.0.0.1:${httpServer.address().port}`;

    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "1d",
    });
    const res = await fetch(`${url}/t/${fridge.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);

    await new Promise((resolve) => httpServer.close(resolve));
    await prisma.fridgeMember.deleteMany({ where: { fridgeId: fridge.id } });
    await prisma.fridge.delete({ where: { id: fridge.id } });
    await prisma.user.delete({ where: { email } });
  });
}
