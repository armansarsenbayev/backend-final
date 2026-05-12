'use strict';

const { z } = require('zod');

const uuidParam = z.string().uuid('must be a valid UUID');

const registryCreateSchema = z.object({
  title: z.string().min(3, 'must be at least 3 characters').max(120),
  event_date: z.coerce.date(),
  is_public: z.boolean().optional().default(true),
});

const giftCreateSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  target_amount_kzt: z.coerce.number().positive().min(1000, 'must be at least 1000 KZT'),
  required_tier_rank: z.coerce.number().int().min(0).max(5).optional().default(0),
  is_fragile: z.boolean().optional().default(false),
});

const guestCreateSchema = z.object({
  parent_id: z.string().uuid().nullable().optional(),
  user_id: z.string().uuid().nullable().optional(),
  display_name: z.string().min(1).max(120),
  kinship_label: z.enum(['ata_ana', 'aga_apa', 'jien', 'kuda', 'dos', 'other']),
  tier_rank: z.coerce.number().int().min(0).max(5),
});

const contributionCreateSchema = z.object({
  guest_id: z.string().uuid(),
  amount_original: z.coerce.number().positive(),
  currency_original: z
    .string()
    .length(3, 'must be a 3-letter ISO 4217 code')
    .transform((v) => v.toUpperCase()),
});

// Common query schemas
const paginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const contributionListQuery = paginationQuery.extend({
  status: z.enum(['PENDING', 'FUNDED', 'FAILED', 'REFUNDED']).optional(),
});

const giftListQuery = paginationQuery.extend({
  state: z.enum(['PENDING', 'FUNDED', 'PURCHASED', 'DELIVERED', 'CANCELLED']).optional(),
});

const familyTreeQuery = z.object({
  max_depth: z.coerce.number().int().min(1).max(10).optional().default(10),
});

module.exports = {
  uuidParam,
  registryCreateSchema,
  giftCreateSchema,
  guestCreateSchema,
  contributionCreateSchema,
  paginationQuery,
  contributionListQuery,
  giftListQuery,
  familyTreeQuery,
};