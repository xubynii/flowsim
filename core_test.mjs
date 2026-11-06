// Scripted check of the Core tool on the Mass tab (click inside a mass to place its core, drag to size it, click the core to remove it; the interior lays out round it), of the interior plan showing every mass on the level in place (click one to edit it), and of doors drawn as on an architectural plan (the wall broken with jambs, a thin leaf and swing, no dark marker; the plan cut stops at the opening): node core_test.mjs [screenshot dir]
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
const clickAt = async (x, z, y = 0) => { const c = await scr(x, y, z); await page.mouse.move(c[0], c[1]); await page.waitForTimeout(80); await page.mouse.click(c[0], c[1]); await page.waitForTimeout(250); };
const T = () => page.evaluate(() => { const m = window.PFL_APP.sims.site.L.masses[0]; return { id: m.id, name: m.name, x: m.x, z: m.z, w: m.w, d: m.d, floors: m.floors, core: m.core ? { ...m.core } : null, auto: window.PFL.coreOf(m) }; });
const S = () => page.evaluate(() => ({ tool: window.PFL_APP.st.tool, act: window.PFL_APP.st.act && window.PFL_APP.st.act.kind, hint: document.getElementById('hint').textContent.slice(0, 120), toast: document.getElementById('toast').textContent }));

// ---- the Core tool
await page.click('#m-mass'); await page.waitForTimeout(300); await key('2'); await page.waitForTimeout(400);
ok(!!(await page.$('#tools [data-tool="core"]')), 'the Mass tab toolbar has a Core tool');
let t = await T(); ok(!t.core && t.auto && t.auto.w > 0, `the tower has an automatic core of ${t.auto.w} × ${t.auto.d} m to begin with`);
await page.click('#tools [data-tool="core"]'); await page.waitForTimeout(200); let s = await S(); ok(s.tool === 'core' && /inside a mass/.test(s.hint), 'Core picks the tool: ' + s.hint);
await clickAt(t.x - 4, t.z + 4); s = await S(); ok(/inside a mass/.test(s.toast) && !(await T()).core, 'a click beside the mass does nothing but say so: ' + s.toast);
// a click inside places a core there (sized for the mass), without dragging
const px = t.x + 6, pz = t.z + 6; await clickAt(px, pz); t = await T(); s = await S();
ok(t.core && t.core.w === 8 && t.core.d === 8 && Math.abs(t.core.x + 4 - 6) <= 0.5 && Math.abs(t.core.z + 4 - 6) <= 0.5, `a click 6 m in from the corner places an 8 × 8 m core centred there: ${JSON.stringify(t.core)} · ${s.toast}`);
ok(t.auto.x === t.core.x && t.auto.z === t.core.z && t.auto.w === 8, 'the floors now use that core');
await page.screenshot({ path: SP + 'k-core.png' });
// drag sizes it
await clickAt(t.x + 20, t.z + 12); t = await T(); ok(t.core && Math.abs(t.core.x + t.core.w / 2 - 20) <= 0.5, 'a click elsewhere moves the core there: ' + JSON.stringify(t.core));
const c0 = await scr(t.x + 14, 0, t.z + 10), c1 = await scr(t.x + 20, 0, t.z + 13);
await page.mouse.move(c0[0], c0[1]); await page.mouse.down(); await page.waitForTimeout(100); await page.mouse.move(c1[0], c1[1], { steps: 6 }); await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(300);
t = await T(); ok(t.core && t.core.w === 12 && t.core.d === 6, 'dragging from the centre sizes it: 12 × 6 m: ' + JSON.stringify(t.core));
await clickAt(t.x + 14, t.z + 10); t = await T(); s = await S(); ok(!t.core && /removed/.test(s.toast), 'a click on the core removes it: ' + s.toast);
await key('Control+z'); t = await T(); ok(t.core && t.core.w === 12, 'Ctrl+Z brings it back');
const coreIn = await page.evaluate(() => { const A = window.PFL_APP, m = A.sims.site.L.masses[0], L = window.PFL.levelLayout(m, 2); return [L.core.x, L.core.z, L.core.w, L.core.d]; });
ok(coreIn[2] === 12 && coreIn[3] === 6 && coreIn[0] === t.core.x, 'level 2 of the tower lays out round the placed core: ' + coreIn.join(' '));
await key('Escape');

// ---- the interior shows every mass on the level (a second mass, a 3-storey podium, drawn first)
const dragM = async (a, b, steps = 8) => { await page.mouse.move(a[0], a[1]); await page.mouse.down(); for (let k = 1; k <= steps; k++) await page.mouse.move(a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps); await page.mouse.up(); await page.waitForTimeout(200); };
await page.keyboard.press('Shift+M'); await page.waitForTimeout(150); await dragM(await scr(35, 0, 50), await scr(44, 0, 78)); await key('Escape');
ok((await page.evaluate(() => window.PFL_APP.sims.site.L.masses.length)) === 2, 'a second mass drawn beside the tower');
await page.evaluate(() => { window.PFL_APP.st.floorMass = window.PFL_APP.sims.site.L.masses[0].id; });
await page.click('#m-int'); await page.waitForTimeout(900);
const ctx = () => page.evaluate(() => { const A = window.PFL_APP, L = A.sims.int.L, lvl = L.level || 1, others = A.sims.site.L.masses.filter((m) => m.id !== A.st.floorMass && m.floors >= lvl); let n = 0, lbl = []; A.world.traverse((o) => { if (o.userData && o.userData.kind === 'ctx') n++; if (o.isSprite && /click to edit/.test(o.userData.text || '')) lbl.push(o.userData.text); }); return { lvl, others: others.map((m) => m.name), n, lbl, cur: L.name }; });
let c = await ctx();
ok(c.n === c.others.length && c.n > 0, `level ${c.lvl} of ${c.cur}: the ${c.others.length} other masses with that level are drawn in place: ${c.lbl.join(' | ')}`);
const cutCtx = await page.evaluate(() => { const A = window.PFL_APP; return A.overlay.children[0].children.filter((m) => m.userData && m.userData.cut === 'facade').length; });
ok(cutCtx >= 2, 'their façades are cut in the plan too (own + context): ' + cutCtx);
await page.screenshot({ path: SP + 'k-int-all.png' });
// click one to edit it
const other = await page.evaluate(() => { const A = window.PFL_APP, L = A.sims.int.L, lvl = L.level || 1, m0 = A.sims.site.L.masses.find((m) => m.id === A.st.floorMass); const q = A.sims.site.L.masses.find((m) => m.id !== m0.id && m.floors >= lvl); return { id: q.id, name: q.name, x: q.x - m0.x + q.w / 2, z: q.z - m0.z + q.d / 2 }; });
await clickAt(other.x, other.z, 0); await page.waitForTimeout(900); c = await ctx();
ok(c.cur === other.name && !c.others.includes(other.name), `a click on ${other.name} opens its level ${c.lvl} instead; the first mass is now drawn as context: ${c.lbl.join(' | ')}`);
await key('Control+z');

// ---- doors as on an architectural plan
await page.click('#m-mass'); await page.waitForTimeout(400); await page.evaluate(() => { window.PFL_APP.st.floorMass = window.PFL_APP.sims.site.L.masses[0].id; }); await page.click('#m-int'); await page.waitForTimeout(900); await key('2'); await page.waitForTimeout(300);
const P = await page.evaluate(() => { const L = window.PFL_APP.sims.int.L; return { W: L.W, D: L.D, walls: (L.walls || []).length }; });
await key('w'); await clickAt(0.3, 3); await clickAt(P.W - 0.3, 3); await page.waitForTimeout(500);
const wall = await page.evaluate(() => { const L = window.PFL_APP.sims.int.L; return L.walls[L.walls.length - 1]; });
const cutsOf = () => page.evaluate((id) => { const A = window.PFL_APP; return A.overlay.children[0].children.filter((m) => m.userData && m.userData.kind === 'wall' && m.userData.o && m.userData.o.id === id).length; }, wall.id);
ok((await cutsOf()) === 1, 'a wall without a door is cut as one solid run');
await key('d'); await clickAt(wall.a[0] + 6, 3); await page.waitForTimeout(500);
const dr = await page.evaluate(() => { const A = window.PFL_APP, L = A.sims.int.L; let dark = 0, leaf = 0; A.world.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.width === 1.2 && o.geometry.parameters.depth === 0.4) dark++; if (o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.width === 0.04 && Math.abs(o.geometry.parameters.depth - 1.2) < 0.01) leaf++; }); return { doors: (L.doors || []).length, dark, leaf }; });
ok(dr.doors === 1 && dr.dark === 0 && dr.leaf === 1, `a door: the leaf is a thin solid at 90°, no dark marker block: ${JSON.stringify(dr)}`);
ok((await cutsOf()) === 2, 'the plan cut stops at the opening: the wall is cut as two runs');
await page.screenshot({ path: SP + 'k-door.png' });
await key('Escape');
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
