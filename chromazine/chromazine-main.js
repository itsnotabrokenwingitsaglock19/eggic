// Starts chromazine: the lit egg with soft cells.
import { startLit } from './lit-app.js';
import { createChromazineLook } from './look/chromazine-look.js';

export function start(release) {
  startLit(release, createChromazineLook);
}
