// How the thumb shapes the sound: vibrato when it rests, volume from the
// press, tone from left to right. Everything here is plain arithmetic with
// no browser parts, so it can be tested on its own.

// The instrument's settings. A release can override any of them under its
// own `sound` setting. The glide and vibrato values are the ones used in
// the note files' demo (assets/voice-notes/check_notes.py).
export const SOUND_DEFAULTS = {
  masterGain: 0.9,
  // A note fades in and out instead of switching on and off, so there is no
  // click. These are time constants: the fade is about 95% done after three
  // of them.
  attackSeconds: 0.015,
  releaseSeconds: 0.03,
  // The short glide between two notes (a crossfade), in seconds.
  glideSeconds: 0.03,
  vibrato: {
    rateHz: 5.2,
    cents: 8,
    delaySeconds: 0.7, // how long the thumb rests before vibrato starts
    bloomSeconds: 1.2, // how long it takes to reach full depth
    restRadiusMm: 1.5, // the thumb counts as resting while it stays this close
  },
  press: {
    quiet: 0.45, // gain of the lightest press
    loud: 1.0, // gain of the hardest press
    fixed: 0.8, // gain when the phone reports no usable contact size
    minSpanPx: 6, // the sizes seen must differ this much before they are used
    smoothingSeconds: 0.08,
  },
  tone: {
    darkHz: 1100, // filter at the egg's left edge
    brightHz: 10000, // filter at its right edge
    smoothingSeconds: 0.05,
  },
};

// SOUND_DEFAULTS with a release's overrides laid over it, one level deep.
export function soundSettings(overrides) {
  const merged = {};
  for (const key of Object.keys(SOUND_DEFAULTS)) {
    const base = SOUND_DEFAULTS[key];
    const over = overrides ? overrides[key] : undefined;
    if (base !== null && typeof base === 'object') {
      merged[key] = Object.assign({}, base, over || {});
    } else {
      merged[key] = over === undefined ? base : over;
    }
  }
  return merged;
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));

// Tone position (0 left, 1 right) to the filter's frequency. Equal steps
// across the egg are equal musical steps in brightness.
export function toneToHz(tone, settings) {
  return settings.darkHz * Math.pow(settings.brightHz / settings.darkHz, clamp01(tone));
}

// Vibrato depth in cents to the change in playback speed that bends the
// pitch that far.
export function centsToRate(cents) {
  return Math.pow(2, cents / 1200) - 1;
}

// Decides when the thumb is resting and how deep the vibrato is. The thumb
// rests while it stays within restRadiusMm of where it settled; moving
// further, or changing note, starts the wait again.
export function createRestDetector(settings) {
  let anchorX = 0;
  let anchorHeight = 0;
  let since = null;

  return {
    reset() {
      since = null;
    },
    update(xMm, heightMm, nowSeconds) {
      const moved = Math.hypot(xMm - anchorX, heightMm - anchorHeight);
      if (since === null || moved > settings.restRadiusMm) {
        anchorX = xMm;
        anchorHeight = heightMm;
        since = nowSeconds;
      }
    },
    cents(nowSeconds) {
      if (since === null) return 0;
      const rested = nowSeconds - since - settings.delaySeconds;
      const bloom = clamp01(rested / settings.bloomSeconds);
      return settings.cents * (0.5 - 0.5 * Math.cos(Math.PI * bloom));
    },
  };
}

// Volume from the press. A phone reports the size of the thumb's contact,
// not its pressure: a harder press flattens the thumb and the contact grows.
// The sizes a phone reports are not known in advance, so the smallest and
// largest seen so far set the range. Until they differ enough to be
// meaningful, and for a mouse, the volume is fixed.
export function createPressVolume(settings) {
  let smallest = Infinity;
  let largest = -Infinity;

  return {
    gainFor(contactSizePx) {
      if (!(contactSizePx > 1.5)) return settings.fixed;
      if (contactSizePx < smallest) smallest = contactSizePx;
      if (contactSizePx > largest) largest = contactSizePx;
      const span = largest - smallest;
      if (span < settings.minSpanPx) return settings.fixed;
      const press = (contactSizePx - smallest) / span;
      return settings.quiet + (settings.loud - settings.quiet) * press;
    },
    range() {
      return smallest <= largest ? { smallest, largest } : null;
    },
  };
}
