// Scripted check of the Snaptrude-style shell: the Views tree on the left, the storey strip and bottom bar in every pane, the 2D/3D toggle, the 2D | 3D split layout, the command palette (Shift+Space), plan-only name + area labels: node shell_test.mjs [screenshot dir]
import { chromium } from 'file:///C:/Users/sinnie/OneDrive/Desktop/tower-design-toolkit/node_modules/playwright/index.mjs';
const SP = process.argv[2] || './';
const browser = await chromium.launch({ executablePath: 'C:/Users/sinnie/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push('pageerror ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
await page.goto('file:///C:/Users/sinnie/OneDrive/Desktop/ped-flow-guide/index.html');
await page.waitForFunction(() => window.PFL_APP, null, { timeout: 30000 }); await page.waitForTimeout(800);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(200); };
const S = () => page.evaluate(() => { const A = window.PFL_APP, st = A.st; return { mode: st.mode, layout: st.layout, panes: st.panes.map((p) => p.id), level: A.sims.int.L.level, tool: st.tool, labels: st.labels, views3d: st.views3d[st.mode].map((v) => v.name), view3d: st.view3d, settings: !document.getElementById('views').hidden, tree: [...document.querySelectorAll('#viewTree .vitem')].map((b) => b.dataset.tree + (b.getAttribute('aria-current') === 'true' ? '*' : '')), strips: document.querySelectorAll('#panechrome .storeys').length, bars: document.querySelectorAll('#panechrome .bbar').length, togs: [...document.querySelectorAll('#panechrome .tog')].map((b) => b.textContent), stripOn: [...document.querySelectorAll('#panechrome .storeys [data-lv][aria-pressed="true"]')].map((b) => b.textContent), palette: !document.getElementById('cmdpal').hidden, floors: A.sims.site.L.masses[0].floors }; });
const planTags = () => page.evaluate(() => { let n = 0; window.PFL_APP.world.traverse((o) => { if (o.isSprite && o.userData.planOnly) n++; }); return n; });

await page.click('#m-mass'); await page.waitForTimeout(300); await key('1'); await page.waitForTimeout(300);
let s = await S();
ok(s.tree.includes('site') && s.tree.includes('lv:17') && s.tree.includes('lv:1') && s.tree.includes('elev:N') && s.tree.includes('sec:ew') && s.tree.includes('3d*') && s.tree.includes('split') && s.tree.includes('quad'), 'the Views tree lists Site plan, Level 17…1 of the tower, the four elevations, both sections, Default 3D, the 2D | 3D and All four layouts: ' + s.tree.length + ' items');
ok(s.strips === 1 && s.bars === 1 && s.togs[0] === '2D', 'the 3D pane has a storey strip and a bottom bar whose toggle offers 2D');
ok(await page.evaluate(() => !document.querySelector('[data-rtab="views"]') && document.querySelector('#viewTree')), 'the Views tab left the right panel for the tree on the left, as in Snaptrude');
// the 2D/3D toggle
await page.click('#panechrome .tog'); await page.waitForTimeout(300); s = await S();
ok(s.layout === 'plan' && s.togs[0] === '3D' && s.tree.includes('site*'), 'clicking 2D shows the plan; the toggle now offers 3D and Site plan is current in the tree');
ok((await planTags()) >= 1, 'masses carry a plan-only name + area label: ' + await planTags());
await page.screenshot({ path: SP + 'sh-plan.png' });
// the eye hides labels
await page.click('#panechrome [data-bb="labels"]'); await page.waitForTimeout(200); s = await S(); ok(s.labels === false, 'the eye hides the labels');
await page.click('#panechrome [data-bb="labels"]'); await page.waitForTimeout(200); s = await S(); ok(s.labels === true, 'and shows them again');
// the storey strip opens the interior at that level
await page.click('#panechrome .storeys [data-lv="5"]'); await page.waitForTimeout(600); s = await S();
ok(s.mode === 'int' && s.level === 5 && s.layout === 'plan' && s.stripOn[0] === '5' && s.tree.includes('lv:5*'), `clicking 5 on the strip opens the interior at level 5 in plan; the strip and the tree mark it: mode ${s.mode}, level ${s.level}`);
await page.click('#panechrome .storeys [data-st="up"]'); await page.waitForTimeout(500); s = await S(); ok(s.level === 6, 'the chevron goes up a level: ' + s.level);
await page.screenshot({ path: SP + 'sh-interior.png' });
// the tree: Level 2, then back to the site plan
await page.click('#viewTree [data-tree="lv:2"]'); await page.waitForTimeout(500); s = await S(); ok(s.level === 2 && s.tree.includes('lv:2*'), 'Level 2 in the tree opens level 2');
await page.click('#viewTree [data-tree="site"]'); await page.waitForTimeout(500); s = await S(); ok(s.mode === 'site' && s.layout === 'plan', 'Site plan in the tree goes back to the site in plan');
// + adds a storey
const f0 = s.floors; await page.click('#viewTree [data-plus="storey"]'); await page.waitForTimeout(400); s = await S(); ok(s.floors === f0 + 1 && s.tree.includes('lv:' + (f0 + 1)), `+ next to Plans adds a storey: ${f0} → ${s.floors}`);
await key('Control+z'); s = await S(); ok(s.floors === f0, 'Ctrl+Z takes it back');
// elevations and sections from the tree
await page.click('#viewTree [data-tree="elev:E"]'); await page.waitForTimeout(400); s = await S(); ok(s.layout === 'elev' && s.tree.includes('elev:E*') && await page.evaluate(() => window.PFL_APP.st.elevSide) === 'E', 'East in the tree shows the east elevation');
await page.click('#viewTree [data-tree="sec:ns"]'); await page.waitForTimeout(400); s = await S(); ok(s.layout === 'section' && s.tree.includes('sec:ns*'), 'N–S in the tree shows the N–S section');
// 2D | 3D split: two panes, each with its own strip, bar and toggle
await key('6'); await page.waitForTimeout(500); s = await S();
ok(s.layout === 'split' && s.panes.join() === '3d,plan' && s.strips === 2 && s.bars === 2 && s.togs.join() === '2D,3D' && s.tree.includes('split*'), '6 shows 3D beside the plan, each pane with a storey strip and a bar: ' + s.panes.join(' | '));
await page.screenshot({ path: SP + 'sh-split.png' });
await page.click('#panechrome .pbox[data-pane="0"] .tog'); await page.waitForTimeout(300); s = await S(); ok(s.layout === 'split' && s.panes.join() === 'plan,plan' && s.togs.join() === '3D,3D', 'the left toggle turns that pane into a plan, the layout stays split');
await page.click('#panechrome .pbox[data-pane="0"] .tog'); await page.waitForTimeout(300); s = await S(); ok(s.panes.join() === '3d,plan', 'and back to 3D');
// save a 3D view with the camera button, pick it in the tree
await page.click('#panechrome .pbox[data-pane="0"] [data-bb="snap"]'); await page.waitForTimeout(300); s = await S();
ok(s.views3d.join() === '3D view 1' && s.view3d === 0 && s.tree.includes('v3:0*'), 'the camera button saves the 3D view; it appears under 3D views: ' + s.views3d.join());
await page.click('#viewTree [data-tree="3d"]'); await page.waitForTimeout(300); s = await S(); ok(s.view3d === null && s.tree.includes('3d*'), 'Default makes the saved view inactive');
await page.click('#viewTree [data-tree="v3:0"]'); await page.waitForTimeout(300); s = await S(); ok(s.view3d === 0, 'clicking the saved view brings it back');
// view settings: the sliders button opens the settings under the tree
await page.click('#panechrome .pbox[data-pane="0"] [data-bb="settings"]'); await page.waitForTimeout(300); s = await S(); ok(s.settings && await page.isVisible('#v-sec'), 'the sliders button opens View settings (camera, look, cut, section, elevation) under the tree');
await page.click('#viewSettings'); await page.waitForTimeout(200); s = await S(); ok(!s.settings, 'the header button closes them');
// the command palette
await key('1'); await page.keyboard.press('Shift+ '); await page.waitForTimeout(300); s = await S(); ok(s.palette, 'Shift+Space opens Search tools or commands');
await page.keyboard.type('push'); await page.waitForTimeout(200);
const first = await page.textContent('#cmdlist [aria-selected="true"]'); ok(/Push \/ pull/.test(first), 'typing push finds Push / pull: ' + first);
await key('Enter'); s = await S(); ok(!s.palette && s.tool === 'pull', 'Enter runs it: the tool is Push / pull');
await key('Escape');
await page.click('#panechrome .search'); await page.waitForTimeout(300); s = await S(); ok(s.palette, 'the search pill in the bar opens it too');
await page.keyboard.type('level 3'); await page.waitForTimeout(200); await page.screenshot({ path: SP + 'sh-palette.png' }); await key('Enter'); await page.waitForTimeout(600); s = await S();
ok(s.mode === 'int' && s.level === 3, 'Level 3 of Tower from the palette opens that level: mode ' + s.mode + ', level ' + s.level);
await page.keyboard.press('Shift+ '); await page.waitForTimeout(200); await page.keyboard.type('zzzz'); await page.waitForTimeout(200);
ok(/Nothing matches/.test(await page.textContent('#cmdlist')), 'no match says so'); await key('Escape'); s = await S(); ok(!s.palette, 'Esc closes it');
await page.click('#m-mass'); await page.waitForTimeout(400); await key('1');
// the hand pans with the left button in 3D
await page.click('#panechrome [data-bb="hand"]'); await page.waitForTimeout(200);
ok(await page.evaluate(() => window.PFL_APP.controls.mouseButtons.LEFT === THREE.MOUSE.PAN), 'the hand makes the left button pan in 3D');
await page.click('#panechrome [data-bb="hand"]'); await page.waitForTimeout(200); ok(await page.evaluate(() => window.PFL_APP.controls.mouseButtons.LEFT === THREE.MOUSE.ROTATE), 'and off again it orbits');
console.log('errors:', errs.length ? errs.join('\n') : 'none');
console.log(`${pass} pass, ${fail} fail`);
await browser.close();
