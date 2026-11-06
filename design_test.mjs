// Scripted check of the Design and Simulate workspaces: node design_test.mjs [screenshot dir]
import { chromium } from 'file:///C:/Users/sinnie/OneDrive/Desktop/tower-design-toolkit/node_modules/playwright/index.mjs';
const SP = process.argv[2] || './';
const browser = await chromium.launch({ executablePath: 'C:/Users/sinnie/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push('pageerror ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
await page.goto('file:///C:/Users/sinnie/OneDrive/Desktop/ped-flow-guide/index.html');
await page.waitForFunction(() => window.PFL_APP, null, { timeout: 30000 });
await page.waitForTimeout(800);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const scr = (x, y, z) => page.evaluate(([x, y, z]) => { const A = window.PFL_APP, p = A.st.panes[0], v = new THREE.Vector3(x, y, -z).project(A.camera), r = document.querySelector('#view canvas').getBoundingClientRect(); return [r.left + p.x + (v.x + 1) / 2 * p.w, r.top + p.y + (1 - v.y) / 2 * p.h]; }, [x, y, z]);
const L = () => page.evaluate(() => { const A = window.PFL_APP, S = A.sims.site; return { masses: S.L.masses.map((m) => ({ ...m })), progs: S.L.programs.map((p) => ({ id: p.id, type: p.type, x: p.x, z: p.z, w: p.w, d: p.d })), shapes: JSON.parse(JSON.stringify(S.L.shapes)), design: S.design, sel: A.st.sel && A.st.sel.id, ws: A.st.ws, speed: A.st.speed, agents: S.agents.length, geom: A.st.geom, obj: A.st.obj }; });
const drag = async (a, b, steps = 8) => { await page.mouse.move(a[0], a[1]); await page.mouse.down(); for (let k = 1; k <= steps; k++) await page.mouse.move(a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps); await page.mouse.up(); await page.waitForTimeout(150); };
const click = async (x, z, y = 0) => { const c = await scr(x, y, z); await page.mouse.move(c[0], c[1]); await page.mouse.click(c[0], c[1]); await page.waitForTimeout(120); };
const area = (sh) => page.evaluate((sh) => window.PFL.shapeArea(sh), sh);

let s = await L();
ok(s.ws === 'design' && s.speed === 0, 'opens on Design with the simulation paused');
ok(await page.isVisible('#tools') && await page.isVisible('#palette') && !(await page.isVisible('#presets')), 'Design shows draw tools, hides time controls');
await page.keyboard.press('2'); await page.waitForTimeout(300);
// masses: podium, tower stacked on its roof, floors, undo/redo, push/pull, move carries the stack
await page.keyboard.press('Shift+M'); await drag(await scr(35, 0, 50), await scr(44, 0, 78));
s = await L(); const pod = s.masses[1];
ok(s.masses.length === 2 && pod.base === 0 && pod.w === 9 && pod.d === 28, `podium drawn ${pod && [pod.x, pod.z, pod.w, pod.d]}`);
await drag(await scr(36, 12, 60), await scr(43, 12, 72));
s = await L(); ok(s.masses.length === 3 && Math.abs(s.masses[2].base - 12) < 0.01, 'tower stacked on the podium roof');
await page.keyboard.press('v');
for (let k = 0; k < 3; k++) await page.keyboard.press(']');
s = await L(); ok(s.masses[2].floors === 15, 'tower +3 floors with ]');
await click(39.5, 53, 12); s = await L(); ok(s.sel === pod.id, 'podium selected by click');
await page.keyboard.press(']'); s = await L(); ok(s.masses[1].floors === 4 && Math.abs(s.masses[2].base - 16) < 0.01, 'podium floor lifts the tower');
await page.keyboard.press('Control+z'); s = await L(); ok(s.masses[1].floors === 3, 'undo');
await page.keyboard.press('Control+y'); s = await L(); ok(s.masses[1].floors === 4, 'redo');
const sel = s.masses[1]; await page.keyboard.press('p'); await click(sel.x + sel.w - 0.3, sel.z + sel.d / 2, 8); await page.keyboard.type(String(45 - sel.x - sel.w)); await page.keyboard.press('Enter'); await page.waitForTimeout(200); await page.keyboard.press('v');
s = await L(); ok(Math.abs(s.masses[1].w - 10) < 0.01, 'push / pull on the east face, typed a distance, widened the podium to 10 m: ' + s.masses[1].w);
await drag(await scr(37, 16, 52), await scr(36, 16, 52));
s = await L(); ok(s.masses[1].x === 34 && s.masses[2].x === 35, 'moving the podium carries the tower');
// plaza objects
await page.keyboard.press('Shift+T'); await click(50, 30); await click(53, 30);
s = await L(); ok(s.progs.filter((p) => p.type === 'tree').length === 6, 'two trees planted');
await page.keyboard.press('b'); await drag(await scr(62, 0, 51), await scr(68, 0, 51));
s = await L(); ok(s.progs.filter((p) => p.type === 'bench').length === 2, 'bench drawn');
// Snaptrude offset line: paving defaults to a 10 m band on the centre line
await page.keyboard.press('k'); s = await L(); ok(s.obj === 'paving' && s.geom === 'line', 'K picks paving and the Line tool');
const n0 = s.shapes.length;
await click(46, 31); await click(74, 31); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
s = await L(); let sh = s.shapes[s.shapes.length - 1];
ok(s.shapes.length === n0 + 1 && sh.geom === 'path' && sh.width === 10 && sh.align === 'c', 'offset line became a 10 m paving band');
ok(Math.abs((await area(sh)) - 280) < 1, 'band area = 28 m × 10 m: ' + (await area(sh)).toFixed(1));
// typed length: start a 4 m path, aim east, type 20, Enter
await page.click('#palette [data-obj="paving"]');
await page.fill('#p-width', '4'); await page.dispatchEvent('#p-width', 'change');
await click(36, 47); const aim = await scr(50, 0, 47); await page.mouse.move(aim[0], aim[1]); await page.waitForTimeout(80);
await page.keyboard.type('20'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
s = await L(); sh = s.shapes[s.shapes.length - 1];
ok(sh.width === 4 && Math.abs(sh.pts[1][0] - 56) < 0.01 && Math.abs(sh.pts[1][1] - 47) < 0.01, 'typed 20 m placed the point exactly: ' + JSON.stringify(sh.pts));
// freeform lawn: click four corners, click the first to close
await page.keyboard.press('n'); for (const [x, z] of [[58, 26], [75, 26], [75, 36], [58, 36], [58, 26]]) await click(x, z);
s = await L(); sh = s.shapes[s.shapes.length - 1]; ok(sh.type === 'lawn' && sh.geom === 'poly' && sh.pts.length === 4, 'freeform lawn closed on its first point');
ok(s.design.surf.lawn > 50, 'lawn counted in the dashboard: ' + Math.round(s.design.surf.lawn) + ' m²');
// circle of water
await page.keyboard.press('w'); await page.keyboard.press('o'); await drag(await scr(40, 0, 40), await scr(43, 0, 40));
s = await L(); sh = s.shapes[s.shapes.length - 1]; ok(sh.type === 'water' && sh.circle && sh.circle[2] === 3, 'water circle r 3 m');
// vertex edit on the lawn, then undo
await page.keyboard.press('v'); await click(70, 30, 0.04);
s = await L(); const lawn = s.shapes.find((q) => q.type === 'lawn'); ok(s.sel === lawn.id, 'lawn selected');
const le = [(lawn.pts[1][0] + lawn.pts[2][0]) / 2, (lawn.pts[1][1] + lawn.pts[2][1]) / 2]; await click(le[0], le[1], 0.1); await page.keyboard.press('1'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
s = await L(); let lw = s.shapes.find((q) => q.id === lawn.id); ok(lw.pts.filter((p, i) => p[0] !== lawn.pts[i][0] || p[1] !== lawn.pts[i][1]).length === 2, 'a click on an edge of the lawn selects it; 1, Enter pulls it 1 m out (no corner dots any more): ' + JSON.stringify(lw.pts));
await page.keyboard.press('Control+z'); s = await L(); lw = s.shapes.find((q) => q.id === lawn.id); ok(lw.pts[2][0] === 75 && lw.pts[2][1] === 36, 'undo restores the corner');
// a wall across the tower's entrance (its solid ground floor's door) is refused with a reason
await page.keyboard.press('h'); await page.fill('#p-width', '2'); await page.press('#p-width', 'Enter'); await page.waitForTimeout(100); const nW = (await L()).shapes.length;
await click(54, 54.8); await click(66, 54.8); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
s = await L(); ok(s.shapes.length === nW && /block a door/.test(await page.textContent('#toast')), 'wall over the tower entrance refused');
await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
await page.screenshot({ path: SP + 'w-design-plan.png' });
// Simulate tab
await page.click('#ws-sim'); await page.waitForTimeout(2500);
s = await L(); ok(s.ws === 'simulate' && s.speed > 0 && s.agents > 0, `Simulate runs: speed ${s.speed}, ${s.agents} people`);
ok(await page.isVisible('#presets') && !(await page.isVisible('#palette')) && await page.isVisible('#pin'), 'Simulate shows time and pin, hides drawing');
await page.keyboard.press('1'); await page.click('[data-pr="1"]'); await page.waitForTimeout(1500);
await page.screenshot({ path: SP + 'w-simulate-3d.png' });
await page.click('#ws-design'); await page.waitForTimeout(300); s = await L(); ok(s.ws === 'design' && s.speed === 0, 'back in Design the simulation pauses');
// interior rooms still edit
await page.click('#m-int'); await page.waitForTimeout(800);
const IL = () => page.evaluate(() => window.PFL_APP.sims.int.L.programs.map((p) => ({ id: p.id, x: p.x, w: p.w, z: p.z, d: p.d })));
const pan = (await IL()).find((q) => q.id === 'k1');
await click(pan.x + pan.w / 2, pan.z + pan.d / 2, 1.2);
ok(await page.evaluate(() => window.PFL_APP.st.sel && window.PFL_APP.st.sel.id) === 'k1', 'interior: pantry selected');
await click(pan.x + pan.w - 0.1, pan.z + pan.d / 2, 1.2); await page.keyboard.press('-'); await page.keyboard.press('1'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
let k1 = (await IL()).find((q) => q.id === 'k1'); ok(k1.w < pan.w, 'interior: the east face of the pantry selected and pushed in 1 m shrinks it (no side dots any more): ' + k1.w);
await page.keyboard.press('Control+z'); k1 = (await IL()).find((q) => q.id === 'k1'); ok(k1.w === pan.w, 'interior: undo');
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
