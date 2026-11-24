// Starts the painted egg: a faint egg that a finger paints. The finger
// loads the colour of the grid cell it lands on, lays paint until its load
// runs out, and plays the notes of the egg as it goes (src/instrument.js).
// How firmly it presses decides how wide its mark is and how much paint it
// lays. Two fingers tune the sound and paint nothing. The hidden UI holds
// the swap, which shows the painting in the next colour set, the broom,
// which wipes it away, and the shop door.
// This release is put together differently from the ones that start in
// main.js, so it has its own starting file.
import { EGG_HEIGHT_MM, halfWidthAt, isInsideEgg } from './surface/egg-outline.js';
import { LIFE_SIZE_CSS_PX_PER_MM, placeEgg } from './surface/screen.js';
import { trackTouches } from './input/touches.js';
import { createInstrument } from './instrument.js';
import { createPaintField, toAbsorbance } from './paint/field.js';
import { createPress, radiusFor } from './paint/press.js';
import { createSandFingers } from './sand/fingers.js';
import { cellHex } from './look/lit-cells.js';
import { createPaintLook, hexToLinear, washColours } from './look/paint-look.js';
import { createHiddenUi, drawHiddenUi } from './ui/hidden-ui.js';
import { debugRequested, drawReadings } from './debug.js';

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
  const sets = release.look.sets;

  // The field's middle is the middle of the egg; y runs down the screen.
  const onEgg = (xMm, yMm) => isInsideEgg(xMm, EGG_HEIGHT_MM / 2 - yMm);
  const field = createPaintField(release.paint, onEgg, sets.length);
  const look = createPaintLook(release.look, field, (yMm) => halfWidthAt(EGG_HEIGHT_MM / 2 - yMm));
  const ui = createHiddenUi(release.hiddenUi, EGG_HEIGHT_MM / 2, (spot) => onEgg(spot.x, spot.y));
  // A touch plays wherever it began, while it is inside the egg's outline,
  // and any two fingers tune.
  const instrument = createInstrument(release, { debug, begins: 'anywhere' });
  const press = createPress(release.paint.press);

  const view = { width: 0, height: 0, placement: null };
  let frameWanted = false;
  let frames = 0; // how many frames have been drawn (a debug reading)
  let lastTouchMs = performance.now(); // when a finger was last on the screen
  let aloneTimer = null;

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
    // placed anew, so that the move itself paints nothing.
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
    if (wipe) stepWipe(nowMs);
    if (count > 0) lastTouchMs = nowMs;
    else leftAlone(nowMs);
    const lookBusy = look.update(nowMs);
    look.draw(g, view);
    drawHiddenUi(g, view.placement, ui, release.hiddenUi, nowMs);
    if (debug) drawReadings(g, readings());
    // Keep drawing while the picture changes by itself, while a finger is
    // down (a long press is told by time alone, and so is the vibrato of a
    // resting thumb) and while the hidden UI is showing.
    if (lookBusy || wipe || uiBusy || count > 0) requestFrame();
  }

  // ---- setting ---------------------------------------------------------------

  // With no finger on the screen the paint is left alone: after a while it
  // begins to look set, and then it sets. Nothing is drawn while it waits;
  // a timer brings the next frame when there is something to show.
  function leftAlone(nowMs) {
    const settings = release.paint;
    const seconds = (nowMs - lastTouchMs) / 1000;
    if (!field.leftAlone(seconds)) return;
    const palesAt = settings.palesFrom * settings.setsAfterS;
    const waitMs = seconds < palesAt ? (palesAt - seconds) * 1000 : 250;
    if (aloneTimer !== null) window.clearTimeout(aloneTimer);
    aloneTimer = window.setTimeout(() => {
      aloneTimer = null;
      requestFrame();
    }, waitMs);
  }

  // ---- the wipe --------------------------------------------------------------

  // The broom's wipe: the paint thins away and is gone. Fingers do not
  // paint meanwhile.
  let wipe = null; // { startMs, lastMs }

  function stepWipe(nowMs) {
    const settings = release.paint.wipe;
    if (wipe.startMs === null) wipe.startMs = wipe.lastMs = nowMs;
    if (nowMs - wipe.startMs >= settings.ms) {
      field.clear();
      wipe = null;
      return;
    }
    field.thin(Math.pow(0.5, (nowMs - wipe.lastMs) / settings.halvesEveryMs));
    wipe.lastMs = nowMs;
  }

  // ---- the colour sets ---------------------------------------------------------

  const scale = () => instrument.tuning.current().scale;

  // The colour of the cell at a point of the field, in a colour set, as
  // [red, green, blue] in linear light; null off the egg.
  function cellColour(set, xMm, yMm) {
    const cell = instrument.surface().cellAt(xMm, EGG_HEIGHT_MM / 2 - yMm);
    return cell ? hexToLinear(cellHex(set, scale(), cell)) : null;
  }
  // The colour a finger loads at a point: one colour per set, as
  // absorbances; null off the egg.
  function loadAt(xMm, yMm) {
    if (!instrument.surface().cellAt(xMm, EGG_HEIGHT_MM / 2 - yMm)) return null;
    const colours = new Float32Array(sets.length * 3);
    sets.forEach((set, index) => {
      cellColour(set, xMm, yMm).forEach((channel, j) => {
        colours[index * 3 + j] = toAbsorbance(channel);
      });
    });
    return colours;
  }

  // The set is kept on the phone, so the egg reopens in the colours it was
  // left in. Anything unusable kept there is ignored.
  const storage = release.look.rememberSet ? phoneStorage() : null;
  const storageKey = `eggic.${release.id}.set`;
  try {
    if (storage) look.setSet(storage.getItem(storageKey));
  } catch (error) {
    // The phone refuses storage: the egg starts in its first set.
  }

  // The swap: the painting is shown in the next set. On a bare egg the new
  // set shows itself faintly for a moment.
  function swapSet(nowMs) {
    const names = sets.map((set) => set.name);
    const index = (names.indexOf(look.set()) + 1) % names.length;
    const wash = field.isBare() ? washColours(release.look, field, (xMm, yMm) => cellColour(sets[index], xMm, yMm)) : null;
    look.swapTo(names[index], nowMs, wash);
    try {
      if (storage) storage.setItem(storageKey, names[index]);
    } catch (error) {
      // The phone refuses storage: the set is not kept.
    }
  }

  // ---- touch to paint and to sound -----------------------------------------------

  // Where a touch is on the field, in millimetres from the egg's middle.
  function onField(touch) {
    return {
      x: (touch.x - view.placement.centreX) / view.placement.pxPerMm,
      y: (touch.y - view.placement.centreY) / view.placement.pxPerMm,
    };
  }

  // What each finger on the screen paints with: its paint, and how firmly
  // it presses (null where the phone does not tell).
  const painting = new Map(); // touch id -> { paint, pressure, atMs }

  // The press is read anew with every move of the finger and smoothed, so
  // that a jumpy reading does not make the mark flicker.
  function feel(touch, nowMs) {
    const state = painting.get(touch.id);
    if (!state) return;
    const reading = press.reading(touch.contactSize);
    if (reading === null || state.pressure === null) state.pressure = reading;
    else {
      const share = 1 - Math.exp(-(nowMs - state.atMs) / release.paint.press.smoothingMs);
      state.pressure += (reading - state.pressure) * share;
    }
    state.atMs = nowMs;
  }

  // A finger paints wherever it is and wherever it began: its mark where
  // it lands, then a stroke along its way (src/sand/fingers.js keeps the
  // fingers: the wait after landing, and which have stopped painting).
  // While the paint is being wiped away, fingers do not paint.
  const fingers = createSandFingers(release.paint.land, (fromX, fromY, toX, toY, id) => {
    const state = painting.get(id);
    if (!state || wipe) return;
    field.stroke(state.paint, fromX, fromY, toX, toY, radiusFor(release.paint.press, state.pressure), state.pressure, loadAt);
  });

  // Fingers that tune paint nothing, from the moment they begin to tune
  // until they lift.
  function tuningFingersPaintNothing() {
    for (const touch of touches.list()) {
      if (instrument.tunes(touch.id)) fingers.drop(touch.id);
    }
  }

  function onTouch(kind, touch) {
    const spot = onField(touch);
    const nowMs = performance.now();
    lastTouchMs = nowMs;
    if (kind === 'down') {
      // A touch on an icon of the open hidden UI is not for the paint, nor
      // for the instrument.
      const onIcon = ui.down(touch.id, spot, touches.list().length === 1, nowMs);
      instrument.touch(kind, touch, touches.list(), view.placement, !onIcon);
      if (!onIcon) {
        painting.set(touch.id, { paint: field.createFinger(), pressure: null, atMs: nowMs });
        feel(touch, nowMs);
        fingers.down(touch.id, spot, nowMs);
      }
      tuningFingersPaintNothing();
    } else if (kind === 'move') {
      ui.move(touch.id, spot);
      instrument.touch(kind, touch, touches.list(), view.placement);
      tuningFingersPaintNothing();
      feel(touch, nowMs);
      fingers.move(touch.id, spot, nowMs);
    } else {
      instrument.touch(kind, touch, touches.list(), view.placement);
      tuningFingersPaintNothing();
      fingers.up(touch.id);
      painting.delete(touch.id);
      const tapped = ui.up(touch.id, nowMs, touch.cancelled);
      if (tapped === 'swap') swapSet(nowMs);
      if (tapped === 'broom' && !wipe && !field.isBare()) wipe = { startMs: null, lastMs: null };
      // The door does nothing until there is a shop address.
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

  // ---- debug readings (only with ?debug in the address) ------------------------

  function readings() {
    const range = press.range();
    const pressures = Array.from(painting.values()).map((state) => (state.pressure === null ? 'none' : state.pressure.toFixed(2)));
    return [
      `view ${view.width} x ${view.height}  ${view.placement.pxPerMm.toFixed(3)} px/mm`,
      `touches ${touches.list().length}`,
      `hidden UI ${ui.isOpen() ? 'open' : 'closed'}${wipe ? '  wiping' : ''}`,
      `paint ${field.amount().toFixed(0)}  covered ${(field.covered() * 100).toFixed(0)}%  ${field.hasWet() ? `wet ${field.wetness().toFixed(2)}` : 'set or bare'}  set ${look.set()}`,
      `press ${pressures.join(' ') || '-'}${range ? `  range ${range.smallest.toFixed(1)} to ${range.largest.toFixed(1)}` : ''}`,
    ].concat(instrument.readings());
  }

  if (debug) {
    window.eggicDebug = {
      field,
      view,
      ui,
      touches,
      set: () => look.set(),
      wiping: () => wipe !== null,
      pressures: () => Array.from(painting.values()).map((state) => state.pressure),
      // For the browser check: as if the egg had been left alone this long.
      leaveAlone: (seconds) => {
        lastTouchMs = performance.now() - seconds * 1000;
        requestFrame();
      },
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
