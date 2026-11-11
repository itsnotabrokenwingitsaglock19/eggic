// The debug view, shown only when the page's address ends in ?debug.
// It draws the edges between the bands and a few lines of readings, for
// checking the app on a phone. It is never shown otherwise.

export function debugRequested() {
  return /[?&]debug\b/.test(window.location.search);
}

export function drawDebug(g, view, surface, lines) {
  const { placement } = view;
  g.save();

  // Band edges across the egg.
  g.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  g.lineWidth = 1;
  for (const edgeMm of surface.edgesMm()) {
    const y = placement.baseY - edgeMm * placement.pxPerMm;
    g.beginPath();
    g.moveTo(placement.centreX - 24 * placement.pxPerMm, y);
    g.lineTo(placement.centreX + 24 * placement.pxPerMm, y);
    g.stroke();
  }

  // Readings, top left, below the phone's status bar.
  g.font = '11px ui-monospace, Menlo, monospace';
  g.textBaseline = 'top';
  g.fillStyle = 'rgba(0, 0, 0, 0.7)';
  lines.forEach((line, index) => g.fillText(line, 10, 54 + index * 14));

  g.restore();
}
