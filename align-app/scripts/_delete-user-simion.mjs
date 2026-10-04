import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const email = "simionovidiu13@gmail.com";
const adminId = "cmqds5xsq00002t3cri37tn5m";

try {
  const u = await p.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerified: true, createdAt: true },
  });
  if (!u) {
    console.log(JSON.stringify({ ok: false, reason: "USER_NOT_FOUND" }));
    process.exit(0);
  }

  await p.adminLog.create({
    data: {
      adminId,
      action: "DELETE_USER",
      targetId: u.id,
      details:
        "Ștergere manuală: proprietarul emailului spune că nu a creat contul (verify-email neconfirmat, signup Android 2026-08-05)",
    },
  });

  await p.user.delete({ where: { id: u.id } });

  const gone = await p.user.findUnique({ where: { email } });
  console.log(
    JSON.stringify({
      ok: true,
      deleted: { id: u.id, email: u.email, createdAt: u.createdAt, emailVerified: u.emailVerified },
      stillExists: Boolean(gone),
    })
  );
} finally {
  await p.$disconnect();
}
