// Kullaniciya gorunen metinlerde eski marka adi kalmis mi diye bakar.
// Kod yorumlari ve degistirilmemesi gereken teknik kimlikler haric tutulur.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// Kelime sinirina bakiyoruz: maybeProcessMatchRatings gibi tanimlayicilar
// markayi degil alan terimini ("mac puanlama") anlatiyor, onlar sayilmamali.
const OLD_NAME_RE = /(?<![A-Za-z])(MatchRating|MATCHRATING)(?![a-z])/;
// Eski iletisim adresi de kullaniciya gorunen metne gomulmemeli; adres
// brand.supportEmail uzerinden okunmali ki tek yerden degissin.
const OLD_CONTACT_RE = /info@otlak\.com\.tr/;
// Bilerek degismeyenler: oturum anahtarlari, EAS slug'i, Play Store paketi.
const ALLOWED = [
  "matchrating_group_scope",
  "matchrating_session_token",
  "com.otlak.matchrating",
  '"slug": "matchrating"',
  '"scheme": "matchrating"',
  "STORAGE_PREFIX",
];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", ".expo", ".vercel"]);
const EXT = new Set([".ts", ".tsx", ".json", ".css"]);

const hits = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) { walk(full); continue; }
    if (!EXT.has(path.extname(full))) continue;
    const lines = readFileSync(full, "utf8").split("\n");
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      // Yorum satirlari marka denetiminin disinda.
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*") ||
        trimmed.startsWith("--")
      ) return;
      if (ALLOWED.some((a) => line.includes(a))) return;
      if (OLD_NAME_RE.test(line) || OLD_CONTACT_RE.test(line)) {
        hits.push(`${full}:${i + 1}  ${trimmed.slice(0, 90)}`);
      }
    });
  }
}
walk(process.cwd());

if (hits.length) {
  console.error(`Eski marka adi ${hits.length} yerde duruyor:\n` + hits.join("\n"));
  process.exit(1);
}
console.log("Temiz: kullaniciya gorunen metinlerde eski marka adi yok.");
