// Scales, registers and the names of the note files.

// The notes of each scale from the base of the egg to its point. The last
// note is the octave of the first ("c2").
export const SCALES = {
  pentatonic: ['c', 'd', 'e', 'g', 'a', 'c2'],
  major: ['c', 'd', 'e', 'f', 'g', 'a', 'b', 'c2'],
};

// Register positions by their names, and the word the note files
// use for each.
export const REGISTERS = {
  'down one': 'low',
  normal: 'mid',
  'up one': 'high',
};

// The registers from lowest to highest.
export const REGISTER_ORDER = ['down one', 'normal', 'up one'];

export function scaleNotes(scale) {
  const notes = SCALES[scale];
  if (!notes) throw new Error(`unknown scale: ${scale}`);
  return notes;
}

// The address of one note file, relative to the page. Example:
// notes/choir2/choir2_mid_c.wav
export function noteFile(basePath, voice, register, note) {
  const word = REGISTERS[register];
  if (!word) throw new Error(`unknown register: ${register}`);
  return `${basePath}/${voice}/${voice}_${word}_${note}.wav`;
}
