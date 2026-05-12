'use strict';

const { z } = require('zod');

const password = z
  .string()
  .min(10, 'must be at least 10 characters')
  .refine((v) => /[A-Za-z]/.test(v), 'must contain at least one letter')
  .refine((v) => /\d/.test(v), 'must contain at least one digit');

const registerSchema = z.object({
  email: z.string().email('must be a valid email').max(254),
  username: z
    .string()
    .min(3, 'must be at least 3 characters')
    .max(32, 'must be at most 32 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'must contain only letters, digits, underscore, hyphen'),
  password,
  role: z.enum(['HOST', 'GUEST', 'VENDOR', 'COURIER']).default('GUEST'),
});

const loginSchema = z.object({
  email: z.string().email('must be a valid email'),
  password: z.string().min(1, 'is required'),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(10, 'is required'),
});

const logoutSchema = z.object({
  refresh_token: z.string().min(10, 'is required'),
});

module.exports = { registerSchema, loginSchema, refreshSchema, logoutSchema };