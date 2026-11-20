// The egg's outline, in millimetres. Every release draws and measures the egg
// from these functions, so the outline is the same everywhere.
//
// Coordinates: x is across the egg, 0 on its axis, positive to the right.
// height is up the egg, 0 at the base, EGG_HEIGHT_MM at the point.
import { EGG_PROFILE_RIGHT } from './egg-profile-data.js';

// One half-width per height, heights strictly rising, for looking up the
// egg's width at any height. The profile has two points at the same height
// at each tip (the flat of the tip); the wider one is kept.
function buildWidthTable(points) {
  const rows = [];
  for (const [x, height] of points) {
    const last = rows[rows.length - 1];
    if (last && height < last.height) {
      throw new Error('egg profile: heights must not fall');
    }
    if (last && height === last.height) {
      if (x > last.x) last.x = x;
    } else {
      rows.push({ x, height });
    }
  }
  return rows;
}

const WIDTH_TABLE = buildWidthTable(EGG_PROFILE_RIGHT);

export const EGG_HEIGHT_MM = WIDTH_TABLE[WIDTH_TABLE.length - 1].height;

const WIDEST = WIDTH_TABLE.reduce((best, row) => (row.x > best.x ? row : best));
export const EGG_HALF_WIDTH_MM = WIDEST.x;
export const EGG_WIDTH_MM = 2 * WIDEST.x;
export const EGG_WIDEST_HEIGHT_MM = WIDEST.height;

// Half the egg's width at a height. 0 above the point and below the base.
export function halfWidthAt(heightMm) {
  if (!(heightMm >= 0 && heightMm <= EGG_HEIGHT_MM)) return 0;
  let low = 0;
  let high = WIDTH_TABLE.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (WIDTH_TABLE[middle].height <= heightMm) low = middle;
    else high = middle;
  }
  const a = WIDTH_TABLE[low];
  const b = WIDTH_TABLE[high];
  const t = (heightMm - a.height) / (b.height - a.height);
  return a.x + (b.x - a.x) * t;
}

export function isInsideEgg(xMm, heightMm) {
  if (!(heightMm >= 0 && heightMm <= EGG_HEIGHT_MM)) return false;
  return Math.abs(xMm) <= halfWidthAt(heightMm);
}

// The whole outline as one closed loop: up the right side from the base to
// the point, then down the left side. The two points on the axis are not
// repeated.
export function outlinePoints() {
  const right = EGG_PROFILE_RIGHT.map(([x, height]) => ({ x, height }));
  const left = [];
  for (let i = EGG_PROFILE_RIGHT.length - 2; i >= 1; i -= 1) {
    const [x, height] = EGG_PROFILE_RIGHT[i];
    left.push({ x: -x, height });
  }
  return right.concat(left);
}
