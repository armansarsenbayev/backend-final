'use strict';

const { prisma } = require('../lib/prisma');
const { errors } = require('../lib/errors');


async function getFamilyTree({ rootGuestId, maxDepth = 10 }) {
  const root = await prisma.guest.findUnique({ where: { id: rootGuestId } });
  if (!root) throw errors.NotFound('Guest');

  const maxDepthInt = parseInt(maxDepth, 10);

  const rows = await prisma.$queryRawUnsafe(`
    WITH RECURSIVE tree AS (
      SELECT
        g.id,
        g."parentId",
        g."displayName",
        g."kinshipLabel",
        g."tierRank",
        g."registryId",
        0            AS depth,
        ARRAY[g.id]  AS path
      FROM guests g
      WHERE g.id = '${rootGuestId}'::uuid

      UNION ALL

      SELECT
        c.id,
        c."parentId",
        c."displayName",
        c."kinshipLabel",
        c."tierRank",
        c."registryId",
        t.depth + 1,
        t.path || c.id
      FROM guests c
      JOIN tree t ON c."parentId" = t.id
      WHERE NOT c.id = ANY(t.path)
        AND t.depth < ${maxDepthInt}
    )
    SELECT
      t.id,
      t."parentId"     AS parent_id,
      t."displayName"  AS display_name,
      t."kinshipLabel" AS kinship_label,
      t."tierRank"     AS tier_rank,
      t.depth,
      CASE
        WHEN t."tierRank" = 0 THEN 100000
        WHEN t."tierRank" = 1 THEN  50000
        WHEN t."tierRank" = 2 THEN  20000
        ELSE                        10000
      END AS suggested_kzt,
      COALESCE((
        SELECT SUM(contrib."amountKzt")
        FROM contributions contrib
        WHERE contrib."guestId" = t.id
          AND contrib.status = 'FUNDED'
      ), 0) AS funded_kzt
    FROM tree t
    ORDER BY t.depth ASC, t."displayName" ASC
  `);

  return {
    root_id: rootGuestId,
    nodes: rows.map((r) => ({
      id: r.id,
      parent_id: r.parent_id,
      display_name: r.display_name,
      kinship_label: r.kinship_label,
      tier_rank: Number(r.tier_rank),
      depth: Number(r.depth),
      suggested_kzt: Number(r.suggested_kzt),
      funded_kzt: Number(r.funded_kzt),
    })),
  };
}

module.exports = { getFamilyTree };