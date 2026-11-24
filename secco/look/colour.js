// The egg's colour for a tuning. Plain arithmetic, no browser parts.
//
// Voice sets the colour family (a light tone and a dark tone, the two ends
// of the sweep). Scale sets how strong the sweep's contrast is. Register
// sets how light the whole egg is.

export function hexToRgb(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`colour must be written #RRGGBB: ${hex}`);
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// A colour between a and b: a at 0, b at 1.
export function mix(a, b, amount) {
  return a.map((channel, index) => channel + (b[index] - channel) * amount);
}

export function rgbText(colour) {
  const part = (channel) => Math.round(Math.min(255, Math.max(0, channel)));
  return `rgb(${part(colour[0])}, ${part(colour[1])}, ${part(colour[2])})`;
}

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

// colours: the release's `look.colours` settings. Answers the two ends of
// the sweep, { light, dark }, each as [red, green, blue].
export function tuningColours(colours, tuning) {
  const family = colours.families[tuning.voice];
  if (!family) throw new Error(`no colour family for voice: ${tuning.voice}`);
  let light = hexToRgb(family.light);
  let dark = hexToRgb(family.dark);

  // Scale: stretch or shrink the two tones about their middle.
  const contrast = colours.contrast[tuning.scale];
  const middle = mix(light, dark, 0.5);
  light = mix(middle, light, contrast);
  dark = mix(middle, dark, contrast);

  // Register: lighten or darken both tones.
  const shift = colours.registerShift[tuning.register];
  const toward = shift > 0 ? WHITE : BLACK;
  light = mix(light, toward, Math.abs(shift));
  dark = mix(dark, toward, Math.abs(shift));

  const clamp = (colour) => colour.map((channel) => Math.min(255, Math.max(0, channel)));
  return { light: clamp(light), dark: clamp(dark) };
}
