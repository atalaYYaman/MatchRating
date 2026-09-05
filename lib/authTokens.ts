import { createHash, randomBytes } from "node:crypto";
import { sql } from "@/lib/db";

// Token uretimi ve dogrulanmasi. Ham deger yalnizca linkte yer alir;
// veritabaninda SHA-256 ozeti saklanir.

export type TokenKind = "dogrulama" | "sifirlama";

const TTL_HOURS: Record<TokenKind, number> = {
  dogrulama: 48,
  sifirlama: 1, // sifre sifirlama kisa omurlu olmali
};

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueToken(userId: string, kind: TokenKind): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  // Ayni turden bekleyen eski token'lari gecersiz kil: link paylasilmis
  // olabilir, yalnizca en yenisi calissin.
  await sql`
    UPDATE auth_tokens SET used_at = now()
    WHERE user_id = ${userId} AND kind = ${kind} AND used_at IS NULL
  `;
  await sql`
    INSERT INTO auth_tokens (user_id, kind, token_hash, expires_at)
    VALUES (${userId}, ${kind}, ${hash(token)},
            now() + (${TTL_HOURS[kind]} || ' hours')::interval)
  `;
  return token;
}

export type TokenCheck =
  | { valid: true; userId: string; tokenId: string }
  | { valid: false; reason: "not_found" | "expired" | "used" };

export async function verifyToken(token: string, kind: TokenKind): Promise<TokenCheck> {
  const res = await sql`
    SELECT id, user_id, expires_at, used_at FROM auth_tokens
    WHERE token_hash = ${hash(token)} AND kind = ${kind}
  `;
  const row = res.rows[0];
  if (!row) return { valid: false, reason: "not_found" };
  if (row.used_at) return { valid: false, reason: "used" };
  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true, userId: row.user_id as string, tokenId: row.id as string };
}

export async function consumeToken(tokenId: string): Promise<void> {
  await sql`UPDATE auth_tokens SET used_at = now() WHERE id = ${tokenId}`;
}
