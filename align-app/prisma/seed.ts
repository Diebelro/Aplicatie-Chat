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
  // REGULĂ: Utilizatorii reali NU sunt niciodată șterși aici. Doar demo1…demo110@align.local.
  // Ștergerea utilizatorilor reali: doar prin "Șterge contul" (utilizator) sau "Sterge user" (admin).
  const demoEmails = Array.from({ length: 110 }, (_, i) => `demo${i + 1}${DEMO_EMAIL_DOMAIN}`);
  const existing = await prisma.user.findMany({
    where: { email: { in: demoEmails } },
    select: { id: true, email: true },
  });
  const ids = existing.map((u) => u.id);
  const onlyDemo = existing.every((u) => demoEmails.includes(u.email));
  if (ids.length > 0) {
    if (!onlyDemo || ids.length > 110) {
      throw new Error("Seed safety: only demo1…demo110@align.local may be deleted. Aborting.");
    }
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

  const fakeFirstNames = ["Maria", "Andrei", "Elena", "Alex", "Ioana", "Mihai", "Ana", "David", "Sofia", "Stefan", "Diana", "George", "Cristina", "Radu", "Laura", "Bogdan", "Andreea", "Vlad", "Raluca", "Adrian"];
  const fakeBios = ["Călătorii, cafea.", "Sport, muzică.", "Filme, natură.", "Fotografie.", "Yoga, citit.", "Gaming, prieteni.", "Concerte.", "Drumeții.", "Travel, food.", "Tech, filme."];
  const fakeCities = ["București", "Cluj-Napoca", "Timișoara", "Iași", "Brașov", "Constanța", "Sibiu", "Craiova", "Galați", "Oradea"];
  const fakeLatLngs: [number, number][] = [
    [44.43, 26.10], [46.77, 23.62], [45.75, 21.21], [47.16, 27.58], [45.64, 25.59],
    [44.16, 28.63], [45.80, 24.13], [44.32, 23.82], [45.44, 28.04], [47.05, 21.92],
  ];
  const years = [1990, 1992, 1994, 1995, 1996, 1997, 1998, 1999, 2000];

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

  for (let i = 10; i < 110; i++) {
    const email = `demo${i + 1}${DEMO_EMAIL_DOMAIN}`;
    const name = `${fakeFirstNames[i % fakeFirstNames.length]} Fake${i + 1}`;
    const username = `fake_${i + 1}`.slice(0, 30);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: {
          create: {
            name,
            username,
            bio: fakeBios[i % fakeBios.length],
            birthDate: `${years[i % years.length]}-${String((i % 12) + 1).padStart(2, "0")}-15`,
            gender: i % 2 === 0 ? "female" : "male",
            country: "România",
            city: fakeCities[i % fakeCities.length],
            completedAt: now,
            lastActiveAt: i % 3 === 0 ? recentActive : olderActive,
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
    const loc = fakeLatLngs[i % fakeLatLngs.length];
    await prisma.location.createMany({
      data: [{ userId: user.id, latitude: loc[0], longitude: loc[1] }],
    });
    await prisma.profilePhoto.create({
      data: { profileId, url: `https://picsum.photos/seed/fake${user.id}/200/200`, order: 0 },
    });
  }

  await prisma.location.createMany({
    data: userIds.slice(0, 10).map((id, idx) => ({
      userId: id,
      latitude: latLngs[idx][0],
      longitude: latLngs[idx][1],
    })),
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
      { fromUserId: userIds[0], toUserId: userIds[1], text: "Hi! How's your week going?", status: "SEEN" },
      { fromUserId: userIds[1], toUserId: userIds[0], text: "Good thanks — yours?", status: "SEEN" },
      { fromUserId: userIds[0], toUserId: userIds[1], text: "Great. Talk soon!", status: "SENT" },
      { fromUserId: userIds[3], toUserId: userIds[4], text: "Hey — did you see the film?", status: "DELIVERED" },
      { fromUserId: userIds[5], toUserId: userIds[6], text: "Hi there!", status: "SENT" },
    ],
  });

  await prisma.premiumSubscription.createMany({
    data: [
      { userId: userIds[0], planId: "lifetime", status: "active", currentPeriodEnd: null },
      { userId: userIds[1], planId: "yearly", status: "active", currentPeriodEnd: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()) },
    ],
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
