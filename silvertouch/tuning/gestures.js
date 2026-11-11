// The "gestures" tuning method: one finger plays, two fingers tune.
// With two fingers on the egg:
//   slide both up or down      register, one octave up or down
//   slide both left or right   voice, the next or the previous one
//   pinch or spread            scale: pinch for pentatonic, spread for major
// One gesture makes one change; the fingers lift before the next. At the
// highest or lowest register, or pinching into the scale already playing,
// nothing happens. The tuning is kept on the phone between visits.
//
// It offers the same five things as every tuning method (see fixed.js).
import { REGISTER_ORDER } from '../engine/scales.js';

export const GESTURE_DEFAULTS = {
  // How far the two fingers must travel together, or how much the distance
  // between them must change, before the gesture counts. Stand-ins.
  slideMm: 6,
  pinchMm: 7,
};

// What two fingers have done since they landed. `start` and `now` are each
// a pair of points { xMm, heightMm }. Answers null while the fingers have
// not moved far enough, or what the movement means.
export function readGesture(start, now, settings) {
  const middle = (pair) => ({
    x: (pair[0].xMm + pair[1].xMm) / 2,
    height: (pair[0].heightMm + pair[1].heightMm) / 2,
  });
  const apart = (pair) =>
    Math.hypot(pair[0].xMm - pair[1].xMm, pair[0].heightMm - pair[1].heightMm);

  const across = middle(now).x - middle(start).x;
  const up = middle(now).height - middle(start).height;
  const spread = apart(now) - apart(start);

  const slide = Math.hypot(across, up) / settings.slideMm;
  const pinch = Math.abs(spread) / settings.pinchMm;
  if (slide < 1 && pinch < 1) return null;

  if (pinch >= slide) return { kind: 'scale', scale: spread > 0 ? 'major' : 'pentatonic' };
  if (Math.abs(up) >= Math.abs(across)) return { kind: 'register', step: up > 0 ? 1 : -1 };
  return { kind: 'voice', step: across > 0 ? 1 : -1 };
}

// The tuning after a gesture, or null if the gesture changes nothing.
export function applyGesture(tuning, gesture, options) {
  if (gesture.kind === 'scale') {
    if (gesture.scale === tuning.scale || options.scales.indexOf(gesture.scale) < 0) return null;
    return Object.assign({}, tuning, { scale: gesture.scale });
  }
  if (gesture.kind === 'register') {
    const index = options.registers.indexOf(tuning.register) + gesture.step;
    if (index < 0 || index >= options.registers.length) return null;
    return Object.assign({}, tuning, { register: options.registers[index] });
  }
  const count = options.voices.length;
  if (count < 2) return null;
  const index = (options.voices.indexOf(tuning.voice) + gesture.step + count) % count;
  return Object.assign({}, tuning, { voice: options.voices[index] });
}

function isOffered(tuning, options) {
  return (
    !!tuning &&
    options.voices.indexOf(tuning.voice) >= 0 &&
    options.scales.indexOf(tuning.scale) >= 0 &&
    options.registers.indexOf(tuning.register) >= 0
  );
}

// settings: the release's `tuning` settings. voices: the release's voices.
// storage: where the tuning is kept (the browser's localStorage, or null).
export function createGestureTuning(settings, { voices, storage, storageKey }) {
  const options = {
    voices,
    scales: settings.scales,
    registers: REGISTER_ORDER,
  };
  const limits = {
    slideMm: settings.slideMm === undefined ? GESTURE_DEFAULTS.slideMm : settings.slideMm,
    pinchMm: settings.pinchMm === undefined ? GESTURE_DEFAULTS.pinchMm : settings.pinchMm,
  };
  const listeners = [];

  function remembered() {
    if (!storage || !settings.remember) return null;
    try {
      const kept = JSON.parse(storage.getItem(storageKey));
      return isOffered(kept, options)
        ? { voice: kept.voice, scale: kept.scale, register: kept.register }
        : null;
    } catch (error) {
      return null; // nothing kept, or the phone refuses storage
    }
  }

  function remember(tuning) {
    if (!storage || !settings.remember) return;
    try {
      storage.setItem(storageKey, JSON.stringify(tuning));
    } catch (error) {
      // The phone refuses storage: the tuning lasts for this visit only.
    }
  }

  let tuning = remembered() || Object.assign({}, settings.start);
  if (!isOffered(tuning, options)) throw new Error('the starting tuning is not among the options');

  // The gesture under way: the two touches making it, where they landed,
  // and whether it has already made its one change.
  let gesture = null;

  function touches(list) {
    const onEgg = list.filter((touch) => touch.beganOnEgg);
    const byId = (id) => onEgg.find((touch) => touch.id === id);

    if (gesture && !(byId(gesture.ids[0]) && byId(gesture.ids[1]))) gesture = null;
    if (!gesture && onEgg.length >= 2) {
      const pair = [onEgg[0], onEgg[1]];
      gesture = {
        ids: pair.map((touch) => touch.id),
        start: pair.map((touch) => ({ xMm: touch.xMm, heightMm: touch.heightMm })),
        done: false,
      };
    }
    if (!gesture) return { active: false, pair: [] };

    if (!gesture.done) {
      const read = readGesture(gesture.start, gesture.ids.map(byId), limits);
      if (read) {
        gesture.done = true;
        const next = applyGesture(tuning, read, options);
        if (next) {
          tuning = next;
          remember(tuning);
          for (const listener of listeners) listener(read.kind, tuning);
        }
      }
    }
    return { active: true, pair: gesture.ids.slice() };
  }

  return {
    current() {
      return tuning;
    },
    options() {
      return options;
    },
    touches,
    onChange(listener) {
      listeners.push(listener);
    },
    status() {
      if (!gesture) return 'gestures';
      return gesture.done ? 'gesture done' : 'gesture under way';
    },
  };
}
