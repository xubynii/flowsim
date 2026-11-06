import { chromium } from 'file:///C:/Users/sinnie/OneDrive/Desktop/tower-design-toolkit/node_modules/playwright/index.mjs';
const SP = process.argv[2] || './';
const browser = await chromium.launch({ executablePath: 'C:/Users/sinnie/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push('pageerror ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
await page.goto('file:///C:/Users/sinnie/OneDrive/Desktop/ped-flow-guide/index.html');
await page.waitForFunction(() => window.PFL_APP); await page.waitForTimeout(800);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
// project a world point through a given view's camera into page pixels (pane-aware)
const scr = (x, y, z, id) => page.evaluate(([x, y, z, id]) => { const A = window.PFL_APP, p = A.st.panes.find((q) => q.id === id), v = new THREE.Vector3(x, y, -z).project(A.cams[id]), r = document.querySelector('#view canvas').getBoundingClientRect(); return [r.left + p.x + (v.x + 1) / 2 * p.w, r.top + p.y + (1 - v.y) / 2 * p.h]; }, [x, y, z, id]);
const S = () => page.evaluate(() => { const A = window.PFL_APP; return { layout: A.st.layout, panes: A.st.panes.map((p) => p.id), sel: A.st.sel && A.st.sel.id, tower: { ...A.sims.site.L.masses[0] } }; });
const drag = async (a, b, steps = 10) => { await page.mouse.move(a[0], a[1]); await page.mouse.down(); for (let k = 1; k <= steps; k++) await page.mouse.move(a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps); await page.mouse.up(); await page.waitForTimeout(200); };
for (const [k, id] of [['1', '3d'], ['2', 'plan'], ['3', 'section'], ['4', 'elev']]) {
  await page.keyboard.press(k); await page.waitForTimeout(500);
  const s = await S(); ok(s.layout === id && s.panes.length === 1, `key ${k} -> ${id}`);
  await page.screenshot({ path: SP + `v-${id}.png` });
}
await page.keyboard.press('5'); await page.waitForTimeout(600);
let s = await S(); ok(s.panes.join() === 'elev,section,plan,3d', 'four-up layout ' + s.panes.join());
await page.screenshot({ path: SP + 'v-quad.png' });
// section slider moves the cut (open the collapsed Views section first)
await page.evaluate(() => window.PFL_APP.viewSettings(true)); await page.waitForTimeout(200);
await page.fill('#v-sec', '40'); await page.dispatchEvent('#v-sec', 'input'); await page.waitForTimeout(300);
ok(await page.evaluate(() => window.PFL_APP.st.secPos.site) === 40, 'section slider sets cut to z 40');
await page.fill('#v-sec', '66'); await page.dispatchEvent('#v-sec', 'input'); await page.waitForTimeout(300);
// design in the section pane: click the tower's cut fill to select it
let c = await scr(60, 40, 66, 'section'); await page.mouse.click(c[0], c[1]); await page.waitForTimeout(200);
s = await S(); ok(s.sel === 'b1', 'tower selected by clicking its cut in the section: ' + s.sel);
// push / pull in the elevation pane: near the roof line the top is meant; click, move up 12 m, click
const t0 = s.tower; const top = t0.base + t0.floors * t0.ftf; await page.keyboard.press('p');
const a = await scr(t0.x + t0.w / 2, top - 0.3, t0.z, 'elev'); await page.mouse.move(a[0], a[1]); await page.waitForTimeout(100); await page.mouse.click(a[0], a[1]); await page.waitForTimeout(150);
const b = await scr(t0.x + t0.w / 2, top + 12, t0.z, 'elev'); await page.mouse.move(b[0], b[1]); await page.waitForTimeout(100); await page.mouse.click(b[0], b[1]); await page.waitForTimeout(250);
s = await S(); ok(s.tower.floors === t0.floors + 3, `floors pulled up in elevation: ${t0.floors} -> ${s.tower.floors}`);
// the east face from the elevation (seen from the south, east is the right-hand edge)
const t1 = s.tower, top1 = t1.base + t1.floors * t1.ftf;
const e0 = await scr(t1.x + t1.w - 0.3, top1 / 2, t1.z, 'elev'); await page.mouse.move(e0[0], e0[1]); await page.waitForTimeout(100); await page.mouse.click(e0[0], e0[1]); await page.waitForTimeout(150);
const e1 = await scr(t1.x + t1.w - 2, top1 / 2, t1.z, 'elev'); await page.mouse.move(e1[0], e1[1]); await page.waitForTimeout(100); await page.mouse.click(e1[0], e1[1]); await page.waitForTimeout(250);
s = await S(); ok(Math.abs(s.tower.w - (t0.w - 2)) < 0.01, 'east face pushed in from the elevation: w ' + s.tower.w);
await page.keyboard.press('v');
await page.keyboard.press('Control+z'); await page.keyboard.press('Control+z');
s = await S(); ok(s.tower.floors === t0.floors && s.tower.w === t0.w, 'two undos restore');
// drawing in a side pane is refused with a message
await page.keyboard.press('Shift+M'); c = await scr(40, 5, 66, 'section'); await page.mouse.click(c[0], c[1]); await page.waitForTimeout(200);
ok(/Draw new pieces in the plan or 3D/.test(await page.textContent('#toast')), 'draw in section refused with a message');
await page.keyboard.press('Escape');
// elevation side switch and N-S section
await page.evaluate(() => window.PFL_APP.viewSettings(true)); await page.click('[data-side="E"]'); await page.click('[data-sax="ns"]'); await page.waitForTimeout(500);
const tags = await page.textContent('#panetags'); ok(/seen from the east/i.test(tags) && /looking east/i.test(tags), 'tags: ' + tags.replace(/\s+/g, ' '));
await page.screenshot({ path: SP + 'v-quad2.png' });
// interior four-up
await page.evaluate(() => document.getElementById('m-int').click()); await page.waitForTimeout(800);
await page.screenshot({ path: SP + 'v-int.png' });
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
