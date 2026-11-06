// Scripted check of the Snaptrude-style toolbar: erase, move, copy / array, rotate, offset, push / pull, edit length, vertex, tape, section, arc, the right-panel tabs and the Areas panel: node tools_test.mjs [screenshot dir]
import { chromium } from 'file:///C:/Users/sinnie/OneDrive/Desktop/tower-design-toolkit/node_modules/playwright/index.mjs';
const SP = process.argv[2] || './';
const browser = await chromium.launch({ executablePath: 'C:/Users/sinnie/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push('pageerror ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
await page.goto('file:///C:/Users/sinnie/OneDrive/Desktop/ped-flow-guide/index.html');
await page.waitForFunction(() => window.PFL_APP, null, { timeout: 30000 }); await page.waitForTimeout(800);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const scr = (x, y, z) => page.evaluate(([x, y, z]) => { const A = window.PFL_APP, p = A.st.panes[0], v = new THREE.Vector3(x, y, -z).project(A.camera), r = document.querySelector('#view canvas').getBoundingClientRect(); return [r.left + p.x + (v.x + 1) / 2 * p.w, r.top + p.y + (1 - v.y) / 2 * p.h]; }, [x, y, z]);
const move = async (x, z, y = 0) => { const c = await scr(x, y, z); await page.mouse.move(c[0], c[1]); await page.waitForTimeout(80); };
const click = async (x, z, y = 0) => { await move(x, z, y); const c = await scr(x, y, z); await page.mouse.click(c[0], c[1]); await page.waitForTimeout(150); };
const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(80); };
const tool = async (id) => { await page.click(`#tools [data-tool="${id}"]`); await page.waitForTimeout(100); };
const S = () => page.evaluate(() => { const A = window.PFL_APP, L = A.sims.site.L, st = A.st; const P = (id) => { const o = [...L.programs, ...L.masses, ...(L.shapes || [])].find((q) => q.id === id); return o ? { x: o.x, z: o.z, w: o.w, d: o.d, floors: o.floors, name: o.name, fp: o.fp ? o.fp.pts.length : 0 } : null; };
  return { tool: st.tool, obj: st.obj, geom: st.geom, rtab: st.rtab, sel: st.sel && st.sel.id, act: st.act && st.act.kind, nP: L.programs.length, nS: (L.shapes || []).length, nM: L.masses.length, p4: P('p4'), p5: P('p5'), b1: P('b1'), k1: !!P('k1'), shapes: (L.shapes || []).map((s) => ({ type: s.type, n: s.pts.length, box: window.PFL.shapeBox(s) })), names: L.programs.map((p) => p.name), secPos: st.secPos.site, layout: st.layout, toast: document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent, hint: document.getElementById('hint').textContent }; });
const undo = async (n = 1) => { for (let i = 0; i < n; i++) await key('Control+z'); await page.waitForTimeout(150); };
const near = (a, b, e = 0.05) => Math.abs(a - b) < e;

// the toolbar and its keys
let s = await S();
const tips = await page.evaluate(() => [...document.querySelectorAll('#tools [data-tool]')].map((b) => b.dataset.tool + ':' + b.dataset.tip));
ok(tips.length === 14 && tips.includes('split:Split · X') && tips.includes('move:Move · M') && tips.includes('pull:Push / pull · P') && tips.includes('elen:Edit length') && !tips.some((x) => /^(vertex|section|arc):/.test(x)), 'the Mass tab toolbar has 14 tools with name + key tooltips (no Arc, Vertex or Section): ' + tips.join(', '));
ok(await page.evaluate(() => document.querySelectorAll('.panel.left #viewTree .vitem').length > 8) && await page.evaluate(() => [...document.querySelectorAll('[data-rtab]')].filter((b) => b.offsetParent).length === 2), 'a Views tree on the left as in Snaptrude; the right panel has Properties and Areas tabs in Design');
await key('2'); await key('q'); s = await S(); ok(s.tool === 'rotate' && /Rotate/.test(s.hint) && await page.getAttribute('#tools [data-tool="rotate"]', 'aria-pressed') === 'true', 'Q picks Rotate: button pressed, hint explains');
await key('Escape'); s = await S(); ok(s.tool === 'select', 'Esc goes back to Select');
await key('Shift+M'); s = await S(); ok(s.obj === 'mass' && s.geom === 'rect' && s.tool === 'rect', 'Shift+M picks the Mass object (M is Move now)');
await key('m'); s = await S(); ok(s.tool === 'move' && s.geom === 'select', 'M picks Move');
await key('Escape');

// erase
await key('e'); await click(64, 46.3); s = await S(); ok(!s.k1 && s.nP === 6, 'Erase removes the bench with one click: ' + s.toast);
await undo(); s = await S(); ok(s.k1, 'Ctrl+Z brings it back');
await key('Escape');

// move: pick up, move, click to place; then a typed distance
await key('m'); await click(39, 32.5); await move(45, 32.5); s = await S(); ok(s.tool === 'move' && /place/.test(s.hint), 'Move: the shop is picked up on one click');
await click(45, 32.5); s = await S(); ok(s.p4.x === 42 && s.p4.z === 30, `click places it 6 m east: x ${s.p4.x}`); await undo();
await key('m'); await click(39, 32.5); await move(41, 32.5); await key('4'); await key('Enter'); s = await S(); ok(s.p4.x === 40 && s.p4.z === 30, `typed 4 + Enter moves it 4 m along the pointer's direction: x ${s.p4.x}`); await undo();
s = await S(); ok(s.p4.x === 36, 'undo restores the shop');

// copy / array: typed distance, Tab, count
await key('c'); await click(39, 32.5); await move(49, 32.5); await key('8'); await key('Tab'); await key('2'); await key('Enter'); await page.waitForTimeout(300);
s = await S(); ok(s.nP === 9 && s.names.includes('Shop 2') && s.names.includes('Shop 3'), 'Copy / array with 8 m, Tab, 2: two copies in a row: ' + s.names.join(', '));
const cps = await page.evaluate(() => window.PFL_APP.sims.site.L.programs.filter((p) => /^Shop [23]$/.test(p.name)).map((p) => p.x).sort((a, b) => a - b));
ok(cps[0] === 44 && cps[1] === 52, 'copies at 8 and 16 m: x ' + cps.join(', '));
await page.screenshot({ path: SP + 't-copies.png' }); await undo(); s = await S(); ok(s.nP === 7, 'one undo removes both copies');

// rotate: the protractor, 90° for a box; typed angle
await key('q'); await click(54, 40); s = await S(); ok(s.act === 'rotate' && s.sel === 'p5', 'Rotate picks the seating and shows the protractor');
await move(54, 50); await page.screenshot({ path: SP + 't-rotate.png' }); await click(54, 50); s = await S(); ok(s.p5.w === 8 && s.p5.d === 12 && s.p5.x === 50 && s.p5.z === 34, `pointer north = 90°: the seating turns about its centre: ${JSON.stringify(s.p5)}`); await undo();
await key('q'); await click(54, 40); await key('9'); await key('0'); await key('Enter'); s = await S(); ok(s.p5.w === 8 && s.p5.d === 12, 'typed 90 + Enter rotates too'); await undo();

// offset: on the site it makes a surface, outward by pointer or inward by a typed distance
await key('f'); await click(54, 40); s = await S(); ok(s.act === 'offset', 'Offset picks the seating outline');
await move(54, 46); await click(54, 46); s = await S(); const sh = s.shapes[s.shapes.length - 1];
ok(s.nS === 3 && sh.type === 'paving' && near(sh.box.x, 46) && near(sh.box.z, 34) && near(sh.box.w, 16) && near(sh.box.d, 12), 'pointer 2 m outside: a paving surface 2 m round the seating: ' + JSON.stringify(sh)); await undo();
await key('f'); await click(54, 40); await key('1'); await key('Enter'); s = await S(); const sh2 = s.shapes[s.shapes.length - 1];
ok(s.nS === 3 && near(sh2.box.x, 49) && near(sh2.box.w, 10) && near(sh2.box.d, 6), 'typed 1 + Enter offsets 1 m inward: ' + JSON.stringify(sh2.box)); await undo();

// push / pull in 3D with a typed height
await key('1'); await page.waitForTimeout(300); await key('p'); await click(60, 66, 68); s = await S(); ok(s.tool === 'pull' && s.sel === 'b1' && /floors|height/.test(s.hint), 'Push / pull picks the tower in 3D');
await key('8'); await key('0'); await key('Enter'); s = await S(); ok(s.b1.floors === 20, `typed 80 m → 20 floors: ${s.b1.floors}`); await undo(); s = await S(); ok(s.b1.floors === 17, 'undo');
await key('2'); await page.waitForTimeout(300); await key('p'); await click(60, 66); s = await S(); ok(/Press 1 for 3D/.test(s.toast), 'in plan, the middle of a mass says to press 1 for 3D (its sides pull from the edges): ' + s.toast);
await key('Escape');

// edit length: click near the west end of the shop's south edge, type 8
await tool('elen'); await click(37, 30); s = await S(); ok(s.act === 'elen' && /6 m/.test(s.hint), 'Edit length picks the 6 m edge: ' + s.hint.slice(0, 60));
await key('8'); await key('Enter'); s = await S(); ok(s.p4.w === 8 && s.p4.x === 36, `typed 8: the edge is 8 m, the near end stays: w ${s.p4.w}, x ${s.p4.x}`); await undo();

// add / remove vertex on the tower's south edge
await page.evaluate(() => window.PFL_APP.setTool('vertex')); await click(60, 56); s = await S(); ok(s.b1.fp === 5, 'a click on the edge adds a corner: the mass becomes a 5-corner footprint');
await page.evaluate(() => window.PFL_APP.setTool('vertex')); await click(60, 56); s = await S(); ok(s.b1.fp === 4, 'a click on that corner removes it'); await undo(2); s = await S(); ok(s.b1.fp === 0, 'two undos: a plain mass again');

// measuring tape
await key('t'); await click(36, 30); await click(42, 30); s = await S(); ok(s.act === 'tape' && /^6 m/.test(s.toast), 'Tape: 6 m between two points: ' + s.toast);
await key('Escape'); s = await S(); ok(!s.act && s.tool === 'select', 'Esc clears it');

// section tool
await page.evaluate(() => window.PFL_APP.setTool('section')); await page.waitForTimeout(100); await click(55, 50); s = await S(); ok(s.secPos === 50 && s.layout === 'section' && s.tool === 'select', `S + click sets the section at z ${s.secPos} and shows it`);
await key('2'); await page.waitForTimeout(300);

// arc: a paving band drawn as an arc
await key('k'); await key('a'); await click(40, 60); await click(52, 60); await move(46, 66); await click(46, 66); await key('Enter'); await page.waitForTimeout(300);
s = await S(); const arc = s.shapes[s.shapes.length - 1]; ok(s.nS === 3 && arc.type === 'paving' && arc.n >= 6, `Arc: a paving band along a curve with ${arc.n} points`);
await page.screenshot({ path: SP + 't-arc.png' }); await undo();

// the Areas tab and the panel's tabs
await page.click('[data-rtab="areas"]'); await page.selectOption('#aView', 'fp'); await page.waitForTimeout(200);
let rows = await page.evaluate(() => [...document.querySelectorAll('#areas .arow')].map((r) => r.textContent.trim().replace(/\s+/g, ' ')));
ok(rows.some((r) => /Tower/.test(r) && /560/.test(r)), 'Areas · Footprint lists the tower at 560 m²: ' + rows.join(' | '));
await page.selectOption('#aView', 'gfa'); await page.selectOption('#aGroup', 'mass'); await page.waitForTimeout(200);
rows = await page.evaluate(() => [...document.querySelectorAll('#areas .arow')].map((r) => r.textContent.trim().replace(/\s+/g, ' ')));
ok(rows[0].startsWith('Tower') && rows.some((r) => /Food & drink · 1 fl/.test(r)) && rows.some((r) => /Office · 16 fl/.test(r)), 'GFA by mass: the tower with its bands: ' + rows.join(' | '));
await page.screenshot({ path: SP + 't-areas.png' });
await key('v'); await click(39, 32.5); s = await S(); ok(s.rtab === 'props' && (await page.textContent('#selcard')).includes('Shop'), 'selecting a piece opens Properties');
await page.click('#ws-sim'); await page.waitForTimeout(400); ok((await page.getAttribute('[data-rtab="flow"]', 'aria-selected')) === 'true' && await page.isVisible('#results'), 'Simulate opens Flow results');
await page.click('#ws-design'); await page.waitForTimeout(400);

// interior: offset the floor plate into room lines, erase a room
await page.click('#m-int'); await page.waitForTimeout(900); await key('2'); await page.waitForTimeout(200);
const tipsI = await page.evaluate(() => [...document.querySelectorAll('#tools [data-tool]')].map((b) => b.dataset.tool));
ok(tipsI.length === 13 && tipsI.includes('tag') && tipsI.includes('pull'), 'the interior toolbar swaps the draw tools for Wall, Room line, Door, Area use and keeps Push / pull (walls move sideways)');
const spot = await page.evaluate(() => { const S = window.PFL_APP.sims.int, L = S.L; for (let z = 1; z < L.D; z += 0.5) for (let x = 1; x < L.W; x += 0.5) if (S.regions.at(x, z) >= 0 && !L.programs.some((p) => x > p.x - 0.6 && x < p.x + p.w + 0.6 && z > p.z - 0.6 && z < p.z + p.d + 0.6) && !(x > L.core.x - 0.6 && x < L.core.x + L.core.w + 0.6 && z > L.core.z - 0.6 && z < L.core.z + L.core.d + 0.6)) return [x, z]; return null; });
await key('f'); await click(spot[0], spot[1]); const I0 = await page.evaluate(() => window.PFL_APP.st.act && window.PFL_APP.st.act.ring.map((q) => q.join(','))); ok(I0 && I0.length === 4 && I0.includes('0,0') && I0.includes('28,20'), 'Offset on open floor picks the plate outline: ' + (I0 && I0.join(' ')));
await key('2'); await key('Enter'); await page.waitForTimeout(400);
const I1 = await page.evaluate(() => { const S = window.PFL_APP.sims.int; return { walls: (S.L.walls || []).length, sep: (S.L.walls || []).filter((w) => w.sep).length, areas: S.regions.regions.filter((r) => !r.tiny && r.area >= 4).length, toast: document.getElementById('toast').textContent }; });
ok(I1.walls === 4 && I1.sep === 4 && I1.areas === 2, `typed 2 + Enter: four room lines 2 m inside the façade, two areas: ${JSON.stringify(I1)}`);
await page.screenshot({ path: SP + 't-int-offset.png' }); await undo();
const nR = await page.evaluate(() => window.PFL_APP.sims.int.L.programs.length);
await key('e'); const room = await page.evaluate(() => { const p = window.PFL_APP.sims.int.L.programs.find((q) => q.type === 'meeting' || q.type === 'pantry'); return [p.x + p.w / 2, p.z + p.d / 2]; }); await click(room[0], room[1], 1);
ok(await page.evaluate(() => window.PFL_APP.sims.int.L.programs.length) === nR - 1, 'Erase removes a room inside'); await undo();
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
