// Settings of the release with the working label "the gesture-tuned egg".
// The label is used in code and documents only; the release's own name is
// not chosen yet, and nothing here is shown to a user except `title`.
//
// A release picks one of each part (surface, tuning, look) and gives its own
// colours and shop link. Values marked "stand-in" are starting points to be
// set by eye on the phone.

export default {
  id: 'gesture',
  title: 'eggic',

  // The shop door is not built yet, and there is no shop address yet.
  shopLink: null,

  // A grid of notes: the rows are the notes of the scale, and the right
  // column plays one octave higher than the left.
  surface: {
    kind: 'grid',
    columns: 2,
    // Where the middle of the egg sits, as a fraction of the visible page's
    // height. 50% is the chosen placement; to confirm on the phone.
    centreAtFraction: 0.5,
  },

  // The voices of this release, in the order the voice gesture steps
  // through them. Their note files go into the release's folder.
  voices: ['choir2', 'glass'],

  // One finger plays, two fingers tune (see src/tuning/gestures.js).
  tuning: {
    kind: 'gestures',
    scales: ['pentatonic', 'major'],
    // The egg shows two octaves at once and there are three octaves of
    // notes, so the register gesture has two positions.
    registers: ['down one', 'normal'],
    start: { voice: 'choir2', scale: 'pentatonic', register: 'normal' },
    remember: true, // the tuning is kept on the phone between visits
    slideMm: 6, // stand-in: how far two fingers slide before it counts
    pinchMm: 7, // stand-in: how much a pinch or spread must change
  },

  // Nothing overridden: the instrument's own sound settings apply.
  sound: {},

  look: {
    kind: 'sweep',
    background: '#F5EFE0', // cream; stand-in, the exact colour is open
    sweep: {
      angleDeg: 35, // stand-in; 0 runs straight down, 90 left to right
    },
    // The egg's colour follows the tuning.
    colours: {
      // Voice: the colour family, as the sweep's light and dark ends.
      families: {
        choir2: { light: '#DDDFE3', dark: '#8B9098' }, // silver; stand-in
        glass: { light: '#D2E7F2', dark: '#6A9FC4' }, // pale blue; stand-in
      },
      // Scale: how strong the sweep's contrast is. Stand-ins.
      contrast: { pentatonic: 1, major: 1.35 },
      // Register: how much lighter (towards white) or darker (towards
      // black) the egg is. Stand-ins.
      registerShift: { 'down one': -0.16, normal: 0, 'up one': 0.16 },
      blendMs: 330, // the colour blends over to a new tuning's in this time
    },
    highlight: {
      enabled: true,
      colour: '#FFFFFF',
      brightness: 0.9, // stand-in
      lengthMm: 30, // stand-in
      widthMm: 11, // stand-in
      angleDeg: 25, // stand-in; tilt of the streak, anticlockwise from level
      fadeInMs: 90,
      fadeOutMs: 450,
    },
  },
};
