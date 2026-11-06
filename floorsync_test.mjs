// Scripted check that the Interior tab stays in sync with the site design: node floorsync_test.mjs [screenshot dir]
import { chromium } from 'file:///C:/Users/sinnie/OneDrive/Desktop/tower-design-toolkit/node_modules/playwright/index.mjs';
const SP = process.argv[2] || './';
const browser = await chromium.launch({ executablePath: 'C:/Users/sinnie/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push('pageerror ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
await page.goto('file:///C:/Users/sinnie/OneDrive/Desktop/ped-flow-guide/index.html');
await page.waitForFunction(() => window.PFL_APP, null, { timeout: 30000 }); await page.waitForTimeout(800);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const scr = (x, y, z) => page.evaluate(([x, y, z]) => { const A = window.PFL_APP, p = A.st.panes[0], v = new THREE.Vector3(x, y, -z).project(A.camera), r = document.querySelector('#view canvas').getBoundingClientRect(); return [r.left + p.x + (v.x + 1) / 2 * p.w, r.top + p.y + (1 - v.y) / 2 * p.h]; }, [x, y, z]);
const S = () => page.evaluate(() => { const A = window.PFL_APP, I = A.sims.int, site = A.sims.site; return { mode: A.st.mode, W: I.L.W, D: I.L.D, plate: !!I.L.plate, massId: I.L.massId, desks: I.people.length, rooms: I.L.programs.length, out: I.L.programs.filter((p) => p.out).length, sitePop: site.gens.filter((g) => g.key === 'p:eb1' && g.type === 'office').map((g) => g.pop - (site.L.masses[0] ? window.PFL.massPop(site.L.masses[0]).staff : 0))[0], tower: { ...site.L.masses[0], floor: site.L.masses[0] && { auto: site.L.masses[0].floor && site.L.masses[0].floor.auto } }, pick: document.getElementById('floorPick').textContent }; });
const drag = async (a, b, steps = 8) => { await page.mouse.move(a[0], a[1]); await page.mouse.down(); for (let k = 1; k <= steps; k++) await page.mouse.move(a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps); await page.mouse.up(); await page.waitForTimeout(150); };
const click = async (x, z, y = 0) => { const c = await scr(x, y, z); await page.mouse.move(c[0], c[1]); await page.mouse.click(c[0], c[1]); await page.waitForTimeout(120); };

// the tower's floor
await page.click('#m-int'); await page.waitForTimeout(800);
let s = await S(); const desks0 = s.desks;
ok(s.plate && s.massId === 'b1' && s.W === 28 && s.D === 20, `Interior shows the tower's 28 × 20 m plate`);
ok(/Tower/.test(s.pick) && /office workers/.test(s.pick), 'the panel names the building and its people');
await page.click('#m-mass'); await page.waitForTimeout(400);
s = await S(); ok(s.sitePop === desks0 * 16, `plaza simulation uses ${desks0} desks × 16 floors = ${s.sitePop}`);
// add a team on the floor -> the building's population on the site rises
await page.click('#m-int'); await page.waitForTimeout(600);
const team = await page.evaluate(() => { const p = window.PFL_APP.sims.int.L.programs.filter((q) => q.type === 'desks').pop(); return { x: p.x + p.w / 2, z: p.z + p.d / 2 }; });
await click(team.x, team.z, 0.4); await page.keyboard.press('Delete'); await page.waitForTimeout(300);
s = await S(); const desks1 = s.desks; ok(desks1 < desks0, `deleting a team on the floor removes its desks: ${desks0} → ${desks1}`);
ok(/edited the office rooms/.test(s.pick), 'the floor is now marked as edited');
await page.click('#m-mass'); await page.waitForTimeout(400);
s = await S(); ok(s.sitePop === desks1 * 16, `site population follows: ${s.sitePop}`);
ok(s.tower.floor.auto === false, 'the tower carries the edited floor');
// narrow the tower on the site: rooms beyond the new edge are flagged, not lost
await page.keyboard.press('2'); await page.waitForTimeout(300);
await click(71, 74, 68); const t = (await S()).tower;
await page.keyboard.press('p'); await click(t.x + t.w - 0.3, t.z + t.d / 2, 68); await page.keyboard.press('-'); await page.keyboard.press('8'); await page.keyboard.press('Enter'); await page.waitForTimeout(200); await page.keyboard.press('v');
s = await S(); ok(s.tower.w === 20, 'tower narrowed to 20 m on the site with push / pull on its east edge, typed -8: ' + s.tower.w);
await page.click('#m-int'); await page.waitForTimeout(800);
s = await S(); ok(s.W === 20 && s.out > 0, `floor plate follows (20 m); ${s.out} rooms flagged outside`);
await page.screenshot({ path: SP + 'f-flagged.png' });
// Reset layout on the floor regenerates the automatic layout for the new plate
await page.click('#resetLayout'); await page.waitForTimeout(500);
s = await S(); ok(s.out === 0 && s.rooms > 3 && /automatic/.test(s.pick), `automatic floor for the new plate: ${s.rooms} rooms, ${s.desks} desks`);
// an L-shaped office drawn with the Line tool gets an L-shaped floor
await page.click('#m-mass'); await page.waitForTimeout(400);
await page.keyboard.press('l'); await page.click('#hint [data-lm="free"]');
for (const [x, z] of [[34, 30], [56, 30], [56, 38], [44, 38], [44, 54], [34, 54], [34, 30]]) await click(x, z);
await page.keyboard.press('Escape');
const lid = await page.evaluate(() => { const L = window.PFL_APP.sims.site.L; return L.masses[L.masses.length - 1].id; });
await page.click('#m-int'); await page.waitForTimeout(600);
await page.selectOption('#fl-mass', lid); await page.waitForTimeout(600);
s = await S(); ok(s.massId === lid && s.W === 22 && s.D === 24 && s.out === 0 && s.desks > 0, `L-shaped building: 22 × 24 m plate, ${s.rooms} rooms, ${s.desks} desks, none outside`);
const inL = await page.evaluate(() => { const I = window.PFL_APP.sims.int, P = I.L.plate; return I.L.programs.every((p) => [[p.x, p.z], [p.x + p.w, p.z + p.d]].every(([x, z]) => window.PFL.inPoly(Math.min(Math.max(x, 0.01), I.L.W - 0.01), Math.min(Math.max(z, 0.01), I.L.D - 0.01), P[0]))); });
ok(inL, 'every room sits inside the L');
await page.keyboard.press('1'); await page.waitForTimeout(300); await page.screenshot({ path: SP + 'f-lfloor-3d.png' });
await page.keyboard.press('2'); await page.waitForTimeout(300); await page.screenshot({ path: SP + 'f-lfloor-plan.png' });
// clear the site -> the floor becomes a stand-in with a note
await page.click('#m-mass'); await page.waitForTimeout(300); await page.click('#clearSite'); await page.waitForTimeout(300);
await page.click('#m-int'); await page.waitForTimeout(600);
s = await S(); ok(!s.plate && /no building/i.test(s.pick), 'with no office building the floor is a stand-in, and says so');
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
