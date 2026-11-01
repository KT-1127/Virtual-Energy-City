/* エネルギーシティ ― アイソメトリック描画（キャラクター・天気・夜の明かり） */
(function () {
const EC = window.EC;
const R = (EC.R = {});
const TW = 64, TH = 32, N = 12, HALF = (N - 1) * TH / 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let cv, cx, W = 0, H = 0, dpr = 1;
const cam = (R.cam = { z: 1, x: 0, y: 0 });
const particles = [];

R.init = function (canvas) { cv = canvas; cx = cv.getContext('2d'); R.resize(); R.fit(); };
R.resize = function () {
  const r = cv.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
};
R.fit = function () {
  cam.z = clamp(Math.min(W / (N * TW + 16), H / (N * TH + 120)), 0.3, 2.5);
  if (W < H) cam.z = clamp(W / (N * TW * 0.78), 0.3, 2.5); // 縦長スマホは横を少しはみ出させて大きく
  cam.x = 0; cam.y = 24 * cam.z;
};
R.zoomAt = function (f, mx, my) {
  const z = clamp(cam.z * f, 0.3, 3);
  const k = z / cam.z;
  cam.x = (mx - W / 2) - ((mx - W / 2) - cam.x) * k;
  cam.y = (my - H / 2) - ((my - H / 2) - cam.y) * k;
  cam.z = z;
};
R.pan = function (dx, dy) { cam.x += dx; cam.y += dy; };

const wpos = (r, c) => ({ x: (c - r) * TW / 2, y: (c + r) * TH / 2 - HALF });
const toScreen = (x, y) => ({ x: W / 2 + cam.x + x * cam.z, y: H / 2 + cam.y + y * cam.z });
R.tileScreen = (r, c) => { const p = wpos(r, c); return toScreen(p.x, p.y); };
R.hit = function (mx, my) {
  const wx = (mx - W / 2 - cam.x) / cam.z, wy = (my - H / 2 - cam.y) / cam.z + HALF;
  const u = wx / (TW / 2), v = wy / (TH / 2);
  const c = Math.round((u + v) / 2), r = Math.round((v - u) / 2);
  return r >= 0 && c >= 0 && r < N && c < N ? { r, c } : null;
};

/* ---------- 色ヘルパー ---------- */
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
R.shade = shade;

/* ---------- 基本図形 ---------- */
function diamond(x, y, hw, hh) { cx.beginPath(); cx.moveTo(x, y - hh); cx.lineTo(x + hw, y); cx.lineTo(x, y + hh); cx.lineTo(x - hw, y); cx.closePath(); }
// 地面中心 (x,y)、足元の大きさ f（マス比）、高さ h の箱
function box(x, y, f, h, col, topCol) {
  const hw = TW / 2 * f, hh = TH / 2 * f;
  cx.fillStyle = shade(col, -0.12);
  cx.beginPath(); cx.moveTo(x - hw, y); cx.lineTo(x, y + hh); cx.lineTo(x, y + hh - h); cx.lineTo(x - hw, y - h); cx.closePath(); cx.fill();
  cx.fillStyle = shade(col, -0.25);
  cx.beginPath(); cx.moveTo(x + hw, y); cx.lineTo(x, y + hh); cx.lineTo(x, y + hh - h); cx.lineTo(x + hw, y - h); cx.closePath(); cx.fill();
  cx.fillStyle = topCol || shade(col, 0.15); diamond(x, y - h, hw, hh); cx.fill();
  return { hw, hh, top: y - h };
}
// キャラクターの顔（箱の手前の角に描く）
function face(x, y, s, expr) {
  cx.save(); cx.translate(x, y);
  cx.fillStyle = '#2A2F3A'; cx.strokeStyle = '#2A2F3A'; cx.lineWidth = Math.max(1, s * 0.22); cx.lineCap = 'round';
  const ex = s * 0.85;
  if (expr === 'sleep') {
    cx.beginPath(); cx.moveTo(-ex - s * .4, 0); cx.lineTo(-ex + s * .4, 0); cx.moveTo(ex - s * .4, 0); cx.lineTo(ex + s * .4, 0); cx.stroke();
  } else if (expr === 'happy') {
    cx.beginPath(); cx.arc(-ex, s * .2, s * .45, Math.PI * 1.1, Math.PI * 1.9); cx.stroke();
    cx.beginPath(); cx.arc(ex, s * .2, s * .45, Math.PI * 1.1, Math.PI * 1.9); cx.stroke();
  } else if (expr === 'dizzy') {
    [-ex, ex].forEach(e => { cx.beginPath(); cx.moveTo(e - s * .35, -s * .35); cx.lineTo(e + s * .35, s * .35); cx.moveTo(e + s * .35, -s * .35); cx.lineTo(e - s * .35, s * .35); cx.stroke(); });
  } else {
    cx.beginPath(); cx.arc(-ex, 0, s * .32, 0, 7); cx.arc(ex, 0, s * .32, 0, 7); cx.fill();
  }
  // 口
  cx.beginPath();
  if (expr === 'happy') { cx.arc(0, s * .55, s * .45, 0.15 * Math.PI, 0.85 * Math.PI); cx.stroke(); }
  else if (expr === 'sad' || expr === 'dizzy') { cx.arc(0, s * 1.15, s * .4, 1.2 * Math.PI, 1.8 * Math.PI); cx.stroke(); }
  else if (expr === 'sweat') { cx.arc(0, s * .75, s * .25, 0, 7); cx.fill(); }
  else if (expr !== 'sleep') { cx.moveTo(-s * .3, s * .7); cx.lineTo(s * .3, s * .7); cx.stroke(); }
  // ほっぺ
  if (expr === 'happy' || expr === 'normal') { cx.fillStyle = 'rgba(255,120,120,.55)'; cx.beginPath(); cx.arc(-ex - s * .5, s * .55, s * .28, 0, 7); cx.arc(ex + s * .5, s * .55, s * .28, 0, 7); cx.fill(); }
  if (expr === 'sweat') { cx.fillStyle = '#7FD3FF'; cx.beginPath(); cx.moveTo(ex + s * 1.3, -s * .9); cx.quadraticCurveTo(ex + s * 1.8, -s * .1, ex + s * 1.3, -s * .05); cx.quadraticCurveTo(ex + s * .8, -s * .1, ex + s * 1.3, -s * .9); cx.fill(); }
  cx.restore();
}

/* ---------- 地形 ---------- */
const TERR = { g: '#A9DF8C', m: '#7CC67D', o: '#7CC67D', r: '#5DB8F2', '~': '#62C8F2' };
function elev(t) { return t === 'm' || t === 'o' ? 10 : t === '~' ? -4 : 0; }
function drawTile(t, r, c, sc) {
  const p = wpos(r, c), e = elev(t.t), x = p.x, y = p.y - e, winter = sc.season === 'winter';
  let col = TERR[t.t];
  if (winter && (t.t === 'g' || t.t === 'm' || t.t === 'o')) col = t.t === 'g' ? '#DDEFE6' : '#CFE6DA';
  const depth = 10 + e;
  cx.fillStyle = shade(col, -0.18);
  cx.beginPath(); cx.moveTo(x - TW / 2, y); cx.lineTo(x, y + TH / 2); cx.lineTo(x, y + TH / 2 + depth); cx.lineTo(x - TW / 2, y + depth); cx.closePath(); cx.fill();
  cx.fillStyle = shade(col, -0.3);
  cx.beginPath(); cx.moveTo(x + TW / 2, y); cx.lineTo(x, y + TH / 2); cx.lineTo(x, y + TH / 2 + depth); cx.lineTo(x + TW / 2, y + depth); cx.closePath(); cx.fill();
  cx.fillStyle = col; diamond(x, y, TW / 2, TH / 2); cx.fill();
  cx.strokeStyle = 'rgba(255,255,255,.35)'; cx.lineWidth = 1; cx.stroke();
  if (t.t === '~' || t.t === 'r') {
    const k = (sc.time / 1600 + (r * 7 + c * 3) * 0.13) % 1;
    cx.strokeStyle = 'rgba(255,255,255,.6)'; cx.lineWidth = 1.5;
    cx.beginPath(); cx.moveTo(x - 10 + k * 8, y - 2 + k * 4); cx.lineTo(x + k * 8, y + k * 4 - 2); cx.stroke();
  }
  if ((t.t === 'm' || t.t === 'o') && !t.b) {
    const mc = winter ? '#B9D8CB' : '#5FAE66';
    cx.fillStyle = shade(mc, -0.1);
    cx.beginPath(); cx.moveTo(x - 20, y + 2); cx.lineTo(x - 2, y - 26); cx.lineTo(x + 2, y + 9); cx.closePath(); cx.fill();
    cx.fillStyle = shade(mc, -0.28);
    cx.beginPath(); cx.moveTo(x + 20, y + 2); cx.lineTo(x - 2, y - 26); cx.lineTo(x + 2, y + 9); cx.closePath(); cx.fill();
    cx.fillStyle = '#fff'; cx.beginPath(); cx.moveTo(x - 2, y - 26); cx.lineTo(x - 7, y - 18); cx.lineTo(x + 3, y - 18); cx.closePath(); cx.fill();
  }
  if (t.t === 'o') {
    cx.fillStyle = '#9EE3F5'; cx.beginPath(); cx.ellipse(x + 12, y + 5, 9, 4.5, 0, 0, 7); cx.fill();
    steam(x + 12, y + 2, 'rgba(255,255,255,.8)', 3, sc.time);
  }
}

function steam(x, y, col, n, time) {
  for (let i = 0; i < n; i++) {
    const k = ((time / 1500) + i / n) % 1;
    cx.fillStyle = col.replace(/[\d.]+\)$/, ((1 - k) * 0.8).toFixed(2) + ')');
    cx.beginPath(); cx.arc(x + Math.sin(k * 5 + i) * 3, y - k * 34, 3 + k * 6, 0, 7); cx.fill();
  }
}

/* ---------- 建物 ---------- */
function drawObj(t, r, c, sc) {
  const b = t.b; if (!b) return;
  const p = wpos(r, c), x = p.x, y = p.y - elev(t.t), id = r * N + c;
  const dark = sc.dark.has(id);
  if (b.kind === 'house') {
    const col = dark ? '#B8BCC6' : '#FFFFFF';
    const bx = box(x, y, 0.5, 13, col);
    cx.fillStyle = dark ? '#8A8F9A' : EC.HOUSE_COLORS[b.col];
    cx.beginPath(); cx.moveTo(x - bx.hw - 2, bx.top); cx.lineTo(x, bx.top - 9); cx.lineTo(x + bx.hw + 2, bx.top); cx.lineTo(x, bx.top + bx.hh + 2); cx.closePath(); cx.fill();
    cx.fillStyle = shade(dark ? '#8A8F9A' : EC.HOUSE_COLORS[b.col], -0.2);
    cx.beginPath(); cx.moveTo(x, bx.top - 9); cx.lineTo(x + bx.hw + 2, bx.top); cx.lineTo(x, bx.top + bx.hh + 2); cx.closePath(); cx.fill();
  } else if (b.kind === 'factory') {
    const col = dark ? '#A4A9B4' : '#E3E8F0';
    box(x - 3, y + 1, 0.72, 16, col, dark ? '#9298A3' : '#C9D3E2');
    box(x + 10, y - 6, 0.16, 32, dark ? '#8A8F9A' : '#9AA6B8');
    cx.fillStyle = dark ? '#7a7f8a' : '#2B7DE9';
    cx.fillRect(x - 20, y - 6, 14, 3);
    if (!dark) steam(x + 10, y - 40, 'rgba(220,226,235,.8)', 2, sc.time);
  } else if (b.kind === 'plant') drawPlant(b, x, y, sc, r, c);
}

function drawPlant(b, x, y, sc, r, c) {
  const P = EC.PLANTS[b.type], col = P.c, ps = sc.plant[b.type] || {}, t = sc.time;
  if (b.left > 0) { // 建設中
    cx.globalAlpha = 0.5; box(x, y, 0.6, 18, col); cx.globalAlpha = 1;
    cx.strokeStyle = '#8A6A3A'; cx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) { cx.beginPath(); cx.moveTo(x + i * 12, y + 6); cx.lineTo(x + i * 12, y - 26); cx.stroke(); }
    cx.beginPath(); cx.moveTo(x - 14, y - 10); cx.lineTo(x + 14, y - 10); cx.moveTo(x - 14, y - 22); cx.lineTo(x + 14, y - 22); cx.stroke();
    sc.labels.push({ r, c, text: `あと${b.left * EC.BALANCE.yearsPerTurn}年`, col });
    return;
  }
  const expr = b.old && b.retireSoon ? 'sad' : (ps.expr || 'normal');
  const bob = expr === 'happy' ? Math.sin(t / 200 + r + c) * 1.5 : 0;
  switch (b.type) {
    case 'solar': {
      cx.fillStyle = '#26407A'; diamond(x - 4, y - 4, TW * 0.36, TH * 0.36); cx.fill();
      cx.strokeStyle = 'rgba(160,200,255,.7)'; cx.lineWidth = 1;
      for (let i = -1; i <= 1; i++) { cx.beginPath(); cx.moveTo(x - 4 + i * 11 - 6, y - 4 + i * 5.5 - 3); cx.lineTo(x - 4 + i * 11 + 6, y - 4 + i * 5.5 + 3); cx.stroke(); }
      const bx = box(x + 8, y + 6 + bob, 0.3, 15, col);
      face(x + 8, bx.top + 12, 2.2, expr);
      break;
    }
    case 'wind': {
      const bx = box(x, y + bob, 0.32, 12, col);
      face(x, bx.top + 10, 2.2, expr);
      cx.strokeStyle = '#E8F6FA'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(x, bx.top); cx.lineTo(x, bx.top - 40); cx.stroke();
      const ang = (ps.spin || 0), hx = x, hy = bx.top - 40;
      cx.strokeStyle = '#FFFFFF'; cx.lineWidth = 3.5; cx.lineCap = 'round';
      for (let i = 0; i < 3; i++) { const a = ang + i * 2.094; cx.beginPath(); cx.moveTo(hx, hy); cx.lineTo(hx + Math.cos(a) * 20, hy + Math.sin(a) * 20 * 0.8); cx.stroke(); }
      cx.fillStyle = col; cx.beginPath(); cx.arc(hx, hy, 3.5, 0, 7); cx.fill();
      break;
    }
    case 'thermal': {
      box(x + 10, y - 8, 0.2, 40, '#C9CED8');
      cx.fillStyle = col; cx.fillRect(x + 6.5, y - 46, 7, 5);
      const bx = box(x - 2, y + 2 + bob, 0.6, 18, col);
      face(x - 2, bx.top + 14, 2.8, expr);
      if (ps.on) steam(x + 10, y - 50, ps.boost ? 'rgba(90,90,100,.85)' : 'rgba(150,150,160,.8)', ps.boost ? 5 : 3, t);
      break;
    }
    case 'hydro': {
      const bx = box(x, y + bob, 0.66, 16, col);
      cx.strokeStyle = 'rgba(255,255,255,.75)'; cx.lineWidth = 2;
      const k = (t / 300) % 6;
      for (let i = 0; i < 3; i++) { cx.beginPath(); cx.moveTo(x + 6 + i * 6, y - 8 + i * 3 + k); cx.lineTo(x + 6 + i * 6, y + 2 + i * 3 + k); cx.stroke(); }
      face(x, bx.top + 12, 2.6, expr);
      break;
    }
    case 'geo': {
      const bx = box(x, y + bob, 0.52, 16, col);
      face(x, bx.top + 12, 2.5, expr);
      steam(x - 8, bx.top - 2, 'rgba(255,255,255,.85)', 4, t);
      break;
    }
    case 'nuclear': {
      const bx = box(x, y + bob, 0.74, 18, col);
      cx.fillStyle = '#FFF4E8'; cx.beginPath(); cx.ellipse(x, bx.top, 14, 7, 0, Math.PI, 0); cx.arc(x, bx.top, 14, 0, Math.PI, true); cx.fill();
      cx.fillStyle = shade('#FFF4E8', -0.08); cx.beginPath(); cx.ellipse(x, bx.top, 14, 7, 0, 0, Math.PI); cx.fill();
      face(x, bx.top + 14, 3, expr);
      if (ps.on) steam(x - 12, bx.top - 6, 'rgba(255,255,255,.8)', 2, t);
      break;
    }
    case 'battery': {
      const bx = box(x, y + bob, 0.44, 20, col);
      box(x - 5, bx.top + 1, 0.1, 4, '#2A2F3A'); box(x + 5, bx.top + 1, 0.1, 4, '#2A2F3A');
      const soc = ps.soc == null ? 0.3 : ps.soc;
      cx.fillStyle = 'rgba(0,0,0,.25)'; cx.fillRect(x + 4, y - 10, 5, 14);
      cx.fillStyle = soc < 0.1 ? '#EB4B43' : '#C8FF6A'; cx.fillRect(x + 4, y + 4 - 14 * soc, 5, 14 * soc);
      face(x - 5, bx.top + 14, 2.2, expr);
      if (ps.hold) sc.labels.push({ r, c, text: '🔒', col });
      break;
    }
  }
}

/* ---------- 夜の明かり ---------- */
function drawLights(t, r, c, sc) {
  const b = t.b; if (!b) return;
  const id = r * N + c; if (sc.dark.has(id)) return;
  const p = wpos(r, c), x = p.x, y = p.y - elev(t.t);
  cx.fillStyle = 'rgba(255,214,102,' + (0.95 * sc.night) + ')';
  if (b.kind === 'house') { cx.fillRect(x - 10, y - 6, 4, 4); cx.fillRect(x + 5, y - 6, 4, 4); }
  if (b.kind === 'factory') { for (let i = 0; i < 3; i++) cx.fillRect(x - 18 + i * 6, y - 4 + i * 3, 3, 3); }
  if (b.kind === 'house' || b.kind === 'factory') {
    const g = cx.createRadialGradient(x, y - 4, 2, x, y - 4, 26);
    g.addColorStop(0, 'rgba(255,200,90,' + (0.35 * sc.night) + ')'); g.addColorStop(1, 'rgba(255,200,90,0)');
    cx.fillStyle = g; cx.fillRect(x - 26, y - 30, 52, 52);
  }
}

/* ---------- 天気 ---------- */
function drawWeather(sc) {
  const w = sc.weather; if (!w) return;
  if (w === 'cloud' || w === 'storm' || w === 'rain') {
    cx.fillStyle = w === 'storm' ? 'rgba(70,80,100,.18)' : 'rgba(120,130,150,.12)'; cx.fillRect(0, 0, W, H);
    for (let i = 0; i < 5; i++) {
      const x = ((sc.time / 60 + i * 260) % (W + 300)) - 150, y = 40 + (i * 53) % (H * 0.4);
      cx.fillStyle = 'rgba(255,255,255,.75)';
      cx.beginPath(); cx.arc(x, y, 26, 0, 7); cx.arc(x + 30, y - 10, 30, 0, 7); cx.arc(x + 62, y, 24, 0, 7); cx.fill();
    }
  }
  if (w === 'rain' || w === 'storm' || w === 'snow') {
    while (particles.length < (w === 'snow' ? 90 : 120)) particles.push({ x: Math.random() * W, y: Math.random() * H, v: 0.5 + Math.random() });
    cx.strokeStyle = 'rgba(120,160,220,.6)'; cx.fillStyle = 'rgba(255,255,255,.9)'; cx.lineWidth = 1.2;
    particles.forEach(p => {
      if (w === 'snow') { p.y += p.v * 1.2; p.x += Math.sin(sc.time / 600 + p.v * 9) * 0.6; cx.beginPath(); cx.arc(p.x, p.y, 2 + p.v, 0, 7); cx.fill(); }
      else { p.y += p.v * 9; p.x -= w === 'storm' ? p.v * 5 : 1; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x + (w === 'storm' ? 5 : 1.5), p.y - 10); cx.stroke(); }
      if (p.y > H) { p.y = -10; p.x = Math.random() * W; } if (p.x < -10) p.x = W;
    });
  } else particles.length = 0;
  if (w === 'heat') { cx.fillStyle = 'rgba(255,120,60,' + (0.08 * (1 - sc.night)) + ')'; cx.fillRect(0, 0, W, H); }
}

/* ---------- 吹き出し（画面座標） ---------- */
function bubble(sx, sy, text, col, alpha) {
  cx.save(); cx.globalAlpha = alpha;
  cx.font = '700 13px "M PLUS Rounded 1c", sans-serif';
  const w = Math.min(220, cx.measureText(text).width + 20), h = 28;
  let bx = clamp(sx - w / 2, 6, W - w - 6), by = Math.max(6, sy - h - 12);
  cx.fillStyle = '#fff'; cx.strokeStyle = col; cx.lineWidth = 2.5;
  cx.beginPath(); cx.roundRect(bx, by, w, h, 14); cx.fill(); cx.stroke();
  cx.beginPath(); cx.moveTo(clamp(sx, bx + 14, bx + w - 14) - 6, by + h - 1); cx.lineTo(sx, sy - 2); cx.lineTo(clamp(sx, bx + 14, bx + w - 14) + 6, by + h - 1); cx.closePath(); cx.fill();
  cx.fillStyle = '#2A2F3A'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText(text, bx + w / 2, by + h / 2 + 1, w - 14);
  cx.restore();
}
function chip(sx, sy, text, col) {
  cx.save(); cx.font = '800 11px "M PLUS Rounded 1c", sans-serif';
  const w = cx.measureText(text).width + 14;
  cx.fillStyle = col; cx.beginPath(); cx.roundRect(sx - w / 2, sy - 9, w, 18, 9); cx.fill();
  cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(text, sx, sy + 1);
  cx.restore();
}

/* ---------- 浮かぶ文字（-18 など） ---------- */
const floats = [];
R.float = function (r, c, text, col) { floats.push({ r, c, text, col, t0: performance.now() }); };

/* ---------- メイン描画 ---------- */
// sc: { tiles, time, night, dark:Set, hl:Set, hlBad:Set, sel:{r,c}, plant:{kind:{expr,spin,on,soc,hold,boost}}, bubbles:[{r,c,text,col,a}], weather, season }
R.draw = function (sc) {
  if (!cx) return;
  sc.labels = [];
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky = cx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, sc.season === 'winter' ? '#EAF4FB' : '#F4FBFF'); sky.addColorStop(1, '#FFFFFF');
  cx.fillStyle = sky; cx.fillRect(0, 0, W, H);
  cx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (W / 2 + cam.x), dpr * (H / 2 + cam.y));
  const order = [];
  for (let s = 0; s < N * 2 - 1; s++) for (let r = 0; r < N; r++) { const c = s - r; if (c >= 0 && c < N) order.push([r, c]); }
  order.forEach(([r, c]) => drawTile(sc.tiles[r][c], r, c, sc));
  // ハイライト（建てられるマス）
  const pulse = 0.35 + 0.25 * Math.sin(sc.time / 220);
  order.forEach(([r, c]) => {
    const id = r * N + c, t = sc.tiles[r][c], p = wpos(r, c), y = p.y - elev(t.t);
    if (sc.hl.has(id)) { cx.fillStyle = `rgba(255,255,255,${pulse})`; diamond(p.x, y, TW / 2 - 3, TH / 2 - 1.5); cx.fill(); cx.strokeStyle = '#FFFFFF'; cx.lineWidth = 2; cx.stroke(); }
    if (sc.hlBad.has(id)) { cx.fillStyle = 'rgba(235,75,67,.25)'; diamond(p.x, y, TW / 2 - 3, TH / 2 - 1.5); cx.fill(); }
    if (sc.sel && sc.sel.r === r && sc.sel.c === c) { cx.strokeStyle = '#2A2F3A'; cx.lineWidth = 3; diamond(p.x, y, TW / 2 - 2, TH / 2 - 1); cx.stroke(); }
  });
  order.forEach(([r, c]) => drawObj(sc.tiles[r][c], r, c, sc));
  // 夜
  if (sc.night > 0.01) {
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.fillStyle = `rgba(22,30,72,${0.55 * sc.night})`; cx.fillRect(0, 0, W, H);
    cx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (W / 2 + cam.x), dpr * (H / 2 + cam.y));
    cx.globalCompositeOperation = 'lighter';
    order.forEach(([r, c]) => drawLights(sc.tiles[r][c], r, c, sc));
    cx.globalCompositeOperation = 'source-over';
  }
  // 停電の家に⚡マーク
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawWeather(sc);
  if (sc.dark.size && Math.floor(sc.time / 300) % 2) {
    cx.font = '16px sans-serif'; cx.textAlign = 'center';
    sc.dark.forEach(id => { const r = (id / N) | 0, c = id % N, s = R.tileScreen(r, c); cx.fillText('⚡', s.x, s.y - 26 * cam.z); });
  }
  sc.labels.forEach(l => { const s = R.tileScreen(l.r, l.c); chip(s.x, s.y - 34 * cam.z, l.text, l.col); });
  (sc.bubbles || []).forEach(b => { const s = R.tileScreen(b.r, b.c); bubble(s.x, s.y - 40 * cam.z, b.text, b.col, b.a == null ? 1 : b.a); });
  const now = performance.now();
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i], k = (now - f.t0) / 1100; if (k >= 1) { floats.splice(i, 1); continue; }
    const s = R.tileScreen(f.r, f.c);
    cx.globalAlpha = 1 - k; cx.font = '900 18px "M PLUS Rounded 1c", sans-serif'; cx.textAlign = 'center';
    cx.lineWidth = 4; cx.strokeStyle = '#fff'; cx.strokeText(f.text, s.x, s.y - 30 - k * 40); cx.fillStyle = f.col; cx.fillText(f.text, s.x, s.y - 30 - k * 40);
    cx.globalAlpha = 1;
  }
};

/* ---------- 24時間の積み上げグラフ（ふりかえり・ライブ共通） ---------- */
R.stackChart = function (canvas, log, upto, opts) {
  opts = opts || {};
  const c = canvas.getContext('2d'), r = canvas.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = r.width * d; canvas.height = r.height * d; c.setTransform(d, 0, 0, d, 0, 0);
  const w = r.width, h = r.height, L = 4, Rr = 4, T = 6, Bm = opts.axis === false ? 4 : 18, pw = w - L - Rr, ph = h - T - Bm;
  const full = opts.dayD || log.D;
  let max = 1; for (let i = 0; i < 24; i++) { let s = 0; EC.STACK.forEach(k => (s += (log.gen[k][i] || 0))); max = Math.max(max, s + (log.curt[i] || 0), full[i] || 0); }
  max *= 1.08;
  const bw = pw / 24;
  c.clearRect(0, 0, w, h);
  if (opts.hour != null) { c.fillStyle = 'rgba(43,125,233,.08)'; c.fillRect(L + opts.hour * bw, T, bw, ph); }
  for (let i = 0; i < upto; i++) {
    let y = T + ph;
    EC.STACK.forEach(k => { const v = log.gen[k][i] || 0; if (v <= 0) return; const hh = v / max * ph; c.fillStyle = EC.PLANTS[k].c; c.fillRect(L + i * bw + 0.5, y - hh, bw - 1, hh); y -= hh; });
    if (log.short[i] > 0.05) { const hh = log.short[i] / max * ph; c.fillStyle = '#EB4B43'; c.globalAlpha = 0.35; c.fillRect(L + i * bw + 0.5, y - hh, bw - 1, hh); c.globalAlpha = 1; c.strokeStyle = '#EB4B43'; c.lineWidth = 1.5; c.strokeRect(L + i * bw + 1, y - hh, bw - 2, hh); }
    if (log.curt[i] > 0.05) { const hh = log.curt[i] / max * ph; c.fillStyle = 'rgba(150,160,175,.35)'; c.fillRect(L + i * bw + 0.5, y - hh, bw - 1, hh); }
  }
  // 需要の線
  c.strokeStyle = '#2A2F3A'; c.lineWidth = 2; c.setLineDash(opts.live ? [4, 3] : []); c.beginPath();
  for (let i = 0; i < 24; i++) { const v = full[i]; if (v == null) break; const yy = T + ph - v / max * ph; if (!i) c.moveTo(L, yy); c.lineTo(L + i * bw, yy); c.lineTo(L + (i + 1) * bw, yy); }
  c.stroke(); c.setLineDash([]);
  if (opts.axis !== false) {
    c.fillStyle = '#7A8394'; c.font = '700 10px "M PLUS Rounded 1c", sans-serif'; c.textAlign = 'center';
    [0, 6, 12, 18, 24].forEach(t => c.fillText(t + '時', clamp(L + t * bw, 12, w - 14), h - 4));
  }
};
})();
