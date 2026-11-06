// Scripted check of the three right-panel tabs (Mass, Site & plaza, Interior) with their own tool sets, the Line tool as a path tool on the site, the plan label editor for a mass's name and programme, and walls that close a room when they land on the façade or another wall: node tabs_test.mjs [screenshot dir]
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
const S = () => page.evaluate(() => { const A = window.PFL_APP, st = A.st; return { mode: st.mode, tab: st.tab, obj: st.obj, geom: st.geom, tool: st.tool, title: document.querySelector('#wsTitle span').textContent, pressed: ['m-mass', 'm-site', 'm-int'].filter((id) => document.getElementById(id).getAttribute('aria-pressed') === 'true'), tools: [...document.querySelectorAll('#tools [data-tool]')].map((b) => b.dataset.tool), objs: [...document.querySelectorAll('#palette [data-obj]')].map((b) => b.dataset.obj), lm: [...document.querySelectorAll('#drawopts [data-lm]')].map((b) => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')), draft: st.draft && { mode: st.draft.mode, pts: st.draft.pts.length }, sel: st.sel && st.sel.name, lbl: !document.getElementById('lbledit').hidden, hint: document.getElementById('hint').textContent.slice(0, 60) }; });

// ---- the tabs
let s = await S();
ok(s.pressed.join() === 'm-mass' && s.title === 'Mass' && s.tab === 'mass', 'the Lab opens on the Mass tab: ' + s.title);
ok(s.objs.join() === 'mass' && s.tools.includes('split') && s.tools.includes('pull') && !s.tools.includes('arc'), 'Mass tab: the palette offers the mass, the toolbar has Split and Push / pull but no Arc: ' + s.tools.join(' '));
await page.click('#m-site'); await page.waitForTimeout(300); s = await S();
ok(s.pressed.join() === 'm-site' && s.title === 'Site & plaza' && s.mode === 'site' && s.tab === 'site', 'Site & plaza is a tab of the same site: ' + s.title);
ok(!s.objs.includes('mass') && s.objs.includes('paving') && s.objs.includes('bench') && s.objs.includes('use'), 'Site tab: surfaces, furniture, trees, canopies and ground uses, no mass: ' + s.objs.join(' '));
ok(s.tools.includes('arc') && !s.tools.includes('split'), 'Site tab toolbar: Arc in, Split out: ' + s.tools.join(' '));
ok(/Design the ground/.test(await page.textContent('#question')), 'the panel note describes the ground design');
// the Line tool on the site is a path tool
await key('l'); s = await S();
ok(s.geom === 'line' && s.obj !== 'mass' && s.lm[0] === 'Path*' && s.lm[1] === 'Area outline', `L on the Site tab draws a path of ${s.obj}: modes ${s.lm.join(', ')}`);
await key('2'); await page.waitForTimeout(300); await clickAt(36, 46); await clickAt(44, 46); s = await S();
ok(s.draft && s.draft.mode === 'offset' && s.draft.pts === 2, 'two clicks lay a path with a width: ' + JSON.stringify(s.draft));
await key('Enter'); await page.waitForTimeout(300); const sh = await page.evaluate(() => { const L = window.PFL_APP.sims.site.L, q = L.shapes[L.shapes.length - 1]; return { type: q.type, geom: q.geom, width: q.width }; });
ok(sh.geom === 'path' && sh.width > 0, `Enter places a ${sh.type} path ${sh.width} m wide`);
await key('Control+z'); await key('Escape');
// a mass key switches to the Mass tab; a mass tool key too
await page.keyboard.press('Shift+M'); await page.waitForTimeout(150); s = await S(); ok(s.tab === 'mass' && s.pressed.join() === 'm-mass', 'Shift+M (Mass) switches to the Mass tab');
await key('Escape'); await page.click('#m-site'); await page.waitForTimeout(200); await key('x'); s = await S(); ok(s.tab === 'mass' && s.tool === 'split', 'X (Split) switches to the Mass tab too');
await key('Escape');
await page.click('#m-int'); await page.waitForTimeout(800); s = await S(); ok(s.mode === 'int' && s.pressed.join() === 'm-int' && s.title === 'Interior', 'Interior is the third tab');
// ---- interior: a wall from the façade that lands on the façade again closes the room without Enter
const P = await page.evaluate(() => { const L = window.PFL_APP.sims.int.L; return { W: L.W, D: L.D }; });
const I = () => page.evaluate(() => { const A = window.PFL_APP, S = A.sims.int; return { walls: (S.L.walls || []).length, areas: S.regions ? S.regions.regions.filter((r) => !r.tiny).length : 1, draft: !!A.st.draft, toast: document.getElementById('toast').textContent }; });
let i0 = await I(); await key('w'); await clickAt(0.3, 3); await clickAt(P.W - 0.3, 3); await page.waitForTimeout(500); let i1 = await I();
ok(!i1.draft && i1.walls === i0.walls + 1, 'the second click lands on the far façade: the wall is placed at once, no Enter needed');
ok(i1.areas === i0.areas + 1 && /area/.test(i1.toast), `and the floor now has ${i1.areas} areas: ` + i1.toast.slice(0, 90));
await page.screenshot({ path: SP + 't-wall.png' });
await key('Escape'); await key('Control+z');
// ---- the plan label of a mass: click it on the selected mass to rename it and set its programme in place
await page.click('#m-mass'); await page.waitForTimeout(600); await key('2'); await page.waitForTimeout(300);
const t = await page.evaluate(() => { const m = window.PFL_APP.sims.site.L.masses[0]; return { name: m.name, x: m.x, z: m.z, w: m.w, d: m.d, use: m.use, bands: window.PFL.bandsOf(m).length }; });
await clickAt(t.x + t.w / 2, t.z + t.d / 2, 1.7); s = await S(); ok(s.sel === t.name && !s.lbl, 'the first click on the mass selects it (the label is not editing yet)');
await clickAt(t.x + t.w / 2, t.z + t.d / 2, 1.7); s = await S(); ok(s.lbl, 'a click on the label of the selected mass opens the in-place editor');
ok((await page.inputValue('#lblName')) === t.name && (await page.inputValue('#lblUse')) === (t.bands === 1 ? t.use : 'mixed'), 'it shows the name and the programme: ' + t.name + ' · ' + (t.bands === 1 ? t.use : 'mixed'));
await page.screenshot({ path: SP + 't-label.png' });
await page.fill('#lblName', 'Hotel block'); await page.selectOption('#lblUse', 'hotel'); await page.waitForTimeout(400);
const m2 = await page.evaluate(() => { const m = window.PFL_APP.sims.site.L.masses[0]; return { name: m.name, use: m.use, bands: window.PFL.bandsOf(m).map((b) => b.use + b.floors).join(), lbl: !document.getElementById('lbledit').hidden }; });
ok(m2.name === 'Hotel block' && m2.use === 'hotel' && !m2.lbl, 'choosing Hotel applies the name and the programme and closes the editor: ' + JSON.stringify(m2));
ok(await page.evaluate(() => { let t = null; window.PFL_APP.world.traverse((o) => { if (o.isSprite && o.userData.kind === 'label') t = o.userData.text; }); return t; }).then((x) => /Hotel block/.test(x)), 'the plan label reads the new name');
await key('Control+z'); const m3 = await page.evaluate(() => window.PFL_APP.sims.site.L.masses[0].name); ok(m3 === t.name, 'Ctrl+Z restores the old name and programme');
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
