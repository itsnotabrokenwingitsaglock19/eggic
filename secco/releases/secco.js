// Settings of the release named secco: a faint egg that is painted with a
// finger. The finger loads the colour of the grid cell it
// lands on and rubs chalky paint onto the shell, playing the egg's notes as
// it goes. Nothing here is shown to a user except `title`. Values marked
// "stand-in" are starting points to be set by eye and ear on the phone.

export default {
  id: 'secco',
  title: 'eggic',
  entry: 'secco-main.js', // this release starts from its own file

  // There is no shop address yet; the door in the hidden UI does nothing.
  shopLink: null,

  voices: ['choir2', 'glass'],

  // The notes lie on the grid of the gesture-tuned egg: the rows are the
  // notes of the scale; the left column plays the row's note alone, and
  // each column to the right adds a second note sounding with it, one scale
  // step higher per column. The same cells give the paint its colours.
  surface: {
    kind: 'grid',
    columns: 6,
    across: 'harmony',
    centreAtFraction: 0.5,
  },

  // One finger plays and paints; two fingers tune and paint nothing. The
  // tuning is heard and does not change the paint.
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

  // The paint (src/paint/field.js). All stand-ins.
  paint: {
    widthMm: 48, // the field the paint is kept in, centred on the egg
    heightMm: 60,
    cellMm: 0.25,
    layMm: 0.14, // how thick a loaded finger lays paint at an even press
    loadMmCells: 2200, // how much paint a finger lands with: about two lengths of the egg before it thins
    setsAfterS: 25, // left alone this long, the paint sets
    palesFrom: 0.55, // the share of that time after which the wet paint begins to look set
    coverMm: 0.03, // paint this thick covers what is under it
    deepestMm: 0.5, // set paint builds no higher than this
    // How long a finger waits after landing before it paints, and how far
    // it may travel before the wait ends early: a second finger that lands
    // meanwhile begins a tuning gesture, and the first has left no mark.
    land: { waitMs: 80, travelMm: 3 },
    finger: {
      ridge: 0.5, // how much thicker the stroke is near its edges
      streakMm: 0.7, // how wide the streaks of a stroke are
      streakLow: 0.5, // how thin the thinnest streak is, as a share
      thinsAt: 0.45, // the share of the load at which the stroke begins to thin
      filmMmCells: 30, // how much picked-up paint the pad carries easily
      filmLayMm: 0.09, // how thick it lays what it carries
      amountLight: 0.3, // how much the lightest touch lays, as a share of layMm
      amountFirm: 1.6, // and the firmest press
      pick: 0.05, // how much wet paint the pad picks up at each press
      down: 0.3, // how fast it takes along paint that stands too high
      up: 0.5, // how fast it lays paint where there is too little
    },
    // The press: how wide the pad's mark is, from the lightest touch to the
    // firmest press, and where the phone gives no usable contact size.
    press: { lightMm: 2.2, firmMm: 3.8, fixedMm: 3, minSpanPx: 6, smoothingMs: 80 },
    // The wipe: the paint thins away, halving this often, and is gone
    // after `ms`. Fingers do not paint meanwhile.
    wipe: { ms: 700, halvesEveryMs: 70 },
  },

  // What the long press on the background brings up (src/ui/hidden-ui.js):
  // the swap, which steps to the next colour set; the broom, which wipes
  // the paint away; and the shop door, which does nothing yet.
  hiddenUi: {
    belowBaseMm: 12, // the icons' centres, below the egg's base
    icons: [
      { name: 'swap', xMm: -9 },
      { name: 'broom', xMm: 0 },
      { name: 'door', xMm: 9 },
    ],
    iconMm: 6,
    touchMm: 8, // the square around an icon that counts as touching it
    holdMs: 600, // stand-in: how long a press is long
    stillMm: 1.5, // stand-in: how far a still finger may wander
    stayMs: 4000, // stand-in: it closes after this long without touch
    fadeMs: 250,
    colour: '#8C8779', // stand-in
  },

  look: {
    kind: 'paint',
    background: '#FAF8F2', // the lighter off-white
    egg: '#F8F3E3', // the resting egg: a creamier off-white, faint on the background
    texelsPerCell: 3, // each cell of the paint is drawn as 3 x 3 squares
    coverMm: 0.03,
    // The shell's grain: how fine it is, how deep (paint thinner than this
    // lies only on its high points), and how soft that edge is.
    tooth: { fineMm: 0.14, midMm: 0.35, coarseMm: 0.9, depthMm: 0.07, softMm: 0.03 },
    dense: 0.5, // how unevenly the paint catches from place to place
    // Thin paint is chalk, thick paint has body: from where to where the
    // one becomes the other, and how much paler and grainier the thin is.
    split: { fromMm: 0.07, toMm: 0.15, thinPale: 0.07, thinGrainTone: 0.1 },
    softenPasses: 3, // how far the paint's heights are smoothed before they are drawn
    light: { fromDeg: 125, heightDeg: 38 }, // from the upper left, as on the sand
    relief: 1.5, // how strongly thick paint is shaded
    ambient: 0.55,
    lightest: 1.1,
    darkest: 0.74,
    pale: { wet: 0.02, set: 0.11 }, // how far towards white: wet paint, and set
    grainTone: 0.04,
    cloudTone: 0.06,
    densityTone: 0.05,
    swapMs: 500, // the painting blends over to a new colour set in this time
    // On a bare egg a newly chosen set shows faintly for a moment.
    wash: { strength: 0.3, riseMs: 150, holdMs: 400, fallMs: 550, blurMm: 2.25 },

    // The colour sets, in the order the swap steps through them; the first
    // is the one a new phone starts in. They are the sets of the release
    // chromazine, as stand-ins: each is one family of a colour, ten shades
    // of it, then three highlight colours. For each scale a set has a
    // layout: the rows from the egg's point down to its base, one character
    // per column, each the place of that cell's colour in `colours` (0 to 9
    // for the ten shades; a, b and c for the highlights). A finger loads
    // the colour of the cell it lands on.
    sets: [
      {
        name: 'yellows',
        colours: [
          '#FFF44F', '#FFE600', '#FFD800', '#FFBF00', '#E1AD01',
          '#FFF1A8', '#F4C430', '#EBA937', '#FBEC5D', '#E3F03B',
          '#9FD3F0', '#C4C7CC', '#1A1A1A',
        ],
        layouts: {
          pentatonic: ['44a662', '446668', '333888', 'b33557', '99955c', '111000'],
          major: ['11a999', '114999', '444977', '445377', 'b55336', '880366', '88002c', '880222'],
        },
      },
      {
        name: 'reds',
        colours: [
          '#FF2400', '#DC143C', '#C41E3A', '#E34234', '#7C0A02',
          '#FF6F61', '#E30B5D', '#800020', '#FF6347', '#9B111E',
          '#F6C1CC', '#1F9E9A', '#1A1A1A',
        ],
        layouts: {
          pentatonic: ['55a388', '511338', '111344', 'b09994', '07662c', '776622'],
          major: ['50a888', '500882', '550222', '667722', 'b67744', '111744', '11133c', '999333'],
        },
      },
      {
        name: 'creams',
        colours: [
          '#F3E9CF', '#E6D5B8', '#D8C3A0', '#C9A97A', '#B8935F',
          '#A89A85', '#EAD8C0', '#E9D3A1', '#DCCDB4', '#BDAE9C',
          '#FFFFFF', '#D4AF37', '#4A3B2A',
        ],
        layouts: {
          pentatonic: ['51a777', '509993', '400933', 'b46663', '26668c', '226688'],
          major: ['00a733', '007788', '007888', '551188', 'b51118', '551112', '45922c', '499926'],
        },
      },
    ],
    rememberSet: true, // the colour set is kept on the phone between visits
  },
};
