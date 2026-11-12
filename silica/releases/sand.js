// Settings of the release named silica, built into the folder `silica`: the
// egg's outline filled with sand, which fingers push around. In the code it
// goes by its working label, "the sand egg", and the id `sand`. Nothing
// here is shown to a user except `title`.
//
// This is the sand test page: it has no sound yet. Values marked "stand-in"
// are starting points to be set by eye on the phone.

export default {
  id: 'sand',
  title: 'eggic',
  entry: 'sand-main.js', // this release starts from its own file

  // The shop door is not built yet, and there is no shop address yet.
  shopLink: null,

  // No sound yet, so no note files go into the release's folder.
  voices: [],

  surface: {
    // Where the middle of the egg sits, as a fraction of the visible page's
    // height.
    centreAtFraction: 0.5,
  },

  sand: {
    // The field the sand can move in, centred on the egg. It is larger than
    // the screens of the test phones; sand cannot leave it.
    widthMm: 72,
    heightMm: 160,
    cellMm: 0.25, // the sand's depth is kept every quarter of a millimetre
    depthMm: 1.0, // stand-in: how deep the sand lies in the egg
    edgeMm: 0.15, // its depth right at the outline
    edgeSlope: 0.6, // how steeply it rises from the outline to full depth
    reposeSlope: 0.65, // sand steeper than this slides (about 33 degrees)
    stillMm: 0.0005, // movement smaller than this counts as lying still
    slumpPasses: 6, // how much sliding is worked out per frame

    // What a finger does to the sand. All stand-ins.
    finger: {
      radiusMm: 3, // the groove is twice this wide
      flatPart: 0.7, // the share of the radius where the sand is cleared
      floorMm: 0.02, // what is left under the finger: a few grains
      rimMm: 1.5, // how far the cleared floor rises towards the rim
      forward: 0.15, // how much the sand is carried ahead instead of aside
      spread: 0.5, // how far its way is turned to either side, in radians
      throwMm: 0.5, // how far beyond the rim the sand lands
    },

    // The rake: two fingers carry a row of tines between them, and each
    // tine combs a thin groove (see src/sand/rake.js). All stand-ins.
    rake: {
      spacingMm: 2.2, // from one tine to the next
      clearMm: 4.5, // from a finger's middle to the nearest tine
      mostTines: 16,
      tine: { radiusMm: 0.6, flatPart: 0.5, floorMm: 0.25, rimMm: 1.0, forward: 0.1, spread: 0.3, throwMm: 0.3 },
    },
  },

  // What the long press on the background brings up (src/ui/hidden-ui.js).
  // The shop door will sit beside the broom, 9 mm to the right of the egg's
  // axis; it is not built yet.
  hiddenUi: {
    belowBaseMm: 12, // the icons' centres, below the egg's base
    icons: [{ name: 'broom', xMm: -9 }], // the broom puts the sand back
    iconMm: 6,
    touchMm: 8, // the square around an icon that counts as touching it
    holdMs: 600, // stand-in: how long a press is long
    stillMm: 1.5, // stand-in: how far a still finger may wander
    stayMs: 4000, // stand-in: it closes after this long without touch
    fadeMs: 250,
    colour: '#7A6F5C', // stand-in
  },

  // What the broom does: the grains tremble, then the sand settles back
  // into the egg's shape. All stand-ins.
  reset: {
    trembleMs: 250,
    settleMs: 750,
    trembleTexels: 2, // how far the grains jump while they tremble
    blurPasses: 2, // how fast the grooves and ridges blur while settling
  },

  look: {
    kind: 'sand',
    background: '#FBFAF6', // nearly white with a trace of cream; stand-in
    sand: '#D9C8A5', // a brown-tinted cream; stand-in
    texelsPerCell: 3, // each cell of the sand is drawn as 3 x 3 squares
    // The grains. All stand-ins.
    grains: {
      seed: 20261111,
      grainMm: 0.25,
      domeMm: 0.09, // how far a grain stands up from the sand around it
      // How light or dark single grains are, as a share of the sand colour.
      shades: { from: 0.9, to: 1.07, dark: 0.7, darkShare: 0.07, bright: 1.14, brightShare: 0.05 },
      // The depth of sand at which a grain first shows. Thinner sand shows
      // as scattered grains.
      firstShowsMm: { from: 0.01, to: 0.12 },
    },
    // The light. All stand-ins.
    light: {
      fromDeg: 125, // from the upper left (0 is from the right, 90 from above)
      heightDeg: 38, // how high the light stands over the sand
      shadowReachMm: [0.35, 0.9], // how far from a ridge its shadow is looked for
      shadowSoftMm: 0.35, // how soft the shadow's edge is
    },
    shading: {
      ambient: 0.35, // light that reaches every slope
      darkest: 0.6,
      lightest: 1.16,
      sandShadow: 0.24, // how dark a ridge's shadow is on sand
      groundShadow: 0.16, // and on the background
    },
  },
};
