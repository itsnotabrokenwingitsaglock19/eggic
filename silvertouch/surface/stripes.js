// The stripes surface layout: horizontal bands of equal height, the lowest
// note at the base and the highest at the point. One note per band.
import {
  EGG_HEIGHT_MM,
  EGG_HALF_WIDTH_MM,
  EGG_WIDTH_MM,
  isInsideEgg,
} from './egg-outline.js';

export const STRIPES_DEFAULTS = {
  // How far past a band's edge the thumb must go before the note changes.
  // Without it a thumb resting on an edge would flicker between two notes.
  edgeMarginMm: 0.4,
};

export function createStripesSurface(settings, bandCount) {
  const edgeMarginMm =
    settings.edgeMarginMm === undefined
      ? STRIPES_DEFAULTS.edgeMarginMm
      : settings.edgeMarginMm;
  const bandHeightMm = EGG_HEIGHT_MM / bandCount;

  // The band at a height, counted from 0 at the base. -1 outside the egg.
  function bandAt(heightMm) {
    if (!(heightMm >= 0 && heightMm <= EGG_HEIGHT_MM)) return -1;
    return Math.min(bandCount - 1, Math.floor(heightMm / bandHeightMm));
  }

  // The band for a thumb that is already playing `currentBand`: it stays in
  // that band until it is clearly inside another one.
  function bandFrom(heightMm, currentBand) {
    const band = bandAt(heightMm);
    if (band === -1 || currentBand < 0 || currentBand >= bandCount) return band;
    if (band === currentBand) return band;
    const bottom = currentBand * bandHeightMm - edgeMarginMm;
    const top = (currentBand + 1) * bandHeightMm + edgeMarginMm;
    return heightMm >= bottom && heightMm <= top ? currentBand : band;
  }

  // Where a point is on the egg: inside or not, and the tone position from
  // 0 at the egg's left edge to 1 at its right edge (measured across the
  // egg's full width, the same at every height).
  function locate(xMm, heightMm) {
    const tone = (xMm + EGG_HALF_WIDTH_MM) / EGG_WIDTH_MM;
    return {
      inside: isInsideEgg(xMm, heightMm),
      tone: Math.min(1, Math.max(0, tone)),
    };
  }

  // Heights of the edges between bands, for the debug view.
  function edgesMm() {
    const edges = [];
    for (let i = 1; i < bandCount; i += 1) edges.push(i * bandHeightMm);
    return edges;
  }

  return { bandCount, bandHeightMm, bandAt, bandFrom, locate, edgesMm };
}
