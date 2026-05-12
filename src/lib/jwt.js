'use strict';

const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { env } = require('../config/env');
const { errors } = require('./errors');

const ISSUER = 'saukele-api';
const AUDIENCE = 'saukele-client';

function signAccessToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    type: 'access',
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}


function signRefreshToken(user) {
  const jti = uuidv4();
  const token = jwt.sign(
    { sub: user.id, jti, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_TTL,
      issuer: ISSUER,
      audience: AUDIENCE,
    },
  );
  return { token, jti };
}

function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (decoded.type !== 'access') {
      throw errors.InvalidToken('Wrong token type');
    }
    return decoded;
  } catch (err) {
    if (err.name === 'AppError') throw err;
    throw errors.InvalidToken();
  }
}

function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (decoded.type !== 'refresh') {
      throw errors.InvalidToken('Wrong token type');
    }
    return decoded;
  } catch (err) {
    if (err.name === 'AppError') throw err;
    throw errors.InvalidToken();
  }
}


function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};