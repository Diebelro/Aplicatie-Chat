/**
 * Bootstrap idempotent: admin + user test pentru DB goală sau după restore.
 * NU șterge utilizatori. Parole doar la create sau dacă BOOTSTRAP_UPDATE_PASSWORD=1.
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

function requireAdminEmail(): string {
  const v = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!v) {
    throw new Error(
      "[bootstrap] Lipsește BOOTSTRAP_ADMIN_EMAIL în .env.local. " +
        "Setează explicit contul de admin recovery (ex: BOOTSTRAP_ADMIN_EMAIL=contact@diebel.ro). " +
        "Vezi .env.local.example."
    );
  }
  return v;
}

function requirePassword(envName: string, fallbackEnv?: string): string {
  const v = process.env[envName]?.trim();
  if (v) return v;
  if (fallbackEnv) {
    const f = process.env[fallbackEnv]?.trim();
    if (f) return f;
  }
  throw new Error(
    `[bootstrap] Setează ${envName}${fallbackEnv ? ` sau ${fallbackEnv}` : ""} în .env.local.`
  );
}

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function ensureUserWithProfile(opts: {
  email: string;
  passwordEnv: string;
  passwordFallbackEnv?: string;
  role: string;
  profileName: string;
  usernamePrefix: string;
}) {
  const email = opts.email.trim().toLowerCase();
  const password = requirePassword(opts.passwordEnv, opts.passwordFallbackEnv);
  const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  const updatePassword = process.env.BOOTSTRAP_UPDATE_PASSWORD === "1";

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  });
  const now = new Date();

  if (existing) {
    const needPassword =
      updatePassword ||
      (!existing.passwordHash && opts.passwordEnv === "BOOTSTRAP_ADMIN_PASSWORD" && opts.role === "ADMIN");
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: opts.role,
        emailVerified: now,
        ...(needPassword ? { passwordHash: hash } : {}),
      },
    });
    if (!existing.profile) {
      await prisma.profile.create({
        data: {
          userId: existing.id,
          name: opts.profileName,
          username: `${opts.usernamePrefix}_${uniqueSuffix()}`.slice(0, 30),
          bio: "",
          completedAt: now,
          country: "România",
          city: "Dev",
        },
      });
    } else {
      await prisma.profile.update({
        where: { userId: existing.id },
        data: {
          completedAt: existing.profile.completedAt ?? now,
          ...(existing.profile.name === "" ? { name: opts.profileName } : {}),
        },
      });
    }
    console.log(`[bootstrap] Actualizat (idem): ${email} → role=${opts.role}, emailVerified=da`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: hash,
      emailVerified: now,
      role: opts.role,
      profile: {
        create: {
          name: opts.profileName,
          username: `${opts.usernamePrefix}_${uniqueSuffix()}`.slice(0, 30),
          bio: "",
          completedAt: now,
          country: "România",
          city: "Dev",
        },
      },
    },
  });
  console.log(`[bootstrap] Creat: ${email} → role=${opts.role}`);
}

async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.EXPECTED_DB_ENV === "prod" &&
    process.env.BOOTSTRAP_ALLOW_PRODUCTION !== "1"
  ) {
    throw new Error(
      "[bootstrap] Refuzat pe producție fără BOOTSTRAP_ALLOW_PRODUCTION=1 (conștient, risc operațional)."
    );
  }

  const adminEmail = requireAdminEmail();
  const testEmailRaw = process.env.BOOTSTRAP_TEST_EMAIL?.trim().toLowerCase();

  await ensureUserWithProfile({
    email: adminEmail,
    passwordEnv: "BOOTSTRAP_ADMIN_PASSWORD",
    role: "ADMIN",
    profileName: "Bootstrap Admin",
    usernamePrefix: "adm",
  });

  const runTest =
    process.env.BOOTSTRAP_SKIP_TEST_USER !== "1" &&
    !!testEmailRaw &&
    testEmailRaw !== adminEmail;
  if (runTest) {
    await ensureUserWithProfile({
      email: testEmailRaw,
      passwordEnv: "BOOTSTRAP_TEST_PASSWORD",
      passwordFallbackEnv: "BOOTSTRAP_ADMIN_PASSWORD",
      role: "USER",
      profileName: "Test User",
      usernamePrefix: "test",
    });
  }

  console.log(
    `[bootstrap] Gata. Admin: ${adminEmail} (rol ADMIN, email verificat). Login cu același email + BOOTSTRAP_ADMIN_PASSWORD.`
  );
  if (!testEmailRaw || process.env.BOOTSTRAP_SKIP_TEST_USER === "1") {
    console.log("[bootstrap] User de test omis (setează BOOTSTRAP_TEST_EMAIL dacă îl vrei).");
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
