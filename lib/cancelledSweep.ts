import { sql } from "@/lib/db";

// Iptal edilen mac, iptal edildigi andan itibaren bu sure kadar listede
// kalir; sonra veritabanindan kalici olarak silinir. Kisa tutuluyor cunku
// iptal bilgisi bir kez gorulduginde degeri kalmiyor, yer ve gorsel
// kalabalik yaratiyor.
export const CANCELLED_RETENTION_MINUTES = 60;

// Ayri bir cron gerekmesin diye mac listeleri okundugunda calisir
// (puanlama isleme ve anket kapatmayla ayni yaklasim). Iliskili satirlar
// sema tarafindaki ON DELETE CASCADE ile birlikte gider.
export async function sweepCancelledMatches(): Promise<number> {
  const res = await sql`
    DELETE FROM matches
    WHERE status = 'cancelled'
      AND cancelled_at IS NOT NULL
      AND cancelled_at < now() - (${CANCELLED_RETENTION_MINUTES} || ' minutes')::interval
    RETURNING id
  `;
  return res.rowCount ?? 0;
}
