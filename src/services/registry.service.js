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

  // ADMIN sees everything. Host sees their own. Others must be public OR be
  // a linked guest in this registry.
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

module.exports = { createRegistry, getRegistry, listRegistries, updateRegistry, deleteRegistry, serializeRegistry };

async function updateRegistry({ id, hostId, body }) {
  const reg = await prisma.registry.findUnique({ where: { id } });
  if (!reg) throw errors.NotFound('Registry');
  if (reg.hostId !== hostId) throw errors.Forbidden('Only the registry host can update it');
  const updated = await prisma.registry.update({
    where: { id },
    data: {
      ...(body.title && { title: body.title }),
      ...(body.event_date && { eventDate: body.event_date }),
      ...(body.is_public !== undefined && { isPublic: body.is_public }),
    },
  });
  return serializeRegistry(updated);
}

async function deleteRegistry({ id, hostId }) {
  const reg = await prisma.registry.findUnique({ where: { id } });
  if (!reg) throw errors.NotFound('Registry');
  if (reg.hostId !== hostId) throw errors.Forbidden('Only the registry host can delete it');
  await prisma.registry.delete({ where: { id } });
}