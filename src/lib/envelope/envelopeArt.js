// @ts-nocheck
/**
 * Watercolor envelope: static painters and the opening animation.
 * Written separately (see the commit history) and kept as-is apart from being wrapped as an
 * ES module: `createEnvelope(window)` returns
 *   paintEnvelope(canvas, seed)          closed envelope, static
 *   paintOpenedEnvelope(canvas, seed)    opened envelope, static (seal gone, flap up, empty)
 *   playEnvelopeOpening(container, { seed, quick, onDone })  -> { textArea, skip(), destroy() }
 * The two static painters draw the envelope at the same size and position inside a 170:180 box
 * (centred in the canvas's CSS size), so one can be swapped for the other in place.
 * The animation lays itself out in a 440x620 design box centred in `container`, scaled down to fit
 * (never up), so the final card is 400x560 CSS px when the container is at least 440x620.
 * Use it through ./index.ts, which creates it lazily (nothing here may run during prerendering).
 */
export function createEnvelope(root) {
  'use strict';

  /* ---------------- geometry: envelope logical units (same scale as the original painting) ---------------- */
  const cx = 85, cy = 64, EW = 128, EH = 86;
  const x0 = cx - EW / 2, x1 = cx + EW / 2, y0 = cy - EH / 2, y1 = cy + EH / 2;
  const FD = 61;                          // top flap depth: hinge (y0) to tip
  const SX = cx, SY = cy + 18, SEAL_R = 15; // the seal sits on the flap tip
  const FLAP = [[x0, y0], [x1, y0], [cx, cy + 18]];
  // the pocket front = side flaps + bottom flap; its top is the V-shaped opening
  const POCKET = [[x0, y0 + 1.5], [75.5, 65.3], [cx, cy - 6], [94.5, 65.3], [x1, y0 + 1.5], [x1, y1], [x0, y1]];
  const PERSP = 260;                      // camera distance for the flap's 3D turn

  /* ---------------- card: 150 x 210 logical units == 400 x 560 CSS px at final size ---------------- */
  const CW = 150, CH = 210, CSS_PER_UNIT = 400 / CW;
  const WRITE = { left: 40, top: 56, width: 320, height: 448, row: 28, ruleOffset: 22 }; // CSS px within the card

  /* ---------------- animation stage (design px) ---------------- */
  const STAGE_W = 440, STAGE_H = 620;
  const KD = 340 / EW;                    // envelope drawn 340 design px wide
  const ENV_X = 220, ENV_Y = 400;         // envelope centre
  const CARD_FINAL = { x: 220, y: 310, rot: 0, w: 400 };
  const CARD_IN_W = EW * 0.8, CARD_IN_H = CARD_IN_W * CH / CW; // card size while inside the envelope
  const CARD_TOP0 = y0 + 8, CARD_TOP1 = y0 - 0.62 * CARD_IN_H;

  const TIMING_FULL = {
    shake: [0.15, 0.47], crack: [0.47, 0.6], split: 0.6, holly: 0.66,
    flap: [0.78, 1.38], rise: [1.28, 1.95], fin: [1.78, 2.5], fade: [1.86, 2.32],
    text: 2.2, textDur: 0.4, done: 2.5
  };
  const TIMING_QUICK = { rise: [0, 0.42], fin: [0.24, 0.8], fade: [0.3, 0.68], text: 0.55, textDur: 0.3, done: 0.8 };

  /* ---------------- seeded randomness ---------------- */
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function toSeed(s) {
    if (typeof s === 'number' && isFinite(s)) return Math.floor(s) >>> 0;
    let h = 2166136261; const str = String(s == null ? '' : s);
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  let rnd = Math.random;   // swapped for a seeded generator while painting
  let C = null;            // the 2D context currently being painted into
  const R = (a = 1, b) => b === undefined ? rnd() * a : a + rnd() * (b - a);
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const pick = a => a[Math.floor(rnd() * a.length)];

  /* ---------------- watercolor core (same brushes as before) ---------------- */
  // recursive midpoint displacement gives paint-like, irregular edges
  function deform(pts, depth, v) {
    let out = pts;
    for (let d = 0; d < depth; d++) {
      const n = [];
      for (let i = 0; i < out.length; i++) {
        const a = out[i], b = out[(i + 1) % out.length];
        n.push(a);
        const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
        const t = 0.5 + gauss() * 0.12, mag = gauss() * len * v;
        n.push([a[0] + dx * t - dy / len * mag, a[1] + dy * t + dx / len * mag]);
      }
      out = n; v *= 0.65;
    }
    return out;
  }
  function path(p, g) { g = g || C; g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]); g.closePath(); }
  const hsla = (h, s, l, a) => `hsla(${h},${s}%,${l}%,${a})`;
  // a wash: many low-alpha, slightly different deformations of one shape, multiplied like pigment
  function wash(poly, c, o = {}) {
    const layers = o.layers ?? 28, alpha = o.alpha ?? 0.045, v = o.v ?? 0.18, edge = o.edge ?? 0.5, jit = o.jit ?? 6;
    const base = deform(poly, o.baseDepth ?? 2, v);
    C.save(); C.globalCompositeOperation = o.op || 'multiply';
    for (let i = 0; i < layers; i++) {
      const p = deform(base, o.depth ?? 3, v * 0.75);
      path(p);
      C.fillStyle = hsla(c[0] + gauss() * jit * 0.5, c[1] + gauss() * jit, c[2] + gauss() * jit * 0.6, alpha);
      C.fill();
      if (edge > 0) { // pigment pools and dries darker at the rim
        C.strokeStyle = hsla(c[0], c[1], Math.max(c[2] - 18, 4), alpha * edge);
        C.lineWidth = R(0.6, 1.6); C.stroke();
      }
    }
    C.restore();
  }
  // opaque white under paper, so the page behind doesn't tint the translucent washes
  function underlay(poly, alpha = 0.92) {
    C.save(); C.globalCompositeOperation = 'source-over';
    path(deform(poly, 2, 0.01)); C.fillStyle = `rgba(255,254,251,${alpha})`; C.fill();
    C.restore();
  }
  const circ = (x, y, r, n = 14) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [x + Math.cos(a) * r, y + Math.sin(a) * r]; });
  const ellipse = (x, y, rx, ry, n = 16) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [x + Math.cos(a) * rx, y + Math.sin(a) * ry]; });
  const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const dense = (pts, step = 40) => { const o = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 0; k < n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } return o; };
  const rot = (pts, ox, oy, a) => { const c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [ox + (x - ox) * c - (y - oy) * s, oy + (x - ox) * s + (y - oy) * c]); };
  function stroke(pts, color, width, g) { // a pen or graphite line
    g = g || C;
    g.save(); g.globalCompositeOperation = 'multiply'; g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = color; g.lineWidth = width; g.beginPath();
    pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.restore();
  }
  function leaf(x, y, len, wid, ang) { // holly leaf with a spiky edge
    const pts = [], n = 5;
    for (let i = 0; i <= n * 2; i++) { const t = i / (n * 2), w = Math.sin(Math.PI * t) * wid * (i % 2 ? 1 : 0.62); pts.push([t * len, -w]); }
    for (let i = n * 2 - 1; i > 0; i--) { const t = i / (n * 2), w = Math.sin(Math.PI * t) * wid * (i % 2 ? 1 : 0.62); pts.push([t * len, w]); }
    const c = Math.cos(ang), s = Math.sin(ang);
    return pts.map(([u, v]) => [x + u * c - v * s, y + u * s + v * c]);
  }
  function inPoly([x, y], poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  /* ---------------- sprites: each part painted once, offscreen, at display resolution ---------------- */
  function grainTile(rand, strength) { // paper tooth, applied only where paint is (source-atop)
    const t = document.createElement('canvas'); t.width = t.height = 256;
    const tc = t.getContext('2d'), id = tc.createImageData(256, 256), d = id.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = 60; d[i + 1] = 45; d[i + 2] = 30; d[i + 3] = Math.pow(rand(), 3) * strength; }
    tc.putImageData(id, 0, 0);
    return t;
  }
  function sprite(box, k, draw, tile) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(box.w * k)); c.height = Math.max(1, Math.ceil(box.h * k));
    const g = c.getContext('2d'), prev = C; C = g;
    g.setTransform(k, 0, 0, k, -box.x * k, -box.y * k);
    draw();
    if (tile) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop';
      g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'source-over';
    }
    C = prev;
    return { c, x: box.x, y: box.y, w: c.width / k, h: c.height / k, k };
  }
  function tinted(sp, color) {
    const c = document.createElement('canvas'); c.width = sp.c.width; c.height = sp.c.height;
    const g = c.getContext('2d'); g.drawImage(sp.c, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    return Object.assign({}, sp, { c });
  }
  const blit = (g, sp) => g.drawImage(sp.c, sp.x, sp.y, sp.w, sp.h);

  function buildEnvelopeArt(seed, k) {
    rnd = mulberry(seed);
    const tile = grainTile(mulberry((seed ^ 0x2545F491) >>> 0), 16);
    const art = { k, A: R(-0.09, 0.05) };
    const FULL = { x: 4, y: 4, w: 162, h: 122 };
    const FB = { x: 12, y: 12, w: 146, h: 84 };
    const SB = { x: SX - 26, y: SY - 26, w: 52, h: 52 };

    art.shadow = sprite(FULL, k, () => wash(rect(x0 + 3, y0 + 5, EW, EH), [30, 20, 50], { layers: 10, alpha: 0.025, v: 0.03, edge: 0 }), tile);
    // inside of the envelope: slightly darker, shadowed paper, seen through the opening
    art.inside = sprite(FULL, k, () => {
      underlay(rect(x0 + 1, y0 + 1, EW - 2, EH - 2));
      wash(rect(x0, y0, EW, EH), [40, 12, 90], { layers: 16, alpha: 0.05, v: 0.02, edge: 0.45 });
      wash([[x0 + 2, y0 + 2], [x1 - 2, y0 + 2], [cx, cy + 2]], [30, 10, 76], { layers: 10, alpha: 0.035, v: 0.03, edge: 0 });
      wash(rect(x0 + 2, y0 + 1, EW - 4, 9), [30, 10, 70], { layers: 8, alpha: 0.03, v: 0.04, edge: 0 });
    }, tile);
    // pocket front: body paper, side flaps, bottom flap, graphite on the opening, a little splatter
    art.pocket = sprite(FULL, k, () => {
      underlay(POCKET);
      wash(POCKET, [42, 20, 97], { layers: 18, alpha: 0.05, v: 0.02, edge: 0.45 });
      wash([[x0, y0 + 2], [cx - 6, cy + 4], [x0, y1 - 2]], [38, 14, 93], { layers: 10, alpha: 0.035, v: 0.02, edge: 0.5 });
      wash([[x1, y0 + 2], [cx + 6, cy + 4], [x1, y1 - 2]], [38, 14, 92], { layers: 10, alpha: 0.04, v: 0.02, edge: 0.5 });
      wash([[x0 + 1, y1], [cx, cy - 6], [x1 - 1, y1]], [40, 14, 94], { layers: 12, alpha: 0.04, v: 0.02, edge: 0.5 });
      stroke([[x0 + 1, y0 + 3], [75.5, 65.3]], 'rgba(70,60,50,0.12)', 0.35);
      stroke([[x1 - 1, y0 + 3], [94.5, 65.3]], 'rgba(70,60,50,0.12)', 0.35);
      C.save(); C.globalCompositeOperation = 'multiply';
      const cols = [[354, 70, 40], [140, 45, 30], [40, 40, 60]];
      for (let n = 0; n < 14; n++) {
        const p = [cx + gauss() * 34, cy + gauss() * 34], r = Math.abs(gauss()) * 0.7 + 0.25, c = pick(cols), a = R(0.3, 0.6);
        if (!inPoly(p, POCKET)) continue;
        C.fillStyle = hsla(c[0], c[1], c[2] + 8, a); C.beginPath(); C.arc(p[0], p[1], r, 0, 7); C.fill();
      }
      C.restore();
    }, tile);
    art.flapShadow = sprite(FB, k, () => wash([[x0, y0 + 2], [x1, y0 + 2], [cx, cy + 22]], [30, 10, 76], { layers: 8, alpha: 0.03, v: 0.03, edge: 0 }), tile);
    art.flapOut = sprite(FB, k, () => {
      underlay(FLAP);
      wash(FLAP, [42, 20, 97], { layers: 14, alpha: 0.05, v: 0.02, edge: 0.5 });
      stroke([[x0 + 2, y0 + 1], [cx, cy + 18], [x1 - 2, y0 + 1]], 'rgba(70,60,50,0.18)', 0.4);
    }, tile);
    art.flapIn = sprite(FB, k, () => {
      underlay(FLAP);
      wash(FLAP, [38, 12, 91], { layers: 14, alpha: 0.05, v: 0.02, edge: 0.5 });
      wash([[x0 + 8, y0 + 3], [cx, cy + 13], [x1 - 8, y0 + 3], [x1 - 14, y0 + 3], [cx, cy + 8], [x0 + 14, y0 + 3]], [44, 28, 84], { layers: 6, alpha: 0.03, v: 0.02, edge: 0.3 }); // gum strip
      stroke([[x0 + 2, y0 + 1], [cx, cy + 18], [x1 - 2, y0 + 1]], 'rgba(70,60,50,0.12)', 0.35);
    }, tile);
    art.flapOutDark = tinted(art.flapOut, 'rgba(70,58,52,0.55)');
    art.flapInDark = tinted(art.flapIn, 'rgba(70,58,52,0.55)');

    // holly sprig tucked under the seal (unchanged)
    art.holly = sprite({ x: SX - 32, y: SY - 32, w: 64, h: 44 }, k, () => {
      [[-2.6, 25], [-0.55, 23], [-1.6, 17]].forEach(([a, len], i) => {
        wash(leaf(SX, SY, len, 5.2, a), [i === 2 ? 120 : 140, 45, i === 2 ? 34 : 26], { layers: 10, alpha: 0.13, v: 0.04, edge: 0.9, depth: 2 });
        stroke([[SX, SY], [SX + Math.cos(a) * len * 0.9, SY + Math.sin(a) * len * 0.9]], 'rgba(20,50,30,0.45)', 0.45);
      });
      [[-9, -11], [-4, -14], [-12, -6]].forEach(([dx, dy]) => {
        const bx = SX + dx + 2, by = SY + dy + 4;
        wash(circ(bx, by, 2.3, 8), [355, 75, 42], { layers: 6, alpha: 0.25, v: 0.08, edge: 0.9, depth: 1, baseDepth: 1 });
        C.save(); C.fillStyle = 'rgba(255,245,240,0.8)'; C.beginPath(); C.arc(bx - 0.7, by - 0.7, 0.6, 0, 7); C.fill(); C.restore();
      });
    }, tile);

    // the wax seal (unchanged)
    const r = SEAL_R;
    art.sealShadow = sprite(SB, k, () => wash(circ(SX + 1.6, SY + 2.2, r + 1, 12), [0, 30, 18], { layers: 8, alpha: 0.07, v: 0.1, edge: 0 }), tile);
    const drips = Array.from({ length: 3 }, () => { const a = R(Math.PI * 2); return [SX + Math.cos(a) * (r - 1.5), SY + Math.sin(a) * (r - 1.5), R(2, 3.4)]; });
    art.seal = sprite(SB, k, () => {
      const body = circ(SX, SY, r, 12);
      const shapes = () => [body, ...drips.map(([x, y, dr]) => circ(x, y, dr, 8))];
      shapes().forEach(sh => wash(sh, [356, 72, 46], { layers: 12, alpha: 0.15, v: 0.1, edge: 0, op: 'source-over', jit: 3 }));
      shapes().forEach(sh => wash(sh, [354, 74, 38], { layers: 5, alpha: 0.08, v: 0.1, edge: 1, jit: 3 }));
      C.save();
      C.globalCompositeOperation = 'multiply';
      C.strokeStyle = 'hsla(352,70%,30%,0.4)'; C.lineWidth = 0.8;
      C.beginPath(); C.arc(SX + 0.4, SY + 0.5, r * 0.66, 0, 7); C.stroke();
      C.globalCompositeOperation = 'source-over';
      C.strokeStyle = 'hsla(2,85%,72%,0.55)'; C.lineWidth = 0.7;
      C.beginPath(); C.arc(SX - 0.4, SY - 0.4, r * 0.66, Math.PI * 0.9, Math.PI * 1.75); C.stroke();
      const arm = r * 0.47, a0 = R(Math.PI / 3);
      const flake = (ox, oy, col, lw) => {
        C.strokeStyle = col; C.lineWidth = lw; C.lineCap = 'round'; C.beginPath();
        for (let q = 0; q < 6; q++) {
          const a = a0 + q * Math.PI / 3;
          C.moveTo(SX + ox, SY + oy); C.lineTo(SX + ox + Math.cos(a) * arm, SY + oy + Math.sin(a) * arm);
          const mx = SX + ox + Math.cos(a) * arm * 0.58, my = SY + oy + Math.sin(a) * arm * 0.58;
          [-0.75, 0.75].forEach(b => { C.moveTo(mx, my); C.lineTo(mx + Math.cos(a + b) * arm * 0.32, my + Math.sin(a + b) * arm * 0.32); });
        }
        C.stroke();
      };
      C.globalCompositeOperation = 'multiply'; flake(0.4, 0.5, 'hsla(352,70%,30%,0.5)', 0.5);
      C.globalCompositeOperation = 'source-over'; flake(-0.3, -0.3, 'hsla(4,90%,78%,0.55)', 0.4);
      C.fillStyle = 'rgba(255,238,232,0.55)';
      path(deform(rot(ellipse(SX - r * 0.5, SY - r * 0.55, r * 0.28, r * 0.13, 8), SX - r * 0.5, SY - r * 0.55, -0.7), 1, 0.1)); C.fill();
      C.fillStyle = 'rgba(255,250,248,0.85)'; C.beginPath(); C.arc(SX - r * 0.2, SY - r * 0.72, 0.8, 0, 7); C.fill();
      C.restore();
    }, tile);

    // a jagged crack across the seal, and the two halves it splits into
    const phi = -Math.PI / 2 + R(-0.45, 0.45);
    const dir = [Math.cos(phi), Math.sin(phi)], nrm = [-dir[1], dir[0]];
    const crack = [], NC = 8;
    for (let i = 0; i <= NC; i++) {
      const t = -1 + 2 * i / NC, along = t * r * 0.97, off = (i === 0 || i === NC) ? 0 : gauss() * 1.8;
      crack.push([SX + dir[0] * along + nrm[0] * off, SY + dir[1] * along + nrm[1] * off]);
    }
    const ext = (p, s) => [p[0] + dir[0] * s, p[1] + dir[1] * s];
    const ea = ext(crack[0], -12), eb = ext(crack[NC], 12);
    art.crack = crack; art.nrm = nrm;
    art.halves = [1, -1].map(side => {
      const poly = [ea, ...crack, eb, [eb[0] + nrm[0] * side * 40, eb[1] + nrm[1] * side * 40], [ea[0] + nrm[0] * side * 40, ea[1] + nrm[1] * side * 40]];
      const c = document.createElement('canvas'); c.width = art.seal.c.width; c.height = art.seal.c.height;
      const g = c.getContext('2d');
      g.setTransform(k, 0, 0, k, -SB.x * k, -SB.y * k);
      path(poly, g); g.clip();
      blit(g, art.seal);
      stroke(crack, 'hsla(352,60%,24%,0.75)', 1.1, g);     // the broken face
      return Object.assign({}, art.seal, { c, side, pivot: [SX + nrm[0] * side * r * 0.45, SY + nrm[1] * side * r * 0.45] });
    });
    // what the seal leaves behind on the pocket
    art.residue = sprite(SB, k, () => {
      wash(circ(SX, SY, r * 0.72, 12), [355, 40, 88], { layers: 5, alpha: 0.02, v: 0.14, edge: 0.7 });
      for (let i = 0; i < 2; i++) wash(circ(SX + gauss() * 4, SY + gauss() * 4, R(0.4, 0.8), 7), [354, 65, 45], { layers: 3, alpha: 0.16, v: 0.1, edge: 0.5, depth: 1, baseDepth: 1 });
    }, tile);

    // scratch canvas for the flap's perspective turn
    const bx = cx - 110, by = -70, bc = document.createElement('canvas');
    bc.width = Math.ceil(220 * k); bc.height = Math.ceil(175 * k);
    art.buf = { c: bc, g: bc.getContext('2d'), x: bx, y: by, w: bc.width / k, h: bc.height / k, k };
    return art;
  }

  function buildCardArt(seed, k) {
    rnd = mulberry((seed ^ 0x5BD1E995) >>> 0);
    const tile = grainTile(mulberry((seed ^ 0x68E31DA4) >>> 0), 16);
    const sheet = dense(rect(0, 0, CW, CH), 24);
    return sprite({ x: -8, y: -8, w: CW + 18, h: CH + 20 }, k, () => {
      wash(dense(rect(3, 5, CW, CH), 30), [30, 20, 50], { layers: 10, alpha: 0.025, v: 0.02, edge: 0 });
      underlay(sheet, 0.96);
      wash(sheet, [40, 8, 98], { layers: 16, alpha: 0.04, v: 0.012, edge: 0.45 });
      C.save(); path(rect(0.8, 0.8, CW - 1.6, CH - 1.6)); C.clip();
      for (let i = 0; i < 4; i++)  // soft blooms, barely there
        wash(circ(R(20, CW - 20), R(20, CH - 20), R(18, 40), 10), pick([[215, 18, 93], [35, 22, 92], [260, 12, 94]]), { layers: 8, alpha: 0.012, v: 0.3, edge: 0.25 });
      for (let i = 0; i < 2; i++) {  // faint stains near the edges
        const side = rnd() < 0.5;
        wash(circ(side ? R(8, 24) : R(CW - 24, CW - 8), R(CH * 0.55, CH - 10), R(6, 10), 12), [30, 30, 84], { layers: 4, alpha: 0.008, v: 0.14, edge: 0.9 });
      }
      C.restore();
      // ink-ruled lines, one every 28 CSS px, sitting just under each text baseline
      const u = 1 / CSS_PER_UNIT;
      C.save(); C.strokeStyle = 'rgba(150,110,70,0.22)'; C.lineWidth = u; C.lineCap = 'round';
      for (let row = 0; row < WRITE.height / WRITE.row; row++) {
        const y = (WRITE.top + row * WRITE.row + WRITE.ruleOffset) * u, xa = (WRITE.left - 6) * u, xb = (WRITE.left + WRITE.width + 6) * u;
        C.beginPath(); C.moveTo(xa, y);
        for (let x = xa + 6; x < xb; x += 6) C.lineTo(x, y + gauss() * 0.05);
        C.lineTo(xb, y); C.stroke();
      }
      C.restore();
      // a tiny holly sprig in the top-right corner, outside the writing area
      const hx = 138, hy = 12;
      [[2.35, 10], [3.05, 9], [1.75, 7.5]].forEach(([a, len], i) => {
        wash(leaf(hx, hy, len, 2.3, a), [i === 2 ? 120 : 140, 45, i === 2 ? 34 : 28], { layers: 8, alpha: 0.12, v: 0.04, edge: 0.9, depth: 2 });
        stroke([[hx, hy], [hx + Math.cos(a) * len * 0.9, hy + Math.sin(a) * len * 0.9]], 'rgba(20,50,30,0.4)', 0.3);
      });
      [[-1.2, 1.4], [1.1, 0.6], [0.1, -1.3]].forEach(([dx, dy]) => {
        wash(circ(hx + dx, hy + dy, 1.25, 8), [355, 75, 42], { layers: 5, alpha: 0.25, v: 0.08, edge: 0.9, depth: 1, baseDepth: 1 });
      });
    }, tile);
  }

  /* ---------------- drawing ---------------- */
  // The flap turns about its hinge (top edge). It's drawn in thin horizontal strips, each with its own
  // perspective scale, into a scratch canvas on whole pixel rows (so there are no seams), then composited.
  function renderFlap(buf, sp, dark, theta, shade) {
    const g = buf.g, k = buf.k, s = Math.sin(theta), c = Math.cos(theta);
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, buf.c.width, buf.c.height);
    const proj = d => { const p = PERSP / (PERSP - d * s); return [p, cy + (y0 + d * c - cy) * p]; };
    const top = sp.y, bot = sp.y + sp.h;
    const pmax = proj(bot - y0)[0];
    const N = Math.max(1, Math.min(200, Math.ceil(Math.abs(pmax - 1) * 75 * k) + 1));
    for (let i = 0; i < N; i++) {
      const ya = top + (bot - top) * i / N, yb = top + (bot - top) * (i + 1) / N;
      const Ya = proj(ya - y0)[1], Yb = proj(yb - y0)[1], pm = proj((ya + yb) / 2 - y0)[0];
      let r0 = Math.round((Ya - buf.y) * k), r1 = Math.round((Yb - buf.y) * k);
      if (r1 < r0) { const t = r0; r0 = r1; r1 = t; }
      if (r1 === r0) continue;
      const sy = (Yb - Ya) / (yb - ya), ext = (yb - ya) * 0.6;
      const ya2 = Math.max(top, ya - ext), yb2 = Math.min(bot, yb + ext);
      for (const [src, al] of [[sp.c, 1], [dark.c, shade]]) {
        if (al <= 0.002) continue;
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0); g.beginPath(); g.rect(0, r0, buf.c.width, r1 - r0); g.clip();
        g.globalAlpha = al;
        g.setTransform(k, 0, 0, k, -buf.x * k, -buf.y * k);
        g.transform(pm, 0, 0, sy, cx - cx * pm, Ya - ya * sy);
        g.drawImage(src, 0, (ya2 - top) * sp.k, src.width, (yb2 - ya2) * sp.k, sp.x, ya2, sp.w, yb2 - ya2);
        g.restore();
      }
    }
  }
  function flapFace(theta) {
    if (theta <= 1e-4) return 'out';
    const s = Math.sin(theta), c = Math.cos(theta), p = PERSP / (PERSP - FD * s);
    return cy + (y0 + FD * c - cy) * p > y0 ? 'out' : 'in';
  }
  // Draws the envelope in its own logical coordinates (the caller sets the transform).
  // st: { theta, alpha, card(g), residue, over(g) }
  function drawEnvelope(g, art, st) {
    const a = st.alpha == null ? 1 : st.alpha, th = st.theta || 0, face = flapFace(th);
    g.save(); g.globalAlpha = a;
    blit(g, art.shadow); blit(g, art.inside);
    const flap = () => {
      if (th <= 1e-4) { blit(g, art.flapOut); return; }
      const out = face === 'out', s = Math.sin(th);
      renderFlap(art.buf, out ? art.flapOut : art.flapIn, out ? art.flapOutDark : art.flapInDark, th, out ? 0.34 * Math.pow(s, 1.3) : 0.06 + 0.3 * s);
      g.drawImage(art.buf.c, art.buf.x, art.buf.y, art.buf.w, art.buf.h);
    };
    if (face === 'in') flap();
    if (st.card) st.card(g);
    blit(g, art.pocket);
    if (st.residue) blit(g, art.residue);
    const fs = 1 - Math.min(1, th / (Math.PI / 2));
    if (fs > 0) { g.globalAlpha = a * fs; blit(g, art.flapShadow); g.globalAlpha = a; }
    if (face === 'out') flap();
    if (st.over) st.over(g);
    g.restore();
  }

  /* ---------------- easing ---------------- */
  function bezier(p1x, p1y, p2x, p2y) {
    const X = t => ((1 - 3 * p2x + 3 * p1x) * t + (3 * p2x - 6 * p1x)) * t * t + 3 * p1x * t;
    const Y = t => ((1 - 3 * p2y + 3 * p1y) * t + (3 * p2y - 6 * p1y)) * t * t + 3 * p1y * t;
    return x => { if (x <= 0) return 0; if (x >= 1) return 1; let lo = 0, hi = 1, t = x; for (let i = 0; i < 24; i++) { if (X(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; } return Y(t); };
  }
  const EASE = { flap: bezier(0.5, 0, 0.25, 1), rise: bezier(0.42, 0, 0.2, 1), fin: bezier(0.3, 0, 0.12, 1) };
  const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const smooth = x => x * x * (3 - 2 * x);
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------------- static painters ---------------- */
  const BOX = { x: 0, y: -50, w: 170, h: 180 };
  function prepCanvas(canvas) {
    const dpr = Math.min(root.devicePixelRatio || 1, 2);
    let w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) { // not laid out: treat the width/height attributes (first seen) as CSS px
      w = +canvas.dataset.wceW || canvas.width || BOX.w; h = +canvas.dataset.wceH || canvas.height || BOX.h;
      canvas.dataset.wceW = w; canvas.dataset.wceH = h;
    }
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const sc = Math.min(w / BOX.w, h / BOX.h);
    const ox = (w - BOX.w * sc) / 2 - BOX.x * sc, oy = (h - BOX.h * sc) / 2 - BOX.y * sc;
    const g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
    return { g, k: dpr * sc };
  }
  const tilt = (g, A) => { g.translate(cx, cy); g.rotate(A); g.translate(-cx, -cy); };

  function paintEnvelope(canvas, seed) {
    const { g, k } = prepCanvas(canvas), art = buildEnvelopeArt(toSeed(seed), k);
    tilt(g, art.A);
    drawEnvelope(g, art, { theta: 0, over: gg => { blit(gg, art.holly); blit(gg, art.sealShadow); blit(gg, art.seal); } });
  }
  function paintOpenedEnvelope(canvas, seed) {
    const { g, k } = prepCanvas(canvas), art = buildEnvelopeArt(toSeed(seed), k);
    tilt(g, art.A);
    drawEnvelope(g, art, { theta: Math.PI, residue: true });
  }

  /* ---------------- the animation ---------------- */
  function playEnvelopeOpening(container, opts) {
    opts = opts || {};
    const seed = toSeed(opts.seed == null ? 1 : opts.seed), quick = !!opts.quick;
    const onDone = typeof opts.onDone === 'function' ? opts.onDone : null;
    const T = quick ? TIMING_QUICK : TIMING_FULL;
    const reduce = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const doc = container.ownerDocument;

    const prevPosition = container.style.position;
    const madeRelative = root.getComputedStyle(container).position === 'static';
    if (madeRelative) container.style.position = 'relative';

    const canvas = doc.createElement('canvas');
    canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none';
    const cardBox = doc.createElement('div'); // 400x560 CSS box over the final card, scaled with it
    cardBox.style.cssText = 'position:absolute;left:0;top:0;width:400px;height:560px;transform-origin:0 0;pointer-events:none';
    const textArea = doc.createElement('div');
    textArea.style.cssText = `position:absolute;left:${WRITE.left}px;top:${WRITE.top}px;width:${WRITE.width}px;height:${WRITE.height}px;` +
      'box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;color:#3a2f26;' +
      'font:16px/28px "IBM Plex Sans",system-ui,sans-serif;opacity:0;pointer-events:auto';
    cardBox.appendChild(textArea);
    container.appendChild(canvas); container.appendChild(cardBox);
    const g = canvas.getContext('2d');

    let L = null, env = null, card = null, crumbs = null;
    let raf = 0, t0 = null, done = false, dead = false, textShown = false, rebuildTimer = 0;

    function layout() {
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      const cw = container.clientWidth || STAGE_W, ch = container.clientHeight || STAGE_H;
      const s = Math.min(1, cw / STAGE_W, ch / STAGE_H);
      const ox = Math.round((cw - STAGE_W * s) / 2 * dpr) / dpr, oy = Math.round((ch - STAGE_H * s) / 2 * dpr) / dpr;
      // Only resize when the size really changes: assigning width/height (even the same value)
      // wipes the canvas, which showed up as a one-frame blink when the ResizeObserver first fired.
      const W = Math.round(cw * dpr), H = Math.round(ch * dpr);
      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;
      const cardX = ox + (CARD_FINAL.x - CARD_FINAL.w / 2) * s, cardY = oy + (CARD_FINAL.y - CARD_FINAL.w * CH / CW / 2) * s;
      cardBox.style.transform = `translate(${cardX}px,${cardY}px) scale(${s})`;
      return { dpr, s, ox, oy };
    }
    function build() {
      env = buildEnvelopeArt(seed, KD * L.s * L.dpr);
      card = buildCardArt(seed, CSS_PER_UNIT * L.s * L.dpr);
    }
    function makeCrumbs() {
      const m = mulberry((seed + 0x9E3779B9) >>> 0);
      return Array.from({ length: 10 }, () => {
        const p = env.crack[1 + Math.floor(m() * (env.crack.length - 2))], side = m() < 0.5 ? 1 : -1, n = env.nrm;
        const shape = []; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + m() * 0.6; const rr = 0.7 + m() * 0.5; shape.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
        return {
          p: [p[0] + (m() - 0.5) * 2, p[1] + (m() - 0.5) * 2],
          v: [n[0] * side * (18 + m() * 45) + (m() - 0.5) * 16, -(8 + m() * 38)],
          spin: (m() - 0.5) * 18, size: 0.55 + m() * 0.8, shape, col: `hsla(354,70%,${32 + m() * 12}%,0.95)`
        };
      });
    }
    const envToStage = (lx, ly, sink) => {
      const dx = (lx - cx) * KD, dy = (ly - cy) * KD, c = Math.cos(env.A), s = Math.sin(env.A);
      return [ENV_X + dx * c - dy * s, ENV_Y + sink + dx * s + dy * c];
    };
    const wobble = t => {
      if (quick || t < T.shake[0] || t >= T.split) return 0;
      if (t < T.shake[1]) { const q = seg(t, T.shake[0], T.shake[1]); return 0.075 * Math.sin(2 * Math.PI * q * 2.5) * (1 - 0.4 * q); }
      const q = seg(t, T.crack[0], T.split); return 0.02 * Math.sin(q * Math.PI * 3) * (1 - q);
    };
    function aroundSeal(gg, ang, fn) { gg.save(); gg.translate(SX, SY); gg.rotate(ang); gg.translate(-SX, -SY); fn(); gg.restore(); }
    function drawCrack(gg, frac) {
      const pts = env.crack; let total = 0; const seglen = [];
      for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seglen.push(l); total += l; }
      let left = total * frac; const out = [pts[0]];
      for (let i = 1; i < pts.length && left > 0; i++) {
        const l = seglen[i - 1], f = Math.min(1, left / l);
        out.push([lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]); left -= l;
      }
      if (out.length < 2) return;
      stroke(out, 'hsla(352,65%,20%,0.85)', 0.55, gg);
      gg.save(); gg.globalCompositeOperation = 'source-over'; gg.strokeStyle = 'hsla(5,90%,80%,0.45)'; gg.lineWidth = 0.3; gg.lineCap = 'round';
      gg.beginPath(); out.forEach((p, i) => i ? gg.lineTo(p[0] - 0.35, p[1] - 0.35) : gg.moveTo(p[0] - 0.35, p[1] - 0.35)); gg.stroke(); gg.restore();
    }
    function drawSealParts(gg, t) {
      const base = gg.globalAlpha;
      // holly: wobbles with the seal, then falls away
      if (t < T.holly) aroundSeal(gg, wobble(t) * 0.4, () => blit(gg, env.holly));
      else {
        const u = t - T.holly, a = 1 - seg(u, 0.22, 0.45);
        if (a > 0) {
          gg.save(); gg.globalAlpha = base * a;
          gg.translate(SX - 16 * u, SY + 4 * u + 310 * u * u); gg.rotate(-0.6 * u - 1.6 * u * u); gg.translate(-SX, -SY);
          blit(gg, env.holly); gg.restore();
        }
      }
      if (t < T.split) { // whole seal: shake, then the crack runs across
        const w = wobble(t);
        blit(gg, env.sealShadow);
        aroundSeal(gg, w, () => {
          blit(gg, env.seal);
          const cp = seg(t, T.crack[0], T.crack[1]);
          if (cp > 0) drawCrack(gg, 1 - (1 - cp) * (1 - cp));
        });
        return;
      }
      const u = t - T.split;
      const sa = 1 - seg(u, 0, 0.12);
      if (sa > 0) { gg.globalAlpha = base * sa; blit(gg, env.sealShadow); gg.globalAlpha = base; }
      const ha = 1 - seg(u, 0.42, 0.58);
      if (ha > 0) env.halves.forEach(h => { // halves tip apart, then drop
        const n = env.nrm, sep = 10 * u + 30 * u * u, drop = 460 * Math.max(0, u - 0.04) ** 2, ang = h.side * (1.6 * u + 7 * u * u);
        gg.save(); gg.globalAlpha = base * ha;
        gg.translate(h.pivot[0] + n[0] * h.side * sep, h.pivot[1] + n[1] * h.side * sep + drop);
        gg.rotate(ang); gg.translate(-h.pivot[0], -h.pivot[1]);
        blit(gg, h); gg.restore();
      });
      const ca = 1 - seg(u, 0.35, 0.6);
      if (ca > 0) crumbs.forEach(cr => {
        gg.save(); gg.globalAlpha = base * ca; gg.fillStyle = cr.col;
        gg.translate(cr.p[0] + cr.v[0] * u, cr.p[1] + cr.v[1] * u + 460 * u * u); gg.rotate(cr.spin * u); gg.scale(cr.size, cr.size);
        path(cr.shape, gg); gg.fill(); gg.restore();
      });
    }

    function render(t) {
      const { dpr, s, ox, oy } = L;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height);
      g.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
      const stageM = g.getTransform();
      const fq = seg(t, T.fin[0], T.fin[1]), u = EASE.fin(fq);
      const rise = EASE.rise(seg(t, T.rise[0], T.rise[1]));
      const sink = 210 * u + 120 * fq * fq;              // keeps the envelope's bottom below the card's
      const envA = 1 - smooth(seg(t, T.fade[0], T.fade[1]));
      const theta = quick ? Math.PI : Math.PI * EASE.flap(seg(t, T.flap[0], T.flap[1]));
      const top = lerp(CARD_TOP0, CARD_TOP1, rise);
      const ec = envToStage(cx, top + CARD_IN_H / 2, 0);
      const pose = { x: lerp(ec[0], CARD_FINAL.x, u), y: lerp(ec[1], CARD_FINAL.y, u), rot: lerp(env.A, CARD_FINAL.rot, u), w: lerp(CARD_IN_W * KD, CARD_FINAL.w, u) };
      const drawCard = gg => {
        gg.save();
        if (envA > 0.001) { gg.beginPath(); gg.rect(-3000, -3000, 6000, y1 - 1.2 + 3000); gg.clip(); } // still inside the envelope
        gg.setTransform(stageM); gg.globalAlpha = 1;
        gg.translate(pose.x, pose.y); gg.rotate(pose.rot);
        const sc = pose.w / CW; gg.scale(sc, sc); gg.translate(-CW / 2, -CH / 2);
        blit(gg, card);
        gg.restore();
      };
      if (envA > 0.001) {
        g.save();
        g.translate(ENV_X, ENV_Y + sink); g.rotate(env.A); g.scale(KD, KD); g.translate(-cx, -cy);
        drawEnvelope(g, env, { theta, alpha: envA, card: drawCard, residue: quick || t >= T.split, over: quick ? null : gg => drawSealParts(gg, t) });
        g.restore();
      } else drawCard(g);
    }

    function showText(dur) {
      textShown = true;
      textArea.style.transition = dur ? `opacity ${dur}s ease-out` : 'none';
      textArea.style.opacity = '1';
    }
    function finish(instantText) {
      if (done || dead) return;
      done = true; cancelAnimationFrame(raf);
      render(T.done);
      if (instantText || !textShown) showText(0);
      if (onDone) onDone();
    }
    function tick(ts) {
      if (dead || done) return;
      if (t0 === null) t0 = ts;
      const t = (ts - t0) / 1000;
      render(Math.min(t, T.done));
      if (!textShown && t >= T.text) showText(T.textDur);
      if (t >= T.done) { finish(false); return; }
      raf = requestAnimationFrame(tick);
    }

    L = layout(); build(); crumbs = makeCrumbs();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
      if (dead) return;
      const prevK = L.s * L.dpr; L = layout();
      if (Math.abs(L.s * L.dpr / prevK - 1) > 0.12) {
        clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(() => { if (dead) return; build(); if (done) render(T.done); }, 150);
      }
      if (done) render(T.done);
    }) : null;
    if (ro) ro.observe(container);

    if (reduce) {
      done = true; render(T.done); showText(0);
      if (onDone) Promise.resolve().then(() => { if (!dead) onDone(); });
    } else {
      render(0);
      raf = requestAnimationFrame(tick);
    }

    return {
      textArea,
      skip() { finish(true); },
      destroy() {
        if (dead) return;
        dead = true; cancelAnimationFrame(raf); clearTimeout(rebuildTimer);
        if (ro) ro.disconnect();
        canvas.remove(); cardBox.remove();
        if (madeRelative) container.style.position = prevPosition;
      }
    };
  }

  return { paintEnvelope, paintOpenedEnvelope, playEnvelopeOpening };
}
