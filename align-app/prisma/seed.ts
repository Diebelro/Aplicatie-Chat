import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL_DOMAIN = "@align.local";
const DEMO_PASSWORD = "Parola123";
const BCRYPT_ROUNDS = 10;

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

async function main() {
  const existing = await prisma.user.findMany({
    where: { email: { endsWith: DEMO_EMAIL_DOMAIN } },
    select: { id: true },
  });
  const ids = existing.map((u) => u.id);
  if (ids.length > 0) {
    await prisma.message.deleteMany({ where: { OR: [{ fromUserId: { in: ids } }, { toUserId: { in: ids } }] } });
    await prisma.match.deleteMany({ where: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] } });
    await prisma.swipe.deleteMany({ where: { OR: [{ fromUserId: { in: ids } }, { toUserId: { in: ids } }] } });
    await prisma.location.deleteMany({ where: { userId: { in: ids } } });
    await prisma.premiumSubscription.deleteMany({ where: { userId: { in: ids } } });
    const profiles = await prisma.profile.findMany({ where: { userId: { in: ids } }, select: { id: true } });
    const profileIds = profiles.map((p) => p.id);
    if (profileIds.length > 0) await prisma.profilePhoto.deleteMany({ where: { profileId: { in: profileIds } } });
    await prisma.profile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  const now = new Date();
  const recentActive = new Date(now.getTime() - 5 * 60 * 1000);
  const olderActive = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const passwordHash = hashPassword(DEMO_PASSWORD);

  const names = [
    "Maria Popescu",
    "Andrei Ionescu",
    "Elena Marinescu",
    "Alexandru Stan",
    "Ioana Dobre",
    "Mihai Radu",
    "Ana Constantinescu",
    "David Moldovan",
    "Sofia Nistor",
    "Stefan Georgescu",
  ];
  const bios = [
    "Iubesc călătoriile și cafeaua.",
    "Developer, muzică și sport.",
    "Arte, filme, plimbări în natură.",
    "Startups și fotografie.",
    "Cărți, yoga, bucătărie.",
    "Fotbal, gaming, prieteni.",
    "Design, cafele, concerte.",
    "Muzică live și drumeții.",
    "Fashion, travel, food.",
    "Tech, citit, filme.",
  ];
  const cities = ["București", "Cluj-Napoca", "București", "Timișoara", "Iași", "Cluj-Napoca", "Brașov", "București", "Constanța", "Sibiu"];
  const genders = ["female", "male", "female", "male", "female", "male", "female", "male", "female", "male"];
  const birthDates = ["1996-03-15", "1998-07-22", "1993-11-08", "2000-01-30", "1995-05-12", "1997-09-04", "1999-02-18", "1991-12-25", "2002-06-10", "1994-08-07"];
  const latLngs: [number, number][] = [
    [44.4268, 26.1025],
    [46.7712, 23.6236],
    [44.4268, 26.1025],
    [45.7489, 21.2087],
    [47.1585, 27.5794],
    [46.7712, 23.6236],
    [45.6427, 25.5887],
    [44.4268, 26.1025],
    [44.1598, 28.6348],
    [45.7983, 24.1256],
  ];

  const userIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const email = `demo${i + 1}${DEMO_EMAIL_DOMAIN}`;
    const username = `demo${i + 1}_${names[i].toLowerCase().replace(/\s+/g, "_")}`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: {
          create: {
            name: names[i],
            username: username.slice(0, 30),
            bio: bios[i],
            birthDate: birthDates[i],
            gender: genders[i],
            country: "România",
            city: cities[i],
            completedAt: now,
            lastActiveAt: i < 6 ? recentActive : olderActive,
            showDistance: true,
            showOnline: true,
            showProfileVisits: true,
            showReadReceipts: true,
            allowFriendRequests: true,
          },
        },
      },
      include: { profile: true },
    });
    userIds.push(user.id);
    const profileId = user.profile!.id;
    const photoCount = Math.min(5, 2 + (i % 4));
    for (let p = 0; p < photoCount; p++) {
      await prisma.profilePhoto.create({
        data: { profileId, url: `https://picsum.photos/seed/align${user.id}${p}/200/200`, order: p },
      });
    }
  }

  await prisma.location.createMany({
    data: userIds.map((id, idx) => ({
      userId: id,
      latitude: latLngs[idx][0],
      longitude: latLngs[idx][1],
    })),
    skipDuplicates: true,
  });

  await prisma.swipe.createMany({
    data: [
      { fromUserId: userIds[0], toUserId: userIds[1], liked: true },
      { fromUserId: userIds[1], toUserId: userIds[0], liked: true },
      { fromUserId: userIds[0], toUserId: userIds[2], liked: true },
      { fromUserId: userIds[2], toUserId: userIds[0], liked: false },
      { fromUserId: userIds[1], toUserId: userIds[2], liked: true },
      { fromUserId: userIds[2], toUserId: userIds[1], liked: true },
      { fromUserId: userIds[3], toUserId: userIds[4], liked: true },
      { fromUserId: userIds[4], toUserId: userIds[3], liked: true },
      { fromUserId: userIds[0], toUserId: userIds[3], liked: false },
      { fromUserId: userIds[5], toUserId: userIds[6], liked: true },
      { fromUserId: userIds[6], toUserId: userIds[5], liked: true },
    ],
    skipDuplicates: true,
  });

  const matchPairs: [string, string][] = [
    [userIds[0], userIds[1]],
    [userIds[1], userIds[2]],
    [userIds[3], userIds[4]],
    [userIds[5], userIds[6]],
  ];
  for (const [a, b] of matchPairs) {
    const [userAId, userBId] = a < b ? [a, b] : [b, a];
    await prisma.match.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      create: { userAId, userBId },
      update: {},
    });
  }

  await prisma.message.createMany({
    data: [
      { fromUserId: userIds[0], toUserId: userIds[1], text: "Salut! Cum ești?", status: "SEEN" },
      { fromUserId: userIds[1], toUserId: userIds[0], text: "Bine, mersi! Tu?", status: "SEEN" },
      { fromUserId: userIds[0], toUserId: userIds[1], text: "Perfect. Ne auzim!", status: "SENT" },
      { fromUserId: userIds[3], toUserId: userIds[4], text: "Hey, ai văzut filmul?", status: "DELIVERED" },
      { fromUserId: userIds[5], toUserId: userIds[6], text: "Bună!", status: "SENT" },
    ],
  });

  await prisma.premiumSubscription.createMany({
    data: [
      { userId: userIds[0], planId: "lifetime", status: "active", currentPeriodEnd: null },
      { userId: userIds[1], planId: "yearly", status: "active", currentPeriodEnd: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()) },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    await prisma.$disconnect();
    throw e;
  });
