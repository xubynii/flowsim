// Pedestrian Flow Lab engine: grid fields + collision-free speed model, site and interior scenarios. No DOM.
(function (root) {
  const SQ2 = Math.SQRT2;
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
  const npdf = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * 2.5066);
  const ncdf = (x, m, s) => 0.5 * (1 + erf((x - m) / (s * SQ2)));
  const bump = (c, m, s) => Math.exp(-0.5 * ((c - m) / s) ** 2);
  const hazard = (c, frac, m, s) => frac * npdf(c, m, s) / Math.max(0.05, 1 - frac * ncdf(c, m, s));
  const losBySpace = (s) => s >= 3.3 ? 0 : s >= 2.3 ? 1 : s >= 1.4 ? 2 : s >= 0.9 ? 3 : s >= 0.5 ? 4 : 5;

  // ---------- grid world ----------
  function World(W, D, cs) { const GX = Math.round(W / cs), GZ = Math.round(D / cs); return { W, D, cs, GX, GZ, NC: GX * GZ, obst: new Uint8Array(GX * GZ), cw: new Int16Array(GX * GZ), F: {}, wallD: null, free1m: null, cost: null }; }
  const ci = (G, x) => Math.min(G.GX - 1, Math.max(0, Math.floor(x / G.cs)));
  const cj = (G, z) => Math.min(G.GZ - 1, Math.max(0, Math.floor(z / G.cs)));
  const cellOf = (G, x, z) => cj(G, z) * G.GX + ci(G, x);
  function setRect(G, x0, z0, x1, z1, v, arr) { arr = arr || G.obst; const cs = G.cs; for (let j = Math.max(0, Math.round(z0 / cs)); j < Math.min(G.GZ, Math.round(z1 / cs)); j++) for (let i = Math.max(0, Math.round(x0 / cs)); i < Math.min(G.GX, Math.round(x1 / cs)); i++) arr[j * G.GX + i] = v; }
  function cellsIn(G, x0, z0, x1, z1) { const o = [], cs = G.cs; for (let j = Math.max(0, Math.round(z0 / cs)); j < Math.min(G.GZ, Math.round(z1 / cs)); j++) for (let i = Math.max(0, Math.round(x0 / cs)); i < Math.min(G.GX, Math.round(x1 / cs)); i++) { const k = j * G.GX + i; if (!G.obst[k]) o.push(k); } return o; }
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQ2], [1, -1, SQ2], [-1, 1, SQ2], [-1, -1, SQ2]];
  function dijkstra(G, sources, cost, passAll) {
    const GX = G.GX, GZ = G.GZ, ob = G.obst, d = new Float32Array(G.NC).fill(Infinity), hk = [], hv = [];
    const push = (k, v) => { hk.push(k); hv.push(v); let c = hk.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (hv[p] <= v) break; hk[c] = hk[p]; hv[c] = hv[p]; c = p; } hk[c] = k; hv[c] = v; };
    const pop = () => { const k = hk[0], lk = hk.pop(), lv = hv.pop(); if (hk.length) { let c = 0; const n = hk.length; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c, mv = lv; if (l < n && hv[l] < mv) { m = l; mv = hv[l]; } if (r < n && hv[r] < mv) m = r; if (m === c) break; hk[c] = hk[m]; hv[c] = hv[m]; c = m; } hk[c] = lk; hv[c] = lv; } return k; };
    for (const k of sources) { d[k] = 0; push(k, 0); }
    while (hk.length) {
      const v0 = hv[0], k = pop(); if (v0 > d[k]) continue;
      const i = k % GX, j = (k / GX) | 0;
      for (let q = 0; q < 8; q++) {
        const di = NB[q][0], dj = NB[q][1], ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= GX || jj >= GZ) continue;
        const n = jj * GX + ii;
        if (!passAll) { if (ob[n]) continue; if (di && dj && (ob[j * GX + ii] || ob[jj * GX + i])) continue; }
        const nv = Math.fround(v0 + NB[q][2] * cost(n)); if (nv < d[n]) { d[n] = nv; push(n, nv); }  // fround: compare in the array's precision or equal paths re-queue forever
      }
    }
    return d;
  }
  function finish(G) {
    const walls = []; for (let k = 0; k < G.NC; k++) if (G.obst[k]) walls.push(k);
    G.wallD = walls.length ? dijkstra(G, walls, () => G.cs, true) : new Float32Array(G.NC).fill(99);
    const sf = G.surf;   // surface cost (lawn > paving); absent inside a floor
    G.cost = (n) => G.cs * (1 + (G.wallD[n] < 0.5 ? (0.5 - G.wallD[n]) * 2 : 0)) * (sf ? sf[n] : 1);
    G.free1m = new Float32Array(G.W * G.D);
    for (let k = 0; k < G.NC; k++) if (!G.obst[k]) { const i = k % G.GX, j = (k / G.GX) | 0; G.free1m[Math.floor(j * G.cs) * G.W + Math.floor(i * G.cs)] += G.cs * G.cs; }
  }
  const field = (G, key, src) => { G.F[key] = src.length ? dijkstra(G, src, G.cost) : new Float32Array(G.NC).fill(Infinity); };
  function grad(G, Fd, x, z, away) {
    const i = ci(G, x), j = cj(G, z), c = Fd[j * G.GX + i];
    if (!away && !isFinite(c)) return [0, 0, Infinity];
    const v = (ii, jj) => { if (ii < 0 || jj < 0 || ii >= G.GX || jj >= G.GZ) return away ? c - G.cs : c + G.cs; const k = jj * G.GX + ii, f = Fd[k]; if (away) return f; return (G.obst[k] || !isFinite(f)) ? c + G.cs : f; };
    return [v(i + 1, j) - v(i - 1, j), v(i, j + 1) - v(i, j - 1), c];
  }
  const rectOf = (p) => ({ x0: p.x, z0: p.z, x1: p.x + p.w, z1: p.z + p.d });
  function doorOf(p) {
    const r = rectOf(p), cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, side = p.door || 'S';
    const dw = Math.min(2, (side === 'N' || side === 'S') ? p.w - 0.5 : p.d - 0.5) / 2;
    if (side === 'S') return { x: cx, z: r.z0 - 0.6, strip: [cx - dw, r.z0 - 1, cx + dw, r.z0] };
    if (side === 'N') return { x: cx, z: r.z1 + 0.6, strip: [cx - dw, r.z1, cx + dw, r.z1 + 1] };
    if (side === 'W') return { x: r.x0 - 0.6, z: cz, strip: [r.x0 - 1, cz - dw, r.x0, cz + dw] };
    return { x: r.x1 + 0.6, z: cz, strip: [r.x1, cz - dw, r.x1 + 1, cz + dw] };
  }
  const overlap = (a, b, pad = 0) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.z < b.z + b.d + pad && b.z < a.z + a.d + pad;

  // ---------- program catalogue ----------
  const SITE_TYPES = {
    lobby: { label: 'Office lobby', perM2: 0, dwell: [0, 0] },
    cafe: { label: 'Café', perM2: 1 / 2.5, dwell: [480, 1500], attr: 1.0, cap: 0.10 },
    food: { label: 'Food hall', perM2: 1 / 2, dwell: [900, 2100], attr: 1.5, cap: 0.08 },
    retail: { label: 'Shop', perM2: 1 / 4, dwell: [300, 900], attr: 0.8, cap: 0.05 },
    gallery: { label: 'Gallery', perM2: 1 / 5, dwell: [600, 1800], attr: 0.5, cap: 0.04 },
    seating: { label: 'Seating', perM2: 1 / 1.5, dwell: [600, 1800], attr: 0.7, cap: 0.05 },
    planter: { label: 'Planting', perM2: 0 },
    water: { label: 'Water', perM2: 0 },
    tree: { label: 'Tree', perM2: 0 },
    bench: { label: 'Bench', perM2: 0, dwell: [600, 1800], attr: 0.35, cap: 0.04 },
    canopy: { label: 'Canopy', perM2: 0 },
    table: { label: 'Table set', perM2: 0, fixed: 4, dwell: [900, 2400], attr: 0.6, cap: 0.05 },
    kiosk: { label: 'Kiosk', perM2: 1 / 3, dwell: [120, 420], attr: 0.6, cap: 0.04 },
    bikerack: { label: 'Bike rack', perM2: 0 }, lamp: { label: 'Lamp post', perM2: 0 }, bollard: { label: 'Bollard', perM2: 0 }, bin: { label: 'Bin', perM2: 0 },
  };
  // plaza pieces: SEAT = people sit in it (walkable), INERT = no door or trips, WALK = never blocks walking
  const SEAT = new Set(['seating', 'bench', 'table']), INERT = new Set(['planter', 'water', 'tree', 'canopy', 'bikerack', 'lamp', 'bollard', 'bin']), WALK = new Set(['seating', 'bench', 'canopy', 'table']);
  const ENCLOSED = new Set(['lobby', 'cafe', 'food', 'retail', 'gallery', 'kiosk']);
  // massing: a mass whose underside is below SOLID_BELOW has a solid ground storey (blocks walking); higher = open ground (pilotis/colonnade)
  // what a floor of a mass holds. gen: people who live or work there and make trips from its entrance;
  // dest: a destination others walk to (capacity from its floor area), with staff who commute (one per staff m²)
  const MASS_USES = {
    office: { label: 'Office', m2pp: 12, gen: 'office' },
    residential: { label: 'Residential', m2pp: 40, gen: 'residential' },
    hotel: { label: 'Hotel', m2pp: 35, gen: 'hotel' },
    retail: { label: 'Retail', dest: 'retail', staff: 30 },
    restaurant: { label: 'Food & drink', dest: 'food', staff: 20 },
    civic: { label: 'Civic / gallery', dest: 'gallery', staff: 60 },
  };
  // a mass's programme: bands of floors from the bottom up, e.g. [{ use: 'retail', floors: 2 }, { use: 'office', floors: 14 }]
  function bandsOf(m) {
    const B = m.program && m.program.length ? m.program.filter((b) => b.floors > 0) : [{ use: m.use, floors: m.floors }];
    const sum = B.reduce((a, b) => a + b.floors, 0);
    if (B.length && sum !== m.floors) B[B.length - 1] = { ...B[B.length - 1], floors: Math.max(1, B[B.length - 1].floors + m.floors - sum) };
    return B;
  }
  const officeFloors = (m) => bandsOf(m).filter((b) => b.use === 'office').reduce((a, b) => a + b.floors, 0);
  function dominantUse(m) { const t = {}; for (const b of bandsOf(m)) t[b.use] = (t[b.use] || 0) + b.floors; return Object.entries(t).sort((a, b) => b[1] - a[1])[0][0]; }
  const SOLID_BELOW = 2.5;
  const FACADE_T = 0.3;   // a floor's outer wall, on the inside of the footprint

  // ---------- free-form plaza surfaces: Snaptrude "spaces" drawn as polygons, circles or offset lines ----------
  // A shape is { id, type, name, geom: 'poly' | 'path', pts: [[x, z], ...], closed, width, align: 'c' | 'i' | 'e' }.
  // 'path' is an offset line: the drawn line becomes a band `width` wide on its centre, internal or external side.
  // Later shapes sit on top of earlier ones (a paved path drawn over a lawn wins where they overlap).
  const SHAPE_TYPES = {
    paving: { label: 'Paving', block: false, cost: 1, h: 0.02, width: 10 },
    lawn: { label: 'Lawn', block: false, cost: 1.6, h: 0.04, width: 10 },     // walkable, but people prefer the paving (assumption)
    planting: { label: 'Planting bed', block: true, h: 0.6, width: 3 },
    water: { label: 'Water', block: true, h: 0.3, width: 4 },
    wall: { label: 'Wall or hedge', block: true, h: 1.2, width: 0.5 },
  };
  function ringArea(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return a / 2; }   // > 0 when counter-clockwise (x east, z north)
  function offsetLine(pts, d, closed) {   // shift a polyline sideways by d (positive = left of travel), mitred joints, mitre clamped
    const n = pts.length, out = [], nrm = (u, v) => { const dx = v[0] - u[0], dz = v[1] - u[1], L = Math.hypot(dx, dz) || 1; return [-dz / L, dx / L]; };
    for (let i = 0; i < n; i++) {
      const q = pts[i], a = closed ? pts[(i - 1 + n) % n] : pts[i - 1], b = closed ? pts[(i + 1) % n] : pts[i + 1];
      let v;
      if (!a) v = nrm(q, b); else if (!b) v = nrm(a, q);
      else { const n1 = nrm(a, q), n2 = nrm(q, b), mx = n1[0] + n2[0], mz = n1[1] + n2[1], ml = Math.hypot(mx, mz); if (ml < 1e-6) v = n1; else { const k = 1 / Math.max(0.34, (mx * n1[0] + mz * n1[1]) / ml); v = [mx / ml * k, mz / ml * k]; } }
      out.push([q[0] + v[0] * d, q[1] + v[1] * d]);
    }
    return out;
  }
  function shapePolys(sh) {   // -> [{ outer, holes }]
    const pts = sh.pts || [];
    if (sh.geom !== 'path') return pts.length >= 3 ? [{ outer: pts, holes: [] }] : [];
    if (pts.length < 2) return [];
    const w = Math.max(0.1, sh.width || 1), closed = !!sh.closed && pts.length >= 3;
    // offsets [left, right] of the band; internal/external follow the loop's inside (open lines: internal = right of travel)
    const ccw = closed && ringArea(pts) > 0, inLeft = closed ? ccw : false;
    const [dl, dr] = sh.align === 'i' ? (inLeft ? [w, 0] : [0, -w]) : sh.align === 'e' ? (inLeft ? [0, -w] : [w, 0]) : [w / 2, -w / 2];
    const A = offsetLine(pts, dl, closed), B = offsetLine(pts, dr, closed);
    if (!closed) return [{ outer: A.concat(B.slice().reverse()), holes: [] }];
    return Math.abs(ringArea(A)) >= Math.abs(ringArea(B)) ? [{ outer: A, holes: [B] }] : [{ outer: B, holes: [A] }];
  }
  function inRing(x, z, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  const inPoly = (x, z, P) => inRing(x, z, P.outer) && !P.holes.some((h) => inRing(x, z, h));
  function shapeBox(sh) { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const P of shapePolys(sh)) for (const [x, z] of P.outer) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); } return { x: x0, z: z0, w: x1 - x0, d: z1 - z0 }; }
  const shapeArea = (sh) => shapePolys(sh).reduce((a, P) => a + Math.abs(ringArea(P.outer)) - P.holes.reduce((b, h) => b + Math.abs(ringArea(h)), 0), 0);
  function shapeLayer(L, GX, GZ, cs) {   // per cell: 1 + index of the topmost shape covering its centre, 0 if none
    const lay = new Int16Array(GX * GZ);
    (L.shapes || []).forEach((sh, k) => { for (const P of shapePolys(sh)) { const b = shapeBox({ geom: 'poly', pts: P.outer });
      for (let j = Math.max(0, Math.floor(b.z / cs)); j <= Math.min(GZ - 1, Math.floor((b.z + b.d) / cs)); j++) for (let i = Math.max(0, Math.floor(b.x / cs)); i <= Math.min(GX - 1, Math.floor((b.x + b.w) / cs)); i++) if (inPoly((i + 0.5) * cs, (j + 0.5) * cs, P)) lay[j * GX + i] = k + 1; } });
    return lay;
  }
  const massTop = (m) => m.base + m.floors * m.ftf;
  const inRect = (x, z, r) => x > r.x && x < r.x + r.w && z > r.z && z < r.z + r.d;
  // a mass footprint is its rectangle, or a polygon / offset line / circle in m.fp (then x, z, w, d hold its bounding box)
  const massPolys = (m) => m.fp ? shapePolys(m.fp) : [{ outer: [[m.x, m.z], [m.x + m.w, m.z], [m.x + m.w, m.z + m.d], [m.x, m.z + m.d]], holes: [] }];
  const massArea = (m) => m.fp ? shapeArea(m.fp) : m.w * m.d;
  const inMass = (x, z, m) => inRect(x, z, m) && (!m.fp || massPolys(m).some((P) => inPoly(x, z, P)));
  function fitBox(m) { if (m.fp) { const b = shapeBox(m.fp); m.x = +b.x.toFixed(3); m.z = +b.z.toFixed(3); m.w = +b.w.toFixed(3); m.d = +b.d.toFixed(3); } return m; }
  // ---------- a typical floor of a mass: plate = its footprint in local coordinates (origin at the bounding-box corner) ----------
  const deskCount = (p) => Math.max(2, Math.floor(p.w * p.d / 6));
  const deskPeople = (floor) => ((floor && floor.programs) || []).filter((p) => p.type === 'desks' && !p.out).reduce((a, p) => a + deskCount(p), 0);
  function platePolys(m) { const lc = (r) => r.map(([x, z]) => [x - m.x, z - m.z]); return massPolys(m).map((P) => ({ outer: lc(P.outer), holes: P.holes.map(lc) })); }
  // summed-area table of cells outside the plate: "does this rectangle fit inside?" in constant time
  function plateMask(plate, W, D, g) {
    const GX = Math.ceil(W / g - 1e-9), GZ = Math.ceil(D / g - 1e-9), I = new Int32Array((GX + 1) * (GZ + 1));
    for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) { const out = plate.some((P) => inPoly((i + 0.5) * g, (j + 0.5) * g, P)) ? 0 : 1; I[(j + 1) * (GX + 1) + i + 1] = out + I[j * (GX + 1) + i + 1] + I[(j + 1) * (GX + 1) + i] - I[j * (GX + 1) + i]; }
    const fits = (r, pad) => { const x0 = r.x - pad, x1 = r.x + r.w + pad, z0 = r.z - pad, z1 = r.z + r.d + pad; if (x0 < -1e-6 || z0 < -1e-6 || x1 > W + 1e-6 || z1 > D + 1e-6) return false;
      const i0 = Math.max(0, Math.floor(x0 / g + 1e-6)), i1 = Math.min(GX, Math.ceil(x1 / g - 1e-6)), j0 = Math.max(0, Math.floor(z0 / g + 1e-6)), j1 = Math.min(GZ, Math.ceil(z1 / g - 1e-6)), W1 = GX + 1;
      return I[j1 * W1 + i1] - I[j0 * W1 + i1] - I[j1 * W1 + i0] + I[j0 * W1 + i0] === 0; };
    return { fits };
  }
  const plateSig = (m) => JSON.stringify([+m.w.toFixed(2), +m.d.toFixed(2), m.fp ? platePolys(m).map((P) => P.outer.map(([x, z]) => [+x.toFixed(2), +z.toFixed(2)])) : 0, m.core ? [m.core.x, m.core.z, m.core.w, m.core.d] : 0]);
  // core near the middle, amenities round it, team desks filling the rest; 2 m corridors between rooms, doors facing the core
  function autoFloor(m) {
    const plate = platePolys(m), W = m.w, D = m.d, F = plateMask(plate, W, D, 0.25);
    let A = 0, cx = 0, cz = 0;
    for (const P of plate) { const r = P.outer; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const f = r[j][0] * r[i][1] - r[i][0] * r[j][1]; A += f; cx += (r[j][0] + r[i][0]) * f; cz += (r[j][1] + r[i][1]) * f; } }
    if (Math.abs(A) > 1e-6) { cx /= 3 * A; cz /= 3 * A; } else { cx = W / 2; cz = D / 2; }
    const area = massArea(m), spots = [];
    for (let z = 0; z <= D; z += 0.5) for (let x = 0; x <= W; x += 0.5) spots.push([x, z]);
    const near = (tx, tz) => spots.slice().sort((a, b) => Math.hypot(a[0] - tx, a[1] - tz) - Math.hypot(b[0] - tx, b[1] - tz));
    let core = m.core ? { x: m.core.x, z: m.core.z, w: m.core.w, d: m.core.d } : null;   // a core placed by the designer (the Core tool) is where the floors lay out around
    if (!core) for (const [cw, cd, pad] of [area > 900 ? [10, 8, 1.5] : area > 450 ? [8, 8, 1.5] : area > 200 ? [6, 6, 1.5] : [4, 4, 1], [4, 4, 1], [3, 3, 0.5]]) {
      for (const [x, z] of near(cx, cz)) { const r = { x: x - cw / 2, z: z - cd / 2, w: cw, d: cd }; if (F.fits(r, pad)) { core = r; break; } }
      if (core) break;
    }
    if (!core) return { core: { x: Math.max(0, W / 2 - 1.5), z: Math.max(0, D / 2 - 1.5), w: Math.min(3, W), d: Math.min(3, D), door: 'S' }, programs: [] };
    if (m.blank) { core.door = 'S'; return { core, programs: [] }; }   // a mass drawn by the designer stays empty inside: the core, and whatever they draw
    const ccx = core.x + core.w / 2, ccz = core.z + core.d / 2;
    const strip = (r, side) => { const q = doorOf({ ...r, door: side }).strip; return { x: q[0], z: q[1], w: q[2] - q[0], d: q[3] - q[1] }; };
    core.door = ['S', 'N', 'E', 'W'].map((sd) => [sd, F.fits(strip(core, sd), 0.5)]).sort((a, b) => b[1] - a[1])[0][0];
    const placed = [], cstrip = strip(core, core.door);
    const free = (r, pad) => !overlap(r, core, pad) && !overlap(r, cstrip, 0.5) && placed.every((q) => !overlap(r, q, pad));
    const doorTo = (r) => { const dx = ccx - (r.x + r.w / 2), dz = ccz - (r.z + r.d / 2); return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'E' : 'W') : (dz > 0 ? 'N' : 'S'); };
    const byCore = near(ccx, ccz), far = byCore.slice().reverse();
    const put = (id, type, name, w, d, order) => {
      for (const [x, z] of order) for (const [ww, dd] of [[w, d], [d, w]]) {
        const r = { x: Math.round((x - ww / 2) * 2) / 2, z: Math.round((z - dd / 2) * 2) / 2, w: ww, d: dd };
        if (!F.fits(r, 0.5) || !free(r, 1.6)) continue;
        const pr = { id, type, name, ...r, door: doorTo(r) };
        if (!F.fits(strip(pr, pr.door), 0)) continue;
        placed.push(pr); return pr;
      }
      return null;
    };
    // essentials by the core, then team desks (biggest zone that fits, far side first), then the other rooms in what is left
    put('t1', 'toilets', 'Toilets', 5, 4, byCore); put('k1', 'pantry', 'Pantry', 5, 4, byCore);
    const sizes = [[12, 8], [10, 6], [12, 4], [8, 6], [10, 4], [8, 5], [8, 4], [6, 5], [6, 4], [5, 3]];   // long thin strips suit the band along the façade
    let t = 0;
    for (; t < 16; t++) { let ok = null; for (const [w, d] of sizes) if ((ok = put('d' + (t + 1), 'desks', 'Team ' + String.fromCharCode(65 + t), w, d, far))) break; if (!ok) break; }
    put('m1', 'meeting', 'Meeting 1', 5, 4, byCore); if (area > 500) put('m2', 'meeting', 'Meeting 2', 5, 4, byCore);
    put('r1', 'print', 'Print', 3, 2, byCore); if (area > 400) put('f1', 'focus', 'Focus', 3, 3, byCore);
    return { core, programs: placed };
  }
  // an untouched automatic floor follows the footprint; once edited it stays, and rooms left outside the plate are flagged
  function ensureFloor(m) {
    if (!officeFloors(m)) return null;
    const sig = plateSig(m);
    if (!m.floor || (m.floor.auto && m.floor.sig !== sig)) m.floor = { ...autoFloor(m), auto: true, sig };
    return m.floor;
  }
  // ---------- levels: every floor of a mass can have walls, doors and area tags (its own mixed programme) ----------
  function useAt(m, level) { let lv = 0; for (const b of bandsOf(m)) { lv += b.floors; if (level <= lv) return b.use; } return m.use; }
  function setUseRange(m, from, to, use) {   // give floors from..to a use, re-pack the bands
    const per = []; for (const b of bandsOf(m)) for (let k = 0; k < b.floors; k++) per.push(b.use);
    for (let l = Math.max(1, from); l <= Math.min(per.length, to); l++) per[l - 1] = use;
    const B = []; for (const u of per) { if (B.length && B[B.length - 1].use === u) B[B.length - 1].floors++; else B.push({ use: u, floors: 1 }); }
    m.program = B; m.use = dominantUse(m);
  }
  const levelHas = (lv) => !!lv && ((lv.walls && lv.walls.length) || (lv.tags && lv.tags.length) || lv.own);
  // areas of a floor: the plate cut by walls and room lines (doors ignored, so rooms stay distinct), 4-connected flood fill.
  // a room line ({ sep: true }) only bounds areas; people walk across it. wall[] marks the cells that block walking.
  function regionsOf(L, cs) {
    cs = cs || L.cs || 0.25; const GX = Math.round(L.W / cs), GZ = Math.round(L.D / cs), N = GX * GZ, blk = new Uint8Array(N), wall = new Uint8Array(N), lab = new Int32Array(N).fill(-1), c = L.core;
    const walls = L.walls || [], half = Math.max(0.12, cs * 0.55);
    for (let k = 0; k < N; k++) {
      const x = (k % GX + 0.5) * cs, z = (((k / GX) | 0) + 0.5) * cs;
      if (L.plate ? !L.plate.some((P) => inPoly(x, z, P)) : (x < 0.25 || z < 0.25 || x > L.W - 0.25 || z > L.D - 0.25)) { blk[k] = 1; continue; }
      if (c && x > c.x && x < c.x + c.w && z > c.z && z < c.z + c.d) { blk[k] = 1; continue; }
      for (const w of walls) if (distSeg(x, z, w.a, w.b) < half) { blk[k] = 1; if (!w.sep) { wall[k] = 1; break; } }
      if (!blk[k] && L.plate && walls.length && L.plate.some((P) => [P.outer, ...P.holes].some((r) => r.some((a, i) => distSeg(x, z, a, r[(i + 1) % r.length]) < FACADE_T)))) blk[k] = 1;   // the façade's own thickness, so a wall drawn to its inner face closes the area
    }
    const regions = [], st = [];
    for (let k0 = 0; k0 < N; k0++) {
      if (blk[k0] || lab[k0] >= 0) continue;
      const id = regions.length, cells = []; st.push(k0); lab[k0] = id;
      while (st.length) { const k = st.pop(); cells.push(k); const i = k % GX, j = (k / GX) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= GX || jj >= GZ) continue; const n = jj * GX + ii; if (!blk[n] && lab[n] < 0) { lab[n] = id; st.push(n); } } }
      let sx = 0, sz = 0, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const k of cells) { const x = (k % GX + 0.5) * cs, z = (((k / GX) | 0) + 0.5) * cs; sx += x; sz += z; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      regions.push({ id, cells, area: cells.length * cs * cs, cx: sx / cells.length, cz: sz / cells.length, x0: x0 - cs / 2, z0: z0 - cs / 2, x1: x1 + cs / 2, z1: z1 + cs / 2 });
    }
    const at = (x, z) => { const i = Math.floor(x / cs), j = Math.floor(z / cs); return i >= 0 && j >= 0 && i < GX && j < GZ ? lab[j * GX + i] : -1; };
    for (const r of regions) r.use = L.baseUse || 'office';
    for (const t of L.tags || []) { const id = at(t.x, t.z); if (id >= 0) regions[id].use = t.use; }
    for (const r of regions) r.tiny = r.area < 1.5;
    return { GX, GZ, cs, lab, wall, regions, at };
  }
  function distSeg(x, z, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2)); return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz); }
  function coreOf(m) { if (m.core && !ensureFloor(m)) return { ...m.core, door: m.core.door || 'S' }; const f = ensureFloor(m); if (f) return f.core; const sig = plateSig(m); if (!m.coreAuto || m.coreAuto.sig !== sig) m.coreAuto = { ...autoFloor(m).core, sig }; return m.coreAuto; }
  // the layout of one floor: office floors share the typical floor's rooms unless the floor has its own; walls, doors and tags are always per floor
  function levelLayout(m, level) {
    level = Math.max(1, Math.min(m.floors, level || 1));
    const base = useAt(m, level), lvs = m.levels || (m.levels = {}), lv = lvs[level] || (lvs[level] = {}), f = ensureFloor(m), typical = base === 'office' && !lv.own && !!f;
    const programs = typical ? f.programs : (lv.programs || (lv.programs = []));
    return { W: m.w, D: m.d, cs: 0.25, plate: platePolys(m), core: coreOf(m), programs, walls: lv.walls || (lv.walls = []), doors: lv.doors || (lv.doors = []), tags: lv.tags || (lv.tags = []), baseUse: base, massId: m.id, level, typical, name: m.name, floors: m.floors, use: m.use };
  }
  // what a floor holds, by use: per area when the floor has walls or tags, else the whole plate in the floor's use
  function levelAreas(m, level) {
    const lv = m.levels && m.levels[level], base = useAt(m, level), A = massArea(m), out = [];
    if (!levelHas(lv)) { const f = base === 'office' ? ensureFloor(m) : null; return [{ use: base, area: A, desks: f && f.programs.length ? deskPeople(f) : null }]; }   // a blank floor counts people by area, a drawn one by its desks
    const L = levelLayout(m, level), key = plateSig(m) + base + JSON.stringify([L.walls, L.tags, L.programs.map((q) => [q.type, q.x, q.z, q.w, q.d])]);
    if (lv._ar && lv._ar.key === key) return lv._ar.out;
    const R = regionsOf(L, 0.5);
    for (const r of R.regions) { if (r.tiny) continue; let desks = null; if (r.use === 'office') { const ds = L.programs.filter((q) => q.type === 'desks' && !q.out && R.at(q.x + q.w / 2, q.z + q.d / 2) === r.id); if (ds.length) desks = ds.reduce((a, q) => a + deskCount(q), 0); } out.push({ use: r.use, area: r.area, desks }); }
    Object.defineProperty(lv, '_ar', { value: { key, out }, enumerable: false, configurable: true, writable: true });   // cache, kept out of saves and undo
    return out;
  }
  // people by kind for a mass, floor by floor: office workers (desks, or one per 12 m²), residents, hotel guests, staff of its shops and venues
  function massPop(m) {
    const out = { office: 0, residential: 0, hotel: 0, staff: 0 };
    for (let l = 1; l <= m.floors; l++) for (const a of levelAreas(m, l)) {
      const U = MASS_USES[a.use]; if (!U) continue;   // pantry, toilets, meeting rooms, circulation: part of the floor, no extra people
      if (U.gen === 'office') out.office += a.desks !== null && a.desks !== undefined ? a.desks : Math.round(a.area / U.m2pp);
      else if (U.gen) out[U.gen] += Math.round(a.area / U.m2pp);
      else if (U.staff) out.staff += Math.round(a.area / U.staff);
    }
    return out;
  }
  function useAreas(m) { const t = {}; for (let l = 1; l <= m.floors; l++) for (const a of levelAreas(m, l)) if (MASS_USES[a.use]) t[a.use] = (t[a.use] || 0) + a.area; return t; }
  const massPeople = (m) => { const P = massPop(m); return P.office + P.residential + P.hotel + P.staff; };
  // the destinations a mass offers: one per retail / food / civic band, sized by its floor area
  // the destinations a mass offers: one per retail / food / civic use, sized by its floor area over every floor that has it
  const destBands = (m) => { const by = {}; for (let l = 1; l <= m.floors; l++) for (const a of levelAreas(m, l)) { if (!(MASS_USES[a.use] || {}).dest) continue; const d = by[a.use] || (by[a.use] = { use: a.use, area: 0, from: l, to: l, levels: [] }); d.area += a.area; d.to = l; if (!d.levels.includes(l)) d.levels.push(l); } return Object.values(by).map((d) => ({ ...d, floors: d.levels.length })); };
  // the interior layout of a mass's typical floor (shares the room arrays with the mass, so edits go straight back to the design)
  function floorLayout(m) { const f = ensureFloor(m) || (m.floor = m.floor || { ...autoFloor(m), auto: true, sig: plateSig(m) }); return { W: m.w, D: m.d, cs: 0.25, plate: platePolys(m), core: f.core, programs: f.programs, massId: m.id, name: m.name, floors: officeFloors(m) || m.floors, use: m.use }; }
  function doorOfMass(m) {   // door on the footprint edge nearest the middle of the chosen side, opening outwards
    if (!m.fp) return doorOf(m);
    const side = m.door || 'S', cx = m.x + m.w / 2, cz = m.z + m.d / 2, t = side === 'S' ? [cx, m.z] : side === 'N' ? [cx, m.z + m.d] : side === 'W' ? [m.x, cz] : [m.x + m.w, cz];
    let best = t, bd = Infinity;
    for (const P of massPolys(m)) { const r = P.outer; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((t[0] - a[0]) * dx + (t[1] - a[1]) * dz) / L2)), q = [a[0] + u * dx, a[1] + u * dz], dd = Math.hypot(q[0] - t[0], q[1] - t[1]); if (dd < bd) { bd = dd; best = q; } } }
    const [x, z] = best, n = { S: [0, -1], N: [0, 1], W: [-1, 0], E: [1, 0] }[side];
    const strip = side === 'S' ? [x - 1, z - 1, x + 1, z] : side === 'N' ? [x - 1, z, x + 1, z + 1] : side === 'W' ? [x - 1, z - 1, x, z + 1] : [x, z - 1, x + 1, z + 1];
    return { x: x + n[0] * 0.6, z: z + n[1] * 0.6, strip };
  }
  function massRoot(L, m) { let r = m; for (let k = 0; k < 20; k++) { const cx = r.x + r.w / 2, cz = r.z + r.d / 2, q = L.masses.find((o) => o !== r && Math.abs(massTop(o) - r.base) < 0.3 && inMass(cx, cz, o)); if (!q) break; r = q; } return r; }
  // where each mass's people enter: a lobby under its stack, else the stack's solid ground storey, else nowhere (orphan)
  function routeMasses(L) {
    // each kind of person keeps its own pattern; destinations open where the stack meets the ground
    const lobbies = new Map(), derived = [], orphans = [], GEN = { office: 'office', residential: 'residential', hotel: 'hotel', staff: 'office' };
    const entranceOf = (m, r) => {
      const lob = L.programs.find((p) => p.type === 'lobby' && (overlap(p, r) || overlap(p, m)));
      if (lob) return { lob, x: lob.x, z: lob.z, w: lob.w, d: lob.d, door: lob.door || 'S' };
      if (r.base < SOLID_BELOW) return { mass: r, x: r.x, z: r.z, w: r.w, d: r.d, door: r.door || 'S' };
      return null;
    };
    for (const m of L.masses || []) {
      const r = massRoot(L, m), ent = entranceOf(m, r), pop = massPop(m);
      if (!ent) { orphans.push(m.name); continue; }
      let gen;
      if (ent.lob) { gen = lobbies.get(ent.lob); if (!gen) lobbies.set(ent.lob, gen = { by: {} }); }
      else { gen = derived.find((q) => q.mass === r && q.type === 'lobby'); if (!gen) derived.push(gen = { id: 'e' + r.id, type: 'lobby', name: r.name + ' entrance', x: r.x, z: r.z, w: r.w, d: r.d, door: r.door || 'S', derived: true, mass: r, by: {} }); }
      for (const k in pop) if (pop[k]) gen.by[GEN[k]] = (gen.by[GEN[k]] || 0) + pop[k];
      for (const db of destBands(m)) {
        const U = MASS_USES[db.use];
        derived.push({ id: 'r' + m.id + '_' + db.use, type: U.dest, name: `${m.name} · ${U.label}${m.floors > 1 ? ' L' + db.from + (db.to > db.from ? '–' + db.to : '') : ''}`, area: db.area, floors: db.floors, x: ent.x, z: ent.z, w: ent.w, d: ent.d, door: ent.door, derived: true, mass: ent.mass || null, viaLobby: !!ent.lob });
      }
    }
    for (const p of L.programs) if (p.type === 'lobby') { const e = lobbies.get(p); p.by = e ? e.by : null; p.mpop = e ? Object.values(e.by).reduce((a, v) => a + v, 0) : 0; }
    for (const d of derived) if (d.type === 'lobby') d.pop = Object.values(d.by).reduce((a, v) => a + v, 0);
    return { derived, orphans };
  }
  const INT_TYPES = {
    desks: { label: 'Team desks' },
    meeting: { label: 'Meeting room', perM2: 1 / 3 },
    pantry: { label: 'Pantry', perM2: 1 / 3, dwell: [180, 480] },
    toilets: { label: 'Toilets', fixed: 4, dwell: [120, 240] },
    print: { label: 'Print', fixed: 2, dwell: [60, 150] },
    focus: { label: 'Focus room', perM2: 1 / 5, dwell: [1200, 2400] },
  };
  const capOf = (p, T) => { const t = T[p.type]; return t.fixed || Math.max(1, Math.floor(p.w * p.d * (t.perM2 || 0))); };

  // ---------- shared agent machinery ----------
  function mkAgent(S, x, z, plan, extra) { const r = S.rng; return Object.assign({ id: S.seq++, x, z, px: x, pz: z, plan, li: 0, legT: S.t, st: 'walk', r: 0.2 + r() * 0.05, v0: Math.min(2, Math.max(0.6, 1.34 + 0.26 * Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(6.2832 * r()))), legDist: 0, seen: [] }, extra || {}); }
  function nextLeg(S, a) { a.li++; a.legT = S.t; a.legDist = 0; if (a.li >= a.plan.length) a.dead = true; }
  const red = (S, k) => S.signals && ((S.t + k * 13) % 70) > 25;
  function move(S, dt, decide) {
    const G = S.G, A = S.agents, hash = new Map();
    for (const a of A) { if (a.st === 'in') continue; const key = (Math.floor(a.x) << 8) | Math.floor(a.z); let b = hash.get(key); if (!b) hash.set(key, b = []); b.push(a); }
    S.hash = hash;
    const near = (a, R, fn) => { const cx = Math.floor(a.x), cz = Math.floor(a.z); for (let p = cx - R; p <= cx + R; p++) for (let q = cz - R; q <= cz + R; q++) { const L = hash.get((p << 8) | q); if (L) for (const b of L) if (b !== a) fn(b); } };
    S.near = near;
    for (const a of A) {
      a.nx = a.x; a.nz = a.z;
      if (a.st !== 'walk' || a.dead) continue;
      const dir = decide(a); if (!dir || a.dead || a.st !== 'walk') continue;
      let [ex, ez] = dir;
      near(a, 2, (b) => { const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz) || 1e-3; if (d > 2) return; const R = 8 * Math.exp((a.r + b.r - d) / 0.1); ex += R * dx / d; ez += R * dz / d; });
      const [w1, w2, wd] = grad(G, G.wallD, a.x, a.z, true), wm = Math.hypot(w1, w2) || 1, Rw = 3 * Math.exp((a.r - (wd - G.cs / 2)) / 0.1);
      ex += Rw * w1 / wm; ez += Rw * w2 / wm;
      ex += (S.rng() - 0.5) * 0.08; ez += (S.rng() - 0.5) * 0.08;
      const m = Math.hypot(ex, ez) || 1; ex /= m; ez /= m;
      let gap = Infinity;
      near(a, 2, (b) => { const dx = b.x - a.x, dz = b.z - a.z, al = dx * ex + dz * ez; if (al <= 0 || al > 2.5) return; if (Math.abs(dx * ez - dz * ex) < a.r + b.r) gap = Math.min(gap, al); });
      const v = Math.min(a.v0, Math.max(0, (gap - 2 * a.r) / 1.0));
      a.nx = a.x + v * ex * dt; a.nz = a.z + v * ez * dt;
    }
    const ok = (x, z) => { const i = Math.floor(x / G.cs), j = Math.floor(z / G.cs); return i >= 0 && i < G.GX && j >= 0 && j < G.GZ && !G.obst[j * G.GX + i]; };
    for (const a of A) {
      if (a.dead || a.st !== 'walk' || (a.nx === a.x && a.nz === a.z)) continue;
      const kNew = cellOf(G, a.nx, a.nz), cwk = G.cw[kNew];
      if (cwk && !G.cw[cellOf(G, a.x, a.z)] && red(S, cwk)) continue;  // wait at the kerb
      const ox = a.x, oz = a.z;
      if (ok(a.nx, a.nz)) { a.x = a.nx; a.z = a.nz; } else if (ok(a.nx, a.z)) a.x = a.nx; else if (ok(a.x, a.nz)) a.z = a.nz;
      a.legDist += Math.hypot(a.x - ox, a.z - oz);
    }
    S.agents = A.filter((a) => !a.dead);
    const W = G.W, D = G.D, cnt = new Float32Array(W * D);
    for (const a of S.agents) if (a.st !== 'in') cnt[Math.min(D - 1, Math.floor(a.z)) * W + Math.min(W - 1, Math.floor(a.x))]++;
    const k = dt / 10;
    for (let c = 0; c < W * D; c++) { const ar = G.free1m[c]; const r = ar > 0.2 ? cnt[c] / ar : 0; S.rho[c] += (r - S.rho[c]) * k; }
  }
  function releaseStays(S) {
    for (const a of S.agents) {
      if ((a.st === 'in' || a.st === 'stay') && S.t >= a.until) {
        const p = a.at; if (p) { p.n = Math.max(0, (p.n || 0) - 1); if (a.st === 'in' && p.doorPt) { a.x = p.doorPt.x + (S.rng() - 0.5) * 0.6; a.z = p.doorPt.z + (S.rng() - 0.5) * 0.6; } }
        a.at = null; a.spot = null; a.st = 'walk'; nextLeg(S, a);
      }
    }
  }
  const log = (S, e) => { e.t = S.t; S.log.push(e); };
  const prune = (S) => { const lim = S.t - 3600; let i = 0; while (i < S.log.length && S.log[i].t < lim) i++; if (i) S.log.splice(0, i); };
  const perHour = (S, n) => n * 3600 / Math.max(300, Math.min(3600, S.t));

  // =====================================================================
  // SITE
  // =====================================================================
  const SITE_DEFAULT = () => ({
    W: 110, D: 80, cs: 0.5,
    roads: [{ x0: 0, z0: 14, x1: 110, z1: 22 }, { x0: 25, z0: 22, x1: 33, z1: 80 }, { x0: 77, z0: 22, x1: 85, z1: 80 }],
    crosswalks: [{ x0: 19, z0: 14, x1: 23, z1: 22 }, { x0: 53, z0: 14, x1: 57, z1: 22 }, { x0: 87, z0: 14, x1: 91, z1: 22 }, { x0: 25, z0: 28, x1: 33, z1: 32 }, { x0: 25, z0: 56, x1: 33, z1: 60 }, { x0: 77, z0: 30, x1: 85, z1: 34 }, { x0: 77, z0: 64, x1: 85, z1: 68 }],
    mySite: { x0: 33, z0: 22, x1: 77, z1: 80 },
    targets: { far: 6, height: 90, coverage: 0.6 },
    neighbors: [
      { id: 'n1', name: 'Office tower', type: 'office', pop: 1400, x: 4, z: 30, w: 17, d: 32, h: 80, door: 'E', color: '#3B6FD6' },
      { id: 'n2', name: 'Retail row', type: 'retail', pop: 0, x: 38, z: 2, w: 34, d: 9, h: 12, door: 'N', color: '#D6457A' },
      { id: 'n3', name: 'Housing', type: 'residential', pop: 700, x: 89, z: 26, w: 17, d: 30, h: 36, door: 'W', color: '#C27F00' },
      { id: 'n4', name: 'Metro', type: 'transit', pop: 0, x: 5, z: 3, w: 11, d: 7, h: 5, door: 'E', color: '#7A5CD6' },
      { id: 'n5', name: 'School', type: 'school', pop: 400, x: 89, z: 62, w: 17, d: 14, h: 16, door: 'W', color: '#2E9E6B' },
    ],
    shapes: [
      { id: 's1', type: 'planting', name: 'Planting bed', geom: 'poly', pts: [[38, 44], [41, 44], [41, 47], [38, 47]] },
      { id: 's2', type: 'planting', name: 'Planting bed', geom: 'poly', pts: [[68, 40], [71, 40], [71, 43], [68, 43]] },
    ],
    masses: [
      { id: 'b1', name: 'Tower', use: 'office', x: 46, z: 56, w: 28, d: 20, base: 0, floors: 17, ftf: 4, door: 'S', program: [{ use: 'restaurant', floors: 1 }, { use: 'office', floors: 16 }] },   // the ground floor is a floor of the mass: café and food hall, the office entrance through it
    ],
    programs: [
      { id: 'p4', type: 'retail', name: 'Shop', x: 36, z: 30, w: 6, d: 5, door: 'E' },
      { id: 'p5', type: 'seating', name: 'Seating', x: 48, z: 36, w: 12, d: 8, door: 'S' },
      { id: 't1', type: 'tree', name: 'Tree', x: 39, z: 23.5, w: 1, d: 1 },
      { id: 't2', type: 'tree', name: 'Tree', x: 47, z: 23.5, w: 1, d: 1 },
      { id: 't3', type: 'tree', name: 'Tree', x: 63, z: 23.5, w: 1, d: 1 },
      { id: 't4', type: 'tree', name: 'Tree', x: 71, z: 23.5, w: 1, d: 1 },
      { id: 'k1', type: 'bench', name: 'Bench', x: 61, z: 46, w: 6, d: 0.6 },
    ],
  });
  const EDGES = ['eW', 'eE', 'eS', 'eN'];
  const seatCap = (p) => p.type === 'bench' ? Math.max(1, Math.floor(Math.max(p.w, p.d) / 0.6)) : capOf(p, SITE_TYPES);

  function siteBuild(S) {
    const L = S.L, G = World(L.W, L.D, L.cs);
    L.masses = L.masses || [];
    for (const r of L.roads) setRect(G, r.x0, r.z0, r.x1, r.z1, 1);
    L.crosswalks.forEach((c, k) => { setRect(G, c.x0, c.z0, c.x1, c.z1, 0); setRect(G, c.x0, c.z0, c.x1, c.z1, k + 1, G.cw); });
    for (const n of L.neighbors) setRect(G, n.x, n.z, n.x + n.w, n.z + n.d, 1);
    for (const m of L.masses) if (m.base < SOLID_BELOW) {
      if (!m.fp) { setRect(G, m.x, m.z, m.x + m.w, m.z + m.d, 1); continue; }
      for (let j = Math.max(0, Math.floor(m.z / G.cs)); j <= Math.min(G.GZ - 1, Math.floor((m.z + m.d) / G.cs)); j++) for (let i = Math.max(0, Math.floor(m.x / G.cs)); i <= Math.min(G.GX - 1, Math.floor((m.x + m.w) / G.cs)); i++) if (inMass((i + 0.5) * G.cs, (j + 0.5) * G.cs, m)) G.obst[j * G.GX + i] = 1;
    }
    for (const p of L.programs) {
      if (WALK.has(p.type)) continue;
      if (p.type === 'tree') { const cx = p.x + p.w / 2, cz = p.z + p.d / 2; setRect(G, cx - 0.5, cz - 0.5, cx + 0.5, cz + 0.5, 1); continue; }
      setRect(G, p.x, p.z, p.x + p.w, p.z + p.d, 1);
    }
    L.shapes = L.shapes || [];
    const lay = S.lay = shapeLayer(L, G.GX, G.GZ, G.cs); G.surf = new Float32Array(G.NC).fill(1);
    for (let k = 0; k < G.NC; k++) if (lay[k]) { const T = SHAPE_TYPES[L.shapes[lay[k] - 1].type]; if (T.block) G.obst[k] = 1; else G.surf[k] = T.cost; }
    finish(G);
    const edge = (fn) => { const o = []; for (let k = 0; k < G.NC; k++) if (!G.obst[k] && fn(k % G.GX, (k / G.GX) | 0)) o.push(k); return o; };
    field(G, 'eW', edge((i) => i === 0)); field(G, 'eE', edge((i) => i === G.GX - 1));
    field(G, 'eS', edge((i, j) => j === 0)); field(G, 'eN', edge((i, j) => j === G.GZ - 1));
    for (const n of L.neighbors) { n.doorPt = doorOf(n); field(G, 'n:' + n.id, cellsIn(G, ...n.doorPt.strip)); n.key = 'n:' + n.id; }
    const R = routeMasses(L);
    const old = new Map((S.dprogs || []).map((d) => [d.id, d.n || 0]));
    S.dprogs = R.derived; S.orphans = R.orphans;
    for (const d of S.dprogs) d.n = old.get(d.id) || 0;
    const allP = S.allP = [...L.programs, ...S.dprogs];
    for (const p of allP) {
      p.key = 'p:' + p.id; p.n = p.n || 0;
      if (INERT.has(p.type)) { p.doorPt = null; continue; }
      p.cap = p.type === 'lobby' ? Infinity : p.area ? Math.max(1, Math.floor(p.area * (SITE_TYPES[p.type].perM2 || 0))) : seatCap(p);
      if (SEAT.has(p.type)) { p.doorPt = { x: p.x + p.w / 2, z: p.z + p.d / 2 }; field(G, p.key, cellsIn(G, p.x, p.z, p.x + p.w, p.z + p.d)); }
      else { p.doorPt = p.derived && p.mass && p.mass.fp && !p.viaLobby ? doorOfMass(p.mass) : doorOf(p); field(G, p.key, cellsIn(G, ...p.doorPt.strip)); }
    }
    const ref = cellOf(G, ...(L.ref || [23, 12]));   // a free street cell everything must reach (the demo's is at 23, 12; an imported site names its own)
    const bad = Object.keys(G.F).filter((k) => !isFinite(G.F[k][ref]));
    if (bad.length) return { ok: false, bad };
    // Whyte: seats near trees, water or under cover draw more sitters (planning assumption, capped at 2x)
    const near = (p, q, r) => Math.hypot(Math.max(0, Math.abs((q.x + q.w / 2) - (p.x + p.w / 2)) - (p.w + q.w) / 2), Math.max(0, Math.abs((q.z + q.d / 2) - (p.z + p.d / 2)) - (p.d + q.d) / 2)) <= r;
    for (const p of allP) if (SEAT.has(p.type)) { const tr = L.programs.filter((q) => q.type === 'tree' && near(p, q, 6)).length, wa = L.programs.some((q) => q.type === 'water' && near(p, q, 10)) || L.shapes.some((q) => q.type === 'water' && near(p, shapeBox(q), 10)), cv = L.programs.some((q) => q.type === 'canopy' && overlap(p, q)) || L.masses.some((m) => m.base >= SOLID_BELOW && overlap(p, m)); p.bonus = Math.min(2, 1 + 0.15 * tr + (wa ? 0.3 : 0) + (cv ? 0.2 : 0)); }
    S.G = G; S.rho = S.rho && S.rho.length === G.W * G.D ? S.rho : new Float32Array(G.W * G.D);
    const lob = []; for (const p of allP) if (p.type === 'lobby') { const by = p.by && Object.keys(p.by).length ? p.by : { office: p.pop || 0 }; for (const t in by) if (by[t] > 0) lob.push({ key: p.key, type: t, pop: by[t], pt: p.doorPt }); }
    S.gens = [...L.neighbors.filter((n) => n.pop > 0 && n.type !== 'retail' && n.type !== 'transit').map((n) => ({ key: n.key, type: n.type, pop: n.pop, pt: n.doorPt })), ...lob];
    S.transit = L.neighbors.find((n) => n.type === 'transit');
    S.school = L.neighbors.find((n) => n.type === 'school');
    S.capturable = allP.filter((p) => SITE_TYPES[p.type].cap);
    for (const a of S.agents) { if (G.obst[cellOf(G, a.x, a.z)]) relocate(G, a); for (let k = a.li; k < a.plan.length; k++) if (!G.F[a.plan[k].f]) a.dead = true; }
    S.agents = S.agents.filter((a) => !a.dead);
    // walk distances (m) from each neighbour door to each of my destinations
    S.access = L.neighbors.map((n) => ({ n, d: allP.filter((p) => p.doorPt && p.type !== 'bench').map((p) => ({ p, m: G.F[p.key][cellOf(G, n.doorPt.x, n.doorPt.z)] })) }));
    S.design = designMetrics(L, R);
    return { ok: true };
  }

  // Snaptrude-style area dashboard + NYC POPS plaza checks, from the layout alone (no simulation)
  function designMetrics(L, R) {
    R = R || routeMasses(L);
    const m = L.mySite, siteA = (m.x1 - m.x0) * (m.z1 - m.z0), cs = 0.5, ca = cs * cs, M = L.masses || [];
    const byUse = {}; let gfa = 0, maxH = 0;
    for (const b of M) { gfa += massArea(b) * b.floors; const ua = useAreas(b); for (const u in ua) byUse[u] = (byUse[u] || 0) + ua[u]; maxH = Math.max(maxH, massTop(b)); }
    let cov = 0, solid = 0, shade = 0;
    const trees = L.programs.filter((p) => p.type === 'tree'), encl = L.programs.filter((p) => ENCLOSED.has(p.type)), canop = L.programs.filter((p) => p.type === 'canopy');
    const GX = Math.round(L.W / cs), lay = shapeLayer(L, GX, Math.round(L.D / cs), cs), surf = { paving: 0, lawn: 0, planting: 0, water: 0, wall: 0 };
    for (let z = m.z0 + cs / 2; z < m.z1; z += cs) for (let x = m.x0 + cs / 2; x < m.x1; x += cs) {
      let over = false, sol = false;
      for (const b of M) if (inMass(x, z, b)) { over = true; if (b.base < SOLID_BELOW) sol = true; }
      if (over) cov++;
      if (sol || encl.some((p) => inRect(x, z, p))) { solid++; continue; }
      const k = lay[Math.floor(z / cs) * GX + Math.floor(x / cs)]; if (k) surf[L.shapes[k - 1].type]++;
      if (over || canop.some((p) => inRect(x, z, p)) || trees.some((t) => Math.hypot(t.x + t.w / 2 - x, t.z + t.d / 2 - z) < 2.75)) shade++;
    }
    const plazaA = siteA - solid * ca, area = (t) => L.programs.filter((p) => p.type === t).reduce((s, p) => s + p.w * p.d, 0);
    for (const t in surf) surf[t] *= ca;
    const plantA = area('planter') + surf.planting + surf.lawn, benchM = L.programs.filter((p) => p.type === 'bench').reduce((s, p) => s + Math.max(p.w, p.d), 0);
    const chairs = L.programs.filter((p) => p.type === 'seating').reduce((s, p) => s + capOf(p, SITE_TYPES), 0);
    const people = { office: 0, residential: 0, hotel: 0, staff: 0 };
    for (const b of M) { const P = massPop(b); for (const k in P) people[k] += P[k]; }
    return { siteA, gfa, byUse, far: gfa / siteA, maxH, coverage: cov * ca / siteA, plazaA, plantA, plantPct: plazaA > 0 ? plantA / plazaA : 0,
      seatM: benchM + chairs * 0.61, seatReq: plazaA * 0.3048 / 2.787, benchM, chairs, trees: trees.length, treesReq: plazaA > 0 ? 4 : 0, waterA: area('water') + surf.water, canopyA: area('canopy'), surf,
      shadePct: plazaA > 0 ? shade * ca / plazaA : 0, people, orphans: R.orphans };
  }
  function relocate(G, a) { for (let r = 1; r < 16; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) { const x = a.x + di * G.cs, z = a.z + dj * G.cs; if (x > 0 && z > 0 && x < G.W && z < G.D && !G.obst[cellOf(G, x, z)]) { a.x = a.px = x; a.z = a.pz = z; return; } } }

  function siteNew(layout) { const S = { mode: 'site', L: layout || SITE_DEFAULT(), rng: mulberry(7), t: 0, clock: 8.5, agents: [], log: [], pending: [], trainBuf: [], trainOut: [], nextTrain: 30, nextOut: 0, seq: 1, demand: 1, signals: true, trains: true }; const r = siteBuild(S); if (!r.ok) throw new Error('layout blocked: ' + r.bad.join(',')); return S; }
  function siteReset(S, clock) { S.t = 0; S.clock = clock; S.agents = []; S.log = []; S.pending = []; S.trainBuf = []; S.trainOut = []; S.nextTrain = 30; S.rng = mulberry(7); S.rho.fill(0); for (const p of S.allP) p.n = 0; }

  function pickW(S, items) { let tot = 0; for (const it of items) tot += it.w; let r = S.rng() * tot; for (const it of items) { r -= it.w; if (r <= 0) return it; } return items[items.length - 1]; }
  const edgeKey = (S) => EDGES[Math.floor(S.rng() * 4)];
  const commute = (S) => (S.transit && S.rng() < 0.45) ? S.transit.key : edgeKey(S);
  function attraction(S, from, purpose) {
    const c = S.clock, items = [];
    for (const p of S.allP) {
      const T = SITE_TYPES[p.type]; if (!T.attr) continue;
      let tf = 1; if (p.type === 'food') tf = 0.2 + 2 * bump(c, 12.6, 0.8); else if (p.type === 'cafe') tf = 0.6 + bump(c, 8.8, 0.6) + 0.6 * bump(c, 12.8, 1); else if (SEAT.has(p.type)) tf = (0.3 + 1.5 * bump(c, 12.7, 1)) * (p.bonus || 1);
      if (purpose === 'errand' && p.type === 'retail') tf *= 1.5;
      const d = Math.hypot(p.doorPt.x - from.x, p.doorPt.z - from.z);
      items.push({ key: p.key, p, w: T.attr * tf * Math.sqrt((p.area || p.w * p.d) / 60) * Math.exp(-d / 250) });
    }
    for (const n of S.L.neighbors) if (n.type === 'retail') { const d = Math.hypot(n.doorPt.x - from.x, n.doorPt.z - from.z); items.push({ key: n.key, n, w: 1.2 * Math.sqrt(n.w * n.d / 300) * Math.exp(-d / 250) }); }
    items.push({ key: edgeKey(S), w: 0.8 });
    return pickW(S, items);
  }
  function visitLeg(S, it) { if (it.p) { const T = SITE_TYPES[it.p.type]; return { f: it.key, kind: 'visit', p: it.p, dwell: T.dwell[0] + S.rng() * (T.dwell[1] - T.dwell[0]) }; } if (it.n) return { f: it.key, kind: 'visit', p: null, dwell: 300 + S.rng() * 900 }; return { f: it.key, kind: 'end' }; }
  function startPt(S, key) {
    const G = S.G;
    if (key[0] === 'e') { for (let k = 0; k < 20; k++) { let x, z; if (key === 'eW') { x = 0.3; z = S.rng() * G.D; } else if (key === 'eE') { x = G.W - 0.3; z = S.rng() * G.D; } else if (key === 'eS') { z = 0.3; x = S.rng() * G.W; } else { z = G.D - 0.3; x = S.rng() * G.W; } if (!G.obst[cellOf(G, x, z)] && isFinite(G.F.eW[cellOf(G, x, z)])) return { x, z }; } return null; }
    const o = key[0] === 'n' ? S.L.neighbors.find((n) => n.key === key) : S.allP.find((p) => p.key === key);
    return o && o.doorPt ? { x: o.doorPt.x + (S.rng() - 0.5) * 1.2, z: o.doorPt.z + (S.rng() - 0.5) * 0.6 } : null;
  }
  function trip(S, o, plan) {
    if (!plan.length) return;
    if (S.transit && o === S.transit.key && S.trains) { S.trainBuf.push({ o, plan }); return; }
    spawn(S, o, plan);
  }
  function spawn(S, o, plan) {
    const pt = startPt(S, o); if (!pt) return;
    const mine = plan.some((l) => l.f[0] === 'p');
    const a = mkAgent(S, pt.x, pt.z, plan, { o, mine, cap: !mine, thru: false, ct: 0 });
    S.agents.push(a); log(S, { k: 'start', o });
  }
  const tryRate = (S, perHour, dt) => S.rng() < perHour / 3600 * dt * S.demand;
  function siteDemand(S, dt) {
    const c = S.clock;
    for (const g of S.gens) {
      const P = g.pop;
      if (g.type === 'office') {
        if (tryRate(S, P * 0.92 * npdf(c, 8.8, 0.3), dt)) trip(S, commute(S), [{ f: g.key, kind: 'end' }]);
        if (tryRate(S, P * 0.55 * npdf(c, 12.4, 0.35), dt)) { const it = attraction(S, g.pt, 'food'); const l = visitLeg(S, it); trip(S, g.key, l.kind === 'end' ? [{ ...l, ret: g.key }] : [l, { f: g.key, kind: 'end' }]); }
        if (tryRate(S, P * 0.9 * npdf(c, 17.6, 0.5), dt)) trip(S, g.key, [{ f: commute(S), kind: 'end' }]);
      } else if (g.type === 'residential') {
        if (tryRate(S, P * 0.45 * npdf(c, 8.0, 0.6), dt)) trip(S, g.key, [{ f: (S.school && S.rng() < 0.2) ? S.school.key : commute(S), kind: 'end' }]);
        if (tryRate(S, P * 0.45 * npdf(c, 18.2, 0.8), dt)) trip(S, commute(S), [{ f: g.key, kind: 'end' }]);
        if (tryRate(S, P * 0.3 * npdf(c, 13.5, 2.5), dt)) { const l = visitLeg(S, attraction(S, g.pt, 'errand')); trip(S, g.key, l.kind === 'end' ? [{ ...l, ret: g.key }] : [l, { f: g.key, kind: 'end' }]); }
      } else if (g.type === 'hotel') {
        if (tryRate(S, P * 0.25 * npdf(c, 8.2, 0.5), dt)) { const l = visitLeg(S, attraction(S, g.pt, 'food')); trip(S, g.key, l.kind === 'end' ? [{ ...l, ret: g.key }] : [l, { f: g.key, kind: 'end' }]); }
        if (tryRate(S, P * 0.6 * npdf(c, 9.8, 0.9), dt)) trip(S, g.key, [{ f: commute(S), kind: 'end' }]);
        if (tryRate(S, P * 0.3 * npdf(c, 13, 0.9), dt)) { const l = visitLeg(S, attraction(S, g.pt, 'food')); trip(S, commute(S), l.kind === 'end' ? [l] : [l, { f: commute(S), kind: 'end' }]); }
        if (tryRate(S, P * 0.6 * npdf(c, 18.8, 1.3), dt)) trip(S, commute(S), [{ f: g.key, kind: 'end' }]);
      } else if (g.type === 'school') {
        const res = S.gens.find((x) => x.type === 'residential');
        const from = () => (res && S.rng() < 0.5) ? res.key : commute(S);
        if (tryRate(S, P * 0.9 * npdf(c, 8.3, 0.2), dt)) trip(S, from(), [{ f: g.key, kind: 'end' }]);
        if (tryRate(S, P * 0.9 * npdf(c, 15.5, 0.3), dt)) trip(S, g.key, [{ f: from(), kind: 'end' }]);
      }
    }
    const day = c > 7 && c < 21 ? 1 : 0.3, lunch = bump(c, 12.6, 0.8);
    if (tryRate(S, 500 * day * (1 + lunch), dt)) { const o = S.rng() < 0.25 && S.transit ? S.transit.key : edgeKey(S); let d = edgeKey(S); if (d === o) d = commute(S); if (d !== o) trip(S, o, [{ f: d, kind: 'end' }]); }
    if (tryRate(S, 150 * day * (0.5 + 2 * lunch), dt)) { const o = commute(S), pt = startPt(S, o); if (pt) { const l = visitLeg(S, attraction(S, pt, 'shop')); trip(S, o, l.kind === 'end' ? [l] : [l, { f: commute(S), kind: 'end' }]); } }
    for (let k = S.pending.length - 1; k >= 0; k--) if (S.pending[k].t <= S.t) { trip(S, S.pending[k].o, S.pending[k].plan); S.pending.splice(k, 1); }
    if (S.t >= S.nextTrain) { S.trainOut.push(...S.trainBuf); S.trainBuf = []; S.nextTrain += 180; }
    if (S.trainOut.length && S.t >= S.nextOut) { const sp = S.trainOut.shift(); spawn(S, sp.o, sp.plan); S.nextOut = S.t + 0.4; }
  }
  function capProb(p, c) {
    const T = SITE_TYPES[p.type];
    if (p.type === 'cafe') return T.cap + 0.1 * bump(c, 8.8, 0.6) + 0.06 * bump(c, 12.8, 1) + 0.05 * bump(c, 15.5, 0.6);
    if (p.type === 'food') return 0.02 + 0.15 * bump(c, 12.6, 0.8);
    if (SEAT.has(p.type)) return (T.cap + 0.08 * bump(c, 12.7, 1)) * (p.bonus || 1);
    return T.cap;
  }
  const inMy = (S, a) => { const m = S.L.mySite; return a.x > m.x0 && a.x < m.x1 && a.z > m.z0 && a.z < m.z1; };
  function siteDecide(S, a) {
    const G = S.G, L = a.plan[a.li]; if (!L) { a.dead = true; return null; }
    const Fd = G.F[L.f]; if (!Fd) { a.dead = true; return null; }
    if (a.spot) { const dx = a.spot.x - a.x, dz = a.spot.z - a.z, d = Math.hypot(dx, dz); if (d < 0.4) { a.st = 'stay'; a.until = S.t + L.dwell; return null; } return [dx / d, dz / d]; }
    const [g1, g2, val] = grad(G, Fd, a.x, a.z);
    if (!isFinite(val)) { a.dead = true; return null; }
    if (L.kind === 'end' && val < 0.8) {
      a.dead = true; log(S, { k: 'trip', o: a.o, d: L.f, thru: a.thru });
      if (L.ret) S.pending.push({ t: S.t + 1800 + S.rng() * 1800, o: L.f, plan: [{ f: L.ret, kind: 'end' }] });
      return null;
    }
    if (L.kind === 'visit') {
      const p = L.p;
      if (p && !L.chk && val < 6) { L.chk = true; if (p.n >= p.cap) { log(S, { k: 'full', d: L.f, o: a.o }); nextLeg(S, a); return null; } }
      if (p && SEAT.has(p.type) && val <= 0.01) { if (p.n >= p.cap) { nextLeg(S, a); return null; } p.n++; a.at = p; const mx = Math.min(0.6, p.w / 2), mz = Math.min(0.6, p.d / 2); a.spot = { x: p.x + mx + S.rng() * (p.w - 2 * mx), z: p.z + mz + S.rng() * (p.d - 2 * mz) }; log(S, { k: 'visit', d: L.f, o: a.o, cap: !!L.captured }); return null; }
      if ((!p || !SEAT.has(p.type)) && val < 0.8) {
        if (p && p.n >= p.cap) { nextLeg(S, a); return null; }
        if (p) { p.n++; a.at = p; }
        a.st = 'in'; a.until = S.t + L.dwell; log(S, { k: 'visit', d: L.f, o: a.o, cap: !!L.captured }); return null;
      }
      if (S.t - a.legT > 600) { nextLeg(S, a); return null; }
    }
    if (!a.thru && !a.mine && inMy(S, a)) a.thru = true;
    if (a.cap && L.kind === 'end' && S.t >= a.ct) {
      a.ct = S.t + 1;
      for (const p of S.capturable) {
        if (a.seen.includes(p.id)) continue;
        if (Math.hypot(p.doorPt.x - a.x, p.doorPt.z - a.z) > 5) continue;
        a.seen.push(p.id);
        if (p.n < p.cap && S.rng() < capProb(p, S.clock)) { const T = SITE_TYPES[p.type]; a.plan.splice(a.li, 0, { f: p.key, kind: 'visit', p, dwell: T.dwell[0] + S.rng() * (T.dwell[1] - T.dwell[0]), captured: true }); a.cap = false; a.legT = S.t; return null; }
      }
    }
    const m = Math.hypot(g1, g2) || 1; return [-g1 / m, -g2 / m];
  }
  function siteStep(S, dt) { siteDemand(S, dt); releaseStays(S); move(S, dt, (a) => siteDecide(S, a)); S.t += dt; S.clock += dt / 3600; if ((S.t % 30) < dt) prune(S); }

  function siteMetrics(S) {
    prune(S);
    const G = S.G, L = S.L, lg = S.log;
    const nb = L.neighbors.map((n) => {
      const k = n.key; let st = 0, en = 0, th = 0, tr = 0, vis = 0;
      for (const e of lg) { if (e.k === 'start' && e.o === k) st++; if (e.k === 'trip' && (e.o === k || e.d === k)) { tr++; if (e.d === k) en++; if (e.thru) th++; } if (e.k === 'visit' && e.o === k && e.d[0] === 'p') vis++; if (e.k === 'visit' && e.d === k) en++; }
      let dmax = 0; const dx = Math.floor(n.doorPt.x), dz = Math.floor(n.doorPt.z);
      for (let b = dz - 3; b <= dz + 3; b++) for (let a = dx - 3; a <= dx + 3; a++) if (a >= 0 && b >= 0 && a < G.W && b < G.D && G.free1m[b * G.W + a] > 0.2) dmax = Math.max(dmax, S.rho[b * G.W + a]);
      return { n, out: perHour(S, st), into: perHour(S, en), thru: tr ? th / tr : 0, toMine: perHour(S, vis), los: dmax > 0.02 ? losBySpace(1 / dmax) : 0 };
    });
    const progs = S.allP.filter((p) => p.doorPt && p.type !== 'lobby').map((p) => {
      let v = 0, c = 0, full = 0; const by = {};
      for (const e of lg) { if (e.d !== p.key) continue; if (e.k === 'visit') { v++; if (e.cap) c++; by[e.o] = (by[e.o] || 0) + 1; } if (e.k === 'full') full++; }
      const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
      return { p, visits: perHour(S, v), captured: v ? c / v : 0, turnedAway: perHour(S, full), occ: p.n, cap: p.cap, top: top ? top[0] : null };
    });
    const m = L.mySite; let tot = 0, dd = 0, ef = 0;
    for (let b = Math.ceil(m.z0); b < m.z1; b++) for (let a = Math.ceil(m.x0); a < m.x1; a++) { const c = b * G.W + a; if (G.free1m[c] < 0.2) continue; tot++; const r = S.rho[c]; if (r > 0.71) dd++; if (r > 1.11) ef++; }
    let thru = 0; for (const e of lg) if (e.k === 'trip' && e.thru) thru++;
    let vMine = 0, cMine = 0; for (const e of lg) if (e.k === 'visit' && e.d[0] === 'p') { vMine++; if (e.cap) cMine++; }
    const inPlaza = S.agents.filter((a) => a.st !== 'in' && inMy(S, a)).length;
    return { nb, progs, plaza: { people: inPlaza, d: tot ? dd / tot : 0, ef: tot ? ef / tot : 0, thru: perHour(S, thru), visits: perHour(S, vMine), capShare: vMine ? cMine / vMine : 0 } };
  }

  // =====================================================================
  // INTERIOR
  // =====================================================================
  const INT_DEFAULT = () => ({
    W: 42, D: 26, cs: 0.25,
    core: { x: 17, z: 9, w: 8, d: 8, door: 'S' },
    programs: [
      { id: 'd1', type: 'desks', name: 'Team A', x: 1, z: 1, w: 12, d: 8, door: 'N' },
      { id: 'd2', type: 'desks', name: 'Team B', x: 29, z: 1, w: 12, d: 8, door: 'N' },
      { id: 'd3', type: 'desks', name: 'Team C', x: 1, z: 17, w: 12, d: 8, door: 'S' },
      { id: 'd4', type: 'desks', name: 'Team D', x: 29, z: 17, w: 12, d: 8, door: 'S' },
      { id: 'm1', type: 'meeting', name: 'Meeting 1', x: 15, z: 20, w: 5, d: 5, door: 'S' },
      { id: 'm2', type: 'meeting', name: 'Meeting 2', x: 22, z: 20, w: 5, d: 5, door: 'S' },
      { id: 'k1', type: 'pantry', name: 'Pantry', x: 15, z: 1, w: 6, d: 5, door: 'N' },
      { id: 't1', type: 'toilets', name: 'Toilets', x: 22, z: 1, w: 5, d: 5, door: 'N' },
      { id: 'r1', type: 'print', name: 'Print', x: 1, z: 11, w: 3, d: 3, door: 'E' },
      { id: 'f1', type: 'focus', name: 'Focus', x: 38, z: 11, w: 3, d: 4, door: 'W' },
    ],
  });
  function intBuild(S) {
    const L = S.L, G = World(L.W, L.D, L.cs);
    if (L.plate) {   // the building's own outline: everything outside it is wall
      for (let k = 0; k < G.NC; k++) { const x = (k % G.GX + 0.5) * G.cs, z = (((k / G.GX) | 0) + 0.5) * G.cs; if (!L.plate.some((P) => inPoly(x, z, P))) G.obst[k] = 1; }
      const F = plateMask(L.plate, L.W, L.D, 0.25); for (const p of L.programs) p.out = !F.fits(p, 0.25);
    } else { setRect(G, 0, 0, L.W, 0.25, 1); setRect(G, 0, L.D - 0.25, L.W, L.D, 1); setRect(G, 0, 0, 0.25, L.D, 1); setRect(G, L.W - 0.25, 0, L.W, L.D, 1); for (const p of L.programs) p.out = false; }
    let rooms = S.rooms = L.programs.filter((p) => !p.out);
    const c = L.core; setRect(G, c.x, c.z, c.x + c.w, c.z + c.d, 1);
    // walls block, doors open a 1.2 m gap; areas come from the walls with the doors shut
    const RG = S.regions = regionsOf(L, L.cs);
    rooms = S.rooms = rooms.filter((p) => { if (p.type !== 'desks') return true; const id = RG.at(p.x + p.w / 2, p.z + p.d / 2); return id < 0 || RG.regions[id].use === 'office'; });   // a team zone in an area tagged shop, home, ... is not used on this floor
    if (RG.GX === G.GX && RG.GZ === G.GZ) for (let k = 0; k < G.NC; k++) if (RG.wall[k]) { const x = (k % G.GX + 0.5) * G.cs, z = (((k / G.GX) | 0) + 0.5) * G.cs; if (!(L.doors || []).some((d) => Math.hypot(d[0] - x, d[1] - z) < 0.6)) G.obst[k] = 1; }
    for (const p of rooms) setRect(G, p.x, p.z, p.x + p.w, p.z + p.d, 1);
    finish(G);
    c.doorPt = doorOf(c); field(G, 'core', cellsIn(G, ...c.doorPt.strip));
    for (const p of rooms) { p.key = 'p:' + p.id; p.doorPt = doorOf(p); p.n = 0; p.cap = p.type === 'desks' ? Infinity : capOf(p, INT_TYPES); field(G, p.key, cellsIn(G, ...p.doorPt.strip)); }
    // each tagged area becomes a place in the simulation: office teams, homes, hotel rooms, shops and venues, or a pantry/toilets/meeting room
    const AREA_TYPE = { office: 'desks', residential: 'home', hotel: 'home', retail: 'retail', restaurant: 'food', civic: 'gallery', pantry: 'pantry', toilets: 'toilets', meeting: 'meeting', print: 'print', focus: 'focus' };
    const areas = S.areas = [];
    for (const r of RG.regions) {
      const ty = AREA_TYPE[r.use]; r.place = null; if (!ty || r.tiny) continue;
      if (ty === 'desks' && rooms.some((q) => q.type === 'desks' && RG.at(q.x + q.w / 2, q.z + q.d / 2) === r.id)) continue;   // its desks are drawn as team zones already
      if (ty !== 'desks' && ty !== 'home' && rooms.some((q) => q.type === ty && RG.at(q.x + q.w / 2, q.z + q.d / 2) === r.id)) continue;
      const free = r.cells.filter((k) => !G.obst[k]); if (free.length < 4) continue;
      const near = free.reduce((b, k) => { const x = (k % G.GX + 0.5) * G.cs, z = (((k / G.GX) | 0) + 0.5) * G.cs, d = Math.hypot(x - r.cx, z - r.cz); return d < b[1] ? [k, d] : b; }, [free[0], Infinity])[0];
      const a = { id: 'a' + r.id, type: ty, use: r.use, area: true, region: r, free, key: 'a:' + r.id, name: (MASS_USES[r.use] || INT_TYPES[r.use] || { label: r.use }).label + ' ' + Math.round(r.area) + ' m²', x: r.x0, z: r.z0, w: r.x1 - r.x0, d: r.z1 - r.z0, n: 0, doorPt: { x: (near % G.GX + 0.5) * G.cs, z: (((near / G.GX) | 0) + 0.5) * G.cs } };
      const ST = SITE_TYPES[ty];
      a.cap = ty === 'desks' || ty === 'home' ? Infinity : ST ? Math.max(1, Math.floor(r.area * (ST.perM2 || 0.2))) : Math.max(1, Math.floor(r.area * ((INT_TYPES[ty] || {}).perM2 || 1 / 3)));
      if (ty === 'toilets') a.cap = Math.max(2, Math.floor(r.area / 4));
      field(G, a.key, free); areas.push(a);
    }
    const ref = cellOf(G, c.doorPt.x, c.doorPt.z);
    for (const a of areas) a.reach = isFinite(G.F[a.key][ref]);   // an area with no door is drawn but left out
    S.unreached = areas.filter((a) => !a.reach).map((a) => a.name);
    rooms = S.rooms = rooms.concat(areas.filter((a) => a.reach));
    const bad = Object.keys(G.F).filter((k) => k[0] !== 'a' && !isFinite(G.F[k][ref]));
    if (bad.length) return { ok: false, bad };
    S.G = G; S.rho = new Float32Array(G.W * G.D); S.enc = new Float32Array(G.W * G.D);
    // people at desks
    const frac = S.people && S.people.length ? S.people.filter((p) => p.st !== 'away').length / S.people.length : 0.5;
    S.people = []; S.agents = []; S.queue = 0;
    // office areas without team zones, homes and hotel rooms: people at random spots in the area
    for (const a of rooms.filter((q) => q.area && (q.type === 'desks' || q.type === 'home'))) {
      const m2 = a.type === 'desks' ? 12 : a.use === 'hotel' ? 35 : 40, n = Math.max(1, Math.floor(a.region.area / m2)), rr = mulberry(a.region.id + 3);
      for (let k = 0; k < n; k++) { const cell = a.free[Math.floor(rr() * a.free.length)]; S.people.push({ id: S.people.length + 1, team: a, kind: a.type === 'home' ? a.use : null, desk: [(cell % G.GX + 0.5) * G.cs, (((cell / G.GX) | 0) + 0.5) * G.cs], st: a.type === 'home' ? (S.rng() < 0.6 ? 'desk' : 'away') : (S.rng() < frac ? 'desk' : 'away') }); }
    }
    for (const p of rooms.filter((q) => q.type === 'desks' && !q.area)) {
      const n = Math.max(2, Math.floor(p.w * p.d / 6)), cols = Math.max(1, Math.floor((p.w - 1) / 1.6)), rows = Math.ceil(n / cols);
      for (let k = 0; k < n; k++) { const ix = k % cols, iz = Math.floor(k / cols); S.people.push({ id: S.people.length + 1, team: p, desk: [p.x + 0.8 + (ix + 0.5) * (p.w - 1.6) / cols, p.z + 0.8 + (iz + 0.5) * (p.d - 1.6) / rows], st: S.rng() < frac ? 'desk' : 'away' }); }
    }
    // static access: walk metres from each team door to the nearest room of each type
    const types = ['pantry', 'toilets', 'meeting', 'print'];
    S.access = rooms.filter((p) => p.type === 'desks' && !p.area).map((t) => { const k = cellOf(G, t.doorPt.x, t.doorPt.z); const row = { t }; for (const ty of types) { let best = Infinity; for (const q of rooms) if (q.type === ty) best = Math.min(best, G.F[q.key][k]); row[ty] = best; } row.core = G.F.core[k]; return row; });
    return { ok: true };
  }
  function intNew(layout) { const S = { mode: 'int', L: layout || INT_DEFAULT(), rng: mulberry(9), t: 0, clock: 10.5, agents: [], log: [], pending: [], seq: 1, demand: 1, encSeen: new Map(), lastHour: 10, encT: 0 }; const r = intBuild(S); if (!r.ok) throw new Error('blocked'); return S; }
  function intReset(S, clock, present) { S.t = 0; S.clock = clock; S.lastHour = Math.floor(clock); S.agents = []; S.log = []; S.pending = []; S.rng = mulberry(9); S.encSeen = new Map(); S.encT = 0; S.rho.fill(0); S.enc.fill(0); for (const p of S.rooms) p.n = 0; const home = clock < 7.5 || clock > 19 ? 0.9 : clock < 9 || clock > 17.5 ? 0.6 : 0.35; for (const p of S.people) p.st = S.rng() < (p.kind ? home : present) ? 'desk' : 'away'; if (clock >= 9 && clock < 17.5 && Math.abs(clock - 12.5) > 0.6) scheduleMeetings(S, Math.floor(clock)); }
  function nearestOf(S, type, from) { const G = S.G, k = cellOf(G, from.x, from.z); const c = S.rooms.filter((q) => q.type === type); if (!c.length) return null; if (S.rng() < 0.2) return c[Math.floor(S.rng() * c.length)]; let best = c[0], bd = Infinity; for (const q of c) { const d = G.F[q.key][k]; if (d < bd) { bd = d; best = q; } } return best; }
  function personTrip(S, per, plan, purpose) { per.st = 'trip'; const d = per.team.doorPt; const a = mkAgent(S, d.x + (S.rng() - 0.5) * 1.2, d.z + (S.rng() - 0.5) * 0.4, plan, { person: per, purpose }); S.agents.push(a); }
  function intDemand(S, dt) {
    const c = S.clock, r = S.rng, P = S.rooms;
    const hArr = c < 11 ? npdf(c, 8.9, 0.35) / Math.max(0.05, 1 - ncdf(c, 8.9, 0.35)) : 0;
    const hLunch = hazard(c, 0.6, 12.3, 0.3), hEve = hazard(c, 0.95, 17.5, 0.5);
    const pantryF = 1 + 1.5 * bump(c, 10.5, 0.4) + 1.5 * bump(c, 15, 0.4) + 2 * bump(c, 12.6, 0.5);
    const rates = [['toilets', 0.6], ['pantry', 0.45 * pantryF], ['print', 0.12], ['focus', 0.08], ['colleague', 0.25]];
    const rTot = rates.reduce((s, x) => s + x[1], 0);
    const hOutR = hazard(c, 0.7, 8.1, 0.7), hInR = c > 15 ? npdf(c, 18.6, 1.1) * 0.9 : 0, hOutH = hazard(c, 0.6, 9.8, 0.9), hInH = c > 15 ? npdf(c, 18.8, 1.3) * 0.8 : 0;
    for (const per of S.people) {
      if (per.kind) {   // residents and hotel guests: out in the morning, back in the evening, through the lifts
        const out = per.kind === 'hotel' ? hOutH : hOutR, back = per.kind === 'hotel' ? hInH : hInR;
        if (per.st === 'away') { if (back && r() < back / 3600 * dt) { per.st = 'trip'; const d = S.L.core.doorPt; S.agents.push(mkAgent(S, d.x + (r() - 0.5) * 2, d.z, [{ f: per.team.key, kind: 'home' }], { person: per, purpose: 'home' })); } }
        else if (per.st === 'desk' && r() < (out + 0.04) / 3600 * dt) personTrip(S, per, [{ f: 'core', kind: 'leave' }], 'home');
        continue;
      }
      if (per.st === 'away') { if (hArr && r() < hArr / 3600 * dt) { per.st = 'trip'; const d = S.L.core.doorPt; S.agents.push(mkAgent(S, d.x + (r() - 0.5) * 2, d.z, [{ f: per.team.key, kind: 'home' }], { person: per, purpose: 'arrive' })); } continue; }
      if (per.st !== 'desk') continue;
      if (r() < (hLunch + hEve) / 3600 * dt) { personTrip(S, per, [{ f: 'core', kind: 'leave', back: c < 15 }], 'leave'); continue; }
      if (r() < rTot / 3600 * dt * S.demand) {
        let x = r() * rTot, ty = 'toilets'; for (const [k, v] of rates) { x -= v; if (x <= 0) { ty = k; break; } }
        if (ty === 'colleague') { const others = P.filter((q) => q.type === 'desks' && q !== per.team && !q.area); if (!others.length) continue; const q = others[Math.floor(r() * others.length)]; personTrip(S, per, [{ f: q.key, kind: 'visit', p: q, dwell: 180 + r() * 420 }, { f: per.team.key, kind: 'home' }], 'colleague'); continue; }
        const q = nearestOf(S, ty, per.team.doorPt); if (!q) continue;
        const T = INT_TYPES[ty]; personTrip(S, per, [{ f: q.key, kind: 'visit', p: q, dwell: T.dwell[0] + r() * (T.dwell[1] - T.dwell[0]) }, { f: per.team.key, kind: 'home' }], ty);
      }
    }
    for (const a of S.rooms) {   // visitors come up by lift to the shops, food and civic areas, linger, and leave
      if (!a.area || !SITE_TYPES[a.type] || a.type === 'home') continue;
      const T = SITE_TYPES[a.type], occ = a.type === 'food' ? 0.1 + 0.6 * bump(c, 12.6, 0.8) + 0.3 * bump(c, 19, 1) : a.type === 'retail' ? 0.15 + 0.35 * bump(c, 12.5, 1.2) + 0.3 * bump(c, 17.5, 1) : 0.1 + 0.3 * bump(c, 14, 2);
      const dwell = (T.dwell[0] + T.dwell[1]) / 2, perHr = a.cap * occ / (dwell / 3600) * 0.5;
      if (r() < perHr / 3600 * dt * S.demand) { const d = S.L.core.doorPt; S.agents.push(mkAgent(S, d.x + (r() - 0.5) * 2, d.z, [{ f: a.key, kind: 'visit', p: a, dwell: T.dwell[0] + r() * (T.dwell[1] - T.dwell[0]) }, { f: 'core', kind: 'exit' }], { person: null, purpose: 'visit' })); }
    }
    const h = Math.floor(c);
    if (h > S.lastHour) { S.lastHour = h; if (h >= 9 && h <= 17 && h !== 12) scheduleMeetings(S, h); }
    for (let k = S.pending.length - 1; k >= 0; k--) if (S.pending[k].t <= S.t) { const per = S.pending[k].per; per.st = 'trip'; const d = S.L.core.doorPt; S.agents.push(mkAgent(S, d.x, d.z, [{ f: per.team.key, kind: 'home' }], { person: per, purpose: 'arrive' })); S.pending.splice(k, 1); }
  }
  function scheduleMeetings(S, h) {
    const r = S.rng;
    for (const room of S.rooms.filter((q) => q.type === 'meeting')) {
      if (r() > 0.65) continue;
      const size = Math.min(room.cap, 3 + Math.floor(r() * 6)), dur = r() < 0.5 ? 1800 : 3600, end = S.t + dur;
      const free = S.people.filter((p) => p.st === 'desk' && !p.kind); if (free.length < 2) continue;
      const host = free[Math.floor(r() * free.length)];
      const pool = free.filter((p) => p !== host).sort(() => r() - 0.5).sort((a, b) => (b.team === host.team && r() < 0.6 ? 1 : 0) - (a.team === host.team && r() < 0.6 ? 1 : 0));
      for (const per of [host, ...pool.slice(0, size - 1)]) personTrip(S, per, [{ f: room.key, kind: 'meet', p: room, end }, { f: per.team.key, kind: 'home' }], 'meeting');
    }
  }
  function intDecide(S, a) {
    const G = S.G, L = a.plan[a.li], done = (st) => { a.dead = true; if (a.person) a.person.st = st; return null; }; if (!L) return done('desk');
    if (a.spot) { const dx = a.spot.x - a.x, dz = a.spot.z - a.z, d = Math.hypot(dx, dz); if (d < 0.4) { a.st = 'stay'; a.until = S.t + L.dwell; return null; } return [dx / d, dz / d]; }
    const Fd = G.F[L.f]; if (!Fd) return done('desk');
    const [g1, g2, val] = grad(G, Fd, a.x, a.z);
    if (!isFinite(val)) return done('desk');
    if (val < 0.3 && L.kind === 'visit' && L.p && L.p.area) {   // inside a shop, venue or walled room: pick a spot in it and linger there
      const p = L.p; log(S, { k: 'leg', ty: p.type, dist: a.legDist, d: p.key }); a.legDist = 0;
      if (p.n >= p.cap) { nextLeg(S, a); return null; }
      p.n++; a.at = p; const k = p.free[Math.floor(S.rng() * p.free.length)]; a.spot = { x: (k % G.GX + 0.5) * G.cs, z: (((k / G.GX) | 0) + 0.5) * G.cs }; return null;
    }
    if (val < 0.8) {
      if (L.kind === 'exit') { a.dead = true; return null; }
      if (L.kind === 'visit' && L.p && L.p.area) { const m = Math.hypot(g1, g2) || 1; return [-g1 / m, -g2 / m]; }
      if (L.kind === 'home') { log(S, { k: 'leg', ty: 'return', dist: a.legDist }); return done('desk'); }
      if (L.kind === 'leave') { a.dead = true; if (a.person) { a.person.st = 'away'; if (L.back) S.pending.push({ t: S.t + 2400 + S.rng() * 1500, per: a.person }); } return null; }
      const p = L.p;
      log(S, { k: 'leg', ty: L.kind === 'meet' ? 'meeting' : (p.type === 'desks' ? 'colleague' : p.type), dist: a.legDist, d: p.key });
      a.legDist = 0;
      if (L.kind === 'meet') { if (S.t >= L.end) { nextLeg(S, a); return null; } p.n++; a.at = p; a.st = 'in'; a.until = L.end; return null; }
      if (p.n >= p.cap) { a.st = 'queue'; a.qT = S.t; a.qP = p; return null; }
      p.n++; a.at = p; a.st = 'in'; a.until = S.t + L.dwell; return null;
    }
    const m = Math.hypot(g1, g2) || 1; return [-g1 / m, -g2 / m];
  }
  function intQueues(S) {
    let q = 0;
    for (const a of S.agents) {
      if (a.st !== 'queue') continue;
      const p = a.qP, L = a.plan[a.li];
      if (p.n < p.cap) { log(S, { k: 'wait', ty: p.type, w: S.t - a.qT }); p.n++; a.at = p; a.st = 'in'; a.until = S.t + L.dwell; }
      else if (S.t - a.qT > 300 && p.type !== 'toilets') { log(S, { k: 'wait', ty: p.type, w: S.t - a.qT, gaveUp: true }); a.st = 'walk'; nextLeg(S, a); }
      else q++;
    }
    S.queue = q;
  }
  function encounters(S) {
    if (S.t < S.encT) return; S.encT = S.t + 1;
    const G = S.G;
    for (const a of S.agents) {
      if (a.st !== 'walk' && a.st !== 'queue') continue;
      S.near(a, 1, (b) => {
        if (b.id <= a.id || (b.st !== 'walk' && b.st !== 'queue') || !a.person || !b.person) return;
        if (Math.hypot(a.x - b.x, a.z - b.z) > 1.5) return;
        const key = a.person.id * 4096 + b.person.id, last = S.encSeen.get(key);
        if (last !== undefined && S.t - last < 120) return;
        S.encSeen.set(key, S.t);
        log(S, { k: 'enc', cross: a.person.team !== b.person.team });
        const cx = Math.floor((a.x + b.x) / 2), cz = Math.floor((a.z + b.z) / 2); S.enc[cz * G.W + cx] += 1;
      });
    }
    for (let c = 0; c < S.enc.length; c++) S.enc[c] *= 0.999;
  }
  function intStep(S, dt) { intDemand(S, dt); releaseStays(S); intQueues(S); move(S, dt, (a) => intDecide(S, a)); encounters(S); S.t += dt; S.clock += dt / 3600; if ((S.t % 30) < dt) prune(S); }
  function intMetrics(S) {
    prune(S);
    const lg = S.log, G = S.G;
    let legs = 0, dist = 0, enc = 0, cross = 0, wT = 0, wN = 0, wTo = 0, wToN = 0; const byT = {};
    for (const e of lg) {
      if (e.k === 'leg' && e.ty !== 'return') { legs++; dist += e.dist; const b = byT[e.d] || (byT[e.d] = { n: 0, dist: 0 }); b.n++; b.dist += e.dist; }
      if (e.k === 'enc') { enc++; if (e.cross) cross++; }
      if (e.k === 'wait') { wT += e.w; wN++; if (e.ty === 'toilets') { wTo += e.w; wToN++; } }
    }
    let tot = 0, dd = 0; for (let c = 0; c < G.W * G.D; c++) { if (G.free1m[c] < 0.2) continue; tot++; if (S.rho[c] > 0.71) dd++; }
    const present = S.people.filter((p) => p.st !== 'away').length;
    const rooms = S.rooms.filter((p) => p.type !== 'desks').map((p) => { const b = byT[p.key] || { n: 0, dist: 0 }; const q = S.agents.filter((a) => a.st === 'queue' && a.qP === p).length; return { p, uses: perHour(S, b.n), walk: b.n ? b.dist / b.n : 0, occ: p.n, cap: p.cap, queue: q }; });
    return { trips: perHour(S, legs), walk: legs ? dist / legs : 0, enc: perHour(S, enc), cross: enc ? cross / enc : 0, wait: wN ? wT / wN : 0, toiletWait: wToN ? wTo / wToN : 0, d: tot ? dd / tot : 0, present, people: S.people.length, rooms, queue: S.queue };
  }

  // site presets: the demo site, and sites imported from a base model (window.PFL_SITES, see site-vancouver.js)
  const SITE_PRESETS = { demo: SITE_DEFAULT, vancouver: () => JSON.parse(JSON.stringify((root.PFL_SITES || {}).vancouver || SITE_DEFAULT())) };
  root.PFL = { SITE_PRESETS, platePolys, useAt, setUseRange, regionsOf, levelLayout, levelAreas, levelHas, useAreas, coreOf, bandsOf, officeFloors, dominantUse, massPop, destBands, autoFloor, ensureFloor, floorLayout, massPeople, deskPeople, plateMask, massPolys, massArea, inMass, fitBox, doorOfMass, inPoly, SHAPE_TYPES, shapePolys, shapeBox, shapeArea, ringArea, offsetLine, designMetrics, routeMasses, massTop, MASS_USES, SOLID_BELOW, FACADE_T, SEAT, INERT, WALK, ENCLOSED, siteNew, siteReset, siteBuild, siteStep, siteMetrics, intNew, intReset, intBuild, intStep, intMetrics, SITE_TYPES, INT_TYPES, SITE_DEFAULT, INT_DEFAULT, losBySpace, overlap, doorOf };
})(typeof window !== 'undefined' ? window : globalThis);
