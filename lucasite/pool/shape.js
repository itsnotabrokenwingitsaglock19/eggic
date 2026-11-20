// Where a pool of liquid in the shape of the egg is, seen from above, and
// what a finger does to its edge. At rest the pool's edge is the egg's
// outline. A finger on the liquid that comes to the edge pushes it out a
// little there; the liquid does not follow the finger further, and falls
// back when the finger has gone.
//
// phiAt() says how far inside the liquid a place is. Places are in
// millimetres on the egg: x from its axis, height from its base. Times are
// in milliseconds. Plain arithmetic, no browser parts.
import { EGG_HEIGHT_MM } from '../surface/egg-outline.js';
import { createEggDistance } from '../surface/egg-distance.js';

// The larger of two distances, with the corner between them rounded over
// `roundMm`: how two bodies of liquid join.
function joined(a, b, roundMm) {
  const near = Math.max(0, roundMm - Math.abs(a - b)) / roundMm;
  return Math.max(a, b) + (near * near * roundMm) / 4;
}

const clamp = (t) => Math.min(1, Math.max(0, t));

// settings: { sideMm, longestStepMs, land: { waitMs, travelMm },
// push: { insideMm, headMm, joinMm, rangeMm, followMs, backMs } }.
export function createShape(settings) {
  const { land, push } = settings;
  const egg = createEggDistance(settings.sideMm);
  const fingers = new Map(); // id -> where the finger is, and whether it moves the liquid yet
  const swellings = new Map(); // id -> the liquid a finger has gathered: { tip, strength, held }
  const fallen = []; // where liquid pushed out of the egg has just been let go
  let gathered = []; // the swellings, as a list
  let changed = null; // the box within which the pool's edge moved in the last step
  let lastMs = null;
  let stamp = 0; // goes up whenever the pool's edge may have moved

  // A finger further away than the liquid is followed counts as being at
  // the edge of that field, on the line to the egg's middle.
  function near(finger) {
    const middle = EGG_HEIGHT_MM / 2;
    const up = finger.h - middle;
    const share = Math.min(
      1,
      (egg.bounds.maxX - 1) / Math.abs(finger.x || 1e-9),
      up > 0 ? (egg.bounds.maxH - 1 - middle) / up : (middle - egg.bounds.minH - 1) / -(up || -1e-9),
    );
    return { x: finger.x * share, h: middle + up * share };
  }

  // How far a swelling stands out beyond the egg's outline, in millimetres
  // (nothing when it lies within the egg).
  const standsOut = (swelling) => Math.max(0, push.headMm * swelling.strength - egg.at(swelling.tip.x, swelling.tip.h));

  function step(nowMs) {
    const elapsed = lastMs === null ? 0 : Math.min(settings.longestStepMs, Math.max(0, nowMs - lastMs));
    lastMs = nowMs;
    let moved = false;
    const reach = push.headMm + push.joinMm;
    changed = null;

    for (const [id, finger] of fingers) {
      if (finger.off) continue;
      if (finger.waiting) {
        const travelled = Math.hypot(finger.x - finger.startX, finger.h - finger.startH);
        if (nowMs - finger.landedMs < land.waitMs && travelled < land.travelMm) continue;
        finger.waiting = false;
      }
      // Only a finger that has been on the liquid moves it.
      const at = near(finger);
      const depth = egg.at(at.x, at.h);
      if (depth > 0) finger.wasInside = true;
      if (!finger.wasInside) continue;
      // The liquid comes with the finger as far as just inside its own
      // edge, and lets go as the finger goes on beyond the outline.
      const inward = egg.inward(at.x, at.h);
      const short = Math.max(0, push.insideMm - depth);
      const aim = { x: at.x + inward.x * short, h: at.h + inward.h * short };
      const want = clamp((depth + push.rangeMm) / (push.rangeMm / 2));
      let swelling = swellings.get(id);
      if (!swelling) {
        swelling = { tip: { ...aim }, strength: 0, held: true };
        swellings.set(id, swelling);
      }
      swelling.held = want > 0;
      swelling.want = want;
      const follow = 1 - Math.exp(-elapsed / push.followMs);
      swelling.tip.x += (aim.x - swelling.tip.x) * follow;
      swelling.tip.h += (aim.h - swelling.tip.h) * follow;
    }

    for (const [id, swelling] of swellings) {
      const finger = fingers.get(id);
      if (!finger || finger.off) {
        swelling.held = false;
        swelling.want = 0;
      }
      const before = standsOut(swelling);
      const rate = swelling.want > swelling.strength ? push.followMs : push.backMs;
      swelling.strength += (swelling.want - swelling.strength) * (1 - Math.exp(-elapsed / rate));
      // Let go while it stood out of the egg, it falls back into the pool.
      if (!swelling.held && !swelling.falling && before > 0.5) {
        swelling.falling = true;
        fallen.push({ x: swelling.tip.x, h: swelling.tip.h, outMm: before });
      }
      if (swelling.held) swelling.falling = false;
      if (before > 0 || standsOut(swelling) > 0) {
        moved = true;
        const { x, h } = swelling.tip;
        changed = changed
          ? { minX: Math.min(changed.minX, x - reach), maxX: Math.max(changed.maxX, x + reach), minH: Math.min(changed.minH, h - reach), maxH: Math.max(changed.maxH, h + reach) }
          : { minX: x - reach, maxX: x + reach, minH: h - reach, maxH: h + reach };
      }
      if (!swelling.held && swelling.strength < 0.01) swellings.delete(id);
    }
    gathered = Array.from(swellings.values()).filter((swelling) => swelling.strength > 0);
    if (moved) stamp += 1;
    return moved;
  }

  return {
    // A finger lands, moves, lifts. spot: { xMm, heightMm }.
    down(id, spot, nowMs) {
      fingers.set(id, { x: spot.xMm, h: spot.heightMm, startX: spot.xMm, startH: spot.heightMm, landedMs: nowMs, waiting: true, off: false, wasInside: false });
    },
    move(id, spot) {
      const finger = fingers.get(id);
      if (!finger) return;
      finger.x = spot.xMm;
      finger.h = spot.heightMm;
    },
    up(id) {
      fingers.delete(id);
    },
    // This finger leaves the liquid alone from now on (it tunes the sound).
    drop(id) {
      const finger = fingers.get(id);
      if (finger) finger.off = true;
    },
    forget() {
      fingers.clear();
    },
    // Moves everything on to a moment. True while the pool's edge moves.
    step,
    // How far inside the liquid a place is: positive inside, negative outside.
    phiAt(x, h) {
      let phi = egg.at(x, h);
      for (let k = 0; k < gathered.length; k += 1) {
        const swelling = gathered[k];
        const blob = push.headMm * swelling.strength - Math.hypot(x - swelling.tip.x, h - swelling.tip.h);
        if (blob > phi - push.joinMm) phi = joined(phi, blob, push.joinMm);
      }
      return phi;
    },
    // The fingers that are on the liquid this moment, within the egg's
    // outline: [{ id, x, h }]. They press on its surface.
    pressing() {
      const list = [];
      for (const [id, finger] of fingers) {
        if (!finger.off && !finger.waiting && egg.at(finger.x, finger.h) > 0 && Math.abs(finger.x) < egg.bounds.maxX) list.push({ id, x: finger.x, h: finger.h });
      }
      return list;
    },
    // Where liquid has just fallen back into the pool; each place is given once.
    takeFallen() {
      return fallen.splice(0, fallen.length);
    },
    stamp: () => stamp,
    // The box within which the pool's edge moved in the last step ({ minX, maxX, minH, maxH }), or null.
    changed: () => changed,
    // Beyond this distance from a swelling's tip, the pool's edge is the egg's outline.
    reachMm: push.headMm + push.joinMm,
    swellings: () => Array.from(swellings.values(), (swelling) => ({ tip: { ...swelling.tip }, strength: swelling.strength, held: swelling.held, outMm: standsOut(swelling) })),
    egg,
    bounds: egg.bounds,
  };
}
