#!/usr/bin/env bash
# Rulează PE VPS: bash scripts/check-users-vps.sh
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose exec -T app node --input-type=module -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const users = await p.user.findMany({
  select: {
    id: true,
    email: true,
    profile: { select: { name: true, gender: true, completedAt: true, country: true } },
    swipesFrom: { select: { toUserId: true, liked: true } },
  },
});
console.log('Total conturi:', users.length);
for (const u of users) {
  const dislikes = u.swipesFrom.filter((s) => !s.liked).map((s) => s.toUserId);
  console.log('---');
  console.log(u.email);
  console.log('  profil complet:', u.profile?.completedAt ? 'DA' : 'NU');
  console.log('  gen:', u.profile?.gender ?? '-', 'țară:', u.profile?.country ?? '-');
  console.log('  dislike către:', dislikes.length ? dislikes.join(',') : '(niciunul)');
}
await p.\$disconnect();
"
