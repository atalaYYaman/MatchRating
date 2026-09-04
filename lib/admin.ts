import { SessionPayload } from "@/lib/auth";

// Platform yoneticisi, veritabanindaki bir bayrakla degil ortam degiskeniyle
// belirlenir: boylece hicbir kullanici kendini yonetici yapamaz ve yetki
// yalnizca sunucuyu kuran kisinin elinde kalir.
//
// ADMIN_EMAILS="a@x.com,b@x.com"  (virgulle ayrilmis)
//
// Tanimli degilse hicbir e-posta yonetici sayilmaz; panel herkese kapali
// kalir. Guvenli varsayilan bu yonde olmali.
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdmin(session: SessionPayload | null): boolean {
  if (!session?.email) return false;
  const allowed = adminEmails();
  if (allowed.length === 0) return false;
  return allowed.includes(session.email.toLowerCase());
}
