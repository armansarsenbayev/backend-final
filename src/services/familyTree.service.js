'use strict';

const { prisma } = require('../lib/prisma');
const { errors } = require('../lib/errors');

/**
 * Build the family tree for a given root guest using pure Prisma ORM.
 * Strategy:
 *   1. Load all guests in the same registry in one query.
 *   2. Traverse the subtree rooted at rootGuestId using BFS (in JS).
 *   3. Fetch funded contribution totals in one groupBy query.
 * No raw SQL — satisfies "ORM only" submission constraint.
 */
async function getFamilyTree({ rootGuestId, maxDepth = 10 }) {
  const root = await prisma.guest.findUnique({ where: { id: rootGuestId } });
  if (!root) throw errors.NotFound('Guest');

  const maxDepthInt = Math.max(1, Math.min(parseInt(maxDepth, 10) || 10, 20));

  // Load every guest in this registry once — avoids N+1 queries
  const allGuests = await prisma.guest.findMany({
    where: { registryId: root.registryId },
  });

  const guestById = new Map(allGuests.map((g) => [g.id, g]));

  // Build parent → children index
  const childrenOf = new Map();
  for (const g of allGuests) {
    if (!g.parentId) continue;
    if (!childrenOf.has(g.parentId)) childrenOf.set(g.parentId, []);
    childrenOf.get(g.parentId).push(g.id);
  }

  // BFS from rootGuestId, honouring maxDepth and cycle-guard
  const visited = []; // { id, depth }
  const seen = new Set();
  const queue = [{ id: rootGuestId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);

    const guest = guestById.get(id);
    if (!guest) continue;

    visited.push({ guest, depth });

    if (depth < maxDepthInt) {
      for (const childId of childrenOf.get(id) ?? []) {
        if (!seen.has(childId)) queue.push({ id: childId, depth: depth + 1 });
      }
    }
  }

  // Aggregate funded contributions for all visited guests in one query
  const visitedIds = visited.map(({ guest }) => guest.id);
  const contribAgg = await prisma.contribution.groupBy({
    by: ['guestId'],
    where: { guestId: { in: visitedIds }, status: 'FUNDED' },
    _sum: { amountKzt: true },
  });
  const fundedByGuest = new Map(
    contribAgg.map((row) => [row.guestId, Number(row._sum.amountKzt ?? 0)])
  );

  // Sort: depth ASC, displayName ASC (mirrors original CTE ORDER BY)
  visited.sort((a, b) =>
    a.depth !== b.depth
      ? a.depth - b.depth
      : (a.guest.displayName ?? '').localeCompare(b.guest.displayName ?? '')
  );

  const suggestedKzt = (tierRank) => {
    if (tierRank === 0) return 100000;
    if (tierRank === 1) return 50000;
    if (tierRank === 2) return 20000;
    return 10000;
  };

  return {
    root_id: rootGuestId,
    nodes: visited.map(({ guest, depth }) => ({
      id: guest.id,
      parent_id: guest.parentId,
      display_name: guest.displayName,
      kinship_label: guest.kinshipLabel,
      tier_rank: Number(guest.tierRank),
      depth,
      suggested_kzt: suggestedKzt(Number(guest.tierRank)),
      funded_kzt: fundedByGuest.get(guest.id) ?? 0,
    })),
  };
}

module.exports = { getFamilyTree };
