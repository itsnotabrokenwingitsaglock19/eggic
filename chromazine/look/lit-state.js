// What the lit egg's looks have in common, whatever they draw: the colour
// set of the moment, the tint of the tuning with its blend, and the cells
// that are lit. No browser parts.
import { createGlow, tuningTint } from './lit-cells.js';

// settings: the release's `look`. columns: how many columns its surface has.
export function createLitState(settings, columns) {
  const glow = createGlow(settings);
  let set = settings.sets[0];

  // The tint of the tuning: what is shown now, and the blend under way.
  let shown = null; // { cast, deep }
  let blend = null; // { from, to, startMs }

  return {
    glow,

    // Tell the look the tuning. The first time, its colours show at once;
    // after that, they blend over to the new tuning's.
    setTuning(tuning, nowMs) {
      const to = tuningTint(settings, tuning);
      if (!shown) {
        shown = to;
        return;
      }
      blend = { from: shown, to, startMs: nowMs };
    },

    // Choose a colour set by its name. Answers false if there is none.
    setSet(name) {
      const found = settings.sets.find((one) => one.name === name);
      if (found) set = found;
      return !!found;
    },
    set: () => set,

    // The answering sound of a tuning gesture lights the cells it sings,
    // one after the other, `stepSeconds` apart; the last one stays lit for
    // `holdSeconds`.
    sing(cells, scale, rows, nowMs, { stepSeconds, holdSeconds }) {
      cells.forEach((cell, index) => {
        const from = nowMs + index * stepSeconds * 1000;
        const last = index === cells.length - 1;
        glow.hold(cell, scale, rows, from, from + (last ? holdSeconds : stepSeconds) * 1000);
      });
    },

    // Show the colour set: every cell of the egg lights for a moment.
    showSet(scale, rows, nowMs) {
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          glow.hold({ row, column }, scale, rows, nowMs, nowMs + settings.showSetMs);
        }
      }
    },

    // Move the cells' light and the colour blend on to the time given.
    // Answers true while either is still changing.
    step(nowMs) {
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
    },

    // The tint shown now: { cast, deep }, or null before the first tuning.
    tint: () => shown,
  };
}
