// The lit egg's cells: where each one lies, what colour it has, and which
// are lit and how strongly. Plain arithmetic, no browser parts.
//
// A cell is { row, column }: rows counted from 0 at the egg's base, columns
// from 0 at the left, as in the grid surface (src/surface/grid.js). The
// number of rows goes with every cell here, because it changes with the
// scale and a cell lit in one scale may still be fading in the next.
import { EGG_HEIGHT_MM, EGG_HALF_WIDTH_MM, EGG_WIDTH_MM } from '../surface/egg-outline.js';
import { hexToRgb, mix } from './colour.js';

const BLACK = [0, 0, 0];

// The rectangle of a cell, in millimetres on the egg: x from the egg's
// axis, height from its base. The same division as the grid surface's.
export function cellRectMm(rows, columns, cell) {
  const rowHeightMm = EGG_HEIGHT_MM / rows;
  const columnWidthMm = EGG_WIDTH_MM / columns;
  return {
    xMm: -EGG_HALF_WIDTH_MM + cell.column * columnWidthMm,
    heightMm: cell.row * rowHeightMm, // its lower edge
    widthMm: columnWidthMm,
    tallMm: rowHeightMm,
  };
}

// ---- colour ---------------------------------------------------------------

// A colour set's layout for a scale is a list of rows, the row at the
// egg's point first, each a string with one digit per column: the place of
// that cell's colour in the set's `colours`.
export function cellHex(set, scale, cell) {
  const layout = set.layouts[scale];
  if (!layout) throw new Error(`colour set "${set.name}" has no layout for scale: ${scale}`);
  const line = layout[layout.length - 1 - cell.row];
  const colour = line === undefined ? undefined : set.colours[Number(line[cell.column])];
  if (!colour) throw new Error(`colour set "${set.name}", ${scale}: no colour for row ${cell.row} column ${cell.column}`);
  return colour;
}

// How far a tuning moves every colour: { cast, deep }. cast is how far
// towards the cast colour (the voice decides), deep how far towards the
// deeper colours of a lower register, from 0 (not at all) to 1.
export function tuningTint(look, tuning) {
  const cast = look.cast.voices[tuning.voice];
  const deep = look.deep.registers[tuning.register];
  if (typeof cast !== 'number') throw new Error(`no cast for voice: ${tuning.voice}`);
  if (typeof deep !== 'number') throw new Error(`no depth for register: ${tuning.register}`);
  return { cast, deep };
}

function tinted(hex, look, tint, deepest) {
  const cast = mix(hexToRgb(hex), hexToRgb(look.cast.colour), tint.cast);
  return mix(cast, BLACK, deepest * tint.deep);
}

// The colour of the resting egg, and of a cell, under a tint: [red, green,
// blue].
export function eggRgb(look, tint) {
  return tinted(look.egg, look, tint, look.deep.egg);
}

export function cellRgb(look, set, scale, cell, tint) {
  return tinted(cellHex(set, scale, cell), look, tint, look.deep.cells);
}

// ---- which cells are lit ----------------------------------------------------

// Keeps how strongly each cell is lit, from 0 to 1. A cell is lit while the
// thumb presses it or while it is held (the answering sound of a tuning
// gesture, the showing of a new colour set); it comes on over fadeInMs and
// goes off over fadeOutMs once nothing lights it any more, so a slide
// leaves a trail.
export function createGlow({ fadeInMs, fadeOutMs }) {
  const lit = new Map(); // key -> { scale, rows, row, column, level }
  let pressed = null; // the key of the cell under the thumb
  let holds = []; // { key, fromMs, toMs }
  let lastMs = null;

  const keyOf = (scale, cell) => `${scale} ${cell.row} ${cell.column}`;

  function know(scale, rows, cell) {
    const key = keyOf(scale, cell);
    if (!lit.has(key)) lit.set(key, { scale, rows, row: cell.row, column: cell.column, level: 0 });
    return key;
  }

  return {
    // The cell under the playing thumb, in the scale of the moment with its
    // number of rows; null when no thumb plays.
    press(cell, scale, rows) {
      pressed = cell ? know(scale, rows, cell) : null;
    },

    // Light a cell from one moment to another.
    hold(cell, scale, rows, fromMs, toMs) {
      holds.push({ key: know(scale, rows, cell), fromMs, toMs });
    },

    // Move every cell's light on to the time given. Answers true while
    // anything is still changing or still to come, so the caller knows to
    // keep drawing.
    step(nowMs) {
      // The time since the last step is gone through in stretches that end
      // wherever a hold begins or ends, so that each cell is lit for exactly
      // as long as it is held, however far apart the steps are.
      let at = lastMs === null ? nowMs : Math.min(lastMs, nowMs);
      const moments = [];
      for (const hold of holds) {
        for (const moment of [hold.fromMs, hold.toMs]) {
          if (moment > at && moment < nowMs) moments.push(moment);
        }
      }
      moments.sort((a, b) => a - b);
      moments.push(nowMs);
      let changing = false;
      for (const until of moments) {
        const elapsed = until - at;
        const held = new Set(
          holds.filter((hold) => hold.fromMs <= at && hold.toMs >= until && elapsed > 0).map((hold) => hold.key),
        );
        changing = false;
        for (const [key, cell] of lit) {
          const goal = key === pressed || held.has(key) ? 1 : 0;
          if (cell.level < goal) cell.level = Math.min(1, cell.level + elapsed / fadeInMs);
          else if (cell.level > goal) cell.level = Math.max(0, cell.level - elapsed / fadeOutMs);
          if (cell.level !== goal) changing = true;
        }
        at = until;
      }
      holds = holds.filter((hold) => hold.toMs > nowMs);
      // A cell that has gone dark, with nothing more to light it, is forgotten.
      for (const [key, cell] of lit) {
        if (cell.level === 0 && key !== pressed && !holds.some((hold) => hold.key === key)) lit.delete(key);
      }
      const busy = changing || holds.length > 0;
      lastMs = busy ? nowMs : null; // settled: the next change starts afresh
      return busy;
    },

    // The cells that show: { scale, rows, row, column, level }, level above 0.
    cells() {
      return Array.from(lit.values()).filter((cell) => cell.level > 0);
    },
  };
}
