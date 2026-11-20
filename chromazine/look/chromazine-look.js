// The chromazine look: the lit egg with soft cells. A lit cell is a patch
// of its colour whose edges fade, so cells lit side by side melt into each
// other and the grid is not seen. The picture is worked out small and
// stretched smooth over the egg (src/look/soft-picture.js).
import { cellRgb } from './lit-cells.js';
import { createLitState } from './lit-state.js';
import { createSoftCanvas, drawRestingEgg } from './lit-draw.js';
import { createSoftPainter, softSize } from './soft-picture.js';

// settings: the release's `look`. columns: how many columns its surface has.
export function createChromazineLook(settings, columns) {
  const state = createLitState(settings, columns);
  const size = softSize(settings.softPxPerMm);
  const painter = createSoftPainter(size, columns);
  let canvas = null; // made at the first drawing

  function draw(g, view) {
    const tint = state.tint();
    drawRestingEgg(g, view, settings, tint);
    const cells = state.glow.cells();
    if (!tint || cells.length === 0) return;
    if (!canvas) canvas = createSoftCanvas(size);
    const set = state.set();
    painter.paintCells(
      canvas.pixels,
      cells.map((cell) => ({ ...cell, rgb: cellRgb(settings, set, cell.scale, cell, tint) })),
      settings.featherMm,
    );
    canvas.show(g, view.placement);
  }

  return {
    setTuning: state.setTuning,
    setSet: state.setSet,
    set: () => state.set().name,
    // The cell under the playing thumb; null when no thumb plays.
    press: (cell, scale, rows) => state.glow.press(cell, scale, rows),
    sing: state.sing,
    showSet: state.showSet,
    step: state.step,
    draw,
    // For the debug view and the checks: what is lit, and the tint shown.
    lit: () => state.glow.cells(),
    tint: state.tint,
  };
}
