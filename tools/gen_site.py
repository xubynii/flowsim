# Builds site-vancouver.js for the Pedestrian Flow Lab from the Vancouver Tall competition base model
# (vancouver-tall-tower/data/site.json, metres, +y north, origin at the parcel centre):
#   python -I tools/gen_site.py [path/to/site.json]
# Window: 300 m x 220 m round the parcel (x -150..150, y -110..110), grid 1 m. Lab coordinates: X = x + 150, Z = y + 110 (z north).
import json, io, sys, os
SRC = sys.argv[1] if len(sys.argv) > 1 else r"C:/Users/sinnie/OneDrive/Desktop/vancouver-tall-tower/data/site.json"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site-vancouver.js')
d = json.load(io.open(SRC, encoding='utf-8'))
X0, X1, Y0, Y1 = -150.0, 150.0, -110.0, 110.0
W, D = X1 - X0, Y1 - Y0
tx = lambda x: round(x - X0, 1)
tz = lambda y: round(y - Y0, 1)
r1 = lambda v: round(v, 1)

# ---- streets: the gaps between the curb blocks, and the lanes between the building blocks inside them
roads = []
def road(x0, y0, x1, y1):
    x0, x1, y0, y1 = max(x0, X0), min(x1, X1), max(y0, Y0), min(y1, Y1)
    if x1 - x0 > 1 and y1 - y0 > 1: roads.append({'x0': tx(x0), 'z0': tz(y0), 'x1': tx(x1), 'z1': tz(y1)})
road(-98.0, Y0, -76.9, Y1)       # the arterial street, west of the site
road(77.0, Y0, 87.9, Y1)         # the street east of the site
road(X0, -57.9, X1, -45.7)       # the retail high street, south of the site
road(X0, 44.2, X1, 55.2)         # the street north of the site
road(X0, -106.7, X1, -100.6)     # lanes through the blocks
road(X0, 96.3, X1, 102.4)
road(X0, -3.0, -102.6, 3.1)      # the lanes in the west and east blocks (not the site's)
road(92.5, -3.0, X1, 3.1)
# crosswalks at every junction, so the sidewalks carry on across streets and lanes (the engine treats a road as an obstacle except at a crosswalk)
V = [(-98.0, -76.9), (77.0, 87.9)]; H = [(-57.9, -45.7, X0, X1), (44.2, 55.2, X0, X1), (-106.7, -100.6, X0, X1), (96.3, 102.4, X0, X1), (-3.0, 3.1, X0, -102.6), (-3.0, 3.1, 92.5, X1)]
cw = []
def cross(x0, y0, x1, y1):
    if x0 >= X0 and x1 <= X1 and y0 >= Y0 and y1 <= Y1: cw.append({'x0': tx(x0), 'z0': tz(y0), 'x1': tx(x1), 'z1': tz(y1)})
for vx0, vx1 in V:
    for hy0, hy1, hx0, hx1 in H:
        if hx1 < vx0 or hx0 > vx1: continue   # a lane that stops short of this street
        cross(vx0, hy1, vx1, hy1 + 3); cross(vx0, hy0 - 3, vx1, hy0)   # across the vertical street, north and south of the junction
        cross(vx0 - 3, hy0, vx0, hy1); cross(vx1, hy0, vx1 + 3, hy1)   # across the horizontal street or lane, west and east of it
cross(-98.0, -2, -76.9, 2)        # mid-block across the arterial, at the site's entrance and the transit plaza
cross(-20, -57.9, -16, -45.7)     # mid-block across the high street, at the heritage buildings' passage

# ---- buildings: footprints of the meshes that stand on the ground, as boxes
def boxes(layer):
    out = []
    for m in d['meshes']:
        if m['layer'] != layer: continue
        v = m['v']; P = [(v[i], v[i + 1], v[i + 2]) for i in range(0, len(v), 3)]
        z0 = min(p[2] for p in P)
        if z0 > 0.5: continue   # cornices and upper pieces
        fp = [p for p in P if abs(p[2] - z0) < 0.05]
        xs = [p[0] for p in fp]; ys = [p[1] for p in fp]
        b = (min(xs), min(ys), max(xs), max(ys), m['top'])
        if (b[2] - b[0]) * (b[3] - b[1]) < 30 or b[2] - b[0] < 3 or b[3] - b[1] < 3: continue
        out.append(b)
    return out
def inside(b, c, frac=0.8):   # b mostly inside c
    ix = max(0, min(b[2], c[2]) - max(b[0], c[0])); iy = max(0, min(b[3], c[3]) - max(b[1], c[1]))
    return ix * iy >= frac * (b[2] - b[0]) * (b[3] - b[1])
raw = boxes('existing') + boxes('heritage')
raw.sort(key=lambda b: -(b[2] - b[0]) * (b[3] - b[1]))
kept = []
for b in raw:
    if any(inside(b, c) for c in kept): continue
    kept.append(b)
# use categories from the base model's use rectangles (x, y = south-west corner)
def cat_at(cx, cy):
    for u in d['uses']:
        if u['x'] <= cx <= u['x'] + u['w'] and u['y'] <= cy <= u['y'] + u['h']: return u['cat']
    return None
TYPE = {'Retail': 'retail', 'Office': 'office', 'Cultural': 'retail', 'Institutional': 'school', 'Hotel': 'hotel', 'Residential': 'residential', 'Transit Station': 'transit'}
COL = {'retail': '#D6457A', 'office': '#3B6FD6', 'school': '#2E9E6B', 'hotel': '#7A5CD6', 'residential': '#C27F00', 'transit': '#7A5CD6'}
NAME = {'retail': 'Shops', 'office': 'Offices', 'school': 'Institution', 'hotel': 'Hotel', 'residential': 'Housing', 'transit': 'Transit station'}
heritage = set(id(b) for b in boxes('heritage'))
nbs = []
def add_nb(b, typ, name, pop, tag=None):
    x0, y0, x1, y1, top = b
    x0c, x1c, y0c, y1c = max(x0, X0), min(x1, X1), max(y0, Y0), min(y1, Y1)
    if x1c - x0c < 2 or y1c - y0c < 2: return
    nbs.append({'id': 'n%d' % (len(nbs) + 1), 'name': name, 'type': typ, 'pop': pop, 'x': tx(x0c), 'z': tz(y0c), 'w': r1(x1c - x0c), 'd': r1(y1c - y0c), 'h': r1(top), 'color': COL[typ], 'cut': x0c > x0 or x1c < x1 or y0c > y0 or y1c < y1, 'raw': (x0, y0, x1, y1)})
for b in kept:
    x0, y0, x1, y1, top = b
    if x1 <= X0 or x0 >= X1 or y1 <= Y0 or y0 >= Y1: continue
    if -72.4 <= (x0 + x1) / 2 <= 72.4 and -39.6 <= (y0 + y1) / 2 <= 39.6: continue   # nothing stands on the parcel
    cat = cat_at((x0 + x1) / 2, (y0 + y1) / 2)
    typ = TYPE.get(cat, 'office')
    if typ == 'transit': typ = 'retail'   # the station gets its own entrance box on the transit plaza
    area = (x1 - x0) * (y1 - y0); floors = max(1, round(top / 3.8))
    pop = {'office': area * floors / 18, 'residential': area * floors / 40, 'hotel': area * floors / 35, 'school': area * floors / 10}.get(typ, 0)
    pop = 0 if pop < 40 else int(min(1500, round(pop / 10) * 10))
    her = any(abs(x0 - h[0]) < 0.2 and abs(y0 - h[1]) < 0.2 for h in boxes('heritage'))
    add_nb(b, typ, ('Heritage ' + NAME[typ].lower()) if her else NAME[typ], pop)
for k, f in enumerate(d['future']):
    xs = [p[0] for p in f['pts']]; ys = [p[1] for p in f['pts']]
    typ = ['office', 'residential', 'office'][k]
    add_nb((min(xs), min(ys), max(xs), max(ys), f['top']), typ, 'Future tower', [1500, 1200, 1500][k])
nbs.append({'id': 'n%d' % (len(nbs) + 1), 'name': 'Transit station', 'type': 'transit', 'pop': 0, 'x': tx(-116), 'z': tz(-86), 'w': 12.0, 'd': 8.0, 'h': 5.0, 'color': COL['transit'], 'cut': False, 'raw': (-116, -86, -104, -78)})

# doors: the side whose outside is free (not another building, not a street, inside the window), facing the site when possible
def free_pt(px, py, me):
    if not (X0 + 1 < px < X1 - 1 and Y0 + 1 < py < Y1 - 1): return False
    for n in nbs:
        if n is me: continue
        x0, y0, x1, y1 = n['raw']
        if x0 - 0.5 < px < x1 + 0.5 and y0 - 0.5 < py < y1 + 0.5: return False
    for r in roads:
        if r['x0'] - 0.3 < px - X0 < r['x1'] + 0.3 and r['z0'] - 0.3 < py - Y0 < r['z1'] + 0.3: return False
    return True
for n in nbs:
    x0, y0, x1, y1 = n['raw']; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    cand = {'W': (x0 - 2, cy), 'E': (x1 + 2, cy), 'S': (cx, y0 - 2), 'N': (cx, y1 + 2)}
    order = sorted(cand, key=lambda s: -{'W': -(0 - cx), 'E': (0 - cx), 'S': -(0 - cy), 'N': (0 - cy)}[s])   # the side facing the parcel (at the origin) first
    ok = [s for s in order if free_pt(*cand[s], n)]
    n['door'] = ok[0] if ok else None
print('dropped', [(n['name'], n['x'], n['z'], n['w'], n['d']) for n in nbs if not n['door']])
nbs = [n for n in nbs if n['door']]   # a sliver cut by the window with no side to enter from is left out (its block edge is where the window's own edge generators stand)
for k, n in enumerate(nbs): n['id'] = 'n%d' % (k + 1); del n['raw']; del n['cut']

# ---- the parcel and a starting design on it (after the tower model and the flow-massing study: podium with its entrance on the west, one tower, a sunken basin by the arterial)
site = {'x0': tx(-72.4), 'z0': tz(-39.6), 'x1': tx(72.4), 'z1': tz(39.6)}
masses = [
    {'id': 'b1', 'name': 'Podium', 'use': 'retail', 'x': tx(-42), 'z': tz(-30), 'w': 114.4, 'd': 60.0, 'base': 0, 'floors': 10, 'ftf': 4, 'door': 'W', 'program': [{'use': 'retail', 'floors': 2}, {'use': 'civic', 'floors': 3}, {'use': 'office', 'floors': 5}]},
    {'id': 'b2', 'name': 'Tower', 'use': 'office', 'x': tx(20), 'z': tz(-22.5), 'w': 45.0, 'd': 45.0, 'base': 40, 'floors': 65, 'ftf': 4, 'door': 'W', 'program': [{'use': 'office', 'floors': 15}, {'use': 'hotel', 'floors': 20}, {'use': 'residential', 'floors': 25}, {'use': 'restaurant', 'floors': 5}]},
]
shapes = [
    {'id': 's1', 'type': 'water', 'name': 'Sunken basin', 'geom': 'poly', 'pts': [[tx(-70), tz(-22)], [tx(-46), tz(-22)], [tx(-46), tz(22)], [tx(-70), tz(22)]]},
    {'id': 's2', 'type': 'planting', 'name': 'Planting bed', 'geom': 'poly', 'pts': [[tx(-40), tz(33)], [tx(60), tz(33)], [tx(60), tz(36)], [tx(-40), tz(36)]]},
    {'id': 's3', 'type': 'paving', 'name': 'Entrance plaza', 'geom': 'poly', 'pts': [[tx(-72.4), tz(-39.6)], [tx(-42), tz(-39.6)], [tx(-42), tz(39.6)], [tx(-72.4), tz(39.6)]]},
]
programs = [
    {'id': 'p1', 'type': 'seating', 'name': 'Seating', 'x': tx(-68), 'z': tz(26), 'w': 20.0, 'd': 8.0, 'door': 'S'},
    {'id': 'p2', 'type': 'seating', 'name': 'Seating', 'x': tx(-68), 'z': tz(-34), 'w': 20.0, 'd': 8.0, 'door': 'N'},
    {'id': 'p3', 'type': 'retail', 'name': 'Kiosk', 'x': tx(-62), 'z': tz(-4), 'w': 5.0, 'd': 8.0, 'door': 'E'},
]
k = 0
for x in range(-36, 70, 10):
    k += 1; programs.append({'id': 't%d' % k, 'type': 'tree', 'name': 'Tree', 'x': tx(x), 'z': tz(-37), 'w': 1.0, 'd': 1.0})
for y in (-30, -10, 10, 30):
    k += 1; programs.append({'id': 't%d' % k, 'type': 'tree', 'name': 'Tree', 'x': tx(-74 + 30), 'z': tz(y), 'w': 1.0, 'd': 1.0})
programs.append({'id': 'k1', 'type': 'bench', 'name': 'Bench', 'x': tx(-44), 'z': tz(0), 'w': 0.6, 'd': 6.0})
# ---- the base model itself, for the context drawing: meshes merged per layer, outlines and curbs, street labels, the future towers (only what touches the window)
def inwin(x0, y0, x1, y1): return x1 > X0 and x0 < X1 and y1 > Y0 and y0 < Y1
model = {'meshes': [], 'curves': [], 'labels': [], 'future': []}
by = {}
for m in d['meshes']:
    v = m['v']; P = [(v[i], v[i + 1], v[i + 2]) for i in range(0, len(v), 3)]
    xs = [p[0] for p in P]; ys = [p[1] for p in P]
    if not inwin(min(xs), min(ys), max(xs), max(ys)): continue
    g = by.setdefault(m['layer'], {'layer': m['layer'], 'pos': [], 'idx': []}); base = len(g['pos']) // 3
    for x, y, z in P: g['pos'] += [round(x - X0, 2), round(z, 2), round(-(y - Y0), 2)]   # three.js: x east, y up, z = -north
    g['idx'] += [i + base for i in m['f']]
model['meshes'] = list(by.values())
for c in d['curves']:
    xs = [p[0] for p in c['pts']]; ys = [p[1] for p in c['pts']]
    if not inwin(min(xs), min(ys), max(xs), max(ys)): continue
    model['curves'].append({'layer': c['layer'], 'pts': [[tx(p[0]), tz(p[1])] for p in c['pts']], 'closed': bool(c.get('closed'))})
seen = set()
for l in d['labels']:
    t = ' '.join(l['text'].split()); x, y = l['pos']
    if t in ('SITE', 'CONNECTION') or (t, round(x), round(y)) in seen or not (X0 < x < X1 and Y0 < y < Y1): continue
    seen.add((t, round(x), round(y))); model['labels'].append({'text': t, 'x': tx(x), 'z': tz(y)})
for f in d['future']:
    xs = [p[0] for p in f['pts']]; ys = [p[1] for p in f['pts']]
    model['future'].append({'x0': tx(min(xs)), 'z0': tz(min(ys)), 'x1': tx(max(xs)), 'z1': tz(max(ys)), 'base': f['base'], 'top': f['top']})
L = {'name': 'Vancouver Tall competition site', 'model': model, 'site': 'vancouver', 'W': W, 'D': D, 'cs': 1.0, 'ref': [tx(-75), tz(0)], 'roads': roads, 'crosswalks': cw, 'mySite': site,
     'targets': {'far': 18, 'height': 300, 'coverage': 0.67}, 'neighbors': nbs, 'shapes': shapes, 'masses': masses, 'programs': programs}
js = "// Generated by tools/gen_site.py from the Vancouver Tall competition base model (vancouver-tall-tower/data/site.json). Metres; X = east - (-150), Z = north - (-110); the parcel is 145 x 79 m in the middle.\nwindow.PFL_SITES = window.PFL_SITES || {};\nwindow.PFL_SITES.vancouver = " + json.dumps(L, separators=(',', ':')) + ";\n"
io.open(OUT, 'w', encoding='utf-8', newline='\n').write(js)
print('model: layers', [(g['layer'], len(g['idx']) // 3) for g in model['meshes']], 'curves', len(model['curves']), 'labels', [l['text'] for l in model['labels']])
print('neighbours', len(nbs), 'people', sum(n['pop'] for n in nbs), 'roads', len(roads), 'crosswalks', len(cw), 'bytes', len(js))
print('doors', {s: sum(1 for n in nbs if n['door'] == s) for s in 'NESW'})
