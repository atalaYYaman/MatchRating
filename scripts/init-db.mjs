// Kullanim: POSTGRES_URL ortam degiskeni tanimliyken `npm run db:init`
// Vercel Postgres bagladiysan: `vercel env pull .env.local` ile once .env.local'i cek.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config } from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env.local") });
config({ path: path.join(__dirname, "..", ".env") });

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error(
    "POSTGRES_URL bulunamadi. .env.local dosyana Vercel Postgres baglanti bilgilerini ekle (bkz. .env.example)."
  );
  process.exit(1);
}

const schema = readFileSync(path.join(__dirname, "..", "lib", "schema.sql"), "utf8");

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(schema);
  console.log("Veritabani semasi basariyla olusturuldu / guncellendi.");
} catch (err) {
  console.error("Sema olusturulurken hata:", err);
  process.exit(1);
} finally {
  await client.end();
}
