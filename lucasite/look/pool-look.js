// The look of a mirror pool: the picture of the liquid (src/pool/picture.js)
// put on the screen. The picture is worked out on a small canvas, a few
// pixels to the millimetre, and stretched smooth onto the page, so that
// the liquid lies exactly where the egg is.
import { createPainter, pictureSize } from '../pool/picture.js';

// settings: the release's `look`. shape, surface: the liquid it shows.
export function createPoolLook(settings, shape, surface) {
  // The picture is worked out as fine as the phone manages: if frames take
  // too long, it steps down to the next, coarser, size and stays there.
  let fineness = 0;
  let picture = null;
  let spent = 0;
  let counted = 0;

  function make() {
    const size = pictureSize(shape.bounds, settings.pxPerMm[fineness]);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const inner = canvas.getContext('2d');
    const image = inner.createImageData(size.width, size.height);
    picture = { size, canvas, inner, image, painter: createPainter(settings, shape, surface, size) };
  }

  return {
    draw(g, view) {
      if (!picture) make();
      const began = performance.now();
      picture.painter.paint(picture.image.data);
      picture.inner.putImageData(picture.image, 0, 0);
      const { placement } = view;
      const { size } = picture;
      g.fillStyle = settings.background;
      g.fillRect(0, 0, view.width, view.height);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(
        picture.canvas,
        placement.centreX + size.minX * placement.pxPerMm,
        placement.baseY - size.maxH * placement.pxPerMm,
        size.widthMm * placement.pxPerMm,
        size.heightMm * placement.pxPerMm,
      );
      // Too slow, on average over a second's worth of frames: coarser.
      spent += performance.now() - began;
      counted += 1;
      if (counted >= 60) {
        if (spent / counted > settings.slowFrameMs && fineness < settings.pxPerMm.length - 1) {
          fineness += 1;
          picture = null;
        }
        spent = 0;
        counted = 0;
      }
    },
    // For the debug view and the checks: how fine the picture is, and how
    // long a frame has taken on average since the last count began.
    pxPerMm: () => settings.pxPerMm[fineness],
    frameMs: () => (counted ? spent / counted : 0),
  };
}
