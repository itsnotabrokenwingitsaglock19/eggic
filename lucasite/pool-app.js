// Runs a mirror pool: liquid in the shape of the egg (src/pool/shape.js)
// whose surface carries waves (src/pool/surface.js), over the gesture-tuned
// egg's instrument (src/instrument.js), with a hidden UI whose broom stills
// the surface. A release's starting file hands over its settings.
import { EGG_HEIGHT_MM, EGG_WIDTH_MM, isInsideEgg } from './surface/egg-outline.js';
import { LIFE_SIZE_CSS_PX_PER_MM, placeEgg } from './surface/screen.js';
import { trackTouches } from './input/touches.js';
import { createInstrument } from './instrument.js';
import { soundSettings } from './engine/expression.js';
import { createShape } from './pool/shape.js';
import { createSurface } from './pool/surface.js';
import { createPoolLook } from './look/pool-look.js';
import { createHiddenUi, drawHiddenUi } from './ui/hidden-ui.js';
import { debugRequested, drawReadings } from './debug.js';

export function startPool(release) {
  const debug = debugRequested();
  const canvas = document.getElementById('egg');
  const g = canvas.getContext('2d');

  const shape = createShape(release.pool);
  const surface = createSurface(release.pool.surface, shape.bounds);
  surface.cover(shape.phiAt, release.pool.surface.edgeMm);
  const look = createPoolLook(release.look, shape, surface);
  // The hidden UI is found by a long press outside the egg's outline. Its
  // positions are millimetres from the egg's middle, y down the screen.
  const ui = createHiddenUi(release.hiddenUi, EGG_HEIGHT_MM / 2, (spot) =>
    isInsideEgg(spot.x, EGG_HEIGHT_MM / 2 - spot.y),
  );
  const press = soundSettings(release.sound).press;
  const MIDDLE = { x: 0, h: EGG_HEIGHT_MM / 2 };
  const { swell, ring, sung, fall } = release.pool.waves;

  // The notes stay where the egg is. A touch plays wherever it began,
  // while it is inside the egg's outline; and any two fingers tune.
  let tuned = { ...release.tuning.start };
  const singing = []; // the cells the answering sound is still to sing: { atMs, x, h }
  const instrument = createInstrument(release, {
    debug,
    begins: 'anywhere',
    // A tuning gesture sends a swell over the pool: across it, the way the
    // fingers slid, for a new register or voice; a ring outwards for a
    // spread and inwards for a pinch.
    onTuning(current) {
      if (current.register !== tuned.register) {
        const up = release.tuning.registers.indexOf(current.register) > release.tuning.registers.indexOf(tuned.register);
        surface.swell({ x: 0, h: up ? 1 : -1 }, MIDDLE, swell.fromMm, swell.tallMm, swell.widthMm);
      } else if (current.voice !== tuned.voice) {
        const on = release.voices.indexOf(current.voice) > release.voices.indexOf(tuned.voice);
        surface.swell({ x: on ? 1 : -1, h: 0 }, MIDDLE, swell.fromMm, swell.tallMm, swell.widthMm);
      } else if (current.scale !== tuned.scale) {
        const wider = release.tuning.scales.indexOf(current.scale) > release.tuning.scales.indexOf(tuned.scale);
        if (wider) surface.kick(MIDDLE.x, MIDDLE.h, ring.outMmPerS, ring.widthMm);
        else surface.ringIn(MIDDLE, ring.inFromMm, ring.inTallMm, ring.widthMm);
      }
      tuned = { ...current };
      requestFrame();
    },
    // The pool shows what the egg sings: a small ripple at each cell of
    // the sound that answers a tuning gesture, as it is sung.
    onAnswer(answer) {
      const nowMs = performance.now();
      const grid = instrument.surface();
      answer.cells.forEach((cell, index) => {
        singing.push({
          atMs: nowMs + index * answer.stepSeconds * 1000,
          x: -EGG_WIDTH_MM / 2 + (cell.column + 0.5) * grid.columnWidthMm,
          h: (cell.row + 0.5) * grid.rowHeightMm,
        });
      });
      requestFrame();
    },
  });
  // The tuning kept on the phone is the one the egg opens in.
  tuned = { ...instrument.tuning.current() };

  const view = { width: 0, height: 0, placement: null };
  let frameWanted = false;
  let frames = 0; // frames drawn, for the debug view
  let lastMs = null;
  let covered = shape.stamp();

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
    // The egg may have moved on the screen under the fingers that are down.
    for (const touch of touches.list()) shape.move(touch.id, onEgg(touch));
    requestFrame();
  }

  function requestFrame() {
    if (frameWanted) return;
    frameWanted = true;
    window.requestAnimationFrame(frame);
  }

  function frame() {
    frameWanted = false;
    frames += 1;
    const nowMs = performance.now();
    const elapsed = lastMs === null ? 0 : nowMs - lastMs;
    lastMs = nowMs;
    instrument.update(touches.list(), view.placement);

    // The pool's edge, and the liquid that has fallen back into it.
    const edgeMoves = shape.step(nowMs);
    if (covered !== shape.stamp()) {
      surface.cover(shape.phiAt, release.pool.surface.edgeMm, shape.changed());
      covered = shape.stamp();
    }
    for (const place of shape.takeFallen()) surface.kick(place.x, place.h, fall.mmPerS, fall.widthMm);
    // The cells being sung.
    while (singing.length && singing[0].atMs <= nowMs) {
      const cell = singing.shift();
      surface.kick(cell.x, cell.h, sung.mmPerS, sung.widthMm);
    }
    // The fingers on the liquid press on it; a firmer press, which sounds
    // louder, presses deeper.
    const reading = instrument.lastReading();
    surface.press(
      shape.pressing().map((finger) => ({
        id: finger.id,
        x: finger.x,
        h: finger.h,
        press: reading && reading.touch.id === finger.id ? Math.min(1, Math.max(0, (reading.wanted.gain - press.quiet) / (press.loud - press.quiet))) : 0.5,
      })),
    );
    const rippling = surface.step(elapsed);

    const count = touches.list().length;
    const uiBusy = ui.tick(nowMs, count);
    look.draw(g, view);
    drawHiddenUi(g, view.placement, ui, release.hiddenUi, nowMs);
    if (debug) drawReadings(g, readings());
    // Keep drawing while the liquid moves, while a finger is down (a long
    // press is told by time alone, and so is the vibrato of a resting
    // thumb), while cells are still to be sung and while the hidden UI is
    // showing. Otherwise the page rests, and time starts afresh.
    if (edgeMoves || rippling || uiBusy || count > 0 || singing.length) requestFrame();
    else lastMs = null;
  }

  // ---- touch to liquid and to sound -----------------------------------------

  // Where a touch is on the egg, in millimetres: x from its axis, height
  // from its base.
  function onEgg(touch) {
    return {
      xMm: (touch.x - view.placement.centreX) / view.placement.pxPerMm,
      heightMm: (view.placement.baseY - touch.y) / view.placement.pxPerMm,
    };
  }
  // The same place as the hidden UI counts it: from the egg's middle, y down.
  const fromMiddle = (spot) => ({ x: spot.xMm, y: EGG_HEIGHT_MM / 2 - spot.heightMm });

  // Fingers that tune leave the liquid alone, from the moment they begin
  // to tune until they lift.
  function tuningFingersLeaveTheLiquid() {
    for (const touch of touches.list()) {
      if (instrument.tunes(touch.id)) shape.drop(touch.id);
    }
  }

  function onTouch(kind, touch) {
    const spot = onEgg(touch);
    const nowMs = performance.now();
    if (kind === 'down') {
      // A touch on an icon of the open hidden UI is not for the liquid, nor
      // for the instrument.
      const onIcon = ui.down(touch.id, fromMiddle(spot), touches.list().length === 1, nowMs);
      instrument.touch(kind, touch, touches.list(), view.placement, !onIcon);
      if (!onIcon) shape.down(touch.id, spot, nowMs);
      tuningFingersLeaveTheLiquid();
    } else if (kind === 'move') {
      ui.move(touch.id, fromMiddle(spot));
      instrument.touch(kind, touch, touches.list(), view.placement);
      tuningFingersLeaveTheLiquid();
      shape.move(touch.id, spot);
    } else {
      instrument.touch(kind, touch, touches.list(), view.placement);
      tuningFingersLeaveTheLiquid();
      shape.up(touch.id);
      // The broom stills the surface.
      if (ui.up(touch.id, nowMs, touch.cancelled) === 'broom') surface.still();
    }
    requestFrame();
  }

  const touches = trackTouches(canvas, onTouch);

  // When the page is hidden, loses focus or is left, every touch is
  // forgotten, so that no finger is taken to be still on the screen, and
  // every sound is stopped, so that no note is left sounding.
  const forget = () => {
    touches.clear();
    shape.forget();
    instrument.silence();
    requestFrame();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) forget();
  });
  window.addEventListener('pagehide', forget);
  window.addEventListener('blur', forget);

  // Some browsers only allow sound from the end of a touch, or from a click
  // or a key, so those count as well.
  for (const name of ['touchend', 'click', 'keydown']) {
    document.addEventListener(name, () => instrument.unlock());
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  // ---- debug readings (only with ?debug in the address) -----------------------

  function readings() {
    return [
      `view ${view.width} x ${view.height}  ${view.placement.pxPerMm.toFixed(3)} px/mm`,
      `touches ${touches.list().length}`,
      `hidden UI ${ui.isOpen() ? 'open' : 'closed'}`,
      `surface ${surface.moving() ? 'moving' : 'still'}  swellings ${shape.swellings().length}`,
      `picture ${look.pxPerMm()} px/mm  ${look.frameMs().toFixed(1)} ms a frame`,
    ].concat(instrument.readings());
  }

  if (debug) {
    window.eggicDebug = {
      engine: instrument.engine,
      touches,
      tuning: instrument.tuning,
      view,
      ui,
      shape,
      surface,
      look,
      frames: () => frames,
      lastReading: instrument.lastReading,
    };
  }

  // ---- go -------------------------------------------------------------------

  resize();
  instrument.start().then(requestFrame);
}
