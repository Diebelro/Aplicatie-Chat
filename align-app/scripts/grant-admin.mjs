/**
 * Setează role = ADMIN pentru un user după email (PostgreSQL / Prisma).
 * Folosește DATABASE_URL din .env / .env.local — pentru producție: același URL ca în Vercel.
 *
 * Rulare (din folderul align-app):
 *   npx dotenv-cli@8 -e .env -e .env.local -- node scripts/grant-admin.mjs email@exemplu.com
 * Sau: npm run db:grant-admin -- email@exemplu.com
 */
import { PrismaClient } from "@prisma/client";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Folosire: node scripts/grant-admin.mjs <email>");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const result = await prisma.user.updateMany({
    where: { email },
    data: { role: "ADMIN" },
  });
  if (result.count === 0) {
    console.error("Nu există user cu acest email în baza curentă (verifică DATABASE_URL).");
    process.exit(1);
  }
  console.log("Gata: rol ADMIN pentru", email, "— relogin pe chat.diebel.ro");
} finally {
  await prisma.$disconnect();
}
