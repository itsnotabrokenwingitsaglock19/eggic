// How far inside the egg a place is: the distance from its outline, for
// looks whose picture depends on it. Places are in millimetres on the egg:
// x from its axis, height from its base. No browser parts.
import { EGG_HEIGHT_MM, EGG_HALF_WIDTH_MM, isInsideEgg, outlinePoints } from './egg-outline.js';

// The distance from the egg's outline, worked out once on a grid of points
// `stepMm` apart that reaches `sideMm` beyond the egg on every side:
// positive inside the egg, negative outside. Between the points it is read
// off smoothly.
export function createEggDistance(sideMm, stepMm = 1) {
  const outline = outlinePoints();
  const minX = -(Math.ceil((EGG_HALF_WIDTH_MM + sideMm) / stepMm) * stepMm);
  const minH = -(Math.ceil(sideMm / stepMm) * stepMm);
  const columns = Math.round((-2 * minX) / stepMm) + 1;
  const rows = Math.ceil((EGG_HEIGHT_MM + sideMm - minH) / stepMm) + 1;
  const values = new Float32Array(columns * rows);

  function toOutline(x, h) {
    let least = Infinity;
    for (let i = 0; i < outline.length; i += 1) {
      const a = outline[i];
      const b = outline[(i + 1) % outline.length];
      const ex = b.x - a.x;
      const eh = b.height - a.height;
      const along = Math.min(1, Math.max(0, ((x - a.x) * ex + (h - a.height) * eh) / (ex * ex + eh * eh)));
      const dx = x - (a.x + ex * along);
      const dh = h - (a.height + eh * along);
      least = Math.min(least, dx * dx + dh * dh);
    }
    return Math.sqrt(least);
  }

  // The egg is the same left and right, so one half is worked out.
  const middle = (columns - 1) / 2;
  for (let row = 0; row < rows; row += 1) {
    const h = minH + row * stepMm;
    for (let column = middle; column < columns; column += 1) {
      const x = minX + column * stepMm;
      const distance = toOutline(x, h) * (isInsideEgg(x, h) ? 1 : -1);
      values[row * columns + column] = distance;
      values[row * columns + (columns - 1 - column)] = distance;
    }
  }

  function at(x, h) {
    const u = Math.min(columns - 1.001, Math.max(0, (x - minX) / stepMm));
    const v = Math.min(rows - 1.001, Math.max(0, (h - minH) / stepMm));
    const column = Math.floor(u);
    const row = Math.floor(v);
    const fu = u - column;
    const fv = v - row;
    const i = row * columns + column;
    const low = values[i] + (values[i + 1] - values[i]) * fu;
    const high = values[i + columns] + (values[i + columns + 1] - values[i + columns]) * fu;
    return low + (high - low) * fv;
  }

  return {
    at,
    // The way that leads deeper into the egg from a place: { x, h }, of
    // length 1.
    inward(x, h) {
      const gx = at(x + 0.5, h) - at(x - 0.5, h);
      const gh = at(x, h + 0.5) - at(x, h - 0.5);
      const length = Math.hypot(gx, gh) || 1;
      return { x: gx / length, h: gh / length };
    },
    bounds: { minX, maxX: -minX, minH, maxH: minH + (rows - 1) * stepMm },
  };
}
