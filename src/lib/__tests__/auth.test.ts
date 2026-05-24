// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { jwtVerify } from "jose";

const { mockCookieSet, mockCookieDelete } = vi.hoisted(() => ({
  mockCookieSet: vi.fn(),
  mockCookieDelete: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      set: mockCookieSet,
      get: vi.fn(),
      delete: mockCookieDelete,
    }),
}));

import { createSession, deleteSession } from "../auth";

// Matches the fallback secret used when JWT_SECRET env var is not set
const DEFAULT_SECRET = new TextEncoder().encode("development-secret-key");

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Cookie name & call count
// ---------------------------------------------------------------------------

test("createSession sets exactly one cookie named 'auth-token'", async () => {
  await createSession("user-1", "user@example.com");
  expect(mockCookieSet).toHaveBeenCalledOnce();
  const [name] = mockCookieSet.mock.calls[0];
  expect(name).toBe("auth-token");
});

// ---------------------------------------------------------------------------
// JWT validity and payload
// ---------------------------------------------------------------------------

test("createSession cookie value is a verifiable JWT signed with the default secret", async () => {
  await createSession("user-1", "user@example.com");
  const [, token] = mockCookieSet.mock.calls[0];
  await expect(jwtVerify(token, DEFAULT_SECRET)).resolves.toBeDefined();
});

test("createSession JWT payload contains the correct userId", async () => {
  await createSession("user-abc", "alice@example.com");
  const [, token] = mockCookieSet.mock.calls[0];
  const { payload } = await jwtVerify(token, DEFAULT_SECRET);
  expect(payload.userId).toBe("user-abc");
});

test("createSession JWT payload contains the correct email", async () => {
  await createSession("user-abc", "alice@example.com");
  const [, token] = mockCookieSet.mock.calls[0];
  const { payload } = await jwtVerify(token, DEFAULT_SECRET);
  expect(payload.email).toBe("alice@example.com");
});

test("createSession JWT uses HS256 algorithm", async () => {
  await createSession("user-1", "user@example.com");
  const [, token] = mockCookieSet.mock.calls[0];
  // jwtVerify would throw if the algorithm didn't match; additionally decode header
  const [headerB64] = token.split(".");
  const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
  expect(header.alg).toBe("HS256");
});

test("createSession JWT expiresAt is approximately 7 days from now", async () => {
  const before = Date.now();
  await createSession("user-1", "user@example.com");
  const after = Date.now();

  const [, token] = mockCookieSet.mock.calls[0];
  const { payload } = await jwtVerify(token, DEFAULT_SECRET);

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(payload.expiresAt as string).getTime();

  expect(expiresAt).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(expiresAt).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

// ---------------------------------------------------------------------------
// Cookie options
// ---------------------------------------------------------------------------

test("createSession sets httpOnly: true", async () => {
  await createSession("user-1", "user@example.com");
  const [, , options] = mockCookieSet.mock.calls[0];
  expect(options.httpOnly).toBe(true);
});

test("createSession sets sameSite: 'lax'", async () => {
  await createSession("user-1", "user@example.com");
  const [, , options] = mockCookieSet.mock.calls[0];
  expect(options.sameSite).toBe("lax");
});

test("createSession sets path: '/'", async () => {
  await createSession("user-1", "user@example.com");
  const [, , options] = mockCookieSet.mock.calls[0];
  expect(options.path).toBe("/");
});

test("createSession sets secure: false when NODE_ENV is not production", async () => {
  const original = process.env.NODE_ENV;
  (process.env as Record<string, string>).NODE_ENV = "test";

  await createSession("user-1", "user@example.com");
  const [, , options] = mockCookieSet.mock.calls[0];
  expect(options.secure).toBe(false);

  (process.env as Record<string, string>).NODE_ENV = original;
});

test("createSession sets secure: true when NODE_ENV is 'production'", async () => {
  const original = process.env.NODE_ENV;
  (process.env as Record<string, string>).NODE_ENV = "production";

  await createSession("user-1", "user@example.com");
  const [, , options] = mockCookieSet.mock.calls[0];
  expect(options.secure).toBe(true);

  (process.env as Record<string, string>).NODE_ENV = original;
});

test("createSession cookie expires matches the expiresAt in the JWT payload", async () => {
  await createSession("user-1", "user@example.com");
  const [, token, options] = mockCookieSet.mock.calls[0];
  const { payload } = await jwtVerify(token, DEFAULT_SECRET);

  const cookieExpiry: Date = options.expires;
  const payloadExpiry = new Date(payload.expiresAt as string).getTime();

  expect(Math.abs(cookieExpiry.getTime() - payloadExpiry)).toBeLessThan(1000);
});

// ---------------------------------------------------------------------------
// Distinct payloads for different users
// ---------------------------------------------------------------------------

test("createSession produces distinct tokens for different users", async () => {
  await createSession("user-1", "alice@example.com");
  const [, token1] = mockCookieSet.mock.calls[0];

  vi.clearAllMocks();

  await createSession("user-2", "bob@example.com");
  const [, token2] = mockCookieSet.mock.calls[0];

  expect(token1).not.toBe(token2);
});

// ---------------------------------------------------------------------------
// deleteSession
// ---------------------------------------------------------------------------

test("deleteSession deletes the 'auth-token' cookie", async () => {
  await deleteSession();
  expect(mockCookieDelete).toHaveBeenCalledWith("auth-token");
});

test("deleteSession calls delete exactly once", async () => {
  await deleteSession();
  expect(mockCookieDelete).toHaveBeenCalledOnce();
});

test("deleteSession does not set or read any cookie", async () => {
  await deleteSession();
  expect(mockCookieSet).not.toHaveBeenCalled();
});

test("deleteSession resolves without throwing", async () => {
  await expect(deleteSession()).resolves.toBeUndefined();
});
