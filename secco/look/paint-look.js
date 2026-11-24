// The "paint" look: the paint of src/paint/field.js seen from straight
// above, on an egg that has a surface of its own, a fine fixed grain like
// eggshell. The paint is matt. Where it lies thin it is chalky: it sits
// only on the grain's high points, breaks into speckle and is a little
// paler. Where it lies thick it covers the grain and has some body, lit
// from the upper left. Set paint is paler than wet paint. The paint is cut
// off exactly at the egg's outline.
//
// createPaintPainter works out the colours and needs no browser;
// createPaintLook puts them on the screen.
import { smooth, toReflectance, valueNoise } from '../paint/field.js';
import { hexToRgb } from './colour.js';

const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
// A colour written #RRGGBB as [red, green, blue] in linear light, 0 to 1.
export const hexToLinear = (hex) => hexToRgb(hex).map((channel) => toLinear(channel / 255));
const ENCODE = new Uint8Array(4097);
for (let i = 0; i <= 4096; i += 1) {
  const v = i / 4096;
  ENCODE[i] = Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
}
const encode = (v) => ENCODE[v <= 0 ? 0 : v >= 1 ? 4096 : (v * 4096) | 0];

// halfWidthAt(yMm): half the egg's width at a height of the field, 0 above
// and below the egg.
export function createPaintPainter(look, field, halfWidthAt) {
  const scale = look.texelsPerCell;
  const width = field.cols * scale;
  const height = field.rows * scale;
  const texelMm = field.cellMm / scale;
  const { cols, rows } = field;
  const count = cols * rows;
  const K = field.setCount * 3;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const egg = hexToLinear(look.egg);
  const ground = hexToLinear(look.background);
  const groundBytes = ground.map(encode);

  // How much of each texel lies inside the egg's outline; the shell's
  // grain, the same at every visit (0 in its pits, 1 on its high points);
  // and a slower unevenness, for how densely the paint lies.
  const mask = new Float32Array(width * height);
  const grain = new Float32Array(width * height);
  const cloud = new Float32Array(width * height);
  const tooth = look.tooth;
  for (let y = 0; y < height; y += 1) {
    const halves = [];
    for (let s = 0; s < 4; s += 1) halves.push(halfWidthAt(field.topMm + (y + (s + 0.5) / 4) * texelMm));
    for (let x = 0; x < width; x += 1) {
      const left = field.leftMm + x * texelMm;
      let share = 0;
      for (const half of halves) {
        share += Math.max(0, Math.min(left + texelMm, half) - Math.max(left, -half)) / texelMm;
      }
      const at = y * width + x;
      mask[at] = share / 4;
      if (share <= 0) continue;
      const xMm = (x + 0.5) * texelMm;
      const yMm = (y + 0.5) * texelMm;
      const n =
        0.55 * valueNoise(xMm / tooth.fineMm, yMm / tooth.fineMm, 101) +
        0.3 * valueNoise(xMm / tooth.midMm, yMm / tooth.midMm, 202) +
        0.15 * valueNoise(xMm / tooth.coarseMm, yMm / tooth.coarseMm, 303);
      grain[at] = Math.min(1, Math.max(0, 0.5 + (n - 0.5) * 2.1));
      cloud[at] = valueNoise(xMm / 1.6, yMm / 1.6, 404) * 0.6 + valueNoise(xMm / 4.5, yMm / 4.5, 505) * 0.4;
    }
  }

  // Blending between the four cells around a texel.
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
  const acrossT = blendTable(width, cols);
  const downT = blendTable(height, rows);

  // The light, for the body of thick paint.
  const turn = (look.light.fromDeg * Math.PI) / 180;
  const lift = (look.light.heightDeg * Math.PI) / 180;
  const lx = Math.cos(turn) * Math.cos(lift);
  const ly = -Math.sin(turn) * Math.cos(lift);
  const lz = Math.sin(lift);
  const slopeScale = look.relief / (2 * texelMm);

  const tall = new Float32Array(count); // per cell: how thick, wet and set together
  const colour = new Float32Array(count * 3); // and its colour, in linear light
  const wetShare = new Float32Array(count); // and how much of what shows is wet
  let soft = new Float32Array(count); // the heights, softened
  let scratch = new Float32Array(count);
  const surface = new Float32Array(width * height); // per texel: the softened height
  const passes = look.softenPasses;
  const split = look.split;

  // Paint the texels of a box of cells ({ c0, r0, c1, r1 }), and as far
  // around it as the softening reaches. setA, setB: which colour sets;
  // blend: 0 shows A, 1 shows B. wash: null, or { colours, strength }, a
  // colour per cell (linear light) laid faintly over the bare egg. Returns
  // the rectangle of texels painted.
  function paint(box, setA, setB = setA, blend = 0, wash = null) {
    const { wet, set, wetK, setK } = field;
    const wetness = field.wetness();
    // The cells whose texels are painted, the cells whose softened height
    // those need, and the cells whose own height that needs.
    const grow = (by, low, high, limit) => [Math.max(0, low - by), Math.min(limit - 1, high + by)];
    const [pc0, pc1] = grow(passes + 1, box.c0, box.c1, cols);
    const [pr0, pr1] = grow(passes + 1, box.r0, box.r1, rows);
    const [nc0, nc1] = grow(2 * passes + 2, box.c0, box.c1, cols);
    const [nr0, nr1] = grow(2 * passes + 2, box.r0, box.r1, rows);

    for (let r = nr0; r <= nr1; r += 1) {
      for (let c = nc0; c <= nc1; c += 1) {
        const i = r * cols + c;
        const hw = wet[i];
        const hs = set[i];
        tall[i] = hw + hs;
        soft[i] = tall[i];
        if (tall[i] <= 0) {
          wetShare[i] = 0;
          continue;
        }
        const cover = hw > 0 ? (hs > 0 ? smooth(0.003, look.coverMm, hw) : 1) : 0;
        const k = i * K;
        for (let j = 0; j < 3; j += 1) {
          const underA = hs > 0 ? toReflectance(setK[k + setA * 3 + j]) : 0;
          let v = underA + ((hw > 0 ? toReflectance(wetK[k + setA * 3 + j]) : underA) - underA) * cover;
          if (blend > 0) {
            const underB = hs > 0 ? toReflectance(setK[k + setB * 3 + j]) : 0;
            v += (underB + ((hw > 0 ? toReflectance(wetK[k + setB * 3 + j]) : underB) - underB) * cover - v) * blend;
          }
          colour[i * 3 + j] = v;
        }
        wetShare[i] = cover * wetness;
      }
    }
    // The heights are softened, so that the lines a brush would leave go
    // and only the broad lie of the paint is left. Each pass is worked out
    // one cell further in, from heights that are right.
    for (let pass = 1; pass <= passes; pass += 1) {
      const c0 = Math.max(1, nc0 + pass);
      const c1 = Math.min(cols - 2, nc1 - pass);
      const r0 = Math.max(1, nr0 + pass);
      const r1 = Math.min(rows - 2, nr1 - pass);
      scratch.set(soft.subarray(nr0 * cols, (nr1 + 1) * cols), nr0 * cols);
      for (let r = r0; r <= r1; r += 1) {
        for (let c = c0; c <= c1; c += 1) {
          const i = r * cols + c;
          scratch[i] =
            (soft[i] * 4 +
              (soft[i - 1] + soft[i + 1] + soft[i - cols] + soft[i + cols]) * 2 +
              soft[i - cols - 1] + soft[i - cols + 1] + soft[i + cols - 1] + soft[i + cols + 1]) / 16;
        }
      }
      [soft, scratch] = [scratch, soft];
    }

    const x0 = pc0 * scale;
    const y0 = pr0 * scale;
    const x1 = (pc1 + 1) * scale;
    const y1 = (pr1 + 1) * scale;
    // One texel further on every side, for the slopes.
    const sx0 = Math.max(0, x0 - 1);
    const sy0 = Math.max(0, y0 - 1);
    const sx1 = Math.min(width, x1 + 1);
    const sy1 = Math.min(height, y1 + 1);
    for (let y = sy0; y < sy1; y += 1) {
      const upper = downT.cell[y] * cols;
      const lower = upper + cols;
      const pd = downT.part[y];
      for (let x = sx0; x < sx1; x += 1) {
        const c = acrossT.cell[x];
        const p = acrossT.part[x];
        const top = soft[upper + c] + (soft[upper + c + 1] - soft[upper + c]) * p;
        const bottom = soft[lower + c] + (soft[lower + c + 1] - soft[lower + c]) * p;
        surface[y * width + x] = top + (bottom - top) * pd;
      }
    }

    for (let y = y0; y < y1; y += 1) {
      const upper = downT.cell[y] * cols;
      const lower = upper + cols;
      const pd = downT.part[y];
      for (let x = x0; x < x1; x += 1) {
        const at = y * width + x;
        const out = at * 4;
        const m = mask[at];
        if (m <= 0) {
          pixels[out] = groundBytes[0];
          pixels[out + 1] = groundBytes[1];
          pixels[out + 2] = groundBytes[2];
          pixels[out + 3] = 255;
          continue;
        }
        let r = egg[0];
        let g = egg[1];
        let b = egg[2];
        const H = surface[at];
        if (wash || H > 0.0005) {
          const c = acrossT.cell[x];
          const p = acrossT.part[x];
          const i00 = upper + c;
          const i10 = i00 + 1;
          const i01 = lower + c;
          const i11 = i01 + 1;
          const w00 = (1 - p) * (1 - pd);
          const w10 = p * (1 - pd);
          const w01 = (1 - p) * pd;
          const w11 = p * pd;
          if (wash) {
            const wc = wash.colours;
            r += (wc[i00 * 3] * w00 + wc[i10 * 3] * w10 + wc[i01 * 3] * w01 + wc[i11 * 3] * w11 - r) * wash.strength;
            g += (wc[i00 * 3 + 1] * w00 + wc[i10 * 3 + 1] * w10 + wc[i01 * 3 + 1] * w01 + wc[i11 * 3 + 1] * w11 - g) * wash.strength;
            b += (wc[i00 * 3 + 2] * w00 + wc[i10 * 3 + 2] * w10 + wc[i01 * 3 + 2] * w01 + wc[i11 * 3 + 2] * w11 - b) * wash.strength;
          }
          const a00 = tall[i00] > 0 ? w00 : 0;
          const a10 = tall[i10] > 0 ? w10 : 0;
          const a01 = tall[i01] > 0 ? w01 : 0;
          const a11 = tall[i11] > 0 ? w11 : 0;
          const sum = a00 + a10 + a01 + a11;
          if (H > 0.0005 && sum > 0) {
            let pr = (colour[i00 * 3] * a00 + colour[i10 * 3] * a10 + colour[i01 * 3] * a01 + colour[i11 * 3] * a11) / sum;
            let pg = (colour[i00 * 3 + 1] * a00 + colour[i10 * 3 + 1] * a10 + colour[i01 * 3 + 1] * a01 + colour[i11 * 3 + 1] * a11) / sum;
            let pb = (colour[i00 * 3 + 2] * a00 + colour[i10 * 3 + 2] * a10 + colour[i01 * 3 + 2] * a01 + colour[i11 * 3 + 2] * a11) / sum;
            const wetHere = (wetShare[i00] * a00 + wetShare[i10] * a10 + wetShare[i01] * a01 + wetShare[i11] * a11) / sum;
            const t = grain[at];
            // Thin paint lies only on the shell's high points; paint as
            // thick as the grain is deep covers it all.
            const need = (1 - t) * tooth.depthMm * (1 + look.dense * (cloud[at] - 0.5));
            const alpha = smooth(need - tooth.softMm, need + tooth.softMm, H) * smooth(0.002, 0.012, H);
            // How far this is thick paint with body, and not thin paint
            // on the grain.
            const thick = smooth(split.fromMm, split.toMm, H);
            // Chalkiness: paler once set, and where thin.
            const pale = look.pale.set + (look.pale.wet - look.pale.set) * wetHere + split.thinPale * (1 - thick);
            pr += (1 - pr) * pale;
            pg += (1 - pg) * pale;
            pb += (1 - pb) * pale;
            // The grain and the unevenness show faintly in the tone, and
            // so does how thickly the paint lies: thinner is lighter.
            const grainTone = split.thinGrainTone + (look.grainTone - split.thinGrainTone) * thick;
            let tone =
              1 + grainTone * (t - 0.5) * 2 + look.cloudTone * (cloud[at] - 0.5) * 2 -
              look.densityTone * Math.min(1, Math.max(-1, (H - 0.1) / 0.08));
            const xl = x > 0 ? surface[at - 1] : H;
            const xr = x < width - 1 ? surface[at + 1] : H;
            const yu = y > 0 ? surface[at - width] : H;
            const yd = y < height - 1 ? surface[at + width] : H;
            const nx = -(xr - xl) * slopeScale;
            const ny = -(yd - yu) * slopeScale;
            const facing = Math.max(0, nx * lx + ny * ly + lz) / Math.sqrt(nx * nx + ny * ny + 1) / lz;
            const shade = Math.min(look.lightest, Math.max(look.darkest, look.ambient + (1 - look.ambient) * facing));
            tone *= 1 + (shade - 1) * thick;
            r += (pr * tone - r) * alpha;
            g += (pg * tone - g) * alpha;
            b += (pb * tone - b) * alpha;
          }
        }
        pixels[out] = encode(ground[0] + (r - ground[0]) * m);
        pixels[out + 1] = encode(ground[1] + (g - ground[1]) * m);
        pixels[out + 2] = encode(ground[2] + (b - ground[2]) * m);
        pixels[out + 3] = 255;
      }
    }
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }

  const all = { c0: 0, r0: 0, c1: cols - 1, r1: rows - 1 };
  return { width, height, texelMm, pixels, paint, paintAll: (setA, setB, blend, wash) => paint(all, setA, setB, blend, wash) };
}

// A colour per cell of the field for a wash: `cellColour(xMm, yMm)` gives
// the colour there as [red, green, blue] in linear light, or null off the
// egg; the colours are blurred into each other, so that no cell's edge shows.
export function washColours(look, field, cellColour) {
  const { cols, rows } = field;
  const egg = hexToLinear(look.egg);
  let a = new Float32Array(cols * rows * 3);
  let b = new Float32Array(a.length);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      a.set(cellColour(field.leftMm + (c + 0.5) * field.cellMm, field.topMm + (r + 0.5) * field.cellMm) || egg, (r * cols + c) * 3);
    }
  }
  const reach = Math.round(look.wash.blurMm / field.cellMm);
  for (let pass = 0; pass < 2; pass += 1) {
    for (const [dc, dr] of [[1, 0], [0, 1]]) {
      // A running sum along each line, so the blur costs the same however far it reaches.
      const lines = dc ? rows : cols;
      const length = dc ? cols : rows;
      const step = dc ? 3 : cols * 3;
      for (let line = 0; line < lines; line += 1) {
        const first = (dc ? line * cols : line) * 3;
        for (let j = 0; j < 3; j += 1) {
          let sum = 0;
          let n = 0;
          for (let k = 0; k <= Math.min(reach, length - 1); k += 1) {
            sum += a[first + k * step + j];
            n += 1;
          }
          for (let k = 0; k < length; k += 1) {
            b[first + k * step + j] = sum / n;
            const leaves = k - reach;
            const enters = k + reach + 1;
            if (leaves >= 0) {
              sum -= a[first + leaves * step + j];
              n -= 1;
            }
            if (enters < length) {
              sum += a[first + enters * step + j];
              n += 1;
            }
          }
        }
      }
      [a, b] = [b, a];
    }
  }
  return a;
}

export function createPaintLook(look, field, halfWidthAt) {
  const painter = createPaintPainter(look, field, halfWidthAt);
  const sheet = document.createElement('canvas');
  sheet.width = painter.width;
  sheet.height = painter.height;
  const ink = sheet.getContext('2d');
  const image = new ImageData(painter.pixels, painter.width, painter.height);
  const names = look.sets.map((set) => set.name);

  let set = 0; // the colour set shown
  let swap = null; // { from, atMs } while the picture blends over to a new set
  let wash = null; // { colours, atMs } while a newly chosen set shows on the bare egg
  let drawn = false;

  const put = (done) => ink.putImageData(image, 0, 0, done.x, done.y, done.width, done.height);

  return {
    set: () => names[set],
    // Choose a colour set by name; one that does not exist is ignored. The
    // picture changes at once.
    setSet(name) {
      const index = names.indexOf(name);
      if (index < 0 || index === set) return;
      set = index;
      swap = null;
      field.changeAll();
    },
    // Step to a colour set: the painting blends over to it. On a bare egg
    // nothing would show, so `colours` (see washColours) shows the new set
    // faintly for a moment.
    swapTo(name, nowMs, colours) {
      const index = names.indexOf(name);
      if (index < 0 || index === set) return;
      if (field.isBare()) wash = { colours, atMs: nowMs };
      else swap = { from: set, atMs: nowMs };
      set = index;
    },
    // Bring the picture up to date. Returns true while it is still changing
    // by itself, so the caller knows to keep drawing.
    update(nowMs) {
      let from = set;
      let blend = 0;
      if (swap) {
        const t = (nowMs - swap.atMs) / look.swapMs;
        if (t >= 1) swap = null;
        else {
          from = swap.from;
          blend = t <= 0 ? 0 : t * t * (3 - 2 * t);
        }
        field.changeAll();
      }
      let washNow = null;
      if (wash) {
        const t = nowMs - wash.atMs;
        const w = look.wash;
        if (t >= w.riseMs + w.holdMs + w.fallMs) wash = null;
        else {
          const strength = w.strength * Math.min(1, Math.max(0, t / w.riseMs)) * (t < w.riseMs + w.holdMs ? 1 : 1 - (t - w.riseMs - w.holdMs) / w.fallMs);
          washNow = { colours: wash.colours, strength };
        }
        field.changeAll();
      }
      if (!drawn) field.changeAll();
      const box = field.takeChanged();
      if (box) put(painter.paint(box, from, set, blend, washNow));
      drawn = true;
      return swap !== null || wash !== null;
    },
    // Draw the background and the egg. The field's middle sits on the
    // middle of the egg's place on the screen.
    draw(g, view) {
      const { placement } = view;
      g.fillStyle = look.background;
      g.fillRect(0, 0, view.width, view.height);
      const w = field.widthMm * placement.pxPerMm;
      const h = field.heightMm * placement.pxPerMm;
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(sheet, placement.centreX - w / 2, placement.centreY - h / 2, w, h);
    },
  };
}
