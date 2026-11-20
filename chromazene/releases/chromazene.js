// Settings of the release named chromazene: chromazone (src/releases/lit.js)
// as one field of colour. The colours flow into each other across the
// whole egg, and the field shows where there is light: a soft glow that
// follows the playing thumb and fades behind it. Nothing here is shown to
// a user except `title`. Values marked "stand-in" are starting points to
// be set by eye on the phone.

export default {
  id: 'chromazene',
  title: 'eggic',
  entry: 'chromazene-main.js', // this release starts from its own file

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
    kind: 'chromazene',
    background: '#FAF8F2', // the lighter off-white
    egg: '#F8F3E3', // the resting egg: a creamier off-white, faint on the background

    blendMm: 4, // stand-in: how far each cell's colour flows into its neighbours
    glowMm: 5, // stand-in: how wide the glow under the thumb is
    softPxPerMm: 2, // the soft picture is worked out this fine, then stretched smooth
    fadeInMs: 60, // stand-in: how fast the glow comes on
    fadeOutMs: 700, // stand-in: how slowly it goes off; a slide leaves a trail
    blendMs: 330, // the colours blend over to a new tuning's in this time
    showSetMs: 500, // stand-in: a newly chosen set shows the whole egg this long

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
    // is the one a new phone starts in. Each is a slow journey of colour:
    // deeper at the egg's base, lighter at its point, drifting a little
    // towards one colour on the right, and slightly uneven so that it reads
    // as a wash. For each scale it has a layout: the rows from the egg's
    // point down to its base, one colour per column. The cells are not seen;
    // their colours are the points the field flows between. Any cell can be
    // given another colour.
    sets: [
      {
        name: 'dusk', // deep blue at the base through violet to peach at the point, drifting to magenta
        layouts: {
          pentatonic: [
            ['#E39293', '#E18E92', '#E08D92', '#E29293', '#E8A696', '#E19393'],
            ['#DE8391', '#B86597', '#DC8391', '#DB8091', '#CF6A8F', '#D87A90'],
            ['#9658A1', '#7E4BA6', '#B96496', '#8F4FA1', '#A95999', '#BD6093'],
            ['#4D378A', '#6D439A', '#74449B', '#764397', '#914D9F', '#7C4292'],
            ['#2C2A65', '#3C2E74', '#593989', '#523480', '#533374', '#753F8E'],
            ['#1B2449', '#322B63', '#292646', '#392B56', '#533374', '#57336F'],
          ],
          major: [
            ['#E9A195', '#F0B798', '#EBAB96', '#DF8B92', '#E6A095', '#DD8992'],
            ['#E49493', '#D47390', '#DE8892', '#D56F8E', '#D7788F', '#D97E90'],
            ['#A7609C', '#D7748F', '#A95D9A', '#D6738F', '#D5738F', '#BB5F94'],
            ['#7147A2', '#824CA5', '#7D48A0', '#A0579C', '#98519D', '#9C519C'],
            ['#69439D', '#73469F', '#74449B', '#7E479C', '#86499D', '#8D4A9D'],
            ['#392E7B', '#5A3B8F', '#473179', '#6C3F91', '#5F3784', '#6D3C89'],
            ['#382E79', '#3F2F79', '#4A327F', '#50337B', '#4F316D', '#5D3579'],
            ['#14213D', '#272750', '#2B274A', '#432E66', '#462E5E', '#4E3060'],
          ],
        },
      },
      {
        name: 'embers', // near black at the base through red and orange to gold at the point, drifting to orange
        layouts: {
          pentatonic: [
            ['#F28F24', '#F6BB3F', '#F6B13A', '#F8BD43', '#F6992F', '#F7A637'],
            ['#F1831E', '#E76719', '#F38722', '#F48C25', '#EE7620', '#F6902A'],
            ['#D64414', '#D94B16', '#CF3717', '#E5631C', '#D8491C', '#ED7422'],
            ['#B82512', '#AB2614', '#A52A16', '#AE3219', '#D0431C', '#C0431E'],
            ['#731010', '#761712', '#942416', '#972B18', '#AA371B', '#AF3E1E'],
            ['#340B0B', '#3C130D', '#481C10', '#7B2716', '#792F18', '#8B381B'],
          ],
          major: [
            ['#F39A2B', '#F5B23A', '#F6B33C', '#F59B2E', '#F7B03C', '#F8AE3C'],
            ['#F29729', '#F4A230', '#F38923', '#F27F1E', '#F58E28', '#F58725'],
            ['#DF5715', '#DB5017', '#DD5419', '#E86B1D', '#E4621E', '#EF7822'],
            ['#D13B13', '#DA4C17', '#DA4E19', '#D4411A', '#E4621E', '#DF571F'],
            ['#B92512', '#A92514', '#B22E16', '#D7461A', '#C43F1C', '#DF5820'],
            ['#9B1B11', '#992013', '#A02816', '#9C2C18', '#AA371B', '#A83B1D'],
            ['#5C0E0E', '#621610', '#721F13', '#7B2716', '#812F19', '#A0391D'],
            ['#340B0B', '#47140E', '#631E12', '#5A2514', '#692D17', '#86371B'],
          ],
        },
      },
      {
        name: 'sea', // deep teal at the base through green to pale aqua at the point, drifting to blue
        layouts: {
          pentatonic: [
            ['#B8EAD9', '#AFE2D6', '#9FD8D0', '#B2DADC', '#8EC9CC', '#93C6D0'],
            ['#81D6BE', '#5BC0AD', '#4FB5A8', '#50B2AB', '#76C1C0', '#67B7BB'],
            ['#41B19C', '#1E9289', '#45AEA3', '#41A8A3', '#349B9E', '#2F959D'],
            ['#116768', '#167273', '#1D8786', '#1E8488', '#1D7985', '#228692'],
            ['#116466', '#0D4B55', '#115966', '#125163', '#155A6F', '#19667D'],
            ['#093941', '#082E3B', '#0C3948', '#0E3D50', '#135065', '#16526C'],
          ],
          major: [
            ['#C7EFE0', '#C5EAE1', '#BAE2DD', '#98D1CF', '#9FCFD4', '#9FCBD6'],
            ['#7ED5BD', '#7ED1BF', '#5CBEB0', '#69C0B8', '#60B9B6', '#6DB9BD'],
            ['#44B39E', '#4DB7A5', '#5BBDAF', '#49ADA7', '#45A7A7', '#5CB3B6'],
            ['#41B29D', '#23998E', '#299A93', '#329D9A', '#48AAA9', '#30969E'],
            ['#157370', '#187877', '#187479', '#1F888B', '#218990', '#238B96'],
            ['#0D5359', '#13656B', '#166A72', '#1B777F', '#19697A', '#1D7486'],
            ['#0A434A', '#0E4D57', '#0E4755', '#156372', '#186779', '#16546E'],
            ['#0A3F46', '#082E3B', '#0F4A58', '#0E3A4D', '#12455C', '#16556E'],
          ],
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
