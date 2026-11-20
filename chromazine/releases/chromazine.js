// Settings of the release named chromazine: chromazone (src/releases/lit.js)
// with soft cells. A lit cell is a patch of colour whose edges fade into
// its neighbours, so the grid is not seen. Nothing here is shown to a user
// except `title`. Values marked "stand-in" are starting points to be set
// by eye on the phone.

export default {
  id: 'chromazine',
  title: 'eggic',
  entry: 'chromazine-main.js', // this release starts from its own file

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
    kind: 'chromazine',
    background: '#FAF8F2', // the lighter off-white
    egg: '#F8F3E3', // the resting egg: a creamier off-white, faint on the background

    featherMm: 1.8, // stand-in: how soft a cell's edges are
    softPxPerMm: 2, // the soft picture is worked out this fine, then stretched smooth
    fadeInMs: 60, // stand-in: how fast a pressed cell comes on
    fadeOutMs: 700, // stand-in: how slowly it goes off; a slide leaves a trail
    blendMs: 330, // the colours blend over to a new tuning's in this time
    showSetMs: 500, // stand-in: a newly chosen set shows every cell this long

    // The voice leans the resting egg and every colour towards the cast
    // colour: by nothing for choir2, by this share for glass. Stand-ins; the
    // cast colour is still to be chosen.
    cast: {
      colour: '#B9D7EA',
      voices: { choir2: 0, glass: 0.3 },
    },

    // The lower register makes everything deeper: the colours and the
    // resting egg move this share of the way to black. Stand-ins.
    deep: {
      registers: { 'down one': 1, normal: 0, 'up one': 0 },
      cells: 0.16,
      egg: 0.08,
    },

    // The colour sets, in the order the swap steps through them; the first
    // is the one a new phone starts in. Each is one family of a colour: ten
    // shades of it, then three highlight colours. For each scale it has a
    // layout: the rows from the egg's point down to its base, one character
    // per column, each the place of that cell's colour in `colours` (0 to 9
    // for the ten shades; a, b and c for the highlights). A shade lies in
    // patches of neighbouring cells, and each highlight in one cell on the
    // egg's rim: at the point, on the left, and lower right. Any cell can be
    // given another colour by changing its character.
    sets: [
      {
        name: 'yellows', // many yellows, with light blue, silver and black on the rim
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
        name: 'reds', // many reds, with pale pink, teal and black on the rim
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
        name: 'creams', // creams and beiges, with white, gold and dark brown on the rim
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
