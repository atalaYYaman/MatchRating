import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";

// Bu dosya middleware.ts (Edge Runtime) tarafindan da kullanildigi icin
// sadece Edge-uyumlu kutuphaneler (jose) icerir. Sifre hash'leme icin
// lib/password.ts kullanilir (bcryptjs, sadece Node.js runtime'inda).

const COOKIE_NAME = "session";
const ALG = "HS256";

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET ortam degiskeni tanimli degil.");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
};

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

// Web tarafi httpOnly cookie kullanir. Mobil (React Native) istemci cookie
// yonetemedigi icin token'i "Authorization: Bearer <token>" header'inda
// gonderir; ikisi de burada kabul edilir.
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  let token = store.get(COOKIE_NAME)?.value;

  if (!token) {
    const hdrs = await headers();
    const authHeader = hdrs.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  if (!token) return null;
  return verifySessionToken(token);
}
