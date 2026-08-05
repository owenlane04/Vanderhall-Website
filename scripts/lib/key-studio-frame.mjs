// Keys a Brawley studio frame off its white backdrop and onto the dark page paper.
//
// It lives beside the pipeline rather than inside it because the V9 plan makes the QA gate
// mandatory, and the gate has to run the same code that ships the frames. process-images.mjs
// imports this to deliver; work/v9/qa-keying.mjs imports it to judge.
//
// Why not a global white removal: every one of the 130 frames has a roof at exactly rgb(255,255,255),
// pixel identical to the backdrop behind it. Keying by color alone punches a hole through the roof
// on all nine paint colors. So the backdrop is identified by connectivity to the frame edge, not by
// its value, and the roof survives because its anti-aliased outline is darker than the tolerance and
// blocks the fill.
//
// Three passes, in this order:
//
//   1. A strict border-seeded flood fill through near-white. This removes the backdrop and provably
//      cannot reach the roof. It also cannot reach the floor the vehicle encloses between its wheels,
//      or the contact shadow, because the shadow's own gradient is darker than the tolerance.
//   2. A growth pass restricted to a bottom band, where no roof exists. Inside the band the mask
//      grows from what pass 1 already claimed, through pixels that are light and neutral, which
//      joins the whole contact-shadow gradient to the backdrop mask.
//   3. A second strict near-white growth, this time seeded from the mask rather than from the frame
//      edge and not restricted to the band. Now that the shadow is claimed, this reaches the floor
//      enclosed between the wheels, which sits above the band and is pure white.
//
// Pass 3 is what lets the band stay low, and measurement is why it is safe. Sampled on the Ivory
// White front frame, the worst case: the enclosed floor under the chassis is 100 percent
// rgb(255,255,255), while the skid plate above it, the one piece of light bodywork in the set,
// measures luma 34..185 with a mean of 104 and not one near-white pixel. The plate is a mid grey,
// so a near-white growth cannot climb into it, and the roof stays unreachable because no near-white
// path connects it to the floor.
//
// The composite then multiplies the paper by each masked pixel's own luminance. Pure white lands
// exactly on the paper; the shadow becomes a darker pool on the dark stage, which is what a shadow
// does. Nothing is deleted, so there is no alpha channel and no halo against a background that
// happens not to match.

const PAPER = [0x0e, 0x0e, 0x10];

// Tuned against Brawley-GTS-front-Ivory-White-scaled.jpg, the worst case in the set: a white roof,
// a cream hood, and a light skid plate, all of which must survive.
export const KEYING = {
  // Pass 1. The side views' borders read 252 rather than 255, so the tolerance is not decorative.
  whiteTolerance: 8,
  // Pass 2. bandTop is a fraction of frame height. The vehicle's lowest solid structure sits above
  // it on every angle, so growth begins below anything that could be mistaken for bodywork.
  bandTop: 0.78,
  bandLumaMin: 150,
  bandSpreadMax: 16,
  // The silhouette edge is anti-aliased against white, so a hard mask boundary would alias. The
  // feather is applied as a per-pixel blend weight over this many pixels of distance.
  feather: 2,
  // Pass 4. Sensor dust and shadow-edge slivers survive passes 1 to 3 because they sit just outside
  // the white tolerance. On the white stage they were invisible; on the dark stage a light speck
  // reads as a mark on the page. Measured across the set, the vehicle is always the largest
  // surviving region by three orders of magnitude (1.4M to 2.4M pixels) and the next largest
  // artifact is 3237, so anything under this area is keyed with the backdrop. It is reported rather
  // than assumed: the QA gate prints the count and area per frame.
  speckMaxArea: 2000,
};

const clamp255 = (value) => (value < 0 ? 0 : value > 255 ? 255 : value);

// Returns { data, width, height, mask, inkBox, holes } where data is packed RGB ready to encode.
export const keyStudioFrame = ({ data, width, height, channels }, options = {}) => {
  const { whiteTolerance, bandTop, bandLumaMin, bandSpreadMax, feather, speckMaxArea } = { ...KEYING, ...options };
  const pixels = width * height;
  const at = (k) => k * channels;
  const luma = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  const spread = (i) => Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);

  const mask = new Uint8Array(pixels);
  // pixels + 1 because the queue is written at tail + 1: a full-frame mask would otherwise write one
  // past the end, and a typed array drops that write silently rather than throwing.
  const queue = new Int32Array(pixels + 1);
  let head = 0;
  let tail = 0;

  // Pass 1: strict, from every border pixel, through near-white only.
  const nearWhite = (k) => {
    const i = at(k);
    const floor = 255 - whiteTolerance;
    return data[i] >= floor && data[i + 1] >= floor && data[i + 2] >= floor;
  };
  const seedStrict = (k) => {
    if (mask[k] || !nearWhite(k)) return;
    mask[k] = 1;
    queue[tail += 1] = k;
  };
  for (let x = 0; x < width; x += 1) { seedStrict(x); seedStrict((height - 1) * width + x); }
  for (let y = 0; y < height; y += 1) { seedStrict(y * width); seedStrict(y * width + width - 1); }
  while (head < tail) {
    const k = queue[head += 1];
    const x = k % width;
    const y = (k - x) / width;
    if (x > 0) seedStrict(k - 1);
    if (x < width - 1) seedStrict(k + 1);
    if (y > 0) seedStrict(k - width);
    if (y < height - 1) seedStrict(k + width);
  }
  const strictClaimed = tail;

  // Pass 2: inside the bottom band, every light neutral pixel is stage, claimed directly rather than
  // grown into. Connectivity is deliberately not required here, and measuring is why. The floor the
  // vehicle encloses between its wheels reaches the backdrop only through a tire's contact patch, and
  // the shadow ring around it bottoms out between luma 90 and 145 depending on the angle. A connected
  // growth therefore needs a threshold low enough to cross rubber before it can reach that floor,
  // which is a worse trade than dropping connectivity: what the barrier protects is dark, and dark is
  // already invisible on a dark page, while the pocket behind it is pure white and is not.
  //
  // Dropping connectivity is safe for the same reason the band exists at all. Below the chassis line
  // no roof exists, and the only vehicle material down there is tire and wheel: the skid plate, the
  // one piece of light bodywork, measures luma 34..185 and sits entirely above this line.
  const bandStart = Math.floor(height * bandTop);
  for (let y = bandStart; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const k = y * width + x;
      if (mask[k]) continue;
      const i = at(k);
      if (luma(i) > bandLumaMin && spread(i) < bandSpreadMax) mask[k] = 1;
    }
  }
  const countMask = () => {
    let total = 0;
    for (let k = 0; k < pixels; k += 1) total += mask[k];
    return total;
  };
  const afterBand = countMask();

  // Pass 3: strict again, seeded from the whole mask and free of the band. With the shadow claimed,
  // this is the only route to the floor the wheels enclose, and being strict is what keeps it off
  // the mid-grey skid plate directly above that floor.
  head = 0;
  tail = 0;
  for (let k = 0; k < pixels; k += 1) if (mask[k]) queue[tail += 1] = k;
  while (head < tail) {
    const k = queue[head += 1];
    const x = k % width;
    const y = (k - x) / width;
    if (x > 0) seedStrict(k - 1);
    if (x < width - 1) seedStrict(k + 1);
    if (y > 0) seedStrict(k - width);
    if (y < height - 1) seedStrict(k + width);
  }

  const afterFloor = countMask();

  // Pass 4: classify every surviving region. The largest is the vehicle and is kept whatever it
  // measures. Each of the others is either sensor dust and shadow-edge grain, or a pocket of floor
  // the shadow ring sealed off from the backdrop. Labelling happens once and the report quotes the
  // same numbers that decided it.
  const component = new Int32Array(pixels).fill(-1);
  const regions = [];
  for (let start = 0; start < pixels; start += 1) {
    if (mask[start] || component[start] >= 0) continue;
    const id = regions.length;
    let area = 0;
    let lightNeutral = 0;
    let top = height;
    let bottom = 0;
    component[start] = id;
    head = 0;
    tail = 0;
    queue[tail += 1] = start;
    while (head < tail) {
      const k = queue[head += 1];
      const x = k % width;
      const y = (k - x) / width;
      const i = at(k);
      area += 1;
      if (luma(i) > bandLumaMin && spread(i) < bandSpreadMax) lightNeutral += 1;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      for (const neighbour of [x > 0 ? k - 1 : -1, x < width - 1 ? k + 1 : -1, y > 0 ? k - width : -1, y < height - 1 ? k + width : -1]) {
        if (neighbour < 0 || mask[neighbour] || component[neighbour] >= 0) continue;
        component[neighbour] = id;
        queue[tail += 1] = neighbour;
      }
    }
    regions.push({ area, lightNeutral, top, bottom });
  }
  let vehicleId = -1;
  for (let id = 0; id < regions.length; id += 1) if (vehicleId < 0 || regions[id].area > regions[vehicleId].area) vehicleId = id;
  const vehicle = regions[vehicleId] ?? { top: 0, bottom: height - 1 };
  // The one place a light neutral pocket is legitimately part of the vehicle is the roof, and the
  // roof is in the vehicle's upper half by definition. Below that midline, an enclosed pocket of
  // light neutral pixels is floor: the shadow around it is what kept the flood fill out.
  const vehicleMid = (vehicle.top + vehicle.bottom) / 2;
  let specks = 0;
  let speckArea = 0;
  let pockets = 0;
  let pocketArea = 0;
  let keptExtra = 0;
  const verdicts = regions.map((region, id) => {
    if (id === vehicleId) return "vehicle";
    if (region.area < speckMaxArea) { specks += 1; speckArea += region.area; return "speck"; }
    if (region.lightNeutral / region.area >= 0.9 && region.top > vehicleMid) { pockets += 1; pocketArea += region.area; return "floor pocket"; }
    keptExtra += 1;
    return "kept";
  });
  for (let k = 0; k < pixels; k += 1) {
    const id = component[k];
    if (id < 0) continue;
    const verdict = verdicts[id];
    if (verdict === "speck" || verdict === "floor pocket") mask[k] = 1;
  }

  // The metric that decides bandLumaMin. A correct key leaves light pixels only where the vehicle is
  // genuinely light: the roof, the hood, the skid plate. All of those sit in the vehicle's upper half
  // or are small. A pocket of studio floor the shadow sealed off shows up here as thousands of light
  // pixels below the midline, which is the one artifact a threshold that is too high leaves behind.
  let lightBelowMid = 0;
  for (let y = Math.ceil(vehicleMid); y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const k = y * width + x;
      if (mask[k]) continue;
      if (luma(at(k)) > 200) lightBelowMid += 1;
    }
  }

  // The ink box is what survives: the vehicle. The QA gate compares it against the frame's recorded
  // position, so a mask that ate into the bodywork is caught by geometry rather than by eye.
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x]) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  const inkBox = right < 0
    ? { left: 0, top: 0, width: 0, height: 0 }
    : { left, top, width: right - left + 1, height: bottom - top + 1 };

  // Holes: keyed pixels fully enclosed by surviving ones, found by flooding the mask from the frame
  // edge and reporting whatever it cannot reach. A puncture through the bodywork is the failure this
  // whole design exists to avoid, so it is counted rather than trusted.
  //
  // The count that gates a release is the one above the vehicle's own midline, not the one above the
  // band. Enclosed keyed regions are expected and correct below the midline: the studio floor the
  // wheels seal off is exactly that, and it reaches above the band on the three-quarter angles. What
  // must never be enclosed is a keyed region high on the vehicle, because the only light things up
  // there are the roof and the hood.
  const reached = new Uint8Array(pixels);
  head = 0;
  tail = 0;
  const reach = (k) => {
    if (reached[k] || !mask[k]) return;
    reached[k] = 1;
    queue[tail += 1] = k;
  };
  for (let x = 0; x < width; x += 1) { reach(x); reach((height - 1) * width + x); }
  for (let y = 0; y < height; y += 1) { reach(y * width); reach(y * width + width - 1); }
  while (head < tail) {
    const k = queue[head += 1];
    const x = k % width;
    const y = (k - x) / width;
    if (x > 0) reach(k - 1);
    if (x < width - 1) reach(k + 1);
    if (y > 0) reach(k - width);
    if (y < height - 1) reach(k + width);
  }
  let holes = 0;
  let holesInBody = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const k = y * width + x;
      if (!mask[k] || reached[k]) continue;
      holes += 1;
      if (y < vehicleMid) holesInBody += 1;
    }
  }

  // Feather. A masked pixel within `feather` of a surviving one blends rather than switching, so the
  // silhouette keeps the anti-aliasing the camera gave it instead of stair-stepping.
  const distance = new Uint8Array(pixels).fill(255);
  head = 0;
  tail = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const k = y * width + x;
      if (mask[k]) continue;
      const edge = (x > 0 && mask[k - 1]) || (x < width - 1 && mask[k + 1])
        || (y > 0 && mask[k - width]) || (y < height - 1 && mask[k + width]);
      if (!edge) continue;
      // Seed the ring of masked neighbours at distance 1.
      for (const neighbour of [x > 0 ? k - 1 : -1, x < width - 1 ? k + 1 : -1, y > 0 ? k - width : -1, y < height - 1 ? k + width : -1]) {
        if (neighbour < 0 || !mask[neighbour] || distance[neighbour] !== 255) continue;
        distance[neighbour] = 1;
        queue[tail += 1] = neighbour;
      }
    }
  }
  while (head < tail) {
    const k = queue[head += 1];
    // Expand through distance == feather so the ramp reaches feather + 1, where the weight is exactly
    // 1 and meets the fully keyed interior without a step.
    if (distance[k] > feather) continue;
    const x = k % width;
    const y = (k - x) / width;
    for (const neighbour of [x > 0 ? k - 1 : -1, x < width - 1 ? k + 1 : -1, y > 0 ? k - width : -1, y < height - 1 ? k + width : -1]) {
      if (neighbour < 0 || !mask[neighbour] || distance[neighbour] !== 255) continue;
      distance[neighbour] = distance[k] + 1;
      queue[tail += 1] = neighbour;
    }
  }

  const output = Buffer.allocUnsafe(pixels * 3);
  for (let k = 0; k < pixels; k += 1) {
    const i = at(k);
    const o = k * 3;
    if (!mask[k]) {
      output[o] = data[i];
      output[o + 1] = data[i + 1];
      output[o + 2] = data[i + 2];
      continue;
    }
    const level = luma(i) / 255;
    const keyed = [PAPER[0] * level, PAPER[1] * level, PAPER[2] * level];
    // weight 1 means fully keyed. Pixels one step from the silhouette keep some of their own value,
    // which is the anti-aliased edge the camera recorded.
    const weight = distance[k] === 255 ? 1 : Math.min(1, distance[k] / (feather + 1));
    output[o] = clamp255(Math.round(keyed[0] * weight + data[i] * (1 - weight)));
    output[o + 1] = clamp255(Math.round(keyed[1] * weight + data[i + 1] * (1 - weight)));
    output[o + 2] = clamp255(Math.round(keyed[2] * weight + data[i + 2] * (1 - weight)));
  }

  const claimed = countMask();

  return {
    data: output,
    width,
    height,
    mask,
    inkBox,
    metrics: {
      backdrop: strictClaimed,
      shadow: afterBand - strictClaimed,
      enclosedFloor: afterFloor - afterBand,
      claimedFraction: +(claimed / pixels).toFixed(4),
      bandStart,
      holes,
      holesInBody,
      vehicleArea: vehicle.area ?? 0,
      specks,
      speckArea,
      pockets,
      pocketArea,
      lightBelowMid,
      // A surviving region that is neither the vehicle nor small enough to be dust. Not a failure:
      // on the side views one is a wheel edge the shadow separates from the body. Reported so the
      // montage pass knows where to look.
      keptExtra,
    },
  };
};

// The concept slides need much less than the studio frames. Vanderhall's own sheet-style slides put
// dark render panels on a white canvas, and on a dark page that canvas reads as a plate. This is the
// strict border-seeded pass alone: no band, no region rules, no feather.
//
// It needs no is-this-a-sheet threshold, because it selects itself. Measured across all 32 delivered
// concept slides, the border is either 36 to 92 percent near-white (a sheet) or under 19 percent (a
// full-bleed render), and no full-bleed render is more than 1.5 percent near-white overall. So on a
// render the fill reaches almost nothing and the image passes through; on a sheet it takes the canvas.
export const keyWhiteCanvas = ({ data, width, height, channels }, { whiteTolerance = KEYING.whiteTolerance } = {}) => {
  const pixels = width * height;
  const mask = new Uint8Array(pixels);
  const queue = new Int32Array(pixels + 1);
  let head = 0;
  let tail = 0;
  const floor = 255 - whiteTolerance;
  const seed = (k) => {
    const i = k * channels;
    if (mask[k] || data[i] < floor || data[i + 1] < floor || data[i + 2] < floor) return;
    mask[k] = 1;
    queue[tail += 1] = k;
  };
  for (let x = 0; x < width; x += 1) { seed(x); seed((height - 1) * width + x); }
  for (let y = 0; y < height; y += 1) { seed(y * width); seed(y * width + width - 1); }
  while (head < tail) {
    const k = queue[head += 1];
    const x = k % width;
    const y = (k - x) / width;
    if (x > 0) seed(k - 1);
    if (x < width - 1) seed(k + 1);
    if (y > 0) seed(k - width);
    if (y < height - 1) seed(k + width);
  }
  const output = Buffer.allocUnsafe(pixels * 3);
  let claimed = 0;
  for (let k = 0; k < pixels; k += 1) {
    const i = k * channels;
    const o = k * 3;
    if (mask[k]) {
      claimed += 1;
      const level = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      output[o] = Math.round(PAPER[0] * level);
      output[o + 1] = Math.round(PAPER[1] * level);
      output[o + 2] = Math.round(PAPER[2] * level);
    } else {
      output[o] = data[i];
      output[o + 1] = data[i + 1];
      output[o + 2] = data[i + 2];
    }
  }
  return { data: output, width, height, claimed, claimedFraction: +(claimed / pixels).toFixed(4) };
};

export const keyingNote = (options = {}) => {
  const { whiteTolerance, bandTop, bandLumaMin, bandSpreadMax, feather } = { ...KEYING, ...options };
  return `keyed dark: border flood tol ${whiteTolerance}, band ${Math.round(bandTop * 100)}pct luma ${bandLumaMin} spread ${bandSpreadMax}, feather ${feather}px, paper multiply`;
};
