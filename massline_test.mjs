// Scripted check of Clear site and line-modelled masses: node massline_test.mjs [screenshot dir]
import { chromium } from 'file:///C:/Users/sinnie/OneDrive/Desktop/tower-design-toolkit/node_modules/playwright/index.mjs';
const SP = process.argv[2] || './';
const browser = await chromium.launch({ executablePath: 'C:/Users/sinnie/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push('pageerror ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
await page.goto('file:///C:/Users/sinnie/OneDrive/Desktop/ped-flow-guide/index.html');
await page.waitForFunction(() => window.PFL_APP, null, { timeout: 30000 }); await page.waitForTimeout(800);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const scr = (x, y, z) => page.evaluate(([x, y, z]) => { const A = window.PFL_APP, p = A.st.panes[0], v = new THREE.Vector3(x, y, -z).project(A.camera), r = document.querySelector('#view canvas').getBoundingClientRect(); return [r.left + p.x + (v.x + 1) / 2 * p.w, r.top + p.y + (1 - v.y) / 2 * p.h]; }, [x, y, z]);
const S = () => page.evaluate(() => { const A = window.PFL_APP, L = A.sims.site.L; return { masses: JSON.parse(JSON.stringify(L.masses)), progs: L.programs.length, shapes: L.shapes.length, design: A.sims.site.design, geom: A.st.geom, obj: A.st.obj, sel: A.st.sel && A.st.sel.id }; });
const click = async (x, z, y = 0) => { const c = await scr(x, y, z); await page.mouse.move(c[0], c[1]); await page.mouse.click(c[0], c[1]); await page.waitForTimeout(120); };
const drag = async (a, b, steps = 8) => { await page.mouse.move(a[0], a[1]); await page.mouse.down(); for (let k = 1; k <= steps; k++) await page.mouse.move(a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps); await page.mouse.up(); await page.waitForTimeout(150); };
const area = (m) => page.evaluate((m) => window.PFL.massArea(m), m);

ok(await page.isVisible('#clearSite') && (await page.textContent('#clearSite')).trim() === 'Clear site', 'Clear site button in the Draw panel');
await page.click('#clearSite'); await page.waitForTimeout(200);
let s = await S(); ok(s.masses.length === 0 && s.progs === 0 && s.shapes === 0, 'Clear site empties masses, uses and surfaces');
ok(/cleared/.test(await page.textContent('#toast')), 'toast says it was cleared');
ok(s.design.gfa === 0 && Math.abs(s.design.plazaA - s.design.siteA) < 1, 'dashboard reads an empty site');
await page.keyboard.press('Control+z'); s = await S(); ok(s.masses.length === 1 && s.progs > 5, 'Ctrl+Z brings the site back');
await page.click('#clearSite'); await page.waitForTimeout(150);
await page.keyboard.press('2'); await page.waitForTimeout(300); await page.mouse.move(700, 600); await page.mouse.wheel(0, 240); await page.waitForTimeout(300);   // a notch out, so the north of the site clears the tool options under the status line
// L with the default Mass object: the Line tool is enabled and draws a 10 m offset bar
ok(!(await page.isDisabled('#tools [data-tool="line"]')), 'Line button is enabled');
await page.keyboard.press('l'); s = await S(); ok(s.geom === 'line' && s.obj === 'mass', 'L draws masses with the Line tool');
await click(36, 30); await click(60, 30); await click(60, 50); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
s = await S(); let m = s.masses[s.masses.length - 1];
ok(m && m.fp && m.fp.geom === 'path' && m.fp.width === 10 && m.base === 0, 'offset line became a 10 m deep mass');
ok(m && Math.abs((await area(m)) - 440) < 1, 'its footprint = (24 + 20) m × 10 m: ' + (m && (await area(m)).toFixed(1)));
ok(m && m.x === 36 && m.z === 25 && m.w === 29 && m.d === 25, `its bounding box ${m && [m.x, m.z, m.w, m.d]}`);
ok(s.design.gfa === 440 * 3, 'GFA counts the real footprint × 3 floors: ' + s.design.gfa);
const barId = m.id;
// freeform L-shaped footprint (Freeform mode in the status line)
await page.click('#hint [data-lm="free"]'); await page.waitForTimeout(80);
for (const [x, z] of [[64, 56], [76, 56], [76, 62], [70, 62], [70, 78], [64, 78], [64, 56]]) await click(x, z);
s = await S(); m = s.masses[s.masses.length - 1];
ok(m && m.fp && m.fp.geom === 'poly' && m.fp.pts.length === 6 && Math.abs((await area(m)) - (12 * 6 + 6 * 16)) < 0.5, 'freeform L footprint, 168 m²');
const lId = m.id;
// stack a round tower on the bar's roof with the Circle tool
await page.keyboard.press('o'); await drag(await scr(55, 12, 30), await scr(59, 12, 30));
s = await S(); m = s.masses[s.masses.length - 1];
ok(m && m.fp && m.fp.circle && m.fp.circle[2] === 4 && Math.abs(m.base - 12) < 0.01, `round tower r 4 m stacked on the bar at ${m && m.base} m`);
// select the L and drag a corner; Ctrl+Z
await page.keyboard.press('v'); await click(67, 70, 9);
s = await S(); ok(s.sel === lId, 'L block selected');
await drag(await scr(76, 9, 56), await scr(77, 9, 52));
s = await S(); m = s.masses.find((q) => q.id === lId); ok(m.fp.pts[1][0] === 77 && m.fp.pts[1][1] === 52 && m.z === 52, 'corner dragged; bounding box follows: ' + JSON.stringify(m.fp.pts[1]));
await page.keyboard.press('Control+z'); s = await S(); m = s.masses.find((q) => q.id === lId); ok(m.fp.pts[1][0] === 76 && m.z === 56, 'undo restores the corner');
// moving the bar carries the round tower and keeps the footprint
await click(40, 30, 12); s = await S(); ok(s.sel === barId, 'bar selected');
await page.keyboard.press('ArrowRight'); s = await S(); const bar = s.masses.find((q) => q.id === barId), rt = s.masses[s.masses.length - 1];
ok(bar.fp.pts[0][0] === 37 && bar.x === 37 && rt.fp.circle[0] === 56, 'nudging the bar moves its footprint and the tower on it');
await page.keyboard.press('Shift+R'); s = await S(); const br = s.masses.find((q) => q.id === barId); ok(Math.abs(br.w - 25) < 0.01 && Math.abs(br.d - 29) < 0.01, 'Shift+R rotates the footprint 90°');
await page.keyboard.press('Control+z');
await page.keyboard.press('Escape'); await page.keyboard.press('1'); await page.waitForTimeout(300);
await page.screenshot({ path: SP + 'm-lines-3d.png' });
await page.keyboard.press('5'); await page.waitForTimeout(500);
await page.screenshot({ path: SP + 'm-lines-quad.png' });
// the simulation runs on line-drawn buildings
await page.click('#ws-sim'); await page.waitForTimeout(2500);
const ag = await page.evaluate(() => ({ n: window.PFL_APP.sims.site.agents.length, gens: window.PFL_APP.sims.site.gens.filter((g) => g.key[0] === 'p').map((g) => g.pop) }));
ok(ag.n > 0 && ag.gens.length >= 2, `Simulate runs with the drawn buildings: ${ag.n} people, entrances ${ag.gens.join(', ')}`);
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
