// Where the egg sits on the screen, and the conversion between screen
// positions (CSS pixels) and positions on the egg (millimetres).

// Life size on the two test phones, iPhone 12 and iPhone 16 Pro. Both are
// taken to be 460 pixels per inch with 3 device pixels per CSS pixel
// (unverified; the check is a ruler held to the egg on the phone: it should
// be 56.1 mm tall).
export const LIFE_SIZE_CSS_PX_PER_MM = 460 / 3 / 25.4;

// centreAtFraction: where the middle of the egg's height sits, as a fraction
// of the view's height (0 top, 1 bottom).
export function placeEgg({ viewWidth, viewHeight, centreAtFraction, pxPerMm, eggHeightMm }) {
  const centreX = viewWidth / 2;
  const centreY = viewHeight * centreAtFraction;
  return {
    pxPerMm,
    centreX,
    centreY,
    baseY: centreY + (eggHeightMm * pxPerMm) / 2,
  };
}

export function clientToEgg(placement, clientX, clientY) {
  return {
    xMm: (clientX - placement.centreX) / placement.pxPerMm,
    heightMm: (placement.baseY - clientY) / placement.pxPerMm,
  };
}

export function eggToClient(placement, xMm, heightMm) {
  return {
    x: placement.centreX + xMm * placement.pxPerMm,
    y: placement.baseY - heightMm * placement.pxPerMm,
  };
}
