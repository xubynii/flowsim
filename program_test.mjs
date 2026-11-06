// Scripted check that the simulation follows each mass's programme: node program_test.mjs [screenshot dir]
import { chromium } from 'file:///C:/Users/sinnie/OneDrive/Desktop/tower-design-toolkit/node_modules/playwright/index.mjs';
const SP = process.argv[2] || './';
const browser = await chromium.launch({ executablePath: 'C:/Users/sinnie/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push('pageerror ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
await page.goto('file:///C:/Users/sinnie/OneDrive/Desktop/ped-flow-guide/index.html');
await page.waitForFunction(() => window.PFL_APP, null, { timeout: 30000 }); await page.waitForTimeout(800);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const scr = (x, y, z) => page.evaluate(([x, y, z]) => { const A = window.PFL_APP, p = A.st.panes[0], v = new THREE.Vector3(x, y, -z).project(A.camera), r = document.querySelector('#view canvas').getBoundingClientRect(); return [r.left + p.x + (v.x + 1) / 2 * p.w, r.top + p.y + (1 - v.y) / 2 * p.h]; }, [x, y, z]);
const S = () => page.evaluate(() => { const A = window.PFL_APP, site = A.sims.site, t = site.L.masses[0]; return { bands: window.PFL.bandsOf(t), floors: t.floors, use: t.use, gens: site.gens.filter((g) => g.key[0] === 'p').map((g) => g.type + ':' + g.pop), dests: site.dprogs.filter((d) => d.type !== 'lobby').map((d) => d.name + ':' + d.cap), byUse: site.design.byUse, fills: (A.PFL_dbg = 0, null) }; });
const click = async (x, z, y = 0) => { const c = await scr(x, y, z); await page.mouse.move(c[0], c[1]); await page.mouse.click(c[0], c[1]); await page.waitForTimeout(150); };

await page.keyboard.press('2'); await page.waitForTimeout(300);
await click(71, 74, 68);
let s = await S(); ok(s.bands.length === 2 && s.bands[0].use === 'restaurant' && s.bands[0].floors === 1 && s.bands[1].use === 'office' && s.bands[1].floors === 16 && s.gens.join() === 'office:412', 'tower starts as a food & drink ground floor under 16 floors of office: ' + s.gens.join());
ok(await page.isVisible('.prog .band'), 'the card shows the programme');
await page.click('#addBase'); await page.waitForTimeout(300);
s = await S(); ok(s.bands[0].use === 'retail' && s.bands[0].floors === 1 && s.bands[1].use === 'restaurant' && s.floors === 18, 'Add a use at the ground: retail L1 under the food & drink floor, tower grows: ' + JSON.stringify(s.bands));
ok(s.dests.some((d) => /Tower · Retail L1:/.test(d)) && s.dests.some((d) => /Tower · Food & drink L2:/.test(d)), 'the retail and food floors are destinations: ' + s.dests.join(', '));
await page.click('#addBand'); await page.waitForTimeout(300);
s = await S(); ok(s.bands.length === 4 && s.bands[3].use === 'residential', 'Add a use on top: homes above the offices: ' + JSON.stringify(s.bands));
ok(s.gens.some((g) => g.startsWith('office:')) && s.gens.some((g) => g.startsWith('residential:')), 'office and residential entrances keep separate patterns: ' + s.gens.join(' '));
ok(s.byUse.retail > 0 && s.byUse.office > 0 && s.byUse.residential > 0, 'dashboard splits the floor area by use');
// change the top band to hotel through its select
await page.selectOption('.band select[data-bu="3"]', 'hotel'); await page.waitForTimeout(300);
s = await S(); ok(s.bands[3].use === 'hotel' && s.gens.some((g) => g.startsWith('hotel:')), 'top floors switched to hotel: ' + s.gens.join(' '));
// give the retail band 3 floors: the tower grows by one floor and the destination grows
const cap0 = +s.dests.find((d) => /Retail/.test(d)).split(':').pop();
await page.fill('.band input[data-bf="0"]', '3'); await page.press('.band input[data-bf="0"]', 'Enter'); await page.waitForTimeout(300);
s = await S(); const cap1 = +s.dests.find((d) => /Retail/.test(d)).split(':').pop();
ok(s.floors === 20 && s.bands[0].floors === 3 && cap1 > cap0, `retail L1–3: tower 20 floors, capacity ${cap0} → ${cap1}`);
const card = await page.textContent('#selcard'); ok(/Hotel guests/.test(card) && /visitors at once/.test(card) && /Shop and venue staff/.test(card), 'card lists guests, staff and visitor capacity');
await page.keyboard.press('Escape'); await page.keyboard.press('1'); await page.waitForTimeout(300);
await page.screenshot({ path: SP + 'p-stack-3d.png' });
await page.keyboard.press('3'); await page.waitForTimeout(300); await page.screenshot({ path: SP + 'p-stack-section.png' });
// the simulation responds: at lunch the tower's own retail draws visitors
await page.click('#ws-sim'); await page.waitForTimeout(400); await page.click('[data-pr="1"]'); await page.waitForTimeout(2500);
const v = await page.evaluate(() => { const M = window.PFL.siteMetrics(window.PFL_APP.sims.site); return M.progs.filter((r) => /Tower/.test(r.p.name)).map((r) => [r.p.name, Math.round(r.visits)]); });
ok(v.length && v.every((r) => r[1] > 0), 'at lunch the tower retail is visited: ' + JSON.stringify(v));
await page.screenshot({ path: SP + 'p-stack-sim.png' });
// undo back to a single office band
await page.click('#ws-design'); await page.waitForTimeout(300);
for (let k = 0; k < 4; k++) await page.keyboard.press('Control+z');
s = await S(); ok(s.bands.length === 2 && s.bands[1].use === 'office' && s.floors === 17, 'Ctrl+Z steps back to the starting tower');
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
