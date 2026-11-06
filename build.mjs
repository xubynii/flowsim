// node build.mjs  ->  index.html = app.html with site-vancouver.js (the imported competition site, made by tools/gen_site.py) and engine.js inlined at <!--ENGINE-->
import fs from 'node:fs';
const a = fs.readFileSync('app.html', 'utf8'), e = fs.readFileSync('engine.js', 'utf8'), sites = fs.readFileSync('site-vancouver.js', 'utf8');
if (!a.includes('<!--ENGINE-->')) throw new Error('placeholder missing');
fs.writeFileSync('index.html', a.replace('<!--ENGINE-->', () => '<script>\n' + sites + '\n</script>\n<script>\n' + e + '\n</script>'));
console.log('index.html', fs.statSync('index.html').size, 'bytes');
