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

  surface: {
    kind: 'stripes',
    // Where the middle of the egg sits, as a fraction of the visible page's
    // height. 50% is the chosen placement; to confirm on the phone.
    centreAtFraction: 0.5,
  },

  // First build: one fixed tuning. The tuning gestures replace this.
  tuning: {
    kind: 'fixed',
    voice: 'choir2',
    scale: 'pentatonic',
    register: 'normal',
  },

  // The voices whose note files go into this release's folder.
  voices: ['choir2'],

  // Nothing overridden: the instrument's own sound settings apply.
  sound: {},

  look: {
    kind: 'sweep',
    background: '#F5EFE0', // cream; stand-in, the exact colour is open
    sweep: {
      light: '#DDDFE3', // stand-in
      dark: '#8B9098', // stand-in
      angleDeg: 35, // stand-in; 0 runs straight down, 90 left to right
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
