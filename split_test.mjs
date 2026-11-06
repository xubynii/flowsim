// Scripted check of the Split tool (X): a line across a mass in plan makes two masses side by side; a click at a height in elevation makes a lower and an upper mass: node split_test.mjs [screenshot dir]
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
const click = async (x, z, y = 0) => { const c = await scr(x, y, z); await page.mouse.move(c[0], c[1]); await page.waitForTimeout(80); await page.mouse.click(c[0], c[1]); await page.waitForTimeout(200); };
const M = () => page.evaluate(() => window.PFL_APP.sims.site.L.masses.map((m) => ({ id: m.id, name: m.name, part: m.part, x: m.x, z: m.z, w: m.w, d: m.d, fp: !!m.fp, base: m.base, floors: m.floors, bands: window.PFL.bandsOf(m).map((b) => b.use + b.floors).join(','), area: Math.round(window.PFL.massArea ? window.PFL.massArea(m) : m.w * m.d) })));
const S = () => page.evaluate(() => ({ tool: window.PFL_APP.st.tool, act: window.PFL_APP.st.act && window.PFL_APP.st.act.kind, sel: (window.PFL_APP.st.multi.length ? window.PFL_APP.st.multi : window.PFL_APP.st.sel ? [window.PFL_APP.st.sel] : []).map((o) => o.name), hint: document.getElementById('hint').textContent, toast: document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent }));

await page.click('#m-mass'); await page.waitForTimeout(300);
const tips = await page.evaluate(() => [...document.querySelectorAll('#tools [data-tool]')].map((b) => b.dataset.tool + ':' + b.dataset.tip));
ok(tips.length === 14 && tips.includes('split:Split · X') && tips.indexOf('split:Split · X') === tips.indexOf('pull:Push / pull · P') + 1, 'the site toolbar has Split · X right after Push / pull: ' + tips.join(', '));
let m0 = await M(); const t = m0[0]; ok(t && !t.fp && t.floors === 17, `the tower is a plain box of ${t.floors} floors (${t.w} × ${t.d} m) at (${t.x}, ${t.z})`);

// 1. plan: a vertical cut straight across → two boxes
await key('2'); await key('x'); let s = await S(); ok(s.tool === 'split' && /Split/.test(s.hint) && /cut starts/.test(s.hint), 'X picks Split and the hint says to click a mass: ' + s.hint);
const cx = +(t.x + Math.round(t.w / 2)).toFixed(1);
await click(cx, t.z - 2); s = await S(); ok(!s.act && /Click a mass/.test(s.toast), 'a click beside the mass does nothing but say so: ' + s.toast);
await click(cx, t.z + 1); s = await S(); ok(s.act === 'split' && /other end/.test(s.hint), 'the first click on the mass starts the cut: ' + s.hint);
await page.screenshot({ path: SP + 'x-plan-start.png' });
const mv = await scr(cx, 0, t.z + t.d - 1); await page.mouse.move(mv[0], mv[1]); await page.waitForTimeout(150); await page.screenshot({ path: SP + 'x-plan-line.png' });
await click(cx, t.z + t.d - 1); await page.waitForTimeout(300);
let m1 = await M(); s = await S();
ok(m1.length === m0.length + 1 && !s.act && s.tool === 'split', 'the second click cuts: one more mass, Split stays active: ' + s.toast);
const other = (list) => list.find((m) => m.part === t.id && m.id !== t.id);
const [L1, R1] = [m1.find((m) => m.id === t.id), other(m1)];
ok(L1 && R1 && !L1.fp && !R1.fp && Math.abs(L1.w + R1.w - t.w) < 0.01 && L1.d === t.d && R1.d === t.d && (L1.x + L1.w === R1.x || R1.x + R1.w === L1.x), `a straight cut leaves two plain boxes: ${L1.w} m + ${R1.w} m wide, both ${t.d} m deep`);
ok(L1.floors === 17 && R1.floors === 17 && L1.bands === t.bands && R1.bands === t.bands, 'both halves keep the floors and the use bands: ' + L1.bands);
ok(s.sel.length === 0, 'after the cut nothing stays selected (no boxes or labels in the way): ' + s.sel.join(' + '));
ok(L1.name === R1.name && L1.part === t.id && R1.part === t.id, 'both parts carry the same name and part id: it still reads as one mass');
const lbls = await page.evaluate(() => { const out = []; window.PFL_APP.world.traverse((o) => { if (o.isSprite && o.userData.kind === 'label') out.push(o.userData.text); }); return out; });
ok(lbls.filter((x) => /Tower/.test(x)).length === 1 && lbls.some((x) => /Tower/.test(x) && new RegExp(String(Math.round(t.area))).test(x)), 'one plan label for the whole mass, with the whole footprint: ' + lbls.filter((x) => /Tower/.test(x)).join(' | '));
await key('Escape'); await key('v'); await click(cx - 5, t.z + t.d / 2); s = await S();
ok(s.sel.length === 1, 'clicking one part selects it: ' + s.sel.join(' + '));
await page.click('#mfp'); await page.waitForTimeout(300); m1 = await M();
ok(m1.find((m) => m.id === t.id).floors === 18 && other(m1).floors === 18, 'one storey more on the panel: both parts rise together: ' + m1.filter((m) => m.part === t.id).map((m) => m.floors).join(' + '));
await key('Control+z');
await page.click('#m-mass'); await page.waitForTimeout(200); await key('1'); await page.waitForTimeout(400); await key('p');
const r1 = m1.find((m) => m.id !== t.id && m.part === t.id), topR = await page.evaluate((id) => window.PFL.massTop(window.PFL_APP.sims.site.L.masses.find((m) => m.id === id)), r1.id);
const cR = await scr(r1.x + r1.w / 2, topR, r1.z + r1.d / 2); await page.mouse.move(cR[0], cR[1]); await page.waitForTimeout(100); await page.mouse.click(cR[0], cR[1]); await page.waitForTimeout(200); const hR = await page.evaluate((id) => { const m = window.PFL_APP.sims.site.L.masses.find((q) => q.id === id); return String(+(m.base + 19 * m.ftf).toFixed(1)); }, r1.id); await page.keyboard.type(hR); await key('Enter'); await page.waitForTimeout(300);
m1 = await M(); ok(other(m1).floors === 17 + 2 && m1.find((m) => m.id === t.id).floors === 17, 'pulling the top of one part two storeys up lifts that part only: ' + m1.filter((m) => m.part === t.id).map((m) => m.floors).join(' + '));
await page.screenshot({ path: SP + 'x-parts-3d.png' });
await key('Escape'); await key('Control+z'); await key('2'); await page.waitForTimeout(300);
await page.screenshot({ path: SP + 'x-plan-cut.png' });
await key('Control+z'); m1 = await M(); ok(m1.length === m0.length && m1[0].w === t.w, 'Ctrl+Z joins them again');

// 1b. the cut snaps to the surface: a click near the middle of the south edge lands on it, a click near a corner lands on the corner
await key('x'); await click(t.x + t.w / 2 + 0.3, t.z + 0.4); let a = await page.evaluate(() => { const q = window.PFL_APP.st.act.a; return [q[0], q[1], q.on]; });
ok(a[0] === t.x + t.w / 2 && a[1] === t.z && a[2] === 'mid', 'a click near the middle of the south edge snaps to it: ' + JSON.stringify(a));
const mv2 = await scr(t.x + t.w - 0.5, 0, t.z + t.d - 0.4); await page.mouse.move(mv2[0], mv2[1]); await page.waitForTimeout(150);
let b = await page.evaluate(() => { const q = window.PFL_APP.st.act.b; return [q[0], q[1], q.on]; }); ok(b[0] === t.x + t.w && b[1] === t.z + t.d && b[2] === 'corner', 'the moving end snaps to the north-east corner: ' + JSON.stringify(b));
const mv3 = await scr(t.x + 5.2, 0, t.z + t.d - 0.3); await page.mouse.move(mv3[0], mv3[1]); await page.waitForTimeout(150);
b = await page.evaluate(() => { const q = window.PFL_APP.st.act.b; return [q[0], q[1], q.on]; }); ok(Math.abs(b[0] - (t.x + 5.2)) < 0.3 && b[1] === t.z + t.d && b[2] === 'edge', 'elsewhere it lands on the nearest point of the edge: ' + JSON.stringify(b));
await page.screenshot({ path: SP + 'x-plan-snap.png' });
await key('Escape'); await key('1'); await page.waitForTimeout(400); await key('x');
// in 3D the pointer is taken on the top of the mass, so a click on the roof edge works
const top = await page.evaluate(() => window.PFL.massTop(window.PFL_APP.sims.site.L.masses[0]));
const c3 = await scr(t.x + t.w / 2 + 0.2, top, t.z + 0.3); await page.mouse.move(c3[0], c3[1]); await page.mouse.click(c3[0], c3[1]); await page.waitForTimeout(200);
a = await page.evaluate(() => { const q = window.PFL_APP.st.act && window.PFL_APP.st.act.a; return q && [q[0], q[1], q.on]; }); ok(a && a[1] === t.z && a[2] === 'mid', 'in 3D a click on the roof edge snaps to it: ' + JSON.stringify(a));
await page.screenshot({ path: SP + 'x-3d-snap.png' });
await key('Escape'); await key('2'); await page.waitForTimeout(300);
// 2. plan: a diagonal cut → two drawn footprints
await key('x'); await click(t.x + 1, t.z + 1); await click(t.x + t.w - 1, t.z + t.d - 1); await page.waitForTimeout(300);
m1 = await M(); const A2 = m1.find((m) => m.id === t.id), B2 = other(m1);
ok(m1.length === m0.length + 1 && A2.fp && B2.fp && Math.abs(A2.area + B2.area - t.area) < 2, `a diagonal cut makes two footprints: ${A2.area} + ${B2.area} ≈ ${t.area} m²`);
await page.screenshot({ path: SP + 'x-plan-diag.png' });
await key('Control+z'); m1 = await M(); ok(m1.length === m0.length && !m1[0].fp, 'Ctrl+Z gives the box back');
// a second cut of a piece gets the next letter, not another 'Tower B'
await key('x'); await click(t.x + 10, t.z + 3); await click(t.x + 10, t.z + t.d - 3); await page.waitForTimeout(250); await click(t.x + 20, t.z + 3); await click(t.x + 20, t.z + t.d - 3); await page.waitForTimeout(250);
m1 = await M(); ok(m1.length === m0.length + 2 && m1.filter((m) => m.part === t.id).length === 3 && m1.filter((m) => m.name === 'Tower').length === 3, 'two cuts give three parts of the one Tower: ' + m1.map((m) => m.name + (m.part ? '*' : '')).join(', '));
await page.screenshot({ path: SP + 'x-after-cuts.png' });
await key('Control+z'); await key('Control+z'); m1 = await M(); ok(m1.length === m0.length, 'two undos rejoin them');

// 3. a short line still cuts: it is extended right across the mass; Esc mid-cut cancels
await key('x'); await click(t.x + 3, t.z + 3); await click(t.x + 5, t.z + 3); await page.waitForTimeout(200); s = await S(); m1 = await M();
ok(m1.length === m0.length + 1 && m1.some((m) => m.d === 3) && m1.some((m) => m.d === t.d - 3), 'a short E–W line inside the mass is extended across it: a 3 m strip and the rest: ' + s.toast);
await key('Control+z'); await key('x'); await click(t.x + 1, t.z + 1); s = await S(); ok(s.act === 'split', 'a cut is started');
await key('Escape'); s = await S(); ok(!s.act && s.tool === 'select' && (await M()).length === m0.length, 'Esc leaves the cut, nothing changes, back to Select');

// 4. elevation: a click at a height splits at a floor line
await key('4'); await page.waitForTimeout(400); await key('x');
const yk = t.base + 5 * (await page.evaluate(() => window.PFL_APP.sims.site.L.masses[0].ftf));
const e1 = await page.evaluate(([x, y, z]) => { const A = window.PFL_APP, p = A.st.panes[0], v = new THREE.Vector3(x, y, -z).project(A.camera), r = document.querySelector('#view canvas').getBoundingClientRect(); return [r.left + p.x + (v.x + 1) / 2 * p.w, r.top + p.y + (1 - v.y) / 2 * p.h]; }, [t.x + t.w / 2, yk + 0.3, t.z + t.d / 2]);
await page.mouse.move(e1[0], e1[1]); await page.waitForTimeout(100); await page.mouse.click(e1[0], e1[1]); await page.waitForTimeout(250);
s = await S(); ok(s.act === 'split' && /Split at floor 5/.test(s.hint), 'clicking the tower at level 5 in elevation proposes a split there: ' + s.hint);
await page.screenshot({ path: SP + 'x-elev-propose.png' });
await key('8'); s = await S(); ok(/Split at floor 8/.test(s.hint), 'typing 8 moves the cut to floor 8: ' + s.hint);
await key('Enter'); await page.waitForTimeout(300); m1 = await M(); s = await S();
const low = m1.find((m) => m.id === t.id), hi = m1.find((m) => m.name === t.name + ' upper');
ok(m1.length === m0.length + 1 && low && hi && low.floors === 8 && hi.floors === 9 && Math.abs(hi.base - (t.base + 8 * 4)) < 0.6 && hi.w === t.w, `the tower is a podium of ${low && low.floors} floors with ${hi && hi.floors} floors on top, from ${hi && hi.base} m`);
ok(low.bands === 'restaurant1,office7' && hi.bands === 'office9', `the use bands are shared out: ${low.bands} | ${hi.bands}`);
ok(s.sel.length === 0, 'after the cut nothing stays selected: ' + s.sel.join());
await page.screenshot({ path: SP + 'x-elev-cut.png' });
await key('1'); await page.waitForTimeout(400); await page.screenshot({ path: SP + 'x-3d.png' });
// the upper mass pulls up on its own; the podium stays
await key('Control+z'); m1 = await M(); ok(m1.length === m0.length && m1[0].floors === 17, 'Ctrl+Z makes it one tower again');
// 5. interior refuses politely
await page.click('#m-int'); await page.waitForTimeout(600);
ok(!(await page.evaluate(() => [...document.querySelectorAll('#tools [data-tool]')].map((b) => b.dataset.tool))).includes('split'), 'the interior toolbar has no Split (walls and room lines divide a floor)');
// a click right on the edge starts the cut (the mesh is missed there, the outline is not); a diagonal cut; a cut across one leg of an L cuts only that leg
await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.keyboard.press('Escape'); await page.click('#m-mass'); await page.waitForTimeout(500); await page.keyboard.press('2'); await page.waitForTimeout(300); await page.keyboard.press('Control+a'); await page.keyboard.press('Delete'); await page.waitForTimeout(300);
await page.keyboard.press('Shift+M'); await page.keyboard.press('r'); await page.waitForTimeout(100);
{ const a = await scr(46, 0, 56), b = await scr(74, 0, 76); await page.mouse.move(a[0], a[1]); await page.mouse.down(); await page.mouse.move(b[0], b[1], { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300); }
await page.keyboard.press('v'); let M2 = await page.evaluate(() => window.PFL_APP.sims.site.L.masses.map((m) => [m.x, m.z, m.w, m.d])); ok(M2.length === 1 && M2[0][2] === 28 && M2[0][3] === 20, "a 28 x 20 box drawn at 46, 56: " + JSON.stringify(M2));
await page.keyboard.press('x'); await click(46, 66); const cutA = await page.evaluate(() => window.PFL_APP.st.act && window.PFL_APP.st.act.a); ok(cutA && cutA[0] === 46 && cutA[1] === 66, 'a click right on the west edge starts the cut there: ' + JSON.stringify(cutA));
await click(74, 66); await page.waitForTimeout(300); M2 = await page.evaluate(() => window.PFL_APP.sims.site.L.masses.map((m) => Math.round(window.PFL.massArea(m)))); ok(M2.length === 2 && M2[0] === 280 && M2[1] === 280, 'to the east edge: two 280 m² halves: ' + M2.join(' + '));
await page.keyboard.press('Control+z');
await page.keyboard.press('x'); await click(50, 56); await click(70, 76); await page.waitForTimeout(300); M2 = await page.evaluate(() => window.PFL_APP.sims.site.L.masses.map((m) => [m.fp ? m.fp.pts.length : 4, Math.round(window.PFL.massArea(m))])); ok(M2.length === 2 && M2.every((m) => m[1] > 100) && M2[0][1] + M2[1][1] === 560, 'a diagonal cut from the south edge to the north edge gives two pieces of 560 m² in all: ' + JSON.stringify(M2));
await page.keyboard.press('Control+z'); await page.keyboard.press('Escape'); await page.keyboard.press('Control+a'); await page.keyboard.press('Delete'); await page.waitForTimeout(300);
await page.keyboard.press('Shift+M'); await page.keyboard.press('l'); await page.waitForTimeout(100); await page.click('#hint [data-lm="free"]'); await page.waitForTimeout(100);
for (const [x, z] of [[46, 56], [66, 56], [66, 62], [52, 62], [52, 76], [46, 76], [46, 56]]) await click(x, z);
await page.keyboard.press('v'); M2 = await page.evaluate(() => window.PFL_APP.sims.site.L.masses.map((m) => Math.round(window.PFL.massArea(m)))); ok(M2.length === 1 && M2[0] === 204, 'an L drawn freeform: 20 x 6 base + 6 x 14 leg = 204 m²: ' + M2.join());
await page.keyboard.press('x'); await click(46, 72); await click(52, 72); await page.waitForTimeout(300); M2 = await page.evaluate(() => window.PFL_APP.sims.site.L.masses.map((m) => Math.round(window.PFL.massArea(m))).sort((a, b) => a - b));
ok(M2.length === 2 && M2[0] === 24 && M2[1] === 180, 'a cut across the leg at z = 72 cuts only the leg: 24 + 180 m² (the base is untouched): ' + M2.join(' + '));
await page.keyboard.press('Escape');
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
