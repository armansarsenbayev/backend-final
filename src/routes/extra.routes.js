'use strict';

const express = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { prisma } = require('../lib/prisma');
const { errors } = require('../lib/errors');
const { enqueueEmail } = require('../lib/queue');
const { getQueueStatus } = require('../lib/queue');
const familyTreeService = require('../services/familyTree.service');
const authService = require('../services/auth.service');
const giftService = require('../services/gift.service');
const { familyTreeQuery, paginationQuery } = require('../schemas/domain.schema');
const { decodeCursor, buildNextCursor } = require('../utils/pagination');

const router = express.Router();

const guestIdParam = z.object({ guest_id: z.string().uuid() });
const giftIdParam  = z.object({ gift_id: z.string().uuid() });

// ── Family tree ────────────────────────────────────────────────────────────
router.get('/guests/:guest_id/family-tree', requireAuth,
  validate({ params: guestIdParam, query: familyTreeQuery }),
  asyncHandler(async (req, res) => {
    const guest = await prisma.guest.findUnique({ where: { id: req.params.guest_id } });
    if (!guest) throw errors.NotFound('Guest');
    if (req.user.role !== 'ADMIN') {
      const reg = await prisma.registry.findUnique({ where: { id: guest.registryId } });
      const linkedGuest = await prisma.guest.findFirst({ where: { registryId: guest.registryId, userId: req.user.id } });
      if (reg.hostId !== req.user.id && !linkedGuest) throw errors.Forbidden('Not authorized to view this family tree');
    }
    const tree = await familyTreeService.getFamilyTree({ rootGuestId: req.params.guest_id, maxDepth: req.query.max_depth });
    res.status(200).json(tree);
  })
);

// ── VENDOR endpoints ───────────────────────────────────────────────────────
// GET /vendor/gifts — list all FUNDED gifts (available to purchase)
router.get('/vendor/gifts', requireAuth, requireRole('VENDOR', 'ADMIN'),
  validate({ query: paginationQuery }),
  asyncHandler(async (req, res) => {
    const decoded = decodeCursor(req.query.cursor);
    const where = { state: 'FUNDED' };
    if (decoded?.createdAt && decoded?.id) {
      where.OR = [
        { createdAt: { lt: new Date(decoded.createdAt) } },
        { AND: [{ createdAt: new Date(decoded.createdAt) }, { id: { lt: decoded.id } }] },
      ];
    }
    const rows = await prisma.gift.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: req.query.limit });
    const next = buildNextCursor(rows, req.query.limit, (it) => ({ createdAt: it.createdAt.toISOString(), id: it.id }));
    res.status(200).json({ data: rows.map(giftService.serializeGift), next_cursor: next });
  })
);

// PATCH /vendor/gifts/:gift_id/purchase — FUNDED → PURCHASED
router.patch('/vendor/gifts/:gift_id/purchase', requireAuth, requireRole('VENDOR', 'ADMIN'),
  validate({ params: giftIdParam }),
  asyncHandler(async (req, res) => {
    const gift = await prisma.gift.findUnique({ where: { id: req.params.gift_id } });
    if (!gift) throw errors.NotFound('Gift');
    if (gift.state !== 'FUNDED') throw errors.Conflict('Gift must be in FUNDED state to purchase', 'GIFT_NOT_FUNDED');

    const updated = await prisma.$transaction(async (tx) => {
      const g = await tx.gift.update({
        where: { id: gift.id },
        data: { state: 'PURCHASED', vendorId: req.user.id },
      });
      await tx.auditLog.create({
        data: { userId: req.user.id, action: 'GIFT_STATE_CHANGED', entityType: 'gift', entityId: gift.id, metadata: { from: 'FUNDED', to: 'PURCHASED', vendorId: req.user.id } },
      });
      return g;
    });

    // Notify host via email
    const registry = await prisma.registry.findUnique({ where: { id: gift.registryId }, include: { host: true } });
    if (registry?.host?.email) {
      await enqueueEmail('gift_purchased', {
        to: registry.host.email,
        hostUsername: registry.host.username,
        giftTitle: gift.title,
        courierId: null,
      });
    }

    res.status(200).json(giftService.serializeGift(updated));
  })
);

// GET /vendor/gifts/my — gifts this vendor is handling
router.get('/vendor/gifts/my', requireAuth, requireRole('VENDOR'),
  validate({ query: paginationQuery }),
  asyncHandler(async (req, res) => {
    const rows = await prisma.gift.findMany({
      where: { vendorId: req.user.id },
      orderBy: [{ updatedAt: 'desc' }],
      take: req.query.limit,
    });
    res.status(200).json({ data: rows.map(giftService.serializeGift), count: rows.length });
  })
);

// ── COURIER endpoints ──────────────────────────────────────────────────────
// GET /courier/gifts — list all PURCHASED gifts (available to deliver)
router.get('/courier/gifts', requireAuth, requireRole('COURIER', 'ADMIN'),
  validate({ query: paginationQuery }),
  asyncHandler(async (req, res) => {
    const decoded = decodeCursor(req.query.cursor);
    const where = { state: 'PURCHASED' };
    if (decoded?.createdAt && decoded?.id) {
      where.OR = [
        { createdAt: { lt: new Date(decoded.createdAt) } },
        { AND: [{ createdAt: new Date(decoded.createdAt) }, { id: { lt: decoded.id } }] },
      ];
    }
    const rows = await prisma.gift.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: req.query.limit });
    const next = buildNextCursor(rows, req.query.limit, (it) => ({ createdAt: it.createdAt.toISOString(), id: it.id }));
    res.status(200).json({ data: rows.map(giftService.serializeGift), next_cursor: next });
  })
);

// PATCH /courier/gifts/:gift_id/deliver — PURCHASED → DELIVERED
router.patch('/courier/gifts/:gift_id/deliver', requireAuth, requireRole('COURIER', 'ADMIN'),
  validate({ params: giftIdParam }),
  asyncHandler(async (req, res) => {
    const gift = await prisma.gift.findUnique({ where: { id: req.params.gift_id } });
    if (!gift) throw errors.NotFound('Gift');
    if (gift.state !== 'PURCHASED') throw errors.Conflict('Gift must be in PURCHASED state to deliver', 'GIFT_NOT_PURCHASED');

    const updated = await prisma.$transaction(async (tx) => {
      const g = await tx.gift.update({
        where: { id: gift.id },
        data: { state: 'DELIVERED', courierId: req.user.id },
      });
      await tx.auditLog.create({
        data: { userId: req.user.id, action: 'GIFT_STATE_CHANGED', entityType: 'gift', entityId: gift.id, metadata: { from: 'PURCHASED', to: 'DELIVERED', courierId: req.user.id } },
      });
      return g;
    });

    // Notify host via email
    const registry = await prisma.registry.findUnique({ where: { id: gift.registryId }, include: { host: true } });
    if (registry?.host?.email) {
      await enqueueEmail('gift_delivered', {
        to: registry.host.email,
        hostUsername: registry.host.username,
        giftTitle: gift.title,
      });
    }

    res.status(200).json(giftService.serializeGift(updated));
  })
);

// GET /courier/gifts/my — gifts this courier is delivering
router.get('/courier/gifts/my', requireAuth, requireRole('COURIER'),
  asyncHandler(async (req, res) => {
    const rows = await prisma.gift.findMany({
      where: { courierId: req.user.id },
      orderBy: [{ updatedAt: 'desc' }],
    });
    res.status(200).json({ data: rows.map(giftService.serializeGift), count: rows.length });
  })
);

// ── Gift cancel (HOST) ─────────────────────────────────────────────────────
router.patch('/gifts/:gift_id/cancel', requireAuth, requireRole('HOST'),
  validate({ params: giftIdParam }),
  asyncHandler(async (req, res) => {
    const gift = await prisma.gift.findUnique({ where: { id: req.params.gift_id } });
    if (!gift) throw errors.NotFound('Gift');
    if (!['PENDING', 'FUNDED'].includes(gift.state)) {
      throw errors.Conflict('Only PENDING or FUNDED gifts can be cancelled', 'GIFT_CANNOT_CANCEL');
    }
    const registry = await prisma.registry.findUnique({ where: { id: gift.registryId } });
    if (registry.hostId !== req.user.id) throw errors.Forbidden('Only the registry host can cancel gifts');

    const updated = await prisma.$transaction(async (tx) => {
      const g = await tx.gift.update({ where: { id: gift.id }, data: { state: 'CANCELLED' } });
      // Mark all funded contributions as refunded
      await tx.contribution.updateMany({ where: { giftId: gift.id, status: 'FUNDED' }, data: { status: 'REFUNDED' } });
      await tx.auditLog.create({ data: { userId: req.user.id, action: 'GIFT_STATE_CHANGED', entityType: 'gift', entityId: gift.id, metadata: { from: gift.state, to: 'CANCELLED' } } });
      return g;
    });
    res.status(200).json(giftService.serializeGift(updated));
  })
);

// ── Admin ──────────────────────────────────────────────────────────────────
router.get('/admin/users', requireAuth, requireRole('ADMIN'),
  validate({ query: paginationQuery.extend({ role: z.enum(['HOST', 'GUEST', 'VENDOR', 'COURIER', 'ADMIN']).optional() }) }),
  asyncHandler(async (req, res) => {
    const decoded = decodeCursor(req.query.cursor);
    const where = {};
    if (req.query.role) where.role = req.query.role;
    if (decoded?.createdAt && decoded?.id) {
      where.OR = [
        { createdAt: { lt: new Date(decoded.createdAt) } },
        { AND: [{ createdAt: new Date(decoded.createdAt) }, { id: { lt: decoded.id } }] },
      ];
    }
    const rows = await prisma.user.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: req.query.limit });
    const next = buildNextCursor(rows, req.query.limit, (it) => ({ createdAt: it.createdAt.toISOString(), id: it.id }));
    res.status(200).json({ data: rows.map(authService.publicUser), next_cursor: next });
  })
);

// PATCH /admin/users/:user_id/activate — activate/deactivate user
router.patch('/admin/users/:user_id/activate', requireAuth, requireRole('ADMIN'),
  validate({ params: z.object({ user_id: z.string().uuid() }), body: z.object({ isActive: z.boolean() }) }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.user_id } });
    if (!user) throw errors.NotFound('User');
    const updated = await prisma.user.update({ where: { id: req.params.user_id }, data: { isActive: req.body.isActive } });
    res.status(200).json(authService.publicUser(updated));
  })
);

// ── Queue status ───────────────────────────────────────────────────────────
router.get('/admin/queue-status', requireAuth, requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const status = await getQueueStatus();
    res.status(200).json(status);
  })
);

module.exports = router;