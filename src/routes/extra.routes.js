'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { prisma } = require('../lib/prisma');
const { errors } = require('../lib/errors');
const { enqueueEmail } = require('../lib/queue');
const { getQueueStatus } = require('../lib/queue');
const { env } = require('../config/env');
const familyTreeService = require('../services/familyTree.service');
const authService = require('../services/auth.service');
const giftService = require('../services/gift.service');
const { familyTreeQuery, paginationQuery } = require('../schemas/domain.schema');
const { decodeCursor, buildNextCursor } = require('../utils/pagination');

const router = express.Router();

const guestIdParam = z.object({ guest_id: z.string().uuid() });
const giftIdParam  = z.object({ gift_id: z.string().uuid() });

router.get('/users/lookup', requireAuth,
  validate({ query: z.object({ username: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { username: req.query.username },
      select: { id: true, username: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) throw errors.NotFound('User');
    res.status(200).json({ id: user.id, username: user.username, role: user.role });
  })
);

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

router.get('/courier/gifts/my', requireAuth, requireRole('COURIER'),
  asyncHandler(async (req, res) => {
    const rows = await prisma.gift.findMany({
      where: { courierId: req.user.id },
      orderBy: [{ updatedAt: 'desc' }],
    });
    res.status(200).json({ data: rows.map(giftService.serializeGift), count: rows.length });
  })
);

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
      await tx.contribution.updateMany({ where: { giftId: gift.id, status: 'FUNDED' }, data: { status: 'REFUNDED' } });
      await tx.auditLog.create({ data: { userId: req.user.id, action: 'GIFT_STATE_CHANGED', entityType: 'gift', entityId: gift.id, metadata: { from: gift.state, to: 'CANCELLED' } } });
      return g;
    });
    res.status(200).json(giftService.serializeGift(updated));
  })
);

router.get('/admin/registries', requireAuth, requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const rows = await prisma.registry.findMany({
      include: {
        host: { select: { id: true, username: true, email: true } },
        _count: { select: { gifts: true, guests: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const data = rows.map((r) => ({
      id: r.id,
      title: r.title,
      event_date: r.eventDate,
      is_public: r.isPublic,
      created_at: r.createdAt,
      host: r.host,
      _count: r._count,
    }));
    res.status(200).json({ data });
  })
);

router.get('/admin/contributions', requireAuth, requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const rows = await prisma.contribution.findMany({
      include: {
        guest: { select: { displayName: true } },
        gift: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const data = rows.map((c) => ({
      id: c.id,
      amount_kzt: Number(c.amountKzt),
      amount_original: Number(c.amountOriginal),
      currency_original: c.currencyOriginal,
      status: c.status,
      created_at: c.createdAt,
      guest: c.guest ? { displayName: c.guest.displayName } : null,
      gift: c.gift ? { title: c.gift.title } : null,
    }));
    res.status(200).json({ data });
  })
);

router.get('/admin/audit-logs', requireAuth, requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const rows = await prisma.auditLog.findMany({
      include: { user: { select: { username: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const data = rows.map((log) => ({
      id: log.id,
      action: log.action,
      entity_type: log.entityType,
      entity_id: log.entityId,
      metadata: log.metadata,
      created_at: log.createdAt,
      user: log.user ? { username: log.user.username, email: log.user.email } : null,
    }));
    res.status(200).json({ data });
  })
);

router.delete('/admin/registries/:registry_id', requireAuth, requireRole('ADMIN'),
  validate({ params: z.object({ registry_id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    await prisma.registry.delete({ where: { id: req.params.registry_id } });
    res.status(204).send();
  })
);

router.delete('/admin/users/:user_id', requireAuth, requireRole('ADMIN'),
  validate({ params: z.object({ user_id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    await prisma.user.delete({ where: { id: req.params.user_id } });
    res.status(204).send();
  })
);

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

router.patch('/admin/users/:user_id/activate', requireAuth, requireRole('ADMIN'),
  validate({ params: z.object({ user_id: z.string().uuid() }), body: z.object({ isActive: z.boolean() }) }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.user_id } });
    if (!user) throw errors.NotFound('User');
    const updated = await prisma.user.update({ where: { id: req.params.user_id }, data: { isActive: req.body.isActive } });
    res.status(200).json(authService.publicUser(updated));
  })
);

router.get('/admin/queue-status', requireAuth, requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const status = await getQueueStatus();
    res.status(200).json(status);
  })
);

router.post('/admin/register-admin',
  asyncHandler(async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (!env.ADMIN_REGISTRATION_KEY || adminKey !== env.ADMIN_REGISTRATION_KEY) {
      throw errors.Forbidden('Invalid or missing admin registration key');
    }

    const parsed = z.object({
      email: z.string().email(),
      username: z.string().min(3).max(30),
      password: z.string().min(8),
    }).safeParse(req.body);

    if (!parsed.success) {
      throw errors.ValidationError(parsed.error.issues.map((i) => ({ field: i.path.join('.'), issue: i.message })));
    }

    const { email, username, password } = parsed.data;

    const [existingEmail, existingUsername] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { username } }),
    ]);
    if (existingEmail) throw errors.EmailTaken();
    if (existingUsername) throw errors.UsernameTaken();

    const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email, username, passwordHash, role: 'ADMIN', isEmailVerified: true, isActive: true },
      });
      await tx.auditLog.create({
        data: { userId: u.id, action: 'USER_REGISTERED', entityType: 'user', entityId: u.id, metadata: { email: u.email, role: 'ADMIN', via: 'admin_registration_key' } },
      });
      return u;
    });

    res.status(201).json(authService.publicUser(user));
  })
);

module.exports = router;