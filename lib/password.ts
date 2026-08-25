import bcrypt from "bcryptjs";

// bcryptjs Node.js API'lerine (process.nextTick, setImmediate) ihtiyac duyar,
// bu yuzden Edge Runtime'da calisan middleware.ts bu dosyayi import ETMEMELI.
// Sadece Node.js runtime'inda calisan API route'lari (register/login) kullanir.

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
