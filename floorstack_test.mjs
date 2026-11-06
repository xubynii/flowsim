// Scripted check of the per-floor programme editor in the mass card (section stack, From/To, schedule): node floorstack_test.mjs [screenshot dir]
import { chromium } from 'file:///C:/Users/sinnie/OneDrive/Desktop/tower-design-toolkit/node_modules/playwright/index.mjs';
const SP = process.argv[2] || './';
const browser = await chromium.launch({ executablePath: 'C:/Users/sinnie/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push('pageerror ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
await page.goto('file:///C:/Users/sinnie/OneDrive/Desktop/ped-flow-guide/index.html');
await page.waitForFunction(() => window.PFL_APP, null, { timeout: 30000 }); await page.waitForTimeout(800);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const scr = (x, y, z) => page.evaluate(([x, y, z]) => { const A = window.PFL_APP, p = A.st.panes[0], v = new THREE.Vector3(x, y, -z).project(A.camera), r = document.querySelector('#view canvas').getBoundingClientRect(); return [r.left + p.x + (v.x + 1) / 2 * p.w, r.top + p.y + (1 - v.y) / 2 * p.h]; }, [x, y, z]);
const S = () => page.evaluate(() => { const A = window.PFL_APP, t = A.sims.site.L.masses[0]; return { sel: A.st.sel && A.st.sel.name, sf: A.st.selFloors, bands: window.PFL.bandsOf(t).map((b) => b.use + b.floors).join(), dests: A.sims.site.dprogs.filter((d) => d.type !== 'lobby').map((d) => d.name).join(' | '), gens: A.sims.site.gens.filter((g) => g.key[0] === 'p').map((g) => g.type + ':' + g.pop).join(' ') }; });
const T = await page.evaluate(() => { const t = window.PFL_APP.sims.site.L.masses[0]; return [t.x, t.z, t.w, t.d, t.base]; });

// one click on the tower: the card shows the floor stack straight away
const c = await scr(T[0] + T[2] / 2, T[4] + 30, T[1] + 0.05); await page.mouse.click(c[0], c[1]); await page.waitForTimeout(300);
let s = await S(); ok(s.sel === 'Tower' && await page.isVisible('#fstackSvg svg'), 'selecting the tower shows its floor stack');
ok(await page.locator('#fstackSvg g[data-l]').count() === 17, 'one bar per floor: 17');
ok(await page.isDisabled('#fsUse'), 'the programme select waits for a floor');
await page.click('#fstackSvg g[data-l="3"]'); await page.waitForTimeout(200);
s = await S(); ok(s.sf && s.sf.from === 3 && s.sf.to === 3, 'clicking bar L3 selects L3');
await page.click('#fstackSvg g[data-l="6"]', { modifiers: ['Shift'] }); await page.waitForTimeout(200);
s = await S(); ok(s.sf.from === 3 && s.sf.to === 6, 'Shift-click on L6 extends to L3–L6');
ok(/L3–L6 · 4 floors/.test(await page.textContent('#fsInfo')), 'the editor line reads: ' + (await page.textContent('#fsInfo')).trim());
await page.selectOption('#fsUse', 'hotel'); await page.waitForTimeout(300);
s = await S(); ok(s.bands === 'restaurant1,office1,hotel4,office11' && /hotel:/.test(s.gens), 'L3–L6 became hotel: ' + s.bands + ' · ' + s.gens);
// From/To boxes
await page.fill('#fsA', '1'); await page.press('#fsA', 'Enter'); await page.waitForTimeout(150); await page.fill('#fsB', '1'); await page.press('#fsB', 'Enter'); await page.waitForTimeout(200);
s = await S(); ok(s.sf.from === 1 && s.sf.to === 1, 'From/To boxes select L1');
await page.selectOption('#fsUse', 'retail'); await page.waitForTimeout(300);
s = await S(); ok(s.bands === 'retail1,office1,hotel4,office11' && /Retail L1/.test(s.dests), 'L1 is retail and becomes a destination: ' + s.dests);
// schedule rows select floors too
await page.click('.fsched summary'); await page.click('.fsched tr[data-l="16"]'); await page.waitForTimeout(200);
s = await S(); ok(s.sf.from === 16, 'a schedule row selects its floor');
ok(await page.locator('.fsched tr.sel').count() === 1, 'the schedule marks the selected floor');
await page.click('#fstackSvg g[data-l="4"]'); await page.click('#fstackSvg g[data-l="5"]', { modifiers: ['Shift'] }); await page.waitForTimeout(200);
await page.click('#fsMain'); await page.waitForTimeout(300);
s = await S(); ok(s.bands === 'retail1,office1,hotel1,office2,hotel1,office11', 'Reset to office gives L4–5 back, L3 and L6 stay hotel: ' + s.bands);
const lbl = await page.locator('#fstackSvg text.zl').allTextContents(); ok(lbl.some((t) => /Hotel/.test(t)) && lbl.some((t) => /Retail/.test(t)), 'the stack labels each run: ' + lbl.join(' | '));
await page.screenshot({ path: SP + 'f-stack-card.png' });
await page.keyboard.press('Control+z'); await page.waitForTimeout(300); s = await S(); ok(s.bands === 'retail1,office1,hotel4,office11', 'Ctrl+Z undoes the reset');
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
