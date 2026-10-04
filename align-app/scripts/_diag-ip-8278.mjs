import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const ip = "82.78.173.73";

try {
  const devices = await p.deviceFingerprint.findMany({
    where: { ip },
    include: {
      user: {
        select: {
          email: true,
          createdAt: true,
          isBanned: true,
          emailVerified: true,
        },
      },
    },
    take: 20,
  });
  console.log(
    JSON.stringify(
      devices.map((d) => ({
        email: d.user.email,
        banned: d.user.isBanned,
        verified: d.user.emailVerified,
        userCreated: d.user.createdAt,
        ua: d.userAgent,
        fp: d.fingerprint,
        createdAt: d.createdAt,
      })),
      null,
      2
    )
  );
} finally {
  await p.$disconnect();
}
