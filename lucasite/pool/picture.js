// The picture of a pool of mirror-bright liquid, seen from straight above.
// Such a liquid has no colour of its own; what is seen is what it mirrors:
// a soft bright sky overhead, a window to the upper left, the dimmer side
// of the room to the lower right. The still pool is one even tone with a
// thin line of light and a thin line of shade where it rounds over at its
// edge; a ripple tilts the surface and shows as bands of light and shade.
// Worked out pixel by pixel from the liquid's shape (shape.js) and its
// surface (surface.js). No browser parts.
//
// Pixels are kept as a browser keeps them: four numbers each (red, green,
// blue and how solid, 0 to 255), row after row from the top.

// The size of a picture with `pxPerMm` pixels to the millimetre, over the
// field the liquid can be in.
export function pictureSize(bounds, pxPerMm) {
  const width = Math.ceil((bounds.maxX - bounds.minX) * pxPerMm);
  const height = Math.ceil((bounds.maxH - bounds.minH) * pxPerMm);
  return { pxPerMm, width, height, minX: bounds.minX, maxH: bounds.maxH, widthMm: width / pxPerMm, heightMm: height / pxPerMm };
}

const rgb = (hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
const unit = (way) => {
  const length = Math.hypot(way.x, way.up, way.front);
  return [way.x / length, way.up / length, way.front / length];
};
const smooth = (from, to, value) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

// Makes a painter for one picture size. paint(pixels) paints the liquid as
// it is now.
export function createPainter(look, shape, surface, size) {
  const { pxPerMm, width, height } = size;
  const count = width * height;
  // For the pool at rest, whose edge is the egg's outline, worked out once;
  // and for the pool as it is now, which differs only near a swelling.
  const rest = { phi: new Float32Array(count), still: new Float32Array(count), shows: new Float32Array(count), ground: new Uint8ClampedArray(count * 3), liquid: null };
  const phi = new Float32Array(count); // how far inside the liquid
  const still = new Float32Array(count); // how high the still liquid stands
  const shows = new Float32Array(count); // how much of a ripple shows there
  const ground = new Uint8ClampedArray(count * 3); // the background with the liquid's shade on it
  const tall = new Float32Array(count); // how high the liquid stands now
  const room = new Int32Array(count);
  let liquid = room.subarray(0, 0); // the pixels with liquid in them
  let stamp = -1;
  let round = 0; // how far the whole pool stood out when the arrays for now were made
  let changed = true; // whether the arrays for now differ from those at rest
  const background = rgb(look.background);
  const tint = rgb(look.liquid);
  const shine = rgb(look.shine);
  const window = unit(look.window.towards);
  const dim = unit(look.dim.towards);
  const xOf = (column) => size.minX + (column + 0.5) / pxPerMm;
  const hOf = (row) => size.maxH - (row + 0.5) / pxPerMm;
  const shadowX = Math.round(look.shadow.xMm * pxPerMm);
  const shadowY = Math.round(look.shadow.downMm * pxPerMm);
  const { rimMm, tallMm } = look.edge;
  // The liquid's shade reaches this far beyond its edge.
  const shadeMm = Math.max(look.shadow.softMm, look.around.softMm);

  // The liquid at one pixel: it rounds over within rimMm of its edge,
  // and ripples fade out there.
  function form(into, at, inside) {
    into.phi[at] = inside;
    const t = inside >= rimMm ? 0 : 1 - Math.max(0, inside) / rimMm;
    into.still[at] = inside > 0 ? tallMm * (1 - t * t) : 0;
    into.shows[at] = inside > 0 ? smooth(0, look.edge.rippleFadeMm, inside) * look.ripple : 0;
  }
  // The background at one pixel: a soft shadow to the lower right of the
  // liquid, and a faint shade all round it, so that its light side keeps
  // its edge.
  function shade(into, x, y) {
    const at = y * width + x;
    const fromX = x - shadowX;
    const fromY = y - shadowY;
    let dark = 0;
    if (fromX >= 0 && fromY >= 0 && fromX < width && fromY < height) dark = look.shadow.strength * Math.min(1, Math.max(0, into.phi[fromY * width + fromX] / look.shadow.softMm + 1));
    const round = look.around.strength * Math.min(1, Math.max(0, into.phi[at] / look.around.softMm + 1));
    const keep = (1 - dark) * (1 - round);
    into.ground[at * 3] = background[0] * keep;
    into.ground[at * 3 + 1] = background[1] * keep;
    into.ground[at * 3 + 2] = background[2] * keep;
  }
  const hasLiquid = (inside, x, y) => inside > -look.edge.softMm && x > 0 && y > 0 && x < width - 1 && y < height - 1;

  {
    const list = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const inside = shape.egg.at(xOf(x), hOf(y));
        form(rest, y * width + x, inside);
        if (hasLiquid(inside, x, y)) list.push(y * width + x);
      }
    }
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) shade(rest, x, y);
    rest.liquid = Int32Array.from(list);
  }
  const now = { phi, still, shows, ground };

  // What does not change while the pool's edge stays where it is.
  function lay() {
    stamp = shape.stamp();
    round = shape.roundMm();
    const out = shape.swellings().filter((swelling) => swelling.outMm > 0);
    let found = rest.liquid.length;
    if (round !== 0) {
      // The whole pool stands out a little, all round: every place is that much further inside.
      found = 0;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const at = y * width + x;
          const inside = rest.phi[at] + round;
          form(now, at, inside);
          if (hasLiquid(inside, x, y)) {
            room[found] = at;
            found += 1;
          }
        }
      }
      tall.fill(0);
      changed = true;
    } else if (changed || out.length) {
      phi.set(rest.phi);
      still.set(rest.still);
      shows.set(rest.shows);
      ground.set(rest.ground);
      room.set(rest.liquid);
      tall.fill(0); // nothing stands where the liquid has left
      changed = false;
    }
    liquid = room.subarray(0, found);
    if (out.length) changed = true;
    for (const swelling of out) {
      // Near the swelling the liquid is worked out afresh; further away
      // nothing that shows has changed.
      const reach = shape.reachMm + shadeMm + 1.5;
      const left = Math.max(0, Math.floor((swelling.tip.x - reach - size.minX) * pxPerMm));
      const right = Math.min(width - 1, Math.ceil((swelling.tip.x + reach - size.minX) * pxPerMm));
      const top = Math.max(0, Math.floor((size.maxH - swelling.tip.h - reach) * pxPerMm));
      const bottom = Math.min(height - 1, Math.ceil((size.maxH - swelling.tip.h + reach) * pxPerMm));
      for (let y = top; y <= bottom; y += 1) {
        for (let x = left; x <= right; x += 1) {
          const at = y * width + x;
          const before = phi[at];
          const inside = shape.phiAt(xOf(x), hOf(y));
          form(now, at, inside);
          // (Where two swellings overlap, a pixel is not listed twice.)
          if (hasLiquid(inside, x, y) && !hasLiquid(before, x, y)) {
            room[found] = at;
            found += 1;
          }
        }
      }
      if (round === 0) {
        const more = Math.max(Math.abs(shadowX), Math.abs(shadowY)) + 1;
        for (let y = Math.max(0, top - more); y <= Math.min(height - 1, bottom + more); y += 1) {
          for (let x = Math.max(0, left - more); x <= Math.min(width - 1, right + more); x += 1) shade(now, x, y);
        }
      }
    }
    liquid = room.subarray(0, found);
    if (round !== 0) {
      for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) shade(now, x, y);
    }
  }

  function paint(pixels) {
    if (stamp !== shape.stamp() || round !== shape.roundMm()) lay();
    for (let at = 0; at < count; at += 1) {
      pixels[at * 4] = ground[at * 3];
      pixels[at * 4 + 1] = ground[at * 3 + 1];
      pixels[at * 4 + 2] = ground[at * 3 + 2];
      pixels[at * 4 + 3] = 255;
    }
    // How high the liquid stands now: the still pool, and the ripples on it.
    const rippled = surface.moving();
    for (let k = 0; k < liquid.length; k += 1) {
      const at = liquid[k];
      tall[at] = still[at] + (rippled && shows[at] > 0 ? shows[at] * surface.at(xOf(at % width), hOf(Math.floor(at / width))) : 0);
    }
    const { sky } = look;
    for (let k = 0; k < liquid.length; k += 1) {
      const at = liquid[k];
      const cover = Math.min(1, Math.max(0, phi[at] / look.edge.softMm + 0.5));
      if (cover <= 0) continue;
      // The slope of the surface gives the way it faces, and so the way
      // it mirrors, seen from straight above: (x, up the screen, towards the eye).
      const slopeX = ((tall[at + 1] - tall[at - 1]) * pxPerMm) / 2;
      const slopeH = ((tall[at - width] - tall[at + width]) * pxPerMm) / 2;
      const facing = 1 / Math.sqrt(slopeX * slopeX + slopeH * slopeH + 1);
      const front = facing;
      const mirrorX = -2 * front * slopeX * facing;
      const mirrorH = -2 * front * slopeH * facing;
      const mirrorFront = 2 * front * front - 1;
      let bright = sky.low + (sky.overhead - sky.low) * smooth(-0.2, 0.9, mirrorFront);
      bright -= look.dim.strength * smooth(look.dim.from, look.dim.to, mirrorX * dim[0] + mirrorH * dim[1] + mirrorFront * dim[2]);
      const lit = look.window.strength * smooth(look.window.from, look.window.to, mirrorX * window[0] + mirrorH * window[1] + mirrorFront * window[2]);
      const out = at * 4;
      for (let c = 0; c < 3; c += 1) {
        const colour = Math.min(255, tint[c] * bright + shine[c] * lit);
        pixels[out + c] = ground[at * 3 + c] + (colour - ground[at * 3 + c]) * cover;
      }
    }
  }

  return { paint, size };
}
