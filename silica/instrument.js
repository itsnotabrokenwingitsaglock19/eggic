// The instrument: turns the touches on the screen into sound. It decides
// which touch plays, works out what the cell under it plays in the tuning
// of the moment, tells the tuning method about the touches, answers a
// tuning gesture with sound, and fetches the note files.
//
// It draws nothing and listens to nothing. A release's starting file feeds
// it the touches and the egg's place on the screen, and takes from it what
// the picture needs: where the playing thumb is, and when the tuning has
// changed.
import { EGG_HALF_WIDTH_MM, EGG_WIDEST_HEIGHT_MM } from './surface/egg-outline.js';
import { clientToEgg } from './surface/screen.js';
import { createStripesSurface } from './surface/stripes.js';
import { createGridSurface } from './surface/grid.js';
import { SCALES, REGISTER_ORDER, scaleNotes } from './engine/scales.js';
import { cellNotes, registerSpan } from './engine/cells.js';
import { soundSettings, createRestDetector, createPressVolume } from './engine/expression.js';
import { createSoundEngine } from './engine/sound-engine.js';
import { createFixedTuning } from './tuning/fixed.js';
import { createGestureTuning } from './tuning/gestures.js';

// The parts a release can pick from, by the names used in its settings.
const SURFACES = { stripes: createStripesSurface, grid: createGridSurface };
const TUNINGS = { fixed: createFixedTuning, gestures: createGestureTuning };

function pick(parts, kind, what) {
  if (!parts[kind]) throw new Error(`unknown ${what}: ${kind}`);
  return parts[kind];
}

// The phone's own storage, or null where there is none or it is refused
// (private browsing).
function phoneStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

// release: the release's settings; its `surface`, `tuning`, `voices` and
// `sound` are used here. options:
//   begins     'egg' (the usual): a touch plays, and takes part in a tuning
//              gesture, only if it began on the egg. 'anywhere': every touch
//              does, wherever it began; it still sounds only while it is
//              inside the egg's outline.
//   onTuning   called with the new tuning after every change of tuning
//   debug      measure the loudness of what is playing, for the debug view
//   storage    where the tuning is kept between visits; the phone's own
//              storage if left out
//   makeEngine makes the sound engine; the real one if left out
export function createInstrument(release, options = {}) {
  const begins = options.begins || 'egg';
  const onTuning = options.onTuning || (() => {});
  const debug = !!options.debug;

  const sound = soundSettings(release.sound);
  const tuning = pick(TUNINGS, release.tuning.kind, 'tuning')(release.tuning, {
    voices: release.voices,
    storage: options.storage === undefined ? phoneStorage() : options.storage,
    storageKey: `eggic.${release.id}.tuning`,
  });
  const engine = (options.makeEngine || createSoundEngine)({ basePath: 'notes', settings: sound, meter: debug });
  const press = createPressVolume(sound.press);
  const makeSurface = pick(SURFACES, release.surface.kind, 'surface');

  // The notes and the surface depend on the scale: one row per note.
  let notes = scaleNotes(tuning.current().scale);
  let surface = makeSurface(release.surface, notes.length);

  // What the surface's columns mean, and how many registers above the
  // tuning's own the surface reaches (see src/engine/cells.js).
  const across = release.surface.across;
  const span = registerSpan(across, surface.columns);
  for (const register of tuning.options().registers) {
    if (REGISTER_ORDER.indexOf(register) + span > REGISTER_ORDER.length) {
      throw new Error(`register "${register}" has no notes for the top of the surface`);
    }
  }

  const playing = new Map(); // touch id -> how that touch is being played
  let lastReading = null;
  // Where the thumb last played, for the sound that answers a gesture.
  // Before anything is played: the egg's widest point, left of the axis.
  let lastSpot = { xMm: -EGG_HALF_WIDTH_MM / 2, heightMm: EGG_WIDEST_HEIGHT_MM };

  function nowSeconds() {
    return performance.now() / 1000;
  }

  // ---- touch to sound ---------------------------------------------------

  // One touch plays at a time. A touch plays if it takes part (see `begins`)
  // and landed while no other touch was playing; it keeps that role until
  // it lifts or takes part in a tuning gesture. A touch that landed while
  // another was playing never plays.
  function playingTouch(list) {
    for (const touch of list) {
      const state = playing.get(touch.id);
      if (state && state.plays) return touch;
    }
    return null;
  }

  // Bring the sound up to date with the touches. `list` is every touch on
  // the screen, earliest first; `placement` is where the egg sits. Answers
  // where the playing thumb is on the egg ({ xMm, heightMm }), or null when
  // no touch has the playing role.
  function update(list, placement) {
    if (!placement) return null;
    const now = nowSeconds();
    const current = tuning.current();
    const player = playingTouch(list);
    let thumb = null;
    lastReading = null;

    for (const [id, state] of playing) {
      if (!player || id !== player.id) {
        engine.setTouch(id, null);
        state.cell = null;
        state.rest.reset();
      }
    }

    if (player) {
      const state = playing.get(player.id);
      const spot = clientToEgg(placement, player.x, player.y);
      const where = surface.locate(spot.xMm, spot.heightMm);
      thumb = spot;
      const cell = surface.cellFrom(spot.xMm, spot.heightMm, state.cell);
      if (cell) {
        const moved =
          !state.cell || cell.row !== state.cell.row || cell.column !== state.cell.column;
        if (moved) state.rest.reset(); // a new note: no vibrato yet
        state.cell = cell;
        state.rest.update(spot.xMm, spot.heightMm, now);
        const played = cellNotes(notes, current.register, cell, across);
        const wanted = {
          voice: current.voice,
          register: played.main.register,
          note: played.main.note,
          second: played.second
            ? { register: played.second.register, note: played.second.note, level: sound.harmony.level }
            : null,
          gain: press.gainFor(player.contactSize),
          tone: where.tone,
          vibratoCents: state.rest.cents(now),
        };
        engine.setTouch(player.id, wanted);
        lastSpot = spot;
        lastReading = { touch: player, wanted, cell };
      } else {
        // The thumb is off the egg: silence until it comes back.
        engine.setTouch(player.id, null);
        state.cell = null;
        state.rest.reset();
      }
    }
    return thumb;
  }

  // ---- tuning -----------------------------------------------------------

  // Tell the tuning method about the touches. While two fingers make a
  // tuning gesture neither of them plays, then or later: the note that was
  // sounding fades out.
  function updateTuning(list, placement) {
    const told = list.map((touch) => {
      const spot = clientToEgg(placement, touch.x, touch.y);
      const state = playing.get(touch.id);
      return {
        id: touch.id,
        xMm: spot.xMm,
        heightMm: spot.heightMm,
        beganOnEgg: !!state && state.takesPart,
      };
    });
    const gesture = tuning.touches(told);
    for (const id of gesture.pair) {
      const state = playing.get(id);
      if (state) {
        state.plays = false;
        state.tunes = true;
      }
    }
  }

  // The sound that answers a gesture: what the thumb last played, in the
  // new tuning. A new voice or register: that note, for about half a
  // second. A new scale: a quick run from that note up to the top.
  function answer(kind) {
    const current = tuning.current();
    const cell = surface.cellAt(lastSpot.xMm, lastSpot.heightMm) || { row: 0, column: 0 };
    const rows = [];
    for (let row = cell.row; row < (kind === 'scale' ? notes.length : cell.row + 1); row += 1) {
      rows.push(row);
    }
    const sung = rows.map((row) => {
      const main = cellNotes(notes, current.register, { row, column: cell.column }, across).main;
      return { voice: current.voice, register: main.register, note: main.note };
    });
    const answerSettings = sound.answer;
    return engine.sing(sung, {
      gain: answerSettings.gain,
      tone: surface.locate(lastSpot.xMm, lastSpot.heightMm).tone,
      stepSeconds: Math.min(
        answerSettings.slowestStepSeconds,
        Math.max(answerSettings.fastestStepSeconds, answerSettings.runSeconds / sung.length),
      ),
      holdSeconds: answerSettings.holdSeconds,
      fadeSeconds: answerSettings.fadeSeconds,
    });
  }

  tuning.onChange((kind, current) => {
    notes = scaleNotes(current.scale);
    if (notes.length !== surface.rows) {
      surface = makeSurface(release.surface, notes.length);
      for (const state of playing.values()) state.cell = null;
    }
    onTuning(current);
    // The new tuning's files may still be on their way; answer when they
    // are here, unless the tuning has moved on by then.
    loadTuning(current)
      .then(() => {
        if (tuning.current() === current) answer(kind);
      })
      .catch(() => {});
  });

  // A touch has landed ('down'), moved ('move') or ended ('up'). `list` is
  // every touch now on the screen, this one included unless it has ended.
  // `counts` is false for a landing touch that is not for the instrument
  // (one on a control): it never plays or tunes. Answers as update does.
  function touch(kind, touched, list, placement, counts = true) {
    // Sound may only be started from inside a touch; see engine.unlock.
    if (kind !== 'move') engine.unlock();
    if (kind === 'down' && counts) {
      const spot = clientToEgg(placement, touched.x, touched.y);
      const takesPart = begins === 'anywhere' || surface.locate(spot.xMm, spot.heightMm).inside;
      playing.set(touched.id, {
        takesPart,
        plays: takesPart && !playingTouch(list),
        tunes: false, // set once the touch takes part in a tuning gesture
        cell: null,
        rest: createRestDetector(sound.vibrato),
      });
    }
    if (kind === 'up') {
      engine.setTouch(touched.id, null);
      playing.delete(touched.id);
    }
    updateTuning(list, placement);
    return update(list, placement); // at once, not at the next frame, so the note is not late
  }

  // ---- loading ----------------------------------------------------------

  // The files one tuning needs: its scale's notes in every register the
  // surface reaches, the tuning's own register first.
  function loadTuning(current) {
    const wanted = scaleNotes(current.scale);
    const first = REGISTER_ORDER.indexOf(current.register);
    let loaded = Promise.resolve();
    for (let above = 0; above < span; above += 1) {
      loaded = loaded.then(() => engine.load(current.voice, REGISTER_ORDER[first + above], wanted));
    }
    return loaded;
  }

  // After the starting tuning's files, fetch the rest one voice and register
  // at a time, nearest tunings first, so a gesture is answered without a
  // wait. Each lot holds the notes of every scale the release offers.
  function loadTheRest() {
    const offered = tuning.options();
    const first = tuning.current();
    const everyNote = [];
    for (const scale of offered.scales) {
      for (const note of SCALES[scale]) {
        if (everyNote.indexOf(note) < 0) everyNote.push(note);
      }
    }
    const distance = (voice, register) =>
      (voice === first.voice ? 0 : 2) +
      Math.abs(REGISTER_ORDER.indexOf(register) - REGISTER_ORDER.indexOf(first.register));
    // Every register the surface can reach in some tuning.
    const registers = [];
    for (const register of offered.registers) {
      for (let above = 0; above < span; above += 1) {
        const played = REGISTER_ORDER[REGISTER_ORDER.indexOf(register) + above];
        if (registers.indexOf(played) < 0) registers.push(played);
      }
    }
    const lots = [];
    for (const voice of offered.voices) {
      for (const register of registers) lots.push({ voice, register });
    }
    lots.sort((a, b) => distance(a.voice, a.register) - distance(b.voice, b.register));

    function next() {
      const lot = lots.shift();
      if (!lot) return;
      engine
        .load(lot.voice, lot.register, everyNote)
        .catch(() => {})
        .then(() => setTimeout(next, 150));
    }
    next();
  }

  // Fetch the starting tuning's files, then the rest in the background.
  // The promise settles when the starting tuning's are here, or have
  // failed: the egg then stays silent and the debug view shows the error.
  function start() {
    return loadTuning(tuning.current())
      .catch(() => {})
      .then(() => {
        loadTheRest();
      });
  }

  // ---- debug readings ---------------------------------------------------

  function readings() {
    const status = engine.status();
    const current = tuning.current();
    const lines = [
      `audio ${status.audio} ${status.sampleRate} Hz  files ${status.loaded} (+${status.loading})`,
      `level ${engine.level().toFixed(3)}  sounding ${status.sounding.length}${status.singing ? '  singing' : ''}`,
      `tuning ${current.voice}, ${current.scale}, ${current.register}  (${tuning.status()})`,
    ];
    if (lastReading) {
      const { touch: thumb, wanted, cell } = lastReading;
      lines.push(
        `row ${cell.row} column ${cell.column}  ${wanted.register} ${wanted.note}${wanted.second ? ` + ${wanted.second.register} ${wanted.second.note}` : ''}  gain ${wanted.gain.toFixed(2)}  tone ${wanted.tone.toFixed(2)}`,
        `vibrato ${wanted.vibratoCents.toFixed(1)} c`,
        `contact ${thumb.width.toFixed(1)} x ${thumb.height.toFixed(1)}  pressure ${thumb.pressure.toFixed(2)}  ${thumb.kind}`,
      );
    }
    const range = press.range();
    if (range) lines.push(`contact range ${range.smallest.toFixed(1)} to ${range.largest.toFixed(1)}`);
    if (status.error) lines.push(`error ${status.error}`);
    return lines;
  }

  return {
    tuning,
    engine,
    // The surface of the moment; it is made anew when the scale changes.
    surface: () => surface,
    touch,
    update,
    // Whether a touch has taken part in a tuning gesture. Such a touch does
    // not play again, even after the gesture is over.
    tunes(id) {
      const state = playing.get(id);
      return !!state && state.tunes;
    },
    // Sound may only be started from inside a touch, a click or a key.
    unlock: () => engine.unlock(),
    // No stuck notes: stop every sound. The caller forgets the touches.
    silence: () => engine.stopAll(),
    start,
    readings,
    lastReading: () => lastReading,
  };
}
