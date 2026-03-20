/**
 * Creează / actualizează userul contact DIEBEL în PostgreSQL (Neon).
 *
 * Nu comite parola în repo: o dai doar la rulare.
 *
 * Producție (URL din Vercel → Neon):
 *   $env:DATABASE_URL="postgresql://..."   # sau lasă din .env local copiat din Vercel
 *   $env:CONTACT_PASSWORD="Superstar1_@#$"
 *   npm run db:ensure-contact
 *
 * Opțional: CONTACT_EMAIL (implicit contact@diebel.ro)
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { hashPassword, normalizeAuthEmail } from "../lib/auth";

function loadDotEnvFromAlignAppRoot() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnvFromAlignAppRoot();

async function uniqueUsername(prisma: PrismaClient, base: string): Promise<string> {
  const clean = base.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 20) || "contact_diebel";
  let candidate = clean;
  let i = 0;
  for (;;) {
    const taken = await prisma.profile.findUnique({ where: { username: candidate } });
    if (!taken) return candidate;
    i += 1;
    candidate = `${clean}_${i}`.slice(0, 30);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Lipsește DATABASE_URL (pune în .env sau exportă înainte de rulare).");
    process.exit(1);
  }

  const password = process.env.CONTACT_PASSWORD;
  if (!password || String(password).length < 6) {
    console.error("Setează CONTACT_PASSWORD (min. 6 caractere), exemplu PowerShell:");
    console.error('  $env:CONTACT_PASSWORD="***"; npm run db:ensure-contact');
    process.exit(1);
  }

  const email = normalizeAuthEmail(process.env.CONTACT_EMAIL || "contact@diebel.ro");
  const prisma = new PrismaClient();
  const passwordHash = hashPassword(password);
  const now = new Date();

  const usernameForNew = await uniqueUsername(prisma, "contact_diebel_ro");

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      profile: {
        create: {
          name: "Contact DIEBEL",
          username: usernameForNew,
          bio: "",
          gender: "other",
          country: "România",
          city: "București",
          birthDate: "1990-01-01",
          completedAt: now,
          lastActiveAt: now,
          showDistance: true,
          showOnline: true,
          showProfileVisits: true,
          showReadReceipts: true,
          allowFriendRequests: true,
        },
      },
    },
    update: {
      passwordHash,
    },
  });

  const withProfile = await prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  });

  if (withProfile && !withProfile.profile) {
    const username = await uniqueUsername(prisma, "contact_diebel_ro");
    await prisma.profile.create({
      data: {
        userId: withProfile.id,
        name: "Contact DIEBEL",
        username,
        bio: "",
        gender: "other",
        country: "România",
        city: "București",
        birthDate: "1990-01-01",
        completedAt: now,
        lastActiveAt: now,
        showDistance: true,
        showOnline: true,
        showProfileVisits: true,
        showReadReceipts: true,
        allowFriendRequests: true,
      },
    });
  }

  await prisma.$disconnect();
  console.log(`OK: contact@diebel.ro este pregătit în baza curentă (DATABASE_URL). Testează login pe chat.diebel.ro.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
