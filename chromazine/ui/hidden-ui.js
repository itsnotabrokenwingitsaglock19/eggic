// The hidden UI: a few small icons that a long press on the background
// brings up. A finger held still on the background, alone, for a moment
// opens it; it closes after a while without touch, or when the egg is
// touched. A tap on an icon is reported by the icon's name.
//
// Positions are millimetres from the middle of the egg, x to the right and
// y down. The first part of this file decides; drawHiddenUi draws.

// eggBaseYMm: where the egg's base is. isOnEgg(spot): whether a point lies
// inside the egg's outline.
export function createHiddenUi(settings, eggBaseYMm, isOnEgg) {
  const icons = settings.icons.map((icon) => {
    if (!SHAPES[icon.name]) throw new Error(`no such icon: ${icon.name}`);
    return { name: icon.name, x: icon.xMm, y: eggBaseYMm + settings.belowBaseMm };
  });
  let press = null; // the finger that may be starting a long press
  const taps = new Map(); // touch id -> the icon that touch landed on
  let openedMs = null; // when it opened; null while closed
  let closedMs = null; // when it began to close; null unless closing
  let levelAtClose = 0;
  let lastTouchMs = 0;

  const isOpen = () => openedMs !== null && closedMs === null;
  const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // How visible the icons are, from 0 to 1.
  function strength(nowMs) {
    if (openedMs === null) return 0;
    const since = Math.max(0, nowMs - (closedMs === null ? openedMs : closedMs)) / settings.fadeMs;
    if (closedMs === null) return Math.min(1, since);
    return Math.max(0, levelAtClose * (1 - since));
  }

  function close(nowMs) {
    if (!isOpen()) return;
    levelAtClose = strength(nowMs);
    closedMs = nowMs;
    taps.clear();
  }

  function iconAt(spot) {
    const half = settings.touchMm / 2;
    return icons.find((icon) => Math.abs(spot.x - icon.x) <= half && Math.abs(spot.y - icon.y) <= half) || null;
  }

  return {
    isOpen,
    strength,
    icons: () => icons,

    // A finger lands. `alone`: no other finger is on the screen. Returns
    // true if the touch is on an icon, and so is not for what lies under it.
    down(id, spot, alone, nowMs) {
      if (isOpen()) {
        lastTouchMs = nowMs;
        const icon = iconAt(spot);
        if (icon) {
          taps.set(id, { name: icon.name, from: spot, moved: false });
          return true;
        }
        if (isOnEgg(spot)) close(nowMs);
        return false;
      }
      press = alone && !isOnEgg(spot) ? { id, from: spot, sinceMs: nowMs } : null;
      return false;
    },

    move(id, spot) {
      if (press && press.id === id && apart(spot, press.from) > settings.stillMm) press = null;
      const tap = taps.get(id);
      if (tap && apart(spot, tap.from) > settings.stillMm) tap.moved = true;
    },

    // A finger lifts, or its touch is cancelled. Returns the name of the
    // icon it tapped, or null; a cancelled touch is never a tap.
    up(id, nowMs, cancelled) {
      if (press && press.id === id) press = null;
      if (isOpen()) lastTouchMs = nowMs;
      const tap = taps.get(id);
      if (!tap) return null;
      taps.delete(id);
      return isOpen() && !tap.moved && !cancelled ? tap.name : null;
    },

    // Called on every frame with the number of fingers on the screen.
    // Returns true while the hidden UI needs further frames.
    tick(nowMs, fingerCount) {
      if (press && fingerCount !== 1) press = null;
      if (press && nowMs - press.sinceMs >= settings.holdMs) {
        press = null;
        openedMs = nowMs;
        closedMs = null;
        lastTouchMs = nowMs;
      }
      if (isOpen()) {
        if (fingerCount > 0) lastTouchMs = nowMs;
        else if (nowMs - lastTouchMs >= settings.stayMs) close(nowMs);
      }
      if (closedMs !== null && strength(nowMs) <= 0) {
        openedMs = null;
        closedMs = null;
      }
      return press !== null || openedMs !== null;
    },
  };
}

// The icons' shapes, drawn inside a square one unit wide around 0, 0. They
// are rough stand-ins until the real icons are drawn or chosen.
const SHAPES = {
  // A broom: a handle running up to the right, and a fan of bristles.
  broom(g) {
    const along = { x: -0.637, y: 0.771 }; // down the handle
    const across = { x: 0.771, y: 0.637 };
    const head = { x: 0, y: -0.02 };
    g.moveTo(0.38, -0.48);
    g.lineTo(head.x, head.y);
    g.moveTo(head.x - across.x * 0.19, head.y - across.y * 0.19);
    g.lineTo(head.x + across.x * 0.19, head.y + across.y * 0.19);
    for (let k = -2; k <= 2; k += 1) {
      const t = k / 2;
      const fromX = head.x + across.x * 0.17 * t;
      const fromY = head.y + across.y * 0.17 * t;
      g.moveTo(fromX, fromY);
      g.lineTo(fromX + along.x * 0.44 + across.x * 0.09 * t, fromY + along.y * 0.44 + across.y * 0.09 * t);
    }
  },
  // A swap: one arrow to the right above one arrow to the left.
  swap(g) {
    for (const way of [1, -1]) {
      const y = -0.15 * way;
      const tip = 0.32 * way;
      g.moveTo(-tip, y);
      g.lineTo(tip, y);
      g.moveTo(tip - 0.13 * way, y - 0.12);
      g.lineTo(tip, y);
      g.lineTo(tip - 0.13 * way, y + 0.12);
    }
  },
};

export function drawHiddenUi(g, placement, ui, settings, nowMs) {
  const strength = ui.strength(nowMs);
  if (strength <= 0) return;
  const size = settings.iconMm * placement.pxPerMm;
  g.save();
  g.globalAlpha = strength;
  g.strokeStyle = settings.colour;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const icon of ui.icons()) {
    g.save();
    g.translate(placement.centreX + icon.x * placement.pxPerMm, placement.centreY + icon.y * placement.pxPerMm);
    g.scale(size, size);
    g.lineWidth = 0.075;
    g.beginPath();
    SHAPES[icon.name](g);
    g.stroke();
    g.restore();
  }
  g.restore();
}
