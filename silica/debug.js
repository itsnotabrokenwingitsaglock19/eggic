// The debug view, shown only when the page's address ends in ?debug.
// It draws the edges between the notes and a few lines of readings, for
// checking the app on a phone. It is never shown otherwise.

export function debugRequested() {
  return /[?&]debug\b/.test(window.location.search);
}

export function drawDebug(g, view, surface, lines) {
  const { placement } = view;
  g.save();

  // The edges between rows and between columns.
  g.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  g.lineWidth = 1;
  for (const edgeMm of surface.rowEdgesMm()) {
    const y = placement.baseY - edgeMm * placement.pxPerMm;
    g.beginPath();
    g.moveTo(placement.centreX - 24 * placement.pxPerMm, y);
    g.lineTo(placement.centreX + 24 * placement.pxPerMm, y);
    g.stroke();
  }
  for (const edgeMm of surface.columnEdgesMm()) {
    const x = placement.centreX + edgeMm * placement.pxPerMm;
    g.beginPath();
    g.moveTo(x, placement.baseY + 3 * placement.pxPerMm);
    g.lineTo(x, placement.baseY - 59 * placement.pxPerMm);
    g.stroke();
  }

  g.restore();
  drawReadings(g, lines);
}

// Lines of readings, top left, below the phone's status bar.
export function drawReadings(g, lines) {
  g.save();
  g.font = '11px ui-monospace, Menlo, monospace';
  g.textBaseline = 'top';
  g.fillStyle = 'rgba(0, 0, 0, 0.7)';
  lines.forEach((line, index) => g.fillText(line, 10, 54 + index * 14));
  g.restore();
}
