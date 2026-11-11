// The "fixed" tuning method: the release plays one voice, scale and register
// and the player cannot change them.
//
// Every tuning method answers current() with { voice, scale, register }.
// A method that lets the player tune (gestures, squares) changes what it
// answers; this one never does.

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
  };
}
