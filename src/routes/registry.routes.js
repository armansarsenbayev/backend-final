'use strict';

const express = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const registryService = require('../services/registry.service');
const giftService = require('../services/gift.service');
const guestService = require('../services/guest.service');
const { registryCreateSchema, giftCreateSchema, guestCreateSchema, paginationQuery, giftListQuery } = require('../schemas/domain.schema');

const router = express.Router();
const idParam = z.object({ registry_id: z.string().uuid() });

const registryUpdateSchema = registryCreateSchema.partial();
const giftUpdateSchema = giftCreateSchema.partial();
const guestUpdateSchema = guestCreateSchema.partial();

router.post('/', requireAuth, requireRole('HOST'), validate({ body: registryCreateSchema }),
  asyncHandler(async (req, res) => {
    const r = await registryService.createRegistry({ hostId: req.user.id, title: req.body.title, eventDate: req.body.event_date, isPublic: req.body.is_public });
    res.status(201).json(r);
  })
);

router.get('/', requireAuth, validate({ query: paginationQuery }),
  asyncHandler(async (req, res) => {
    const page = await registryService.listRegistries({ requesterId: req.user.id, requesterRole: req.user.role, cursor: req.query.cursor, limit: req.query.limit });
    res.status(200).json(page);
  })
);

router.get('/:registry_id', requireAuth, validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const r = await registryService.getRegistry({ id: req.params.registry_id, requesterId: req.user.id, requesterRole: req.user.role });
    res.status(200).json(r);
  })
);

router.patch('/:registry_id', requireAuth, requireRole('HOST'), validate({ params: idParam, body: registryUpdateSchema }),
  asyncHandler(async (req, res) => {
    const r = await registryService.updateRegistry({ id: req.params.registry_id, hostId: req.user.id, body: req.body });
    res.status(200).json(r);
  })
);

router.delete('/:registry_id', requireAuth, requireRole('HOST'), validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await registryService.deleteRegistry({ id: req.params.registry_id, hostId: req.user.id });
    res.status(204).send();
  })
);

router.post('/:registry_id/gifts', requireAuth, requireRole('HOST'), validate({ params: idParam, body: giftCreateSchema }),
  asyncHandler(async (req, res) => {
    const g = await giftService.createGift({ registryId: req.params.registry_id, hostId: req.user.id, body: req.body });
    res.status(201).json(g);
  })
);

router.get('/:registry_id/gifts', requireAuth, validate({ params: idParam, query: giftListQuery }),
  asyncHandler(async (req, res) => {
    const page = await giftService.listGiftsByRegistry({ registryId: req.params.registry_id, requesterId: req.user.id, requesterRole: req.user.role, state: req.query.state, cursor: req.query.cursor, limit: req.query.limit });
    res.status(200).json(page);
  })
);

router.patch('/:registry_id/gifts/:gift_id', requireAuth, requireRole('HOST'),
  validate({ params: z.object({ registry_id: z.string().uuid(), gift_id: z.string().uuid() }), body: giftUpdateSchema }),
  asyncHandler(async (req, res) => {
    const g = await giftService.updateGift({ id: req.params.gift_id, registryId: req.params.registry_id, hostId: req.user.id, body: req.body });
    res.status(200).json(g);
  })
);

router.delete('/:registry_id/gifts/:gift_id', requireAuth, requireRole('HOST'),
  validate({ params: z.object({ registry_id: z.string().uuid(), gift_id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    await giftService.deleteGift({ id: req.params.gift_id, registryId: req.params.registry_id, hostId: req.user.id });
    res.status(204).send();
  })
);

router.post('/:registry_id/guests', requireAuth, requireRole('HOST'), validate({ params: idParam, body: guestCreateSchema }),
  asyncHandler(async (req, res) => {
    const g = await guestService.createGuest({ registryId: req.params.registry_id, hostId: req.user.id, body: req.body });
    res.status(201).json(g);
  })
);

router.get('/:registry_id/guests', requireAuth, validate({ params: idParam, query: paginationQuery }),
  asyncHandler(async (req, res) => {
    const page = await guestService.listGuests({ registryId: req.params.registry_id, requesterId: req.user.id, requesterRole: req.user.role, cursor: req.query.cursor, limit: req.query.limit });
    res.status(200).json(page);
  })
);

router.patch('/:registry_id/guests/:guest_id', requireAuth, requireRole('HOST'),
  validate({ params: z.object({ registry_id: z.string().uuid(), guest_id: z.string().uuid() }), body: guestUpdateSchema }),
  asyncHandler(async (req, res) => {
    const g = await guestService.updateGuest({ id: req.params.guest_id, registryId: req.params.registry_id, hostId: req.user.id, body: req.body });
    res.status(200).json(g);
  })
);

router.delete('/:registry_id/guests/:guest_id', requireAuth, requireRole('HOST'),
  validate({ params: z.object({ registry_id: z.string().uuid(), guest_id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    await guestService.deleteGuest({ id: req.params.guest_id, registryId: req.params.registry_id, hostId: req.user.id });
    res.status(204).send();
  })
);

module.exports = router;