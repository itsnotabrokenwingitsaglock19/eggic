// The paint, as a surface of heights with a colour at every point: how
// thick the paint lies in each cell of a flat rectangle over the egg, and
// what it is mixed from.
//
// Two layers per cell: wet paint on top, which a finger moves and mixes,
// and set paint under it, which nothing moves and new paint only covers.
// Paint stays wet while it is being painted, and sets when the egg is left
// alone. It lies only inside the shape that `inside` describes.
//
// The colour of paint is kept once for every colour set, so that the whole
// painting can be shown in any of them. It is kept as absorbance per
// channel (how much of the red, green and blue light the paint swallows),
// which mixes by plain averaging and gives paint-like mixes: yellow and
// blue make green.
//
// Coordinates are millimetres, x to the right and y down, with 0, 0 at the
// middle of the field. Cells are counted from the top left. Amounts of
// paint a finger carries are in millimetres of thickness times cells.
// Plain arithmetic, no browser parts.

const LANES = 14; // a finger carries paint in lanes across its width

// A number from 0 to 1 for a pair of whole numbers, always the same.
function hash(a, b, seed) {
  let n = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ seed, 0xc2b2ae35);
  n ^= n >>> 13;
  n = Math.imul(n, 0x27d4eb2f);
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
}

// Smooth unevenness from 0 to 1 over a plane, always the same for the same
// place and seed.
export function valueNoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a + (a - b + d - c) * sx) * sy;
}

export const smooth = (from, to, value) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

// Reflectance (0 to 1, in linear light) and absorbance. Absorbances mix by
// plain averaging, weighted by the amounts of paint.
export const toAbsorbance = (reflectance) => -Math.log(Math.min(1, Math.max(0.02, reflectance)));
export const toReflectance = (absorbance) => Math.exp(-absorbance);

// settings: the release's `paint` settings. inside(xMm, yMm): whether a
// point may hold paint. setCount: how many colour sets a colour is kept for.
export function createPaintField(settings, inside, setCount) {
  const cellMm = settings.cellMm;
  const cols = Math.round(settings.widthMm / cellMm);
  const rows = Math.round(settings.heightMm / cellMm);
  const count = cols * rows;
  const leftMm = (-cols * cellMm) / 2;
  const topMm = (-rows * cellMm) / 2;
  const K = setCount * 3; // numbers of colour per cell and layer

  const wet = new Float32Array(count); // thickness of wet paint, mm
  const set = new Float32Array(count); // thickness of set paint, mm
  const wetK = new Float32Array(count * K);
  const setK = new Float32Array(count * K);
  const may = new Uint8Array(count); // 1 where paint may lie

  const toCol = (xMm) => (xMm - leftMm) / cellMm - 0.5;
  const toRow = (yMm) => (yMm - topMm) / cellMm - 0.5;
  // A cell may hold paint if any part of it is inside the shape; the
  // picture cuts the paint off exactly at the outline.
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = leftMm + (c + 0.5) * cellMm;
      const y = topMm + (r + 0.5) * cellMm;
      let any = false;
      for (let oy = -1; oy <= 1 && !any; oy += 1) {
        for (let ox = -1; ox <= 1 && !any; ox += 1) any = inside(x + ox * cellMm * 0.5, y + oy * cellMm * 0.5);
      }
      may[r * cols + c] = any ? 1 : 0;
    }
  }

  const T = settings.layMm;
  const lane = settings.finger;
  let alone = 0; // seconds the egg has been left alone
  let strokes = 0; // how many fingers have been made; each streaks differently
  let changed = null; // a box of cells around what changed: { c0, r0, c1, r1 }

  function touched(c0, r0, c1, r1) {
    c0 = Math.max(0, c0);
    r0 = Math.max(0, r0);
    c1 = Math.min(cols - 1, c1);
    r1 = Math.min(rows - 1, r1);
    if (c0 > c1 || r0 > r1) return;
    if (!changed) changed = { c0, r0, c1, r1 };
    else {
      changed.c0 = Math.min(changed.c0, c0);
      changed.r0 = Math.min(changed.r0, r0);
      changed.c1 = Math.max(changed.c1, c1);
      changed.r1 = Math.max(changed.r1, r1);
    }
  }
  const changeAll = () => touched(0, 0, cols - 1, rows - 1);

  // ---- a finger -----------------------------------------------------------

  function createFinger() {
    return {
      loaded: false,
      load: 0, // what is left of the paint it landed with
      loadK: new Float32Array(K),
      wiped: 0, // wet paint its pad has wiped up and keeps
      film: new Float32Array(LANES), // paint picked up on the way, by lane
      filmK: new Float32Array(LANES * K),
      travelled: 0, // mm along the stroke
      seed: (strokes += 1),
    };
  }

  // The finger loads paint of the colour given (one colour per set, as
  // absorbances); what it carried before is gone.
  function load(finger, colourK) {
    finger.loaded = true;
    finger.load = settings.loadMmCells;
    finger.loadK.set(colourK);
    finger.film.fill(0);
    finger.filmK.fill(0);
  }

  // How thick the stroke wants to be across its width (u: -1 at one edge,
  // 1 at the other): thinner in the middle, where the pad presses hardest,
  // a low ridge near each edge, nothing beyond.
  function across(u) {
    const a = Math.abs(u);
    const ridge = Math.exp(-((a - 0.74) * (a - 0.74)) / 0.03);
    return (0.74 + 0.26 * a * a) * (1 + lane.ridge * ridge) * (1 - smooth(0.84, 1, a));
  }
  // The streaks a finger leaves: long along the stroke, narrow across it.
  function streak(uMm, sMm, seed) {
    const n =
      0.62 * valueNoise(uMm / lane.streakMm, sMm / 11, seed) +
      0.38 * valueNoise(uMm / (lane.streakMm * 2.3) + 31, sMm / 6, seed + 5);
    return Math.min(1, Math.max(0, 0.5 + (n - 0.5) * 1.7));
  }

  // One press of the finger's pad at a point, moving in a direction
  // (dirX, dirY: length 1). pressure: from 0 (the lightest touch) to 1 (the
  // firmest), or null for a pad that always presses the same. A light touch
  // lays little paint and skims over what is there; a firm one lays a lot
  // and drags more of it along.
  function press(finger, xMm, yMm, dirX, dirY, radiusMm, pressure) {
    const felt = pressure !== null && pressure !== undefined;
    const amount = felt ? lane.amountLight + (lane.amountFirm - lane.amountLight) * pressure : 1;
    const drag = felt ? 0.5 + pressure : 1;
    const scrape = felt ? 0.25 + 0.75 * pressure : 1;
    const col = toCol(xMm);
    const row = toRow(yMm);
    const radius = radiusMm / cellMm;
    const c0 = Math.max(0, Math.ceil(col - radius));
    const c1 = Math.min(cols - 1, Math.floor(col + radius));
    const r0 = Math.max(0, Math.ceil(row - radius));
    const r1 = Math.min(rows - 1, Math.floor(row + radius));
    const left = finger.load / settings.loadMmCells;
    // As the load runs low the stroke thins, then breaks into streaks.
    const g = finger.loaded ? Math.min(1, left / lane.thinsAt) : 0;
    const gate = 1.2 * Math.pow(1 - g, 0.8) - 0.2;
    const cap = lane.filmMmCells / LANES;
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const i = r * cols + c;
        if (!may[i]) continue;
        const dc = c - col;
        const dr = r - row;
        const t = Math.sqrt(dc * dc + dr * dr) / radius;
        if (t >= 1) continue;
        const w = 1 - smooth(0.8, 1, t); // how firmly the pad presses here
        const u = (dc * -dirY + dr * dirX) / radius;
        const along = dc * dirX + dr * dirY;
        const b = Math.min(LANES - 1, Math.max(0, Math.floor(((u + 1) / 2) * LANES)));
        const n = streak(u * radiusMm, finger.travelled + along * cellMm, finger.seed);
        const shape = across(u) * (lane.streakLow + 2 * (1 - lane.streakLow) * n);
        const k = i * K;
        const fk = b * K;
        let h = wet[i];

        // The pad picks up some of the wet paint under it.
        if (h > 0) {
          const take = h * lane.pick * w * drag;
          const total = finger.film[b] + take;
          for (let j = 0; j < K; j += 1) finger.filmK[fk + j] = (finger.filmK[fk + j] * finger.film[b] + wetK[k + j] * take) / total;
          finger.film[b] = total;
          h -= take;
        }

        // A loaded finger pressed into wet paint of another colour puts its
        // own paint in its place: the pad wipes up a share of what is there
        // and lays as much from its load, so the mark takes the finger's
        // colour, tinged by what was there. Paint of its own colour is left
        // as it is, and the share falls as the load runs low.
        if (h > 0 && g > 0 && lane.takeover > 0) {
          let apart = 0;
          for (let j = 0; j < K; j += 1) apart += Math.abs(wetK[k + j] - finger.loadK[j]);
          const swap = Math.min(finger.load, h * lane.takeover * w * drag * g * Math.min(1, apart / K / lane.takeoverFullAt));
          if (swap > 0) {
            for (let j = 0; j < K; j += 1) wetK[k + j] = (wetK[k + j] * (h - swap) + finger.loadK[j] * swap) / h;
            finger.load -= swap;
            finger.wiped += swap;
          }
        }

        // What the stroke wants to leave here: from its load, and from the
        // paint it carries.
        const full = finger.film[b] / cap;
        const wantLoad = g > 0 ? T * shape * (0.55 + 0.45 * g) * smooth(gate - 0.1, gate + 0.1, n) * amount : 0;
        const wantFilm = lane.filmLayMm * shape * Math.min(1, full) * (1 + 0.5 * Math.min(2, Math.max(0, full - 1)));
        const want = Math.max(wantLoad, wantFilm);

        // A light touch does not scrape paint down to its own thin layer.
        const ceiling = felt ? Math.max(want, T * shape) : want;
        if (h > ceiling) {
          // Paint standing higher than that is taken along.
          const take = (h - ceiling) * lane.down * w * scrape;
          const total = finger.film[b] + take;
          for (let j = 0; j < K; j += 1) finger.filmK[fk + j] = (finger.filmK[fk + j] * finger.film[b] + wetK[k + j] * take) / total;
          finger.film[b] = total;
          h -= take;
        } else if (h < want) {
          const need = (want - h) * lane.up * w;
          const fromFilm = Math.min(finger.film[b] * 0.5, need * Math.min(1, full));
          let fromLoad = 0;
          if (h + fromFilm < wantLoad) fromLoad = Math.min(finger.load, Math.min(need - fromFilm, wantLoad - h - fromFilm));
          const added = fromFilm + fromLoad;
          if (added > 0) {
            const total = h + added;
            for (let j = 0; j < K; j += 1) {
              wetK[k + j] = (wetK[k + j] * h + finger.filmK[fk + j] * fromFilm + finger.loadK[j] * fromLoad) / total;
            }
            h = total;
            finger.film[b] -= fromFilm;
            finger.load -= fromLoad;
          }
        }
        wet[i] = h;
      }
    }
    touched(c0, r0, c1, r1);
  }

  // Move a finger from one point to another, pressing at every cell's
  // width on the way; the same point twice is one press. `colourAt(x, y)`
  // gives the colour the finger loads when it first comes onto the shape
  // (one colour per set, as absorbances), or null off it. Painting counts
  // as not leaving the egg alone.
  function stroke(finger, fromX, fromY, toX, toY, radiusMm, pressure, colourAt) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(distance / cellMm));
    const ux = distance > 1e-9 ? dx / distance : 1;
    const uy = distance > 1e-9 ? dy / distance : 0;
    for (let s = 1; s <= steps; s += 1) {
      const x = fromX + (dx * s) / steps;
      const y = fromY + (dy * s) / steps;
      if (!finger.loaded) {
        const colour = colourAt(x, y);
        if (colour) {
          load(finger, colour);
          // The pad's whole mark is laid where it comes down.
          for (let k = 0; k < 8; k += 1) press(finger, x, y, ux, uy, radiusMm, pressure);
        }
      }
      finger.travelled += distance / steps;
      press(finger, x, y, ux, uy, radiusMm, pressure);
    }
    alone = 0;
  }

  // ---- setting, wiping -------------------------------------------------------

  function hasWet() {
    for (let i = 0; i < count; i += 1) if (wet[i] > 0) return true;
    return false;
  }

  // All the wet paint sets: it joins the set paint under it and covers
  // that paint's colour.
  function settle() {
    for (let i = 0; i < count; i += 1) {
      const h = wet[i];
      if (h <= 0) continue;
      const cover = smooth(0.003, settings.coverMm, h);
      const k = i * K;
      if (set[i] > 0) {
        for (let j = 0; j < K; j += 1) {
          const under = toReflectance(setK[k + j]);
          setK[k + j] = toAbsorbance(under + (toReflectance(wetK[k + j]) - under) * cover);
        }
      } else for (let j = 0; j < K; j += 1) setK[k + j] = wetK[k + j];
      set[i] = Math.min(settings.deepestMm, set[i] + h);
      wet[i] = 0;
    }
    alone = 0;
    changeAll();
  }

  // How long the egg has been left alone, in seconds. Wet paint shows it:
  // its look changes as the time to set comes near. Once the time is up,
  // the paint sets. Returns true if there is still wet paint.
  function leftAlone(seconds) {
    if (!hasWet()) {
      alone = 0;
      return false;
    }
    const before = wetness();
    alone = Math.max(0, seconds);
    if (alone >= settings.setsAfterS) {
      settle();
      return false;
    }
    if (wetness() !== before) changeAll();
    return true;
  }
  // How wet the wet paint is to look at: 1 fresh, falling to 0 as it sets.
  const wetness = () => 1 - smooth(settings.palesFrom * settings.setsAfterS, settings.setsAfterS, alone);

  // The wipe: all the paint thins to a share of itself; thin enough, it is
  // gone.
  function thin(keep) {
    for (let i = 0; i < count; i += 1) {
      wet[i] *= keep;
      set[i] *= keep;
      if (wet[i] < 0.002) wet[i] = 0;
      if (set[i] < 0.002) set[i] = 0;
    }
    changeAll();
  }
  function clear() {
    wet.fill(0);
    set.fill(0);
    alone = 0;
    changeAll();
  }

  return {
    cols,
    rows,
    cellMm,
    leftMm,
    topMm,
    widthMm: cols * cellMm,
    heightMm: rows * cellMm,
    setCount,
    wet,
    set,
    wetK,
    setK,
    may,
    createFinger,
    stroke,
    settle,
    leftAlone,
    wetness,
    thin,
    clear,
    changeAll,
    hasWet,
    isBare() {
      for (let i = 0; i < count; i += 1) if (wet[i] > 0 || set[i] > 0) return false;
      return true;
    },
    // How thick the paint lies at a point, wet and set together; 0 off the field.
    depthAt(xMm, yMm) {
      const c = Math.round(toCol(xMm));
      const r = Math.round(toRow(yMm));
      return c < 0 || r < 0 || c >= cols || r >= rows ? 0 : wet[r * cols + c] + set[r * cols + c];
    },
    // All the paint on the egg, in millimetres of thickness times cells.
    amount() {
      let sum = 0;
      for (let i = 0; i < count; i += 1) sum += wet[i] + set[i];
      return sum;
    },
    // The share of the shape that has paint on it.
    covered() {
      let painted = 0;
      let all = 0;
      for (let i = 0; i < count; i += 1) {
        if (!may[i]) continue;
        all += 1;
        if (wet[i] + set[i] > 0.01) painted += 1;
      }
      return painted / all;
    },
    // The box of cells around everything changed since this was last
    // asked, as { c0, r0, c1, r1 }, or null.
    takeChanged() {
      const box = changed;
      changed = null;
      return box;
    },
  };
}
