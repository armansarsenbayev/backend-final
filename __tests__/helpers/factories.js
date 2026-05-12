'use strict';

const { prisma } = require('../../src/lib/prisma');
const authService = require('../../src/services/auth.service');


async function resetDatabase() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.contribution.deleteMany(),
    prisma.guest.deleteMany(),
    prisma.gift.deleteMany(),
    prisma.registry.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

let counter = 0;
function uniqueSuffix() {
  counter += 1;
  return `${Date.now().toString(36)}${counter}`;
}

async function makeUser({ role = 'GUEST', password = 'TestPass123!' } = {}) {
  const suffix = uniqueSuffix();
  const email = `user_${suffix}@example.com`;
  const username = `user_${suffix}`;
  const created = await authService.register({ email, username, password, role });
  // Reload full user (register returns the public DTO).
  const full = await prisma.user.findUnique({ where: { id: created.id } });
  return { user: full, email, username, password };
}

async function loginUser({ email, password }) {
  const result = await authService.login({ email, password });
  return result.tokens;
}

async function makeUserWithTokens(opts) {
  const { user, email, password } = await makeUser(opts);
  const tokens = await loginUser({ email, password });
  return { user, tokens, email, password };
}

module.exports = {
  prisma,
  resetDatabase,
  makeUser,
  loginUser,
  makeUserWithTokens,
};