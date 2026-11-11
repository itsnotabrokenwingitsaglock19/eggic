// The "fixed" tuning method: the release plays one voice, scale and register
// and the player cannot change them.
//
// Every tuning method offers the same five things:
//   current()          the tuning now: { voice, scale, register }
//   options()          everything it can reach: { voices, scales, registers }
//   touches(list)      is told the touches on the screen; answers
//                      { active, pair }: whether a tuning gesture is under
//                      way, and the ids of the touches making it
//   onChange(listener) calls listener(kind, tuning) after a change, where
//                      kind is 'voice', 'scale' or 'register'
//   status()           a short text for the debug view

export function createFixedTuning(settings) {
  const tuning = {
    voice: settings.voice,
    scale: settings.scale,
    register: settings.register,
  };
  return {
    current() {
      return tuning;
    },
    options() {
      return { voices: [tuning.voice], scales: [tuning.scale], registers: [tuning.register] };
    },
    touches() {
      return { active: false, pair: [] };
    },
    onChange() {},
    status() {
      return 'fixed';
    },
  };
}
