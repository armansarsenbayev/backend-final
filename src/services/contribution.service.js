'use strict';

const { Prisma } = require('@prisma/client');
const { prisma } = require('../lib/prisma');
const { errors } = require('../lib/errors');
const { getRateToKzt, round2 } = require('./exchange.service');
const { decodeCursor, buildNextCursor } = require('../utils/pagination');
const { enqueueEmail } = require('../lib/queue');


async function createContribution({ giftId, guestId, amountOriginal, currencyOriginal, actorUserId }) {
  const rate = await getRateToKzt(currencyOriginal);
  const amountKzt = round2(amountOriginal * rate);
  if (amountKzt <= 0) {
    throw errors.ValidationError([{ field: 'amount_original', issue: 'rounds to zero KZT' }]);
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const gift = await tx.gift.findUnique({ where: { id: giftId } });
      if (!gift) throw errors.NotFound('Gift');

      if (gift.state !== 'PENDING') {
        throw errors.GiftNotOpen();
      }

      const guest = await tx.guest.findUnique({ where: { id: guestId } });
      if (!guest) throw errors.NotFound('Guest');
      if (guest.registryId !== gift.registryId) {
        throw errors.Forbidden("Guest does not belong to this gift's registry");
      }

      if (guest.tierRank > gift.requiredTierRank) {
        throw errors.Forbidden(
          `Guest tier rank (${guest.tierRank}) is insufficient for this gift (requires tier <= ${gift.requiredTierRank})`
        );
      }

      const current = Number(gift.currentAmountKzt);
      const target  = Number(gift.targetAmountKzt);
      const newCurrent = round2(current + amountKzt);
      if (newCurrent > target) {
        throw errors.PoolCapExceeded();
      }

      const contribution = await tx.contribution.create({
        data: {
          giftId,
          guestId,
          amountKzt:        new Prisma.Decimal(amountKzt),
          amountOriginal:   new Prisma.Decimal(amountOriginal),
          currencyOriginal,
          exchangeRate:     new Prisma.Decimal(rate),
          rateLockedAt:     new Date(),
          status:           'FUNDED',
        },
      });

      const reachedTarget = newCurrent >= target;
      const updated = await tx.gift.update({
        where: { id: giftId },
        data: {
          currentAmountKzt: new Prisma.Decimal(newCurrent),
          version:          { increment: 1 },
          ...(reachedTarget ? { state: 'FUNDED' } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId:     actorUserId || null,
          action:     'CONTRIBUTION_FUNDED',
          entityType: 'contribution',
          entityId:   contribution.id,
          metadata: {
            giftId,
            guestId,
            amountKzt,
            amountOriginal,
            currency: currencyOriginal,
            rate,
          },
        },
      });

      if (reachedTarget) {
        await tx.auditLog.create({
          data: {
            userId:     actorUserId || null,
            action:     'GIFT_STATE_CHANGED',
            entityType: 'gift',
            entityId:   giftId,
            metadata:   { from: 'PENDING', to: 'FUNDED' },
          },
        });
      }

      return { contribution, gift: updated, reachedTarget };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 },
  );

  if (result.reachedTarget) {
    const registry = await prisma.registry.findUnique({
      where: { id: result.gift.registryId },
      include: { host: true },
    });
    if (registry?.host?.email) {
      await enqueueEmail('gift_funded', {
        to: registry.host.email,
        hostUsername: registry.host.username,
        giftTitle: result.gift.title,
        registryTitle: registry.title,
      });
    }
  }

  return result;
}


async function listContributions({ giftId, status, cursor, limit }) {
  const decoded = decodeCursor(cursor);

  const where = { giftId, ...(status ? { status } : {}) };
  if (decoded?.createdAt && decoded?.id) {
    where.OR = [
      { createdAt: { lt: new Date(decoded.createdAt) } },
      {
        AND: [
          { createdAt: new Date(decoded.createdAt) },
          { id: { lt: decoded.id } },
        ],
      },
    ];
  }

  const rows = await prisma.contribution.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });

  const nextCursor = buildNextCursor(rows, limit, (it) => ({
    createdAt: it.createdAt.toISOString(),
    id: it.id,
  }));

  return { data: rows.map(serializeContribution), next_cursor: nextCursor };
}

function serializeContribution(c) {
  return {
    id:               c.id,
    gift_id:          c.giftId,
    guest_id:         c.guestId,
    amount_kzt:       Number(c.amountKzt),
    amount_original:  Number(c.amountOriginal),
    currency_original: c.currencyOriginal,
    exchange_rate:    Number(c.exchangeRate),
    rate_locked_at:   c.rateLockedAt,
    status:           c.status,
    created_at:       c.createdAt,
  };
}

module.exports = { createContribution, listContributions, serializeContribution };