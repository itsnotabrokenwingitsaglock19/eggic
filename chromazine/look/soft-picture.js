// Soft pictures of the egg's cells: colour whose edges fade, worked out at
// a coarse size (a few pixels per millimetre) and later stretched smooth
// over the egg. Plain arithmetic, no browser parts.
//
// A picture is a grid of pixels over a box that just holds the egg: the
// box is centred on the egg's axis and stands on its base. Pixels are kept
// as a browser keeps them: four numbers each (red, green, blue and how
// solid, 0 to 255), row after row from the top.
import { EGG_HEIGHT_MM, EGG_WIDTH_MM } from '../surface/egg-outline.js';

// The size of a picture with `pxPerMm` pixels to the millimetre.
export function softSize(pxPerMm) {
  const width = Math.ceil(EGG_WIDTH_MM * pxPerMm);
  const height = Math.ceil(EGG_HEIGHT_MM * pxPerMm);
  return { pxPerMm, width, height, widthMm: width / pxPerMm, heightMm: height / pxPerMm };
}

// Where the middle of a pixel lies, in millimetres on the egg: x from the
// axis, height from the base.
export const pixelXMm = (size, column) => (column + 0.5) / size.pxPerMm - size.widthMm / 2;
export const pixelHeightMm = (size, row) => size.heightMm - (row + 0.5) / size.pxPerMm;

// The error function, to within 0.0000002 (Abramowitz and Stegun 7.1.26).
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * z);
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  return sign * (1 - poly * Math.exp(-z * z));
}

// How much of a soft-edged stretch from `low` to `high` lies at `at`: 1
// well inside, 0 well outside, and a smooth slope across each end, as wide
// as `featherMm` asks (the stretch blurred by a bell curve of that width).
// An end at infinity has no slope: the stretch goes on.
export function softStretch(at, low, high, featherMm) {
  const scale = featherMm * Math.SQRT2;
  const rise = low === -Infinity ? 1 : 0.5 * (1 + erf((at - low) / scale));
  const fall = high === Infinity ? 1 : 0.5 * (1 + erf((high - at) / scale));
  return rise + fall - 1;
}

// How strongly each column of cells, and each row, counts at every pixel
// across and down a picture. The outermost cells go on past the picture's
// edge, so the colour does not thin out towards the egg's rim. Everywhere,
// the columns add up to 1 and so do the rows.
function shares(size, rows, columns, featherMm) {
  const across = [];
  for (let column = 0; column < columns; column += 1) {
    const low = column === 0 ? -Infinity : -EGG_WIDTH_MM / 2 + (column * EGG_WIDTH_MM) / columns;
    const high = column === columns - 1 ? Infinity : -EGG_WIDTH_MM / 2 + ((column + 1) * EGG_WIDTH_MM) / columns;
    const share = new Float32Array(size.width);
    for (let x = 0; x < size.width; x += 1) share[x] = softStretch(pixelXMm(size, x), low, high, featherMm);
    across.push(share);
  }
  const down = [];
  for (let row = 0; row < rows; row += 1) {
    const low = row === 0 ? -Infinity : (row * EGG_HEIGHT_MM) / rows;
    const high = row === rows - 1 ? Infinity : ((row + 1) * EGG_HEIGHT_MM) / rows;
    const share = new Float32Array(size.height);
    for (let y = 0; y < size.height; y += 1) share[y] = softStretch(pixelHeightMm(size, y), low, high, featherMm);
    down.push(share);
  }
  return { across, down };
}

// Paints lit cells with soft edges. Made once for a picture size and a
// number of columns; it remembers the shares it has worked out.
export function createSoftPainter(size, columns) {
  const known = new Map();
  const sums = new Float32Array(size.width * size.height * 4); // red, green, blue, light
  const sharesFor = (rows, featherMm) => {
    const key = `${rows} ${featherMm}`;
    if (!known.has(key)) known.set(key, shares(size, rows, columns, featherMm));
    return known.get(key);
  };
  // Beyond this share a cell adds nothing that could be seen.
  const FAINT = 0.002;
  // The first and last pixel at which a share is more than faint.
  const reach = (share) => {
    let first = 0;
    let last = share.length - 1;
    while (first < last && share[first] < FAINT) first += 1;
    while (last > first && share[last] < FAINT) last -= 1;
    return [first, last];
  };

  return {
    // Paint the cells into `pixels`: each { rows, row, column, level, rgb }
    // (level 0 to 1, rgb as [red, green, blue]) is a patch of its colour
    // with edges `featherMm` soft. Where patches meet, their colours mix;
    // where nothing is lit, the picture is clear.
    paintCells(pixels, cells, featherMm) {
      sums.fill(0);
      for (const cell of cells) {
        const { across, down } = sharesFor(cell.rows, featherMm);
        const shareX = across[cell.column];
        const shareY = down[cell.row];
        const [left, right] = reach(shareX);
        const [top, bottom] = reach(shareY);
        for (let y = top; y <= bottom; y += 1) {
          const light = shareY[y] * cell.level;
          for (let x = left; x <= right; x += 1) {
            const weight = shareX[x] * light;
            const at = (y * size.width + x) * 4;
            sums[at] += cell.rgb[0] * weight;
            sums[at + 1] += cell.rgb[1] * weight;
            sums[at + 2] += cell.rgb[2] * weight;
            sums[at + 3] += weight;
          }
        }
      }
      for (let at = 0; at < sums.length; at += 4) {
        const light = sums[at + 3];
        if (light < FAINT) {
          pixels[at] = 0;
          pixels[at + 1] = 0;
          pixels[at + 2] = 0;
          pixels[at + 3] = 0;
          continue;
        }
        pixels[at] = sums[at] / light;
        pixels[at + 1] = sums[at + 1] / light;
        pixels[at + 2] = sums[at + 2] / light;
        pixels[at + 3] = Math.min(1, light) * 255;
      }
    },

    // One smooth field of colour over the whole picture: every cell's
    // colour, from rgbOf(row, column), flowing into its neighbours' over
    // `blendMm`. Answers three numbers per pixel (red, green, blue).
    field(rows, rgbOf, blendMm) {
      const { across, down } = shares(size, rows, columns, blendMm);
      const colours = new Float32Array(size.width * size.height * 3);
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const rgb = rgbOf(row, column);
          for (let y = 0; y < size.height; y += 1) {
            const light = down[row][y];
            if (light < FAINT / 10) continue;
            for (let x = 0; x < size.width; x += 1) {
              const weight = across[column][x] * light;
              const at = (y * size.width + x) * 3;
              colours[at] += rgb[0] * weight;
              colours[at + 1] += rgb[1] * weight;
              colours[at + 2] += rgb[2] * weight;
            }
          }
        }
      }
      return colours;
    },
  };
}

// A map of light over a picture: how strongly each pixel is lit, 0 to 1.
// Light is laid down in soft round spots and strokes and fades away evenly.
export function createLightMap(size) {
  const light = new Float32Array(size.width * size.height);

  // Raise the light to `level` times a soft round spot of radius `radiusMm`
  // (a bell curve of that width) around a point. Never lowers it.
  function spotInto(target, xMm, heightMm, radiusMm, level) {
    const centreX = (xMm + size.widthMm / 2) * size.pxPerMm - 0.5;
    const centreY = (size.heightMm - heightMm) * size.pxPerMm - 0.5;
    const radius = radiusMm * size.pxPerMm;
    const reach = Math.ceil(radius * 3.2);
    const left = Math.max(0, Math.floor(centreX - reach));
    const right = Math.min(size.width - 1, Math.ceil(centreX + reach));
    const top = Math.max(0, Math.floor(centreY - reach));
    const bottom = Math.min(size.height - 1, Math.ceil(centreY + reach));
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const distance2 = (x - centreX) * (x - centreX) + (y - centreY) * (y - centreY);
        const value = level * Math.exp(-distance2 / (2 * radius * radius));
        const at = y * size.width + x;
        if (value > target[at]) target[at] = value;
      }
    }
  }

  return {
    values: light,
    spotInto,

    // A spot of light at a point.
    spot(xMm, heightMm, radiusMm, level) {
      spotInto(light, xMm, heightMm, radiusMm, level);
    },

    // A stroke of light from one point, where light was laid before, to
    // another: spots close enough together to read as one line.
    stroke(from, to, radiusMm, level) {
      const length = Math.hypot(to.xMm - from.xMm, to.heightMm - from.heightMm);
      const steps = Math.max(1, Math.ceil(length / (radiusMm / 3)));
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        spotInto(
          light,
          from.xMm + (to.xMm - from.xMm) * t,
          from.heightMm + (to.heightMm - from.heightMm) * t,
          radiusMm,
          level,
        );
      }
    },

    // Let all the light fade by `amount` (of the way from full to none).
    // Answers the brightest light left.
    fade(amount) {
      let most = 0;
      for (let i = 0; i < light.length; i += 1) {
        const value = light[i] > amount ? light[i] - amount : 0;
        light[i] = value;
        if (value > most) most = value;
      }
      return most;
    },
  };
}
