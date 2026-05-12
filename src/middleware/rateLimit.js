'use strict';

const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');


const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    status_code: 429,
  },
});

module.exports = { authLimiter };