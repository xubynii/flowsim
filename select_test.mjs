// Scripted check of what a click selects: hover outline + tag, click-again cycling, Delete feedback: node select_test.mjs [screenshot dir]
import { chromium } from 'file:///C:/Users/sinnie/OneDrive/Desktop/tower-design-toolkit/node_modules/playwright/index.mjs';
const SP = process.argv[2] || './';
const browser = await chromium.launch({ executablePath: 'C:/Users/sinnie/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push('pageerror ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
await page.goto('file:///C:/Users/sinnie/OneDrive/Desktop/ped-flow-guide/index.html');
await page.waitForFunction(() => window.PFL_APP, null, { timeout: 30000 }); await page.waitForTimeout(800);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const scr = (x, y, z) => page.evaluate(([x, y, z]) => { const A = window.PFL_APP, p = A.st.panes[0], v = new THREE.Vector3(x, y, -z).project(A.camera), r = document.querySelector('#view canvas').getBoundingClientRect(); return [r.left + p.x + (v.x + 1) / 2 * p.w, r.top + p.y + (1 - v.y) / 2 * p.h]; }, [x, y, z]);
const info = () => page.evaluate(() => { const A = window.PFL_APP, t = document.querySelector('.hovertag'); return { masses: A.sims.site.L.masses.length, sel: A.st.sel && A.st.sel.name, tag: t && !t.hidden ? t.textContent : '', toast: document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent, cursor: document.getElementById('view').style.cursor }; });
const tw = () => page.evaluate(() => { const t = window.PFL_APP.sims.site.L.masses[0]; return [t.x, t.z, t.w, t.d, t.base, t.floors, window.PFL.bandsOf(t).map((b) => b.use + b.floors).join()]; });
let T = await tw();
const drag = async (a, b, steps = 8) => { await page.mouse.move(a[0], a[1]); await page.mouse.down(); for (let k = 1; k <= steps; k++) await page.mouse.move(a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps); await page.mouse.up(); await page.waitForTimeout(200); };
const progTypes = () => page.evaluate(() => window.PFL_APP.sims.site.L.programs.map((p) => p.type));
const hover = async (x, y, z) => { const c = await scr(x, y, z); await page.mouse.move(c[0] - 3, c[1] - 3); await page.mouse.move(c[0], c[1]); await page.waitForTimeout(150); return c; };

// the tower starts on the ground: its ground floor is a floor of the mass (food & drink), nothing sticks out under it
ok(T[4] === 0 && T[6] === 'restaurant1,office16' && !(await progTypes()).some((t) => ['lobby', 'cafe', 'food'].includes(t)), 'the tower stands on the ground, L1 food & drink, no pieces under it: ' + T[6]);
// lift it and draw a café under its corner, to check click-cycling between stacked pieces
await page.keyboard.press('2'); await page.waitForTimeout(300);
let c = await scr(50, 70, 72); await page.mouse.click(c[0], c[1]); await page.waitForTimeout(250);
await page.click('[data-gf="open"]'); await page.waitForTimeout(300); T = await tw(); ok(T[4] === 4.5, 'Open, lifted raises the tower to 4.5 m');
await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.keyboard.press('u'); await drag(await scr(66, 0, 58), await scr(73, 0, 65));
await page.keyboard.press('v'); await page.keyboard.press('Escape'); ok((await progTypes()).includes('cafe'), 'a café drawn under the lifted tower');
const fx = T[0] + T[2] * 0.8, fz = T[1] + T[3] * 0.2;
c = await hover(fx, 0, fz); let s = await info();
ok(/Café/.test(s.tag) && /under it/.test(s.tag) && s.cursor === 'pointer', 'hovering shows what a click selects, and that more is under it: ' + s.tag);
await page.mouse.click(c[0], c[1]); await page.waitForTimeout(250); s = await info(); ok(s.sel === 'Café', 'first click selects the café');
await hover(fx, 0, fz); s = await info(); ok(/Selected/.test(s.tag) && /click again for Tower/.test(s.tag), 'the tag says a second click reaches the tower: ' + s.tag);
await page.mouse.click(c[0], c[1]); await page.waitForTimeout(250); s = await info(); ok(s.sel === 'Tower' && /Tower · mass.*selected. Click again for Café/.test(s.toast), 'second click selects the tower: ' + s.toast);
await page.screenshot({ path: SP + 's-plan-cycle.png' });
await page.keyboard.press('Delete'); await page.waitForTimeout(400); s = await info();
ok(s.masses === 0 && /Tower deleted/.test(s.toast), 'Delete removes the tower and says so: ' + s.toast);
await page.keyboard.press('Control+z'); await page.waitForTimeout(400); s = await info(); ok(s.masses === 1, 'Ctrl+Z brings it back');
await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.keyboard.press('Delete'); await page.waitForTimeout(200); s = await info();
ok(/Nothing is selected/.test(s.toast), 'Delete with nothing selected explains: ' + s.toast);
// Solid ground floor: the café moves into the tower's L1 and the tower comes back down
c = await scr(50, 70, 72); await page.mouse.click(c[0], c[1]); await page.waitForTimeout(250);
await page.click('[data-gf="solid"]'); await page.waitForTimeout(300); T = await tw(); s = await info();
ok(T[4] === 0 && !(await progTypes()).includes('cafe') && T[6].startsWith('restaurant1') && /ground floor is now L1/.test(s.toast), 'Solid makes the ground floor L1 of the mass, the café moves into it: ' + s.toast);
await page.keyboard.press('Escape'); await page.keyboard.press('Escape');

// 3D: hover the tower, select it; the tag offers the floor; the tint shows the selection
await page.keyboard.press('1'); await page.waitForTimeout(400);
c = await hover(T[0] + T[2] / 2, T[4] + 6 * 4 + 2, T[1] + 0.05); s = await info(); ok(/Tower · mass, 17 floors/.test(s.tag), '3D hover names the mass: ' + s.tag);
await page.screenshot({ path: SP + 's-3d-hover.png' });
await page.mouse.click(c[0], c[1]); await page.waitForTimeout(250); await hover(T[0] + T[2] / 2, T[4] + 6 * 4 + 2, T[1] + 0.05); s = await info();
ok(s.sel === 'Tower' && /Selected/.test(s.tag) && /click to select its (south|north|east|west) face|click to select its top/.test(s.tag), 'selected: the tag offers the face under the pointer: ' + s.tag);
const tinted = await page.evaluate(() => { const A = window.PFL_APP; return A.st.sel ? true : false; });
await page.screenshot({ path: SP + 's-3d-selected.png' });
ok(tinted, 'selection kept');
await page.keyboard.press('Delete'); await page.waitForTimeout(400); s = await info(); ok(s.masses === 0, 'Delete in 3D removes the tower');
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
