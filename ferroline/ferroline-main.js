// Starts ferroline: a pool of magnetic liquid in the shape of the egg
// (src/ferro/liquid.js), which a finger draws to it and raises in spikes,
// over the gesture-tuned egg's instrument (src/instrument.js), with a
// hidden UI whose broom puts the liquid to rest. This release is put
// together differently from the others, so it has its own starting file.
import { EGG_HEIGHT_MM, EGG_WIDTH_MM, isInsideEgg } from './surface/egg-outline.js';
import { LIFE_SIZE_CSS_PX_PER_MM, placeEgg } from './surface/screen.js';
import { trackTouches } from './input/touches.js';
import { createInstrument } from './instrument.js';
import { soundSettings } from './engine/expression.js';
import { createLiquid } from './ferro/liquid.js';
import { createFerroLook } from './look/ferro-look.js';
import { createHiddenUi, drawHiddenUi } from './ui/hidden-ui.js';
import { debugRequested, drawReadings } from './debug.js';

export function start(release) {
  const debug = debugRequested();
  const canvas = document.getElementById('egg');
  const g = canvas.getContext('2d');

  const liquid = createLiquid(release.liquid);
  const look = createFerroLook(release.look, liquid);
  // The hidden UI is found by a long press outside the egg's outline, which
  // stays where it was whatever the liquid does. Its positions are
  // millimetres from the egg's middle, y down the screen.
  const ui = createHiddenUi(release.hiddenUi, EGG_HEIGHT_MM / 2, (spot) =>
    isInsideEgg(spot.x, EGG_HEIGHT_MM / 2 - spot.y),
  );
  const press = soundSettings(release.sound).press;

  // The notes stay where the egg is, whatever the liquid does. A touch
  // plays wherever it began, while it is inside the egg's outline; and any
  // two fingers tune.
  let tuned = { ...release.tuning.start };
  const instrument = createInstrument(release, {
    debug,
    begins: 'anywhere',
    // A tuning gesture sends a wave of spikes over the liquid: across it
    // for a new register or voice, as a ring for a new scale.
    onTuning(current) {
      const nowMs = performance.now();
      if (current.register !== tuned.register) {
        const up = release.tuning.registers.indexOf(current.register) > release.tuning.registers.indexOf(tuned.register);
        liquid.sweep({ x: 0, h: up ? 1 : -1 }, nowMs);
      } else if (current.voice !== tuned.voice) {
        const on = release.voices.indexOf(current.voice) > release.voices.indexOf(tuned.voice);
        liquid.sweep({ x: on ? 1 : -1, h: 0 }, nowMs);
      } else if (current.scale !== tuned.scale) {
        liquid.ring(release.tuning.scales.indexOf(current.scale) < release.tuning.scales.indexOf(tuned.scale), nowMs);
      }
      tuned = { ...current };
      requestFrame();
    },
    // The liquid shows what the egg sings: spikes rise at each cell of the
    // sound that answers a tuning gesture.
    onAnswer(answer) {
      const nowMs = performance.now();
      const surface = instrument.surface();
      answer.cells.forEach((cell, index) => {
        const from = nowMs + index * answer.stepSeconds * 1000;
        const last = index === answer.cells.length - 1;
        liquid.spot(
          {
            xMm: -EGG_WIDTH_MM / 2 + (cell.column + 0.5) * surface.columnWidthMm,
            heightMm: (cell.row + 0.5) * surface.rowHeightMm,
          },
          from,
          from + (last ? answer.holdSeconds : answer.stepSeconds) * 1000,
        );
      });
      requestFrame();
    },
  });
  // The tuning kept on the phone is the one the egg opens in.
  tuned = { ...instrument.tuning.current() };

  const view = { width: 0, height: 0, placement: null };
  let frameWanted = false;
  let frames = 0; // frames drawn, for the debug view

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
    for (const touch of touches.list()) liquid.move(touch.id, onEgg(touch), performance.now());
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
    instrument.update(touches.list(), view.placement);
    // A firmer press sounds louder, and raises taller spikes.
    const reading = instrument.lastReading();
    if (reading) liquid.press(reading.touch.id, (reading.wanted.gain - press.quiet) / (press.loud - press.quiet));
    const count = touches.list().length;
    const uiBusy = ui.tick(nowMs, count);
    const moving = liquid.step(nowMs);
    look.draw(g, view, nowMs);
    drawHiddenUi(g, view.placement, ui, release.hiddenUi, nowMs);
    if (debug) drawReadings(g, readings());
    // Keep drawing while the liquid moves or is awake, while a finger is
    // down (a long press is told by time alone, and so is the vibrato of a
    // resting thumb) and while the hidden UI is showing.
    if (moving || uiBusy || count > 0) requestFrame();
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
      if (instrument.tunes(touch.id)) liquid.drop(touch.id);
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
      if (!onIcon) liquid.down(touch.id, spot, nowMs);
      tuningFingersLeaveTheLiquid();
    } else if (kind === 'move') {
      ui.move(touch.id, fromMiddle(spot));
      instrument.touch(kind, touch, touches.list(), view.placement);
      tuningFingersLeaveTheLiquid();
      liquid.move(touch.id, spot, nowMs);
    } else {
      instrument.touch(kind, touch, touches.list(), view.placement);
      tuningFingersLeaveTheLiquid();
      liquid.up(touch.id, nowMs);
      // The broom puts the liquid to rest.
      if (ui.up(touch.id, nowMs, touch.cancelled) === 'broom') liquid.calm();
    }
    requestFrame();
  }

  const touches = trackTouches(canvas, onTouch);

  // When the page is hidden, loses focus or is left, every touch is
  // forgotten, so that no finger is taken to be still on the screen, and
  // every sound is stopped, so that no note is left sounding.
  const forget = () => {
    touches.clear();
    liquid.forget();
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
      `liquid awake ${liquid.awake().toFixed(2)}  tongues ${liquid.tongues().length}`,
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
      liquid,
      look,
      frames: () => frames,
      lastReading: instrument.lastReading,
    };
  }

  // ---- go -------------------------------------------------------------------

  resize();
  instrument.start().then(requestFrame);
}
