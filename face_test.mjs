// Scripted check of face selection with the Select tool (Snaptrude: faces are picked one by one, then pushed or pulled): click the selected mass on a face to select it, drag it or type a distance, click another face, Esc; the cut of Split lands on the mass surface; no automatic lift, no door markers; Vertex and Section are off the toolbar: node face_test.mjs [screenshot dir]
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
const hover = async (x, y, z) => { const c = await scr(x, y, z); await page.mouse.move(c[0], c[1]); await page.waitForTimeout(150); return c; };
const clickAt = async (x, y, z) => { const c = await hover(x, y, z); await page.mouse.click(c[0], c[1]); await page.waitForTimeout(250); };
const S = () => page.evaluate(() => { const A = window.PFL_APP, L = A.sims.site.L, m = L.masses[0]; let hov = 0, sel = 0; A.overlay.traverse((o) => { if (o.userData && o.userData.kind === 'face') { if (o.parent && o.parent.children.length <= 2 && o.renderOrder === 19) hov++; if (o.renderOrder === 20) sel++; } }); return { tool: A.st.tool, geom: A.st.geom, sel: A.st.sel && A.st.sel.name, face: A.st.selFace && A.st.selFace.key, hint: document.getElementById('hint').textContent, toast: document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent, t: { x: m.x, z: m.z, w: m.w, d: m.d, base: m.base, floors: m.floors, ftf: m.ftf, top: window.PFL.massTop(m) }, hov, selFaces: sel, dim: document.getElementById('dimbox').hidden ? null : document.getElementById('dimval').textContent, tools: [...document.querySelectorAll('#tools [data-tool]')].map((b) => b.dataset.tool), masses: L.masses.length }; });
const fit = async () => { await page.click('#panechrome [data-bb="fit"]'); await page.waitForTimeout(500); await page.mouse.move(700, 500); await page.mouse.wheel(0, 250); await page.waitForTimeout(400); };

await page.click('#m-mass'); await page.waitForTimeout(300); await key('1'); await page.waitForTimeout(300); await fit();
let s = await S(); const t = s.t, cx = t.x + t.w / 2, cz = t.z + t.d / 2, mid = (t.base + t.top) / 2;
ok(!s.tools.includes('vertex') && !s.tools.includes('section') && s.tools.includes('split') && s.tools.includes('pull'), 'Vertex and Section are off the toolbar: ' + s.tools.join(' '));
// select the tower, then a face of it
await clickAt(cx, mid, t.z); s = await S(); ok(s.sel === 'Tower' && !s.face, 'first click selects the tower, no face yet');
ok(/Click a face of the selected piece/.test(s.hint), 'the hint invites a face click: ' + s.hint.slice(0, 80));
await hover(cx, mid, t.z); s = await S(); ok(s.hov >= 1, 'hovering the south face of the selected tower lights it up (' + s.hov + ' face mesh)');
await page.screenshot({ path: SP + 'f-hover.png' });
await clickAt(cx, mid, t.z); s = await S(); ok(s.face === 'b1:S' && s.sel === 'Tower' && s.selFaces === 1, 'a second click selects the south face: ' + s.face + ' · ' + s.toast.slice(0, 60));
ok(/Face selected/.test(s.hint), 'the hint says a face is selected');
await page.screenshot({ path: SP + 'f-selected.png' });
// type a distance: the face moves
await key('4'); s = await S(); ok(s.dim === '4', 'typing 4 starts a pull of the selected face and the dimension box reads 4');
await key('Enter'); await page.waitForTimeout(300); s = await S(); ok(s.t.d === t.d + 4 && s.t.z === t.z - 4, `Enter pulls the south face 4 m out: depth ${t.d} → ${s.t.d}`);
ok(s.face === 'b1:S' && s.sel === 'Tower', 'the face stays selected afterwards');
await key('Control+z'); s = await S(); ok(s.t.d === t.d, 'Ctrl+Z puts it back'); ok(s.face === 'b1:S', 'and the face is still selected');
// drag the face with the pointer
let c0 = await scr(cx, mid, t.z), c1 = await scr(cx, mid, t.z - 6);
await page.mouse.move(c0[0], c0[1]); await page.mouse.down(); await page.mouse.move(c1[0], c1[1], { steps: 6 }); await page.waitForTimeout(200); s = await S(); ok(s.dim !== null, 'dragging the selected face shows the dimension box: ' + s.dim);
await page.screenshot({ path: SP + 'f-drag.png' });
await page.mouse.up(); await page.waitForTimeout(300); s = await S(); ok(s.t.d > t.d && s.face === 'b1:S', `letting go sets it: depth ${t.d} → ${s.t.d}, face still selected`);
await key('Control+z');
// another face: the top
await clickAt(cx, t.top, cz); s = await S(); ok(s.face === 'b1:top', 'clicking the roof selects the top instead: ' + s.face);
await key('8'); await key('0'); await key('Enter'); await page.waitForTimeout(300); s = await S(); ok(s.t.floors === 20, `typing 80 Enter gives ${s.t.floors} floors`);
await key('Control+z');
// Esc drops the face, a second Esc the selection
await key('Escape'); s = await S(); ok(!s.face && s.sel === 'Tower' && s.selFaces === 0, 'Esc drops the face, the tower stays selected');
await key('Escape'); s = await S(); ok(!s.sel, 'a second Esc clears the selection');
// a surface: an edge of the planting bed
const pb = await page.evaluate(() => { const b = window.PFL_APP.sims.site.L.shapes[0]; return b.pts.map((p) => p.slice()); });
await key('2'); await page.waitForTimeout(300); const e0 = [(pb[0][0] + pb[1][0]) / 2, (pb[0][1] + pb[1][1]) / 2], ec = pb.reduce((q, p) => [q[0] + p[0] / 4, q[1] + p[1] / 4], [0, 0]);
await clickAt(ec[0], 0, ec[1]); s = await S(); ok(s.sel === 'Planting bed', 'the planting bed selected in plan');
await clickAt(e0[0], 0, e0[1]); s = await S(); ok(s.face === 's1:e0', 'a click on its first edge selects that edge: ' + s.face);
await key('2'); await key('Enter'); await page.waitForTimeout(300); const pb2 = await page.evaluate(() => window.PFL_APP.sims.site.L.shapes[0].pts.map((p) => p.slice()));
ok(pb2.filter((p, i) => p[0] !== pb[i][0] || p[1] !== pb[i][1]).length === 2, 'typing 2 Enter moves that edge 2 m out');
await key('Control+z'); await key('Escape'); await key('Escape');
// split: the cut lands on the mass surface in 3D
await key('1'); await page.waitForTimeout(300); await fit(); await key('x'); await page.waitForTimeout(200);
await clickAt(cx, t.top, t.z); s = await S(); const a = await page.evaluate(() => window.PFL_APP.st.act && window.PFL_APP.st.act.a);
ok(a && Math.abs(a[1] - t.z) < 0.01 && Math.abs(a[0] - cx) < 1, 'clicking the roof edge in 3D starts the cut there (snapped to the edge midpoint): ' + JSON.stringify(a));
await clickAt(cx, t.top, t.z + t.d); await page.waitForTimeout(400); s = await S(); ok(s.masses === 2, 'the second click on the far roof edge cuts the tower in two');
await key('Control+z'); await key('Escape');
// no automatic lift when a mass is drawn over a ground use, and no door markers
await key('2'); await page.waitForTimeout(300); await page.keyboard.press('Shift+M'); await page.waitForTimeout(150);
const sh = await page.evaluate(() => { const p = window.PFL_APP.sims.site.L.programs.find((q) => q.name === 'Shop'); return { x: p.x, z: p.z, w: p.w, d: p.d }; });
let d0 = await scr(sh.x - 2, 0, sh.z - 2), d1 = await scr(sh.x + sh.w + 4, 0, sh.z + sh.d + 4);
await page.mouse.move(d0[0], d0[1]); await page.mouse.down(); await page.mouse.move(d1[0], d1[1], { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(500);
const nm = await page.evaluate(() => { const L = window.PFL_APP.sims.site.L, m = L.masses[L.masses.length - 1]; return { n: L.masses.length, base: m.base, name: m.name, shop: L.programs.some((p) => p.name === 'Shop'), toast: document.getElementById('toast').textContent }; });
ok(nm.n === 2 && nm.base === 0 && !nm.shop && /Shop under it was removed/.test(nm.toast), `a mass drawn over the Shop sits on the ground, not lifted; the Shop under it is taken away: ${JSON.stringify(nm)}`);
await key('Control+z'); ok(await page.evaluate(() => window.PFL_APP.sims.site.L.programs.some((p) => p.name === 'Shop') && window.PFL_APP.sims.site.L.masses.length === 1), 'Ctrl+Z brings the Shop back and takes the mass away');
ok(await page.evaluate(() => { let n = 0; window.PFL_APP.world.traverse((o) => { if (o.isMesh && o.material && o.material.color && o.material.color.getHexString() === '1d1c1b' && o.geometry && o.geometry.type === 'BoxGeometry') n++; }); return n; }) === 0, 'no black door blocks are drawn');
await key('Escape');
// a bar drawn along a line: pulling one side moves that side only (the bar becomes a plain outline)
await key('2'); await page.waitForTimeout(300); await page.keyboard.press('Shift+M'); await key('l'); await clickAt(36, 0, 50); await clickAt(60, 0, 50); await key('Enter'); await page.waitForTimeout(400); await key('v');
let bar = await page.evaluate(() => { const L = window.PFL_APP.sims.site.L, m = L.masses[L.masses.length - 1]; return { id: m.id, geom: m.fp && m.fp.geom, w: m.fp && m.fp.width, x: m.x, z: m.z, W: m.w, D: m.d, area: window.PFL.massArea(m) }; });
ok(bar.geom === 'path' && bar.w === 10, 'a bar drawn with the Line tool is 10 m deep along its centre line: ' + JSON.stringify(bar));
await clickAt(bar.x + 0.3, 0, bar.z + bar.D / 2); s = await S();   // the bar is selected as soon as it is drawn; a click on its label would edit the name instead ok(s.face && /:e\d+$/.test(s.face), 'a click on its west end selects that one side: ' + s.face);
await key('3'); await key('Enter'); await page.waitForTimeout(300);
const bar2 = await page.evaluate((id) => { const m = window.PFL_APP.sims.site.L.masses.find((q) => q.id === id); return { geom: m.fp.geom, x: m.x, W: m.w, D: m.d, area: window.PFL.massArea(m), toast: document.getElementById('toast').textContent }; }, bar.id);
ok(bar2.geom === 'poly' && bar2.W === bar.W + 3 && bar2.x === bar.x - 3 && bar2.D === bar.D && Math.abs(bar2.area - (bar.area + 3 * bar.D)) < 1, `3, Enter moves only the west end 3 m: ${bar.W} → ${bar2.W} m long, still ${bar2.D} m deep; the bar is a plain outline now · ${bar2.toast}`);
await key('Control+z'); await key('Escape'); await key('Escape');
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
