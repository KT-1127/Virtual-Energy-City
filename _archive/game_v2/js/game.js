/* エネルギーシティ ― ゲームの流れ・操作・画面 */
(function () {
const EC = window.EC, B = EC.BALANCE, P = EC.PLANTS, R = EC.R;
const N = 12;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = n => Math.round(n).toLocaleString('ja-JP');
if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };

/* ---------- 保存 ---------- */
const SAVE_KEY = 'ecity2';
function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } }
function writeSave(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) {} }
const save = Object.assign({ best: {}, ach: {}, daily: {}, sound: true, seenIntro: false }, loadSave());

/* ---------- 効果音（WebAudio） ---------- */
let actx = null;
function beep(freq, dur, type, vol, delay) {
  if (!save.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime + (delay || 0), o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol || 0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur);
  } catch (e) {}
}
const SFX = {
  tap: () => beep(660, 0.08, 'triangle', 0.08),
  build: () => { beep(520, 0.1, 'square', 0.07); beep(780, 0.14, 'square', 0.07, 0.08); },
  bad: () => beep(180, 0.25, 'sawtooth', 0.08),
  black: () => { beep(140, 0.35, 'sawtooth', 0.1); beep(90, 0.4, 'sawtooth', 0.08, 0.15); },
  pinch: () => { beep(880, 0.12, 'square', 0.07); beep(880, 0.12, 'square', 0.07, 0.2); },
  good: () => [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.18, 'triangle', 0.09, i * 0.09)),
  combo: () => [784, 988, 1175].forEach((f, i) => beep(f, 0.15, 'triangle', 0.08, i * 0.07)),
  coin: () => { beep(988, 0.08, 'square', 0.06); beep(1319, 0.2, 'square', 0.06, 0.07); }
};

/* ---------- 状態 ---------- */
let S = null;          // ゲーム全体の状態
let phase = 'title';   // title | build | banner | day | report
let sel = null;        // 選択中の電源 or 'demolish'
let selTile = null;
let day = null;        // 1日の進行 { ev, run, acc, speed, bubbles, ... }
let lastT = performance.now();

function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function each(fn) { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) fn(S.tiles[r][c], r, c); }
function nb(r, c, fn) { for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const R2 = r + dr, C2 = c + dc; if (R2 >= 0 && R2 < N && C2 >= 0 && C2 < N) fn(S.tiles[R2][C2], R2, C2); } }
const coastal = (r, c) => { let k = false; nb(r, c, t => { if (t.t === '~') k = true; }); return k; };
const nearOnsen = (r, c) => { let k = false; nb(r, c, t => { if (t.t === 'o') k = true; }); return k; };
function nearHouses(r, c, d) { let k = 0; for (let R2 = r - d; R2 <= r + d; R2++) for (let C2 = c - d; C2 <= c + d; C2++) { if (R2 < 0 || C2 < 0 || R2 >= N || C2 >= N) continue; const b = S.tiles[R2][C2].b; if (b && b.kind === 'house') k++; } return k; }
const cost = type => type === 'solar' ? S.solarCost : P[type].cost;
function counts() { let h = 0, f = 0; each(t => { if (t.b) { if (t.b.kind === 'house') h++; if (t.b.kind === 'factory') f++; } }); return { h, f }; }
const dist = (r, c) => Math.hypot(r - S.stage.center[0], c - S.stage.center[1]);

function newGame(stageId, mode) {
  const st = EC.STAGES.find(s => s.id === stageId);
  const seedStr = mode === 'daily' ? 'daily:' + todayStr() : 'free:' + Math.random();
  const tiles = st.map.map(row => [...row].map(t => ({ t, b: null })));
  st.plants.forEach(([r, c, type, retire]) => (tiles[r][c].b = { kind: 'plant', type, left: 0, old: !!retire, retire }));
  S = { stage: st, mode, seedStr, town: EC.rng(EC.hash(seedStr + 'town')), year: B.startYear, money: B.startMoney, sat: B.startSat, tiles,
    score: 0, blackTotal: 0, co2r: 1, price: null, solarCost: P.solar.cost, history: [], forecast: [], newAch: [], everNuke: false, goal2030: null, turn: 0 };
  const cand = [];
  each((t, r, c) => { if (t.t === 'g' && !t.b) cand.push([dist(r, c) + S.town() * 0.5, r, c]); });
  cand.sort((a, b) => a[0] - b[0]).slice(0, B.startHouses).forEach(([, r, c], i) => (S.tiles[r][c].b = { kind: 'house', col: i % EC.HOUSE_COLORS.length }));
  makeForecast();
}

/* ---------- 発電所の配置ルール ---------- */
function canPlace(type, r, c) {
  const t = S.tiles[r][c];
  if (t.b) return 'すでに何かが建っています';
  if (type === 'hydro') return t.t === 'r' ? null : '水力は川の上にしか建てられません';
  if (t.t === 'r') return '川の上には水力しか建てられません';
  if (t.t === '~') return '海の上には建てられません';
  if (t.t === 'o') return '温泉には建てられません';
  if (type === 'geo') return t.t === 'm' ? null : '地熱は山にしか建てられません';
  if (type === 'wind') return (t.t === 'm' || (t.t === 'g' && coastal(r, c))) ? null : '風力は海ぞいか山に建てます（風が強い場所）';
  if (t.t === 'm') return P[type].n + 'は山には建てられません';
  if (type === 'thermal' || type === 'nuclear') return coastal(r, c) ? null : P[type].n + 'は海ぞいにしか建てられません';
  return null;
}
function placeWarn(type, r, c) {
  if (type === 'geo' && nearOnsen(r, c)) return '♨️ 温泉のとなり！住民が反対しそう（満足度ダウン）';
  if (type === 'nuclear' && nearHouses(r, c, 2) > 0) return '🏠 家が近い！住民が不安に思いそう（満足度ダウン）';
  if (type === 'solar') return '';
  return '';
}
function activePlants() {
  const n = { solar: 0, wind: 0, thermal: 0, hydro: 0, geo: 0, nuclear: 0, battery: 0 }; let onsen = 0, nuke = 0, mt = 0;
  each((t, r, c) => { const b = t.b; if (b && b.kind === 'plant' && b.left <= 0) { n[b.type]++; mt += P[b.type].mt; if (b.type === 'geo' && nearOnsen(r, c)) onsen++; if (b.type === 'nuclear' && nearHouses(r, c, 2) > 0) nuke++; } });
  return { n, onsen, nuke, mt };
}

/* ---------- 予報（柱2：読み合い） ---------- */
function eventPool() {
  const { n } = activePlants();
  return EC.EVENTS.filter(e => (!e.season || e.season === S.stage.season) && (!e.need || n[e.need] > 0) && !(e.minYear && S.year < e.minYear));
}
function makeForecast() {
  if (S.turn === 0) { S.forecast = [{ ev: EC.EVENTS[0], p: 100 }]; return; }
  const r = EC.rng(EC.hash(S.seedStr + S.year + 'f'));
  let pool = eventPool().slice(); const picks = [];
  while (picks.length < 3 && pool.length) {
    const tot = pool.reduce((a, e) => a + e.w, 0); let x = r() * tot;
    const e = pool.find(e => (x -= e.w) <= 0) || pool[0];
    picks.push(e); pool = pool.filter(p => p !== e);
  }
  let ws = picks.map(e => e.w * (0.6 + r() * 0.8)); const tot = ws.reduce((a, b) => a + b, 0);
  let ps = ws.map(w => Math.max(5, Math.round(w / tot * 20) * 5));
  ps[0] += 100 - ps.reduce((a, b) => a + b, 0);
  S.forecast = picks.map((ev, i) => ({ ev, p: ps[i] })).sort((a, b) => b.p - a.p);
}
function pickEvent() {
  let x = EC.rng(EC.hash(S.seedStr + S.year + 'e'))() * 100;
  for (const f of S.forecast) { x -= f.p; if (x <= 0) return f.ev; }
  return S.forecast[0].ev;
}

/* ---------- HUD ---------- */
let lastScore = 0;
function renderHUD() {
  $('hYear').textContent = S.year;
  $('hMoney').textContent = fmt(S.money);
  $('hSat').textContent = Math.round(S.sat);
  $('hCo2').textContent = Math.round(S.co2r * 100) + '%';
  $('hPrice').textContent = S.price == null ? '--' : S.price.toFixed(1) + '円';
  $('hHouses').textContent = counts().h;
  $('hScore').textContent = fmt(S.score);
  if (S.score !== lastScore) { const el = $('hScore').closest('.stat'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); lastScore = S.score; }
  $('next').textContent = `▶ ${S.year}年の${EC.SEASONS[S.stage.season].name}へ`;
}
function renderForecast() {
  const el = $('forecast');
  el.innerHTML = `<h4>📡 ${S.year}年の予報 <button id="fcToggle">${el.classList.contains('collapsed') ? 'ひらく' : 'とじる'}</button></h4>` +
    S.forecast.map(f => `<div class="fc ${f.ev.good ? 'good' : f.ev.id === 'calm' ? '' : 'bad'}"><i>${f.ev.icon}</i><span>${f.ev.t}<small>${f.ev.d}</small><div class="bar"><em style="width:${f.p}%"></em></div></span><b>${f.p}%</b></div>`).join('') +
    retireNotice();
  $('fcToggle').onclick = e => { e.stopPropagation(); el.classList.toggle('collapsed'); renderForecast(); };
}
function retireNotice() {
  const out = [];
  each(t => { const b = t.b; if (b && b.kind === 'plant' && b.retire && b.retire > S.year && b.retire <= S.year + 4) out.push(b.retire); });
  return out.length ? `<div class="fc bad"><i>👴</i><span>古い火力が引退<small>${out.join('・')}年に止まります。代わりを準備！</small></span></div>` : '';
}
function charaHTML(type, cls) { return `<span class="chara ${cls || ''}" style="--c:${P[type].c}"><i></i><em>${P[type].icon}</em></span>`; }
function renderPalette() {
  const pal = $('palette');
  pal.innerHTML = EC.ORDER.map(k => {
    const locked = P[k].unlock && S.year < P[k].unlock, poor = S.money < cost(k);
    return `<button class="card ${sel === k ? 'sel' : ''} ${poor ? 'off' : ''}" data-k="${k}" style="--c:${P[k].c}">${charaHTML(k)}<b>${P[k].n}</b><small>💰${cost(k)}</small>${locked ? `<div class="lock">${P[k].unlock}年〜</div>` : ''}</button>`;
  }).join('') + `<button class="card tool ${sel === 'demolish' ? 'sel' : ''}" data-k="demolish"><span style="font-size:30px;line-height:40px">🚜</span><b>こわす</b><small>返金なし</small></button>`;
  pal.querySelectorAll('.card').forEach(b => (b.onclick = () => selectType(b.dataset.k)));
}
function renderInfo() {
  const el = $('info');
  if (selTile) { // 建物の情報
    const t = S.tiles[selTile.r][selTile.c], b = t.b;
    let html = '';
    if (b && b.kind === 'plant') {
      const p = P[b.type];
      html = `${charaHTML(b.type, 'big')}<div class="txt"><h3>${p.chara}（${p.n}）${b.left > 0 ? `<small>建設中・あと${b.left * B.yearsPerTurn}年</small>` : b.retire ? `<small>${b.retire}年に引退予定</small>` : ''}</h3>${p.profile}<br><span class="pill ok">長所</span>${p.good}<br><span class="pill ng">短所</span>${p.bad}</div>`;
    } else if (b && b.kind === 'house') html = `<div class="txt"><h3>🏠 家</h3>人が住んでいます。夕方〜夜にたくさん電気を使います。停電が続くと引っこしてしまいます。</div>`;
    else if (b && b.kind === 'factory') html = `<div class="txt"><h3>🏭 工場</h3>昼間に大量の電気を使います。税収が多く、町の予算がふえます。</div>`;
    else html = `<div class="txt"><h3>${{ g: '🌱 平地', m: '⛰️ 山', o: '♨️ 温泉', r: '🏞️ 川', '~': '🌊 海' }[t.t]}</h3>${{ g: '家・工場・太陽光・蓄電池が建てられます。海ぞいなら火力・原子力・風力も。', m: '風力・地熱が建てられます。', o: '温泉。となりに地熱を建てると反対運動が起きます。', r: '水力だけが建てられます。', '~': '海。海ぞいのマスに火力・原子力・風力を建てられます。' }[t.t]}</div>`;
    el.innerHTML = html + `<button class="x" id="infoX">✕</button>`; el.classList.add('show');
  } else if (sel && sel !== 'demolish') {
    const p = P[sel];
    el.innerHTML = `${charaHTML(sel, 'big')}<div class="txt"><h3>${p.chara}（${p.n}）<small>💰${cost(sel)}・${p.turns ? `完成まで${p.turns * B.yearsPerTurn}年` : 'すぐ完成'}・維持費${p.mt}/年・CO₂ ${p.co2}g</small></h3><span class="pill ok">長所</span>${p.good}<br><span class="pill ng">短所</span>${p.bad}<br><span class="pill pl">置ける場所</span>${p.where}</div><button class="x" id="infoX">✕</button>`;
    el.classList.add('show');
  } else if (sel === 'demolish') {
    el.innerHTML = `<div class="txt"><h3>🚜 こわす</h3>発電所をタップすると撤去します（お金はもどりません）。古い発電所の入れかえに。</div><button class="x" id="infoX">✕</button>`; el.classList.add('show');
  } else { el.classList.remove('show'); el.innerHTML = ''; }
  const x = $('infoX'); if (x) x.onclick = () => { sel = null; selTile = null; renderPalette(); renderInfo(); };
}
function selectType(k) {
  if (phase !== 'build') return;
  SFX.tap();
  if (k !== 'demolish' && P[k].unlock && S.year < P[k].unlock) { toast(`${P[k].n}は${P[k].unlock}年に登場します`); return; }
  sel = sel === k ? null : k; selTile = null; demolishArm = null;
  renderPalette(); renderInfo();
}
let toastTimer;
function toast(msg) { const el = $('toast'); el.textContent = msg; el.style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.style.opacity = 0), 2400); }

/* ---------- 地図の操作（ドラッグ・ピンチ・ホイール・タップ） ---------- */
const pointers = new Map(); let dragMoved = false, pinchD = 0, demolishArm = null;
function setupInput() {
  const cv = $('map');
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); dragMoved = false; if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); } });
  cv.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (pointers.size === 1) { if (Math.abs(dx) + Math.abs(dy) > 3 || dragMoved) { dragMoved = true; R.pan(dx, dy); } }
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2) {
      dragMoved = true; const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y), rc = cv.getBoundingClientRect();
      if (pinchD) R.zoomAt(d / pinchD, (a.x + b.x) / 2 - rc.left, (a.y + b.y) / 2 - rc.top); pinchD = d;
    }
  });
  const up = e => {
    if (pointers.has(e.pointerId) && pointers.size === 1 && !dragMoved) { const rc = cv.getBoundingClientRect(); onTap(e.clientX - rc.left, e.clientY - rc.top); }
    pointers.delete(e.pointerId); if (pointers.size < 2) pinchD = 0;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); });
  cv.addEventListener('wheel', e => { e.preventDefault(); const rc = cv.getBoundingClientRect(); R.zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - rc.left, e.clientY - rc.top); }, { passive: false });
  document.querySelectorAll('#zoom button').forEach(b => (b.onclick = () => { const rc = cv.getBoundingClientRect(); if (b.dataset.z === 'fit') R.fit(); else R.zoomAt(b.dataset.z === 'in' ? 1.25 : 0.8, rc.width / 2, rc.height / 2); }));
  window.addEventListener('resize', () => { R.resize(); });
}
function onTap(mx, my) {
  if (phase !== 'build') return;
  const h = R.hit(mx, my); if (!h) return;
  const { r, c } = h, t = S.tiles[r][c];
  if (sel === 'demolish') {
    if (!t.b || t.b.kind !== 'plant') { toast('こわせるのは発電所だけです'); return; }
    if (!demolishArm || demolishArm.r !== r || demolishArm.c !== c) { demolishArm = { r, c }; toast('もう一度タップすると、こわします'); return; }
    t.b = null; demolishArm = null; SFX.bad(); R.float(r, c, 'こわした', '#7A8394'); renderAll(); return;
  }
  if (sel) {
    const why = canPlace(sel, r, c);
    if (why) { SFX.bad(); toast(why); return; }
    if (S.money < cost(sel)) { SFX.bad(); toast(`予算が足りません（あと${cost(sel) - S.money}）`); return; }
    S.money -= cost(sel);
    t.b = { kind: 'plant', type: sel, left: P[sel].turns };
    if (sel === 'nuclear') S.everNuke = true;
    SFX.build(); R.float(r, c, '-' + cost(sel), '#EB4B43');
    const w = placeWarn(sel, r, c);
    toast(w || `${P[sel].chara}（${P[sel].n}）を建てた！${P[sel].turns ? `完成まで${P[sel].turns * B.yearsPerTurn}年` : ''}`);
    if (S.money < cost(sel)) sel = null;
    renderAll(); return;
  }
  selTile = (selTile && selTile.r === r && selTile.c === c) ? null : { r, c }; SFX.tap(); renderInfo();
}

/* ---------- 1日（柱1：その場で操作できる） ---------- */
function startDay() {
  if (phase !== 'build') return;
  sel = null; selTile = null; renderPalette(); renderInfo();
  const ev = pickEvent(), ap = activePlants(), { h, f } = counts();
  const p = EC.makeDay({ n: ap.n, houses: h, factories: f, ev, stage: S.stage, rng: EC.rng(EC.hash(S.seedStr + S.year + 'd')) });
  const run = EC.newRun(p);
  day = { ev, run, ap, acc: 0, speed: 1, uses: { save: B.actions.save.uses, boost: B.actions.boost.uses }, savedCount: 0, bubbles: {}, pinchShown: false, pinchHour: -1, slow: 0, lastRec: null, dark: new Set(), spin: 0 };
  phase = 'banner';
  $('buildDock').hidden = true; $('dayDock').hidden = false; $('forecast').hidden = true;
  $('socBox').hidden = !ap.n.battery;
  updateActions();
  $('banner').innerHTML = `<div class="in"><i>${ev.icon}</i><b>${ev.t}</b><small>${ev.d}</small></div>`; $('banner').hidden = false;
  ev.good || ev.id === 'calm' ? SFX.good() : SFX.pinch();
  setTimeout(() => { if (phase !== 'banner') return; $('banner').hidden = true; phase = 'day'; $('clock').hidden = false; }, 1900);
  drawLive();
}
function updateActions() {
  const n = day.run.p.n, c = day.run.ctrl;
  $('cntSave').textContent = day.uses.save; $('actSave').disabled = !day.uses.save || c.save > 0;
  $('cntBoost').textContent = day.uses.boost; $('actBoost').disabled = !day.uses.boost || !n.thermal || c.boost > 0;
  $('actHold').disabled = !n.battery; $('stHold').textContent = c.hold ? 'ON' : 'OFF'; $('actHold').classList.toggle('on', c.hold);
  $('actSave').classList.toggle('on', c.save > 0); $('actBoost').classList.toggle('on', c.boost > 0);
  const hot = day.pinchHour >= 0;
  ['actSave', 'actBoost', 'actHold'].forEach(id => $(id).classList.toggle('hot', hot && !$(id).disabled && !$(id).classList.contains('on')));
}
function doAction(k) {
  if (phase !== 'day' || day.run.h >= 24) return;
  const c = day.run.ctrl;
  if (k === 'save' && day.uses.save && !c.save) { day.uses.save--; day.savedCount++; c.save = B.actions.save.hours; toast('📢 町のみんなに節電をおねがい！'); SFX.coin(); }
  if (k === 'boost' && day.uses.boost && day.run.p.n.thermal && !c.boost) { day.uses.boost--; c.boost = B.actions.boost.hours; toast('🔥 火力フルパワー！（燃料代アップ）'); SFX.build(); }
  if (k === 'hold' && day.run.p.n.battery) { c.hold = !c.hold; toast(c.hold ? '🔒 蓄電池を温存。ピンチの時まで使わない' : '🔓 蓄電池をふつうに使う'); SFX.tap(); }
  checkPinch(); updateActions();
}
function setSpeed(s) {
  if (!day || phase !== 'day') return;
  document.querySelectorAll('.speed button').forEach(b => b.classList.toggle('on', b.dataset.speed === String(s)));
  if (s === 'skip') { while (day.run.h < 24) stepHour(true); endDay(); return; }
  day.speed = Number(s);
}
function checkPinch() {
  const h = EC.peek(day.run, B.pinchLookahead);
  day.pinchHour = h;
  const el = $('pinch');
  if (h >= 0) {
    el.textContent = `⚠ ピンチ予報：${h}時に電気が足りなくなりそう！`; el.hidden = false;
    if (!day.pinchShown) { day.pinchShown = true; day.slow = 3; SFX.pinch(); }
  } else el.hidden = true;
}
function stepHour(quiet) {
  const rec = EC.stepHour(day.run); day.lastRec = rec;
  // 停電する家（外側から暗くなる）
  day.dark = new Set();
  if (rec.short > 0.05) {
    const frac = clamp(rec.short / rec.d, 0, 1), list = [];
    each((t, r, c) => { if (t.b && (t.b.kind === 'house' || t.b.kind === 'factory')) list.push([dist(r, c), r * N + c]); });
    list.sort((a, b) => b[0] - a[0]); const k = Math.ceil(frac * list.length);
    for (let i = 0; i < k; i++) day.dark.add(list[i][1]);
    if (!quiet) SFX.black();
  }
  if (!quiet) { updateBubbles(rec); checkPinch(); updateActions(); drawLive(); }
  if (day.slow > 0) day.slow--;
}
function drawLive() {
  const run = day.run;
  R.stackChart($('liveChart'), run.log, run.h, { live: true, dayD: run.p.D, hour: run.h < 24 ? run.h : null });
  if (run.bCap) $('socFill').style.width = Math.round(run.bE / run.bCap * 100) + '%';
}
function endDay() {
  phase = 'report'; $('clock').hidden = true; $('pinch').hidden = true;
  day.dark = new Set(); day.bubbles = {};
  const ap = day.ap, { h, f } = counts();
  const res = EC.finish(day.run, { mt: ap.mt, houses: h, factories: f });
  const an = EC.analyze(day.run, res, day.ev, S.year);
  const turn = endTurn(res, an, day.ev, ap);
  showReport(res, an, turn);
}

/* ---------- キャラのセリフ（吹き出し） ---------- */
function plantPos(type) { let p = null; each((t, r, c) => { if (!p && t.b && t.b.kind === 'plant' && t.b.type === type && t.b.left <= 0) p = { r, c }; }); return p; }
function updateBubbles(rec) {
  const p = day.run.p, n = p.n, h = rec.h, ev = day.ev, se = p.season, L = EC.LINES, cand = [];
  const add = (k, key, pr) => { if (n[k] > 0 || (k === 'thermal' && ev.id === 'trip' && day.ap.n.thermal)) cand.push({ k, key, pr }); };
  if (n.solar) {
    if (p.SUN[h] <= 0) add('solar', 'night', rec.short > 0 ? 3 : 1);
    else if (h >= se.sunEnd - 3) add('solar', 'evening', 3);
    else if (h <= se.sunStart + 1.5) add('solar', 'morning', 1);
    else if (rec.curt > 0.5) add('solar', 'curt', 3);
    else if (ev.fx.sun < 0.6) add('solar', 'cloud', 2);
    else add('solar', 'peak', 1);
  }
  if (n.wind) {
    if (ev.id === 'typhoon') add('wind', 'stop', 3);
    else if (p.W[h] < 0.15) add('wind', 'weak', 2);
    else if ((h < 6 || h >= 19) && p.W[h] > 0.4) add('wind', 'night', 2);
    else if (p.W[h] > 0.6) add('wind', 'strong', 1);
  }
  if (ev.id === 'trip' && h === 8) add('thermal', 'trip', 4);
  if (n.thermal) {
    if (rec.ramp) add('thermal', 'ramp', 4);
    else if (day.run.ctrl.boost > 0 && rec.g.thermal > 0) add('thermal', 'boost', 3);
    else if (ev.id === 'fuel' && rec.g.thermal > 0) add('thermal', 'fuel', 2);
    else if (rec.g.thermal > 0) add('thermal', 'work', 0.5);
  }
  if (n.nuclear || day.ap.n.nuclear) {
    if (ev.id === 'inspect') { if (day.ap.n.nuclear) cand.push({ k: 'nuclear', key: 'inspect', pr: 2 }); }
    else if (rec.nukeCurt > 0.1) add('nuclear', 'curt', 3);
    else add('nuclear', 'work', 0.2);
  }
  if (n.battery) {
    if (rec.soc < 0.03 && rec.short > 0) add('battery', 'empty', 4);
    else if (rec.g.battery > 0) add('battery', 'discharge', 3);
    else if (day.run.ctrl.hold && rec.g.thermal > 0) add('battery', 'hold', 2);
    else if (rec.soc > 0.97) add('battery', 'full', 1);
    else if (rec.charge > 0.1) add('battery', 'charge', 2);
  }
  if (n.hydro) add('hydro', 'work', 0.1);
  if (n.geo) add('geo', 'work', 0.1);
  cand.sort((a, b) => b.pr - a.pr || (Math.random() - 0.5));
  const keep = {};
  cand.slice(0, 2).forEach(cd => {
    const old = day.bubbles[cd.k];
    keep[cd.k] = old && old.key === cd.key ? old : { key: cd.key, text: L[cd.k][cd.key], t0: performance.now() };
  });
  day.bubbles = keep;
}

/* ---------- 1ターンの終わり（町の成長・お金・スコア） ---------- */
function endTurn(res, an, ev, ap) {
  const news = [], Y = B.yearsPerTurn, prev = { sat: S.sat, co2r: S.co2r, price: S.price, money: S.money };
  S.co2r = res.intensity / B.co2Base; S.price = res.price; S.blackTotal += res.blackHours;
  const net = Math.round((res.income - res.running) * Y); S.money += net;
  const st = B.sat;
  const tgt = st.base - Math.min(st.maxBlack, res.blackHours * st.perBlackHour) - Math.max(0, res.price - st.priceFree) * st.perPrice
    - Math.min(1.2, S.co2r) * st.co2 - ap.onsen * st.onsen - ap.nuke * st.nukeNear;
  S.sat = clamp(S.sat + (tgt - S.sat) * st.smooth - day.savedCount * B.actions.save.sat, 0, 100);
  // 町の成長
  if (res.blackHours > 0) {
    let k = Math.min(3, Math.ceil(res.blackHours / 2)), m = 0; while (k-- > 0) if (removeHouse()) m++;
    if (m) news.push(['bad', `停電にこりて、${m}軒が町から引っこしていきました。`]);
  } else {
    const k = S.sat >= B.growth.high ? 2 : S.sat >= B.growth.mid ? 1 : 0; let m = 0;
    for (let i = 0; i < k; i++) if (addHouse()) m++;
    if (m) news.push(['info', `住みやすい町だと評判になり、家が${m}軒ふえました。使う電気もふえます。`]);
    else if (k) news.push(['warn', '家を建てる土地がありません。発電所で平地を使いすぎていませんか？']);
    else news.push(['warn', '満足度が低く、人がふえません。停電・電気代・CO₂を見直そう。']);
  }
  const { h, f } = counts(); const need = B.factoryAt.filter(x => h >= x).length;
  if (f < need && S.sat >= 50 && addFactory()) news.push(['info', '🏭 工場がやってきた！昼間に電気をたくさん使うけど、税収がふえます。']);
  // 建設・引退
  each(t => { if (t.b && t.b.kind === 'plant' && t.b.left > 0) { t.b.left--; if (!t.b.left) news.push(['good', `${P[t.b.type].chara}（${P[t.b.type].n}）が完成！次の年から発電します。`]); } });
  each(t => { const b = t.b; if (b && b.kind === 'plant' && b.retire && b.retire <= S.year + Y) { t.b = null; news.push(['warn', '👴 古い火力発電所が引退しました。足りなくなる分を準備しよう。']); } });
  if (S.year < 2028 && S.year + Y >= 2028) news.push(['good', '🔋 蓄電池「ためるん」が使えるようになりました！']);
  if (S.year === 2030) {
    {
      const ok = S.co2r <= B.goal2030; S.goal2030 = ok;
      news.push(ok ? ['good', `🎯 2030年目標「CO₂ 46%削減」達成！ごほうびに予算+${B.bonus2030}`] : ['warn', `2030年目標「CO₂ 46%削減」は未達成（いま${Math.round((1 - S.co2r) * 100)}%削減）。2050年に向けて立て直そう。`]);
      if (ok) { S.money += B.bonus2030; unlock('goal2030'); }
    }
  }
  if (ev.cheap) S.solarCost = Math.max(8, S.solarCost - ev.cheap);
  // スコア
  const sc = B.score;
  let pts = res.blackHours === 0 ? sc.noBlack : sc.perBlackHour * res.blackHours;
  pts += Math.round(clamp(1 - S.co2r, 0, 1) * sc.clean) + Math.round(Math.max(0, sc.priceFree - res.price) * sc.perPrice) + an.combos.length * sc.combo;
  const mult = 1 + sc.mixBonus * Math.max(0, an.kinds - 1);
  if (pts > 0) pts = Math.round(pts * mult);
  S.score = Math.max(0, S.score + pts);
  // 実績
  if (!res.n.thermal && !activePlants().n.thermal && res.blackHours === 0) unlock('nothermal');
  if (EC.ORDER.every(k => res.n[k] > 0)) unlock('all7');
  if (an.combos.length >= 3) unlock('combo3');
  if (day.pinchShown && res.blackHours === 0) unlock('pinch');
  if (ev.id === 'fuel' && res.price <= 15) unlock('fuelproof');
  if (res.vre > 0.3 * res.served && res.curtE < 0.03 * res.vre) unlock('nowaste');
  if (counts().h >= 40) unlock('big');
  S.history.push({ year: S.year, co2r: S.co2r, black: res.blackHours, price: res.price, sat: S.sat, E: res.E, served: res.served, pts, ev: ev.id });
  const year = S.year;
  S.year += Y; S.turn++;
  return { news, net, pts, mult, prev, year };
}
function addHouse() {
  let best = null, bd = 1e9;
  each((t, r, c) => {
    if (t.b || t.t !== 'g') return; let adj = false;
    nb(r, c, u => { if (u.b && (u.b.kind === 'house' || u.b.kind === 'factory')) adj = true; }); if (!adj) return;
    const d = dist(r, c) + S.town() * 0.8; if (d < bd) { bd = d; best = t; }
  });
  if (best) { best.b = { kind: 'house', col: (S.town() * EC.HOUSE_COLORS.length) | 0 }; return true; } return false;
}
function addFactory() {
  let best = null, bd = 1e9;
  each((t, r, c) => { if (t.b || t.t !== 'g') return; let adj = false; nb(r, c, u => { if (u.b && u.b.kind === 'house') adj = true; }); if (!adj) return; const d = dist(r, c); if (d < bd) { bd = d; best = t; } });
  if (best) { best.b = { kind: 'factory' }; return true; } return false;
}
function removeHouse() {
  let worst = null, wd = -1; each((t, r, c) => { if (t.b && t.b.kind === 'house') { const d = dist(r, c); if (d > wd) { wd = d; worst = t; } } });
  if (worst && counts().h > 4) { worst.b = null; return true; } return false;
}
function unlock(id) { if (!save.ach[id]) { save.ach[id] = todayStr(); writeSave(save); S.newAch.push(id); const a = EC.ACHIEVEMENTS.find(x => x.id === id); setTimeout(() => toast(`🏆 実績解除！${a.icon} ${a.name}`), 400); } }

/* ---------- ふりかえり ---------- */
function legendHTML() {
  return `<div class="legend">${EC.STACK.map(k => `<span><i style="background:${P[k].c}"></i>${P[k].n}</span>`).join('')}<span><i style="background:#EB4B43;opacity:.5"></i>停電</span><span><i style="background:rgba(150,160,175,.5)"></i>捨てた電気</span><span><i style="background:#2A2F3A;height:2px"></i>使う量</span></div>`;
}
function delta(v, prev, unit, digits, lowerGood) {
  if (prev == null) return '';
  const d = v - prev; if (Math.abs(d) < (digits ? 0.05 : 0.5)) return '';
  return `<small class="${(d < 0) === lowerGood ? 'down' : 'up'}" style="font-size:11px">${d > 0 ? '▲' : '▼'}${Math.abs(d).toFixed(digits)}${unit}</small>`;
}
function showReport(res, an, turn) {
  const ev = day.ev, ok = res.blackHours === 0;
  ok ? SFX.good() : SFX.bad();
  const mvp = an.mvp ? P[an.mvp] : null;
  const html = `
    <div class="ev-head"><i>${ev.icon}</i><div><h2>${turn.year}年の${EC.SEASONS[S.stage.season].name} ― ${ev.t}</h2><p class="lead" style="margin:0">${ev.d}</p></div></div>
    <div class="verdict ${ok ? 'ok' : 'ng'}">${ok ? '✨ 停電ゼロ！町じゅうに電気をとどけた' : `⚡ 停電 ${res.blackHours}時間`}</div>
    <div class="chartbox"><canvas id="repChart"></canvas>${legendHTML()}</div>
    <div class="notes">${an.notes.map(([k, t]) => `<div class="note ${k}">${t}</div>`).join('')}</div>
    ${mvp ? `<div class="mvp">${charaHTML(an.mvp, 'bounce')}<p>使う量がいちばん多い<b>${an.peakH}時</b>をささえたMVPは<br><b style="color:${mvp.c}">${mvp.chara}（${mvp.n}）</b>！</p></div>` : ''}
    ${an.combos.length ? `<div class="combos">${an.combos.map((k, i) => `<div class="combo" style="animation-delay:${0.3 + i * 0.15}s">${EC.COMBOS[k].icon} ${EC.COMBOS[k].name}<small>${EC.COMBOS[k].d}</small></div>`).join('')}</div>` : ''}
    <div class="nums">
      <div><b>CO₂（2025年比）</b><em>${Math.round(S.co2r * 100)}%</em>${delta(S.co2r * 100, turn.prev.co2r * 100, '', 0, true)}</div>
      <div><b>電気代</b><em>${res.price.toFixed(1)}円</em>${delta(res.price, turn.prev.price, '', 1, true)}</div>
      <div><b>2年の収支</b><em class="${turn.net >= 0 ? 'down' : 'up'}">${turn.net >= 0 ? '+' : ''}${turn.net}</em></div>
      <div><b>満足度</b><em>${Math.round(S.sat)}</em>${delta(S.sat, turn.prev.sat, '', 0, false)}</div>
    </div>
    <div class="pts">⭐ +${fmt(Math.max(0, turn.pts))}点${turn.mult > 1 && turn.pts > 0 ? `（ミックスボーナス×${turn.mult.toFixed(1)}）` : ''}</div>
    <div class="notes">${turn.news.map(([k, t]) => `<div class="note ${k}">${t}</div>`).join('')}</div>
    <button class="btn" id="repNext">${S.year > B.endYear ? '🏁 結果発表へ' : `${S.year}年へすすむ ▶`}</button>`;
  openModal(html);
  requestAnimationFrame(() => R.stackChart($('repChart'), day.run.log, 24, {}));
  if (an.combos.length) setTimeout(SFX.combo, 500);
  $('repNext').onclick = () => {
    closeModal(); SFX.tap();
    if (S.year > B.endYear) { showFinal(); return; }
    toBuild();
  };
}
function toBuild() {
  phase = 'build'; day = null;
  $('buildDock').hidden = false; $('dayDock').hidden = true; $('forecast').hidden = false;
  document.querySelectorAll('.speed button').forEach(b => b.classList.toggle('on', b.dataset.speed === '1'));
  makeForecast(); renderAll();
}
function renderAll() { renderHUD(); renderPalette(); renderInfo(); renderForecast(); }

/* ---------- 最終結果 ---------- */
function finalRank() {
  const k = B.rank, avgBlack = S.blackTotal;
  if (S.co2r <= k.S.co2 && avgBlack <= k.S.black && S.sat >= k.S.sat) return 'S';
  if (S.co2r <= k.A.co2 && avgBlack <= k.A.black && S.sat >= k.A.sat) return 'A';
  if (S.co2r <= k.B.co2 && avgBlack <= k.B.black) return 'B';
  return 'C';
}
function showFinal() {
  const rank = finalRank(), val = { S: 4, A: 3, B: 2, C: 1 };
  unlock('clear');
  if (S.blackTotal === 0) unlock('noblack');
  if (rank === 'S') unlock('rankS');
  if (!S.everNuke && val[rank] >= 3) unlock('nonuke');
  if (S.stage.id === 'island' && val[rank] >= 2) unlock('island');
  if (S.stage.id === 'snow' && val[rank] >= 2) unlock('snow');
  const prevBest = save.best[S.stage.id];
  const isBest = !prevBest || S.score > prevBest.score;
  if (isBest) save.best[S.stage.id] = { rank, score: S.score };
  if (S.mode === 'daily') { const d = todayStr(); if (!save.daily[d] || S.score > save.daily[d].score) save.daily[d] = { rank, score: S.score, stage: S.stage.id }; }
  writeSave(save);
  const msg = {
    S: 'CO₂をほぼゼロにしながら停電もほとんどなし。それぞれの電源の長所で短所をおぎない合う、見事なエネルギーミックスです！',
    A: 'CO₂を大きくへらし、町も元気に育ちました。あと少しで完璧なミックス。どの年が弱点だったかな？',
    B: '町はなんとか回りました。CO₂か停電、どちらかに弱点がありそう。電源の組み合わせを変えてみよう。',
    C: '電気をとどけ続けるのは、かんたんではありませんでした。どの時間に、何が足りなかったかを思い出して、もう一度！'
  }[rank];
  const colors = { S: '#FFC21A', A: '#34B56A', B: '#2B7DE9', C: '#9FB0C6' };
  const last = S.history[S.history.length - 1];
  const myMix = {}; EC.STACK.filter(k => k !== 'battery').forEach(k => (myMix[k] = last.E[k] / Math.max(1, last.served) * 100));
  const mixBar = (label, mix, note) => `<div class="mixbar"><small>${label}${note ? `（${note}）` : ''}</small><div class="b">${['thermal', 'nuclear', 'hydro', 'geo', 'wind', 'solar', 'other'].map(k => mix[k] ? `<i style="width:${mix[k]}%;background:${k === 'other' ? '#C5CCD6' : P[k].c}" title="${k === 'other' ? 'その他' : P[k].n} ${mix[k].toFixed(1)}%"></i>` : '').join('')}</div></div>`;
  const share = `⚡エネルギーシティ ${S.mode === 'daily' ? '今日のステージ ' + todayStr() : ''}\n${S.stage.name}：ランク${rank}・${fmt(S.score)}点\nCO₂ ${Math.round((1 - S.co2r) * 100)}%削減／停電 ${S.blackTotal}時間`;
  const achNew = S.newAch.map(id => EC.ACHIEVEMENTS.find(a => a.id === id));
  openModal(`
    <h2>🏁 2050年、町長の任期おわり</h2><p class="lead">${S.stage.name}の25年間の成績です。</p>
    <div class="rank" style="color:${colors[rank]}">${rank}</div>
    <div class="pts" style="font-size:22px">⭐ ${fmt(S.score)}点 ${isBest ? '<span class="daily-tag">ベスト更新！</span>' : `（ベスト ${fmt(prevBest.score)}点）`}</div>
    <div class="nums"><div><b>CO₂削減</b><em>${Math.round((1 - S.co2r) * 100)}%</em></div><div><b>停電 累計</b><em>${S.blackTotal}時間</em></div><div><b>満足度</b><em>${Math.round(S.sat)}</em></div><div><b>家の数</b><em>${counts().h}軒</em></div></div>
    <div class="note info" style="margin:8px 0">${msg}</div>
    <h3 style="margin:12px 0 0;font-size:15px">技術の見方・考え方でふりかえろう</h3>
    <canvas class="radar" id="radar"></canvas>
    <h3 style="margin:8px 0 0;font-size:15px">あなたの町の電源ミックスと、日本の実際</h3>
    <div class="mixbars">${mixBar('あなたの町（2050年）', myMix)}${EC.JAPAN.map(j => mixBar(j.label, j.mix, j.note)).join('')}</div>
    <div class="legend">${['thermal', 'nuclear', 'hydro', 'geo', 'wind', 'solar'].map(k => `<span><i style="background:${P[k].c}"></i>${P[k].n}</span>`).join('')}<span><i style="background:#C5CCD6"></i>その他（バイオマスなど）</span></div>
    ${achNew.length ? `<h3 style="margin:12px 0 0;font-size:15px">🏆 今回の実績</h3><div class="ach-list">${achNew.map(a => `<div class="ach new"><i>${a.icon}</i><span><b>${a.name}</b><small>${a.d}</small></span></div>`).join('')}</div>` : ''}
    <h3 style="margin:12px 0 4px;font-size:15px">結果をシェア</h3><div class="share">${share}</div>
    <div class="btn-row"><button class="btn ghost" id="toTitle">タイトルへ</button><button class="btn red" id="again">もう一度</button></div>`);
  rank === 'S' || rank === 'A' ? SFX.good() : SFX.tap();
  requestAnimationFrame(drawRadar);
  $('again').onclick = () => { closeModal(); begin(S.stage.id, S.mode); };
  $('toTitle').onclick = () => { closeModal(); showTitle(); };
}
function drawRadar() {
  const cv = $('radar'); if (!cv) return;
  const r0 = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); cv.width = r0.width * d; cv.height = r0.height * d;
  const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0);
  const avgPrice = S.history.reduce((a, h) => a + h.price, 0) / S.history.length;
  const axes = [
    ['社会からの要求', '安定供給', clamp(100 - S.blackTotal * 4, 0, 100)],
    ['環境への負荷', 'CO₂', clamp((1 - S.co2r) * 100, 0, 100)],
    ['経済性', '電気代', clamp(100 - (avgPrice - 10) * 5, 0, 100)],
    ['安全性・受容性', '満足度', clamp(S.sat, 0, 100)]
  ];
  const cxp = r0.width / 2, cyp = r0.height / 2 + 6, rad = 66;
  c.strokeStyle = '#E4E9F0'; c.lineWidth = 1;
  [0.25, 0.5, 0.75, 1].forEach(k => { c.beginPath(); axes.forEach((_, i) => { const a = -Math.PI / 2 + i * Math.PI / 2; const x = cxp + Math.cos(a) * rad * k, y = cyp + Math.sin(a) * rad * k; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); c.stroke(); });
  c.beginPath(); axes.forEach((ax, i) => { const a = -Math.PI / 2 + i * Math.PI / 2, k = ax[2] / 100; const x = cxp + Math.cos(a) * rad * k, y = cyp + Math.sin(a) * rad * k; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath();
  c.fillStyle = 'rgba(43,125,233,.25)'; c.fill(); c.strokeStyle = '#2B7DE9'; c.lineWidth = 2.5; c.stroke();
  c.fillStyle = '#2A2F3A'; c.font = '800 11px "M PLUS Rounded 1c", sans-serif'; c.textAlign = 'center';
  axes.forEach((ax, i) => { const a = -Math.PI / 2 + i * Math.PI / 2; const x = cxp + Math.cos(a) * (rad + 30), y = cyp + Math.sin(a) * (rad + 16); c.fillText(ax[0], x, y); c.fillStyle = '#7A8394'; c.fillText(`${ax[1]} ${Math.round(ax[2])}`, x, y + 13); c.fillStyle = '#2A2F3A'; });
}

/* ---------- モーダル ---------- */
function openModal(html) { $('modal').innerHTML = html; $('scrim').hidden = false; $('modal').scrollTop = 0; }
function closeModal() { $('scrim').hidden = true; }

/* ---------- タイトル・メニュー ---------- */
function showTitle() {
  phase = 'title';
  const letters = ['エ', 'ネ', 'ル', 'ギ', 'ー', 'シ', 'テ', 'ィ'], cols = ['#EB4B43', '#FF8A2A', '#FFC21A', '#34B56A', '#2FC1DA', '#2B7DE9', '#A066D9', '#EB4B43'];
  const daily = save.daily[todayStr()];
  $('title').innerHTML = `
    <div class="logo">${letters.map((l, i) => `<span style="background:${cols[i]};animation-delay:${i * 0.06}s">${l}</span>`).join('')}</div>
    <p class="tagline">町長になって、電気をとどけよう！</p>
    <div class="lineup">${EC.ORDER.map((k, i) => `<span class="chara bounce" style="--c:${P[k].c};animation-delay:${i * 0.15}s"><i></i><em>${P[k].icon}</em></span>`).join('')}</div>
    <div class="menu">
      <button class="btn red" id="tPlay">▶ あそぶ</button>
      <button class="btn" id="tDaily" style="background:var(--orange);box-shadow:0 5px 0 #c96615">📅 今日のステージ ${daily ? `<small>（今日のベスト ${fmt(daily.score)}点）</small>` : ''}</button>
      <div class="menu-sub">
        <button class="btn green" id="tZukan">📖 図鑑</button>
        <button class="btn ghost" id="tAch">🏆 実績</button>
        <button class="btn ghost" id="tHow">❓ 遊び方</button>
      </div>
    </div>`;
  $('title').hidden = false;
  $('tPlay').onclick = () => { SFX.tap(); showStages(); };
  $('tDaily').onclick = () => { SFX.tap(); const st = EC.STAGES[EC.hash(todayStr()) % EC.STAGES.length]; begin(st.id, 'daily'); };
  $('tZukan').onclick = () => { SFX.tap(); showZukan(); };
  $('tAch').onclick = () => { SFX.tap(); showAch(); };
  $('tHow').onclick = () => { SFX.tap(); showHow(); };
}
function showStages() {
  openModal(`<h2>ステージをえらぶ</h2><p class="lead">町によって、使える電源も、ピンチになる時間もちがいます。</p>
    <div class="stages">${EC.STAGES.map((s, i) => { const b = save.best[s.id]; return `<button class="stg" data-id="${s.id}"><span class="ic" style="background:${s.color}">${['🏘️', '🏝️', '⛄'][i]}</span><span><h3>${s.name}</h3><p>${s.sub}</p></span><span class="best">${b ? b.rank : ''}</span></button>`; }).join('')}</div>
    <button class="btn ghost" id="stBack">もどる</button>`);
  document.querySelectorAll('.stg').forEach(b => (b.onclick = () => { closeModal(); begin(b.dataset.id, 'free'); }));
  $('stBack').onclick = closeModal;
}
function showZukan() {
  openModal(`<h2>📖 電源キャラ図鑑</h2><p class="lead">それぞれに得意なこと・苦手なことがあるよ。</p>
    <div class="zukan">${EC.ORDER.map(k => { const p = P[k]; return `<div class="zk">${charaHTML(k, 'big')}<div><h3>${p.chara}<small>${p.n}</small></h3><p>${p.profile}</p>
      <div class="stats"><span>💰 ${p.cost}</span><span>⏱ ${p.turns ? p.turns * B.yearsPerTurn + '年' : 'すぐ'}</span><span>⚡ 最大${p.cap}${k === 'battery' ? `（ためる量${p.store}）` : ''}</span><span>🌏 CO₂ ${p.co2}g/kWh</span><span>📍 ${p.where}</span></div>
      <p><span style="color:#1E8A4C">◎ ${p.good}</span><br><span style="color:#C2322B">△ ${p.bad}</span></p><p class="fact">📚 ${p.fact}</p></div></div>`; }).join('')}</div>
    <p class="lead" style="margin-top:8px">CO₂は建設から廃棄までをふくめた「ライフサイクル」でのおおよその値です。</p>
    <button class="btn" id="zkBack">とじる</button>`);
  $('zkBack').onclick = closeModal;
}
function showAch() {
  const got = EC.ACHIEVEMENTS.filter(a => save.ach[a.id]).length;
  openModal(`<h2>🏆 実績 ${got}/${EC.ACHIEVEMENTS.length}</h2><p class="lead">縛りプレイにも挑戦してみよう！</p>
    <div class="ach-list">${EC.ACHIEVEMENTS.map(a => `<div class="ach ${save.ach[a.id] ? '' : 'no'}"><i>${a.icon}</i><span><b>${a.name}</b><small>${a.d}</small></span></div>`).join('')}</div>
    <button class="btn" id="acBack">とじる</button>`);
  $('acBack').onclick = closeModal;
}
function showHow(cb) {
  openModal(`<h2>町長、ようこそ！</h2><p class="lead">2026年から2050年まで、この町に電気をとどけるのがあなたの仕事。</p>
    <ol class="howto">
      <li>🧱 下のキャラをえらんで、光るマスに発電所を建てよう。場所で建てられるものがちがうよ。</li>
      <li>📡 左上の<b>予報</b>をチェック。くもり？燃料高騰？点検？ 何が起きても大丈夫な町にしよう。</li>
      <li>▶ ボタンで「夏の一日」がスタート。<b>⚠ピンチ予報</b>が出たら、<b>📢節電・🔥フルパワー・🔒温存</b>で乗りきれ！</li>
      <li>🏙️ 停電なし・電気代安め・CO₂少なめの町には人が集まり、使う電気もふえていく。</li>
    </ol>
    <div class="note info">🎯 目標：2030年にCO₂ 46%削減、2050年にほぼゼロ。でも停電はダメ！ 一つの電源だけでは、きっとどこかでつまずくよ。</div>
    <button class="btn red" id="howOk">わかった！</button>`);
  $('howOk').onclick = () => { closeModal(); save.seenIntro = true; writeSave(save); if (typeof cb === 'function') cb(); };
}
function begin(stageId, mode) {
  newGame(stageId, mode);
  $('title').hidden = true; phase = 'build'; sel = null; selTile = null; day = null;
  $('buildDock').hidden = false; $('dayDock').hidden = true; $('forecast').hidden = false; $('forecast').classList.remove('collapsed');
  R.resize(); R.fit(); renderAll();
  if (!save.seenIntro) showHow();
  else toast(`${S.stage.name}${mode === 'daily' ? '（今日のステージ）' : ''}の町長に就任！`);
}
function showMenu() {
  if (phase === 'title') return;
  openModal(`<h2>メニュー</h2><div class="menu" style="width:100%">
    <button class="btn green" id="mZukan">📖 図鑑</button><button class="btn ghost" id="mHow">❓ 遊び方</button>
    <button class="btn ghost" id="mClose">ゲームにもどる</button><button class="btn red" id="mTitle">タイトルへ（この町はおわり）</button></div>`);
  $('mZukan').onclick = showZukan; $('mHow').onclick = showHow; $('mClose').onclick = closeModal;
  $('mTitle').onclick = () => { closeModal(); day = null; showTitle(); };
}

/* ---------- メインループ ---------- */
function nightAmt(hF, se) {
  const dawn = clamp((hF - (se.sunStart - 0.5)) / 2, 0, 1), dusk = clamp(((se.sunEnd + 0.5) - hF) / 2, 0, 1);
  return 1 - Math.min(dawn, dusk);
}
function frame(now) {
  const dt = Math.min(100, now - lastT); lastT = now;
  if (S && phase !== 'title') {
    let hF = 12, plant = {}, bubbles = [], weather = null, dark = new Set();
    if (day && (phase === 'day' || phase === 'banner')) {
      if (phase === 'day' && day.run.h < 24 && $('scrim').hidden) {
        day.acc += dt * day.speed * (day.slow > 0 ? 0.45 : 1);
        while (day.acc >= B.hourMs && day.run.h < 24) { day.acc -= B.hourMs; stepHour(false); }
        if (day.run.h >= 24) { endDay(); }
      }
      if (day) {
        hF = phase === 'banner' ? 0 : Math.min(24, day.run.h + day.acc / B.hourMs);
        const h = Math.min(23, Math.floor(hF)), p = day.run.p, rec = day.lastRec;
        $('clockTime').textContent = String(Math.min(24, Math.floor(hF))).padStart(2, '0') + ':00';
        $('clockIcon').textContent = p.SUN[h] > 0.05 ? '☀️' : '🌙';
        weather = day.ev.weather;
        dark = day.dark;
        day.spin += dt * 0.012 * (p.W[h] || 0) * (p.n.wind ? 1 : 0);
        plant = exprs(rec, p, h);
        const t0 = performance.now();
        Object.keys(day.bubbles).forEach(k => { const pos = plantPos(k) || (k === 'nuclear' || k === 'thermal' ? anyPlantPos(k) : null); if (pos) bubbles.push({ r: pos.r, c: pos.c, text: day.bubbles[k].text, col: P[k].c, a: clamp((t0 - day.bubbles[k].t0) / 200, 0, 1) }); });
      }
    } else {
      plant = { wind: { expr: 'happy', spin: now / 600 }, thermal: { expr: 'normal', on: true }, nuclear: { expr: 'happy', on: true }, solar: { expr: 'happy' }, battery: { expr: 'normal', soc: 0.5 }, hydro: { expr: 'happy' }, geo: { expr: 'happy' } };
    }
    const hl = new Set(), hlBad = new Set();
    if (phase === 'build' && sel && sel !== 'demolish') each((t, r, c) => { if (!canPlace(sel, r, c)) { hl.add(r * N + c); if ((sel === 'geo' && nearOnsen(r, c)) || (sel === 'nuclear' && nearHouses(r, c, 2) > 0)) hlBad.add(r * N + c); } });
    if (phase === 'build' && sel === 'demolish') each((t, r, c) => { if (t.b && t.b.kind === 'plant') hlBad.add(r * N + c); });
    R.draw({ tiles: S.tiles, time: now, night: day ? nightAmt(hF, day.run.p.season) : 0, dark, hl, hlBad, sel: selTile, plant, bubbles, weather, season: S.stage.season });
  }
  requestAnimationFrame(frame);
}
function anyPlantPos(type) { let p = null; each((t, r, c) => { if (!p && t.b && t.b.kind === 'plant' && t.b.type === type) p = { r, c }; }); return p; }
function exprs(rec, p, h) {
  const o = {}, ev = day.ev, c = day.run.ctrl;
  if (!rec) { EC.ORDER.forEach(k => (o[k] = { expr: 'normal', on: true, soc: 0.3 })); o.wind.spin = day.spin; return o; }
  o.solar = { expr: p.SUN[h] <= 0 ? 'sleep' : rec.curt > 0.5 ? 'sweat' : p.SUN[h] < 0.3 ? 'sad' : 'happy' };
  o.wind = { expr: ev.id === 'typhoon' ? 'dizzy' : p.W[h] < 0.15 ? 'sad' : p.W[h] > 0.6 ? 'happy' : 'normal', spin: day.spin };
  o.thermal = { expr: ev.id === 'trip' && !p.n.thermal ? 'dizzy' : rec.ramp || rec.g.thermal >= p.n.thermal * P.thermal.cap * 0.95 && rec.g.thermal > 0 ? 'sweat' : rec.g.thermal > 0 ? 'normal' : 'sleep', on: rec.g.thermal > 0, boost: c.boost > 0 };
  o.nuclear = { expr: ev.id === 'inspect' ? 'sleep' : rec.nukeCurt > 0.1 ? 'sweat' : 'happy', on: ev.id !== 'inspect' };
  o.battery = { expr: rec.soc < 0.03 && rec.short > 0 ? 'sad' : rec.g.battery > 0 ? 'happy' : 'normal', soc: rec.soc, hold: c.hold };
  o.hydro = { expr: 'happy' }; o.geo = { expr: 'happy' };
  if (rec.short > 0.05) Object.keys(o).forEach(k => { if (o[k].expr === 'happy') o[k].expr = 'sweat'; });
  return o;
}

/* ---------- 起動 ---------- */
function init() {
  R.init($('map'));
  setupInput();
  $('next').onclick = startDay;
  $('actSave').onclick = () => doAction('save');
  $('actBoost').onclick = () => doAction('boost');
  $('actHold').onclick = () => doAction('hold');
  document.querySelectorAll('.speed button').forEach(b => (b.onclick = () => setSpeed(b.dataset.speed)));
  $('btnSound').textContent = save.sound ? '🔊' : '🔇';
  $('btnSound').onclick = () => { save.sound = !save.sound; writeSave(save); $('btnSound').textContent = save.sound ? '🔊' : '🔇'; };
  $('btnMenu').onclick = showMenu;
  $('scrim').addEventListener('click', e => { if (e.target === $('scrim') && phase !== 'report' && phase !== 'day') closeModal(); });
  showTitle();
  requestAnimationFrame(frame);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
