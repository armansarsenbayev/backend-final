'use strict';

const { Prisma } = require('@prisma/client');
const { prisma } = require('../lib/prisma');
const { errors } = require('../lib/errors');
const { decodeCursor, buildNextCursor } = require('../utils/pagination');

function serializeGift(g) {
  return {
    id: g.id,
    registry_id: g.registryId,
    title: g.title,
    description: g.description,
    target_amount_kzt: Number(g.targetAmountKzt),
    current_amount_kzt: Number(g.currentAmountKzt),
    required_tier_rank: g.requiredTierRank,
    is_fragile: g.isFragile,
    state: g.state,
    created_at: g.createdAt,
  };
}

async function createGift({ registryId, hostId, body }) {
  const reg = await prisma.registry.findUnique({ where: { id: registryId } });
  if (!reg) throw errors.NotFound('Registry');
  if (reg.hostId !== hostId) throw errors.Forbidden('Only the registry host can add gifts');

  const gift = await prisma.$transaction(async (tx) => {
    const g = await tx.gift.create({
      data: {
        registryId,
        title: body.title,
        description: body.description,
        targetAmountKzt: new Prisma.Decimal(body.target_amount_kzt),
        requiredTierRank: body.required_tier_rank ?? 0,
        isFragile: body.is_fragile ?? false,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: hostId,
        action: 'GIFT_CREATED',
        entityType: 'gift',
        entityId: g.id,
        metadata: { registryId, title: g.title, target: Number(g.targetAmountKzt) },
      },
    });
    return g;
  });
  return serializeGift(gift);
}

async function getGift({ id, requesterId, requesterRole }) {
  const g = await prisma.gift.findUnique({ where: { id } });
  if (!g) throw errors.NotFound('Gift');

  if (requesterRole === 'GUEST') {
    const guestLink = await prisma.guest.findFirst({
      where: { registryId: g.registryId, userId: requesterId },
    });
    if (guestLink && guestLink.tierRank > g.requiredTierRank) {
      throw errors.Forbidden('Gift is restricted to a closer kinship tier');
    }
  }
  return serializeGift(g);
}

async function listGiftsByRegistry({ registryId, requesterId, requesterRole, state, cursor, limit }) {
  const reg = await prisma.registry.findUnique({ where: { id: registryId } });
  if (!reg) throw errors.NotFound('Registry');

  const decoded = decodeCursor(cursor);
  const where = { registryId };
  if (state) where.state = state;

  if (requesterRole === 'GUEST' && reg.hostId !== requesterId) {
    const guestLink = await prisma.guest.findFirst({
      where: { registryId, userId: requesterId },
    });
    where.requiredTierRank = { gte: guestLink ? guestLink.tierRank : 5 };
  }

  if (decoded?.createdAt && decoded?.id) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { createdAt: { lt: new Date(decoded.createdAt) } },
          { AND: [{ createdAt: new Date(decoded.createdAt) }, { id: { lt: decoded.id } }] },
        ],
      },
    ];
  }

  const rows = await prisma.gift.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });

  const next = buildNextCursor(rows, limit, (it) => ({
    createdAt: it.createdAt.toISOString(),
    id: it.id,
  }));
  return { data: rows.map(serializeGift), next_cursor: next };
}

module.exports = { createGift, getGift, listGiftsByRegistry, serializeGift };