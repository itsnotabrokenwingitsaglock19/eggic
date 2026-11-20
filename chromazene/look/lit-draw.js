// Drawing shared by the lit egg's looks: the egg's outline as a path, the
// resting egg, and a small soft picture stretched over the egg.
import { outlinePoints } from '../surface/egg-outline.js';
import { rgbText } from './colour.js';
import { eggRgb } from './lit-cells.js';

const outline = outlinePoints();

export function traceEgg(g, placement) {
  g.beginPath();
  for (let i = 0; i < outline.length; i += 1) {
    const x = placement.centreX + outline[i].x * placement.pxPerMm;
    const y = placement.baseY - outline[i].height * placement.pxPerMm;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

// The background and, on it, the resting egg in the colour of the tuning.
export function drawRestingEgg(g, view, settings, tint) {
  g.fillStyle = settings.background;
  g.fillRect(0, 0, view.width, view.height);
  if (!tint) return;
  traceEgg(g, view.placement);
  g.fillStyle = rgbText(eggRgb(settings, tint));
  g.fill();
}

// A small canvas for a soft picture (src/look/soft-picture.js): `pixels` is
// what the picture is painted into, and show() draws it over the egg,
// stretched smooth and cut off by the outline.
export function createSoftCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const inner = canvas.getContext('2d');
  const image = inner.createImageData(size.width, size.height);
  return {
    pixels: image.data,
    show(g, placement) {
      inner.putImageData(image, 0, 0);
      g.save();
      traceEgg(g, placement);
      g.clip(); // colour never shows outside the egg
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(
        canvas,
        placement.centreX - (size.widthMm / 2) * placement.pxPerMm,
        placement.baseY - size.heightMm * placement.pxPerMm,
        size.widthMm * placement.pxPerMm,
        size.heightMm * placement.pxPerMm,
      );
      g.restore();
    },
  };
}
