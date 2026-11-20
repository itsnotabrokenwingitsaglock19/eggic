// Starts chromazene: the lit egg as one field of colour.
import { startLit } from './lit-app.js';
import { createChromazeneLook } from './look/chromazene-look.js';

export function start(release) {
  startLit(release, createChromazeneLook);
}
