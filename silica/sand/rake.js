// The rake: two fingers on the sand carry a row of tines between them, and
// each tine combs its own thin groove. Moved together, the fingers draw
// parallel lines.

// Where the tines sit between the two fingers, as shares of the way from
// the first finger to the second (0 to 1), for fingers this far apart. The
// tines are evenly spaced, centred between the fingers, and keep clear of
// the fingers' own grooves. The fingers may be too close for any tine, and
// there are never more than `mostTines`.
export function tineShares(apartMm, rake) {
  const room = apartMm - 2 * rake.clearMm;
  if (!(room >= 0)) return [];
  // With the fingers far apart the rake has its full number of tines and
  // stays centred between them.
  const gaps = Math.min(Math.floor(room / rake.spacingMm), rake.mostTines - 1);
  const first = (apartMm - gaps * rake.spacingMm) / 2;
  const shares = [];
  for (let k = 0; k <= gaps; k += 1) shares.push((first + k * rake.spacingMm) / apartMm);
  return shares;
}

// Where those tines are now, for the fingers at a and b ({ x, y } in mm).
export function tinePoints(a, b, shares) {
  return shares.map((share) => ({ x: a.x + (b.x - a.x) * share, y: a.y + (b.y - a.y) * share }));
}
