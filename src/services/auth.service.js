'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { prisma } = require('../lib/prisma');
const { errors } = require('../lib/errors');
const { env } = require('../config/env');
const { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } = require('../lib/jwt');
const { enqueueEmail } = require('../lib/queue');

const REFRESH_TTL_MS = parseRefreshTtlMs(env.JWT_REFRESH_TTL);

function parseRefreshTtlMs(ttl) {
  const m = String(ttl).match(/^(\d+)([dhms])?$/);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = m[2] || 's';
  return n * { d: 86400000, h: 3600000, m: 60000, s: 1000 }[unit];
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    role: u.role,
    is_active: u.isActive,
    is_email_verified: u.isEmailVerified,
    created_at: u.createdAt,
  };
}

function tokenPair(user, refreshTokenRaw) {
  return {
    access_token: signAccessToken(user),
    refresh_token: refreshTokenRaw,
    token_type: 'Bearer',
    expires_in: 900,
  };
}

function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function register({ email, username, password, role }) {
  if (role === 'ADMIN') throw errors.Forbidden('Admin role cannot be self-assigned');

  const [existingByEmail, existingByUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { username } }),
  ]);
  if (existingByEmail) throw errors.EmailTaken();
  if (existingByUsername) throw errors.UsernameTaken();

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const verifyToken = generateSecureToken();
  const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email, username, passwordHash, role,
        emailVerifyToken: verifyToken,
        emailVerifyExpires: verifyExpires,
        isEmailVerified: false,
      },
    });
    await tx.auditLog.create({
      data: { userId: u.id, action: 'USER_REGISTERED', entityType: 'user', entityId: u.id, metadata: { email: u.email, role: u.role } },
    });
    return u;
  });

  // Send verification email asynchronously via queue
  await enqueueEmail('verification', { to: email, username, token: verifyToken });

  return publicUser(user);
}

async function verifyEmail({ token }) {
  const user = await prisma.user.findUnique({ where: { emailVerifyToken: token } });
  if (!user) throw errors.ValidationError([{ field: 'token', issue: 'Invalid or expired verification token' }]);
  if (user.emailVerifyExpires < new Date()) throw errors.ValidationError([{ field: 'token', issue: 'Verification token has expired' }]);
  if (user.isEmailVerified) return { message: 'Email already verified' };

  await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, emailVerifyToken: null, emailVerifyExpires: null },
  });
  return { message: 'Email verified successfully. You can now log in.' };
}

async function resendVerification({ email }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { message: 'If this email exists, a verification link has been sent.' };
  if (user.isEmailVerified) return { message: 'Email is already verified.' };

  const verifyToken = generateSecureToken();
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifyToken: verifyToken, emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });
  await enqueueEmail('verification', { to: email, username: user.username, token: verifyToken });
  return { message: 'Verification email sent.' };
}

async function login({ email, password, userAgent, ipAddress }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) throw errors.InvalidCredentials();

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw errors.InvalidCredentials();

  // Block unverified users from logging in
  if (!user.isEmailVerified) {
    throw errors.Forbidden('Please verify your email before logging in. Check your inbox.');
  }

  const { token: refreshToken } = signRefreshToken(user);
  const tokenHash = hashToken(refreshToken);

  await prisma.$transaction([
    prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + REFRESH_TTL_MS), userAgent: userAgent || null, ipAddress: ipAddress || null },
    }),
    prisma.auditLog.create({
      data: { userId: user.id, action: 'USER_LOGIN', entityType: 'user', entityId: user.id },
    }),
  ]);

  return { user: publicUser(user), tokens: tokenPair(user, refreshToken) };
}

async function refresh({ refreshTokenRaw, userAgent, ipAddress }) {
  const decoded = verifyRefreshToken(refreshTokenRaw);
  const tokenHash = hashToken(refreshTokenRaw);

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) throw errors.InvalidToken('Refresh token is invalid or revoked');
  if (stored.userId !== decoded.sub) throw errors.InvalidToken('Token mismatch');

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user || !user.isActive) throw errors.InvalidToken('User no longer active');

  const { token: newRefresh } = signRefreshToken(user);
  const newHash = hashToken(newRefresh);

  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }),
    prisma.refreshToken.create({ data: { userId: user.id, tokenHash: newHash, expiresAt: new Date(Date.now() + REFRESH_TTL_MS), userAgent: userAgent || null, ipAddress: ipAddress || null } }),
  ]);

  return { user: publicUser(user), tokens: tokenPair(user, newRefresh) };
}

async function logout({ userId, refreshTokenRaw }) {
  const tokenHash = hashToken(refreshTokenRaw);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (existing && existing.userId === userId && !existing.revokedAt) {
    await prisma.$transaction([
      prisma.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } }),
      prisma.auditLog.create({ data: { userId, action: 'USER_LOGOUT', entityType: 'refresh_token', entityId: existing.id } }),
    ]);
  }
  return { ok: true };
}

async function me(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw errors.NotFound('User');
  return publicUser(user);
}

async function forgotPassword({ email }) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always return same message to prevent email enumeration
  if (!user) return { message: 'If this email exists, a reset link has been sent.' };

  const resetToken = generateSecureToken();
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: resetToken, passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000) }, // 1h
  });

  await enqueueEmail('password_reset', { to: email, username: user.username, token: resetToken });
  return { message: 'If this email exists, a reset link has been sent.' };
}

async function resetPassword({ token, newPassword }) {
  const user = await prisma.user.findUnique({ where: { passwordResetToken: token } });
  if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    throw errors.ValidationError([{ field: 'token', issue: 'Invalid or expired reset token' }]);
  }

  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpires: null },
    }),
    // Revoke all refresh tokens for security
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  return { message: 'Password reset successfully. Please log in with your new password.' };
}

module.exports = { register, verifyEmail, resendVerification, login, refresh, logout, me, forgotPassword, resetPassword, publicUser };