// Starts the sand egg: makes the field of sand in the shape of the egg,
// draws it, lets every finger on the screen push the sand, and runs the
// hidden UI with the broom that puts the sand back. This release is put
// together differently from the ones that start in main.js, so it has its
// own starting file.
import { EGG_HEIGHT_MM, isInsideEgg } from './surface/egg-outline.js';
import { LIFE_SIZE_CSS_PX_PER_MM, placeEgg } from './surface/screen.js';
import { trackTouches } from './input/touches.js';
import { createSandField } from './sand/field.js';
import { tineShares, tinePoints } from './sand/rake.js';
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
    for (const touch of touches.list()) {
      if (fingers.has(touch.id)) fingers.set(touch.id, onField(touch));
    }
    rake = null;
    if (!reset) updateRake();
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
    // press is told by time alone) and while the hidden UI is showing.
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

  // ---- touch to sand -----------------------------------------------------

  // Where a touch is on the field, in millimetres from the egg's middle.
  function onField(touch) {
    return {
      x: (touch.x - view.placement.centreX) / view.placement.pxPerMm,
      y: (touch.y - view.placement.centreY) / view.placement.pxPerMm,
    };
  }

  // Every finger pushes sand, wherever it is and wherever it began: a press
  // where it lands, then a groove along its way.
  const fingers = new Map(); // touch id -> where that finger last was
  // While two fingers are down, the first two carry the rake between them.
  let rake = null; // { ids: [first, second], shares, points }

  function updateRake() {
    if (rake && !(fingers.has(rake.ids[0]) && fingers.has(rake.ids[1]))) rake = null;
    if (!rake) {
      const ids = touches
        .list()
        .map((touch) => touch.id)
        .filter((id) => fingers.has(id));
      if (ids.length < 2) return;
      const a = fingers.get(ids[0]);
      const b = fingers.get(ids[1]);
      const shares = tineShares(Math.hypot(b.x - a.x, b.y - a.y), release.sand.rake);
      rake = { ids: [ids[0], ids[1]], shares, points: tinePoints(a, b, shares) };
      return;
    }
    const points = tinePoints(fingers.get(rake.ids[0]), fingers.get(rake.ids[1]), rake.shares);
    points.forEach((point, k) => {
      const last = rake.points[k];
      if (last.x !== point.x || last.y !== point.y) {
        field.push(last.x, last.y, point.x, point.y, release.sand.rake.tine);
      }
    });
    rake.points = points;
  }

  function onTouch(kind, touch) {
    const spot = onField(touch);
    const nowMs = performance.now();
    if (kind === 'down') {
      // A touch on an icon of the open hidden UI is not for the sand.
      const onIcon = ui.down(touch.id, spot, touches.list().length === 1, nowMs);
      if (!onIcon) {
        if (!reset) field.push(spot.x, spot.y, spot.x, spot.y, release.sand.finger);
        fingers.set(touch.id, spot);
      }
    } else if (kind === 'move') {
      ui.move(touch.id, spot);
      const last = fingers.get(touch.id);
      if (last) {
        if (!reset) field.push(last.x, last.y, spot.x, spot.y, release.sand.finger);
        fingers.set(touch.id, spot);
      }
    } else {
      fingers.delete(touch.id);
      const tapped = ui.up(touch.id, nowMs, touch.cancelled);
      if (tapped === 'broom' && !reset) reset = { startMs: null, frame: 0, done: 0 };
    }
    if (!reset) updateRake();
    else rake = null;
    requestFrame();
  }

  const touches = trackTouches(canvas, onTouch);

  // When the page is hidden, loses focus or is left, every touch is
  // forgotten, so that no finger is taken to be still on the screen.
  const forget = () => touches.clear();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) forget();
  });
  window.addEventListener('pagehide', forget);
  window.addEventListener('blur', forget);

  // ---- debug readings (only with ?debug in the address) ------------------

  function readings() {
    return [
      `view ${view.width} x ${view.height}  ${view.placement.pxPerMm.toFixed(3)} px/mm`,
      `touches ${touches.list().length}${rake ? `  rake of ${rake.shares.length}` : ''}`,
      `hidden UI ${ui.isOpen() ? 'open' : 'closed'}${reset ? '  resetting' : ''}`,
      `sand ${field.volume().toFixed(1)} mm3 (start ${startVolume.toFixed(1)})${field.isMoving() ? '  moving' : ''}`,
    ];
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
      rakeTines: () => (rake ? rake.shares.length : 0),
    };
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();
}
