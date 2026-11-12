// The "sand" look: the field of sand seen straight from above, drawn as
// grains. Every cell of the field is drawn as several small squares
// (texels). Each texel belongs to one grain, which has its own shade, its
// own small dome and its own depth at which it first shows, so that thin
// sand appears as scattered grains with the background between them. Light
// comes from the upper left: slopes facing it are lighter, slopes facing
// away are darker, and ridges throw a short shadow.
//
// createSandPainter works out the colours and needs no browser;
// createSandLook puts them on the screen.
import { hexToRgb } from './colour.js';

// A repeatable source of numbers from 0 to 1, so the grains are the same on
// every visit.
function numbers(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

// A square of grains that repeats across the field: for every texel, which
// grain it belongs to, as that grain's shade, dome height and first depth.
function makeGrains(settings, texelMm) {
  const pitch = Math.max(2, Math.round(settings.grainMm / texelMm)); // texels per grain
  const count = 86; // grains along one side of the square
  const size = pitch * count;
  const next = numbers(settings.seed);
  const centreX = new Float32Array(count * count);
  const centreY = new Float32Array(count * count);
  const grainShade = new Float32Array(count * count);
  const grainDepth = new Float32Array(count * count);
  for (let i = 0; i < count * count; i += 1) {
    centreX[i] = ((i % count) + 0.15 + 0.7 * next()) * pitch;
    centreY[i] = (Math.floor(i / count) + 0.15 + 0.7 * next()) * pitch;
    const kind = next();
    const range = settings.shades;
    if (kind < range.darkShare) grainShade[i] = range.dark;
    else if (kind < range.darkShare + range.brightShare) grainShade[i] = range.bright;
    else grainShade[i] = range.from + (range.to - range.from) * next();
    grainDepth[i] = settings.firstShowsMm.from + (settings.firstShowsMm.to - settings.firstShowsMm.from) * next();
  }
  const shade = new Float32Array(size * size);
  const dome = new Float32Array(size * size);
  const depth = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const gx = Math.floor(x / pitch);
      const gy = Math.floor(y / pitch);
      let best = Infinity;
      let grain = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const cx = (gx + ox + count) % count;
          const cy = (gy + oy + count) % count;
          const i = cy * count + cx;
          // The nearest grain may lie across the square's edge.
          let dx = Math.abs(x + 0.5 - centreX[i]);
          let dy = Math.abs(y + 0.5 - centreY[i]);
          if (dx > size / 2) dx = size - dx;
          if (dy > size / 2) dy = size - dy;
          const d = dx * dx + dy * dy;
          if (d < best) {
            best = d;
            grain = i;
          }
        }
      }
      const t = Math.sqrt(best) / (0.75 * pitch);
      const at = y * size + x;
      shade[at] = grainShade[grain];
      dome[at] = settings.domeMm * Math.max(0, 1 - t * t);
      depth[at] = grainDepth[grain];
    }
  }
  return { size, shade, dome, depth };
}

export function createSandPainter(settings, field) {
  const scale = settings.texelsPerCell;
  const width = field.cols * scale;
  const height = field.rows * scale;
  const texelMm = field.cellMm / scale;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const words = new Uint32Array(pixels.buffer);
  const grains = makeGrains(settings.grains, texelMm);
  const sand = hexToRgb(settings.sand);
  const ground = hexToRgb(settings.background);
  const pack = (r, g, b) => (255 << 24) | (b << 16) | (g << 8) | r; // as the screen's memory holds it
  const groundWord = pack(ground[0], ground[1], ground[2]);

  // The light: where it comes from across the picture, and how steeply.
  const light = settings.light;
  const turn = (light.fromDeg * Math.PI) / 180; // 0 from the right, 90 from above
  const lift = (light.heightDeg * Math.PI) / 180;
  const towardsX = Math.cos(turn);
  const towardsY = -Math.sin(turn);
  const lightX = towardsX * Math.cos(lift);
  const lightY = towardsY * Math.cos(lift);
  const lightZ = Math.sin(lift);
  const rise = Math.tan(lift); // how fast a shadow's edge climbs, per mm

  const cols = field.cols;
  const heights = field.heights;

  // The sand's depth at a texel is blended between the four cells around
  // it. For every texel column and row: the first of its two cells, and
  // how far along it lies from that cell to the next.
  function blendTable(texels, cells) {
    const cell = new Int32Array(texels);
    const part = new Float32Array(texels);
    for (let t = 0; t < texels; t += 1) {
      const at = Math.min(cells - 1, Math.max(0, (t + 0.5) / scale - 0.5));
      cell[t] = Math.min(cells - 2, Math.floor(at));
      part[t] = at - cell[t];
    }
    return { cell, part };
  }
  const across = blendTable(width, cols);
  const down = blendTable(height, field.rows);

  // A ridge's shadow is looked for at a few distances towards the light:
  // for each, how many texels away that is, and how far the shadow's edge
  // has dropped by there.
  const shadows = light.shadowReachMm.map((reachMm) => ({
    dx: Math.round((towardsX * reachMm) / texelMm),
    dy: Math.round((towardsY * reachMm) / texelMm),
    dropMm: reachMm * rise,
  }));
  // How far around a texel its picture depends on the sand.
  const pad = 1 + Math.max(...shadows.map((shadow) => Math.max(Math.abs(shadow.dx), Math.abs(shadow.dy))));

  // Working space for one paint: per texel, the sand's depth, the height
  // of what shows there (grain or bare background), and the grain's shade
  // (below 0 where the background shows); and per column of the working
  // space, its texel column in the field and in the square of grains.
  let depth = new Float32Array(0);
  let surface = new Float32Array(0);
  let shade = new Float32Array(0);
  let columns = new Int32Array(0);
  let grainColumns = new Int32Array(0);
  let tremble = null; // { amount, frame } while the grains tremble

  const size = grains.size;
  const shading = settings.shading;
  const slopePerStep = 1 / (2 * texelMm);
  const shadowSteps = new Int32Array(shadows.length);
  const shadowDrops = Float32Array.from(shadows, (shadow) => shadow.dropMm);
  const perLevel = 1 / lightZ; // makes the light on level sand 1

  // Paint the texels of a box of cells, and far enough around it for the
  // shadows. Returns the rectangle of texels painted.
  function paint(box) {
    const x0 = Math.max(0, box.c0 * scale - pad);
    const y0 = Math.max(0, box.r0 * scale - pad);
    const x1 = Math.min(width, (box.c1 + 1) * scale + pad);
    const y1 = Math.min(height, (box.r1 + 1) * scale + pad);
    // The working space reaches `pad` texels further on every side. Past
    // the field's edge, the edge is repeated.
    const w = x1 - x0 + 2 * pad;
    const h = y1 - y0 + 2 * pad;
    if (depth.length < w * h) {
      depth = new Float32Array(w * h);
      surface = new Float32Array(w * h);
      shade = new Float32Array(w * h);
    }
    if (columns.length < w) {
      columns = new Int32Array(w);
      grainColumns = new Int32Array(w);
    }
    for (let x = 0; x < w; x += 1) {
      columns[x] = Math.min(width - 1, Math.max(0, x0 - pad + x));
      grainColumns[x] = columns[x] % size;
    }
    for (let k = 0; k < shadows.length; k += 1) shadowSteps[k] = shadows[k].dy * w + shadows[k].dx;

    // First the surface.
    const trembling = tremble !== null;
    const jump = trembling ? tremble.amount : 0;
    const seed = trembling ? tremble.frame * 83492791 : 0;
    for (let y = 0; y < h; y += 1) {
      const ty = Math.min(height - 1, Math.max(0, y0 - pad + y));
      const upper = down.cell[ty] * cols;
      const lower = upper + cols;
      const partDown = down.part[ty];
      const grainRow = (ty % size) * size;
      let at = y * w;
      let patch = -1; // while the grains tremble: the patch of 8 x 8 texels,
      let jumpX = 0; // how far its grains have jumped across,
      let jumpedRow = 0; // and the row of the square of grains they come from
      for (let x = 0; x < w; x += 1, at += 1) {
        const tx = columns[x];
        const c = across.cell[tx];
        const part = across.part[tx];
        const top = heights[upper + c] + (heights[upper + c + 1] - heights[upper + c]) * part;
        const bottom = heights[lower + c] + (heights[lower + c + 1] - heights[lower + c]) * part;
        const deep = top + (bottom - top) * partDown;
        depth[at] = deep;
        surface[at] = 0;
        shade[at] = -1;
        if (deep <= 0) continue;
        let g = grainRow + grainColumns[x];
        if (trembling) {
          // Each small patch of grains jumps a texel or two, anew each frame.
          if (tx >> 3 !== patch) {
            patch = tx >> 3;
            let n = Math.imul((patch * 73856093) ^ ((ty >> 3) * 19349663) ^ seed, 0x85ebca6b);
            n ^= n >>> 15;
            jumpX = (size + Math.round((((n & 255) / 255) * 2 - 1) * jump)) % size;
            const jumpY = size + Math.round(((((n >>> 8) & 255) / 255) * 2 - 1) * jump);
            jumpedRow = ((ty + jumpY) % size) * size;
          }
          const column = grainColumns[x] + jumpX;
          g = jumpedRow + (column < size ? column : column - size);
        }
        if (deep > grains.depth[g]) {
          surface[at] = deep + grains.dome[g];
          shade[at] = grains.shade[g];
        }
      }
    }

    // Then the colours. A ridge towards the light keeps some of the light
    // from a texel: none of it at 0, all of it at `shadowSoftMm` and more.
    const soft = light.shadowSoftMm;
    for (let ty = y0; ty < y1; ty += 1) {
      let at = (ty - y0 + pad) * w + pad;
      let word = ty * width + x0;
      for (let tx = x0; tx < x1; tx += 1, at += 1, word += 1) {
        const grainShade = shade[at];
        const own = grainShade < 0 ? 0 : surface[at];
        let shadow = 0;
        for (let k = 0; k < shadowSteps.length; k += 1) {
          const over = depth[at + shadowSteps[k]] - own - shadowDrops[k];
          if (over > shadow) shadow = over;
        }
        shadow = shadow >= soft ? 1 : shadow / soft;
        if (grainShade < 0) {
          const dark = 1 - shading.groundShadow * shadow;
          words[word] = shadow <= 0 ? groundWord : pack(ground[0] * dark, ground[1] * dark, ground[2] * dark);
          continue;
        }
        const slopeX = (surface[at + 1] - surface[at - 1]) * slopePerStep;
        const slopeY = (surface[at + w] - surface[at - w]) * slopePerStep;
        const facing =
          ((-slopeX * lightX - slopeY * lightY + lightZ) * perLevel) /
          Math.sqrt(slopeX * slopeX + slopeY * slopeY + 1);
        let lit = shading.ambient + (1 - shading.ambient) * facing;
        if (lit < shading.darkest) lit = shading.darkest;
        else if (lit > shading.lightest) lit = shading.lightest;
        lit *= grainShade * (1 - shading.sandShadow * shadow);
        words[word] = pack(Math.min(255, sand[0] * lit), Math.min(255, sand[1] * lit), Math.min(255, sand[2] * lit));
      }
    }
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }

  words.fill(groundWord);
  return {
    width,
    height,
    texelMm,
    pixels,
    paint,
    // While the sand trembles, its grains jump about by up to `amount`
    // texels, differently in each `frame`. null stops it.
    setTremble(amount, frame) {
      tremble = amount > 0 ? { amount, frame } : null;
    },
  };
}

export function createSandLook(settings, field) {
  const painter = createSandPainter(settings, field);
  const sheet = document.createElement('canvas');
  sheet.width = painter.width;
  sheet.height = painter.height;
  const ink = sheet.getContext('2d');
  // The whole sheet starts as background, so that it has no see-through
  // parts whose edges could show when it is drawn to the screen.
  ink.fillStyle = settings.background;
  ink.fillRect(0, 0, sheet.width, sheet.height);
  const image = new ImageData(painter.pixels, painter.width, painter.height);

  return {
    setTremble: painter.setTremble,
    // Bring the picture up to date with the sand: repaint what has changed.
    update() {
      for (const box of field.takeChanged()) {
        const done = painter.paint(box);
        ink.putImageData(image, 0, 0, done.x, done.y, done.width, done.height);
      }
    },
    // Draw the background and the sand. The field's middle sits on the
    // middle of the egg's place on the screen.
    draw(g, view) {
      const { placement } = view;
      g.fillStyle = settings.background;
      g.fillRect(0, 0, view.width, view.height);
      const w = field.widthMm * placement.pxPerMm;
      const h = field.heightMm * placement.pxPerMm;
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(sheet, placement.centreX - w / 2, placement.centreY - h / 2, w, h);
    },
  };
}
