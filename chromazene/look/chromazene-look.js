// The chromazene look: the lit egg as one field of colour. The colours of
// the cells flow into each other across the whole egg, with no cell to be
// seen, and the field shows only where there is light: a soft glow that
// follows the playing thumb and fades behind it, the cells the answering
// sound sings, and for a moment the whole egg when a colour set is chosen.
// The picture is worked out small and stretched smooth over the egg
// (src/look/soft-picture.js).
import { hexToRgb } from './colour.js';
import { cellHex, cellRectMm, createGlow } from './lit-cells.js';
import { createLitState } from './lit-state.js';
import { createSoftCanvas, drawRestingEgg } from './lit-draw.js';
import { createLightMap, createSoftPainter, softSize } from './soft-picture.js';

// settings: the release's `look`. columns: how many columns its surface has.
export function createChromazeneLook(settings, columns) {
  const state = createLitState(settings, columns);
  const size = softSize(settings.softPxPerMm);
  const painter = createSoftPainter(size, columns);
  const trail = createLightMap(size); // the thumb's light, fading
  const shown = new Float32Array(size.width * size.height); // all the light of one frame
  // The whole egg shown, for a new colour set: one light for all of it.
  const whole = createGlow(settings);
  const WHOLE = { row: 0, column: 0 };
  let canvas = null; // made at the first drawing

  // The scale of the moment, and its rows: the field is that scale's.
  let scale = null;
  let rows = 0;
  // The playing thumb: where it is, where its light was last laid down,
  // and how far its light has come on.
  let thumb = null; // { xMm, heightMm }
  let laid = null;
  let pressedMs = null;
  let lastMs = null;
  let trailLeft = 0;

  // The field of the set and scale of the moment, untinted; worked out
  // again only when either changes.
  let field = null;
  let fieldOf = '';
  function fieldNow() {
    const set = state.set();
    const key = `${set.name} ${scale}`;
    if (key !== fieldOf) {
      field = painter.field(rows, (row, column) => hexToRgb(cellHex(set, scale, { row, column })), settings.blendMm);
      fieldOf = key;
    }
    return field;
  }

  // The field as the tuning leans it: towards the cast colour, then
  // deeper. Worked out again only when the field or the tint changes.
  let leaned = null;
  let leanedOf = '';
  function leanedField(tint) {
    const plain = fieldNow();
    const key = `${fieldOf} ${tint.cast} ${tint.deep}`;
    if (key !== leanedOf) {
      if (!leaned) leaned = new Float32Array(plain.length);
      const cast = hexToRgb(settings.cast.colour);
      const keep = 1 - settings.deep.cells * tint.deep;
      for (let i = 0; i < plain.length; i += 1) {
        leaned[i] = (plain[i] + (cast[i % 3] - plain[i]) * tint.cast) * keep;
      }
      leanedOf = key;
    }
    return leaned;
  }

  // Lay the thumb's light down, from where it was last laid to where the
  // thumb is, as strong as it has come on since the thumb began to play.
  function layDown(nowMs) {
    const level = Math.min(1, (nowMs - pressedMs) / settings.fadeInMs);
    if (level <= 0) return;
    trail.stroke(laid || thumb, thumb, settings.glowMm, level);
    laid = thumb;
    trailLeft = Math.max(trailLeft, level);
  }

  // The playing thumb: its cell is not used here, its place is. `spot` is
  // { xMm, heightMm } on the egg, or null when no thumb plays.
  function press(cell, scaleNow, rowsNow, spot, nowMs) {
    scale = scaleNow;
    rows = rowsNow;
    if (spot && !thumb) pressedMs = nowMs;
    if (!spot && thumb) {
      // The lift: the light is brought up to this moment and laid one last
      // time, so that it fades from the lift on, and a tap shorter than a
      // frame still leaves its light.
      fadeTo(nowMs);
      layDown(nowMs);
      laid = null;
    }
    thumb = spot;
  }

  // Let the trail fade for the time since it was last brought up to date.
  function fadeTo(nowMs) {
    const elapsed = lastMs === null ? 0 : Math.max(0, nowMs - lastMs);
    if (trailLeft > 0 && elapsed > 0) trailLeft = trail.fade(elapsed / settings.fadeOutMs);
    lastMs = nowMs;
  }

  function showSet(scaleNow, rowsNow, nowMs) {
    scale = scaleNow;
    rows = rowsNow;
    whole.hold(WHOLE, 'all', 1, nowMs, nowMs + settings.showSetMs);
  }

  function step(nowMs) {
    fadeTo(nowMs);
    if (thumb) layDown(nowMs);
    const busy = [state.step(nowMs), whole.step(nowMs), trailLeft > 0, thumb !== null].some(Boolean);
    lastMs = busy ? nowMs : null;
    return busy;
  }

  function draw(g, view) {
    const tint = state.tint();
    drawRestingEgg(g, view, settings, tint);
    if (!tint || !scale) return;
    const sung = state.glow.cells();
    const wholeLight = whole.cells().length ? whole.cells()[0].level : 0;
    if (trailLeft <= 0 && sung.length === 0 && wholeLight <= 0) return;

    // All the light of this frame: the thumb's trail, the cells being sung
    // (a glow at each one's middle) and the whole egg.
    shown.set(trail.values);
    for (const cell of sung) {
      const rect = cellRectMm(cell.rows, columns, cell);
      trail.spotInto(shown, rect.xMm + rect.widthMm / 2, rect.heightMm + rect.tallMm / 2, settings.glowMm, cell.level);
    }

    if (!canvas) canvas = createSoftCanvas(size);
    const colours = leanedField(tint);
    const pixels = canvas.pixels;
    for (let i = 0; i < shown.length; i += 1) {
      const light = Math.max(shown[i], wholeLight);
      const at = i * 4;
      if (light <= 0.002) {
        pixels[at + 3] = 0;
        continue;
      }
      pixels[at] = colours[i * 3];
      pixels[at + 1] = colours[i * 3 + 1];
      pixels[at + 2] = colours[i * 3 + 2];
      pixels[at + 3] = Math.min(1, light) * 255;
    }
    canvas.show(g, view.placement);
  }

  return {
    setTuning: state.setTuning,
    setSet: state.setSet,
    set: () => state.set().name,
    press,
    sing(cells, scaleNow, rowsNow, nowMs, timing) {
      scale = scaleNow;
      rows = rowsNow;
      state.sing(cells, scaleNow, rowsNow, nowMs, timing);
    },
    showSet,
    step,
    draw,
    // For the debug view and the checks: the cells being sung, the tint
    // shown, and how strong the light is at a place on the egg.
    lit: () => state.glow.cells(),
    tint: state.tint,
    lightAt(xMm, heightMm) {
      const x = Math.floor((xMm + size.widthMm / 2) * size.pxPerMm);
      const y = Math.floor((size.heightMm - heightMm) * size.pxPerMm);
      if (x < 0 || y < 0 || x >= size.width || y >= size.height) return 0;
      const wholeLight = whole.cells().length ? whole.cells()[0].level : 0;
      return Math.max(trail.values[y * size.width + x], wholeLight);
    },
  };
}
