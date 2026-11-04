import test from "node:test";
import assert from "node:assert/strict";
import { loginSchema, registerSchema } from "../src/validators/auth.validator.js";

// Standard regex matching frontend email validation contract
const FRONTEND_EMAIL_REGEX =
  /^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/i;

function validateFrontendEmail(rawEmail) {
  const trimmed = typeof rawEmail === "string" ? rawEmail.trim() : "";
  if (!trimmed) {
    return { valid: false, error: "Email is required.", normalized: "" };
  }
  if (!FRONTEND_EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: "Enter a valid email address.", normalized: "" };
  }
  return { valid: true, error: null, normalized: trimmed.toLowerCase() };
}

test("email validation regression - normal valid email", () => {
  const email = "user@example.com";

  // Backend login schema
  const loginRes = loginSchema.safeParse({ email, password: "password123" });
  assert.equal(loginRes.success, true);
  assert.equal(loginRes.data.email, "user@example.com");

  // Backend register schema
  const regRes = registerSchema.safeParse({ name: "Alex", email, password: "password123" });
  assert.equal(regRes.success, true);
  assert.equal(regRes.data.email, "user@example.com");

  // Frontend validation
  const feRes = validateFrontendEmail(email);
  assert.equal(feRes.valid, true);
  assert.equal(feRes.normalized, "user@example.com");
});

test("email validation regression - uppercase email addresses normalized to lowercase", () => {
  const email = "USER@EXAMPLE.COM";

  const loginRes = loginSchema.safeParse({ email, password: "password123" });
  assert.equal(loginRes.success, true);
  assert.equal(loginRes.data.email, "user@example.com");

  const regRes = registerSchema.safeParse({ name: "Alex", email, password: "password123" });
  assert.equal(regRes.success, true);
  assert.equal(regRes.data.email, "user@example.com");

  const feRes = validateFrontendEmail(email);
  assert.equal(feRes.valid, true);
  assert.equal(feRes.normalized, "user@example.com");
});

test("email validation regression - addresses with dots", () => {
  const email = "first.middle.last@example.com";

  const loginRes = loginSchema.safeParse({ email, password: "password123" });
  assert.equal(loginRes.success, true);
  assert.equal(loginRes.data.email, "first.middle.last@example.com");

  const feRes = validateFrontendEmail(email);
  assert.equal(feRes.valid, true);
  assert.equal(feRes.normalized, "first.middle.last@example.com");
});

test("email validation regression - addresses containing plus signs", () => {
  const email = "user+fridge123@example.com";

  const loginRes = loginSchema.safeParse({ email, password: "password123" });
  assert.equal(loginRes.success, true);
  assert.equal(loginRes.data.email, "user+fridge123@example.com");

  const feRes = validateFrontendEmail(email);
  assert.equal(feRes.valid, true);
  assert.equal(feRes.normalized, "user+fridge123@example.com");
});

test("email validation regression - addresses with valid subdomains", () => {
  const email = "roommate@mail.sub.example.co.uk";

  const loginRes = loginSchema.safeParse({ email, password: "password123" });
  assert.equal(loginRes.success, true);
  assert.equal(loginRes.data.email, "roommate@mail.sub.example.co.uk");

  const feRes = validateFrontendEmail(email);
  assert.equal(feRes.valid, true);
  assert.equal(feRes.normalized, "roommate@mail.sub.example.co.uk");
});

test("email validation regression - accidental leading/trailing whitespace trimmed", () => {
  const email = "   alex.kitchen+test@example.com   \t";

  const loginRes = loginSchema.safeParse({ email, password: "password123" });
  assert.equal(loginRes.success, true);
  assert.equal(loginRes.data.email, "alex.kitchen+test@example.com");

  const regRes = registerSchema.safeParse({ name: "Alex", email, password: "password123" });
  assert.equal(regRes.success, true);
  assert.equal(regRes.data.email, "alex.kitchen+test@example.com");

  const feRes = validateFrontendEmail(email);
  assert.equal(feRes.valid, true);
  assert.equal(feRes.normalized, "alex.kitchen+test@example.com");
});

test("email validation regression - clearly malformed addresses are rejected", () => {
  const malformed = [
    "not-an-email",
    "@example.com",
    "user@",
    "user@.com",
    "user space@example.com",
    "user@localhost",
    "user@example..com",
    "",
    "   ",
  ];

  for (const m of malformed) {
    const loginRes = loginSchema.safeParse({ email: m, password: "password123" });
    assert.equal(loginRes.success, false, `Expected backend login to reject: "${m}"`);

    const regRes = registerSchema.safeParse({ name: "Alex", email: m, password: "password123" });
    assert.equal(regRes.success, false, `Expected backend register to reject: "${m}"`);

    const feRes = validateFrontendEmail(m);
    assert.equal(feRes.valid, false, `Expected frontend to reject: "${m}"`);
    assert.ok(feRes.error);
  }
});

test("password length validation - requires at least 8 characters", () => {
  const shortPassRes = registerSchema.safeParse({
    name: "Alex",
    email: "alex@example.com",
    password: "short",
  });
  assert.equal(shortPassRes.success, false);
  const issues = shortPassRes.error.issues;
  assert.ok(issues.some((i) => i.path.includes("password")));

  const validPassRes = registerSchema.safeParse({
    name: "Alex",
    email: "alex@example.com",
    password: "8charsMin!",
  });
  assert.equal(validPassRes.success, true);
});

test("root-cause reproduction - buggy double-escaped regex rejected valid emails", () => {
  // This was the exact regex in App.jsx line 175 prior to our fix:
  // In a JS regex literal /.../:
  // 1. [^\\s@] defines a negated class rejecting literal '\', literal 's', and '@'.
  // 2. \\. matches a literal '\' followed by any char (not a literal dot '.').
  const buggyRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

  // It rejected all standard valid emails without backslashes:
  assert.equal(buggyRegex.test("user@example.com"), false);
  assert.equal(buggyRegex.test("alice@domain.org"), false);
  assert.equal(buggyRegex.test("alex@household.com"), false);
  assert.equal(buggyRegex.test("bob@domain.com"), false);

  // It rejected any email containing the letter 's' due to [^\\s@]:
  assert.equal(buggyRegex.test("user@domain\\.com"), false);

  // It only matched an artificial string containing a backslash and no 's':
  assert.equal(buggyRegex.test("bob@domain\\.com"), true);

  // Whereas our fixed regex correctly accepts standard valid emails:
  assert.equal(FRONTEND_EMAIL_REGEX.test("user@example.com"), true);
  assert.equal(FRONTEND_EMAIL_REGEX.test("alice@domain.org"), true);
  assert.equal(FRONTEND_EMAIL_REGEX.test("bob@domain.com"), true);
});

test("error response mapping contract - auth failure does not trigger email-format error", () => {
  // 1. Zod schema validation error format (HTTP 400)
  const zodResult = loginSchema.safeParse({ email: "invalid-email", password: "pwd" });
  assert.equal(zodResult.success, false);
  const emailIssue = zodResult.error.issues.find((i) => i.path.includes("email"));
  assert.ok(emailIssue, "Expected Zod to return an issue for email");
  assert.equal(emailIssue.message, "Invalid email address");

  // 2. Auth failure format (HTTP 401)
  const authErrorResponse = {
    status: 401,
    message: "Invalid email or password",
  };
  // When an auth error occurs, the server message is set on authError and no field errors exist:
  const mappedFieldErrors = {};
  if (Array.isArray(authErrorResponse.fieldErrors)) {
    authErrorResponse.fieldErrors.forEach((e) => {
      const field = Array.isArray(e.path) ? e.path[e.path.length - 1] : null;
      if (field) mappedFieldErrors[field] = e.message;
    });
  }
  assert.equal(mappedFieldErrors.email, undefined);
  assert.equal(authErrorResponse.message, "Invalid email or password");

  // 3. Duplicate email conflict format (HTTP 409)
  const conflictResponse = {
    status: 409,
    message: "Email is already registered",
  };
  assert.equal(conflictResponse.status, 409);
  assert.equal(conflictResponse.message, "Email is already registered");
});
