// Starts a release: reads its settings, picks the parts it names, and
// connects touch to sound and to the picture.
import { EGG_HEIGHT_MM } from './surface/egg-outline.js';
import { LIFE_SIZE_CSS_PX_PER_MM, placeEgg, clientToEgg } from './surface/screen.js';
import { createStripesSurface } from './surface/stripes.js';
import { scaleNotes } from './engine/scales.js';
import { soundSettings, createRestDetector, createPressVolume } from './engine/expression.js';
import { createSoundEngine } from './engine/sound-engine.js';
import { createFixedTuning } from './tuning/fixed.js';
import { createSweepLook } from './look/sweep-look.js';
import { trackTouches } from './input/touches.js';
import { debugRequested, drawDebug } from './debug.js';

// The parts a release can pick from, by the names used in its settings.
const SURFACES = { stripes: createStripesSurface };
const TUNINGS = { fixed: createFixedTuning };
const LOOKS = { sweep: createSweepLook };

function pick(parts, kind, what) {
  if (!parts[kind]) throw new Error(`unknown ${what}: ${kind}`);
  return parts[kind];
}

export function start(release) {
  const debug = debugRequested();
  const canvas = document.getElementById('egg');
  const g = canvas.getContext('2d');

  const sound = soundSettings(release.sound);
  const tuning = pick(TUNINGS, release.tuning.kind, 'tuning')(release.tuning);
  const look = pick(LOOKS, release.look.kind, 'look')(release.look);
  const engine = createSoundEngine({ basePath: 'notes', settings: sound, meter: debug });
  const press = createPressVolume(sound.press);

  // The surface depends on the scale: one band per note.
  const notes = scaleNotes(tuning.current().scale);
  const surface = pick(SURFACES, release.surface.kind, 'surface')(release.surface, notes.length);

  const view = { width: 0, height: 0, placement: null };
  const playing = new Map(); // touch id -> how that touch is being played
  let frameWanted = false;
  let lastReading = null;

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
    // still, with no touch events to announce it) or the highlight is fading.
    if (moving || touches.list().length > 0) requestFrame();
  }

  // ---- touch to sound ---------------------------------------------------

  // One touch plays at a time. A touch plays if it began on the egg while
  // no other touch was playing; it keeps that role until it lifts. A touch
  // that began on the background, or while another was playing, never plays.
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
        state.band = -1;
        state.rest.reset();
      }
    }

    if (player) {
      const state = playing.get(player.id);
      const spot = clientToEgg(view.placement, player.x, player.y);
      const where = surface.locate(spot.xMm, spot.heightMm);
      thumb = spot;
      if (where.inside) {
        const band = surface.bandFrom(spot.heightMm, state.band);
        if (band !== state.band) state.rest.reset(); // a new note: no vibrato yet
        state.band = band;
        state.rest.update(spot.xMm, spot.heightMm, now);
        const wanted = {
          voice: current.voice,
          register: current.register,
          note: notes[band],
          gain: press.gainFor(player.contactSize),
          tone: where.tone,
          vibratoCents: state.rest.cents(now),
        };
        engine.setTouch(player.id, wanted);
        lastReading = { touch: player, wanted, band };
      } else {
        // The thumb has slid off the egg: silence until it comes back.
        engine.setTouch(player.id, null);
        state.band = -1;
        state.rest.reset();
      }
    }

    look.setThumb(thumb, performance.now());
  }

  function onTouch(kind, touch) {
    // Sound may only be started from inside a touch; see engine.unlock.
    if (kind !== 'move') engine.unlock();
    if (kind === 'down') {
      const spot = clientToEgg(view.placement, touch.x, touch.y);
      playing.set(touch.id, {
        plays: surface.locate(spot.xMm, spot.heightMm).inside && !playingTouch(),
        band: -1,
        rest: createRestDetector(sound.vibrato),
      });
    }
    if (kind === 'up') {
      engine.setTouch(touch.id, null);
      playing.delete(touch.id);
    }
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

  // ---- debug readings ---------------------------------------------------

  function debugLines() {
    const status = engine.status();
    const lines = [
      `audio ${status.audio} ${status.sampleRate} Hz  files ${status.loaded} (+${status.loading})`,
      `level ${engine.level().toFixed(3)}  sounding ${status.sounding.length}`,
      `view ${view.width} x ${view.height}  ${view.placement.pxPerMm.toFixed(3)} px/mm`,
      `touches ${touches.list().length}`,
    ];
    if (lastReading) {
      const { touch, wanted, band } = lastReading;
      lines.push(
        `band ${band} note ${wanted.note}  gain ${wanted.gain.toFixed(2)}  tone ${wanted.tone.toFixed(2)}`,
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
    window.eggicDebug = { engine, touches, view, lastReading: () => lastReading };
  }

  // ---- go ---------------------------------------------------------------

  resize();
  const first = tuning.current();
  engine.load(first.voice, first.register, notes).catch(() => {
    // The egg stays silent; the debug view shows the error.
    requestFrame();
  });
}
