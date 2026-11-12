// The fingers that push the sand: where each one is, and when it pushes.
//
// A finger pushes the sand where it lands, then along its way. It waits a
// moment after landing before the sand moves: if a second finger lands in
// that moment, the two are tuning the sound and neither is to leave a mark.
// The wait ends after a set time, or sooner once the finger has travelled
// a little way, so it is spent under the finger, where it cannot be seen.
// When it is over, the sand is pushed along everything the finger did
// meanwhile.
//
// Positions are { x, y } in millimetres on the sand's field. Times are in
// milliseconds. Plain bookkeeping, no browser parts.

// land: { waitMs, travelMm }: how long a finger waits after landing, and
// how far it may travel from where it landed before the wait ends early.
// push(fromX, fromY, toX, toY): pushes the sand along a finger's way; from
// and to are the same point for the press where it lands.
export function createSandFingers(land, push) {
  // id -> { x, y, sinceMs, waiting, off }. `waiting` holds the way of a
  // finger that has not begun to push, from where it landed; null once it
  // pushes. `off` marks a finger that no longer pushes at all.
  const fingers = new Map();

  // The wait is over: push along everything the finger did meanwhile.
  function begin(finger) {
    const way = finger.waiting;
    finger.waiting = null;
    push(way[0].x, way[0].y, way[0].x, way[0].y);
    for (let i = 1; i < way.length; i += 1) push(way[i - 1].x, way[i - 1].y, way[i].x, way[i].y);
  }

  function waitIsOver(finger, nowMs) {
    if (!finger.waiting) return false;
    if (nowMs - finger.sinceMs >= land.waitMs) return true;
    const landed = finger.waiting[0];
    return Math.hypot(finger.x - landed.x, finger.y - landed.y) > land.travelMm;
  }

  return {
    has: (id) => fingers.has(id),

    // A finger lands.
    down(id, spot, nowMs) {
      fingers.set(id, { x: spot.x, y: spot.y, sinceMs: nowMs, waiting: [{ x: spot.x, y: spot.y }], off: false });
    },

    // A finger moves.
    move(id, spot, nowMs) {
      const finger = fingers.get(id);
      if (!finger) return;
      const from = { x: finger.x, y: finger.y };
      finger.x = spot.x;
      finger.y = spot.y;
      if (finger.waiting) {
        finger.waiting.push({ x: spot.x, y: spot.y });
        if (waitIsOver(finger, nowMs)) begin(finger);
      } else if (!finger.off) {
        push(from.x, from.y, spot.x, spot.y);
      }
    },

    // A finger lifts. One that lifts while it still waits was a quick tap,
    // and leaves its mark.
    up(id) {
      const finger = fingers.get(id);
      if (!finger) return;
      if (finger.waiting) begin(finger);
      fingers.delete(id);
    },

    // A finger stops pushing, for as long as it stays down. What it did
    // while it waited is forgotten.
    drop(id) {
      const finger = fingers.get(id);
      if (!finger) return;
      finger.waiting = null;
      finger.off = true;
    },

    // The field has moved under a finger: the finger is placed anew, and
    // the move itself pushes no sand.
    place(id, spot) {
      const finger = fingers.get(id);
      if (!finger) return;
      finger.x = spot.x;
      finger.y = spot.y;
      if (finger.waiting) finger.waiting = [{ x: spot.x, y: spot.y }];
    },

    // Called on every frame: fingers whose wait is over begin to push, even
    // if they have not moved.
    tick(nowMs) {
      for (const finger of fingers.values()) {
        if (waitIsOver(finger, nowMs)) begin(finger);
      }
    },
  };
}
