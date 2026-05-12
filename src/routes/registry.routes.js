'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const registryService = require('../services/registry.service');
const giftService = require('../services/gift.service');
const guestService = require('../services/guest.service');
const {
  registryCreateSchema,
  giftCreateSchema,
  guestCreateSchema,
  paginationQuery,
  giftListQuery,
} = require('../schemas/domain.schema');
const { z } = require('zod');

const router = express.Router();

const idParam = z.object({ registry_id: z.string().uuid() });

// POST /registries — HOST only
router.post(
  '/',
  requireAuth,
  requireRole('HOST'),
  validate({ body: registryCreateSchema }),
  asyncHandler(async (req, res) => {
    const r = await registryService.createRegistry({
      hostId: req.user.id,
      title: req.body.title,
      eventDate: req.body.event_date,
      isPublic: req.body.is_public,
    });
    res.status(201).json(r);
  }),
);

// GET /registries — list visible to caller
router.get(
  '/',
  requireAuth,
  validate({ query: paginationQuery }),
  asyncHandler(async (req, res) => {
    const page = await registryService.listRegistries({
      requesterId: req.user.id,
      requesterRole: req.user.role,
      cursor: req.query.cursor,
      limit: req.query.limit,
    });
    res.status(200).json(page);
  }),
);

// GET /registries/:registry_id
router.get(
  '/:registry_id',
  requireAuth,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const r = await registryService.getRegistry({
      id: req.params.registry_id,
      requesterId: req.user.id,
      requesterRole: req.user.role,
    });
    res.status(200).json(r);
  }),
);

// POST /registries/:registry_id/gifts — HOST only
router.post(
  '/:registry_id/gifts',
  requireAuth,
  requireRole('HOST'),
  validate({ params: idParam, body: giftCreateSchema }),
  asyncHandler(async (req, res) => {
    const g = await giftService.createGift({
      registryId: req.params.registry_id,
      hostId: req.user.id,
      body: req.body,
    });
    res.status(201).json(g);
  }),
);

// GET /registries/:registry_id/gifts
router.get(
  '/:registry_id/gifts',
  requireAuth,
  validate({ params: idParam, query: giftListQuery }),
  asyncHandler(async (req, res) => {
    const page = await giftService.listGiftsByRegistry({
      registryId: req.params.registry_id,
      requesterId: req.user.id,
      requesterRole: req.user.role,
      state: req.query.state,
      cursor: req.query.cursor,
      limit: req.query.limit,
    });
    res.status(200).json(page);
  }),
);

// POST /registries/:registry_id/guests — HOST only
router.post(
  '/:registry_id/guests',
  requireAuth,
  requireRole('HOST'),
  validate({ params: idParam, body: guestCreateSchema }),
  asyncHandler(async (req, res) => {
    const g = await guestService.createGuest({
      registryId: req.params.registry_id,
      hostId: req.user.id,
      body: req.body,
    });
    res.status(201).json(g);
  }),
);

// GET /registries/:registry_id/guests
router.get(
  '/:registry_id/guests',
  requireAuth,
  validate({ params: idParam, query: paginationQuery }),
  asyncHandler(async (req, res) => {
    const page = await guestService.listGuests({
      registryId: req.params.registry_id,
      requesterId: req.user.id,
      requesterRole: req.user.role,
      cursor: req.query.cursor,
      limit: req.query.limit,
    });
    res.status(200).json(page);
  }),
);

module.exports = router;