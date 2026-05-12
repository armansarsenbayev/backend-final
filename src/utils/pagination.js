'use strict';



function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const json = Buffer.from(String(cursor), 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Build a "next page" cursor from the last item of a result page.
 *
 * @param {Array}  items        the page just returned
 * @param {number} limit        the page size requested
 * @param {Function} extractor  (item) => keyset object
 * @returns {string|null}       base64url cursor or null if no next page
 */
function buildNextCursor(items, limit, extractor) {
  if (!Array.isArray(items) || items.length < limit) return null;
  const last = items[items.length - 1];
  return encodeCursor(extractor(last));
}

module.exports = { encodeCursor, decodeCursor, buildNextCursor };