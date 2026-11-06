// Scripted check of Esc, floor selection on a mass, and per-floor walls, doors and area uses: node levels_test.mjs [screenshot dir]
import { chromium } from 'file:///C:/Users/sinnie/OneDrive/Desktop/tower-design-toolkit/node_modules/playwright/index.mjs';
const SP = process.argv[2] || './';
const browser = await chromium.launch({ executablePath: 'C:/Users/sinnie/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push('pageerror ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
await page.goto('file:///C:/Users/sinnie/OneDrive/Desktop/ped-flow-guide/index.html');
await page.waitForFunction(() => window.PFL_APP, null, { timeout: 30000 }); await page.waitForTimeout(800);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
// screen point of a world point (plan coordinates x, z; height y) in the pane showing camera `id`
const scr = (id, x, y, z) => page.evaluate(([id, x, y, z]) => { const A = window.PFL_APP, p = A.st.panes.find((q) => q.id === id) || A.st.panes[0], c = id === '3d' ? A.camera : A.cams[id], v = new THREE.Vector3(x, y, -z).project(c), r = document.querySelector('#view canvas').getBoundingClientRect(); return [r.left + p.x + (v.x + 1) / 2 * p.w, r.top + p.y + (1 - v.y) / 2 * p.h]; }, [id, x, y, z]);
const click = async (id, x, y, z, mods) => { const c = await scr(id, x, y, z); await page.mouse.move(c[0], c[1]); if (mods) await page.keyboard.down(mods); await page.mouse.click(c[0], c[1]); if (mods) await page.keyboard.up(mods); await page.waitForTimeout(200); };
const st = () => page.evaluate(() => { const A = window.PFL_APP, s = A.st; return { geom: s.geom, itool: s.itool, draft: !!s.draft, sel: s.sel && (s.sel.name || s.sel.id), selF: s.selFloors, mode: s.mode, level: A.sims.int.L.level, base: A.sims.int.L.baseUse }; });
const tower = () => page.evaluate(() => { const t = window.PFL_APP.sims.site.L.masses[0]; return { x: t.x, z: t.z, w: t.w, d: t.d, base: t.base, ftf: t.ftf, floors: t.floors, bands: window.PFL.bandsOf(t) }; });

// ---- Esc leaves the command in one press ----
await page.keyboard.press('2'); await page.waitForTimeout(300);
await page.keyboard.press('l'); await page.waitForTimeout(100);
await click('plan', 20, 0, 20); await page.mouse.move(400, 400); await page.waitForTimeout(100);
let s = await st(); ok(s.geom === 'line' && s.draft, 'Line tool started a line');
await page.keyboard.press('Escape'); await page.waitForTimeout(150);
s = await st(); ok(s.geom === 'select' && !s.draft, 'one Esc ends the line and goes back to Select');
await page.keyboard.press('r'); await page.keyboard.press('Escape'); await page.waitForTimeout(100);
s = await st(); ok(s.geom === 'select', 'Esc drops the Rectangle tool');

// ---- floor selection on the tower, in 3D ----
await page.keyboard.press('1'); await page.waitForTimeout(400);
let T = await tower();
const face = (lv) => [T.x + T.w / 2, T.base + (lv - 0.5) * T.ftf, T.z + 0.05];   // the south face, seen by the axonometric camera
await click('3d', ...face(5)); s = await st(); ok(s.sel === 'Tower' && !s.selF, 'first click selects the tower');
await click('3d', ...face(5)); s = await st(); ok(s.sel === 'Tower' && !s.selF, 'a second click on a floor keeps the whole mass selected (floors are picked in the card, storeys added with the stepper at the top)');
ok(!(await page.isHidden('#storeychip')), 'the storey stepper floats at the top of the tower');
await page.click('#fstackSvg g[data-l="5"]'); await page.waitForTimeout(200); s = await st(); ok(s.selF && s.selF.from === 5 && s.selF.to === 5, 'L5 in the floor stack selects floor L5: ' + JSON.stringify(s.selF));
await page.click('#fstackSvg g[data-l="8"]', { modifiers: ['Shift'] }); await page.waitForTimeout(200); s = await st(); ok(s.selF && s.selF.from === 5 && s.selF.to === 8, 'Shift+click on L8 stretches it to L5–8: ' + JSON.stringify(s.selF));
ok(/L5–L8 · 4 floors/.test(await page.textContent('#selcard')), 'the floor editor says L5–L8 · 4 floors');
await page.screenshot({ path: SP + 'l-floorsel-3d.png' });
await page.selectOption('#fsUse', 'restaurant'); await page.waitForTimeout(300);
T = await tower(); ok(T.bands.map((b) => b.use + b.floors).join() === 'restaurant1,office3,restaurant4,office9', 'L5–8 became food & drink between offices: ' + T.bands.map((b) => b.use + b.floors).join());
let dests = await page.evaluate(() => window.PFL_APP.sims.site.dprogs.filter((d) => d.type !== 'lobby').map((d) => d.name));
ok(dests.some((d) => /Tower · Food & drink L1–8/.test(d)), 'the site gets a food destination for L5–8: ' + dests.join(', '));
await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); s = await st(); ok(!s.selF && s.sel === 'Tower', 'Esc drops the selected face, Esc again the floors: back to the whole mass');
await page.keyboard.press('Escape'); s = await st(); ok(!s.sel, 'a second Esc clears the selection');

// ---- floor selection in section ----
await page.evaluate((zc) => { const el = document.getElementById('v-sec'); el.value = zc; el.dispatchEvent(new Event('input')); }, Math.round(T.z + T.d / 2));
await page.keyboard.press('3'); await page.waitForTimeout(400);
const sx = T.x + T.w / 2, sz = Math.round(T.z + T.d / 2) + 0.2;
await click('section', sx, T.base + 10.5 * T.ftf, sz); await click('section', sx, T.base + 10.5 * T.ftf, sz);
s = await st(); ok(s.sel === 'Tower' && !s.selF, 'in section, clicking the selected tower keeps the whole mass selected (floors are picked in the card)');
await page.click('#fstackSvg g[data-l="11"]'); await page.waitForTimeout(200); s = await st(); ok(s.selF && s.selF.from === 11, 'L11 in the floor stack picks L11: ' + JSON.stringify(s.selF));
await page.screenshot({ path: SP + 'l-floorsel-section.png' });
await page.keyboard.press('Escape'); await page.keyboard.press('Escape');

// ---- inside: open L5 (food & drink), walls, doors, area uses ----
await page.keyboard.press('1'); await page.waitForTimeout(300);
await click('3d', ...face(5)); await page.click('#fstackSvg g[data-l="5"]'); await page.waitForTimeout(200);
await page.click('#fsOpen'); await page.waitForTimeout(700);
s = await st(); ok(s.mode === 'int' && s.level === 5 && s.base === 'restaurant', `Open L5 inside: floor ${s.level}, ${s.base}`);
ok(await page.isVisible('.lvgrid [data-lv="17"]') && await page.isVisible('.lvgrid [data-lv="1"]'), 'the floor picker lists L1 to L17');
const plate = await page.evaluate(() => { const L = window.PFL_APP.sims.int.L; return { W: L.W, D: L.D, core: L.core }; });
await page.keyboard.press('2'); await page.waitForTimeout(400);
await page.keyboard.press('w'); s = await st(); ok(s.itool === 'wall', 'W picks the Wall tool');
await click('plan', 3, 0, 3); s = await st(); ok(s.draft, 'a wall is being drawn');
await page.keyboard.press('Escape'); await page.waitForTimeout(100); s = await st(); ok(s.itool === 'select' && !s.draft, 'one Esc cancels the wall and goes back to Select');
await page.keyboard.press('w');
const zw = 4;
await click('plan', 0.1, 0, zw); await click('plan', plate.W - 0.1, 0, zw); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
let I = await page.evaluate(() => { const S = window.PFL_APP.sims.int; return { walls: (S.L.walls || []).length, areas: S.regions.regions.filter((r) => !r.tiny).map((r) => r.use + ':' + Math.round(r.area)), unreached: S.unreached }; });
ok(I.walls === 1 && I.areas.length === 2, 'one wall across the plate makes two areas: ' + I.areas.join(', '));
await page.click('[data-tagu="retail"]'); s = await st(); ok(s.itool === 'tag', 'picking Retail in the Draw panel turns on Area use');
await click('plan', plate.W / 2, 0, 2); await page.waitForTimeout(300);
I = await page.evaluate(() => { const S = window.PFL_APP.sims.int; return { areas: S.regions.regions.filter((r) => !r.tiny).map((r) => r.use), unreached: S.unreached, reach: (S.areas || []).map((a) => a.use + ':' + a.reach) }; });
ok(I.areas.includes('retail') && I.areas.includes('restaurant'), 'the south strip is retail, the rest stays food & drink: ' + I.areas.join(', '));
ok(I.unreached.length === 1 && /Retail/.test(I.unreached[0]), 'the walled-off shop has no door yet: ' + I.unreached.join());
await page.keyboard.press('d'); await click('plan', plate.W / 2, 0, zw + 0.1); await page.waitForTimeout(300);
I = await page.evaluate(() => { const S = window.PFL_APP.sims.int; return { doors: (S.L.doors || []).length, unreached: S.unreached, reach: (S.areas || []).map((a) => a.use + ':' + a.reach) }; });
ok(I.doors === 1 && !I.unreached.length, 'a door in the wall connects it: ' + I.reach.join(', '));
await page.keyboard.press('Escape');
dests = await page.evaluate(() => window.PFL.destBands(window.PFL_APP.sims.site.L.masses[0]).map((d) => d.use + ':' + d.levels.join('/') + ':' + Math.round(d.area)));
ok(dests.some((d) => d.startsWith('retail:5')) && dests.some((d) => d.startsWith('restaurant:1/5/6/7/8')), 'the site counts the L5 shop and the food floors: ' + dests.join(' '));
await page.keyboard.press('1'); await page.waitForTimeout(300); await page.screenshot({ path: SP + 'l-floor-areas-3d.png' });

// ---- the simulation responds: lunch on the mixed floor ----
await page.click('#ws-sim'); await page.waitForTimeout(300); await page.click('[data-pr="2"]'); await page.waitForTimeout(3000);
let M = await page.evaluate(() => { const S = window.PFL_APP.sims.int, M = window.PFL.intMetrics(S); return { visitors: S.agents.filter((a) => !a.person).length, rooms: M.rooms.filter((r) => r.p.area).map((r) => r.p.use + ':' + Math.round(r.uses) + ':' + r.occ + '/' + r.cap) }; });
ok(M.rooms.length === 2 && M.rooms.every((r) => +r.split(':')[1] > 0), 'at lunch both the shop and the restaurant are visited: ' + M.rooms.join(' '));
ok(M.visitors > 0, 'visitors walk from the lifts: ' + M.visitors);
await page.screenshot({ path: SP + 'l-floor-sim.png' });
await page.click('#ws-design'); await page.waitForTimeout(300);

// ---- an office floor: area card turns the whole floor residential, undo brings it back ----
await page.click('.lvgrid [data-lv="12"]'); await page.waitForTimeout(500);
s = await st(); ok(s.level === 12 && s.base === 'office', 'L12 is a typical office floor');
await page.keyboard.press('2'); await page.waitForTimeout(300);
const ppl0 = await page.evaluate(() => window.PFL_APP.sims.int.people.length);
await page.keyboard.press('u'); await page.keyboard.press('v');
// an empty spot on the floor (between rooms) selects the area under it
const spot = await page.evaluate(() => { const S = window.PFL_APP.sims.int, G = S.G; for (let k = 0; k < G.NC; k++) { if (G.obst[k]) continue; const x = (k % G.GX + 0.5) * G.cs, z = (((k / G.GX) | 0) + 0.5) * G.cs; if (S.regions.at(x, z) >= 0 && !S.L.programs.some((p) => x > p.x - 0.5 && x < p.x + p.w + 0.5 && z > p.z - 0.5 && z < p.z + p.d + 0.5) && !(x > S.L.core.x - 0.5 && x < S.L.core.x + S.L.core.w + 0.5 && z > S.L.core.z - 0.5 && z < S.L.core.z + S.L.core.d + 0.5)) return [x, z]; } return null; });
await click('plan', spot[0], 0, spot[1]);
s = await st(); ok(/^area/.test(s.sel || ''), 'clicking the floor selects its area');
await page.selectOption('#aUse', 'residential'); await page.waitForTimeout(400);
const R1 = await page.evaluate(() => { const S = window.PFL_APP.sims.int; return { kinds: [...new Set(S.people.map((p) => p.kind || 'office'))], n: S.people.length, pop: window.PFL.massPop(window.PFL_APP.sims.site.L.masses[0]) }; });
ok(R1.kinds.join() === 'residential' && R1.pop.residential > 0, `the floor becomes homes: ${R1.n} residents, the tower brings ${R1.pop.residential} residents`);
await page.keyboard.press('Control+z'); await page.waitForTimeout(400);
const ppl1 = await page.evaluate(() => window.PFL_APP.sims.int.people.length);
ok(ppl1 === ppl0, `Ctrl+Z gives the office floor back (${ppl0} → ${ppl1} people)`);

// ---- all floors, and [ ] to step ----
await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
await page.keyboard.press('1'); await page.check('#lvAll'); await page.waitForTimeout(600);
ok(await page.evaluate(() => window.PFL_APP.st.allFloors), 'All floors shows the stack');
await page.screenshot({ path: SP + 'l-all-floors.png' });
await page.keyboard.press(']'); await page.waitForTimeout(400); s = await st(); ok(s.level === 13, '] goes one floor up: L' + s.level);
await page.keyboard.press('['); await page.keyboard.press('['); await page.waitForTimeout(400); s = await st(); ok(s.level === 11, '[ goes down: L' + s.level);
await page.uncheck('#lvAll'); await page.waitForTimeout(300);

// ---- back on the site the tower carries the mixed floor ----
await page.click('#m-mass'); await page.waitForTimeout(600);
const site = await page.evaluate(() => { const A = window.PFL_APP, t = A.sims.site.L.masses[0]; return { lv5: window.PFL.levelAreas(t, 5).map((a) => a.use), gens: A.sims.site.gens.filter((g) => g.key[0] === 'p').map((g) => g.type + ':' + g.pop) }; });
ok(site.lv5.includes('retail') && site.lv5.includes('restaurant'), 'the site model knows L5 is mixed: ' + site.lv5.join(', '));
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
