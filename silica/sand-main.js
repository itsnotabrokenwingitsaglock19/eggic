// Starts the sand egg: makes the field of sand in the shape of the egg,
// draws it, lets a finger on the screen push the sand and play the notes
// of the egg that was there (src/instrument.js), lets two fingers tune the
// sound, and runs the hidden UI with the broom that puts the sand back.
// This release is put together differently from the ones that start in
// main.js, so it has its own starting file.
import { EGG_HEIGHT_MM, isInsideEgg } from './surface/egg-outline.js';
import { LIFE_SIZE_CSS_PX_PER_MM, placeEgg } from './surface/screen.js';
import { trackTouches } from './input/touches.js';
import { createInstrument } from './instrument.js';
import { createSandField } from './sand/field.js';
import { createSandFingers } from './sand/fingers.js';
import { createSandLook } from './look/sand-look.js';
import { createHiddenUi, drawHiddenUi } from './ui/hidden-ui.js';
import { debugRequested, drawReadings } from './debug.js';

export function start(release) {
  const debug = debugRequested();
  const canvas = document.getElementById('egg');
  const g = canvas.getContext('2d');

  // The field's middle is the middle of the egg; y runs down the screen.
  const field = createSandField(release.sand, (xMm, yMm) => isInsideEgg(xMm, EGG_HEIGHT_MM / 2 - yMm));
  const look = createSandLook(release.look, field);
  // The hidden UI is found by a long press outside the egg's outline, which
  // stays where it was whatever the sand does.
  const ui = createHiddenUi(release.hiddenUi, EGG_HEIGHT_MM / 2, (spot) =>
    isInsideEgg(spot.x, EGG_HEIGHT_MM / 2 - spot.y),
  );
  const startVolume = field.volume();
  // The notes stay where the egg was, whatever the sand does. A touch
  // plays wherever it began, while it is inside the egg's outline; and any
  // two fingers tune, since the sand no longer shows where the egg ends.
  const instrument = createInstrument(release, { debug, begins: 'anywhere' });

  const view = { width: 0, height: 0, placement: null };
  let frameWanted = false;
  let frames = 0; // how many frames have been drawn (a debug reading)

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
    // The egg may have moved on the screen: the fingers that are down are
    // placed anew, so that the move itself pushes no sand.
    for (const touch of touches.list()) fingers.place(touch.id, onField(touch));
    requestFrame();
  }

  function requestFrame() {
    if (frameWanted) return;
    frameWanted = true;
    window.requestAnimationFrame(frame);
  }

  function frame(nowMs) {
    frameWanted = false;
    frames += 1;
    instrument.update(touches.list(), view.placement);
    fingers.tick(nowMs);
    const count = touches.list().length;
    const uiBusy = ui.tick(nowMs, count);
    let moving = false;
    if (reset) {
      stepReset(nowMs);
      moving = true;
    } else {
      moving = field.relax(release.sand.slumpPasses);
      look.update();
    }
    look.draw(g, view);
    drawHiddenUi(g, view.placement, ui, release.hiddenUi, nowMs);
    if (debug) drawReadings(g, readings());
    // Keep drawing while the sand moves, while a finger is down (a long
    // press is told by time alone, and so is the vibrato of a resting
    // thumb) and while the hidden UI is showing.
    if (moving || uiBusy || count > 0) requestFrame();
  }

  // ---- the reset ---------------------------------------------------------

  // The broom's reset: the grains tremble for a moment, then the grooves
  // and ridges blur and the sand settles back into the egg's shape, the
  // trembling dying away as it does. Fingers do not push sand meanwhile.
  let reset = null; // { startMs, frame, done }

  function stepReset(nowMs) {
    const settings = release.reset;
    if (reset.startMs === null) reset.startMs = nowMs;
    const settling = (nowMs - reset.startMs - settings.trembleMs) / settings.settleMs;
    reset.frame += 1;
    if (settling >= 1) {
      field.towardsStart(1, 0);
      look.setTremble(0, 0);
      look.update();
      reset = null;
      return;
    }
    if (settling > 0) {
      const eased = settling * settling * (3 - 2 * settling);
      field.towardsStart((eased - reset.done) / (1 - reset.done), settings.blurPasses);
      reset.done = eased;
    }
    // While they tremble, all the grains are drawn anew in every frame.
    look.setTremble(settings.trembleTexels * (1 - Math.max(0, settling)), reset.frame);
    field.changeAll();
    look.update();
  }

  // ---- touch to sand and to sound ----------------------------------------

  // Where a touch is on the field, in millimetres from the egg's middle.
  function onField(touch) {
    return {
      x: (touch.x - view.placement.centreX) / view.placement.pxPerMm,
      y: (touch.y - view.placement.centreY) / view.placement.pxPerMm,
    };
  }

  // A finger pushes sand, wherever it is and wherever it began: a press
  // where it lands, then a groove along its way (src/sand/fingers.js).
  // While the sand is being put back, fingers do not push it.
  const fingers = createSandFingers(release.sand.land, (fromX, fromY, toX, toY) => {
    if (!reset) field.push(fromX, fromY, toX, toY, release.sand.finger);
  });

  // Fingers that tune push no sand, from the moment they begin to tune
  // until they lift.
  function tuningFingersPushNoSand() {
    for (const touch of touches.list()) {
      if (instrument.tunes(touch.id)) fingers.drop(touch.id);
    }
  }

  function onTouch(kind, touch) {
    const spot = onField(touch);
    const nowMs = performance.now();
    if (kind === 'down') {
      // A touch on an icon of the open hidden UI is not for the sand, nor
      // for the instrument.
      const onIcon = ui.down(touch.id, spot, touches.list().length === 1, nowMs);
      instrument.touch(kind, touch, touches.list(), view.placement, !onIcon);
      if (!onIcon) fingers.down(touch.id, spot, nowMs);
      tuningFingersPushNoSand();
    } else if (kind === 'move') {
      ui.move(touch.id, spot);
      instrument.touch(kind, touch, touches.list(), view.placement);
      tuningFingersPushNoSand();
      fingers.move(touch.id, spot, nowMs);
    } else {
      instrument.touch(kind, touch, touches.list(), view.placement);
      tuningFingersPushNoSand();
      fingers.up(touch.id);
      const tapped = ui.up(touch.id, nowMs, touch.cancelled);
      if (tapped === 'broom' && !reset) reset = { startMs: null, frame: 0, done: 0 };
    }
    requestFrame();
  }

  const touches = trackTouches(canvas, onTouch);

  // When the page is hidden, loses focus or is left, every touch is
  // forgotten, so that no finger is taken to be still on the screen, and
  // every sound is stopped, so that no note is left sounding.
  const forget = () => {
    touches.clear();
    instrument.silence();
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

  // ---- debug readings (only with ?debug in the address) ------------------

  function readings() {
    return [
      `view ${view.width} x ${view.height}  ${view.placement.pxPerMm.toFixed(3)} px/mm`,
      `touches ${touches.list().length}`,
      `hidden UI ${ui.isOpen() ? 'open' : 'closed'}${reset ? '  resetting' : ''}`,
      `sand ${field.volume().toFixed(1)} mm3 (start ${startVolume.toFixed(1)})${field.isMoving() ? '  moving' : ''}`,
    ].concat(instrument.readings());
  }

  if (debug) {
    window.eggicDebug = {
      field,
      view,
      ui,
      startVolume,
      touches,
      resetting: () => reset !== null,
      frames: () => frames,
      engine: instrument.engine,
      tuning: instrument.tuning,
      lastReading: instrument.lastReading,
    };
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();
  instrument.start().then(requestFrame);
}
