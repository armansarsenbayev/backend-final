'use strict';

const express = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const authService = require('../services/auth.service');
const { registerSchema, loginSchema, refreshSchema, logoutSchema } = require('../schemas/auth.schema');

const router = express.Router();

const forgotSchema = z.object({ email: z.string().email() });
const resetSchema  = z.object({ token: z.string().min(10), password: z.string().min(10).refine(v => /[A-Za-z]/.test(v) && /\d/.test(v), 'must contain letter and digit') });
const resendSchema = z.object({ email: z.string().email() });

// POST /auth/register
router.post('/register', authLimiter, validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const user = await authService.register(req.body);
    res.status(201).json({ ...user, message: 'Registration successful. Please check your email to verify your account.' });
  })
);

// GET /auth/verify-email?token=...
router.get('/verify-email',
  asyncHandler(async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token required', code: 'VALIDATION_ERROR', status_code: 400 });
    const result = await authService.verifyEmail({ token });
    res.status(200).json(result);
  })
);

// POST /auth/resend-verification
router.post('/resend-verification', authLimiter, validate({ body: resendSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.resendVerification({ email: req.body.email });
    res.status(200).json(result);
  })
);

// POST /auth/login
router.post('/login', authLimiter, validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.login({
      email: req.body.email, password: req.body.password,
      userAgent: req.get('user-agent'), ipAddress: req.ip,
    });
    res.status(200).json(result.tokens);
  })
);

// POST /auth/refresh
router.post('/refresh', validate({ body: refreshSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.refresh({
      refreshTokenRaw: req.body.refresh_token,
      userAgent: req.get('user-agent'), ipAddress: req.ip,
    });
    res.status(200).json(result.tokens);
  })
);

// POST /auth/logout
router.post('/logout', requireAuth, validate({ body: logoutSchema }),
  asyncHandler(async (req, res) => {
    await authService.logout({ userId: req.user.id, refreshTokenRaw: req.body.refresh_token });
    res.status(204).send();
  })
);

// GET /auth/me
router.get('/me', requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.me(req.user.id);
    res.status(200).json(user);
  })
);

// POST /auth/forgot-password
router.post('/forgot-password', authLimiter, validate({ body: forgotSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.forgotPassword({ email: req.body.email });
    res.status(200).json(result);
  })
);

// POST /auth/reset-password
router.post('/reset-password', authLimiter, validate({ body: resetSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.resetPassword({ token: req.body.token, newPassword: req.body.password });
    res.status(200).json(result);
  })
);

module.exports = router;