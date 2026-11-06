// Scripted check of the modelling keyboard commands: node keys_test.mjs [screenshot dir]
import { chromium } from 'file:///C:/Users/sinnie/OneDrive/Desktop/tower-design-toolkit/node_modules/playwright/index.mjs';
const SP = process.argv[2] || './';
const browser = await chromium.launch({ executablePath: 'C:/Users/sinnie/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push('pageerror ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
await page.goto('file:///C:/Users/sinnie/OneDrive/Desktop/ped-flow-guide/index.html');
await page.waitForFunction(() => window.PFL_APP, null, { timeout: 30000 }); await page.waitForTimeout(800);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const scr = (x, y, z) => page.evaluate(([x, y, z]) => { const A = window.PFL_APP, p = A.st.panes[0], v = new THREE.Vector3(x, y, -z).project(A.camera), r = document.querySelector('#view canvas').getBoundingClientRect(); return [r.left + p.x + (v.x + 1) / 2 * p.w, r.top + p.y + (1 - v.y) / 2 * p.h]; }, [x, y, z]);
const S = () => page.evaluate(() => { const A = window.PFL_APP, L = A.sims.site.L; return { progs: L.programs.map((p) => ({ ...p, doorPt: undefined })), masses: L.masses.map((m) => ({ ...m })), shapes: JSON.parse(JSON.stringify(L.shapes)), sel: A.st.sel && A.st.sel.id, multi: A.st.multi.map((o) => o.id), geom: A.st.geom, active: document.activeElement && document.activeElement.tagName, help: !document.getElementById('popHelp').hidden, plan: A.cams.plan.position.toArray().map((v) => +v.toFixed(1)), zoom: +A.cams.plan.zoom.toFixed(2) }; });
const click = async (x, z, y = 0, opts) => { const c = await scr(x, y, z); await page.mouse.move(c[0], c[1]); await page.mouse.click(c[0], c[1], opts); await page.waitForTimeout(120); };
const hover = async (x, z, y = 0) => { const c = await scr(x, y, z); await page.mouse.move(c[0], c[1]); await page.waitForTimeout(80); };
const sel = (s) => s.multi.length ? s.multi : (s.sel ? [s.sel] : []);

await page.keyboard.press('2'); await page.waitForTimeout(300);
// select the shop, copy, paste at the cursor, delete, undo, redo
await click(39, 32.5, 4.5); let s = await S(); ok(s.sel === 'p4', 'click selects the shop');
const n0 = s.progs.length;
await page.keyboard.press('Control+c'); await hover(40, 53); await page.keyboard.press('Control+v'); await page.waitForTimeout(200);
s = await S(); const cp = s.progs[s.progs.length - 1];
ok(s.progs.length === n0 + 1 && cp.type === 'retail' && cp.x === 37 && cp.z === 50.5, `Ctrl+C, Ctrl+V pastes at the cursor: ${cp.x}, ${cp.z}`);
ok(s.sel === cp.id, 'the pasted copy is selected');
await page.keyboard.press('Delete'); s = await S(); ok(s.progs.length === n0 && !s.sel, 'Delete removes it');
await page.keyboard.press('Control+z'); s = await S(); ok(s.progs.length === n0 + 1, 'Ctrl+Z brings it back');
await page.keyboard.press('Control+Shift+z'); s = await S(); ok(s.progs.length === n0, 'Ctrl+Shift+Z redoes the delete');
// Shift+drag window selection around the four street trees
const a = await scr(34, 0, 22.6), b = await scr(76, 0, 25.5);
await page.keyboard.down('Shift'); await page.mouse.move(a[0], a[1]); await page.mouse.down(); await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); await page.mouse.move(b[0], b[1]); await page.mouse.up(); await page.keyboard.up('Shift'); await page.waitForTimeout(200);
s = await S(); ok(s.multi.length === 4 && s.multi.every((id) => id.startsWith('t')), 'Shift+drag window selects the four trees: ' + s.multi.join(','));
const z0 = s.progs.filter((p) => p.type === 'tree').map((p) => p.z);
await page.keyboard.press('ArrowUp'); s = await S();
ok(s.progs.filter((p) => p.type === 'tree').every((p, i) => p.z === z0[i] + 1), 'ArrowUp nudges all four by 1 m');
const x0 = s.progs.filter((p) => p.type === 'tree').map((p) => p.x);
await page.keyboard.press('Shift+ArrowLeft'); s = await S(); ok(s.progs.filter((p) => p.type === 'tree')[0].x === x0[0] - 5, 'Shift+Arrow nudges 5 m');
await page.keyboard.press('Alt+ArrowDown'); s = await S(); ok(Math.abs(s.progs.filter((p) => p.type === 'tree')[0].z - (z0[0] + 0.9)) < 1e-6, 'Alt+Arrow nudges 0.1 m');
// Shift+click removes one from the set
await page.keyboard.down('Shift'); await click(x0[1] - 5 + 0.5, z0[1] + 0.9 + 0.5, 0.05); await page.keyboard.up('Shift'); s = await S(); ok(s.multi.length === 3 && !s.multi.includes('t2'), 'Shift+click takes a tree out of the set');
// Ctrl+D duplicates the set
const t0 = s.progs.filter((p) => p.type === 'tree').length;
await page.keyboard.press('Control+d'); s = await S(); ok(s.progs.filter((p) => p.type === 'tree').length === t0 + 3 && s.multi.length === 3, 'Ctrl+D duplicates all three');
await page.keyboard.press('Escape'); s = await S(); ok(sel(s).length === 0, 'Esc clears the selection');
// Shift+R rotates the shop 90°: 6 × 5 becomes 5 × 6, door east turns north
await click(39, 32.5, 4.5); await page.keyboard.press('Shift+R'); s = await S(); const shop = s.progs.find((p) => p.id === 'p4');
ok(shop.w === 5 && shop.d === 6 && shop.door === 'N' && shop.x === 36.5 && shop.z === 29.5, `Shift+R rotates the shop: ${shop.w}×${shop.d} door ${shop.door} at ${shop.x}, ${shop.z}`);
// Enter edits the size in the panel; Esc leaves the field without applying
await page.keyboard.press('Enter'); s = await S(); ok(s.active === 'INPUT', 'Enter puts the cursor in the width field');
await page.keyboard.type('9'); await page.keyboard.press('Escape'); s = await S(); ok(s.active !== 'INPUT' && s.progs.find((p) => p.id === 'p4').w === 5, 'Esc leaves the field without applying');
await page.keyboard.press('Enter'); await page.keyboard.type('7'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
s = await S(); ok(s.progs.find((p) => p.id === 'p4').w === 7, 'typing 7 and Enter applies the width');
// Ctrl+X then Ctrl+V moves the shop to the cursor
await click(39, 32.5, 4.5); await page.keyboard.press('Control+x'); s = await S(); ok(!s.progs.some((p) => p.type === 'retail' && p.id === 'p4'), 'Ctrl+X cuts the shop');
await hover(64, 50); await page.keyboard.press('Control+v'); s = await S(); const ps = s.progs.filter((p) => p.type === 'retail').pop();
ok(ps && Math.abs(ps.x + ps.w / 2 - 64) < 0.6 && Math.abs(ps.z + ps.d / 2 - 50) < 0.6, 'Ctrl+V puts it back at the cursor');
// Ctrl+A selects everything; Delete then Ctrl+Z
await page.keyboard.press('Control+a'); s = await S(); const all = s.progs.length + s.masses.length + s.shapes.length; ok(s.multi.length === all, `Ctrl+A selects all ${all}`);
await page.keyboard.press('Delete'); s = await S(); ok(s.progs.length === 0 && s.masses.length === 0 && s.shapes.length === 0, 'Delete clears the whole site');
await page.keyboard.press('Control+z'); s = await S(); ok(s.progs.length + s.masses.length + s.shapes.length === all, 'Ctrl+Z restores everything');
// Space returns to Select from a draw tool; Esc drops a tool
await page.keyboard.press('l'); s = await S(); ok(s.geom === 'line', 'L starts the Line tool');
await page.keyboard.press(' '); s = await S(); ok(s.geom === 'select', 'Space returns to Select');
await page.keyboard.press('r'); await page.keyboard.press('Escape'); s = await S(); ok(s.geom === 'select', 'Esc drops the Rectangle tool');
// Delete inside a line removes the last point; Esc cancels the line
await page.keyboard.press('k'); await click(40, 60); await click(50, 60); await click(50, 70);
let dl = await page.evaluate(() => window.PFL_APP.st.draft.pts.length); await page.keyboard.press('Delete');
let dl2 = await page.evaluate(() => window.PFL_APP.st.draft.pts.length); ok(dl === 3 && dl2 === 2, 'Delete while drawing removes the last point');
await page.keyboard.press('Escape'); ok(await page.evaluate(() => !window.PFL_APP.st.draft), 'Esc cancels the line');
await page.keyboard.press('Escape');
// F frames the selection, Home fits everything
await click(54, 40, 0.15); const zBefore = (await S()).zoom; await page.keyboard.press('Shift+F'); s = await S(); ok(s.zoom > zBefore * 1.5 && Math.abs(s.plan[0] - 54) < 1, `F frames the selection (zoom ${zBefore} → ${s.zoom})`);
await page.keyboard.press('Home'); s = await S(); ok(s.zoom < 1.2 && Math.abs(s.plan[0] - 55) < 0.5, 'Home fits everything');
// ? opens the shortcut sheet, Esc closes it
await page.keyboard.press('?'); s = await S(); ok(s.help, '? opens the shortcut sheet');
await page.screenshot({ path: SP + 'k-help.png' });
await page.keyboard.press('Escape'); s = await S(); ok(!s.help, 'Esc closes it');
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
