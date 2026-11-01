/* エネルギーシティ ― 3D の町（Three.js r158）
   見た目だけを担当する。町のしくみ（sim.js）の状態を毎フレーム読んで、ブロックの町・発電所キャラ・雲・雨・夜の明かりを描く。
   形と素材の道具・チャッピーは「仮想プログラミング」（js/view3d.js）と同じ作り。 */
(function (g) {
const EC = g.EC, C = EC.CFG, P = C.plants, T = THREE;
const N = C.map.length, TS = 40;
const X = c => (c - (N - 1) / 2) * TS, Z = r => (r - (N - 1) / 2) * TS;
const TOP = { g: 0, r: -3, '~': -5, m: 24, o: 24 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const rnd = (a, b, k = 0) => { const s = Math.sin(a * 12.9898 + b * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };

/* ---------- 形と色の道具（仮想プログラミングと同じ） ---------- */
function rrShape(w, h, r) {
  const s = new T.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
const boxCache = new Map();
function roundedBox(w, h, d, r) {
  const key = [w, h, d, r].join(',');
  if (boxCache.has(key)) return boxCache.get(key);
  r = Math.min(r, w / 2, h / 2, d / 2) * 0.98;
  const b = r * 0.6;
  const geo = new T.ExtrudeGeometry(rrShape(w - 2 * b, d - 2 * b, Math.max(0.01, r - b)),
    { depth: Math.max(0.01, h - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, -(h - 2 * b) / 2, 0);
  boxCache.set(key, geo);
  return geo;
}
const matCache = new Map();
const std = (color, o) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.62 }, o));
const toy = (color, o) => {
  const key = o ? null : color;
  if (key && matCache.has(key)) return matCache.get(key);
  const m = new T.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.3 }, o));
  if (key) matCache.set(key, m);
  return m;
};
function mesh(geo, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new T.Mesh(geo, material); m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true; return m;
}
function group(x = 0, y = 0, z = 0) { const gr = new T.Group(); gr.position.set(x, y, z); return gr; }
const cyl = (rt, rb, h, seg = 20, axis) => {
  const geo = new T.CylinderGeometry(rt, rb, h, seg);
  if (axis === 'x') geo.rotateZ(Math.PI / 2); if (axis === 'z') geo.rotateX(Math.PI / 2);
  return geo;
};
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  t.redraw = (...a) => { draw(c.getContext('2d'), ...a); t.needsUpdate = true; };
  return t;
}
function roundRectPath(gc, x, y, w, h, r) {
  gc.beginPath(); gc.moveTo(x + r, y); gc.arcTo(x + w, y, x + w, y + h, r); gc.arcTo(x + w, y + h, x, y + h, r);
  gc.arcTo(x, y + h, x, y, r); gc.arcTo(x, y, x + w, y, r); gc.closePath();
}
const glowTex = canvasTex(128, 128, gc => {
  const r = gc.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  gc.fillStyle = r; gc.fillRect(0, 0, 128, 128);
});
glowTex.redraw();
const puffTex = canvasTex(64, 64, gc => {
  const r = gc.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,.95)'); r.addColorStop(0.6, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  gc.fillStyle = r; gc.fillRect(0, 0, 64, 64);
});
puffTex.redraw();

/* ---------- 顔（画面にうつる目と口）：3D と カードのアイコンで同じ絵を使う ---------- */
EC.drawFace = function (gc, w, h, type, mood) {
  const col = type === 'chappy' ? '#3AB7C2' : P[type].eye;
  gc.clearRect(0, 0, w, h);
  gc.fillStyle = '#0B0F11'; roundRectPath(gc, 0, 0, w, h, h * 0.32); gc.fill();
  gc.fillStyle = 'rgba(255,255,255,.12)'; gc.beginPath(); gc.ellipse(w * 0.3, h * 0.2, w * 0.2, h * 0.08, -0.2, 0, 7); gc.fill();
  gc.strokeStyle = col; gc.fillStyle = col; gc.lineCap = 'round'; gc.lineJoin = 'round';
  gc.shadowColor = col; gc.shadowBlur = h * 0.08;
  const ey = h * 0.44, er = h * 0.14, lw = h * 0.085;
  [w * 0.29, w * 0.71].forEach((ex, i) => {
    gc.beginPath(); gc.lineWidth = lw;
    if (mood === 'happy') { gc.moveTo(ex - er, ey + er * 0.4); gc.quadraticCurveTo(ex, ey - er * 1.5, ex + er, ey + er * 0.4); gc.stroke(); }
    else if (mood === 'sleep') { gc.moveTo(ex - er, ey); gc.quadraticCurveTo(ex, ey + er * 0.9, ex + er, ey); gc.stroke(); }
    else if (mood === 'ouch') { const s = i ? -1 : 1; gc.moveTo(ex - er * 0.8 * s, ey - er); gc.lineTo(ex + er * 0.7 * s, ey); gc.lineTo(ex - er * 0.8 * s, ey + er); gc.stroke(); }
    else {
      gc.ellipse(ex, ey, er * 0.62, er * 1.05, 0, 0, 7); gc.fill();
      gc.shadowBlur = 0; gc.fillStyle = 'rgba(240,255,255,.85)';
      gc.beginPath(); gc.ellipse(ex - er * 0.2, ey - er * 0.5, er * 0.17, er * 0.22, -0.3, 0, 7); gc.fill();
      gc.fillStyle = col; gc.shadowBlur = h * 0.08;
      if (mood === 'sad') { gc.beginPath(); gc.lineWidth = lw * 0.7; const s = i ? 1 : -1; gc.moveTo(ex - er * s, ey - er * 1.55); gc.lineTo(ex + er * 0.6 * s, ey - er * 1.25); gc.stroke(); }
    }
  });
  if (mood === 'happy') { gc.shadowBlur = 0; gc.fillStyle = 'rgba(255,125,160,.5)'; [w * 0.16, w * 0.84].forEach(x => { gc.beginPath(); gc.ellipse(x, h * 0.7, w * 0.07, h * 0.06, 0, 0, 7); gc.fill(); }); gc.shadowBlur = h * 0.08; }
  const mx = w / 2, my = h * 0.72, mw = w * 0.11;
  gc.beginPath(); gc.lineWidth = lw * 0.8;
  if (mood === 'ouch') { gc.moveTo(mx - mw * 1.3, my); for (let k = 1; k <= 6; k++) gc.lineTo(mx - mw * 1.3 + k * mw * 0.44, my + (k % 2 ? -h * 0.05 : 0)); gc.stroke(); }
  else if (mood === 'sweat') { gc.ellipse(mx, my, mw * 0.35, h * 0.06, 0, 0, 7); gc.stroke(); }
  else if (mood === 'sad') { gc.moveTo(mx - mw, my + h * 0.04); gc.quadraticCurveTo(mx, my - h * 0.06, mx + mw, my + h * 0.04); gc.stroke(); }
  else if (mood === 'sleep') { gc.moveTo(mx - mw * 0.5, my); gc.lineTo(mx + mw * 0.5, my); gc.stroke(); }
  else { gc.moveTo(mx - mw * 1.2, my - h * 0.03); gc.quadraticCurveTo(mx - mw * 0.6, my + h * 0.1, mx, my); gc.quadraticCurveTo(mx + mw * 0.6, my + h * 0.1, mx + mw * 1.2, my - h * 0.03); gc.stroke(); }
  gc.shadowBlur = 0;
  if (mood === 'sweat') { gc.fillStyle = '#8FD8FF'; gc.beginPath(); const x = w * 0.9, y = h * 0.2; gc.moveTo(x, y); gc.quadraticCurveTo(x + w * 0.05, y + h * 0.16, x, y + h * 0.18); gc.quadraticCurveTo(x - w * 0.05, y + h * 0.16, x, y); gc.fill(); }
  if (mood === 'sleep') { gc.fillStyle = col; gc.font = `900 ${h * 0.26}px sans-serif`; gc.fillText('z', w * 0.82, h * 0.3); }
};

// カード・図鑑用のアイコン（ブロックのキャラ）を画像にする
const iconCache = new Map();
function charaIcon2D(type, mood = 'normal', size = 96) {
  const c = document.createElement('canvas'); c.width = c.height = size; const gc = c.getContext('2d');
  const col = P[type].color, s = size / 96;
  gc.save(); gc.scale(s, s);
  // アクセサリー（頭の上）
  gc.lineCap = 'round';
  if (type === 'solar') { gc.strokeStyle = '#FFB300'; gc.lineWidth = 4; for (let i = 0; i < 5; i++) { const a = Math.PI * (1.1 + i * 0.2); gc.beginPath(); gc.moveTo(48 + Math.cos(a) * 30, 30 + Math.sin(a) * 22); gc.lineTo(48 + Math.cos(a) * 40, 30 + Math.sin(a) * 30); gc.stroke(); } }
  if (type === 'wind') { gc.strokeStyle = '#FFFFFF'; gc.lineWidth = 3; gc.beginPath(); gc.moveTo(48, 22); gc.lineTo(48, 8); gc.stroke(); gc.fillStyle = '#E8F7FB'; for (let i = 0; i < 3; i++) { gc.save(); gc.translate(48, 8); gc.rotate(i * 2.09 + 0.3); gc.beginPath(); gc.ellipse(0, -9, 3, 9, 0, 0, 7); gc.fill(); gc.restore(); } }
  if (type === 'thermal') { gc.fillStyle = '#E9EDF2'; gc.fillRect(62, 4, 10, 22); gc.fillStyle = col; gc.fillRect(62, 4, 10, 4); gc.fillStyle = 'rgba(160,165,175,.7)'; gc.beginPath(); gc.arc(70, 0, 6, 0, 7); gc.fill(); }
  if (type === 'hydro') { gc.fillStyle = '#8CC4FF'; gc.beginPath(); gc.moveTo(48, 2); gc.quadraticCurveTo(60, 18, 48, 24); gc.quadraticCurveTo(36, 18, 48, 2); gc.fill(); }
  if (type === 'geo') { gc.strokeStyle = 'rgba(255,255,255,.9)'; gc.lineWidth = 4; [36, 48, 60].forEach((x, i) => { gc.beginPath(); gc.moveTo(x, 24); gc.quadraticCurveTo(x - 6, 16, x, 10 - i); gc.quadraticCurveTo(x + 6, 4, x, 0); gc.stroke(); }); }
  if (type === 'nuclear') { gc.fillStyle = '#FFF4E8'; gc.beginPath(); gc.arc(48, 26, 18, Math.PI, 0); gc.fill(); }
  if (type === 'battery') { gc.fillStyle = '#2A2F3A'; gc.fillRect(32, 14, 10, 10); gc.fillRect(54, 14, 10, 10); }
  // ブロックの体
  const grd = gc.createLinearGradient(0, 20, 0, 92); grd.addColorStop(0, col); grd.addColorStop(1, R(col, -0.18));
  gc.fillStyle = grd; roundRectPath(gc, 8, 22, 80, 70, 18); gc.fill();
  gc.fillStyle = 'rgba(255,255,255,.28)'; roundRectPath(gc, 14, 26, 68, 10, 5); gc.fill();
  gc.fillStyle = 'rgba(0,0,0,.12)'; roundRectPath(gc, 8, 80, 80, 12, 8); gc.fill();
  gc.translate(18, 40); EC.drawFace(gc, 60, 42, type, mood);
  gc.restore();
  return c.toDataURL();
}
function R(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255; if (f < 0) { r *= 1 + f; gg *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; gg += (255 - gg) * f; b += (255 - b) * f; } return `rgb(${r | 0},${gg | 0},${b | 0})`; }

const faceMats = new Map();
function faceMat(type, mood) {
  const key = type + ':' + mood;
  if (faceMats.has(key)) return faceMats.get(key);
  const t = canvasTex(160, 112, gc => EC.drawFace(gc, 160, 112, type, mood)); t.redraw();
  const m = new T.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false });
  faceMats.set(key, m);
  return m;
}
const faceGeoCache = new Map();
function faceMesh(type, w, h) {
  const key = w + 'x' + h;
  if (!faceGeoCache.has(key)) faceGeoCache.set(key, new T.PlaneGeometry(w, h));
  const m = new T.Mesh(faceGeoCache.get(key), faceMat(type, 'normal'));
  m.userData.type = type; m.userData.mood = 'normal';
  return m;
}

/* ---------- チャッピー（仮想プログラミングの view3d.js と同じ） ---------- */
const CP_TEAL = '#3AB7C2';
const cpWhite = () => toy('#F1F9F7', { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.5, sheenColor: new T.Color('#D6F2F4') });
function drawChappyFace(gc, mood, look = 0) {
  gc.fillStyle = '#0B0F11'; gc.fillRect(0, 0, 256, 176);
  gc.fillStyle = 'rgba(255,255,255,.55)'; gc.beginPath(); gc.ellipse(40, 28, 13, 7, -0.55, 0, Math.PI * 2); gc.fill();
  gc.strokeStyle = CP_TEAL; gc.lineCap = 'round'; gc.lineJoin = 'round'; gc.shadowColor = CP_TEAL; gc.shadowBlur = 8;
  [[63, 82], [193, 84]].forEach(([x, y], i) => {
    x += look; gc.beginPath();
    if (mood === 'happy') { gc.lineWidth = 9; gc.moveTo(x - 17, y + 8); gc.quadraticCurveTo(x, y - 24, x + 17, y + 8); gc.stroke(); }
    else if (mood === 'blink') { gc.lineWidth = 8; gc.moveTo(x - 15, y + 2); gc.quadraticCurveTo(x, y + 13, x + 15, y + 2); gc.stroke(); }
    else if (mood === 'ouch') { const s = i ? -1 : 1; gc.lineWidth = 9; gc.moveTo(x - 13 * s, y - 15); gc.lineTo(x + 12 * s, y); gc.lineTo(x - 13 * s, y + 15); gc.stroke(); }
    else {
      gc.shadowBlur = 0;
      const gr = gc.createLinearGradient(0, y - 26, 0, y + 26); gr.addColorStop(0, '#2FB0BF'); gr.addColorStop(1, '#168C9C');
      gc.fillStyle = gr; gc.ellipse(x, y, 15, 25, 0.06, 0, Math.PI * 2); gc.fill();
      gc.fillStyle = 'rgba(232,252,253,.85)'; gc.beginPath(); gc.ellipse(x - 4.5, y - 13, 3.6, 4.8, -0.3, 0, Math.PI * 2); gc.fill(); gc.shadowBlur = 8;
    }
  });
  if (mood === 'happy') { gc.shadowBlur = 0; gc.fillStyle = 'rgba(255,125,160,.45)'; [[44, 118], [212, 120]].forEach(([x, y]) => { gc.beginPath(); gc.ellipse(x + look, y, 14, 7, 0, 0, Math.PI * 2); gc.fill(); }); gc.shadowBlur = 8; }
  const mx = 128 + look * 0.5, my = 121;
  gc.lineWidth = 7; gc.beginPath();
  if (mood === 'ouch') { gc.moveTo(mx - 26, my + 8); for (let i = 1; i <= 6; i++) gc.lineTo(mx - 26 + i * 9, my + 8 + (i % 2 ? -7 : 0)); }
  else {
    gc.moveTo(mx - 28, my);
    gc.bezierCurveTo(mx - 26, my + 12, mx - 18, my + 15, mx - 12, my + 14);
    gc.bezierCurveTo(mx - 5, my + 13, mx - 1, my + 9, mx, my + 6);
    gc.bezierCurveTo(mx + 3, my + 10, mx + 8, my + 15, mx + 15, my + 15);
    gc.bezierCurveTo(mx + 22, my + 15, mx + 28, my + 11, mx + 30, my);
  }
  gc.stroke(); gc.shadowBlur = 0;
}
const HEAD = { a: 35, b: 27, c: 24.5, n: 3, taper: 0.07 };
const headA = y => HEAD.a * (1 - HEAD.taper * Math.max(0, -y / HEAD.b));
function superEllipsoid() {
  const geo = new T.SphereGeometry(1, 48, 36), p = geo.attributes.position, n = HEAD.n;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = Math.pow(Math.abs(x) ** n + Math.abs(y) ** n + Math.abs(z) ** n, 1 / n) || 1;
    const yy = y / k * HEAD.b;
    p.setXYZ(i, x / k * headA(yy), yy, z / k * HEAD.c);
  }
  geo.computeVertexNormals();
  return geo;
}
function screenCap(sa, sb, oy) {
  const Rr = 12, A = 64, pos = [], uv = [], idx = [];
  const zOn = (x, y) => HEAD.c * Math.pow(Math.max(0, 1 - Math.abs(x / headA(y)) ** HEAD.n - Math.abs(y / HEAD.b) ** HEAD.n), 1 / HEAD.n) + 0.25;
  pos.push(0, oy, zOn(0, oy)); uv.push(0.5, 0.5);
  for (let i = 1; i <= Rr; i++) for (let j = 0; j < A; j++) {
    const t = j / A * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), r = i / Rr;
    const x = sa * r * Math.sign(c) * Math.sqrt(Math.abs(c)), y = oy + sb * r * Math.sign(s) * Math.sqrt(Math.abs(s));
    pos.push(x, y, zOn(x, y)); uv.push(x / (2 * sa) + 0.5, (y - oy) / (2 * sb) + 0.5);
  }
  for (let j = 0; j < A; j++) idx.push(0, 1 + j, 1 + (j + 1) % A);
  for (let i = 1; i < Rr; i++) for (let j = 0; j < A; j++) {
    const a0 = 1 + (i - 1) * A + j, a1 = 1 + (i - 1) * A + (j + 1) % A;
    idx.push(a0, a0 + A, a1 + A, a0, a1 + A, a1);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
function earPath(path, s, inner) {
  const XX = x => x * s * 1.45;
  if (inner) {
    path.moveTo(XX(-9.2), 3); path.bezierCurveTo(XX(-6.6), 9, XX(-2.6), 15.6, XX(1.6), 21.4);
    path.quadraticCurveTo(XX(3.6), 23.6, XX(5.2), 21.2); path.bezierCurveTo(XX(6.6), 15, XX(7.2), 9, XX(7), 2.6);
    path.quadraticCurveTo(XX(-1), 1.2, XX(-9.2), 3);
  } else {
    path.moveTo(XX(-14), 0); path.bezierCurveTo(XX(-10.5), 8, XX(-4.5), 17.5, XX(1.6), 25.6);
    path.quadraticCurveTo(XX(4), 29.4, XX(6.4), 25.8); path.bezierCurveTo(XX(8.6), 19, XX(10.2), 10, XX(10), 0);
    path.quadraticCurveTo(XX(-2), -3, XX(-14), 0);
  }
  return path;
}
function chappyEar(s, white) {
  const ear = group(s * 18.5, 13, -3); ear.rotation.set(-0.05, 0, -s * 0.12);
  const body = new T.ExtrudeGeometry(earPath(new T.Shape(), s), { depth: 5, bevelEnabled: true, bevelThickness: 2, bevelSize: 1.6, bevelSegments: 3, curveSegments: 10 });
  body.translate(0, 0, -4.5);
  ear.add(mesh(body, white));
  const grad = canvasTex(4, 64, gc => { const r = gc.createLinearGradient(0, 0, 0, 64); r.addColorStop(0, '#86CCD8'); r.addColorStop(1, '#3F98AA'); gc.fillStyle = r; gc.fillRect(0, 0, 4, 64); });
  grad.redraw(); grad.repeat.set(1, 1 / 24);
  ear.add(mesh(new T.ShapeGeometry(earPath(new T.Shape(), s, true), 10), std('#FFFFFF', { map: grad, roughness: 0.5 }), 0, 0, 2.6, false));
  return ear;
}
function chappyHead(white) {
  const gr = new T.Group();
  gr.add(mesh(superEllipsoid(), white));
  const face = canvasTex(256, 176, drawChappyFace); face.redraw('normal', 0);
  const screenMat = new T.MeshPhysicalMaterial({ map: face, emissiveMap: face, emissive: '#FFFFFF', emissiveIntensity: 0.35, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 });
  gr.add(mesh(screenCap(27.3, 19.2, -1.5), screenMat, 0, 0, 0, false));
  const ears = [-1, 1].map(s => { const e = chappyEar(s, white); gr.add(e); return e; });
  return { g: gr, face, ears };
}
function apple(r, mat) {
  const gr = new T.Group();
  const body = mesh(new T.SphereGeometry(r, 20, 14), mat); body.scale.set(1, 0.9, 1); gr.add(body);
  gr.add(mesh(cyl(r * 0.1, r * 0.12, r * 0.7, 6), std('#6B4423'), 0, r * 0.95, 0));
  const leaf = mesh(new T.SphereGeometry(r * 0.45, 10, 6), std('#4A9628', { roughness: 0.5 }), r * 0.35, r * 1.05, 0, false);
  leaf.scale.set(1.5, 0.28, 0.75); leaf.rotation.z = 0.5; gr.add(leaf);
  return gr;
}
function tailTube(points, r0, r1, white) {
  const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
  const seg = 40, rad = 8, geo = new T.TubeGeometry(curve, seg, r0, rad, false);
  const p = geo.attributes.position, c = new T.Vector3(), v = new T.Vector3();
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, c); const k = (r0 + (r1 - r0) * i / seg) / r0;
    for (let j = 0; j <= rad; j++) { const n = i * (rad + 1) + j; v.fromBufferAttribute(p, n).sub(c).multiplyScalar(k).add(c); p.setXYZ(n, v.x, v.y, v.z); }
  }
  geo.computeVertexNormals();
  return { mesh: mesh(geo, white), end: curve.getPointAt(1) };
}
function makeChappy() {
  const white = cpWhite(), gr = new T.Group(), all = new T.Group(); gr.add(all);
  const legs = [-1, 1].map(s => {
    const leg = group(s * 7.4, 14, 0);
    leg.add(mesh(new T.CapsuleGeometry(7, 3, 6, 12), white, 0, -5.5, 0));
    const foot = mesh(new T.SphereGeometry(7.8, 16, 12), white, s * 0.6, -10.6, 1.8); foot.scale.set(1, 0.52, 1.25); leg.add(foot);
    all.add(leg); return leg;
  });
  const prof = [[0.01, 0], [13, 0.6], [17.6, 4], [19.4, 11.5], [19, 20], [17, 27], [12.5, 32], [6.5, 34], [0.01, 34.5]].map(([r, y]) => new T.Vector2(r, y));
  const torso = mesh(new T.LatheGeometry(prof, 32), white, 0, 9.5, 0); torso.scale.z = 0.86; all.add(torso);
  const arms = [-1, 1].map(s => {
    const a = group(s * 17, 38.5, 0.5); a.rotation.z = s * 0.26;
    a.add(mesh(new T.CapsuleGeometry(6.2, 11, 6, 10), white, 0, -9.5, 0.6)); all.add(a); return a;
  });
  const tail = group(2, 20, -10); all.add(tail);
  const t = tailTube([[0, 0, 0], [8, -5, -9], [24, -6, -12], [38, 3, -9], [43, 24, -6], [41, 48, -4], [39, 62, -4]], 2.3, 1.75, white);
  tail.add(t.mesh);
  const ap = apple(10.5, toy('#E2432F', { roughness: 0.28, clearcoat: 0.8 })); ap.position.copy(t.end).add(new T.Vector3(0, 9, 0)); tail.add(ap);
  const head = chappyHead(white); head.g.position.set(0, 64, 0); all.add(head.g);
  const star = new T.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.6 : 6, a = i / 10 * Math.PI * 2 + Math.PI / 2; i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const starGeo = new T.ExtrudeGeometry(star, { depth: 1.8, bevelEnabled: false }); starGeo.center();
  const starMat = std('#FFD23F', { emissive: '#FFB800', emissiveIntensity: 0.9 });
  const stars = group(0, 112, 0); stars.visible = false;
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; stars.add(mesh(starGeo, starMat, Math.cos(a) * 22, 0, Math.sin(a) * 22, false)); }
  all.add(stars);
  let blink = 2 + Math.random() * 2, key = '';
  function update(time, dt, s) {
    const hurt = s.hurt ? 1 : 0, ph = time * 9;
    blink -= dt; if (blink < -0.14) blink = 2 + Math.random() * 2.5;
    const mood = hurt ? 'ouch' : s.mood !== 'normal' ? s.mood : blink < 0 ? 'blink' : 'normal';
    if (mood !== key) { key = mood; head.face.redraw(mood, 0); }
    all.position.set(0, s.jump ? Math.abs(Math.sin(time * 7)) * 22 : 0, 0);
    all.rotation.x = -0.25 * hurt;
    all.scale.y = 1 + Math.sin(time * 1.8) * 0.015;
    tail.rotation.y = Math.sin(time * 1.8) * 0.12;
    head.g.rotation.z = Math.sin(time * 0.9) * 0.05 + Math.sin(time * 28) * 0.12 * hurt;
    head.ears.forEach((e, i) => { e.rotation.x = -0.05 + (Math.sin(time * 3 + i) > 0.97 ? -0.25 : 0); });
    legs.forEach(l => { l.rotation.x = 0; });
    arms.forEach((a, i) => {
      let z = 0.26;
      if (i === 1 && s.wave) z = 2.3 + Math.sin(time * 10) * 0.35;
      if (s.jump) z = 2.3 + Math.sin(time * 10 + i) * 0.3;
      if (hurt) z = 2.6 + Math.sin(time * 14 + i) * 0.2;
      a.rotation.set(0, 0, (i ? 1 : -1) * z);
    });
    stars.visible = !!hurt;
    if (stars.visible) stars.rotation.y = time * 6;
    void ph;
  }
  return { g: gr, update };
}

/* ---------- 記号のつぶ（Z・ハート・星・しずく・顔） ---------- */
function glyphTex(ch, col, font) {
  const t = canvasTex(64, 64, gc => { gc.clearRect(0, 0, 64, 64); gc.font = font || '900 46px sans-serif'; gc.textAlign = 'center'; gc.textBaseline = 'middle';
    if (col) { gc.lineWidth = 8; gc.strokeStyle = '#FFFFFF'; gc.lineJoin = 'round'; gc.strokeText(ch, 32, 35); gc.fillStyle = col; }
    gc.fillText(ch, 32, 35); });
  t.redraw(); return t;
}
const zTex = glyphTex('Z', '#4D6FD8'), heartTex = glyphTex('♥', '#FF5C8A'), starTex = glyphTex('★', '#FFC21A');
const dropTex = (() => { const t = canvasTex(64, 64, gc => { gc.clearRect(0, 0, 64, 64); gc.fillStyle = '#7FD3FF'; gc.strokeStyle = '#FFFFFF'; gc.lineWidth = 5; gc.beginPath(); gc.moveTo(32, 6); gc.quadraticCurveTo(54, 36, 32, 56); gc.quadraticCurveTo(10, 36, 32, 6); gc.fill(); gc.stroke(); }); t.redraw(); return t; })();
const emojiTex = {};
const emojiOf = ch => emojiTex[ch] || (emojiTex[ch] = glyphTex(ch, null, '48px sans-serif'));

/* ---------- 町の建物 ---------- */
const winLit = std('#FFE7A0', { emissive: '#FFC65A', emissiveIntensity: 1.4, roughness: 0.3 });
const winDay = std('#CFEFFF', { roughness: 0.15, emissive: '#3C6E91', emissiveIntensity: 0.2 });
const winDark = std('#3A4250', { roughness: 0.4 });
function roofGeo(w, d, h) {
  const sh = new T.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.closePath();
  const geo = new T.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.2, bevelSegments: 1 });
  geo.translate(0, 0, -d / 2); return geo;
}
const ROOF = roofGeo(28, 26, 14);
function makeHouse(b) {
  const gr = new T.Group(), col = C.houseColors[b.col % C.houseColors.length];
  gr.add(mesh(roundedBox(22, 18, 22, 4), toy('#FFFFFF'), 0, 9, 0));
  gr.add(mesh(ROOF, toy(col, null), 0, 17, 0));
  gr.add(mesh(roundedBox(6, 9, 2, 1.5), std('#8B5E3C'), -5, 4.5, 11.2, false));
  const wins = [mesh(roundedBox(6, 6, 1.6, 1.2), winDay, 5, 10, 11.2, false), mesh(roundedBox(1.6, 6, 6, 1.2), winDay, 11.2, 10, 0, false)];
  wins.forEach(w => gr.add(w));
  const glow = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: '#FFC86B', transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.scale.set(64, 64, 1); glow.position.set(0, 12, 0); glow.raycast = () => {}; gr.add(glow);
  gr.userData.wins = wins; gr.userData.glow = glow;
  return gr;
}
function makeFactory() {
  const gr = new T.Group();
  gr.add(mesh(roundedBox(34, 20, 30, 5), toy('#E9EEF5'), 0, 10, 0));
  for (let i = 0; i < 3; i++) { const r = mesh(roofGeo(11, 28, 8), toy('#2B7DE9'), -11 + i * 11, 20, 0); r.scale.x = 1; gr.add(r); }
  gr.add(mesh(cyl(3.4, 4, 40, 16), toy('#FFFFFF'), 12, 20, -9), mesh(cyl(3.6, 3.6, 4, 16), toy('#EB4B43'), 12, 38, -9));
  const wins = [mesh(roundedBox(24, 5, 1.6, 1.2), winDay, -2, 10, 15.2, false)];
  wins.forEach(w => gr.add(w));
  const glow = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: '#FFD08A', transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.scale.set(80, 80, 1); glow.position.set(0, 12, 0); glow.raycast = () => {}; gr.add(glow);
  gr.userData.wins = wins; gr.userData.glow = glow; gr.userData.chimney = new T.Vector3(12, 42, -9);
  return gr;
}
function makeTree(b) {
  const gr = new T.Group(), r = rnd(b.r, b.c);
  const leaf = std(['#5DBB63', '#4CAF6A', '#7CCB5B'][Math.floor(r * 3)], { flatShading: true, roughness: 0.8 });
  gr.add(mesh(cyl(2.4, 3.2, 12, 8), std('#8B5E3C', { roughness: 0.9 }), 0, 6, 0));
  gr.add(mesh(new T.IcosahedronGeometry(11, 0), leaf, 0, 19, 0));
  gr.add(mesh(new T.IcosahedronGeometry(7.5, 0), leaf, 3, 28, -2));
  gr.rotation.y = r * 6; gr.scale.setScalar(0.85 + r * 0.35);
  return gr;
}
function makeHall() {
  const gr = new T.Group();
  gr.add(mesh(roundedBox(32, 4, 32, 3), toy('#F4F6FA'), 0, 2, 0));
  gr.add(mesh(roundedBox(26, 22, 20, 5), toy('#FFFFFF'), 0, 15, -5));
  gr.add(mesh(roofGeo(32, 24, 12), toy('#0FB5AA'), 0, 26, -5));
  gr.add(mesh(cyl(5.5, 5.5, 2, 24, 'z'), toy('#FFFFFF'), 0, 32, 7.2), mesh(cyl(4.4, 4.4, 2.4, 24, 'z'), std('#1E2A38'), 0, 32, 7.4, false));
  gr.add(mesh(cyl(0.8, 0.8, 30, 8), std('#AEB8C4'), 12, 19, 8));
  const flag = mesh(new T.PlaneGeometry(10, 6), std('#F5B301', { side: T.DoubleSide }), 17, 31, 8, false); gr.add(flag);
  const cp = makeChappy(); cp.g.scale.setScalar(0.3); cp.g.position.set(0, 4, 9); gr.add(cp.g);
  gr.userData.chappy = cp; gr.userData.flag = flag;
  return gr;
}

/* ---------- 発電所（キャラクター） ---------- */
let panelM = null, fallT = null;
function panelMat() {
  if (panelM) return panelM;
  const tex = canvasTex(128, 64, gc => { gc.fillStyle = '#1F3F7A'; gc.fillRect(0, 0, 128, 64); gc.strokeStyle = 'rgba(160,200,255,.55)'; gc.lineWidth = 2; for (let x = 0; x <= 128; x += 21) { gc.beginPath(); gc.moveTo(x, 0); gc.lineTo(x, 64); gc.stroke(); } for (let y = 0; y <= 64; y += 21) { gc.beginPath(); gc.moveTo(0, y); gc.lineTo(128, y); gc.stroke(); } });
  tex.redraw();
  return (panelM = new T.MeshPhysicalMaterial({ color: '#FFFFFF', map: tex, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0.1 }));
}
function fallTex() {
  if (fallT) return fallT;
  fallT = canvasTex(32, 64, gc => { gc.fillStyle = '#BFE9FF'; gc.fillRect(0, 0, 32, 64); gc.fillStyle = '#FFFFFF'; for (let y = 0; y < 64; y += 16) gc.fillRect(0, y, 32, 6); });
  fallT.redraw(); fallT.wrapS = fallT.wrapT = T.RepeatWrapping;
  return fallT;
}
function pad() { return mesh(roundedBox(34, 3, 34, 3), toy('#F4F6FA'), 0, 1.5, 0); }

/* ---------- 発電所キャラクター（電源の特徴を形にした、ゆるいブロックの子たち） ----------
   太陽光発電：お日さまの体と光の輪。頭のパネルが太陽を追いかけ、夜はナイトキャップで寝る
   風力発電：頭の上に大きなプロペラ。風でマフラーがなびく
   火力発電：ストーブの体に炎と煙突。燃料のドラム缶つき（古い火力はおひげ）
   水力発電：しずくの子。ダムの上にすわっている
   地熱発電：タオルをのせて温泉につかる、ぽかぽかの子
   原子力発電：ドームのヘルメットに原子の輪。力もち。点検の日は柵の中で休む
   蓄電池：電池の体。おなかの窓に、ためた電気が光る */
const GC = new Map();
const gget = (k, fn) => { if (!GC.has(k)) GC.set(k, fn()); return GC.get(k); };
const spherePatch = (r, pw, th) => gget(`sp${r}_${pw}_${th}`, () => new T.SphereGeometry(r, 24, 16, Math.PI / 2 - pw / 2, pw, Math.PI / 2 - th / 2, th));
const cylPatch = (r, h, tw) => gget(`cp${r}_${h}_${tw}`, () => new T.CylinderGeometry(r, r, h, 24, 1, true, -tw / 2, tw));
const planeG = (w, h) => gget(`pl${w}_${h}`, () => new T.PlaneGeometry(w, h));
const flameA = new T.MeshBasicMaterial({ color: '#FF6A1A', toneMapped: false }), flameB = new T.MeshBasicMaterial({ color: '#FFD84A', toneMapped: false });
const metal = std('#9AA6B8', { roughness: 0.4, metalness: 0.3 });
function facePart(type, geom, x, y, z) {
  const m = new T.Mesh(geom, faceMat(type, 'normal')); m.position.set(x, y, z);
  m.userData.type = type; m.userData.mood = 'normal'; m.renderOrder = 2;
  return m;
}
function limbs(body, col, halfW, armY, footY, s, noFeet) {
  s = s || 1;
  const mat = toy(col), dark = toy(R(col, -0.14));
  const armG = gget('arm' + s, () => new T.CapsuleGeometry(2.1 * s, 4.6 * s, 4, 10));
  const footG = gget('foot' + s, () => new T.SphereGeometry(3.4 * s, 14, 10));
  const L = group(-halfW, armY, 0.5), Rr = group(halfW, armY, 0.5);
  L.add(mesh(armG, mat, 0, -3.8 * s, 0)); Rr.add(mesh(armG, mat, 0, -3.8 * s, 0));
  L.rotation.z = -0.45; Rr.rotation.z = 0.45;
  body.add(L, Rr);
  if (!noFeet) [-1, 1].forEach(sx => { const f = mesh(footG, dark, sx * 4.4 * s, footY, 2); f.scale.set(1, 0.55, 1.3); body.add(f); });
  return { L, R: Rr };
}
const stripeTex = (() => { const t = canvasTex(128, 16, gc => { gc.fillStyle = '#F5C21A'; gc.fillRect(0, 0, 128, 16); gc.fillStyle = '#2A2F3A'; for (let x = -16; x < 128; x += 24) { gc.beginPath(); gc.moveTo(x, 16); gc.lineTo(x + 12, 0); gc.lineTo(x + 24, 0); gc.lineTo(x + 12, 16); gc.fill(); } }); t.redraw(); return t; })();
function makeChara(p, portrait) {
  const type = p.type, col = p.old ? '#D0675E' : P[type].color;
  const root = new T.Group(), body = new T.Group(); root.add(body);
  const rig = { root, body, type, ud: {}, headY: 26, bx: 0, by: 0, bz: 0 };
  const u = rig.ud;
  switch (type) {
    case 'solar': {
      const by = 13;
      body.add(mesh(gget('sball', () => new T.SphereGeometry(10, 28, 20)), toy(col), 0, by, 0));
      const rays = group(0, by, -2.5), ray = gget('ray', () => new T.ConeGeometry(2.4, 6, 8));
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, m = mesh(ray, toy('#FF9F1A'), Math.cos(a) * 12, Math.sin(a) * 12, 0); m.rotation.z = a - Math.PI / 2; rays.add(m); }
      body.add(rays); u.rays = rays;
      rig.face = facePart(type, spherePatch(10.2, 1.5, 1.0), 0, by, 0); body.add(rig.face);
      rig.arms = limbs(body, col, 9.6, by - 1, 2);
      const hat = group(0, by + 9.5, 0);
      hat.add(mesh(gget('hpole', () => cyl(0.7, 0.7, 5, 6)), metal, 0, 2.5, 0));
      const hp = group(0, 5.2, 0); hp.add(mesh(gget('hpan', () => new T.BoxGeometry(16, 1, 11)), panelMat(), 0, 0, 0)); hat.add(hp);
      body.add(hat); u.hat = hat; u.hp = hp;
      const cap = group(-1, by + 7.5, -1);
      cap.add(mesh(gget('ncap', () => new T.ConeGeometry(7.5, 12, 18)), toy('#4D6FD8'), 0, 5, 0), mesh(gget('pom', () => new T.SphereGeometry(2.2, 10, 8)), toy('#FFFFFF'), 0, 11.5, 0));
      cap.rotation.z = 0.35; cap.visible = false; body.add(cap); u.cap = cap;
      rig.headY = by + 14;
      if (!portrait) {
        rig.bz = 7;
        [-10, 10].forEach(x => { const t = group(x, 0, -9); t.add(mesh(gget('lg', () => cyl(0.8, 0.8, 6, 6)), metal, 0, 3, 0)); const pn = mesh(gget('pnl', () => new T.BoxGeometry(15, 1.2, 13)), panelMat(), 0, 7, 0); pn.rotation.x = -0.5; t.add(pn); root.add(t); });
      }
      break;
    }
    case 'wind': {
      body.add(mesh(gget('wbody', () => new T.CapsuleGeometry(7.6, 7, 8, 16)), toy(col), 0, 13, 0));
      body.add(mesh(gget('wbelly', () => new T.SphereGeometry(5.2, 16, 12)), toy('#E8FBFF'), 0, 8.5, 4.6));
      rig.face = facePart(type, cylPatch(7.8, 7.6, 1.75), 0, 15.5, 0); body.add(rig.face);
      const scarf = mesh(gget('scarf', () => new T.TorusGeometry(7.5, 1.5, 8, 24)), toy('#FF7FB6'), 0, 10.6, 0); scarf.rotation.x = Math.PI / 2; body.add(scarf);
      const tails = group(-3.5, 10.6, -6.8);
      [0, 1].forEach(i => tails.add(mesh(gget('stail', () => roundedBox(2.6, 1.2, 8, 0.5)), toy('#FF7FB6'), i * 2.8 - 1.4, -0.5 * i, -3.6)));
      body.add(tails); u.tails = tails;
      rig.arms = limbs(body, col, 8.3, 12.5, 1.8);
      body.add(mesh(gget('bean', () => new T.SphereGeometry(4.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), toy('#1E8FA8'), 0, 23.3, 0));
      const top = portrait ? 30 : 66, pl = top - 24;
      body.add(mesh(gget('wpole' + pl, () => cyl(1.1, 1.6, pl, 8)), toy('#FFFFFF'), 0, 24 + pl / 2, 0));
      body.add(mesh(gget('nac', () => roundedBox(6, 5, 9, 2.2)), toy('#FFFFFF'), 0, top, -1));
      const rotor = group(0, top, 4.2), bl = portrait ? 10 : 25;
      const blade = gget('blade' + bl, () => roundedBox(3.4, bl, 1.1, 0.55));
      for (let i = 0; i < 3; i++) { const a = new T.Group(); a.rotation.z = i * Math.PI * 2 / 3 + 0.3; a.add(mesh(blade, toy('#FFFFFF'), 0, bl / 2 + 1.5, 0)); rotor.add(a); }
      rotor.add(mesh(gget('hub', () => new T.SphereGeometry(2.6, 12, 8)), toy(col)));
      body.add(rotor); u.rotor = rotor;
      rig.headY = 26;
      break;
    }
    case 'thermal': {
      body.add(mesh(gget('tbody', () => roundedBox(24, 19, 19, 7)), toy(col), 0, 12, 0));
      body.add(mesh(gget('tbelly', () => roundedBox(15, 7, 1.4, 0.7)), toy(R(col, -0.25)), 0, 7.2, 9.4));
      for (let i = 0; i < 3; i++) body.add(mesh(gget('tvent', () => new T.BoxGeometry(11, 0.8, 0.6)), std('#3A2020'), 0, 5.2 + i * 2, 10.2, false));
      rig.face = facePart(type, planeG(14.5, 9.6), 0, 15.6, 9.65); body.add(rig.face);
      rig.arms = limbs(body, col, 12.6, 14.5, 1.8);
      u.chim = [];
      [-7.5, 7.5].forEach(x => {
        body.add(mesh(gget('chim', () => cyl(2.4, 2.8, 11, 12)), toy('#F4F6FA'), x, 26, -3.5));
        body.add(mesh(gget('chimTop', () => cyl(2.6, 2.6, 2.4, 12)), toy(p.old ? '#9AA3B2' : '#EB4B43'), x, 31.4, -3.5));
        u.chim.push(new T.Vector3(x, 33.5, -3.5));
      });
      const flame = group(0, 21.2, 2);
      flame.add(mesh(gget('fl1', () => new T.ConeGeometry(3.6, 9, 12)), flameA, 0, 4.5, 0, false), mesh(gget('fl2', () => new T.ConeGeometry(2, 6, 10)), flameB, 0, 3.4, 0.9, false));
      body.add(flame); u.flame = flame;
      if (p.old) [-1, 1].forEach(s => { const m = mesh(gget('must', () => new T.CapsuleGeometry(1.2, 3.4, 4, 8)), toy('#FFFFFF'), s * 2.7, 11.4, 10.3, false); m.rotation.z = s * 1.15; body.add(m); });
      if (!portrait) {
        const drum = group(14, 0, 9);
        drum.add(mesh(gget('drum', () => cyl(4.2, 4.2, 10, 16)), toy('#2B3A55'), 0, 5, 0));
        [2.5, 7.5].forEach(y => drum.add(mesh(gget('band', () => cyl(4.35, 4.35, 1, 16)), toy('#F5B301'), 0, y, 0, false)));
        root.add(drum); u.drum = drum;
      }
      rig.headY = 31;
      break;
    }
    case 'hydro': {
      if (!portrait) {
        root.add(mesh(gget('dam', () => roundedBox(38, 16, 10, 3)), toy('#DCE7F2'), 0, 8, 0));
        root.add(mesh(gget('damS', () => new T.BoxGeometry(38.4, 2, 10.4)), toy('#2B7DE9'), 0, 13, 0, false));
        root.add(mesh(gget('resv', () => roundedBox(38, 10, 16, 3)), toy('#5DB8F2'), 0, 5, -13));
        const ft = fallTex();
        root.add(mesh(planeG(12, 11), new T.MeshBasicMaterial({ map: ft, transparent: true, opacity: 0.92, toneMapped: false }), 0, 6, 5.3, false));
        u.fallTex = ft; rig.by = 16;
      }
      const dc = toy(col);
      body.add(mesh(gget('drop', () => new T.SphereGeometry(8.6, 24, 18)), dc, 0, 8.6, 0));
      body.add(mesh(gget('dtip', () => new T.ConeGeometry(6.3, 10, 20)), dc, 0, 17.6, 0));
      body.add(mesh(gget('dshine', () => new T.SphereGeometry(1.6, 10, 8)), toy('#FFFFFF'), -4.2, 14, 5.8, false));
      rig.face = facePart(type, spherePatch(8.75, 1.5, 0.95), 0, 8.2, 0); body.add(rig.face);
      const curl = mesh(gget('curl', () => new T.TorusGeometry(2.6, 0.9, 8, 16, Math.PI * 1.3)), toy('#8CC4FF'), 0.8, 23.5, 0); curl.rotation.z = -0.6; body.add(curl);
      rig.arms = limbs(body, col, 8.4, 8.5, 0.9, 0.85);
      rig.headY = 25;
      break;
    }
    case 'geo': {
      root.add(mesh(gget('tub', () => cyl(14, 14, 7, 28)), toy('#B9814F'), 0, 3.5, 0));
      root.add(mesh(gget('tubW', () => cyl(12.6, 12.6, 0.6, 28)), toy('#9EE7F5'), 0, 7.1, 0, false));
      const gb = mesh(gget('gball', () => new T.SphereGeometry(9, 26, 18)), toy(col), 0, 9.5, 0); gb.scale.y = 0.92; body.add(gb);
      rig.face = facePart(type, spherePatch(9.15, 1.5, 0.85), 0, 10.6, 0); body.add(rig.face);
      const towel = mesh(gget('towel', () => roundedBox(11, 2.6, 8, 1.2)), toy('#FFFFFF'), 0, 18.4, -0.5); towel.rotation.z = 0.12; body.add(towel);
      rig.arms = limbs(body, col, 9.6, 9.5, 0, 0.95, true);
      rig.arms.L.rotation.z = -1.3; rig.arms.R.rotation.z = 1.3;
      if (!portrait) {
        root.add(mesh(gget('gpipe', () => cyl(1.6, 1.6, 12, 10, 'x')), metal, 10, 5, -10));
        root.add(mesh(gget('gtower', () => cyl(3.4, 4.2, 18, 14)), toy('#F4F6FA'), 14, 9, -10));
        u.vent = new T.Vector3(14, 19, -10);
      }
      u.water = new T.Vector3(0, 7.5, 0);
      rig.headY = 21;
      break;
    }
    case 'nuclear': {
      body.add(mesh(gget('nbody', () => roundedBox(28, 20, 24, 7)), toy(col), 0, 12, 0));
      const em = group(0, 7.4, 12.2);
      em.add(mesh(gget('nem', () => cyl(6.2, 6.2, 1, 24, 'z')), toy('#FFFFFF'), 0, 0, 0, false));
      [0, 1, 2].forEach(i => { const t = mesh(gget('natom', () => new T.TorusGeometry(3.8, 0.42, 6, 24)), toy(col), 0, 0, 0.8, false); t.rotation.z = i * Math.PI / 3; t.scale.y = 0.45; em.add(t); });
      em.add(mesh(gget('nnuc', () => new T.SphereGeometry(1.2, 10, 8)), toy('#E8604C'), 0, 0, 1, false));
      body.add(em);
      rig.face = facePart(type, planeG(15, 9.6), 0, 16.4, 12.15); body.add(rig.face);
      body.add(mesh(gget('ndome', () => new T.SphereGeometry(12, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2)), toy('#FFF6EC'), 0, 22, -1));
      const band = mesh(gget('nband', () => new T.TorusGeometry(12, 1, 8, 32)), toy(col), 0, 22.3, -1); band.rotation.x = Math.PI / 2; body.add(band);
      const orbit = group(0, 28, -1), ring = gget('nring', () => new T.TorusGeometry(16, 0.45, 6, 48)), el = gget('nel', () => new T.SphereGeometry(1.5, 10, 8));
      [-0.55, 0.55].forEach((tilt, i) => { const g2 = new T.Group(); g2.rotation.x = Math.PI / 2 + tilt; g2.add(mesh(ring, toy('#FFC48A'), 0, 0, 0, false)); g2.add(mesh(el, toy('#2FC1DA'), 16 * (i ? -1 : 1), 0, 0, false)); orbit.add(g2); });
      body.add(orbit); u.orbit = orbit;
      rig.arms = limbs(body, col, 14.6, 15.5, 1.8, 1.3);
      const bar = group(0, 0, 18); bar.visible = false;
      const sm = new T.MeshStandardMaterial({ map: stripeTex, roughness: 0.5 });
      bar.add(mesh(gget('nbar', () => new T.BoxGeometry(26, 3, 1)), sm, 0, 6, 0)); [-12, 12].forEach(x => bar.add(mesh(gget('npost', () => cyl(0.8, 0.8, 8, 6)), metal, x, 4, 0)));
      root.add(bar); u.barrier = bar;
      u.barrels = group(0, 0, 0); root.add(u.barrels); u.nBarrels = 0;
      rig.headY = 40;
      break;
    }
    case 'battery': {
      body.add(mesh(gget('bbody', () => cyl(9, 9, 22, 28)), toy(col), 0, 13, 0));
      body.add(mesh(gget('bcap', () => cyl(9.3, 9.3, 2.2, 28)), toy(R(col, -0.2)), 0, 24.6, 0));
      body.add(mesh(gget('bterm', () => cyl(3, 3, 3.2, 16)), toy('#F5C542'), 0, 27.2, 0));
      rig.face = facePart(type, cylPatch(9.15, 8.6, 1.7), 0, 19, 0); body.add(rig.face);
      body.add(mesh(cylPatch(9.1, 9, 1.05), std('#163A28', { side: T.DoubleSide }), 0, 8.6, 0, false));
      u.levelMat = std('#C8FF6A', { emissive: '#7CFF5A', emissiveIntensity: 0.8 });
      u.level = mesh(gget('blvl', () => new T.CylinderGeometry(9.2, 9.2, 1, 24, 1, true, -0.47, 0.94)), u.levelMat, 0, 6, 0, false);
      body.add(u.level);
      const bs = new T.Shape(); [[0.6, 4], [-2, -0.4], [0, -0.4], [-0.8, -4], [2.2, 0.8], [0.2, 0.8], [1.6, 4]].forEach(([x, y], i) => i ? bs.lineTo(x, y) : bs.moveTo(x, y));
      const bolt = mesh(gget('bolt', () => new T.ShapeGeometry(bs)), std('#FFD23F', { side: T.DoubleSide, emissive: '#FFB800', emissiveIntensity: 0.4 }), 9.25, 14, 0, false);
      bolt.rotation.y = Math.PI / 2; body.add(bolt);
      rig.arms = limbs(body, col, 9.4, 15, 1.8);
      rig.headY = 30;
      break;
    }
  }
  body.position.set(rig.bx, rig.by, rig.bz);
  return rig;
}

// うごき（気分・出力・天気にあわせて）
function animRig(rig, b, mood, t, dt, V, sunDir) {
  const u = rig.ud, body = rig.body, ph = (b.id || 1) * 1.37, out = (b.out || 0) / P[b.type].cap;
  let y = 0, rx = 0, rz = 0, sy = 1, x = 0;
  if (mood === 'happy') y = Math.abs(Math.sin(t * 5 + ph)) * 2.4;
  else if (mood === 'sleep') { rz = 0.13; sy = 1 + Math.sin(t * 1.6 + ph) * 0.035; }
  else if (mood === 'sad') { rx = 0.14; y = -0.6; }
  else if (mood === 'sweat') x = Math.sin(t * 30 + ph) * 0.45;
  else if (mood === 'ouch') rz = Math.sin(t * 8 + ph) * 0.14;
  else sy = 1 + Math.sin(t * 2.2 + ph) * 0.025;
  body.position.x = rig.bx + x; body.position.y = rig.by + y; body.rotation.x = rx; body.rotation.z = rz; body.scale.y = sy;
  if (rig.arms && rig.type !== 'geo') {
    let zl = -0.45 - Math.sin(t * 2.2 + ph) * 0.1, zr = 0.45 + Math.sin(t * 2.2 + ph) * 0.1;
    if (mood === 'happy') { zr = 2.5 + Math.sin(t * 11 + ph) * 0.45; zl = -0.8; }
    else if (mood === 'sweat') { const k = Math.abs(Math.sin(t * 12 + ph)); zl = -1 - k; zr = 1 + k; }
    else if (mood === 'sleep' || mood === 'sad') { zl = -0.15; zr = 0.15; }
    else if (mood === 'ouch') { zl = -2.7 + Math.sin(t * 14) * 0.2; zr = 2.7 - Math.sin(t * 14) * 0.2; }
    if (rig.type === 'battery' && V.soc > 0.97) { zl = -2.6; zr = 2.6; }      // 満タンでバンザイ
    if (rig.type === 'nuclear' && mood === 'happy') { zl = -1.9 + Math.sin(t * 4) * 0.2; zr = 1.9 - Math.sin(t * 4) * 0.2; }  // 力こぶ
    const k = Math.min(1, dt * 10);
    rig.arms.L.rotation.z += (zl - rig.arms.L.rotation.z) * k; rig.arms.R.rotation.z += (zr - rig.arms.R.rotation.z) * k;
  }
  switch (rig.type) {
    case 'solar': {
      const night = V.sun < 0.03; u.cap.visible = night; u.hat.visible = !night;
      if (!night && sunDir) { u.hat.rotation.y = Math.atan2(sunDir.x, sunDir.z); u.hp.rotation.x = clamp(1 - sunDir.y, 0.15, 1.1) * 0.85; }
      u.rays.rotation.z += dt * (night ? 0 : 0.25 + out * 1.6);
      break;
    }
    case 'wind':
      u.rotor.rotation.z -= dt * (b.cut ? 0.25 : 0.5 + out * 9);
      u.tails.rotation.x = -0.25 + Math.sin(t * (5 + (V.wind || 0) * 10) + ph) * (0.12 + (V.wind || 0) * 0.5);
      u.tails.rotation.y = Math.sin(t * 3 + ph) * 0.4 * (V.wind || 0);
      break;
    case 'thermal': {
      const awake = b.mode !== 'rest' && !b.off;
      u.flame.visible = awake && b.warm > 0.02;
      if (u.flame.visible) { const s = (0.35 + 0.65 * b.warm) * (0.7 + out * 0.6); u.flame.scale.set(s * (1 + Math.sin(t * 23 + ph) * 0.08), s * (1 + Math.sin(t * 17 + ph) * 0.16), s); }
      break;
    }
    case 'nuclear': u.orbit.visible = !b.off; if (!b.off) u.orbit.rotation.y += dt * 1.6; u.barrier.visible = !!b.off; break;
    case 'battery': {
      const s = clamp(V.soc || 0, 0.02, 1); u.level.scale.y = s * 8.6; u.level.position.y = 4.2 + s * 4.3;
      u.levelMat.emissiveIntensity = V.batFlow ? 1.2 + Math.sin(t * 8) * 0.5 : 0.6;
      u.levelMat.color.set(s < 0.1 ? '#FF8A7A' : '#C8FF6A');
      break;
    }
  }
}

// カード・図鑑用：3D のキャラを写真にとる
let iconKit = null;
function getIconKit() {
  if (iconKit) return iconKit;
  const r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(256, 256, false);
  r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.2; r.outputColorSpace = T.SRGBColorSpace;
  const sc = new T.Scene();
  sc.add(new T.HemisphereLight('#F4F8FF', '#C9B9A0', 1.7));
  const d = new T.DirectionalLight('#FFF6E8', 2.1); d.position.set(-40, 90, 100); sc.add(d);
  const cam = new T.PerspectiveCamera(26, 1, 1, 3000);
  return (iconKit = { r, sc, cam });
}
EC.charaIcon = function (type, mood = 'normal') {
  const key = type + ':' + mood;
  if (iconCache.has(key)) return iconCache.get(key);
  let url;
  try {
    const K = getIconKit(), rig = makeChara({ type, id: 1 }, true);
    animRig(rig, { id: 1, type, out: P[type].cap * 0.7, mode: mood === 'sleep' ? 'rest' : 'on', warm: 1 }, mood, 0.33, 1,
      { sun: mood === 'sleep' ? 0 : 1, wind: 0.5, soc: 0.65 }, new T.Vector3(0.25, 0.85, 0.5).normalize());
    rig.face.material = faceMat(type, mood);
    K.sc.add(rig.root); rig.root.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(rig.root), c = box.getCenter(new T.Vector3()), sz = box.getSize(new T.Vector3());
    const rad = Math.max(sz.x, sz.y * 1.05, sz.z) * 0.6;
    K.cam.position.copy(c).addScaledVector(new T.Vector3(-0.3, 0.25, 1).normalize(), rad / Math.sin(T.MathUtils.degToRad(13)));
    K.cam.lookAt(c);
    K.r.render(K.sc, K.cam); url = K.r.domElement.toDataURL('image/png');
    K.sc.remove(rig.root);
  } catch (e) { url = charaIcon2D(type, mood, 96); }
  iconCache.set(key, url);
  return url;
};
// 建設中：うすい建物と足場とクレーン
function makeSite(p) {
  const gr = new T.Group(), ghost = new T.MeshStandardMaterial({ color: P[p.type].color, transparent: true, opacity: 0.35, depthWrite: false });
  gr.add(pad());
  gr.add(mesh(roundedBox(24, 18, 22, 4), ghost, 0, 11, 0, false));
  const pole = std('#E0A030', { roughness: 0.6 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) gr.add(mesh(new T.BoxGeometry(1.2, 26, 1.2), pole, sx * 13, 13, sz * 12));
  for (const y of [9, 18, 26]) { gr.add(mesh(new T.BoxGeometry(27, 1, 1), pole, 0, y, 12)); gr.add(mesh(new T.BoxGeometry(27, 1, 1), pole, 0, y, -12)); }
  const crane = group(-10, 0, -10);
  crane.add(mesh(new T.BoxGeometry(2, 44, 2), toy('#F5B301'), 0, 22, 0));
  const arm = group(0, 44, 0); arm.add(mesh(new T.BoxGeometry(30, 2, 2), toy('#F5B301'), 10, 0, 0)); arm.add(mesh(new T.BoxGeometry(0.4, 12, 0.4), std('#333333'), 22, -6, 0));
  crane.add(arm); gr.add(crane); gr.userData.arm = arm;
  return gr;
}

// ほかのモード（日本マップ）からも使う3Dの道具
EC.W3 = { makeChara, animRig, faceMat, roundedBox, toy, std, mesh, group, cyl, glowTex, puffTex, makeHouse, makeTree, makeChappy, makeFactory };

/* ---------- ワールド ---------- */
EC.World = function (host, opts) {
  opts = opts || {};
  let renderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { host.insertAdjacentHTML('beforeend', '<div class="nogl">このパソコンでは 3D 表示ができません</div>'); return null; }
  const low = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
  renderer.setPixelRatio(Math.min(low ? 1.5 : 2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = T.SRGBColorSpace;
  const canvas = renderer.domElement; canvas.style.touchAction = 'none';
  host.prepend(canvas);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(32, 1, 5, 9000);
  const hemi = new T.HemisphereLight('#EAF4FF', '#B9A88E', 1.4);
  const sun = new T.DirectionalLight('#FFF4E2', 2.4);
  sun.castShadow = true; sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -360, right: 360, top: 360, bottom: -360, near: 50, far: 2200 });
  sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  scene.add(hemi, sun, sun.target);

  /* --- ボード --- */
  const BW = N * TS + 36;
  scene.add(mesh(roundedBox(BW, 14, BW, 26), toy('#FBFCFE', { clearcoat: 0.3 }), 0, -21, 0));
  scene.add(mesh(roundedBox(BW - 10, 16, BW - 10, 24), std('#34445A', { roughness: 0.7 }), 0, -35, 0));
  const shTex = canvasTex(512, 512, gc => { gc.clearRect(0, 0, 512, 512); gc.shadowColor = 'rgba(30,45,75,.45)'; gc.shadowBlur = 60; gc.shadowOffsetX = 2000; gc.fillStyle = '#000'; roundRectPath(gc, 96 - 2000, 96, 320, 320, 50); gc.fill(); });
  shTex.redraw();
  const shGeo = new T.PlaneGeometry(BW * 1.7, BW * 1.7); shGeo.rotateX(-Math.PI / 2);
  scene.add(mesh(shGeo, new T.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, toneMapped: false }), 30, -80, 40, false));

  /* --- 地形（インスタンスでまとめて描く） --- */
  const tileMeshes = [], decor = new Map();
  let seaMesh = null, seaCells = [];
  function buildTiles(S) {
    const lists = { g: [], r: [], '~': [], m: [] };
    S.tiles.forEach((row, r) => row.forEach((t, c) => lists[t.t === 'o' ? 'm' : t.t].push([r, c])));
    const spec = {
      g: { geo: roundedBox(TS - 1.6, 12, TS - 1.6, 4), mat: toy('#FFFFFF', { roughness: 0.55, clearcoat: 0.3 }), y: -6, col: (r, c) => ((r + c) % 2 ? '#9FDB7E' : '#93D371') },
      r: { geo: roundedBox(TS - 1.6, 9, TS - 1.6, 3), mat: toy('#FFFFFF', { roughness: 0.08, clearcoat: 1 }), y: -7.5, col: () => '#5BBDF0' },
      '~': { geo: roundedBox(TS - 1.6, 9, TS - 1.6, 3), mat: toy('#FFFFFF', { roughness: 0.08, clearcoat: 1 }), y: -9.5, col: (r, c) => ((r + c) % 2 ? '#47AEE6' : '#52B5EA') },
      m: { geo: roundedBox(TS - 1.6, 36, TS - 1.6, 6), mat: toy('#FFFFFF', { roughness: 0.6, clearcoat: 0.3 }), y: 6, col: (r, c) => S.tiles[r][c].t === 'o' ? '#8CCB8A' : ((r + c) % 2 ? '#7CC67D' : '#74BF77') }
    };
    const m4 = new T.Matrix4(), col = new T.Color();
    Object.entries(lists).forEach(([k, cells]) => {
      if (!cells.length) return;
      const sp = spec[k], im = new T.InstancedMesh(sp.geo, sp.mat, cells.length);
      cells.forEach(([r, c], i) => { im.setMatrixAt(i, m4.makeTranslation(X(c), sp.y, Z(r))); im.setColorAt(i, col.set(sp.col(r, c))); });
      im.castShadow = k === 'm'; im.receiveShadow = true; im.userData.cells = cells;
      scene.add(im); tileMeshes.push(im);
      if (k === '~') { seaMesh = im; seaCells = cells; }
    });
    // 山の頂上と温泉
    S.tiles.forEach((row, r) => row.forEach((t, c) => {
      if (t.t !== 'm' && t.t !== 'o') return;
      const d = group(X(c), TOP.m, Z(r)), k = rnd(r, c);
      if (t.t === 'm') {
        d.add(mesh(roundedBox(28, 14, 28, 6), toy('#68B86E'), 0, 7, 0));
        d.add(mesh(roundedBox(17, 12, 17, 5), toy('#5BA965'), 0, 19, 0));
        d.add(mesh(roundedBox(10, 6, 10, 3), toy('#FFFFFF'), 0, 27, 0));
        d.rotation.y = k * 1.5; d.scale.setScalar(0.85 + k * 0.3);
      } else {
        d.add(mesh(cyl(13, 13, 2, 28), toy('#8FE0F5', { roughness: 0.05, clearcoat: 1 }), 0, 1, 0));
        for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; d.add(mesh(new T.IcosahedronGeometry(3.4, 0), std('#B8B2A8', { flatShading: true }), Math.cos(a) * 14, 2, Math.sin(a) * 14)); }
        d.userData.onsen = true;
      }
      d.userData.tile = { r, c };
      scene.add(d); decor.set(r * N + c, d);
    }));
  }

  /* --- 建物・発電所 --- */
  const objRoot = new T.Group(); scene.add(objRoot);
  const objs = new Map(), pops = [], gone = [];
  function create(b, state, r, c, S) {
    let o;
    if (b.kind === 'tree') o = makeTree(b);
    else if (b.kind === 'house') o = makeHouse(b);
    else if (b.kind === 'factory') o = makeFactory(b);
    else if (b.kind === 'hall') o = makeHall(b);
    else if (state === 'build') o = makeSite(b);
    else { const rig = makeChara(b); o = rig.root; o.userData.rig = rig; }
    o.position.set(X(c), TOP[S.tiles[r][c].t], Z(r));
    o.userData.tile = { r, c }; o.userData.b = b; o.userData.state = state;
    objRoot.add(o);
    return o;
  }
  function dispose(o) { objRoot.remove(o); }
  function sync(S, animate) {
    const seen = new Set();
    S.tiles.forEach((row, r) => row.forEach((t, c) => {
      const b = t.b; const d = decor.get(r * N + c);
      if (d) d.visible = !b || d.userData.onsen;
      if (!b) return;
      const state = b.kind === 'plant' ? (b.left > 0 ? 'build' : 'live') : b.kind;
      seen.add(b.id);
      let o = objs.get(b.id);
      if (o && o.userData.state !== state) { gone.push({ o, t: 0 }); o = null; }
      if (!o) {
        o = create(b, state, r, c, S); objs.set(b.id, o);
        if (animate) { o.scale.setScalar(0.01); pops.push({ o, t: 0 }); burst(X(c), TOP[t.t] + 4, Z(r), 'dust'); }
      }
    }));
    objs.forEach((o, id) => { if (!seen.has(id)) { objs.delete(id); gone.push({ o, t: 0 }); } });
  }

  /* --- 雲・雨・風のすじ --- */
  const cloudMatW = toy('#FFFFFF', { roughness: 0.95, clearcoat: 0, transparent: true, opacity: 0.88 }), cloudMatD = toy('#A3ACBA', { roughness: 0.95, clearcoat: 0, transparent: true, opacity: 0.9 });
  const clouds = [];
  for (let i = 0; i < 12; i++) {
    const cg = new T.Group();
    const parts = [[0, 0, 0, 1], [0.8, 0.12, 0.2, 0.75], [-0.8, 0.08, -0.1, 0.72], [0.3, 0.4, -0.3, 0.7], [-0.35, 0.35, 0.35, 0.62], [0.1, -0.15, 0.6, 0.6]];
    const ms = parts.map(([x, y, z, s]) => { const m = mesh(new T.SphereGeometry(1, 14, 10), cloudMatW, x, y, z); m.scale.setScalar(s); m.receiveShadow = false; cg.add(m); return m; });
    cg.visible = false; cg.userData.ms = ms; scene.add(cg); clouds.push(cg);
  }
  const RAIN = 320, rain = new T.InstancedMesh(new T.BoxGeometry(0.6, 9, 0.6), new T.MeshBasicMaterial({ color: '#A9CBEA', transparent: true, opacity: 0.6, depthWrite: false }), RAIN);
  rain.frustumCulled = false; rain.visible = false; scene.add(rain);
  const drops = Array.from({ length: RAIN }, () => ({ x: (Math.random() - 0.5) * BW, y: Math.random() * 200, z: (Math.random() - 0.5) * BW }));
  const STREAK = 40, streak = new T.InstancedMesh(new T.BoxGeometry(18, 0.7, 0.7), new T.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.55, depthWrite: false }), STREAK);
  streak.frustumCulled = false; scene.add(streak);
  const streaks = Array.from({ length: STREAK }, (_, i) => ({ x: (Math.random() - 0.5) * BW, y: 30 + Math.random() * 70, z: (Math.random() - 0.5) * BW, k: i / STREAK }));

  /* --- つぶつぶ（けむり・ゆげ・土ぼこり・きらきら） --- */
  const PCOUNT = 240, parts = [];
  for (let i = 0; i < PCOUNT; i++) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0, depthWrite: false }));
    s.visible = false; scene.add(s); parts.push({ s, life: 0 });
  }
  let pIdx = 0;
  function emit(x, y, z, o) {
    const p = parts[pIdx = (pIdx + 1) % PCOUNT];
    p.s.visible = true; p.s.position.set(x, y, z); p.life = p.max = o.life || 1.5;
    p.v = new T.Vector3(o.vx || 0, o.vy || 10, o.vz || 0); p.size = o.size || 6; p.grow = o.grow || 8; p.alpha = o.alpha || 0.7; p.g = o.g || 0;
    p.s.material.color.set(o.color || '#FFFFFF'); p.s.material.blending = o.add ? T.AdditiveBlending : T.NormalBlending;
    p.s.material.map = o.map || (o.add ? glowTex : puffTex);
  }
  function burst(x, y, z, kind) {
    if (kind === 'dust') for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; emit(x, y, z, { vx: Math.cos(a) * 30, vz: Math.sin(a) * 30, vy: 6, life: 0.7, size: 7, grow: 10, color: '#EDE6DA', alpha: 0.85 }); }
    if (kind === 'spark') for (let i = 0; i < 16; i++) { const a = Math.random() * 7; emit(x, y, z, { vx: Math.cos(a) * 40, vz: Math.sin(a) * 40, vy: 40 + Math.random() * 30, g: -90, life: 0.9, size: 6, grow: -4, color: '#FFD23F', alpha: 1, add: true }); }
    if (kind === 'poof') for (let i = 0; i < 10; i++) { const a = Math.random() * 7; emit(x, y, z, { vx: Math.cos(a) * 18, vz: Math.sin(a) * 18, vy: 14, life: 0.9, size: 8, grow: 12, color: '#9AA3B2', alpha: 0.7 }); }
  }

  /* --- 停電マーク --- */
  const boltTex = canvasTex(64, 64, gc => { gc.clearRect(0, 0, 64, 64); gc.fillStyle = '#E8604C'; gc.beginPath(); gc.arc(32, 32, 28, 0, 7); gc.fill(); gc.fillStyle = '#FFFFFF'; gc.font = '900 40px sans-serif'; gc.textAlign = 'center'; gc.textBaseline = 'middle'; gc.fillText('⚡', 32, 35); });
  boltTex.redraw();
  const bolts = Array.from({ length: 60 }, () => { const s = new T.Sprite(new T.SpriteMaterial({ map: boltTex, transparent: true, depthWrite: false, depthTest: false })); s.scale.set(22, 22, 1); s.visible = false; s.renderOrder = 10; scene.add(s); return s; });

  /* --- 町の人の心配マーク（けむり・音・不安・温泉） --- */
  const WORRY = { thermal: '😷', wind: '🔊', nuclear: '😟' };
  const worries = Array.from({ length: 50 }, () => { const s = new T.Sprite(new T.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false, depthTest: false })); s.scale.set(12, 12, 1); s.visible = false; s.renderOrder = 9; scene.add(s); return s; });

  /* --- 選べるマスの光 --- */
  const hlGeo = new T.ShapeGeometry(rrShape(TS - 8, TS - 8, 7)); hlGeo.rotateX(-Math.PI / 2);
  const ringShape = rrShape(TS - 5, TS - 5, 8); ringShape.holes.push(rrShape(TS - 12, TS - 12, 5));
  const ringGeo = new T.ShapeGeometry(ringShape); ringGeo.rotateX(-Math.PI / 2);
  const hlMat = new T.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false });
  const ringMat = new T.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
  const hl = new T.InstancedMesh(hlGeo, hlMat, N * N); hl.count = 0; hl.renderOrder = 5; hl.frustumCulled = false; scene.add(hl);
  const hlRing = new T.InstancedMesh(ringGeo, ringMat, N * N); hlRing.count = 0; hlRing.renderOrder = 6; hlRing.frustumCulled = false; scene.add(hlRing);
  const hover = new T.Mesh(new T.RingGeometry(TS * 0.38, TS * 0.47, 4, 1, Math.PI / 4), new T.MeshBasicMaterial({ color: '#1E2A38', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
  hover.geometry.rotateX(-Math.PI / 2); hover.visible = false; hover.renderOrder = 6; scene.add(hover);
  let S0 = null;
  function topY(r, c) { return TOP[S0.tiles[r][c].t]; }
  function setHighlight(ok, warn) {
    const m4 = new T.Matrix4(), col = new T.Color(); let i = 0;
    const put = (r, c, fill, ring) => {
      m4.makeTranslation(X(c), topY(r, c) + 0.9, Z(r));
      hl.setMatrixAt(i, m4); hl.setColorAt(i, col.set(fill));
      hlRing.setMatrixAt(i, m4.makeTranslation(X(c), topY(r, c) + 1.1, Z(r))); hlRing.setColorAt(i, col.set(ring)); i++;
    };
    ok.forEach(([r, c]) => put(r, c, '#FFF3A0', '#FFC21A'));
    warn.forEach(([r, c]) => put(r, c, '#FFB3A8', '#E8604C'));
    hl.count = hlRing.count = i;
    [hl, hlRing].forEach(m => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  }
  function setHover(t) { hover.visible = !!t; if (t) hover.position.set(X(t.c), topY(t.r, t.c) + 1.2, Z(t.r)); }

  /* --- カメラ --- */
  const cam = { theta: -0.5, phi: 0.92, radius: 1200, target: new T.Vector3(0, 0, 14) };
  const cur = { theta: -0.2, phi: 0.6, radius: 2200 };
  const tmpCam = new T.PerspectiveCamera();
  function spherical(out, theta, phi, r) { return out.set(r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.cos(theta)).add(cam.target); }
  function fitRadius(theta, phi) {
    tmpCam.copy(camera);
    const pts = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [-28, 50]) pts.push(new T.Vector3(sx * BW / 2, y, sz * BW / 2));
    let lo = 200, hi = 6000;
    for (let i = 0; i < 24; i++) {
      const r = (lo + hi) / 2;
      spherical(tmpCam.position, theta, phi, r); tmpCam.lookAt(cam.target); tmpCam.updateMatrixWorld();
      const ok = pts.every(p => { const v = p.clone().project(tmpCam); return Math.abs(v.x) < 0.98 && v.y < 0.8 && v.y > -0.98 && v.z < 1; });
      if (ok) hi = r; else lo = r;
    }
    return hi;
  }
  let fitR = 1200;
  function resetView() { cam.theta = -0.5; cam.phi = 0.92; fitR = fitRadius(cam.theta, cam.phi); cam.radius = fitR; }
  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    fitR = fitRadius(cam.theta, cam.phi); cam.radius = clamp(cam.radius, fitR * 0.35, fitR * 1.3);
  }
  new ResizeObserver(() => { const keep = Math.abs(cam.radius - fitR) < 1; resize(); if (keep) cam.radius = fitR; }).observe(host);

  /* --- 入力（タップ・ドラッグで回す・ピンチ・ホイール） --- */
  const ptrs = new Map(); let downAt = null, moved = false;
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  function pick(px, py) {
    const rc = canvas.getBoundingClientRect();
    ndc.set((px - rc.left) / rc.width * 2 - 1, -((py - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([objRoot, ...tileMeshes, ...decor.values()], true);
    for (const h of hits) {
      if (h.object.isInstancedMesh && h.object.userData.cells) { const [r, c] = h.object.userData.cells[h.instanceId]; return { r, c }; }
      let o = h.object; while (o && !o.userData.tile) o = o.parent;
      if (o && o.userData.tile) return o.userData.tile;
    }
    return null;
  }
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) { downAt = { x: e.clientX, y: e.clientY }; moved = false; }
  });
  canvas.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse' && opts.onHover) opts.onHover(pick(e.clientX, e.clientY)); return; }
    if (ptrs.size === 1) {
      if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) moved = true;
      if (moved) { cam.theta -= (e.clientX - p.x) * 0.006; cam.phi = clamp(cam.phi - (e.clientY - p.y) * 0.004, 0.45, 1.2); }
    } else if (ptrs.size === 2) {
      moved = true;
      const o = [...ptrs.entries()].find(([id]) => id !== e.pointerId)[1];
      const d0 = Math.hypot(p.x - o.x, p.y - o.y), d1 = Math.hypot(e.clientX - o.x, e.clientY - o.y);
      if (d0 > 0 && d1 > 0) cam.radius = clamp(cam.radius * d0 / d1, fitR * 0.35, fitR * 1.3);
    }
    p.x = e.clientX; p.y = e.clientY;
  });
  const up = e => {
    if (ptrs.has(e.pointerId) && ptrs.size === 1 && !moved && opts.onTap) opts.onTap(pick(e.clientX, e.clientY), e);
    ptrs.delete(e.pointerId); if (!ptrs.size) downAt = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); });
  canvas.addEventListener('pointerleave', () => { if (opts.onHover) opts.onHover(null); });
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.radius = clamp(cam.radius * Math.exp(e.deltaY * 0.0012), fitR * 0.35, fitR * 1.3); }, { passive: false });
  canvas.addEventListener('dblclick', resetView);
  function zoom(f) { cam.radius = clamp(cam.radius * f, fitR * 0.35, fitR * 1.3); }

  /* --- 空と光（時刻・天気・地球の熱さ） --- */
  const C_DAY_H = new T.Color('#EAF4FF'), C_NIGHT_H = new T.Color('#6F84C8'), C_SUN = new T.Color('#FFF4E2'), C_DUSK = new T.Color('#FFB070'), C_MOON = new T.Color('#9FB4F0');
  const tmpC = new T.Color();
  let lastBg = '';
  function mixHex(a, b, k) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const ch = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; }
  function sky(hour, weather, earth) {
    const e = EC.sunAt(hour), day = clamp((e + 0.06) / 0.3, 0, 1);
    const dusk = clamp(1 - Math.min(Math.abs(hour - C.sun.set), Math.abs(hour - C.sun.rise)) / 1.3, 0, 1);
    const gray = weather === 'rain' ? 0.55 : weather === 'typhoon' ? 0.75 : weather === 'cloudy' ? 0.35 : 0;
    const smog = clamp((earth - 40) / 60, 0, 1) * 0.6;
    const a = (hour - C.sun.rise) / (C.sun.set - C.sun.rise) * Math.PI;
    if (day > 0) {
      sun.position.set(Math.cos(a) * 520, 80 + Math.max(0, Math.sin(a)) * 620, 260);
      sun.intensity = (0.25 + 2.15 * day) * (1 - gray * 0.55);
      sun.color.copy(C_SUN).lerp(C_DUSK, dusk * 0.8);
    } else {
      sun.position.set(-260, 620, -200); sun.intensity = 0.45; sun.color.copy(C_MOON);
    }
    hemi.intensity = (0.35 + 1.05 * day) * (1 - gray * 0.25);
    hemi.color.copy(C_NIGHT_H).lerp(C_DAY_H, day);
    let top = mixHex('#0D1633', '#BFDDF7', day), bot = mixHex('#273257', '#F4F8FC', day);
    if (dusk > 0) { top = mixHex(top.replace(/rgb\((\d+),(\d+),(\d+)\)/, (m, r, gg, b) => '#' + [r, gg, b].map(v => (+v).toString(16).padStart(2, '0')).join('')), '#F49A78', dusk * 0.6); }
    const toHex = s => '#' + s.match(/\d+/g).slice(0, 3).map(v => (+v).toString(16).padStart(2, '0')).join('');
    if (gray) { top = mixHex(toHex(top), '#8E9AAB', gray * day); bot = mixHex(toHex(bot), '#C9D1DB', gray * day); }
    if (smog) { top = mixHex(toHex(top), '#B89A78', smog * (0.4 + 0.6 * day)); bot = mixHex(toHex(bot), '#E2CDB2', smog * (0.4 + 0.6 * day)); }
    const bg = `linear-gradient(180deg,${top} 0%,${bot} 100%)`;
    if (bg !== lastBg) { host.style.background = bg; lastBg = bg; }
    return { day, gray, e };
  }

  /* --- 毎フレーム --- */
  let time = 0, shakeT = 0;
  const v3 = new T.Vector3();
  function update(dt, V) {
    time += dt;
    const S = V.S, sk = sky(V.hour, V.weather, V.earth), night = 1 - sk.day;
    // 海のゆれ
    if (seaMesh) {
      const m4 = new T.Matrix4();
      seaCells.forEach(([r, c], i) => { m4.makeTranslation(X(c), -9.5 + Math.sin(time * 1.6 + r * 0.7 + c * 0.9) * 0.9, Z(r)); seaMesh.setMatrixAt(i, m4); });
      seaMesh.instanceMatrix.needsUpdate = true;
    }
    // 出てくる・消える
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i]; p.t += dt; const k = Math.min(1, p.t / 0.55);
      const s = k < 1 ? 1 + Math.sin(k * Math.PI * 1.5) * (1 - k) * 0.5 : 1;
      p.o.scale.set(Math.max(0.01, k < 0.4 ? k / 0.4 : s), Math.max(0.01, k < 0.4 ? k / 0.4 * 1.2 : 2 - s), Math.max(0.01, k < 0.4 ? k / 0.4 : s));
      if (k >= 1) { p.o.scale.setScalar(1); pops.splice(i, 1); }
    }
    for (let i = gone.length - 1; i >= 0; i--) {
      const p = gone[i]; p.t += dt; const k = Math.min(1, p.t / 0.3);
      p.o.scale.setScalar(Math.max(0.01, 1 - k));
      if (k >= 1) { dispose(p.o); gone.splice(i, 1); }
    }
    // 建物
    const sunDir = sun.position.clone().normalize();
    let bi = 0;
    objs.forEach(o => {
      const ud = o.userData, b = ud.b;
      if (b.kind === 'house' || b.kind === 'factory') {
        const dark = V.dark.has(b.id), lit = !dark;
        const mat = dark ? winDark : night > 0.35 ? winLit : winDay;
        ud.wins.forEach(w => { if (w.material !== mat) w.material = mat; });
        ud.glow.material.opacity = lit ? night * 0.75 : 0;
        if (dark && bi < bolts.length) { const s = bolts[bi++]; s.visible = true; o.getWorldPosition(v3); s.position.set(v3.x, v3.y + (b.kind === 'factory' ? 50 : 40) + Math.sin(time * 6 + b.id) * 2, v3.z); }
        if (b.kind === 'factory' && lit && Math.random() < dt * 2.5) { o.localToWorld(v3.copy(ud.chimney)); emit(v3.x, v3.y, v3.z, { vy: 14, vx: 6, life: 2.2, size: 6, grow: 10, color: '#D8DEE6', alpha: 0.55 }); }
      } else if (b.kind === 'hall') {
        ud.chappy.update(time, dt, { mood: V.chappy === 'happy' ? 'happy' : 'normal', hurt: V.chappy === 'ouch', jump: V.chappy === 'jump', wave: V.chappy === 'wave' || V.chappy === 'jump' });
        ud.flag.rotation.y = Math.sin(time * 3) * 0.3;
      } else if (b.kind === 'plant' && ud.state === 'build') {
        ud.arm.rotation.y = Math.sin(time * 0.6 + b.id) * 1.2;
      } else if (b.kind === 'plant') {
        const mood = V.moods.get(b.id) || 'normal', rig = ud.rig, u = rig.ud, out = b.out / P[b.type].cap;
        if (rig.face.userData.mood !== mood) { rig.face.material = faceMat(b.type, mood); rig.face.userData.mood = mood; }
        animRig(rig, b, mood, time, dt, V, sunDir);
        const head = () => rig.body.localToWorld(v3.set(0, rig.headY, 0));
        if (mood === 'sleep' && Math.random() < dt * 0.9) { head(); emit(v3.x + 4, v3.y, v3.z, { map: zTex, vy: 9, vx: 5, life: 2.2, size: 5, grow: 4, alpha: 1 }); }
        if (mood === 'sweat' && Math.random() < dt * 2.2) { head(); emit(v3.x + 6, v3.y - 4, v3.z + 3, { map: dropTex, vy: 6, vx: 10, g: -50, life: 0.9, size: 4, grow: 0, alpha: 1 }); }
        if (mood === 'ouch' && Math.random() < dt * 4) { head(); const a = time * 6; emit(v3.x + Math.cos(a) * 9, v3.y + 2, v3.z + Math.sin(a) * 9, { map: starTex, vy: 2, life: 0.6, size: 5, grow: -1, alpha: 1 }); }
        if (u.chim && out > 0.02) u.chim.forEach(cp => { if (Math.random() < dt * (2 + out * 10)) { rig.body.localToWorld(v3.copy(cp)); emit(v3.x, v3.y, v3.z, { vy: 16 + out * 10, vx: 5, life: 2.4, size: 6 + out * 4, grow: 12, color: V.fuelHigh ? '#6E7480' : '#A6ACB6', alpha: 0.6 }); } });
        if (u.vent && Math.random() < dt * 4) { o.localToWorld(v3.copy(u.vent)); emit(v3.x, v3.y, v3.z, { vy: 18, life: 1.8, size: 6, grow: 10, color: '#FFFFFF', alpha: 0.7 }); }
        if (u.water && Math.random() < dt * 3) { o.localToWorld(v3.copy(u.water)); emit(v3.x + (Math.random() - 0.5) * 18, v3.y, v3.z + (Math.random() - 0.5) * 18, { vy: 10, life: 1.5, size: 4, grow: 7, color: '#FFFFFF', alpha: 0.6 }); }
        if (u.fallTex) u.fallTex.offset.y -= dt * 1.5;
        if (b.type === 'battery' && V.charging && Math.random() < dt * 5) { head(); emit(v3.x + (Math.random() - 0.5) * 16, v3.y + 8, v3.z, { vy: -16, life: 0.8, size: 3, grow: 0, color: '#9CFF6A', alpha: 1, add: true }); }
        if (u.barrels) {
          const want = Math.min(8, Math.floor((S.year - (b.built || S.year)) / 3));
          while (u.nBarrels < want) { const i = u.nBarrels++; const bar = group(-14 + (i % 4) * 5, 0, 15 + Math.floor(i / 4) * 5); bar.add(mesh(cyl(2, 2, 5, 10), toy('#F5D33F'), 0, 2.5, 0), mesh(cyl(2.1, 2.1, 1, 10), std('#333333'), 0, 2.5, 0)); u.barrels.add(bar); }
        }
      }
    });
    for (let i = bi; i < bolts.length; i++) bolts[i].visible = false;
    let wi = 0;
    if (V.worried) V.worried.forEach((type, id) => {
      const o = objs.get(id); if (!o || wi >= worries.length) return;
      const s = worries[wi++]; s.material.map = emojiOf(WORRY[type] || '😟'); s.visible = true;
      o.getWorldPosition(v3); s.position.set(v3.x + 8, v3.y + 34 + Math.sin(time * 3 + id) * 1.5, v3.z);
    });
    if (V.onsenAngry) V.onsenAngry.forEach(tid => {
      const d = decor.get(tid); if (!d || wi >= worries.length) return;
      const s = worries[wi++]; s.material.map = emojiOf('😠'); s.visible = true;
      s.position.set(d.position.x, d.position.y + 22 + Math.sin(time * 3) * 1.5, d.position.z);
    });
    for (let i = wi; i < worries.length; i++) worries[i].visible = false;
    // 温泉のゆげ
    decor.forEach(d => { if (d.userData.onsen && Math.random() < dt * 3) emit(d.position.x + (Math.random() - 0.5) * 14, d.position.y + 3, d.position.z + (Math.random() - 0.5) * 14, { vy: 12, life: 1.6, size: 5, grow: 8, color: '#FFFFFF', alpha: 0.6 }); });
    // 雲（影が sim の位置に落ちるように、太陽の方へずらして置く）
    const sd = v3.copy(sun.position).normalize();
    (S.clouds || []).forEach((cl, i) => {
      const cg = clouds[i]; if (!cg) return;
      cg.visible = true;
      const y = 170 + (i % 4) * 12, off = sk.day > 0 ? clamp(y / Math.max(0.2, sd.y), 0, 400) : 0;
      cg.position.set(X(cl.x) + clamp(sd.x * off, -160, 160), y, Z(cl.z) + clamp(sd.z * off, -160, 160));
      const s = cl.r * TS * 0.42; cg.scale.set(s, s * 0.45, s * 0.75);
      const mat = cl.dark ? cloudMatD : cloudMatW;
      cg.userData.ms.forEach(m => { if (m.material !== mat) m.material = mat; });
    });
    for (let i = (S.clouds || []).length; i < clouds.length; i++) clouds[i].visible = false;
    // 雨
    const raining = V.weather === 'rain' || V.weather === 'typhoon';
    rain.visible = raining;
    if (raining) {
      const m4 = new T.Matrix4(), q = new T.Quaternion().setFromEuler(new T.Euler(0, 0, V.weather === 'typhoon' ? 0.4 : 0.08));
      const sc = new T.Vector3(1, 1, 1), pv = new T.Vector3();
      drops.forEach((d, i) => { d.y -= dt * 260; d.x += dt * (V.weather === 'typhoon' ? 90 : 15); if (d.y < -5) { d.y = 160 + Math.random() * 60; d.x = (Math.random() - 0.5) * BW; d.z = (Math.random() - 0.5) * BW; } if (d.x > BW / 2) d.x -= BW; m4.compose(pv.set(d.x, d.y, d.z), q, sc); rain.setMatrixAt(i, m4); });
      rain.instanceMatrix.needsUpdate = true;
    }
    // 風のすじ
    const w = V.wind || 0, show = Math.round(clamp((w - 0.15) / 0.7, 0, 1) * STREAK);
    streak.count = show;
    if (show) {
      const m4 = new T.Matrix4();
      streaks.forEach((s, i) => { s.x += dt * (80 + w * 260); if (s.x > BW / 2 + 40) { s.x = -BW / 2 - 40; s.z = (Math.random() - 0.5) * BW; s.y = 30 + Math.random() * 70; } if (i < show) streak.setMatrixAt(i, m4.makeTranslation(s.x, s.y + Math.sin(time * 3 + i) * 3, s.z)); });
      streak.instanceMatrix.needsUpdate = true;
    }
    // つぶつぶ
    parts.forEach(p => {
      if (p.life <= 0) return;
      p.life -= dt; if (p.life <= 0) { p.s.visible = false; return; }
      p.v.y += p.g * dt; p.s.position.addScaledVector(p.v, dt);
      const k = 1 - p.life / p.max; const sz = Math.max(0.5, p.size + p.grow * k);
      p.s.scale.set(sz, sz, 1); p.s.material.opacity = p.alpha * (1 - k);
    });
    // 光るマス
    hlMat.opacity = 0.32 + Math.sin(time * 5) * 0.14; ringMat.opacity = 0.75 + Math.sin(time * 5) * 0.25;
    // カメラ
    const k = 1 - Math.exp(-dt * 6);
    const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
    cur.theta += wrap(cam.theta - cur.theta) * k; cur.phi += (cam.phi - cur.phi) * k; cur.radius += (cam.radius - cur.radius) * k;
    spherical(camera.position, cur.theta, cur.phi, cur.radius);
    if (shakeT > 0) { shakeT -= dt; camera.position.x += (Math.random() - 0.5) * shakeT * 14; camera.position.y += (Math.random() - 0.5) * shakeT * 14; }
    camera.lookAt(cam.target);
    renderer.render(scene, camera);
  }

  // 3D の位置 → 画面の位置（CSS px）
  const pv = new T.Vector3();
  function screenOf(r, c, dy) {
    pv.set(X(c), (S0 ? topY(r, c) : 0) + (dy || 0), Z(r)).project(camera);
    return { x: (pv.x + 1) / 2 * canvas.clientWidth, y: (1 - pv.y) / 2 * canvas.clientHeight, ok: pv.z < 1 };
  }

  return {
    init(S) { S0 = S; buildTiles(S); sync(S, false); resize(); resetView(); },
    reset(S) { objs.forEach(o => dispose(o)); objs.clear(); pops.length = 0; gone.forEach(p => dispose(p.o)); gone.length = 0; S0 = S; sync(S, false); },
    spin(dt) { cam.theta += dt * 0.06; },
    sync(S, animate) { S0 = S; sync(S, animate); },
    update, setHighlight, setHover, screenOf, zoom, resetView,
    burst(r, c, kind, dy) { burst(X(c), topY(r, c) + (dy || 6), Z(r), kind); },
    shake(a) { shakeT = Math.max(shakeT, a || 0.4); },
    hearts() { objs.forEach(o => { if (o.userData.rig) { o.userData.rig.body.localToWorld(v3.set(0, o.userData.rig.headY, 0)); for (let i = 0; i < 3; i++) emit(v3.x + (Math.random() - 0.5) * 10, v3.y, v3.z, { map: heartTex, vy: 14 + Math.random() * 8, vx: (Math.random() - 0.5) * 8, life: 1.6, size: 6, grow: 2, alpha: 1 }); } }); },
    debug: () => ({ hl: hl.count, hlVisible: hl.visible, hlColor: !!hl.instanceColor, objs: objs.size }),
    canvas
  };
};
})(window);
