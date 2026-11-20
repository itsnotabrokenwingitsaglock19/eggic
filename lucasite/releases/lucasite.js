// Settings of the release named lucasite: a pool of quicksilver in the shape of
// the egg. A touch sends ripples over its mirror surface, which travel,
// turn back at the egg's edge and die down; a finger that comes to the edge
// pushes it out a little. Nothing here is shown to a user except `title`.
// Values marked "stand-in" are starting points to be set by eye and ear on
// the phone.

export default {
  id: 'lucasite',
  title: 'eggic',
  entry: 'lucasite-main.js', // this release starts from its own file

  // The shop door is not built yet, and there is no shop address yet.
  shopLink: null,

  // The notes stay where the egg is: the grid of the gesture-tuned egg. The
  // rows are the notes of the scale; the left column plays the row's note
  // alone, and each column to the right adds a second note sounding with
  // it, one scale step higher per column.
  surface: {
    kind: 'grid',
    columns: 6,
    across: 'harmony',
    centreAtFraction: 0.5,
  },

  voices: ['choir2', 'glass'],

  // One finger plays, two fingers tune, as on the gesture-tuned egg.
  tuning: {
    kind: 'gestures',
    scales: ['pentatonic', 'major'],
    registers: ['down one', 'normal'],
    start: { voice: 'choir2', scale: 'pentatonic', register: 'normal' },
    remember: true,
    slideMm: 6, // stand-in
    pinchMm: 7, // stand-in
  },

  // Nothing overridden: the instrument's own sound settings apply.
  sound: {},

  // The liquid. Lengths are millimetres, times milliseconds. All stand-ins.
  pool: {
    sideMm: 7, // how far beyond the egg, on every side, the liquid and its shadow are followed
    longestStepMs: 100, // a longer gap between two frames counts as this

    // A finger waits this long after landing, or until it has travelled
    // this far, before it moves the liquid: two fingers that land together
    // are tuning the sound and leave the liquid alone.
    land: { waitMs: 80, travelMm: 3 },

    // A finger that comes to the pool's edge pushes it out a little.
    push: {
      insideMm: 2.6, // the liquid comes with the finger as far as this, inside the egg's outline
      headMm: 5, // the gathered liquid is this far across, from its middle
      joinMm: 4, // how roundly it joins the pool
      rangeMm: 6, // a finger further than this beyond the outline has let the liquid go
      followMs: 130, // how quickly the liquid follows the finger
      backMs: 260, // how quickly it falls back
    },

    // The surface, which carries waves.
    surface: {
      cellsPerMm: 2, // how fine the surface is worked out
      edgeMm: 0.4, // the surface ends this far inside the pool's edge
      speedMmPerS: 85, // how fast a wave travels
      calmS: 2.1, // a wave has faded to about a third after this many seconds
      levelHz: 0.9, // how strongly the surface is drawn back to level
      stillMm: 0.05, // waves smaller than this cannot be seen, and count as none
      stilledMs: 300, // the broom stills the surface within this time
      longestStepMs: 50,
      thick: { everyMs: 33, share: 0.5 }, // how thick the liquid is: its smallest ripples melt away
      // A finger presses a dimple into the surface.
      finger: {
        widthMm: 3.4,
        deepMm: 0.85, // under the firmest press
        lightest: 0.6, // the share of that depth under the lightest press
        hz: 7, // how quickly the surface gives way under the finger
      },
    },

    waves: {
      // A slide of two fingers sends a swell across the pool, the way they slid.
      swell: { fromMm: 22, tallMm: 0.8, widthMm: 4 },
      // A spread sends a ring out from the middle; a pinch, a ring in from ringFromMm away.
      ring: { outMmPerS: 18, widthMm: 4, inFromMm: 17, inTallMm: 0.35 },
      // Each cell the answering sound sings gets a small ripple.
      sung: { mmPerS: 7, widthMm: 2.5 },
      // Liquid that was pushed out of the egg pushes the pool as it falls back.
      fall: { mmPerS: 12, widthMm: 3.5 },
    },
  },

  look: {
    kind: 'pool',
    background: '#E4ECF2', // silver blue white. Stand-in
    liquid: '#EDF4FB', // the silver, at its brightest. Stand-in
    shine: '#FFFFFF',
    pxPerMm: [4, 3], // the picture is worked out this fine; the second is used if the phone is slow
    slowFrameMs: 14, // a frame that takes longer than this, on average, is slow
    ripple: 3.6, // how strongly a ripple shows, against its true height
    // The liquid rounds over within rimMm of its edge, where it stands
    // tallMm high; its edge is drawn softMm soft.
    edge: { rimMm: 1.3, tallMm: 0.3, softMm: 0.3 },
    // What the liquid mirrors. Ways are (x, up the screen, towards the eye).
    sky: { overhead: 0.82, low: 0.56 }, // how bright, straight above and near the horizon
    window: { towards: { x: -0.38, up: 0.62, front: 0.68 }, from: 0.8, to: 0.93, strength: 0.35 }, // the light: upper left
    dim: { towards: { x: 0.5, up: -0.82, front: 0.25 }, from: 0.25, to: 0.8, strength: 0.16 }, // the dimmer side: lower right
    shadow: { xMm: 1, downMm: 1.25, softMm: 1.8, strength: 0.2 }, // the liquid's shadow on the background
    around: { softMm: 1, strength: 0.08 }, // a faint shade all round the liquid
  },

  // The hidden UI, found by a long press on the background: the broom,
  // which stills the surface. The shop door will sit beside it, 9 mm right
  // of the egg's axis; it is not built yet.
  hiddenUi: {
    belowBaseMm: 12, // the icons' centres, below the egg's base
    icons: [{ name: 'broom', xMm: -9 }],
    iconMm: 6,
    touchMm: 8, // the square around an icon that counts as touching it
    holdMs: 600, // stand-in: how long a press is long
    stillMm: 1.5, // stand-in: how far a still finger may wander
    stayMs: 4000, // stand-in: it closes after this long without touch
    fadeMs: 250,
    colour: '#7C8894', // stand-in
  },
};
