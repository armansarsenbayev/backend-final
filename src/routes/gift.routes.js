'use strict';

const express = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const giftService = require('../services/gift.service');
const contributionService = require('../services/contribution.service');
const {
  contributionCreateSchema,
  contributionListQuery,
} = require('../schemas/domain.schema');

const router = express.Router();

const giftIdParams = z.object({ gift_id: z.string().uuid() });

// GET /gifts/:gift_id
router.get(
  '/:gift_id',
  requireAuth,
  validate({ params: giftIdParams }),
  asyncHandler(async (req, res) => {
    const g = await giftService.getGift({
      id: req.params.gift_id,
      requesterId: req.user.id,
      requesterRole: req.user.role,
    });
    res.status(200).json(g);
  }),
);

// GET /gifts/:gift_id/contributions
router.get(
  '/:gift_id/contributions',
  requireAuth,
  validate({ params: giftIdParams, query: contributionListQuery }),
  asyncHandler(async (req, res) => {
    const page = await contributionService.listContributions({
      giftId: req.params.gift_id,
      status: req.query.status,
      cursor: req.query.cursor,
      limit: req.query.limit,
    });
    res.status(200).json(page);
  }),
);

// POST /gifts/:gift_id/contributions  
router.post(
  '/:gift_id/contributions',
  requireAuth,
  validate({ params: giftIdParams, body: contributionCreateSchema }),
  asyncHandler(async (req, res) => {
    const result = await contributionService.createContribution({
      giftId: req.params.gift_id,
      guestId: req.body.guest_id,
      amountOriginal: req.body.amount_original,
      currencyOriginal: req.body.currency_original,
      actorUserId: req.user.id,
    });
    res.status(201).json(contributionService.serializeContribution(result.contribution));
  }),
);

module.exports = router;