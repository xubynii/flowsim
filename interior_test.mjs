// Scripted check of the Interior tab: walls, room lines, doors and area uses per floor, and the ground floor as L1 of the mass: node interior_test.mjs [screenshot dir]
import { chromium } from 'file:///C:/Users/sinnie/OneDrive/Desktop/tower-design-toolkit/node_modules/playwright/index.mjs';
const SP = process.argv[2] || './';
const browser = await chromium.launch({ executablePath: 'C:/Users/sinnie/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push('pageerror ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
await page.goto('file:///C:/Users/sinnie/OneDrive/Desktop/ped-flow-guide/index.html');
await page.waitForFunction(() => window.PFL_APP, null, { timeout: 30000 }); await page.waitForTimeout(800);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const scr = (x, y, z) => page.evaluate(([x, y, z]) => { const A = window.PFL_APP, p = A.st.panes[0], v = new THREE.Vector3(x, y, -z).project(A.camera), r = document.querySelector('#view canvas').getBoundingClientRect(); return [r.left + p.x + (v.x + 1) / 2 * p.w, r.top + p.y + (1 - v.y) / 2 * p.h]; }, [x, y, z]);
const click = async (x, z, y = 0) => { const c = await scr(x, y, z); await page.mouse.move(c[0], c[1]); await page.mouse.click(c[0], c[1]); await page.waitForTimeout(150); };
const I = () => page.evaluate(() => { const A = window.PFL_APP, S = A.sims.int, t = A.sims.site.L.masses[0]; return { level: S.L.level, base: S.L.baseUse, itool: A.st.itool, sel: A.st.sel && (A.st.sel.sep ? 'line' : A.st.sel.a ? 'wall' : A.st.sel.name), walls: (S.L.walls || []).map((w) => (w.sep ? 'line' : 'wall') + ':' + w.a.join(',') + '>' + w.b.join(',')), areas: S.regions.regions.filter((r) => !r.tiny).map((r) => r.use + ':' + Math.round(r.area)), unreached: S.unreached || [], doors: (S.L.doors || []).length, dests: window.PFL.destBands(t).map((d) => d.use + ':' + d.levels.join('/')), toast: document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent }; });

// the ground floor is part of the mass
const T = await page.evaluate(() => { const t = window.PFL_APP.sims.site.L.masses[0]; return { base: t.base, bands: window.PFL.bandsOf(t).map((b) => b.use + b.floors).join(), under: window.PFL_APP.sims.site.L.programs.filter((p) => ['lobby', 'cafe', 'food'].includes(p.type)).length }; });
ok(T.base === 0 && T.bands === 'restaurant1,office16' && T.under === 0, 'the tower starts on the ground with L1 food & drink and nothing under it: ' + T.bands);
// the tab is called Interior
ok((await page.textContent('#m-int')).trim() === 'Interior', 'the tab reads "Interior"');
await page.click('#m-int'); await page.waitForTimeout(800);
ok((await page.textContent('#wsTitle')).includes('Interior'), 'the panel title reads Interior');
ok(await page.evaluate(() => window.PFL_APP.st.layout) === 'plan', 'Interior opens in the plan view');
ok(await page.evaluate(() => { const A = window.PFL_APP, g = A.world; let n = 0; g.traverse((o) => { if (o.isSprite && o.userData && /fl ·/.test(o.userData.text || '')) n++; }); return n; }) === 0, 'no floating tag over the mass');
ok(await page.locator('#tools [data-tool]').count() === 13 && await page.isVisible('#tools [data-tool="sep"]') && await page.isVisible('#tools [data-tool="pull"]'), 'the toolbar has Select, Wall, Room line, Door, Area use, then Erase, Move, Copy, Rotate, Offset, Push / pull, Edit length, Vertex, Tape, Section');
ok(await page.isVisible('#palette [data-itool="wall"]') && await page.isVisible('#palette [data-itool="sep"]') && await page.isVisible('#palette [data-itool="door"]'), 'the Draw panel offers Wall, Room line and Door before the area uses');
await page.click('.lvgrid [data-lv="1"]'); await page.waitForTimeout(500);
let s = await I(); ok(s.level === 1 && s.base === 'restaurant', 'L1 is the ground floor, food & drink');
await page.keyboard.press('2'); await page.waitForTimeout(400);
const P = await page.evaluate(() => { const L = window.PFL_APP.sims.int.L; return { W: L.W, D: L.D, core: L.core }; });

// the plan cuts the façade like a wall: a filled band between its outer and inner face, with its thickness tagged
const F = await page.evaluate(() => { const A = window.PFL_APP, L = A.sims.int.L, g = A.overlay.children[0], fills = g.children.filter((c) => c.isMesh && c.geometry.type !== 'PlaneGeometry');
  const band = fills.find((m) => { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox; return b.max.x - b.min.x > L.W - 0.5; });
  const tag = g.children.find((c) => c.userData.kind === 'facadeTag');
  // the band's inner ring sits FACADE_T inside the footprint
  const pos = band && band.geometry.attributes.position, xs = []; if (pos) for (let i = 0; i < pos.count; i++) xs.push(+pos.getX(i).toFixed(2));
  return { T: window.PFL.FACADE_T, band: !!band, xs: [...new Set(xs)].sort((a, b) => a - b), tag: !!tag, W: L.W };
});
ok(F.band && F.xs.includes(0) && F.xs.includes(F.T) && F.xs.includes(+(F.W - F.T).toFixed(2)), `the plan fills the façade ${F.T} m thick, outer face to inner face: x ${F.xs.join(', ')}`);
ok(F.tag, 'the plan tags the façade thickness');
await page.screenshot({ path: SP + 'i-facade-plan.png' });
// a room line across the floor, drawn a little short of the façade: its ends land on it and it makes two areas
await page.keyboard.press('l'); s = await I(); ok(s.itool === 'sep', 'L picks the Room line tool');
const xl = P.core.x + P.core.w + 4;
await click(xl, 0.4); await click(xl, P.D - 0.4); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
s = await I(); ok(s.walls.length === 1 && s.walls[0] === `line:${xl},0>${xl},${P.D}`, 'the room line\'s ends land on the façade: ' + s.walls.join());
ok(s.areas.length === 2, 'it splits the floor into two areas: ' + s.areas.join(', '));
ok(!s.unreached.length, 'both areas are reachable without a door: people walk across a room line');
// give the east part a use
await page.click('#palette [data-tagu="retail"]'); await click(P.W - 2, P.D / 2); await page.waitForTimeout(300);
s = await I(); ok(s.areas.some((a) => a.startsWith('retail')) && s.areas.some((a) => a.startsWith('restaurant')), 'the east area is retail, the rest food & drink: ' + s.areas.join(', '));
ok(s.dests.includes('retail:1') && s.dests.includes('restaurant:1'), 'the site gets a shop and a restaurant on L1: ' + s.dests.join(' '));
// a door cannot go in a room line
await page.keyboard.press('d'); await click(xl, P.D / 2); s = await I(); ok(s.doors === 0 && /need no door/.test(s.toast), 'Door on a room line is refused: ' + s.toast);
await page.keyboard.press('Escape');
// a wall right across the south closes off a strip (two areas, split by the room line); it needs a door
await page.keyboard.press('w'); await click(0.3, 3); await click(P.W - 0.3, 3); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
s = await I(); ok(s.walls.filter((w) => w.startsWith('wall')).length === 1 && s.areas.length === 4, 'the wall makes four areas: ' + s.areas.join(', '));
ok(s.unreached.length === 2, 'the walled strip has no way in yet, on either side of the room line: ' + s.unreached.join(' · '));
await page.keyboard.press('Escape');
// select the wall and turn it into a room line: the area stays, people walk in
await page.keyboard.press('v'); await click(xl / 2, 3, 1.2); s = await I(); ok(s.sel === 'wall' && /Make it a room line/.test(await page.textContent('#selcard')), 'clicking the wall selects it; its card offers a room line');
await page.click('#wSep'); await page.waitForTimeout(300); s = await I();
ok(s.walls.filter((w) => w.startsWith('line')).length === 2 && s.areas.length === 4 && !s.unreached.length, 'as a room line the four areas stay and all are reachable');
await page.keyboard.press('1'); await page.waitForTimeout(400); await page.screenshot({ path: SP + 'i-int-3d.png' });
await page.keyboard.press('2'); await page.waitForTimeout(300); await page.screenshot({ path: SP + 'i-int-plan.png' });
await page.keyboard.press('Control+z'); await page.waitForTimeout(300); s = await I(); ok(s.walls.filter((w) => w.startsWith('wall')).length === 1, 'Ctrl+Z makes it a wall again');
// a corner room needs only two walls: drawn short of the façade, their ends run on to it and the façade closes the room
const n0 = (await I()).areas.length;
await page.keyboard.press('w'); await click(1, 14); await click(6, 14); await click(6, P.D - 1.4); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
s = await I(); ok(s.walls.includes('wall:0,14>6,14') && s.walls.includes(`wall:6,14>6,${P.D}`), 'both ends of the L run on to the façade: ' + s.walls.filter((w) => w.startsWith('wall')).join(' '));
ok(s.areas.length === n0 + 1 && /façade closes the room/.test(s.toast), `the façade closes the corner room, no fourth wall needed (${n0} → ${s.areas.length} areas): ${s.toast}`);
// while drawing, the cursor lands on the façade and says so
await click(0.4, 9); const live = await page.evaluate(() => ({ on: window.PFL_APP.st.draft && window.PFL_APP.st.draft.on0, p: window.PFL_APP.st.draft && window.PFL_APP.st.draft.pts[0] }));
ok(live.on === 'façade' && live.p[0] === 0, 'a wall started next to the façade starts on it: ' + JSON.stringify(live));
await page.keyboard.press('Escape'); await page.keyboard.press('w');
// a wall that stops in the open is told so
await click(3, 8); await click(5, 8); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
s = await I(); ok(/Both ends stop short/.test(s.toast), 'a wall ending in the open says it closes no room: ' + s.toast);
await page.keyboard.press('Escape');
await page.keyboard.press('2'); await page.waitForTimeout(300); await page.screenshot({ path: SP + 'i-corner-plan.png' });
// a mass drawn now is blank inside: a core and nothing else, on every floor
await page.click('#m-mass'); await page.waitForTimeout(500); await page.keyboard.press('1'); await page.waitForTimeout(300); await page.keyboard.press('2'); await page.waitForTimeout(300);
await page.keyboard.press('Shift+M'); const d0 = await scr(36, 0, 50), d1 = await scr(44, 0, 70); await page.mouse.move(d0[0], d0[1]); await page.mouse.down(); for (let k = 1; k <= 6; k++) await page.mouse.move(d0[0] + (d1[0] - d0[0]) * k / 6, d0[1] + (d1[1] - d0[1]) * k / 6); await page.mouse.up(); await page.waitForTimeout(400);
const nm = await page.evaluate(() => { const L = window.PFL_APP.sims.site.L, m = L.masses[L.masses.length - 1]; const f = window.PFL.floorLayout(m); return { name: m.name, blank: m.blank, rooms: f.programs.length, core: !!f.core }; });
ok(nm.blank === true && nm.rooms === 0 && nm.core, `${nm.name} is blank inside: a core and no rooms (${nm.rooms})`);
await page.keyboard.press('Control+z'); await page.waitForTimeout(300); await page.click('#m-int'); await page.waitForTimeout(600);
// typical office floors: the rooms show as walled rooms with open desk zones
await page.click('.lvgrid [data-lv="6"]'); await page.waitForTimeout(500); await page.keyboard.press('1'); await page.waitForTimeout(400);
await page.screenshot({ path: SP + 'i-office-3d.png' });
s = await I(); ok(s.level === 6 && s.base === 'office', 'L6 is a typical office floor');
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
