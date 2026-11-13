// Starts the lit egg: the gesture-tuned egg's instrument (src/instrument.js)
// under a faint egg whose cells light in colour while they are pressed
// (src/look/lit-look.js), and a hidden UI whose swap icon steps to the next
// colour set. This release is put together differently from the ones that
// start in main.js, so it has its own starting file.
import { EGG_HEIGHT_MM, isInsideEgg } from './surface/egg-outline.js';
import { LIFE_SIZE_CSS_PX_PER_MM, placeEgg } from './surface/screen.js';
import { trackTouches } from './input/touches.js';
import { createInstrument } from './instrument.js';
import { createLitLook } from './look/lit-look.js';
import { createHiddenUi, drawHiddenUi } from './ui/hidden-ui.js';
import { debugRequested, drawDebug } from './debug.js';

// The phone's own storage, or null where there is none or it is refused
// (private browsing).
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

  const look = createLitLook(release.look, release.surface.columns);
  // The hidden UI is found by a long press outside the egg's outline.
  // Its positions are millimetres from the egg's middle, y down the screen.
  const ui = createHiddenUi(release.hiddenUi, EGG_HEIGHT_MM / 2, (spot) =>
    isInsideEgg(spot.x, EGG_HEIGHT_MM / 2 - spot.y),
  );
  const instrument = createInstrument(release, {
    debug,
    // The colours lean with the tuning.
    onTuning(current) {
      look.setTuning(current, performance.now());
      requestFrame();
    },
    // The egg lights what it sings: the cells of the sound that answers a
    // tuning gesture.
    onAnswer(answer) {
      look.sing(answer.cells, scale(), instrument.surface().rows, performance.now(), answer);
      requestFrame();
    },
  });
  const scale = () => instrument.tuning.current().scale;

  const view = { width: 0, height: 0, placement: null };
  let frameWanted = false;

  // ---- the colour set -----------------------------------------------------

  // The set is kept on the phone, so the egg reopens in the colours it was
  // left in. Anything unusable kept there is ignored.
  const storage = release.look.rememberSet ? phoneStorage() : null;
  const storageKey = `eggic.${release.id}.set`;
  try {
    if (storage) look.setSet(storage.getItem(storageKey));
  } catch (error) {
    // The phone refuses storage: the egg starts in its first set.
  }

  // The swap: on to the next set, which shows itself for a moment.
  function swapSet() {
    const names = release.look.sets.map((set) => set.name);
    const next = names[(names.indexOf(look.set()) + 1) % names.length];
    look.setSet(next);
    look.showSet(scale(), instrument.surface().rows, performance.now());
    try {
      if (storage) storage.setItem(storageKey, next);
    } catch (error) {
      // The phone refuses storage: the set lasts for this visit only.
    }
  }

  // ---- the picture ----------------------------------------------------------

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

  // The cell under the playing thumb is the one that is pressed.
  function showThumb() {
    const reading = instrument.lastReading();
    look.press(reading ? reading.cell : null, scale(), instrument.surface().rows);
  }

  function frame() {
    frameWanted = false;
    const nowMs = performance.now();
    instrument.update(touches.list(), view.placement);
    showThumb();
    const count = touches.list().length;
    const uiBusy = ui.tick(nowMs, count);
    const moving = look.step(nowMs);
    look.draw(g, view);
    drawHiddenUi(g, view.placement, ui, release.hiddenUi, nowMs);
    if (debug) drawDebug(g, view, instrument.surface(), debugLines());
    // Keep drawing while a finger is down (a long press is told by time
    // alone, and so is the vibrato of a resting thumb), while cells are
    // fading or colours blending, and while the hidden UI is showing.
    if (moving || uiBusy || count > 0) requestFrame();
  }

  // ---- touch ----------------------------------------------------------------

  // Where a touch is, in millimetres from the egg's middle, y down.
  function fromMiddle(touch) {
    return {
      x: (touch.x - view.placement.centreX) / view.placement.pxPerMm,
      y: (touch.y - view.placement.centreY) / view.placement.pxPerMm,
    };
  }

  function onTouch(kind, touch) {
    const spot = fromMiddle(touch);
    const nowMs = performance.now();
    if (kind === 'down') {
      // A touch on an icon of the open hidden UI is not for the instrument.
      const onIcon = ui.down(touch.id, spot, touches.list().length === 1, nowMs);
      instrument.touch(kind, touch, touches.list(), view.placement, !onIcon);
    } else if (kind === 'move') {
      ui.move(touch.id, spot);
      instrument.touch(kind, touch, touches.list(), view.placement);
    } else {
      instrument.touch(kind, touch, touches.list(), view.placement);
      if (ui.up(touch.id, nowMs, touch.cancelled) === 'swap') swapSet();
    }
    showThumb();
    requestFrame();
  }

  const touches = trackTouches(canvas, onTouch);

  // No stuck notes: when the page is hidden, loses focus or is left, every
  // touch is forgotten and every sound stopped.
  function silence() {
    touches.clear();
    instrument.silence();
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
    document.addEventListener(name, () => instrument.unlock());
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  // ---- debug readings (only with ?debug in the address) -----------------------

  function debugLines() {
    const tint = look.tint();
    return [
      `view ${view.width} x ${view.height}  ${view.placement.pxPerMm.toFixed(3)} px/mm`,
      `touches ${touches.list().length}`,
      `hidden UI ${ui.isOpen() ? 'open' : 'closed'}`,
      `set ${look.set()}  lit ${look.lit().length}  cast ${tint.cast.toFixed(2)}  deep ${tint.deep.toFixed(2)}`,
    ].concat(instrument.readings());
  }

  if (debug) {
    window.eggicDebug = {
      engine: instrument.engine,
      touches,
      tuning: instrument.tuning,
      view,
      ui,
      look,
      lastReading: instrument.lastReading,
    };
  }

  // ---- go -------------------------------------------------------------------

  look.setTuning(instrument.tuning.current(), performance.now());
  resize();
  instrument.start().then(requestFrame);
}
