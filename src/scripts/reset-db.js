require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Порядок важен — сначала дочерние таблицы, потом родительские
  await p.auditLog.deleteMany();
  await p.contribution.deleteMany();
  await p.guest.deleteMany();
  await p.gift.deleteMany();
  await p.registry.deleteMany();
  await p.refreshToken.deleteMany();
  await p.user.deleteMany();
  console.log('Database cleared!');
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());