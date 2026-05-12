'use strict';

const { verifyAccessToken } = require('../lib/jwt');
const { prisma } = require('../lib/prisma');
const { errors } = require('../lib/errors');
const { asyncHandler } = require('../utils/asyncHandler');


const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    throw errors.Unauthorized('Missing or malformed Authorization header. Format: "Bearer <token>"');
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw errors.Unauthorized('Empty bearer token');
  }

  const payload = verifyAccessToken(token);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, username: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw errors.Unauthorized('User no longer exists or is deactivated');
  }

  req.user = {
    sub: user.id,
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  };
  next();
});


function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(errors.Unauthorized('Not authenticated'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        errors.Forbidden(
          `Access denied. Required role: ${allowedRoles.join(' or ')}`,
        ),
      );
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };