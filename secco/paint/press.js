// How firmly a finger presses, from the size of its contact. A phone
// reports the size of the finger's contact, not its pressure: a firmer
// press flattens the finger and the contact grows. The sizes a phone
// reports are not known in advance, so the smallest and largest seen so far
// set the range. Until they differ enough to be meaningful, and for a
// mouse, there is no reading. No browser parts.

// settings: { minSpanPx }: the sizes seen must differ this much before
// they are used.
export function createPress(settings) {
  let smallest = Infinity;
  let largest = -Infinity;
  return {
    // From 0 (the lightest touch seen) to 1 (the firmest), or null where
    // the contact size tells nothing.
    reading(contactSizePx) {
      if (!(contactSizePx > 1.5)) return null;
      if (contactSizePx < smallest) smallest = contactSizePx;
      if (contactSizePx > largest) largest = contactSizePx;
      const span = largest - smallest;
      if (span < settings.minSpanPx) return null;
      return (contactSizePx - smallest) / span;
    },
    range: () => (smallest <= largest ? { smallest, largest } : null),
  };
}

// The pad's radius for a reading: a firmer press is a wider mark.
// settings: { lightMm, firmMm, fixedMm }.
export function radiusFor(settings, pressure) {
  if (pressure === null) return settings.fixedMm;
  return settings.lightMm + (settings.firmMm - settings.lightMm) * pressure;
}
