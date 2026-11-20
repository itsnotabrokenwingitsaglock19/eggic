// The surface of a pool of liquid, which carries waves: how far the liquid
// stands above its level at each point of a grid, moved on in small steps
// of time. A wave travels, turns back at the liquid's edge and dies down;
// a finger presses a dimple into the surface, which sends waves out when
// it lands, moves and lifts. No browser parts.
//
// Places are in millimetres on the egg: x from its axis, height from its
// base. Heights of the surface are millimetres too.

// settings: { cellsPerMm, speedMmPerS, calmS, levelHz, stillMm,
// longestStepMs, thick: { everyMs, share }, finger: { widthMm, deepMm, hz },
// stilledMs }. bounds: the field the liquid can be in.
export function createSurface(settings, bounds) {
  const { cellsPerMm, speedMmPerS, finger, thick } = settings;
  const width = Math.ceil((bounds.maxX - bounds.minX) * cellsPerMm);
  const height = Math.ceil((bounds.maxH - bounds.minH) * cellsPerMm);
  const u = new Float32Array(width * height); // how far above its level, mm
  const v = new Float32Array(width * height); // how fast it rises, mm/s
  const spare = new Float32Array(width * height);
  const wet = new Uint8Array(width * height); // where there is liquid
  const room = new Int32Array(width * height);
  let cells = room.subarray(0, 0); // the same, as a list
  const dx = 1 / cellsPerMm;
  const pull = (speedMmPerS * speedMmPerS) / (dx * dx);
  const level = (2 * Math.PI * settings.levelHz) ** 2;
  const stiff = (2 * Math.PI * finger.hz) ** 2;
  const steadyS = (0.6 * dx) / speedMmPerS; // a longer step of time would not stay steady
  const xOf = (column) => bounds.minX + (column + 0.5) * dx;
  const hOf = (row) => bounds.maxH - (row + 0.5) * dx;

  // The fingers pressing this moment, as the cells each one reaches.
  let pressed = [];
  let moving = false;
  let untilThick = 0; // seconds until the smallest ripples next melt away
  let stilling = 0; // seconds left of being stilled

  // The cells within a distance of a place.
  function around(x, h, reachMm, each) {
    const firstColumn = Math.max(1, Math.floor((x - reachMm - bounds.minX) * cellsPerMm));
    const lastColumn = Math.min(width - 2, Math.ceil((x + reachMm - bounds.minX) * cellsPerMm));
    const firstRow = Math.max(1, Math.floor((bounds.maxH - h - reachMm) * cellsPerMm));
    const lastRow = Math.min(height - 2, Math.ceil((bounds.maxH - h + reachMm) * cellsPerMm));
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        const at = row * width + column;
        if (wet[at]) each(at, xOf(column) - x, hOf(row) - h);
      }
    }
  }

  function smoothInto(field) {
    for (let k = 0; k < cells.length; k += 1) {
      const at = cells[k];
      const here = field[at];
      const near = (wet[at - 1] ? field[at - 1] : here) + (wet[at + 1] ? field[at + 1] : here) + (wet[at - width] ? field[at - width] : here) + (wet[at + width] ? field[at + width] : here);
      spare[at] = here + thick.share * (near / 4 - here);
    }
    for (let k = 0; k < cells.length; k += 1) field[cells[k]] = spare[cells[k]];
  }

  return {
    width,
    height,
    // Where the liquid is: the places where phiAt(x, h) is more than
    // edgeMm. Liquid arriving at a new place comes level with the liquid
    // beside it; a place the liquid has left is forgotten.
    // With a box ({ minX, maxX, minH, maxH }), only the places within it
    // are looked at again.
    cover(phiAt, edgeMm, box) {
      const firstColumn = box ? Math.max(1, Math.floor((box.minX - bounds.minX) * cellsPerMm)) : 1;
      const lastColumn = box ? Math.min(width - 2, Math.ceil((box.maxX - bounds.minX) * cellsPerMm)) : width - 2;
      const firstRow = box ? Math.max(1, Math.floor((bounds.maxH - box.maxH) * cellsPerMm)) : 1;
      const lastRow = box ? Math.min(height - 2, Math.ceil((bounds.maxH - box.minH) * cellsPerMm)) : height - 2;
      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          const at = row * width + column;
          const now = phiAt(xOf(column), hOf(row)) > edgeMm ? 1 : 0;
          if (now && !wet[at]) {
            let sum = 0;
            let count = 0;
            for (const beside of [at - 1, at + 1, at - width, at + width]) {
              if (wet[beside]) {
                sum += u[beside];
                count += 1;
              }
            }
            u[at] = count ? sum / count : 0;
            v[at] = 0;
          } else if (!now && wet[at]) {
            u[at] = 0;
            v[at] = 0;
          }
          wet[at] = now;
        }
      }
      let found = 0;
      for (let at = 0; at < wet.length; at += 1) {
        if (wet[at]) {
          room[found] = at;
          found += 1;
        }
      }
      cells = room.subarray(0, found);
    },
    // The fingers pressing on the surface this moment: [{ x, h, press }],
    // press from 0 (lightest) to 1 (firmest).
    press(list) {
      pressed = list.map((one) => {
        const reached = [];
        const depth = finger.deepMm * (finger.lightest + (1 - finger.lightest) * one.press);
        around(one.x, one.h, 3 * finger.widthMm, (at, ax, ah) => {
          const share = Math.exp(-(ax * ax + ah * ah) / (2 * finger.widthMm * finger.widthMm));
          reached.push(at, share, -depth * share);
        });
        return reached;
      });
      if (list.length) moving = true;
    },
    // A push upwards at one place, as when liquid falls back into the pool.
    kick(x, h, mmPerS, widthMm) {
      around(x, h, 3 * widthMm, (at, ax, ah) => {
        v[at] += mmPerS * Math.exp(-(ax * ax + ah * ah) / (2 * widthMm * widthMm));
      });
      moving = true;
    },
    // A swell that crosses the pool in a direction ({ x, h }, of length 1),
    // starting `fromMm` before the middle of the pool: tallMm high, widthMm wide.
    swell(direction, middle, fromMm, tallMm, widthMm) {
      for (let k = 0; k < cells.length; k += 1) {
        const at = cells[k];
        const along = (xOf(at % width) - middle.x) * direction.x + (hOf(Math.floor(at / width)) - middle.h) * direction.h + fromMm;
        const bump = tallMm * Math.exp(-(along * along) / (2 * widthMm * widthMm));
        u[at] += bump;
        v[at] += (speedMmPerS * along * bump) / (widthMm * widthMm);
      }
      moving = true;
    },
    // A ring that closes in on a place from radiusMm away.
    ringIn(middle, radiusMm, tallMm, widthMm) {
      for (let k = 0; k < cells.length; k += 1) {
        const at = cells[k];
        const out = Math.hypot(xOf(at % width) - middle.x, hOf(Math.floor(at / width)) - middle.h) - radiusMm;
        const bump = tallMm * Math.exp(-(out * out) / (2 * widthMm * widthMm));
        u[at] += bump;
        v[at] -= (speedMmPerS * out * bump) / (widthMm * widthMm);
      }
      moving = true;
    },
    // Stills the surface at once: within stilledMs it is flat.
    still() {
      stilling = settings.stilledMs / 1000;
    },
    // Moves the surface on by some time. True while anything moves.
    step(milliseconds) {
      if (!moving) return false;
      const seconds = Math.min(settings.longestStepMs, Math.max(0, milliseconds)) / 1000;
      const steps = Math.max(1, Math.ceil(seconds / steadyS));
      const dt = seconds / steps;
      const fade = Math.exp(-dt / (stilling > 0 ? settings.stilledMs / 5000 : settings.calmS));
      let most = 0;
      for (let n = 0; n < steps; n += 1) {
        for (let k = 0; k < cells.length; k += 1) {
          const at = cells[k];
          const here = u[at];
          // At the liquid's edge a wave turns back: beyond the edge counts as level with here.
          const near = (wet[at - 1] ? u[at - 1] : here) + (wet[at + 1] ? u[at + 1] : here) + (wet[at - width] ? u[at - width] : here) + (wet[at + width] ? u[at + width] : here);
          v[at] = (v[at] + (pull * (near - 4 * here) - level * here) * dt) * fade;
        }
        for (const reached of pressed) {
          for (let k = 0; k < reached.length; k += 3) {
            const at = reached[k];
            if (wet[at]) v[at] += stiff * reached[k + 1] * (reached[k + 2] - u[at]) * dt;
          }
        }
        most = 0;
        for (let k = 0; k < cells.length; k += 1) {
          const at = cells[k];
          u[at] = (u[at] + v[at] * dt) * (stilling > 0 ? fade : 1);
          const size = Math.abs(u[at]) + Math.abs(v[at]) / 50;
          if (size > most) most = size;
        }
      }
      // A thick liquid: its smallest ripples melt away. (Heights and speeds
      // are smoothed alike; smoothing one alone would not stay steady.)
      untilThick -= seconds;
      while (untilThick <= 0) {
        smoothInto(u);
        smoothInto(v);
        untilThick += thick.everyMs / 1000;
      }
      if (stilling > 0) stilling -= seconds;
      // Nothing presses and nothing is left of the waves: flat, and at rest.
      if (pressed.length === 0 && most < settings.stillMm) {
        for (let k = 0; k < cells.length; k += 1) {
          u[cells[k]] = 0;
          v[cells[k]] = 0;
        }
        moving = false;
        stilling = 0;
      }
      return moving;
    },
    moving: () => moving,
    // How far above its level the surface stands at a place, read off
    // smoothly between the grid's points.
    at(x, h) {
      const fx = (x - bounds.minX) * cellsPerMm - 0.5;
      const fy = (bounds.maxH - h) * cellsPerMm - 0.5;
      const column = Math.floor(fx);
      const row = Math.floor(fy);
      if (column < 0 || row < 0 || column >= width - 1 || row >= height - 1) return 0;
      const tx = fx - column;
      const ty = fy - row;
      const at = row * width + column;
      return (u[at] * (1 - tx) + u[at + 1] * tx) * (1 - ty) + (u[at + width] * (1 - tx) + u[at + width + 1] * tx) * ty;
    },
    // The most the surface stands above or below its level anywhere.
    tallest() {
      let most = 0;
      for (let k = 0; k < cells.length; k += 1) most = Math.max(most, Math.abs(u[cells[k]]));
      return most;
    },
  };
}
