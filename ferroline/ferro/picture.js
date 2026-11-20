// The picture of ferroline's liquid: glossy black seen from straight
// above, lit from the upper left. A glossy black surface shows no colour
// of its own; what is seen is the light it mirrors: a broad soft shine on
// the still pool, a bright line along its rounded rim, and a small sharp
// glint on every spike. The picture is worked out pixel by pixel from the
// height of the liquid (src/ferro/liquid.js). No browser parts.
//
// Pixels are kept as a browser keeps them: four numbers each (red, green,
// blue and how solid, 0 to 255), row after row from the top.

// The size of a picture with `pxPerMm` pixels to the millimetre, over the
// field the liquid can be followed in (liquid.bounds).
export function pictureSize(bounds, pxPerMm) {
  const width = Math.ceil((bounds.maxX - bounds.minX) * pxPerMm);
  const height = Math.ceil((bounds.maxH - bounds.minH) * pxPerMm);
  return { pxPerMm, width, height, minX: bounds.minX, maxH: bounds.maxH, widthMm: width / pxPerMm, heightMm: height / pxPerMm };
}

const rgb = (hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));

// Makes a painter for one picture size. paint(pixels, nowMs) paints the
// liquid as it is at that moment.
export function createPainter(look, liquid, size) {
  const { pxPerMm, width, height } = size;
  const phi = new Float32Array(width * height); // how far inside the liquid
  const tall = new Float32Array(width * height); // how high it stands
  const background = rgb(look.background);
  const body = rgb(look.liquid);
  const shine = rgb(look.shine);
  const xOf = (column) => size.minX + (column + 0.5) / pxPerMm;
  const hOf = (row) => size.maxH - (row + 0.5) / pxPerMm;
  const shadowX = Math.round(look.shadow.xMm * pxPerMm);
  const shadowY = Math.round(look.shadow.downMm * pxPerMm);
  const reachMm = look.shadow.softMm + Math.hypot(look.shadow.xMm, look.shadow.downMm) + 1;

  function paint(pixels, nowMs) {
    // The background everywhere; the liquid, with its shadow, in its box.
    for (let at = 0; at < pixels.length; at += 4) {
      pixels[at] = background[0];
      pixels[at + 1] = background[1];
      pixels[at + 2] = background[2];
      pixels[at + 3] = 255;
    }
    const box = liquid.box(reachMm);
    const left = Math.max(1, Math.floor((box.minX - size.minX) * pxPerMm));
    const right = Math.min(width - 2, Math.ceil((box.maxX - size.minX) * pxPerMm));
    const top = Math.max(1, Math.floor((size.maxH - box.maxH) * pxPerMm));
    const bottom = Math.min(height - 2, Math.ceil((size.maxH - box.minH) * pxPerMm));

    // First how far inside and how high, one pixel beyond the box each way.
    for (let y = top - 1; y <= bottom + 1; y += 1) {
      const h = hOf(y);
      for (let x = left - 1; x <= right + 1; x += 1) {
        const at = y * width + x;
        const inside = liquid.phiAt(xOf(x), h);
        phi[at] = inside;
        tall[at] = inside > 0 ? liquid.heightFor(xOf(x), h, inside, nowMs) : 0;
      }
    }

    // Then the light.
    const { light, glint, sheen, shadow } = look;
    for (let y = top; y <= bottom; y += 1) {
      const h = hOf(y);
      for (let x = left; x <= right; x += 1) {
        const at = y * width + x;
        const cover = Math.min(1, Math.max(0, phi[at] / look.edgeMm + 0.5));
        let red = background[0];
        let green = background[1];
        let blue = background[2];
        if (cover < 1) {
          // The liquid's shadow falls to the lower right of it.
          const fromX = x - shadowX;
          const fromY = y - shadowY;
          if (fromX >= left - 1 && fromY >= top - 1) {
            const dark = shadow.strength * Math.min(1, Math.max(0, phi[fromY * width + fromX] / shadow.softMm + 1));
            red *= 1 - dark;
            green *= 1 - dark;
            blue *= 1 - dark;
          }
        }
        if (cover > 0) {
          // The slope of the surface gives the way it faces; the light it
          // mirrors towards the eye, straight above, is brightest where it
          // faces halfway between the eye and the light.
          let slopeX = ((tall[at + 1] - tall[at - 1]) * pxPerMm) / 2;
          let slopeH = ((tall[at - width] - tall[at + width]) * pxPerMm) / 2;
          const gentler = 1 / (1 + Math.sqrt(slopeX * slopeX + slopeH * slopeH) / look.steepest);
          slopeX *= gentler;
          slopeH *= gentler;
          const facing = 1 / Math.sqrt(slopeX * slopeX + slopeH * slopeH + 1);
          let toX = light.xMm - xOf(x);
          let toH = light.heightMm - h;
          let toFront = light.frontMm;
          const far = 1 / Math.sqrt(toX * toX + toH * toH + toFront * toFront);
          toX *= far;
          toH *= far;
          toFront = toFront * far + 1; // halfway to the eye
          const half = 1 / Math.sqrt(toX * toX + toH * toH + toFront * toFront);
          const mirrored = Math.max(0, (-slopeX * toX - slopeH * toH + toFront) * facing * half);
          let bright = sheen.strength * Math.pow(mirrored, sheen.sharpness);
          if (mirrored > 0.94) bright += glint.strength * Math.pow(mirrored, glint.sharpness);
          if (bright > 1) bright = 1;
          red += (body[0] + (shine[0] - body[0]) * bright - red) * cover;
          green += (body[1] + (shine[1] - body[1]) * bright - green) * cover;
          blue += (body[2] + (shine[2] - body[2]) * bright - blue) * cover;
        }
        const out = at * 4;
        pixels[out] = red;
        pixels[out + 1] = green;
        pixels[out + 2] = blue;
      }
    }
  }

  return { paint, size };
}
