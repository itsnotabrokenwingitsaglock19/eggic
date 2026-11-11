// The look of the gesture-tuned egg: flat, the exact outline filled with one
// soft gradient (the sweep), no edge line, and a bright soft streak under
// the playing thumb (the highlight). The highlight is a separate layer that
// a release can switch off.
import {
  EGG_HEIGHT_MM,
  EGG_WIDTH_MM,
  outlinePoints,
} from '../surface/egg-outline.js';

function hexToRgb(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`colour must be written #RRGGBB: ${hex}`);
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function createSweepLook(settings) {
  const outline = outlinePoints();
  const sweep = settings.sweep;
  const highlight = settings.highlight;
  const [red, green, blue] = hexToRgb(highlight.colour);
  const glow = (alpha) => `rgba(${red}, ${green}, ${blue}, ${alpha})`;

  // The highlight's state: where it is (on the egg, in mm) and how visible.
  let strength = 0;
  let goal = 0;
  let xMm = 0;
  let heightMm = 0;
  let lastMs = null;

  function traceEgg(g, placement) {
    g.beginPath();
    for (let i = 0; i < outline.length; i += 1) {
      const x = placement.centreX + outline[i].x * placement.pxPerMm;
      const y = placement.baseY - outline[i].height * placement.pxPerMm;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
  }

  // Tell the look where the playing thumb is (null when no thumb plays).
  function setThumb(position, nowMs) {
    if (position) {
      xMm = position.xMm;
      heightMm = position.heightMm;
      goal = highlight.enabled ? 1 : 0;
    } else {
      goal = 0;
    }
    if (lastMs === null) lastMs = nowMs;
  }

  // Move the highlight's visibility towards its goal. Returns true while it
  // is still changing, so the caller knows to keep drawing.
  function step(nowMs) {
    const elapsed = lastMs === null ? 0 : Math.max(0, nowMs - lastMs);
    lastMs = nowMs;
    if (strength < goal) {
      strength = Math.min(goal, strength + elapsed / highlight.fadeInMs);
    } else if (strength > goal) {
      strength = Math.max(goal, strength - elapsed / highlight.fadeOutMs);
    }
    if (strength === goal) {
      lastMs = null; // settled: the next change starts its fade afresh
      return false;
    }
    return true;
  }

  function drawSweep(g, placement) {
    const width = EGG_WIDTH_MM * placement.pxPerMm;
    const height = EGG_HEIGHT_MM * placement.pxPerMm;
    const angle = (sweep.angleDeg * Math.PI) / 180;
    // The direction the sweep runs in, from its light end to its dark end:
    // 0 degrees is straight down, 90 is left to right.
    const dx = Math.sin(angle);
    const dy = Math.cos(angle);
    const reach = (Math.abs(dx) * width + Math.abs(dy) * height) / 2;
    const gradient = g.createLinearGradient(
      placement.centreX - dx * reach,
      placement.centreY - dy * reach,
      placement.centreX + dx * reach,
      placement.centreY + dy * reach,
    );
    gradient.addColorStop(0, sweep.light);
    gradient.addColorStop(1, sweep.dark);
    traceEgg(g, placement);
    g.fillStyle = gradient;
    g.fill();
  }

  function drawHighlight(g, placement) {
    if (strength <= 0) return;
    const peak = highlight.brightness * strength;
    g.save();
    traceEgg(g, placement);
    g.clip(); // the highlight never shows outside the egg
    g.translate(
      placement.centreX + xMm * placement.pxPerMm,
      placement.baseY - heightMm * placement.pxPerMm,
    );
    g.rotate((-highlight.angleDeg * Math.PI) / 180);
    g.scale(
      (highlight.lengthMm * placement.pxPerMm) / 2,
      (highlight.widthMm * placement.pxPerMm) / 2,
    );
    const gradient = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, glow(peak));
    gradient.addColorStop(0.35, glow(peak * 0.55));
    gradient.addColorStop(0.7, glow(peak * 0.15));
    gradient.addColorStop(1, glow(0));
    g.fillStyle = gradient;
    g.fillRect(-1, -1, 2, 2);
    g.restore();
  }

  function draw(g, view) {
    g.fillStyle = settings.background;
    g.fillRect(0, 0, view.width, view.height);
    drawSweep(g, view.placement);
    drawHighlight(g, view.placement);
  }

  return { setThumb, step, draw, traceEgg };
}
