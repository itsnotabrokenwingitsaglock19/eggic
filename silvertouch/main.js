// Starts a release: reads its settings, picks the parts it names, and
// connects touch to sound and to the picture.
import { EGG_HEIGHT_MM, EGG_HALF_WIDTH_MM, EGG_WIDEST_HEIGHT_MM } from './surface/egg-outline.js';
import { LIFE_SIZE_CSS_PX_PER_MM, placeEgg, clientToEgg } from './surface/screen.js';
import { createStripesSurface } from './surface/stripes.js';
import { createGridSurface } from './surface/grid.js';
import { SCALES, REGISTER_ORDER, scaleNotes } from './engine/scales.js';
import { cellNotes, registerSpan } from './engine/cells.js';
import { soundSettings, createRestDetector, createPressVolume } from './engine/expression.js';
import { createSoundEngine } from './engine/sound-engine.js';
import { createFixedTuning } from './tuning/fixed.js';
import { createGestureTuning } from './tuning/gestures.js';
import { createSweepLook } from './look/sweep-look.js';
import { trackTouches } from './input/touches.js';
import { debugRequested, drawDebug } from './debug.js';

// The parts a release can pick from, by the names used in its settings.
const SURFACES = { stripes: createStripesSurface, grid: createGridSurface };
const TUNINGS = { fixed: createFixedTuning, gestures: createGestureTuning };
const LOOKS = { sweep: createSweepLook };

function pick(parts, kind, what) {
  if (!parts[kind]) throw new Error(`unknown ${what}: ${kind}`);
  return parts[kind];
}

// The phone's own storage, or null where it is refused (private browsing).
function phoneStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

export function start(release) {
  const debug = debugRequested();
  const canvas = document.getElementById('egg');
  const g = canvas.getContext('2d');

  const sound = soundSettings(release.sound);
  const tuning = pick(TUNINGS, release.tuning.kind, 'tuning')(release.tuning, {
    voices: release.voices,
    storage: phoneStorage(),
    storageKey: `eggic.${release.id}.tuning`,
  });
  const look = pick(LOOKS, release.look.kind, 'look')(release.look);
  const engine = createSoundEngine({ basePath: 'notes', settings: sound, meter: debug });
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

  const view = { width: 0, height: 0, placement: null };
  const playing = new Map(); // touch id -> how that touch is being played
  let frameWanted = false;
  let lastReading = null;
  // Where the thumb last played, for the sound that answers a gesture.
  // Before anything is played: the egg's widest point, left of the axis.
  let lastSpot = { xMm: -EGG_HALF_WIDTH_MM / 2, heightMm: EGG_WIDEST_HEIGHT_MM };

  function nowSeconds() {
    return performance.now() / 1000;
  }

  // ---- the picture ------------------------------------------------------

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    canvas.width = Math.round(view.width * ratio);
    canvas.height = Math.round(view.height * ratio);
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    view.placement = placeEgg({
      viewWidth: view.width,
      viewHeight: view.height,
      centreAtFraction: release.surface.centreAtFraction,
      pxPerMm: LIFE_SIZE_CSS_PX_PER_MM,
      eggHeightMm: EGG_HEIGHT_MM,
    });
    requestFrame();
  }

  function requestFrame() {
    if (frameWanted) return;
    frameWanted = true;
    window.requestAnimationFrame(frame);
  }

  function frame(nowMs) {
    frameWanted = false;
    updateSound();
    const moving = look.step(nowMs);
    look.draw(g, view);
    if (debug) drawDebug(g, view, surface, debugLines());
    // Keep drawing while a finger is down (vibrato grows while the thumb is
    // still, with no touch events to announce it) or the picture is still
    // changing (the highlight fading, the colour blending).
    if (moving || touches.list().length > 0) requestFrame();
  }

  // ---- touch to sound ---------------------------------------------------

  // One touch plays at a time. A touch plays if it began on the egg while
  // no other touch was playing; it keeps that role until it lifts or takes
  // part in a tuning gesture. A touch that began on the background, or
  // while another was playing, never plays.
  function playingTouch() {
    for (const touch of touches.list()) {
      const state = playing.get(touch.id);
      if (state && state.plays) return touch;
    }
    return null;
  }

  function updateSound() {
    if (!view.placement) return;
    const now = nowSeconds();
    const current = tuning.current();
    const player = playingTouch();
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
      const spot = clientToEgg(view.placement, player.x, player.y);
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
        // The thumb has slid off the egg: silence until it comes back.
        engine.setTouch(player.id, null);
        state.cell = null;
        state.rest.reset();
      }
    }

    look.setThumb(thumb, performance.now());
  }

  // ---- tuning -----------------------------------------------------------

  // Tell the tuning method about the touches. While two fingers make a
  // tuning gesture neither of them plays, then or later: the note that was
  // sounding fades out.
  function updateTuning() {
    const list = touches.list().map((touch) => {
      const spot = clientToEgg(view.placement, touch.x, touch.y);
      const state = playing.get(touch.id);
      return {
        id: touch.id,
        xMm: spot.xMm,
        heightMm: spot.heightMm,
        beganOnEgg: !!state && state.beganOnEgg,
      };
    });
    const gesture = tuning.touches(list);
    for (const id of gesture.pair) {
      const state = playing.get(id);
      if (state) state.plays = false;
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
    look.setTuning(current, performance.now());
    // The new tuning's files may still be on their way; answer when they
    // are here, unless the tuning has moved on by then.
    loadTuning(current)
      .then(() => {
        if (tuning.current() === current) answer(kind);
      })
      .catch(() => {});
    requestFrame();
  });

  function onTouch(kind, touch) {
    // Sound may only be started from inside a touch; see engine.unlock.
    if (kind !== 'move') engine.unlock();
    if (kind === 'down') {
      const spot = clientToEgg(view.placement, touch.x, touch.y);
      const beganOnEgg = surface.locate(spot.xMm, spot.heightMm).inside;
      playing.set(touch.id, {
        beganOnEgg,
        plays: beganOnEgg && !playingTouch(),
        cell: null,
        rest: createRestDetector(sound.vibrato),
      });
    }
    if (kind === 'up') {
      engine.setTouch(touch.id, null);
      playing.delete(touch.id);
    }
    updateTuning();
    updateSound(); // at once, not at the next frame, so the note is not late
    requestFrame();
  }

  const touches = trackTouches(canvas, onTouch);

  // No stuck notes: when the page is hidden, loses focus or is left, every
  // touch is forgotten and every sound stopped.
  function silence() {
    touches.clear();
    engine.stopAll();
    requestFrame();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) silence();
  });
  window.addEventListener('pagehide', silence);
  window.addEventListener('blur', silence);

  // Some browsers only allow sound from the end of a touch, or from a click
  // or a key, so those count as well.
  for (const name of ['touchend', 'click', 'keydown']) {
    document.addEventListener(name, () => engine.unlock());
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

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
    const options = tuning.options();
    const first = tuning.current();
    const everyNote = [];
    for (const scale of options.scales) {
      for (const note of SCALES[scale]) {
        if (everyNote.indexOf(note) < 0) everyNote.push(note);
      }
    }
    const distance = (voice, register) =>
      (voice === first.voice ? 0 : 2) +
      Math.abs(REGISTER_ORDER.indexOf(register) - REGISTER_ORDER.indexOf(first.register));
    // Every register the surface can reach in some tuning.
    const registers = [];
    for (const register of options.registers) {
      for (let above = 0; above < span; above += 1) {
        const played = REGISTER_ORDER[REGISTER_ORDER.indexOf(register) + above];
        if (registers.indexOf(played) < 0) registers.push(played);
      }
    }
    const lots = [];
    for (const voice of options.voices) {
      for (const register of registers) lots.push({ voice, register });
    }
    lots.sort((a, b) => distance(a.voice, a.register) - distance(b.voice, b.register));

    function next() {
      const lot = lots.shift();
      if (!lot) return;
      engine
        .load(lot.voice, lot.register, everyNote)
        .catch(() => {})
        .then(() => window.setTimeout(next, 150));
    }
    next();
  }

  // ---- debug readings ---------------------------------------------------

  function debugLines() {
    const status = engine.status();
    const current = tuning.current();
    const lines = [
      `audio ${status.audio} ${status.sampleRate} Hz  files ${status.loaded} (+${status.loading})`,
      `level ${engine.level().toFixed(3)}  sounding ${status.sounding.length}${status.singing ? '  singing' : ''}`,
      `view ${view.width} x ${view.height}  ${view.placement.pxPerMm.toFixed(3)} px/mm`,
      `tuning ${current.voice}, ${current.scale}, ${current.register}  (${tuning.status()})`,
      `touches ${touches.list().length}`,
    ];
    if (lastReading) {
      const { touch, wanted, cell } = lastReading;
      lines.push(
        `row ${cell.row} column ${cell.column}  ${wanted.register} ${wanted.note}${wanted.second ? ` + ${wanted.second.register} ${wanted.second.note}` : ''}  gain ${wanted.gain.toFixed(2)}  tone ${wanted.tone.toFixed(2)}`,
        `vibrato ${wanted.vibratoCents.toFixed(1)} c`,
        `contact ${touch.width.toFixed(1)} x ${touch.height.toFixed(1)}  pressure ${touch.pressure.toFixed(2)}  ${touch.kind}`,
      );
    }
    const range = press.range();
    if (range) lines.push(`contact range ${range.smallest.toFixed(1)} to ${range.largest.toFixed(1)}`);
    if (status.error) lines.push(`error ${status.error}`);
    return lines;
  }

  if (debug) {
    window.eggicDebug = { engine, touches, tuning, view, lastReading: () => lastReading };
  }

  // ---- go ---------------------------------------------------------------

  look.setTuning(tuning.current(), performance.now());
  resize();
  loadTuning(tuning.current())
    .catch(() => {
      // The egg stays silent; the debug view shows the error.
    })
    .then(() => {
      requestFrame();
      loadTheRest();
    });
}
