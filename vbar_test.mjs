// Scripted check of the vertical bar on the viewport: materials painted onto surfaces, ground uses, mass façades and the site ground; furniture placed with a click (table set, planter, kiosk, bike rack, lamp, bollard, bin) that the simulation knows: node vbar_test.mjs [screenshot dir]
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
const S = () => page.evaluate(() => { const A = window.PFL_APP, L = A.sims.site.L; return { tool: A.st.tool, mat: A.st.mat, obj: A.st.obj, geom: A.st.geom, bar: !document.getElementById('vtools').hidden, mats: document.querySelectorAll('#matpop [data-mat]').length, bucket: !!document.querySelector('#vtools [data-bucket]'), pop: !document.getElementById('matpop').hidden, cats: [...document.querySelectorAll('#matpop .mp-cat')].map((c) => c.textContent), furn: [...document.querySelectorAll('#vtools [data-furn]')].map((b) => b.dataset.furn), pb: L.shapes[0] && L.shapes[0].mat, tower: L.masses[0] && L.masses[0].faces && Object.entries(L.masses[0].faces).map(([k, v]) => k + '=' + v).join(','), skins: (() => { let n = 0; A.world.traverse((o) => { if (o.isMesh && o.userData && o.userData.skin) n++; }); return n; })(), shop: (L.programs.find((p) => p.name === 'Shop') || {}).mat, siteMat: L.siteMat, progs: L.programs.map((p) => p.type), toast: document.getElementById('toast').textContent, hint: document.getElementById('hint').textContent.slice(0, 160) }; });

await page.click('#m-mass'); await page.waitForTimeout(300); await key('2'); await page.waitForTimeout(400);
let s = await S();
ok(s.bar && s.bucket && !s.pop && s.furn.length === 10 && s.furn.includes('table') && s.furn.includes('kiosk'), `a vertical bar on the viewport: one paint bucket and ${s.furn.length} pieces of furniture: ${s.furn.join(' ')}`);
await page.click('#vtools [data-bucket]'); await page.waitForTimeout(200); s = await S();
ok(s.pop && s.mats === 18 && s.cats.join() === 'Paving,Decking,Planting,Water,Façade', `the bucket opens a popup of ${s.mats} materials in categories: ${s.cats.join(', ')}`);
await key('Escape'); s = await S(); ok(!s.pop && s.tool === 'select', 'Esc closes it without picking the bucket');
await page.click('#m-int'); await page.waitForTimeout(700); s = await S(); ok(!s.bar, 'it is not there inside a floor');
await page.click('#m-site'); await page.waitForTimeout(500); await key('2'); await page.waitForTimeout(300); s = await S(); ok(s.bar, 'and back on the Site & plaza tab');
// paint
await page.click('#vtools [data-bucket]'); await page.waitForTimeout(200); await page.click('#matpop [data-mat="granite"]'); await page.waitForTimeout(200); s = await S();
ok(s.tool === 'paint' && s.mat === 'granite' && !s.pop && /granite setts/.test(s.hint), 'Granite setts in the popup picks the bucket and closes the popup: ' + s.hint);
const pb = await page.evaluate(() => { const b = window.PFL_APP.sims.site.L.shapes[0]; return b.pts.reduce((q, p) => [q[0] + p[0] / 4, q[1] + p[1] / 4], [0, 0]); });
await clickAt(pb[0], pb[1], 0.3); s = await S(); ok(s.pb === 'granite' && /granite setts/.test(s.toast), 'clicking the planting bed paints it: ' + s.toast);
await clickAt(39, 32.5, 1); s = await S(); ok(s.shop === 'granite', 'clicking the Shop paints the ground use too');
await page.click('#vtools [data-bucket]'); await page.waitForTimeout(150); await page.click('#matpop [data-mat="brickf"]'); await page.waitForTimeout(200); await clickAt(60, 66, 1.7); s = await S(); ok(s.tower === 'top=brickf' && /top painted brick façade/i.test(s.toast) && s.skins === 1, 'in plan a click on the tower paints its top only: ' + s.toast);
await key('1'); await page.waitForTimeout(500); const tw = await page.evaluate(() => { const m = window.PFL_APP.sims.site.L.masses[0]; return { x: m.x, z: m.z, w: m.w, d: m.d, top: window.PFL.massTop(m) }; });
await clickAt(tw.x + tw.w / 2, tw.z - 0.01, tw.top / 2); s = await S(); ok(/top=brickf/.test(s.tower) && /S=brickf/.test(s.tower) && s.skins === 2 && /south face/.test(s.toast), 'in 3D a click on the south face paints that face only: ' + s.tower + ' · ' + s.toast);
await page.screenshot({ path: SP + 'b-faces.png' }); await key('Control+z'); await key('2'); await page.waitForTimeout(400);
await page.click('#vtools [data-bucket]'); await page.waitForTimeout(150); await page.click('#matpop [data-mat="timber"]'); await page.waitForTimeout(200); await clickAt(40, 50); s = await S(); ok(s.siteMat === 'timber' && /site ground/.test(s.toast), 'clicking the open site ground paints the site: ' + s.toast);
await page.screenshot({ path: SP + 'b-paint.png' });
await key('Escape'); s = await S(); ok(s.tool === 'select', 'Esc leaves the paint tool');
await key('Control+z'); await key('Control+z'); await key('Control+z'); await key('Control+z'); s = await S(); ok(!s.siteMat && !s.tower && !s.shop && !s.pb, 'four Ctrl+Z take the four coats off again');
// furniture
await page.click('#vtools [data-furn="table"]'); await page.waitForTimeout(200); s = await S(); ok(s.obj === 'table' && s.geom === 'rect', 'Table set picks a click-to-place object');
await clickAt(56, 48); s = await S(); const tb = await page.evaluate(() => window.PFL_APP.sims.site.L.programs.find((p) => p.type === 'table'));
ok(tb && tb.w === 2.2 && Math.abs(tb.x + 1.1 - 56) < 0.01 && Math.abs(tb.z + 1.1 - 48) < 0.01, 'a click puts a 2.2 m table set centred where you clicked: ' + JSON.stringify(tb && [tb.x, tb.z, tb.w, tb.d]));
ok(await page.evaluate(() => window.PFL.SITE_TYPES.table.fixed === 4 && window.PFL.SEAT.has('table')), 'the simulation seats four people at it');
for (const [f, x, z] of [['lamp', 36, 40], ['bollard', 37, 42], ['bin', 38, 44], ['bikerack', 42, 24], ['planter', 44, 26]]) { await page.click(`#vtools [data-furn="${f}"]`); await page.waitForTimeout(150); await clickAt(x, z); }
s = await S(); ok(['lamp', 'bollard', 'bin', 'bikerack', 'planter'].every((f) => s.progs.includes(f)), 'a lamp post, a bollard, a bin, a bike rack and a planter placed with a click each: ' + s.progs.filter((p) => !['tree', 'retail', 'seating', 'bench'].includes(p)).join(' '));
await page.click('#vtools [data-furn="kiosk"]'); await page.waitForTimeout(150); await clickAt(66, 40); s = await S(); ok(s.progs.includes('kiosk'), 'a kiosk too');
ok(await page.evaluate(() => { const S = window.PFL_APP.sims.site; return S.G && Object.keys(S.G.F).some((k) => /kiosk|p:u/.test(k)); }), 'the kiosk is a destination people walk to');
await key('1'); await page.waitForTimeout(500); await page.click('#panechrome [data-bb="fit"]'); await page.waitForTimeout(500); await page.screenshot({ path: SP + 'b-furniture.png' });
await key('Escape');
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
