// Scripted check of the smart guides: the pointer snaps to endpoints, midpoints, edges and alignments with corners (guide lines), a direction parallel or perpendicular to an edge snaps and is named; moves and side pulls show what they line up with: node guide_test.mjs [screenshot dir]
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
const hover = async (x, z) => { const c = await scr(x, 0, z); await page.mouse.move(c[0], c[1]); await page.waitForTimeout(150); return c; };
const clickAt = async (x, z) => { const c = await hover(x, z); await page.mouse.click(c[0], c[1]); await page.waitForTimeout(200); };
const infer = (x, z, from) => page.evaluate(([x, z, from]) => window.PFL_APP.infer(x, z, from), [x, z, from || null]);
const S = () => page.evaluate(() => { const A = window.PFL_APP, d = A.st.draft; let guides = 0, markers = 0; A.overlay.traverse((o) => { if (o.isLineSegments && o.renderOrder === 23) guides++; if (o.isMesh && o.renderOrder === 24) markers++; }); return { cur: d && d.cur, inf: d && d.inf && { kind: d.inf.kind, label: d.inf.label }, tag: A.overlay.children.map((c) => c.userData && c.userData.text).filter(Boolean).join(' | '), guides, markers, sel: A.st.sel && A.st.sel.name }; });

await page.click('#m-mass'); await page.waitForTimeout(300); await key('2'); await page.waitForTimeout(400);
// the engine: the demo tower is at 46..74 x 56..76
let i = await infer(46.4, 56.3); ok(i.kind === 'corner' && i.x === 46 && i.z === 56 && /Endpoint · Tower/.test(i.label), 'near a corner of the tower: Endpoint · Tower at 46, 56: ' + JSON.stringify(i));
i = await infer(60.2, 56.4); ok(i.kind === 'mid' && i.x === 60 && i.z === 56 && /Midpoint · Tower/.test(i.label), 'near the middle of its south edge: Midpoint: ' + JSON.stringify(i));
i = await infer(52, 56.5); ok(i.kind === 'edge' && i.z === 56 && /On edge · Tower/.test(i.label), 'near the edge: On edge, pulled onto it: ' + JSON.stringify(i));
i = await infer(46.3, 44); ok(i.kind === 'align' && i.x === 46 && i.guides >= 1 && /In line with Tower/.test(i.label), 'off the tower but in line with its west edge: a guide from the corner: ' + JSON.stringify(i));
i = await infer(43.5, 52.3, [36, 52]); ok(i.kind === 'dir' && i.z === 52 && i.rel === 'parallel' && /Parallel to/.test(i.label), 'a nearly east line from 36, 52 snaps parallel to an edge: ' + JSON.stringify(i));
i = await infer(36.3, 50, [36, 44]); ok(i.x === 36 && (i.rel === 'parallel' || i.rel === 'perpendicular') && /Perpendicular to|Parallel to/.test(i.label), 'a nearly north line lands on x = 36 and is named perpendicular or parallel: ' + JSON.stringify(i));
i = await infer(40, 48.1, [36, 42]); ok(i.kind === 'grid' && !i.rel, 'a 57° line snaps to nothing but the grid: ' + JSON.stringify(i));
// drawing: the guides show while drawing a paving
await key('k'); await hover(46.3, 56.4); let s = await S();
ok(s.markers === 1 && /Endpoint · Tower/.test(s.tag), 'before the first click the pointer shows its snap: Endpoint · Tower');
await clickAt(40, 50); await hover(46.3, 56.4); s = await S();
ok(s.cur && s.cur[0] === 46 && s.cur[1] === 56 && s.inf && s.inf.kind === 'corner' && /Endpoint · Tower/.test(s.tag), 'the next point snaps to the tower corner and the tag names it: ' + s.tag);
await page.screenshot({ path: SP + 'g-corner.png' });
await hover(52.5, 50.3); s = await S();
ok(s.cur && s.cur[1] === 50 && s.inf && s.inf.kind === 'dir' && /Parallel to/.test(s.tag) && s.guides >= 2, 'a nearly east segment from 40, 50 snaps parallel with a magenta guide: ' + s.tag);
await page.screenshot({ path: SP + 'g-parallel.png' });
await hover(46.3, 40); s = await S(); ok(s.inf && s.inf.kind === 'align' && s.guides >= 1 && /In line with Tower/.test(s.tag), 'in line with the tower corner: a dashed guide and the name: ' + s.tag);
await page.screenshot({ path: SP + 'g-align.png' });
await key('Escape'); await key('Escape');
// moving: the Shop (36, 30, 6 x 5) dragged east until its west side lines up with the tower
await key('v'); const sh = { x: 36, z: 30, w: 6, d: 5 };
await clickAt(sh.x + sh.w / 2, sh.z + sh.d / 2); s = await S(); ok(s.sel === 'Shop', 'the Shop selected');
let c0 = await scr(sh.x + sh.w / 2, 0, sh.z + sh.d / 2), c1 = await scr(sh.x + sh.w / 2 + 9.7, 0, sh.z + sh.d / 2);
await page.mouse.move(c0[0], c0[1]); await page.mouse.down(); await page.mouse.move(c1[0], c1[1], { steps: 8 }); await page.waitForTimeout(250); s = await S();
const shx = await page.evaluate(() => window.PFL_APP.sims.site.L.programs.find((p) => p.name === 'Shop').x);
ok(shx === 46 && s.guides >= 1 && /In line with Tower/.test(s.tag), `dragged 9.7 m it snaps 10 m so its west side lines up with the tower, with a guide: x ${shx} · ${s.tag}`);
await page.screenshot({ path: SP + 'g-move.png' });
await page.mouse.up(); await page.waitForTimeout(300); s = await S(); ok(s.guides === 0, 'the guides go when the move ends');
await key('Control+z');
// pulling a side: the Shop's east face dragged to the tower's west edge
await clickAt(sh.x + sh.w / 2, sh.z + sh.d / 2); await clickAt(sh.x + sh.w - 0.2, sh.z + sh.d / 2); s = await S();
c0 = await scr(sh.x + sh.w - 0.2, 0, sh.z + sh.d / 2); c1 = await scr(46.3, 0, sh.z + sh.d / 2);
await page.mouse.move(c0[0], c0[1]); await page.mouse.down(); await page.mouse.move(c1[0], c1[1], { steps: 8 }); await page.waitForTimeout(250); s = await S();
ok(s.guides >= 1 && /In line with Tower/.test(s.tag), 'pulling the east face near x = 46 shows the alignment with the tower: ' + s.tag);
await page.mouse.up(); await page.waitForTimeout(300); const shw = await page.evaluate(() => window.PFL_APP.sims.site.L.programs.find((p) => p.name === 'Shop').w);
ok(shw === 10, 'and it lands exactly on it: the Shop is now 10 m long');
await key('Control+z'); await key('Escape'); await key('Escape');
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
