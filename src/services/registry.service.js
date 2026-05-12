'use strict';

const { prisma } = require('../lib/prisma');
const { errors } = require('../lib/errors');
const { decodeCursor, buildNextCursor } = require('../utils/pagination');

function serializeRegistry(r) {
  return {
    id: r.id,
    host_id: r.hostId,
    title: r.title,
    event_date: r.eventDate,
    is_public: r.isPublic,
    created_at: r.createdAt,
  };
}

async function createRegistry({ hostId, title, eventDate, isPublic }) {
  const registry = await prisma.$transaction(async (tx) => {
    const r = await tx.registry.create({
      data: { hostId, title, eventDate, isPublic },
    });
    await tx.auditLog.create({
      data: {
        userId: hostId,
        action: 'REGISTRY_CREATED',
        entityType: 'registry',
        entityId: r.id,
        metadata: { title },
      },
    });
    return r;
  });
  return serializeRegistry(registry);
}

async function getRegistry({ id, requesterId, requesterRole }) {
  const r = await prisma.registry.findUnique({ where: { id } });
  if (!r) throw errors.NotFound('Registry');

  if (requesterRole === 'ADMIN' || r.hostId === requesterId || r.isPublic) {
    return serializeRegistry(r);
  }
  const guestLink = await prisma.guest.findFirst({
    where: { registryId: id, userId: requesterId },
  });
  if (!guestLink) throw errors.Forbidden('Not authorized to view this registry');
  return serializeRegistry(r);
}

async function listRegistries({ requesterId, requesterRole, cursor, limit }) {
  const decoded = decodeCursor(cursor);

  // Visibility: HOSTs see their own; ADMIN sees all; others see public only.
  const where = requesterRole === 'ADMIN'
    ? {}
    : {
        OR: [
          { hostId: requesterId },
          { isPublic: true },
          { guests: { some: { userId: requesterId } } },
        ],
      };

  if (decoded?.createdAt && decoded?.id) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { createdAt: { lt: new Date(decoded.createdAt) } },
          {
            AND: [
              { createdAt: new Date(decoded.createdAt) },
              { id: { lt: decoded.id } },
            ],
          },
        ],
      },
    ];
  }

  const rows = await prisma.registry.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });

  const next = buildNextCursor(rows, limit, (it) => ({
    createdAt: it.createdAt.toISOString(),
    id: it.id,
  }));
  return { data: rows.map(serializeRegistry), next_cursor: next };
}

module.exports = { createRegistry, getRegistry, listRegistries, serializeRegistry };