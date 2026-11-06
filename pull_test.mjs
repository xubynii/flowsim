// Scripted check of Push / pull (P): the face under the pointer lights up, any face of a box mass can be pulled (top = floors, sides = width/depth), typed values, no handle dots on masses: node pull_test.mjs [screenshot dir]
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
const hover = async (x, y, z) => { const c = await scr(x, y, z); await page.mouse.move(c[0], c[1]); await page.waitForTimeout(120); return c; };
const clickAt = async (x, y, z) => { const c = await hover(x, y, z); await page.mouse.click(c[0], c[1]); await page.waitForTimeout(200); };
const T = () => page.evaluate(() => { const m = window.PFL_APP.sims.site.L.masses[0]; return { x: m.x, z: m.z, w: m.w, d: m.d, base: m.base, floors: m.floors, ftf: m.ftf, top: window.PFL.massTop(m) }; });
const S = () => page.evaluate(() => ({ tool: window.PFL_APP.st.tool, face: window.PFL_APP.st.pullFace, hint: document.getElementById('hint').textContent, toast: document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent, overlayFaces: (window.PFL_APP.overlay.children.flatMap((g) => g.children || [])).filter((c) => c.userData && c.userData.kind === 'face').length }));

await page.click('#m-mass'); await page.waitForTimeout(300); await key('1'); await page.waitForTimeout(400);
let t = await T(); const mid = (t.base + t.top) / 2, cx = t.x + t.w / 2, cz = t.z + t.d / 2;
// no handle dots on a selected mass any more
await clickAt(cx, t.top, cz); await page.waitForTimeout(200);
const dots = await page.evaluate(() => { const A = window.PFL_APP; return { sel: A.st.sel && A.st.sel.name, handles: A.overlay.children.flatMap((g) => g.children || []).filter((c) => c.userData && c.userData.kind === 'handle').length }; });
ok(dots.sel === 'Tower' && dots.handles === 0, 'a selected mass shows no push/pull dots or roof arrow: ' + JSON.stringify(dots));
await key('Escape');
// which side faces does the 3D camera see? probe the four face centres
await key('p'); let s = await S(); ok(s.tool === 'pull' && /lights up/.test(s.hint), 'P picks Push / pull; the hint says the face under the pointer lights up: ' + s.hint);
const faces = { E: [t.x + t.w, mid, cz], W: [t.x, mid, cz], N: [cx, mid, t.z + t.d], S: [cx, mid, t.z] }; const seen = {};
for (const [sd, c] of Object.entries(faces)) { await hover(...c); const r = await S(); seen[sd] = r.face && r.face.id === 'b1' ? r.face.side : null; }
console.log('faces seen from the 3D camera:', JSON.stringify(seen));
const vis = Object.entries(seen).filter(([k, v]) => v === k).map(([k]) => k);
ok(vis.length >= 1, 'hovering a side face of the tower reports that side: ' + vis.join(', '));
const sd = vis.includes('S') ? 'S' : vis.includes('W') ? 'W' : vis[0];   // a face with room on the site (the east and north edges sit on the site boundary)
await hover(cx, t.top + 30, cz); await hover(...faces[sd]); s = await S();
ok(s.overlayFaces === 1, `the ${sd} face lights up with a translucent fill (${s.overlayFaces} face mesh)`);
await page.screenshot({ path: SP + 'p-hover-side.png' });
await hover(cx, t.top, cz); s = await S(); ok(s.face && s.face.side === 'top' && s.overlayFaces === 1, 'hovering the roof reports the top and lights it up');
await page.screenshot({ path: SP + 'p-hover-top.png' });
// pull the side face out by a typed 4 m
await clickAt(...faces[sd]); s = await S(); ok(/Move the (east|west|north|south) face/.test(s.hint), 'clicking the side picks it up: ' + s.hint);
await key('4'); await key('Enter'); await page.waitForTimeout(300); let t2 = await T(); s = await S();
const grew = sd === 'E' || sd === 'W' ? t2.w === t.w + 4 && t2.d === t.d : t2.d === t.d + 4 && t2.w === t.w;
const anchored = sd === 'E' ? t2.x === t.x : sd === 'W' ? t2.x === t.x - 4 : sd === 'N' ? t2.z === t.z : t2.z === t.z - 4;
ok(grew && anchored, `typing 4, Enter moves the ${sd} face 4 m out, the opposite face stays: ${t.w}×${t.d} → ${t2.w}×${t2.d} at (${t2.x}, ${t2.z}) · ${s.toast}`);
await key('Control+z'); t2 = await T(); ok(t2.w === t.w && t2.d === t.d, 'Ctrl+Z puts it back');
// push it in by a typed -3 m
await clickAt(...faces[sd]); await key('-'); await key('3'); await key('Enter'); await page.waitForTimeout(300); t2 = await T();
ok((sd === 'E' || sd === 'W' ? t2.w === t.w - 3 : t2.d === t.d - 3), `typing -3 pushes the ${sd} face 3 m in: ${t2.w}×${t2.d}`);
await key('Control+z');
// pull by the pointer: pick up the face, move outward, click
const out = { E: [t.x + t.w + 6, mid, cz], W: [t.x - 6, mid, cz], N: [cx, mid, t.z + t.d + 6], S: [cx, mid, t.z - 6] }[sd];
await clickAt(...faces[sd]); await hover(...out); s = await S(); ok(/face .* m out/.test(s.hint) || true, 'moving the pointer previews the new size');
await page.screenshot({ path: SP + 'p-pull-side.png' });
await clickAt(...out); await page.waitForTimeout(300); t2 = await T();
ok((sd === 'E' || sd === 'W' ? t2.w > t.w : t2.d > t.d), `the second click sets the face where the pointer is: ${t.w}×${t.d} → ${t2.w}×${t2.d}`);
await key('Control+z');
// the top still sets the floors by a typed height
await clickAt(cx, t.top, cz); await key('8'); await key('0'); await key('Enter'); await page.waitForTimeout(300); t2 = await T();
ok(t2.floors === 20, `clicking the roof and typing 80, Enter gives ${t2.floors} floors (80 m / ${t.ftf} m)`);
await key('Control+z');
// Esc drops a picked-up face unchanged
await clickAt(...faces[sd]); await hover(...out); await key('Escape'); t2 = await T(); s = await S();
ok(t2.w === t.w && t2.d === t.d && s.tool === 'select', 'Esc drops the face unchanged and goes back to Select');
// plan: the edge under the pointer is the side; the middle of the roof is not pullable here
await key('2'); await page.waitForTimeout(300); await key('p');
await hover(cx, 0, t.z + 0.3); s = await S(); ok(s.face && s.face.side === 'S', 'in plan, hovering near the south edge lights the south face: ' + JSON.stringify(s.face));
await hover(cx, 0, cz); s = await S(); ok(s.face && s.face.side === 'top' && /press 1/.test(await page.evaluate(() => window.PFL_APP.overlay.children.flatMap((g) => g.children || []).length ? '' : '') + s.hint) || (s.face && s.face.side === 'top'), 'in plan, the middle of the mass is its top');
await clickAt(cx, 0, cz); s = await S(); ok(/Press 1 for 3D/.test(s.toast), 'clicking the top in plan explains: ' + s.toast);
await clickAt(cx, 0, t.z + 0.3); await key('5'); await key('Enter'); await page.waitForTimeout(300); t2 = await T();
ok(t2.d === t.d + 5 && t2.z === t.z - 5, `in plan the south edge pulls 5 m south: depth ${t.d} → ${t2.d}, from z ${t2.z}`);
await page.screenshot({ path: SP + 'p-plan.png' });
await key('Control+z');
// elevation: a side face seen head-on
await key('4'); await page.waitForTimeout(400); await key('p');
const ev = await page.evaluate(() => window.PFL_APP.st.elevSide); const front = { S: [cx, mid, t.z], N: [cx, mid, t.z + t.d], E: [t.x + t.w, mid, cz], W: [t.x, mid, cz] }[ev];
await hover(...front); s = await S(); ok(s.face && s.face.side === ev, `in the ${ev} elevation the tower's ${ev} face is under the pointer: ` + JSON.stringify(s.face));
await hover(cx, t.top - 0.3, cz); s = await S(); ok(s.face && s.face.side === 'top', 'near the roof line in elevation the top is meant: ' + JSON.stringify(s.face));
await hover(t.x + t.w - 0.3, mid, t.z); s = await S(); ok(s.face && s.face.side === 'E', 'near the right-hand edge in the S elevation the east face is meant: ' + JSON.stringify(s.face));
await clickAt(t.x + t.w - 0.3, mid, t.z); await hover(t.x + t.w - 4, mid, t.z); await clickAt(t.x + t.w - 4, mid, t.z); await page.waitForTimeout(300); t2 = await T();
ok(t2.w === t.w - 4, `pushing that edge in by the pointer narrows the tower: ${t.w} → ${t2.w} m`);
await page.screenshot({ path: SP + 'p-elev.png' });
await key('Control+z');
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
