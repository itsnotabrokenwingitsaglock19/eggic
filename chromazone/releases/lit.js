// Settings of the release named chromazone, with the working label "the lit
// egg": a faint egg whose cells light in colour while they are pressed. The
// label and the id are used in code and documents only; nothing here is
// shown to a user except `title`.
//
// It is the gesture-tuned egg's instrument (the same grid, sound and
// two-finger tuning) with another look, and a hidden UI that swaps the
// colour set. Values marked "stand-in" are starting points to be set by eye
// on the phone.

export default {
  id: 'lit',
  title: 'eggic',
  entry: 'lit-main.js', // this release starts from its own file

  // The shop door is not built yet, and there is no shop address yet.
  shopLink: null,

  // The grid of the gesture-tuned egg: the rows are the notes of the scale;
  // the left column plays the row's note alone, and each column to the
  // right adds a second note sounding with it, one scale step higher per
  // column.
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

  look: {
    kind: 'lit',
    background: '#FAF8F2', // the lighter off-white
    egg: '#F8F3E3', // the resting egg: a creamier off-white, faint on the background

    // A cell is a flat block of its colour, cut off by the egg's outline.
    fadeInMs: 60, // stand-in: how fast a pressed cell comes on
    fadeOutMs: 700, // stand-in: how slowly it goes off; a slide leaves a trail
    blendMs: 330, // the colours blend over to a new tuning's in this time
    showSetMs: 500, // stand-in: a newly chosen set shows every cell this long

    // The voice leans the resting egg and every cell towards the cast
    // colour: by nothing for choir2, by this share for glass. Stand-ins; the
    // cast colour is still to be chosen.
    cast: {
      colour: '#B9D7EA',
      voices: { choir2: 0, glass: 0.3 },
    },

    // The lower register makes everything deeper: the cells and the resting
    // egg move this share of the way to black. Stand-ins.
    deep: {
      registers: { 'down one': 1, normal: 0, 'up one': 0 },
      cells: 0.16,
      egg: 0.08,
    },

    // The colour sets, in the order the swap steps through them; the first
    // is the one a new phone starts in. Each has eight colours and, for each
    // scale, a layout: the rows from the egg's point down to its base, one
    // digit per column, each digit the place of that cell's colour in
    // `colours`. Any cell can be given another colour by changing its digit.
    // Stand-ins, scattered so that no cell has a neighbour of its colour.
    sets: [
      {
        name: 'night', // dark tones with two rare bright ones
        colours: ['#14213D', '#5A1E4A', '#0F4C3A', '#7A1F1F', '#2B2B2B', '#1C4E80', '#E0A500', '#D94F70'],
        layouts: {
          pentatonic: ['104312', '726254', '304313', '125245', '301313', '675042'],
          major: ['040653', '321314', '106523', '724017', '405356', '327412', '603237', '345146'],
        },
      },
      {
        name: 'strays', // one family of blues with a few odd cells
        colours: ['#0B3C8C', '#1F5FBF', '#3B82D9', '#6FA8E8', '#9CC4F0', '#274B7A', '#FF5A36', '#F2C200'],
        layouts: {
          pentatonic: ['462510', '503032', '412515', '257026', '031435', '450714'],
          major: ['315351', '540204', '327152', '404041', '132156', '245431', '516120', '745451'],
        },
      },
      {
        name: 'signal', // bold and saturated
        colours: ['#E4352B', '#1F4FD8', '#F5C400', '#1FA85A', '#FF7A1A', '#7B3FD1', '#F26BB5', '#12B5C9'],
        layouts: {
          pentatonic: ['261316', '050205', '721574', '037412', '652037', '746715'],
          major: ['260637', '143526', '021731', '436546', '754017', '101625', '367376', '420512'],
        },
      },
    ],
    rememberSet: true, // the colour set is kept on the phone between visits
  },

  // The hidden UI, found by a long press on the background: the swap icon,
  // which steps to the next colour set. The shop door will sit beside it,
  // 9 mm right of the egg's axis; it is not built yet.
  hiddenUi: {
    belowBaseMm: 12, // the icons' centres, below the egg's base
    icons: [{ name: 'swap', xMm: -9 }],
    iconMm: 6,
    touchMm: 8, // the square around an icon that counts as touching it
    holdMs: 600, // stand-in: how long a press is long
    stillMm: 1.5, // stand-in: how far a still finger may wander
    stayMs: 4000, // stand-in: it closes after this long without touch
    fadeMs: 250,
    colour: '#8C8779', // stand-in
  },
};
