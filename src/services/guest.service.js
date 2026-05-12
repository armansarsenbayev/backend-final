'use strict';

const { prisma } = require('../lib/prisma');
const { errors } = require('../lib/errors');
const { decodeCursor, buildNextCursor } = require('../utils/pagination');

function serializeGuest(g) {
  return {
    id: g.id,
    registry_id: g.registryId,
    parent_id: g.parentId,
    user_id: g.userId,
    display_name: g.displayName,
    kinship_label: g.kinshipLabel,
    tier_rank: g.tierRank,
    created_at: g.createdAt,
  };
}

async function createGuest({ registryId, hostId, body }) {
  const reg = await prisma.registry.findUnique({ where: { id: registryId } });
  if (!reg) throw errors.NotFound('Registry');
  if (reg.hostId !== hostId) throw errors.Forbidden('Only the registry host can add guests');

  // Parent must belong to the same registry (also enforced by DB CHECK constraint).
  if (body.parent_id) {
    const parent = await prisma.guest.findUnique({ where: { id: body.parent_id } });
    if (!parent) throw errors.NotFound('Parent guest');
    if (parent.registryId !== registryId) {
      throw errors.ValidationError([
        { field: 'parent_id', issue: 'must belong to the same registry' },
      ]);
    }
  }

  const guest = await prisma.guest.create({
    data: {
      registryId,
      parentId: body.parent_id ?? null,
      userId: body.user_id ?? null,
      displayName: body.display_name,
      kinshipLabel: body.kinship_label,
      tierRank: body.tier_rank,
    },
  });

  return serializeGuest(guest);
}

async function listGuests({ registryId, requesterId, requesterRole, cursor, limit }) {
  const reg = await prisma.registry.findUnique({ where: { id: registryId } });
  if (!reg) throw errors.NotFound('Registry');
  if (
    requesterRole !== 'ADMIN' &&
    reg.hostId !== requesterId &&
    !reg.isPublic
  ) {
    throw errors.Forbidden('Not authorized to view guests of this registry');
  }

  const decoded = decodeCursor(cursor);
  const where = { registryId };
  if (decoded?.createdAt && decoded?.id) {
    where.OR = [
      { createdAt: { lt: new Date(decoded.createdAt) } },
      { AND: [{ createdAt: new Date(decoded.createdAt) }, { id: { lt: decoded.id } }] },
    ];
  }

  const rows = await prisma.guest.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });

  const next = buildNextCursor(rows, limit, (it) => ({
    createdAt: it.createdAt.toISOString(),
    id: it.id,
  }));
  return { data: rows.map(serializeGuest), next_cursor: next };
}

module.exports = { createGuest, listGuests, updateGuest, deleteGuest, serializeGuest };

async function updateGuest({ id, registryId, hostId, body }) {
  const reg = await prisma.registry.findUnique({ where: { id: registryId } });
  if (!reg) throw errors.NotFound('Registry');
  if (reg.hostId !== hostId) throw errors.Forbidden('Only the registry host can update guests');
  const guest = await prisma.guest.findUnique({ where: { id } });
  if (!guest || guest.registryId !== registryId) throw errors.NotFound('Guest');

  if (body.parent_id) {
    const parent = await prisma.guest.findUnique({ where: { id: body.parent_id } });
    if (!parent || parent.registryId !== registryId) throw errors.ValidationError([{ field: 'parent_id', issue: 'must belong to the same registry' }]);
  }
  const updated = await prisma.guest.update({
    where: { id },
    data: {
      ...(body.display_name && { displayName: body.display_name }),
      ...(body.kinship_label && { kinshipLabel: body.kinship_label }),
      ...(body.tier_rank !== undefined && { tierRank: body.tier_rank }),
      ...(body.parent_id !== undefined && { parentId: body.parent_id }),
      ...(body.user_id !== undefined && { userId: body.user_id }),
    },
  });
  return serializeGuest(updated);
}

async function deleteGuest({ id, registryId, hostId }) {
  const reg = await prisma.registry.findUnique({ where: { id: registryId } });
  if (!reg) throw errors.NotFound('Registry');
  if (reg.hostId !== hostId) throw errors.Forbidden('Only the registry host can delete guests');
  const guest = await prisma.guest.findUnique({ where: { id } });
  if (!guest || guest.registryId !== registryId) throw errors.NotFound('Guest');
  // Unlink children before deleting
  await prisma.guest.updateMany({ where: { parentId: id }, data: { parentId: null } });
  await prisma.guest.delete({ where: { id } });
}