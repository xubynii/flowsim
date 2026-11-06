// Scripted check that Push / pull works on any surface: a ground use (sides and height), a surface's edge in plan and 3D and its height, a wall in the interior, and that clicking a mass in 3D selects the whole mass with a storey stepper at its top: node surf_test.mjs [screenshot dir]
import { chromium } from 'file:///C:/Users/sinnie/OneDrive/Desktop/tower-design-toolkit/node_modules/playwright/index.mjs';
const SP = process.argv[2] || './';
const browser = await chromium.launch({ executablePath: 'C:/Users/sinnie/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push('pageerror ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
await page.goto('file:///C:/Users/sinnie/OneDrive/Desktop/ped-flow-guide/index.html');
await page.waitForFunction(() => window.PFL_APP, null, { timeout: 30000 }); await page.waitForTimeout(800);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(150); };
const scr = (x, y, z) => page.evaluate(([x, y, z]) => { const A = window.PFL_APP, p = A.st.panes[0], v = new THREE.Vector3(x, y, -z).project(A.camera), r = document.querySelector('#view canvas').getBoundingClientRect(); return [r.left + p.x + (v.x + 1) / 2 * p.w, r.top + p.y + (1 - v.y) / 2 * p.h]; }, [x, y, z]);
const hover = async (x, y, z) => { const c = await scr(x, y, z); await page.mouse.move(c[0], c[1]); await page.waitForTimeout(120); return c; };
const clickAt = async (x, y, z) => { const c = await hover(x, y, z); await page.mouse.click(c[0], c[1]); await page.waitForTimeout(200); };
const S = () => page.evaluate(() => { const A = window.PFL_APP, L = A.sims.site.L, shop = L.programs.find((p) => p.name === 'Shop'), pb = (L.shapes || [])[0]; return { tool: A.st.tool, face: A.st.pullFace, hint: document.getElementById('hint').textContent, toast: document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent, dim: document.getElementById('dimbox').hidden ? null : document.getElementById('dimval').textContent, shop: { x: shop.x, z: shop.z, w: shop.w, d: shop.d, h: shop.h }, pb: { pts: pb.pts.map((p) => p.slice()), h: pb.h, area: window.PFL.shapeArea(pb) }, sel: A.st.sel && A.st.sel.name, selFloors: A.st.selFloors, floors: L.masses[0].floors, chip: document.getElementById('storeychip').hidden ? null : document.getElementById('scn').textContent }; });
const fit = async () => { await page.click('#panechrome [data-bb="fit"]'); await page.waitForTimeout(500); await page.mouse.move(700, 500); await page.mouse.wheel(0, 250); await page.waitForTimeout(400); };

await page.click('#m-mass'); await page.waitForTimeout(300); await key('1'); await page.waitForTimeout(300); await fit();
let s = await S(); const sh = s.shop, H = 4.5;
// ---- a ground use: a side, then its height
await key('p'); s = await S(); ok(/mass, ground use or surface/.test(s.hint), 'the hint says any mass, ground use or surface can be pulled: ' + s.hint);
const sides = { E: [sh.x + sh.w, H / 2, sh.z + sh.d / 2], W: [sh.x, H / 2, sh.z + sh.d / 2], N: [sh.x + sh.w / 2, H / 2, sh.z + sh.d], S: [sh.x + sh.w / 2, H / 2, sh.z] }; const seen = {};
for (const [sd, c] of Object.entries(sides)) { await hover(...c); const r = await S(); seen[sd] = r.face && r.face.id === 'p4' ? r.face.side : null; }
const vis = Object.entries(seen).filter(([k, v]) => v === k).map(([k]) => k); console.log('shop faces seen:', JSON.stringify(seen));
ok(vis.length >= 1, 'hovering a side of the Shop lights that side: ' + vis.join(', '));
const sd = vis[0]; await clickAt(...sides[sd]); s = await S(); ok(/Move the (east|west|north|south) face/.test(s.hint) && s.dim === '0.00', 'clicking it picks the face up, the dimension box reads 0.00: ' + s.hint);
await page.screenshot({ path: SP + 'u-shop-side.png' });
await key('3'); await key('Enter'); await page.waitForTimeout(300); s = await S();
ok((sd === 'E' || sd === 'W' ? s.shop.w === sh.w + 3 && s.shop.d === sh.d : s.shop.d === sh.d + 3 && s.shop.w === sh.w), `typing 3, Enter moves the Shop's ${sd} face 3 m out: ${sh.w}×${sh.d} → ${s.shop.w}×${s.shop.d} · ${s.toast}`);
await key('Control+z'); s = await S(); ok(s.shop.w === sh.w && s.shop.d === sh.d, 'Ctrl+Z puts it back');
await hover(sh.x + sh.w / 2, H, sh.z + sh.d / 2); s = await S(); ok(s.face && s.face.id === 'p4' && s.face.side === 'top', 'hovering the roof of the Shop lights its top');
await clickAt(sh.x + sh.w / 2, H, sh.z + sh.d / 2); s = await S(); ok(/set the height/.test(s.hint), 'clicking it picks the top up: ' + s.hint);
await key('8'); await key('Enter'); await page.waitForTimeout(300); s = await S(); ok(s.shop.h === 8, `typing 8, Enter makes the Shop 8 m high: h = ${s.shop.h} · ${s.toast}`);
await key('Control+z'); s = await S(); ok(s.shop.h === undefined || s.shop.h === null, 'Ctrl+Z gives it its usual height back');
// ---- a surface (planting bed): an edge in plan, then in 3D, then its height
const pb = s.pb, pts = pb.pts, e0 = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
await key('2'); await page.waitForTimeout(300); await key('p'); await hover(e0[0], 0, e0[1]); s = await S();
ok(s.face && s.face.id === 's1' && s.face.side === 'edge' && s.face.i === 0, 'in plan, hovering the first edge of the planting bed lights that edge: ' + JSON.stringify(s.face));
await page.screenshot({ path: SP + 'u-bed-plan.png' });
await clickAt(e0[0], 0, e0[1]); s = await S(); ok(/Move the edge in or out/.test(s.hint), 'clicking it picks the edge up: ' + s.hint);
await key('2'); await key('Enter'); await page.waitForTimeout(300); s = await S();
ok(s.pb.area > pb.area + 1 && s.pb.pts.filter((p, i) => p[0] !== pts[i][0] || p[1] !== pts[i][1]).length === 2, `typing 2, Enter moves that edge 2 m out, the two corners on it move: ${Math.round(pb.area)} → ${Math.round(s.pb.area)} m² · ${s.toast}`);
await key('Control+z'); s = await S(); ok(Math.abs(s.pb.area - pb.area) < 0.01, 'Ctrl+Z puts it back');
await key('1'); await page.waitForTimeout(300); await fit(); await key('p');
const ring = pts, nE = ring.length; let got = null;
for (let i = 0; i < nE && !got; i++) { const a = ring[i], b = ring[(i + 1) % nE]; await hover((a[0] + b[0]) / 2, 0.3, (a[1] + b[1]) / 2); const r = await S(); if (r.face && r.face.id === 's1' && r.face.side === 'edge') got = { i, r: r.face.i }; }
ok(got && got.i === got.r, 'in 3D, hovering a side of the planting bed lights that edge: ' + JSON.stringify(got));
if (got) { const a = ring[got.i], b = ring[(got.i + 1) % nE]; await clickAt((a[0] + b[0]) / 2, 0.3, (a[1] + b[1]) / 2); await key('-'); await key('1'); await key('Enter'); await page.waitForTimeout(300); s = await S(); ok(s.pb.area < pb.area - 1, `typing -1 pushes it 1 m in: ${Math.round(pb.area)} → ${Math.round(s.pb.area)} m²`); await key('Control+z'); }
const c = ring.reduce((q, p) => [q[0] + p[0] / nE, q[1] + p[1] / nE], [0, 0]);
await hover(c[0], 0.6, c[1]); s = await S(); ok(s.face && s.face.id === 's1' && s.face.side === 'top', 'hovering the top of the bed lights its top: ' + JSON.stringify(s.face));
await clickAt(c[0], 0.6, c[1]); await key('1'); await key('.'); await key('5'); await key('Enter'); await page.waitForTimeout(300); s = await S(); ok(s.pb.h === 1.5, `typing 1.5, Enter makes the bed 1.5 m high: h = ${s.pb.h}`);
await page.screenshot({ path: SP + 'u-bed-3d.png' }); await key('Control+z');
await key('Escape');
// ---- the mass in 3D: a click selects the whole mass, never a floor; the stepper at its top adds and takes away storeys
const t = await page.evaluate(() => { const m = window.PFL_APP.sims.site.L.masses[0]; return { x: m.x, z: m.z, w: m.w, d: m.d, floors: m.floors, ftf: m.ftf, base: m.base }; });
await clickAt(t.x + t.w / 2, t.base + 2.5 * t.ftf, t.z); s = await S(); ok(s.sel === 'Tower' && !s.selFloors, 'clicking the tower selects it: ' + s.sel);
await clickAt(t.x + t.w / 2, t.base + 2.5 * t.ftf, t.z); s = await S(); ok(s.sel === 'Tower' && !s.selFloors, 'a second click on a floor does not pick that floor any more');
ok(s.chip === String(t.floors), 'a storey stepper floats at the top of the mass and reads its storeys: ' + s.chip);
await page.screenshot({ path: SP + 'u-chip.png' });
await page.click('#storeychip [data-fl="1"]'); await page.waitForTimeout(400); s = await S(); ok(s.floors === t.floors + 1 && s.chip === String(t.floors + 1) && s.sel === 'Tower', `+ adds a storey and the tower stays selected: ${t.floors} → ${s.floors}`);
await page.click('#storeychip [data-fl="-1"]'); await page.waitForTimeout(400); await page.click('#storeychip [data-fl="-1"]'); await page.waitForTimeout(400); s = await S(); ok(s.floors === t.floors - 1, `− takes one away: ${s.floors}`);
await key('Control+z'); await key('Control+z'); await key('Control+z'); s = await S(); ok(s.floors === t.floors, 'Ctrl+Z ×3 restores the count');
await key('Escape'); await key('Escape'); s = await S(); ok(s.chip === null, 'with nothing selected the stepper is gone (the first Esc drops the selected face, the second the mass)');
// ---- the interior: a wall is pulled sideways
await page.click('#m-int'); await page.waitForTimeout(800);
const P = await page.evaluate(() => { const L = window.PFL_APP.sims.int.L; return { W: L.W, D: L.D }; });
await key('w'); await clickAt(0.3, 0, 3); await clickAt(P.W - 0.3, 0, 3); await key('Enter'); await page.waitForTimeout(400);
let w = await page.evaluate(() => (window.PFL_APP.sims.int.L.walls || []).map((x) => [x.a.slice(), x.b.slice()]));
ok(w.length === 1 && w[0][0][1] === 3, 'a wall drawn across the plate at z = 3: ' + JSON.stringify(w));
await key('p'); s = await S(); ok(/wall or a piece/.test(s.hint) && s.tool === 'pull', 'Push / pull is a tool in the interior too: ' + s.hint);
await hover(P.W / 2, 0, 3); s = await S(); ok(s.face && s.face.side === 'edge', 'hovering the wall lights it: ' + JSON.stringify(s.face));
await clickAt(P.W / 2, 0, 3); s = await S(); ok(/Move the wall in or out/.test(s.hint), 'clicking it picks the wall up: ' + s.hint);
await key('2'); await key('Enter'); await page.waitForTimeout(400); w = await page.evaluate(() => (window.PFL_APP.sims.int.L.walls || []).map((x) => [x.a.slice(), x.b.slice()]));
ok(w.length === 1 && Math.abs(Math.abs(w[0][0][1] - 3) - 2) < 1e-6 && w[0][0][1] === w[0][1][1], 'typing 2, Enter moves the whole wall 2 m sideways: ' + JSON.stringify(w));
await page.screenshot({ path: SP + 'u-wall.png' });
await key('Control+z'); w = await page.evaluate(() => (window.PFL_APP.sims.int.L.walls || []).map((x) => x.a[1])); ok(w[0] === 3, 'Ctrl+Z puts it back');
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
