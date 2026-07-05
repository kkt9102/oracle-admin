import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE_NAME = "oracle_admin_session";
const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const MIN_SESSION_MAX_AGE_SECONDS = 60 * 5;
const MAX_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getEnv(name: string) {
  return process.env[name] || null;
}

function getSessionSecret() {
  return getEnv("ADMIN_SESSION_SECRET") || getEnv("ADMIN_PASSWORD");
}

function getSessionMaxAgeSeconds() {
  const configuredValue = getEnv("ADMIN_SESSION_MAX_AGE_SECONDS");

  if (!configuredValue || !/^\d+$/.test(configuredValue)) {
    return DEFAULT_SESSION_MAX_AGE_SECONDS;
  }

  const seconds = Number(configuredValue);

  if (
    !Number.isSafeInteger(seconds) ||
    seconds < MIN_SESSION_MAX_AGE_SECONDS ||
    seconds > MAX_SESSION_MAX_AGE_SECONDS
  ) {
    return DEFAULT_SESSION_MAX_AGE_SECONDS;
  }

  return seconds;
}

function signSessionValue(expiresAt: number) {
  const secret = getSessionSecret();

  if (!secret) {
    return null;
  }

  const payload = String(expiresAt);
  const signature = createHmac("sha256", secret).update(payload).digest("hex");

  return `${payload}.${signature}`;
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAuthConfigured() {
  return Boolean(getEnv("ADMIN_USERNAME") && getEnv("ADMIN_PASSWORD"));
}

export function validateAdminCredentials(username: string, password: string) {
  const expectedUsername = getEnv("ADMIN_USERNAME");
  const expectedPassword = getEnv("ADMIN_PASSWORD");

  if (!expectedUsername || !expectedPassword) {
    return false;
  }

  return safeCompare(username, expectedUsername) && safeCompare(password, expectedPassword);
}

export async function createAdminSession() {
  const sessionMaxAgeSeconds = getSessionMaxAgeSeconds();
  const expiresAt = Date.now() + sessionMaxAgeSeconds * 1000;
  const value = signSessionValue(expiresAt);

  if (!value) {
    return;
  }

  const cookieStore = await cookies();

  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function isAuthenticated() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!session) {
    return false;
  }

  const [expiresAtRaw, signature] = session.split(".");
  const expiresAt = Number(expiresAtRaw);

  if (!expiresAt || !signature || expiresAt < Date.now()) {
    return false;
  }

  const expectedValue = signSessionValue(expiresAt);

  return expectedValue ? safeCompare(session, expectedValue) : false;
}
