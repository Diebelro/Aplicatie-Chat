import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const email = "simionovidiu13@gmail.com";

try {
  const u = await p.user.findUnique({
    where: { email },
    include: {
      profile: true,
      deviceFingerprints: { orderBy: { updatedAt: "desc" }, take: 10 },
      sessions: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!u) {
    console.log("USER_NOT_FOUND");
    process.exit(0);
  }

  console.log("=== USER ===");
  console.log(
    JSON.stringify(
      {
        id: u.id,
        email: u.email,
        emailVerified: u.emailVerified,
        role: u.role,
        isBanned: u.isBanned,
        banUntil: u.banUntil,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        name: u.profile?.name,
        username: u.profile?.username,
        country: u.profile?.country,
        city: u.profile?.city,
      },
      null,
      2
    )
  );

  console.log("=== DEVICES ===");
  console.log(
    JSON.stringify(
      u.deviceFingerprints.map((d) => ({
        id: d.id,
        ip: d.ip,
        userAgent: d.userAgent,
        fingerprint: String(d.fingerprint || "").slice(0, 32),
        trusted: d.trusted,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
      null,
      2
    )
  );

  console.log("=== SESSIONS ===");
  console.log(
    JSON.stringify(
      u.sessions.map((s) => ({
        id: String(s.token).slice(0, 12),
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        deviceId: s.deviceId,
      })),
      null,
      2
    )
  );

  const verifyTokens = await p.emailVerificationToken.findMany({
    where: { userId: u.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log("=== VERIFY_TOKENS ===");
  console.log(
    JSON.stringify(
      verifyTokens.map((t) => ({
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
      })),
      null,
      2
    )
  );

  const logs = await p.adminLog.findMany({
    where: { OR: [{ targetId: u.id }, { details: { contains: email } }] },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  console.log("=== ADMIN_LOGS ===");
  console.log(JSON.stringify(logs, null, 2));

  const ips = [...new Set(u.deviceFingerprints.map((d) => d.ip).filter(Boolean))];
  if (ips.length) {
    const sameIp = await p.deviceFingerprint.findMany({
      where: { ip: { in: ips } },
      include: {
        user: { select: { email: true, createdAt: true, isBanned: true } },
      },
      take: 30,
    });
    console.log("=== SAME_IP_DEVICES ===");
    console.log(
      JSON.stringify(
        sameIp.map((d) => ({
          ip: d.ip,
          email: d.user?.email,
          userCreated: d.user?.createdAt,
          banned: d.user?.isBanned,
          ua: d.userAgent,
          updatedAt: d.updatedAt,
        })),
        null,
        2
      )
    );
  }
} finally {
  await p.$disconnect();
}
