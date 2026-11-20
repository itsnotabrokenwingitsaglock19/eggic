// Settings of the release named ferroline: a pool of black magnetic liquid
// in the shape of the egg. A finger draws the liquid to it and raises it in
// spikes; the first touch wakes the whole surface, which goes back to rest
// by itself or when the broom is tapped. Nothing here is shown to a user
// except `title`. Values marked "stand-in" are starting points to be set by
// eye and ear on the phone.

export default {
  id: 'ferroline',
  title: 'eggic',
  entry: 'ferroline-main.js', // this release starts from its own file

  // The shop door is not built yet, and there is no shop address yet.
  shopLink: null,

  // The notes stay where the egg is, whatever the liquid does: the grid of
  // the gesture-tuned egg. The rows are the notes of the scale; the left
  // column plays the row's note alone, and each column to the right adds a
  // second note sounding with it, one scale step higher per column.
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
  liquid: {
    sideMm: 22, // how far beyond the egg, on every side, the liquid can be followed: its reach, a tongue's tip and the join
    longestStepMs: 100, // a longer gap between two frames counts as this

    // A finger waits this long after landing, or until it has travelled
    // this far, before it draws the liquid: two fingers that land together
    // are tuning the sound and leave the liquid alone.
    land: { waitMs: 80, travelMm: 3 },

    // The still pool: its edge is rounded over rimMm, and it stands tallMm high.
    pool: { rimMm: 1.2, tallMm: 0.45 },

    // A finger draws the liquid to it.
    pull: {
      reachMm: 14, // how far beyond the egg's outline the liquid follows a finger
      inMm: 4, // a tongue is anchored this far inside the outline
      neckMm: 3.2, // half the width of a tongue where it leaves the pool
      headMm: 5, // and at its tip
      joinMm: 3, // how roundly a tongue joins the pool
      followMs: 90, // how quickly the tip follows the finger
      backMs: 260, // how quickly it flows back when let go
      rimLengthMm: 157, // the length of the egg's outline, over which the pool gives up liquid
      shrinkMostMm: 1.5, // the pool's edge never draws in further than this
    },

    // The spikes stand in a honeycomb that stays where it is on the egg.
    spikes: {
      pitchMm: 2.7, // they stand this far apart
      footShare: 0.56, // a spike's foot, as a share of that
    },

    // The cluster under a finger: the spikes around it stand tall.
    cluster: {
      reachMm: 11, // the cluster is twice this wide
      tallMm: 2, // the tallest spike under the firmest press
      lightest: 0.55, // the share of that height under the lightest press
      uneven: 0.25, // how much shorter a spike of the cluster can be than its neighbours
      domeMm: 0.35, // the liquid also swells a little under the finger
      riseMs: 120,
      sinkMs: 350,
      tapStrength: 0.6, // how strongly a quick tap raises its spikes
      // Once the finger has rested, the spikes quiver with the note's vibrato.
      stillMm: 1.5,
      quiverAfterMs: 700,
      quiverOverMs: 1200,
      quiverHz: 5.2,
      quiver: 0.1,
    },

    // The restless surface: low spikes all over the pool that come and go
    // while it is awake.
    restless: {
      tallMm: 0.5,
      least: 0.15, // the share of that height a spike keeps at its lowest
      slowHz: [0.2, 0.55], // each spike comes and goes in its own time, between these
      nearMm: 20, // near a finger the surface leans towards it
      nearFinger: 0.8, // and stands this much taller
    },

    // The first touch wakes the surface. It goes back to rest by itself
    // after a while without touch, or at once when it is calmed.
    awake: {
      wakeMs: 500, // how long it takes to wake
      restAfterMs: 10000, // without a touch for this long, it begins to settle
      settleMs: 3000, // and takes this long to become a still pool
      calmMs: 1000, // the broom puts it to rest in this time
    },

    // Waves of spikes: across the egg for a slide of two fingers, as a ring
    // for a spread or a pinch, and at each cell the answering sound sings.
    waves: {
      speedMmPerS: 110,
      widthMm: 6,
      spanMm: 45, // a wave starts and ends this far from the egg's middle
      tallMm: 1.2,
      spotMm: 5, // how wide the spikes for a sung cell stand
      spotOnMs: 60,
      spotOffMs: 350,
    },
  },

  look: {
    kind: 'ferroline',
    background: '#E4ECF2', // silver blue white. Stand-in
    liquid: '#0B0B0E', // glossy black. Stand-in
    shine: '#FFFFFF', // the colour of its highlights
    pxPerMm: [4, 3], // the picture is worked out this fine; the second is used if the phone is slow
    slowFrameMs: 14, // a frame that takes longer than this, on average, is slow
    edgeMm: 0.3, // how soft the liquid's edge is drawn
    // The light stands to the upper left: this far left of the egg's axis,
    // this far above its base, and this far in front of the screen.
    light: { xMm: -30, heightMm: 80, frontMm: 60 },
    glint: { sharpness: 120, strength: 1.6 }, // the small bright reflections on the spikes
    // However steep a spike is, it is lit as if it sloped less than this
    // (1 is 45 degrees), so that a tall spike shines along its side and
    // not only at its foot.
    steepest: 0.8,
    sheen: { sharpness: 12, strength: 0.22 }, // the broad soft shine on the pool
    shadow: { xMm: 0.9, downMm: 1.2, softMm: 1.6, strength: 0.16 }, // the liquid's shadow on the background
  },

  // The hidden UI, found by a long press on the background: the broom,
  // which puts the liquid to rest. The shop door will sit beside it, 9 mm
  // right of the egg's axis; it is not built yet.
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
