// The sand, as a surface of heights: how deep the sand lies at each point of
// a flat rectangle, the field. A finger pushes sand out of its way, the sand
// piles up beside it and slumps like real sand, and none of it is ever
// created or lost.
//
// Coordinates are millimetres, x to the right and y down, with 0, 0 at the
// middle of the field. The field is cut into square cells; `heights` holds
// one depth per cell, row by row from the top.

// The field is also cut into tiles of TILE x TILE cells. What has changed,
// and where sand may still be sliding, is kept by tile, so that the work
// follows the sand that is actually moving: a long groove costs the tiles
// along it, however far apart its two ends are.
const TILE_SHIFT = 4;
const TILE = 1 << TILE_SHIFT;

export function createSandField(settings, inside) {
  const cellMm = settings.cellMm;
  const cols = Math.round(settings.widthMm / cellMm);
  const rows = Math.round(settings.heightMm / cellMm);
  const heights = new Float64Array(cols * rows);
  const scratch = new Float64Array(cols * rows);
  const left = (-cols * cellMm) / 2;
  const top = (-rows * cellMm) / 2;
  // Sand steeper than this, between neighbouring cells, slides.
  const stepLimit = settings.reposeSlope * cellMm;
  const diagonalLimit = stepLimit * Math.SQRT2;

  const toCol = (xMm) => (xMm - left) / cellMm - 0.5;
  const toRow = (yMm) => (yMm - top) / cellMm - 0.5;

  // Boxes of cells, as { c0, r0, c1, r1 } with both ends included.
  const grow = (box, c0, r0, c1, r1) => {
    c0 = Math.max(0, c0);
    r0 = Math.max(0, r0);
    c1 = Math.min(cols - 1, c1);
    r1 = Math.min(rows - 1, r1);
    if (c0 > c1 || r0 > r1) return box;
    if (!box) return { c0, r0, c1, r1 };
    box.c0 = Math.min(box.c0, c0);
    box.r0 = Math.min(box.r0, r0);
    box.c1 = Math.max(box.c1, c1);
    box.r1 = Math.max(box.r1, r1);
    return box;
  };

  // Flags by tile, with a box of cells around the flagged tiles.
  const tileCols = Math.ceil(cols / TILE);
  const tileRows = Math.ceil(rows / TILE);
  const tileFlags = () => ({ flags: new Uint8Array(tileCols * tileRows), box: null });
  // Flag the tiles that a box of cells touches.
  const flag = (set, c0, r0, c1, r1) => {
    const t0 = Math.max(0, c0 >> TILE_SHIFT);
    const t1 = Math.min(tileCols - 1, c1 >> TILE_SHIFT);
    const u0 = Math.max(0, r0 >> TILE_SHIFT);
    const u1 = Math.min(tileRows - 1, r1 >> TILE_SHIFT);
    if (t0 > t1 || u0 > u1) return;
    for (let u = u0; u <= u1; u += 1) {
      for (let t = t0; t <= t1; t += 1) set.flags[u * tileCols + t] = 1;
    }
    set.box = grow(set.box, t0 * TILE, u0 * TILE, (t1 + 1) * TILE - 1, (u1 + 1) * TILE - 1);
  };
  const unflagAll = (set) => {
    if (set.box) set.flags.fill(0);
    set.box = null;
  };

  const changed = tileFlags(); // changed since the picture last asked
  let loose = tileFlags(); // where sand may still be sliding
  let settling = tileFlags(); // the same, being gathered for the next pass
  let reach = null; // a box around everywhere sand has been since the last reset

  const touched = (c0, r0, c1, r1) => {
    flag(changed, c0, r0, c1, r1);
    reach = grow(reach, c0, r0, c1, r1);
  };

  // ---- the starting shape ------------------------------------------------

  // The sand fills the shape that `inside` describes: level in the middle
  // and sloping down to a low edge at the outline, gently enough to lie
  // still. The distance from the outline is measured in steps across the
  // cells (3 for a step to the side, 4 for a diagonal one).
  const start = new Float64Array(cols * rows);
  {
    const far = 1e9;
    const steps = new Float64Array(cols * rows);
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const isIn = inside(left + (c + 0.5) * cellMm, top + (r + 0.5) * cellMm);
        steps[r * cols + c] = isIn && c > 0 && r > 0 && c < cols - 1 && r < rows - 1 ? far : 0;
      }
    }
    const lower = (i, c, r, dc, dr, cost) => {
      const cc = c + dc;
      const rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) return;
      const through = steps[rr * cols + cc] + cost;
      if (through < steps[i]) steps[i] = through;
    };
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const i = r * cols + c;
        if (steps[i] === 0) continue;
        lower(i, c, r, -1, 0, 3);
        lower(i, c, r, 0, -1, 3);
        lower(i, c, r, -1, -1, 4);
        lower(i, c, r, 1, -1, 4);
      }
    }
    for (let r = rows - 1; r >= 0; r -= 1) {
      for (let c = cols - 1; c >= 0; c -= 1) {
        const i = r * cols + c;
        if (steps[i] === 0) continue;
        lower(i, c, r, 1, 0, 3);
        lower(i, c, r, 0, 1, 3);
        lower(i, c, r, 1, 1, 4);
        lower(i, c, r, -1, 1, 4);
        // The first cell inside the outline holds the low edge itself.
        const insideMm = Math.max(0, steps[i] / 3 - 1) * cellMm;
        start[i] = Math.min(settings.depthMm, settings.edgeMm + settings.edgeSlope * insideMm);
        reach = grow(reach, c, r, c, r);
      }
    }
  }
  const startBox = reach ? { ...reach } : null;
  heights.set(start);
  if (startBox) flag(changed, startBox.c0, startBox.r0, startBox.c1, startBox.r1);

  // ---- pushing ------------------------------------------------------------

  // Add sand at a point between cells, shared among the four cells around it.
  function drop(col, row, amount) {
    col = Math.min(cols - 1, Math.max(0, col));
    row = Math.min(rows - 1, Math.max(0, row));
    const c = Math.min(cols - 2, Math.floor(col));
    const r = Math.min(rows - 2, Math.floor(row));
    const fc = col - c;
    const fr = row - r;
    const i = r * cols + c;
    heights[i] += amount * (1 - fc) * (1 - fr);
    heights[i + 1] += amount * fc * (1 - fr);
    heights[i + cols] += amount * (1 - fc) * fr;
    heights[i + cols + 1] += amount * fc * fr;
  }

  // A number from 0 to 1 that is always the same for the same cell, so that
  // the sand's behaviour never depends on chance.
  function scatter(i) {
    let n = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
    n ^= n >>> 13;
    n = Math.imul(n, 0xc2b2ae35);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  // One press of a round tool at a point. Under the tool the sand may be no
  // deeper than a low floor, rising to the tool's rim; whatever is above
  // that is thrown just outside the rim, away from the tool's middle and
  // forwards along the direction of travel (dirX, dirY: length 1, or 0, 0).
  function press(xMm, yMm, dirX, dirY, tool) {
    const col = toCol(xMm);
    const row = toRow(yMm);
    const radius = tool.radiusMm / cellMm;
    const core = tool.flatPart;
    const reachCells = radius + (tool.throwMm * 1.5) / cellMm + 2;
    const c0 = Math.max(0, Math.ceil(col - radius));
    const c1 = Math.min(cols - 1, Math.floor(col + radius));
    const r0 = Math.max(0, Math.ceil(row - radius));
    const r1 = Math.min(rows - 1, Math.floor(row + radius));
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const dc = c - col;
        const dr = r - row;
        const distance = Math.sqrt(dc * dc + dr * dr);
        if (distance > radius) continue;
        const t = distance / radius;
        const rim = t <= core ? 0 : (t - core) / (1 - core);
        const allowed = tool.floorMm + tool.rimMm * rim * rim;
        const i = r * cols + c;
        const excess = heights[i] - allowed;
        if (excess <= 0) continue;
        heights[i] = allowed;
        const chance = scatter(i);
        let ux = (distance > 0 ? dc / distance : 0) + dirX * tool.forward;
        let uy = (distance > 0 ? dr / distance : 0) + dirY * tool.forward;
        let length = Math.sqrt(ux * ux + uy * uy);
        if (length < 1e-6) {
          ux = Math.cos(chance * 2 * Math.PI);
          uy = Math.sin(chance * 2 * Math.PI);
          length = 1;
        }
        // Turned a little to one side or the other, so that sand straight
        // ahead of the tool is not carried along for ever but works its
        // way out to the sides.
        const turn = (scatter(i + 7919) - 0.5) * 2 * tool.spread;
        const cos = Math.cos(turn) / length;
        const sin = Math.sin(turn) / length;
        const out = radius + (tool.throwMm * (0.5 + chance)) / cellMm;
        drop(col + (ux * cos - uy * sin) * out, row + (ux * sin + uy * cos) * out, excess);
      }
    }
    const lo = (v) => Math.floor(v - reachCells);
    const hi = (v) => Math.ceil(v + reachCells);
    touched(lo(col), lo(row), hi(col), hi(row));
    flag(loose, lo(col), lo(row), hi(col), hi(row));
  }

  // Move a tool from one point to another, pressing at every cell's width
  // on the way. The same point twice is one press with no direction.
  function push(fromX, fromY, toX, toY, tool) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 1e-9) {
      press(toX, toY, 0, 0, tool);
      return;
    }
    const count = Math.max(1, Math.ceil(distance / cellMm));
    for (let k = 1; k <= count; k += 1) {
      const t = k / count;
      press(fromX + dx * t, fromY + dy * t, dx / distance, dy / distance, tool);
    }
  }

  // ---- slumping -----------------------------------------------------------

  // Two neighbouring cells, a and b: if one stands higher than the other by
  // more than the limit, a quarter of the surplus moves down. A surplus too
  // small to move `stillMm` of sand is left where it is, so that the sand
  // comes to rest and nothing creeps unseen. c, r: cell a.
  const leastSurplus = settings.stillMm / 0.25;
  function settle(a, b, limit, c, r) {
    const difference = heights[a] - heights[b];
    let amount = 0;
    if (difference > limit + leastSurplus) amount = (difference - limit) * 0.25;
    else if (difference < -limit - leastSurplus) amount = (difference + limit) * 0.25;
    else return;
    heights[a] -= amount;
    heights[b] += amount;
    flag(changed, c - 1, r, c + 1, r + 1); // cell a and b, whichever neighbour b is
    // Sand that moved may have left its neighbours too steep in turn.
    flag(settling, c - 2, r - 2, c + 2, r + 2);
  }

  // Let sand that stands too steeply slide, wherever it may be loose. The
  // cells are gone through row by row, forwards in one pass and backwards
  // in the next, so that the sand favours no direction. Returns true while
  // sand is still moving.
  function relax(passes) {
    for (let pass = 0; pass < passes && loose.box; pass += 1) {
      const { flags, box } = loose;
      const backwards = pass % 2 === 1;
      const t0 = box.c0 >> TILE_SHIFT;
      const t1 = box.c1 >> TILE_SHIFT;
      for (let k = box.r0; k <= box.r1; k += 1) {
        const r = backwards ? box.r1 - (k - box.r0) : k;
        const tiles = (r >> TILE_SHIFT) * tileCols;
        const below = r + 1 < rows;
        for (let m = t0; m <= t1; m += 1) {
          const t = backwards ? t1 - (m - t0) : m;
          if (!flags[tiles + t]) continue;
          const first = t * TILE;
          const last = Math.min(cols, first + TILE) - 1;
          for (let n = first; n <= last; n += 1) {
            const c = backwards ? last - (n - first) : n;
            const i = r * cols + c;
            const right = c + 1 < cols;
            if (right) settle(i, i + 1, stepLimit, c, r);
            if (below) settle(i, i + cols, stepLimit, c, r);
            if (right && below) settle(i, i + cols + 1, diagonalLimit, c, r);
            if (c > 0 && below) settle(i, i + cols - 1, diagonalLimit, c, r);
          }
        }
      }
      reach = grow(reach, box.c0 - 1, box.r0 - 1, box.c1 + 1, box.r1 + 1);
      unflagAll(loose);
      [loose, settling] = [settling, loose];
    }
    return loose.box !== null;
  }

  // ---- back to the starting shape -----------------------------------------

  // One step of the reset: the sand's ridges and grooves blur, and every
  // cell moves `fraction` of the way to its depth in the starting shape
  // (1 puts the sand exactly back). The total stays the same throughout.
  function towardsStart(fraction, blurPasses) {
    if (!reach) return;
    const { c0, r0, c1, r1 } = reach;
    // The blur stays inside the box of everywhere sand has been: nothing
    // flows across the box's edge, so nothing is lost there.
    for (let pass = 0; pass < blurPasses; pass += 1) {
      for (let r = r0; r <= r1; r += 1) {
        for (let c = c0; c <= c1; c += 1) {
          const i = r * cols + c;
          const here = heights[i];
          let flow = 0;
          if (c > c0) flow += heights[i - 1] - here;
          if (c < c1) flow += heights[i + 1] - here;
          if (r > r0) flow += heights[i - cols] - here;
          if (r < r1) flow += heights[i + cols] - here;
          scratch[i] = here + flow * 0.2;
        }
      }
      for (let r = r0; r <= r1; r += 1) {
        const from = r * cols + c0;
        heights.set(scratch.subarray(from, from + (c1 - c0 + 1)), from);
      }
    }
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const i = r * cols + c;
        heights[i] = fraction >= 1 ? start[i] : heights[i] + (start[i] - heights[i]) * fraction;
      }
    }
    flag(changed, c0, r0, c1, r1);
    // Back in the starting shape the sand lies still. Part of the way
    // there, any of it may stand too steeply.
    unflagAll(loose);
    if (fraction >= 1) reach = startBox ? { ...startBox } : null;
    else flag(loose, c0, r0, c1, r1);
  }

  return {
    cols,
    rows,
    cellMm,
    leftMm: left,
    topMm: top,
    widthMm: cols * cellMm,
    heightMm: rows * cellMm,
    heights,
    push,
    relax,
    towardsStart,
    // The depth of the cell at a point; 0 outside the field.
    depthAt(xMm, yMm) {
      const c = Math.round(toCol(xMm));
      const r = Math.round(toRow(yMm));
      return c < 0 || r < 0 || c >= cols || r >= rows ? 0 : heights[r * cols + c];
    },
    // All the sand there is, in cubic millimetres.
    volume() {
      let sum = 0;
      for (let i = 0; i < heights.length; i += 1) sum += heights[i];
      return sum * cellMm * cellMm;
    },
    // The cells changed since this was last asked, as a list of boxes that
    // do not overlap (none if nothing changed). Changed tiles side by side
    // make one box, and so do equal runs of them one below the other.
    takeChanged() {
      const boxes = [];
      if (!changed.box) return boxes;
      const { flags, box } = changed;
      let above = []; // the boxes that reach down to the row of tiles above
      for (let u = box.r0 >> TILE_SHIFT; u <= box.r1 >> TILE_SHIFT; u += 1) {
        const here = [];
        for (let t = box.c0 >> TILE_SHIFT; t <= box.c1 >> TILE_SHIFT; t += 1) {
          if (!flags[u * tileCols + t]) continue;
          const first = t;
          while (t < tileCols && flags[u * tileCols + t]) t += 1;
          const c0 = first * TILE;
          const c1 = Math.min(cols, t * TILE) - 1;
          const r1 = Math.min(rows, (u + 1) * TILE) - 1;
          let run = above.find((other) => other.c0 === c0 && other.c1 === c1);
          if (run) run.r1 = r1;
          else boxes.push((run = { c0, r0: u * TILE, c1, r1 }));
          here.push(run);
        }
        above = here;
      }
      unflagAll(changed);
      return boxes;
    },
    // Count all the sand as changed, for when it is to be drawn differently.
    changeAll() {
      if (reach) flag(changed, reach.c0, reach.r0, reach.c1, reach.r1);
    },
    // Everywhere sand has been since the last reset.
    reachBox: () => (reach ? { ...reach } : null),
    isMoving: () => loose.box !== null,
  };
}
