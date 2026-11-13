// The "lit" look: a faint egg, the exact outline filled with one flat
// colour barely apart from the background, and on it the cells that are
// lit: flat blocks of colour, cut off by the outline, each coming on while
// it is pressed and fading when it is left. The colours come from a colour
// set and lean with the tuning (src/look/lit-cells.js).
import { outlinePoints } from '../surface/egg-outline.js';
import { rgbText } from './colour.js';
import { cellRectMm, cellRgb, createGlow, eggRgb, tuningTint } from './lit-cells.js';

// settings: the release's `look`. columns: how many columns its surface has.
export function createLitLook(settings, columns) {
  const outline = outlinePoints();
  const glow = createGlow(settings);
  let set = settings.sets[0];

  // The tint of the tuning: what is shown now, and the blend under way.
  let shown = null; // { cast, deep }
  let blend = null; // { from, to, startMs }

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

  // Tell the look the tuning. The first time, its colours show at once;
  // after that, they blend over to the new tuning's.
  function setTuning(tuning, nowMs) {
    const to = tuningTint(settings, tuning);
    if (!shown) {
      shown = to;
      return;
    }
    blend = { from: shown, to, startMs: nowMs };
  }

  // Choose a colour set by its name. Answers false if there is none.
  function setSet(name) {
    const found = settings.sets.find((one) => one.name === name);
    if (found) set = found;
    return !!found;
  }

  // The answering sound of a tuning gesture lights the cells it sings, one
  // after the other, `stepSeconds` apart; the last one stays lit for
  // `holdSeconds`.
  function sing(cells, scale, rows, nowMs, { stepSeconds, holdSeconds }) {
    cells.forEach((cell, index) => {
      const from = nowMs + index * stepSeconds * 1000;
      const last = index === cells.length - 1;
      glow.hold(cell, scale, rows, from, from + (last ? holdSeconds : stepSeconds) * 1000);
    });
  }

  // Show the colour set: every cell of the egg lights for a moment.
  function showSet(scale, rows, nowMs) {
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        glow.hold({ row, column }, scale, rows, nowMs, nowMs + settings.showSetMs);
      }
    }
  }

  // Move the cells' light and the colour blend on to the time given.
  // Answers true while either is still changing.
  function step(nowMs) {
    if (blend) {
      const amount = Math.min(1, Math.max(0, (nowMs - blend.startMs) / settings.blendMs));
      const eased = amount * amount * (3 - 2 * amount);
      shown = {
        cast: blend.from.cast + (blend.to.cast - blend.from.cast) * eased,
        deep: blend.from.deep + (blend.to.deep - blend.from.deep) * eased,
      };
      if (amount >= 1) blend = null;
    }
    return glow.step(nowMs) || blend !== null;
  }

  function draw(g, view) {
    const { placement } = view;
    g.fillStyle = settings.background;
    g.fillRect(0, 0, view.width, view.height);
    if (!shown) return;

    traceEgg(g, placement);
    g.fillStyle = rgbText(eggRgb(settings, shown));
    g.fill();

    const cells = glow.cells();
    if (cells.length === 0) return;
    // Cell edges are put on whole screen pixels, so that two lit cells side
    // by side meet without a seam.
    const ratio = (g.getTransform ? g.getTransform().a : 1) || 1;
    const snap = (value) => Math.round(value * ratio) / ratio;
    g.save();
    traceEgg(g, placement);
    g.clip(); // a cell never shows outside the egg
    for (const cell of cells) {
      const rect = cellRectMm(cell.rows, columns, cell);
      const left = snap(placement.centreX + rect.xMm * placement.pxPerMm);
      const right = snap(placement.centreX + (rect.xMm + rect.widthMm) * placement.pxPerMm);
      const bottom = snap(placement.baseY - rect.heightMm * placement.pxPerMm);
      const top = snap(placement.baseY - (rect.heightMm + rect.tallMm) * placement.pxPerMm);
      g.globalAlpha = cell.level;
      g.fillStyle = rgbText(cellRgb(settings, set, cell.scale, cell, shown));
      g.fillRect(left, top, right - left, bottom - top);
    }
    g.restore();
  }

  return {
    setTuning,
    setSet,
    set: () => set.name,
    // The cell under the playing thumb; null when no thumb plays.
    press: (cell, scale, rows) => glow.press(cell, scale, rows),
    sing,
    showSet,
    step,
    draw,
    // For the debug view and the checks: what is lit, and the tint shown.
    lit: () => glow.cells(),
    tint: () => shown,
  };
}
