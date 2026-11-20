// The liquid of ferroline: a pool of magnetic liquid in the shape of the
// egg, seen from above, and what the fingers on the screen do to it.
//
// A finger is a magnet. The liquid gathers under it and rises there in a
// cluster of spikes; a finger outside the pool draws a tongue of liquid out
// to it, which flows back when the finger lifts. The first touch wakes the
// whole surface: low spikes come and go all over it until it goes back to
// rest, by itself after a while without touch or at once when it is calmed.
// Waves of spikes can be sent across it.
//
// Everything is worked out from a few numbers (where the magnets are, how
// far each tongue has come, how awake the surface is), not kept as a
// picture: phiAt() says how far inside the liquid a place is, heightAt()
// how high the liquid stands there. Places are in millimetres on the egg:
// x from its axis, height from its base. Times are in milliseconds. Plain
// arithmetic, no browser parts.
import { EGG_HEIGHT_MM, EGG_HALF_WIDTH_MM, isInsideEgg, outlinePoints } from '../surface/egg-outline.js';

const ROW = Math.sqrt(3) / 2; // rows of a honeycomb lie this share of its pitch apart
const TWO_PI = 2 * Math.PI;

// ---- how far inside the egg a place is --------------------------------------

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

// ---- small helpers ---------------------------------------------------------------

// The larger of two distances, with the corner between them rounded over
// `roundMm`: how two bodies of liquid join.
function joined(a, b, roundMm) {
  const near = Math.max(0, roundMm - Math.abs(a - b)) / roundMm;
  return Math.max(a, b) + (near * near * roundMm) / 4;
}

const smooth = (t) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

// A number between 0 and 1 that stays the same for the same two whole
// numbers and salt.
function scatter(a, b, salt) {
  let n = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(salt, 2147483647)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// The spike of a honeycomb of spikes nearest a place, for spikes `pitch`
// apart with one standing at (0, 0): how far away it is, and which one
// (its row and its place in the row). Fills `found` and answers it.
function nearestSpike(x, h, pitch, found) {
  const v = h / (pitch * ROW);
  const first = Math.round(v);
  const second = v > first ? first + 1 : first - 1;
  let best = Infinity;
  for (let k = 0; k < 2; k += 1) {
    const row = k === 0 ? first : second;
    const shift = row & 1 ? 0.5 : 0;
    const place = Math.round(x / pitch - shift);
    const dx = x - (place + shift) * pitch;
    const dh = h - row * pitch * ROW;
    const distance2 = dx * dx + dh * dh;
    if (distance2 < best) {
      best = distance2;
      found.row = row;
      found.place = place;
    }
  }
  found.distance = Math.sqrt(best);
  return found;
}

// ---- the liquid ---------------------------------------------------------------------

// settings: the release's `liquid` (see src/releases/ferroline.js).
export function createLiquid(settings) {
  const egg = createEggDistance(settings.sideMm);
  const { pull, spikes, cluster, restless, awake, waves, pool, land } = settings;

  // The fingers: id -> { x, h, landed: { x, h }, sinceMs, waiting, off,
  // press, stillSinceMs }. A finger waits a moment after landing before it
  // draws the liquid: if a second finger lands in that moment, the two are
  // tuning the sound and neither is to disturb it. `off` marks a finger
  // that no longer draws the liquid at all.
  const fingers = new Map();
  // The tongues of liquid, one for each finger that draws or has drawn it:
  // id -> { anchor, tip, strength, held, press, stillSinceMs }.
  const tongues = new Map();
  let pulses = []; // waves under way
  let level = 0; // how awake the surface is, 0 to 1
  let touchedMs = null; // when a finger last drew the liquid
  let calmed = true; // put to rest, until the next touch
  let lastMs = null;
  let shrink = 0; // how far the pool's edge has drawn in, for the liquid in the tongues
  let lean = []; // the tips that the restless surface leans towards

  const drawing = (finger, nowMs) => {
    if (finger.off) return false;
    if (!finger.waiting) return true;
    if (nowMs - finger.sinceMs >= land.waitMs) return true;
    return Math.hypot(finger.x - finger.landed.x, finger.h - finger.landed.h) > land.travelMm;
  };

  // Where a finger's tongue is anchored in the pool and how far out its tip
  // may go: the liquid follows a finger up to `reachMm` beyond the egg.
  function aims(finger) {
    // A finger further away than the liquid can be followed counts as
    // being at the edge of that field, on the line to the egg's middle.
    const middle = EGG_HEIGHT_MM / 2;
    const up = finger.h - middle;
    const share = Math.min(
      1,
      (egg.bounds.maxX - 1) / Math.abs(finger.x || 1e-9),
      up > 0 ? (egg.bounds.maxH - 1 - middle) / up : (middle - egg.bounds.minH - 1) / -(up || -1e-9),
    );
    const x = finger.x * share;
    const h = middle + up * share;
    const depth = egg.at(x, h);
    const inward = egg.inward(x, h);
    const tip = depth >= -pull.reachMm ? { x, h } : { x: x + inward.x * (-pull.reachMm - depth), h: h + inward.h * (-pull.reachMm - depth) };
    const anchor = depth >= pull.inMm ? { x, h } : { x: x + inward.x * (pull.inMm - depth), h: h + inward.h * (pull.inMm - depth) };
    return { tip, anchor };
  }

  const ease = (from, to, elapsed, overMs) => from + (to - from) * (1 - Math.exp(-elapsed / overMs));

  function stepTongues(nowMs, elapsed) {
    for (const [id, finger] of fingers) {
      if (!drawing(finger, nowMs)) continue;
      finger.waiting = false;
      const aim = aims(finger);
      let tongue = tongues.get(id);
      if (!tongue) {
        // A new tongue starts in the pool and shoots out towards the finger.
        tongue = { anchor: aim.anchor, tip: { ...aim.anchor }, strength: 0, held: true, press: finger.press, stillSinceMs: finger.stillSinceMs };
        tongues.set(id, tongue);
      }
      tongue.held = true;
      tongue.press = finger.press;
      tongue.stillSinceMs = finger.stillSinceMs;
      tongue.anchor = { x: ease(tongue.anchor.x, aim.anchor.x, elapsed, pull.followMs), h: ease(tongue.anchor.h, aim.anchor.h, elapsed, pull.followMs) };
      tongue.tip = { x: ease(tongue.tip.x, aim.tip.x, elapsed, pull.followMs), h: ease(tongue.tip.h, aim.tip.h, elapsed, pull.followMs) };
      tongue.strength = Math.min(1, tongue.strength + elapsed / cluster.riseMs);
      touchedMs = nowMs;
      calmed = false;
    }
    for (const [id, tongue] of tongues) {
      const finger = fingers.get(id);
      if (finger && !finger.off && !finger.waiting) continue;
      // Let go: the spikes sink and the tongue flows back into the pool.
      tongue.held = false;
      tongue.strength = Math.max(0, tongue.strength - elapsed / cluster.sinkMs);
      tongue.tip = { x: ease(tongue.tip.x, tongue.anchor.x, elapsed, pull.backMs), h: ease(tongue.tip.h, tongue.anchor.h, elapsed, pull.backMs) };
      const out = Math.hypot(tongue.tip.x - tongue.anchor.x, tongue.tip.h - tongue.anchor.h);
      if (tongue.strength === 0 && out < 0.05) tongues.delete(id);
    }
    // The liquid in the tongues comes out of the pool, whose edge draws in.
    let outside = 0;
    for (const tongue of tongues.values()) {
      const beyond = Math.max(0, -egg.at(tongue.tip.x, tongue.tip.h));
      if (beyond > 0) outside += beyond * (pull.neckMm + pull.headMm) + (Math.PI * pull.headMm * pull.headMm) / 2;
    }
    shrink = Math.min(pull.shrinkMostMm, outside / pull.rimLengthMm);
    lean = Array.from(tongues.values()).filter((tongue) => tongue.held).map((tongue) => tongue.tip);
  }

  function stepAwake(nowMs, elapsed) {
    if (calmed) level = Math.max(0, level - elapsed / awake.calmMs);
    else if (touchedMs !== null && nowMs - touchedMs > awake.restAfterMs) {
      level = Math.max(0, level - elapsed / awake.settleMs);
      if (level === 0) calmed = true;
    } else level = Math.min(1, level + elapsed / awake.wakeMs);
  }

  // How strongly the waves under way raise the spikes at a place.
  function waveAt(x, h, nowMs) {
    let most = 0;
    for (const pulse of pulses) {
      const seconds = (nowMs - pulse.startMs) / 1000;
      let value = 0;
      if (pulse.kind === 'sweep') {
        const along = x * pulse.x + (h - EGG_HEIGHT_MM / 2) * pulse.h;
        const front = -waves.spanMm + waves.speedMmPerS * seconds;
        value = Math.exp(-((along - front) * (along - front)) / (2 * waves.widthMm * waves.widthMm));
      } else if (pulse.kind === 'ring') {
        const radius = pulse.inward ? waves.spanMm - waves.speedMmPerS * seconds : waves.speedMmPerS * seconds;
        const distance = Math.hypot(x - pulse.x, h - pulse.h);
        value = Math.exp(-((distance - radius) * (distance - radius)) / (2 * waves.widthMm * waves.widthMm));
      } else {
        // A spot: it comes on, holds and goes off.
        const on = smooth((nowMs - pulse.startMs) / waves.spotOnMs);
        const off = 1 - smooth((nowMs - pulse.endMs) / waves.spotOffMs);
        const distance2 = (x - pulse.x) * (x - pulse.x) + (h - pulse.h) * (h - pulse.h);
        value = Math.min(on, off) * Math.exp(-distance2 / (2 * waves.spotMm * waves.spotMm));
      }
      if (value > most) most = value;
    }
    return most;
  }

  const pulseIsOver = (pulse, nowMs) => {
    if (pulse.kind === 'spot') return nowMs > pulse.endMs + waves.spotOffMs;
    return (nowMs - pulse.startMs) / 1000 > (2 * waves.spanMm + 3 * waves.widthMm) / waves.speedMmPerS;
  };

  // ---- reading the liquid ----

  // How far inside the liquid a place is, in millimetres: above 0 inside,
  // below 0 outside, 0 on its edge. At rest the edge is the egg's outline.
  function phiAt(x, h) {
    let phi = egg.at(x, h) - shrink;
    for (const tongue of tongues.values()) {
      const ax = tongue.tip.x - tongue.anchor.x;
      const ah = tongue.tip.h - tongue.anchor.h;
      const length2 = ax * ax + ah * ah;
      const along = length2 > 1e-6 ? Math.min(1, Math.max(0, ((x - tongue.anchor.x) * ax + (h - tongue.anchor.h) * ah) / length2)) : 1;
      const distance = Math.hypot(x - (tongue.anchor.x + ax * along), h - (tongue.anchor.h + ah * along));
      const radius = pull.neckMm + (pull.headMm - pull.neckMm) * along;
      phi = joined(phi, radius - distance, pull.joinMm);
    }
    return phi;
  }

  const found = { distance: 0, row: 0, place: 0 };

  // How far each spike of the restless surface has come up at a moment, 0
  // to 1: every spike in its own slow time. Worked out once for each spike
  // and moment, since many places share a spike.
  const firstRow = Math.floor(egg.bounds.minH / (spikes.pitchMm * ROW)) - 1;
  const firstPlace = Math.floor(egg.bounds.minX / spikes.pitchMm) - 2;
  const placesWide = Math.ceil((egg.bounds.maxX - egg.bounds.minX) / spikes.pitchMm) + 5;
  const rowsHigh = Math.ceil((egg.bounds.maxH - egg.bounds.minH) / (spikes.pitchMm * ROW)) + 3;
  const coming = new Float32Array(placesWide * rowsHigh);
  const comingAt = new Float64Array(placesWide * rowsHigh).fill(-1);
  function comingUp(row, place, nowMs) {
    const index = (row - firstRow) * placesWide + (place - firstPlace);
    if (comingAt[index] !== nowMs) {
      const seconds = nowMs / 1000;
      const slow = restless.slowHz[0] + (restless.slowHz[1] - restless.slowHz[0]) * scatter(row, place, 3);
      coming[index] =
        0.5 +
        0.5 * Math.sin(TWO_PI * (slow * seconds + scatter(row, place, 1))) * Math.sin(TWO_PI * (slow * 0.37 * seconds + scatter(row, place, 2)));
      comingAt[index] = nowMs;
    }
    return coming[index];
  }
  const cone = (distance) => {
    const t = 1 - distance / (spikes.pitchMm * spikes.footShare);
    return t <= 0 ? 0 : t * Math.sqrt(t);
  };

  // How high the liquid stands at a place, in millimetres, given how far
  // inside the liquid the place is (phiAt). 0 outside the liquid.
  function heightFor(x, h, phi, nowMs) {
    const body = smooth(phi / pool.rimMm);
    if (body <= 0) return 0;
    // The spikes stand in a honeycomb fixed to the egg. How tall each one
    // stands is the larger of two things.
    nearestSpike(x, h, spikes.pitchMm, found);
    const shape = cone(found.distance);
    let tall = 0;

    // The restless surface: each spike coming and going in its own slow
    // time; taller near a finger and where a wave passes.
    const wave = pulses.length ? waveAt(x, h, nowMs) : 0;
    const up = level > 0 && shape > 0 ? comingUp(found.row, found.place, nowMs) : 0;
    if (shape > 0 && (level > 0 || wave > 0)) {
      let near = 0;
      for (const tip of lean) {
        const u = 1 - ((x - tip.x) * (x - tip.x) + (h - tip.h) * (h - tip.h)) / (restless.nearMm * restless.nearMm);
        if (u > near) near = u;
      }
      const strength = level * (restless.least + (1 - restless.least) * up) * (1 + restless.nearFinger * near * near);
      tall = restless.tallMm * strength + waves.tallMm * wave;
    }

    // The cluster under each finger: the spikes around it stand tall,
    // tallest at its middle, taller for a firmer press, and quivering once
    // the finger rests. The liquid also swells a little there.
    let dome = 0;
    for (const tongue of tongues.values()) {
      if (tongue.strength <= 0) continue;
      const dx = x - tongue.tip.x;
      const dh = h - tongue.tip.h;
      const u = 1 - (dx * dx + dh * dh) / (cluster.reachMm * cluster.reachMm);
      if (u <= 0) continue;
      dome = Math.max(dome, cluster.domeMm * tongue.strength * u * u);
      if (shape <= 0) continue;
      const rested = (nowMs - tongue.stillSinceMs - cluster.quiverAfterMs) / cluster.quiverOverMs;
      const quiver = 1 + cluster.quiver * smooth(rested) * Math.sin(TWO_PI * cluster.quiverHz * (nowMs / 1000) + TWO_PI * scatter(found.row, found.place, 4));
      const own = 1 - cluster.uneven * (1 - (level > 0 ? up : scatter(found.row, found.place, 5)));
      const pressed = cluster.lightest + (1 - cluster.lightest) * tongue.press;
      tall = Math.max(tall, cluster.tallMm * pressed * tongue.strength * quiver * own * u * Math.sqrt(u));
    }
    const spiked = shape * tall;
    return body * (pool.tallMm + dome + spiked);
  }

  return {
    // ---- the fingers ----

    // A finger lands at a place.
    down(id, spot, nowMs) {
      fingers.set(id, { x: spot.xMm, h: spot.heightMm, landed: { x: spot.xMm, h: spot.heightMm }, sinceMs: nowMs, waiting: true, off: false, press: 0.5, stillSinceMs: nowMs });
    },

    // A finger moves. A finger that has gone further than `stillMm` from
    // where it last rested is no longer resting.
    move(id, spot, nowMs) {
      const finger = fingers.get(id);
      if (!finger) return;
      finger.x = spot.xMm;
      finger.h = spot.heightMm;
      if (!finger.rest || Math.hypot(finger.x - finger.rest.x, finger.h - finger.rest.h) > cluster.stillMm) {
        finger.rest = { x: finger.x, h: finger.h };
        finger.stillSinceMs = nowMs;
      }
    },

    // A finger lifts. One that lifts while it still waits was a quick tap:
    // it wakes the surface and leaves a few spikes that sink again.
    up(id, nowMs) {
      const finger = fingers.get(id);
      if (finger && finger.waiting && !finger.off) {
        const aim = aims(finger);
        tongues.set(id, { anchor: aim.anchor, tip: { ...aim.anchor }, strength: cluster.tapStrength, held: false, press: finger.press, stillSinceMs: nowMs });
        touchedMs = nowMs;
        calmed = false;
      }
      fingers.delete(id);
    },

    // A finger stops drawing the liquid, for as long as it stays down.
    drop(id) {
      const finger = fingers.get(id);
      if (finger) finger.off = true;
    },

    // How firmly a finger presses, 0 (lightest) to 1.
    press(id, amount) {
      const finger = fingers.get(id);
      if (finger) finger.press = Math.min(1, Math.max(0, amount));
    },

    // Every finger is gone (the page was left).
    forget() {
      fingers.clear();
    },

    // ---- waves and rest ----

    // A wave of spikes that crosses the egg in a direction ({ x, h }).
    sweep(direction, nowMs) {
      const length = Math.hypot(direction.x, direction.h) || 1;
      pulses.push({ kind: 'sweep', x: direction.x / length, h: direction.h / length, startMs: nowMs });
    },

    // A ring of spikes that spreads from the egg's middle, or closes in on it.
    ring(inward, nowMs) {
      pulses.push({ kind: 'ring', x: 0, h: EGG_HEIGHT_MM / 2, inward, startMs: nowMs });
    },

    // Spikes that rise at a place from one moment to another.
    spot(place, fromMs, toMs) {
      pulses.push({ kind: 'spot', x: place.xMm, h: place.heightMm, startMs: fromMs, endMs: toMs });
    },

    // Put the surface to rest: it sinks back into a still pool, and stays
    // so until the next touch.
    calm() {
      calmed = true;
    },

    // ---- time ----

    // Move the liquid on to the time given. Answers true while anything is
    // moving or still to come, so the caller knows to keep drawing.
    step(nowMs) {
      const elapsed = lastMs === null ? 0 : Math.max(0, Math.min(nowMs - lastMs, settings.longestStepMs));
      stepTongues(nowMs, elapsed);
      stepAwake(nowMs, elapsed);
      pulses = pulses.filter((pulse) => !pulseIsOver(pulse, nowMs));
      const busy = level > 0 || tongues.size > 0 || pulses.length > 0 || fingers.size > 0;
      lastMs = busy ? nowMs : null;
      return busy;
    },

    // ---- reading ----

    phiAt,
    heightAt: (x, h, nowMs) => heightFor(x, h, phiAt(x, h), nowMs),
    heightFor,
    // How awake the surface is, 0 (a still pool) to 1.
    awake: () => level,
    // The tongues: where each is anchored, where its tip is, and how
    // strongly its spikes stand.
    tongues: () => Array.from(tongues.values()).map((tongue) => ({ anchor: { ...tongue.anchor }, tip: { ...tongue.tip }, strength: tongue.strength, held: tongue.held })),
    // The box that holds all the liquid, with `marginMm` to spare.
    box(marginMm) {
      let minX = -EGG_HALF_WIDTH_MM;
      let maxX = EGG_HALF_WIDTH_MM;
      let minH = 0;
      let maxH = EGG_HEIGHT_MM;
      for (const tongue of tongues.values()) {
        const reach = pull.headMm + pull.joinMm;
        minX = Math.min(minX, tongue.tip.x - reach);
        maxX = Math.max(maxX, tongue.tip.x + reach);
        minH = Math.min(minH, tongue.tip.h - reach);
        maxH = Math.max(maxH, tongue.tip.h + reach);
      }
      return {
        minX: Math.max(egg.bounds.minX, minX - marginMm),
        maxX: Math.min(egg.bounds.maxX, maxX + marginMm),
        minH: Math.max(egg.bounds.minH, minH - marginMm),
        maxH: Math.min(egg.bounds.maxH, maxH + marginMm),
      };
    },
    bounds: egg.bounds,
  };
}
