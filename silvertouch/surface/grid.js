// The grid surface layout: rows as in the stripes layout (the lowest note at
// the base, the highest at the point), and columns side by side across the
// egg. Each cell plays its own note: the row gives the note of the scale,
// and each column to the right plays one octave higher than the one before.
import {
  EGG_HEIGHT_MM,
  EGG_HALF_WIDTH_MM,
  EGG_WIDTH_MM,
  isInsideEgg,
} from './egg-outline.js';

export const GRID_DEFAULTS = {
  columns: 2,
  // How far past a cell's edge the thumb must go before the note changes.
  // Without it a thumb resting on an edge would flicker between two notes.
  edgeMarginMm: 0.4,
  // The tone of every note, from 0 (dark) to 1 (bright). In this layout
  // sliding across the egg changes the note, not the tone.
  tone: 0.7,
};

export function createGridSurface(settings, rowCount) {
  const option = (name) => (settings[name] === undefined ? GRID_DEFAULTS[name] : settings[name]);
  const rows = rowCount;
  const columns = option('columns');
  const edgeMarginMm = option('edgeMarginMm');
  const tone = option('tone');
  const rowHeightMm = EGG_HEIGHT_MM / rows;
  // Columns share the egg's full width equally, the same at every height.
  const columnWidthMm = EGG_WIDTH_MM / columns;

  // The cell at a point: { row, column }, rows counted from 0 at the base,
  // columns from 0 at the left. null outside the egg.
  function cellAt(xMm, heightMm) {
    if (!isInsideEgg(xMm, heightMm)) return null;
    const row = Math.min(rows - 1, Math.floor(heightMm / rowHeightMm));
    const across = Math.floor((xMm + EGG_HALF_WIDTH_MM) / columnWidthMm);
    return { row, column: Math.min(columns - 1, Math.max(0, across)) };
  }

  // The cell for a thumb that is already playing `current`: it stays in
  // that row, and in that column, until it is clearly inside another one.
  function cellFrom(xMm, heightMm, current) {
    const cell = cellAt(xMm, heightMm);
    if (!cell || !current) return cell;
    let { row, column } = cell;
    if (row !== current.row) {
      const bottom = current.row * rowHeightMm - edgeMarginMm;
      const top = (current.row + 1) * rowHeightMm + edgeMarginMm;
      if (heightMm >= bottom && heightMm <= top) row = current.row;
    }
    if (column !== current.column) {
      const left = -EGG_HALF_WIDTH_MM + current.column * columnWidthMm - edgeMarginMm;
      const right = -EGG_HALF_WIDTH_MM + (current.column + 1) * columnWidthMm + edgeMarginMm;
      if (xMm >= left && xMm <= right) column = current.column;
    }
    return { row, column };
  }

  function locate(xMm, heightMm) {
    return { inside: isInsideEgg(xMm, heightMm), tone };
  }

  // Where the edges between rows and between columns are, for the debug
  // view: heights from the base, and positions across from the egg's axis.
  function rowEdgesMm() {
    const edges = [];
    for (let i = 1; i < rows; i += 1) edges.push(i * rowHeightMm);
    return edges;
  }
  function columnEdgesMm() {
    const edges = [];
    for (let i = 1; i < columns; i += 1) edges.push(-EGG_HALF_WIDTH_MM + i * columnWidthMm);
    return edges;
  }

  return { rows, columns, rowHeightMm, columnWidthMm, cellAt, cellFrom, locate, rowEdgesMm, columnEdgesMm };
}
