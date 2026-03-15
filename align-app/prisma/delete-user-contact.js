const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..');
function loadEnv(file) {
  const envPath = path.join(root, file);
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}
loadEnv('.env');
loadEnv('.env.local'); // override, ca la Next.js
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const email = 'contact@diebel.ro';
p.user
  .delete({ where: { email } })
  .then(() => {
    console.log('Cont', email, 'șters.');
    return p.$disconnect();
  })
  .catch((e) => {
    console.error(e.message);
    p.$disconnect();
    process.exit(1);
  });
