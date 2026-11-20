// What a cell of the surface plays. Plain arithmetic, no browser parts.
//
// The row of a cell is always a note of the scale. What the columns mean is
// the release's choice, its surface setting `across`:
//   (none)     one column; the row's note alone
//   'octave'   each column to the right plays one register higher
//   'harmony'  the leftmost column plays the row's note alone; each column
//              to the right adds a second note, one scale step higher per
//              column, sounding with it
import { REGISTER_ORDER } from './scales.js';

// How many registers, counted from the tuning's own, the surface can reach.
export function registerSpan(across, columns) {
  if (across === 'octave') return columns;
  if (across === 'harmony') return 2;
  return 1;
}

// The note `steps` scale steps above the lowest note of `register`. The
// last name in `notes` is the octave of the first, so an octave has
// notes.length - 1 steps; a note exactly on an octave is given as the
// octave note of the register below, which is the same pitch.
function noteAbove(notes, register, steps) {
  const perOctave = notes.length - 1;
  const octaves = Math.floor(steps / perOctave);
  const degree = steps % perOctave;
  const first = REGISTER_ORDER.indexOf(register);
  if (degree === 0 && octaves > 0) {
    return { register: REGISTER_ORDER[first + octaves - 1], note: notes[perOctave] };
  }
  return { register: REGISTER_ORDER[first + octaves], note: notes[degree] };
}

// notes: the scale's note names from the base to the point. register: the
// tuning's register. cell: { row, column }. Answers { main, second }: each
// { register, note }; second is null where the cell plays one note.
export function cellNotes(notes, register, cell, across) {
  if (across === 'octave') {
    const played = REGISTER_ORDER[REGISTER_ORDER.indexOf(register) + cell.column];
    return { main: { register: played, note: notes[cell.row] }, second: null };
  }
  const main = { register, note: notes[cell.row] };
  if (across === 'harmony' && cell.column > 0) {
    return { main, second: noteAbove(notes, register, cell.row + cell.column) };
  }
  return { main, second: null };
}
