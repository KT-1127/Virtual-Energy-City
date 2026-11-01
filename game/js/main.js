/* エネルギーシティ ― ゲームの流れ・画面・操作
   文字はできるだけ少なく：アイコン・色・キャラの表情・チャッピーのひとことで伝える */
(function () {
const EC = window.EC, C = EC.CFG, P = C.plants, N = C.map.length, AU = EC.Audio;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = n => Math.round(n).toLocaleString('ja-JP');
const snd = name => AU.sfx(name);

/* ---------- 保存 ---------- */
const KEY = 'ecity3';
const store = Object.assign({ best: null, tutDone: false, bgm: true, sfx: true, daily: null }, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })());
const saveStore = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
AU.setBgm(store.bgm); AU.setSfx(store.sfx);

/* ---------- 状態 ---------- */
let S = null, world = null, phase = 'title', mode = 'free';
let paused = false, speedIdx = 0, sel = null, focus = null, delArm = null;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const view = { S: null, hour: 10, dark: new Set(), moods: new Map(), soc: 0, wind: 0.4, sun: 1, weather: 'sunny', earth: 30, chappy: 'normal', fuelHigh: false, charging: false, batFlow: false, worried: null, onsenAngry: null };
let order = [], orderVer = -1, townList = [], chappyT = 0, chappyMood = 'normal';
let seen = {}, bubbles = [], voices = [], newTypes = new Set(), pendingNew = [], hlT = 0, lastCoinFx = 0, audioT = 0;
const tutor = { on: false, i: 0, step: null, run: 0, pred: null };
const stg = { on: false, i: 0, def: null, running: false, days: 0 };
const mir = { on: false, hist: [], last: null, talks: [] };   // 🗺️ おまけ「町の地図で 2050年へ」
const icons = {};
let lastT = performance.now();
const DY = { solar: 34, wind: 96, thermal: 44, hydro: 46, geo: 30, nuclear: 50, battery: 38 };
const REASON = { money: '🪙 お金が たりない', occupied: '🚫 もう 建っている', locked: '🔒 まだ 使えない' };
const PLACE = { plain: '🌱平地', coast: '🌊海ぞい', mountain: '⛰️山', upriver: '🏞️山の近くの川' };
const EVI = { fuel: '💸', trip: '💥', quake: '🫨', inspect: '🔧', retire: '👴', cheap: '🏷️', unlock: '🆕' };
const BAD_EV = ['fuel', 'trip', 'quake', 'inspect', 'retire'];
const hasLive = k => S.plants.some(p => p.type === k && !p.left);

/* ---------- はじめ ---------- */
function init() {
  world = EC.World($('view'), { onTap, onHover: t => { if (world) world.setHover(phase === 'play' && sel ? t : null); } });
  if (!world) return;
  S = titleTown();
  world.init(S);
  bindUI();
  showTitle();
  requestAnimationFrame(frame);
}
function titleTown() { const t = EC.newGame('title'); t.hour = 10.5; EC.tick(t, 0.01, []); return t; }

/* ---------- メインループ ---------- */
function running() {
  if (phase !== 'play' || !$('modalBack').hidden) return false;
  if (mir.on) return false;   // おまけは ターンで すすむ（時間は 止めておく）
  if (tutor.on) return tutor.run > 0;
  if (stg.on) return stg.running;
  return !paused;
}
const speedNow = () => tutor.on ? tutor.run : stg.on ? 3 : C.speeds[speedIdx] * (sel ? C.slowmo : 1);
function frame(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (S && world) {
    if (running()) {
      let hours = dt / C.hourSec * speedNow();
      const ev = [];
      while (hours > 1e-6 && !S.over) {
        const h = Math.min(0.05, hours); EC.tick(S, h, ev); hours -= h;
        if (tutor.on && tutCheck()) break;
      }
      if (ev.length) handle(ev);
    }
    if (phase === 'title') world.spin(dt);
    buildView(dt);
    world.sync(S, phase !== 'title');
    world.update(dt, view);
    if (phase !== 'title') { hud(); tube(); labels(); popLive(); coachTick(dt); spotTick(); }
    if (sel && (hlT -= dt) <= 0) { hlT = 0.6; highlight(sel); }
    if (pendingNew.length && $('modalBack').hidden && phase === 'play' && !tutor.on) showNew(pendingNew.shift());
    if ((audioT -= dt) <= 0) { audioT = 0.4; audioTick(); }
    AU.tick();
  }
  requestAnimationFrame(frame);
}
function audioTick() {
  if (phase === 'title') { AU.setMood('title'); AU.setTension(0); AU.setWeather(0, 0.25); return; }
  const n = S.now, w = S.today ? S.today.weather : 'sunny';
  AU.setMood(S.hour > 5.6 && S.hour < 18.6 ? 'day' : 'night');
  AU.setTension(n && n.sf > 0.02 && phase === 'play' ? Math.min(1, 0.4 + n.sf * 3) : 0);
  AU.setWeather(w === 'rain' ? 0.8 : w === 'typhoon' ? 1 : 0, n ? Math.min(1, n.wind) : 0.3);
}

function buildView(dt) {
  const n = S.now;
  Object.assign(view, { S, hour: S.hour, weather: S.today ? S.today.weather : 'sunny', earth: S.earth, wind: n ? n.wind : 0.35, sun: n ? n.sun : 1,
    soc: n ? n.soc : 0, fuelHigh: !!(S.fx && S.fx.fuel > 1), charging: !!(n && n.charge > 0.1), batFlow: !!(n && (n.charge > 0.1 || n.g.battery > 0.1)),
    worried: phase === 'title' ? null : S.worried, onsenAngry: phase === 'title' ? null : S.onsenAngry });
  if (S.townVer !== orderVer) {
    order = EC.townOrder(S); orderVer = S.townVer;
    townList = []; S.tiles.forEach((row, r) => row.forEach((t, c) => { if (t.b && (t.b.kind === 'house' || t.b.kind === 'factory')) townList.push({ id: t.b.id, r, c }); }));
  }
  view.dark.clear();
  if (n && n.sf > 0.02 && phase === 'play') { const k = Math.ceil(n.sf * order.length); for (let i = 0; i < k; i++) view.dark.add(order[i]); }
  view.moods.clear(); S.plants.forEach(p => view.moods.set(p.id, moodOf(p)));
  chappyT -= dt; if (chappyT <= 0) chappyMood = n && n.sf > 0.02 && phase === 'play' ? 'ouch' : phase === 'title' ? 'wave' : 'normal';
  view.chappy = chappyMood;
}
function moodOf(p) {
  const n = S.now; if (!n || p.left) return 'normal';
  const out = p.out / P[p.type].cap;
  let m;
  switch (p.type) {
    case 'solar': m = n.sun < 0.03 ? 'sleep' : p.waste ? 'sweat' : p.shade < 0.6 ? 'sad' : out > 0.5 ? 'happy' : 'normal'; break;
    case 'wind': m = p.cut ? 'ouch' : n.wind < 0.12 ? 'sad' : n.wind > 0.6 ? 'happy' : 'normal'; break;
    case 'thermal': m = p.off ? 'ouch' : p.mode === 'rest' ? 'sleep' : S.broke ? 'sad' : out > 0.92 ? 'sweat' : 'normal'; break;
    case 'nuclear': m = p.off ? 'sleep' : p.waste ? 'sweat' : 'happy'; break;
    case 'battery': m = (n.g.battery > 0.1 || n.charge > 0.1) ? 'happy' : (n.soc < 0.03 && n.short > 0) ? 'sad' : 'normal'; break;
    case 'geo': m = S.onsenAngry.size ? 'normal' : 'happy'; break;
    default: m = 'happy';
  }
  if (n.sf > 0.02 && m === 'happy') m = 'sweat';
  return m;
}

/* ---------- できごと ---------- */
function handle(ev) {
  for (const e of ev) {
    switch (e.k) {
      case 'coin': coinFx(); break;
      case 'blackStart':
        snd('black'); world.shake(0.3); chappyMood = 'ouch'; chappyT = 1.5;
        if (!seen.blackout) coach('blackout', { once: true, mood: 'ouch' });
        else if ((S.hour >= 19 || S.hour < 5) && hasLive('solar')) coach('night', { once: true, mood: 'ouch' });
        voice('dark');
        break;
      case 'blackEnd': snd('restore'); break;
      case 'hour': onHour(e.h); break;
      case 'warm': snd('ready'); world.burst(e.p.r, e.p.c, 'spark', 34); coach('warmDone', { once: true }); break;
      case 'dayEnd': if (stg.on) stageDayEnd(); else onDayEnd(e.sum); break;
      case 'goal2030':
        banner([{ icon: '🎯', text: e.ok ? `2030年目標 たっせい！ +${C.bonus2030}🪙` : '2030年目標 まだ…', cls: e.ok ? 'good' : 'bad' }]);
        coach(e.ok ? 'goalOk' : 'goalNg', { mood: e.ok ? 'happy' : 'normal' }); snd(e.ok ? 'fanfare' : 'wrong');
        break;
      case 'houseAdd': snd('house'); break;
      case 'houseLeave': world.burst(e.b.r, e.b.c, 'poof'); snd('leave'); break;
      case 'factoryAdd': banner([{ icon: '🏭', text: '工場が来た！ 昼に電気を たくさん使う' }]); snd('good'); break;
      case 'built': world.burst(e.p.r, e.p.c, 'spark', 30); snd('built'); toast(`✨ ${P[e.p.type].chara}（${P[e.p.type].name}）完成！`); break;
      case 'retired': world.burst(e.p.r, e.p.c, 'poof'); break;
      case 'noLand': coach('noLand', { once: true }); break;
      case 'newDay': onNewDay(e.today); break;
      case 'unlock': if (!tutor.on) e.types.forEach(t => { newTypes.add(t); pendingNew.push(t); }); break;
      case 'over': endGame(); break;
    }
  }
}
function onHour(h) {
  pickBubbles();
  if (h === 6) snd('dawn');
  if (h % 3 === 0) voice();
  const n = S.now; if (!n || tutor.on) return;
  if (h === 17 && hasLive('solar')) coach('dusk', { once: true });
  if (n.sun > 0.3 && S.plants.some(p => p.type === 'solar' && !p.left && p.shade < 0.5)) coach('cloud', { once: true });
  if (n.curt > 0.5) {
    if (n.thMin > 0.5 && S.plants.some(p => p.type === 'thermal' && !p.left && !p.off && p.mode !== 'rest')) coach('restHint', { once: true });
    else coach('waste', { once: true });
    if (S.unlocked.has('battery') && !hasLive('battery')) coach('wasteBat', { once: true });
  }
  if ((h === 15 || h === 16) && S.plants.some(p => p.type === 'thermal' && p.mode === 'rest')) coach('wakeHint', { once: true });
  if (S.earth >= 50) coach('earth50', { once: true });
  if (S.earth >= 80) coach('earth80', { once: true, mood: 'ouch' });
  if (S.broke) coach('broke', { once: true, mood: 'ouch' });
  $('btnSave').classList.toggle('hot', n.sf > 0.02 && !S.save.used);
}
function onNewDay(td) {
  const w = C.weather[td.weather], items = [{ icon: w.icon, text: `${S.year}年 ${w.name}`, cls: '' }];
  td.events.forEach(k => { if (k !== 'unlock') items.push({ icon: EVI[k], text: C.events[k].name, cls: BAD_EV.includes(k) ? 'bad' : 'good' }); });
  banner(items);
  if (td.events.some(k => BAD_EV.includes(k)) || td.weather === 'typhoon') snd('alert');
  if (!tutor.on) {
    const once = { once: true };
    if (td.events.includes('fuel') && hasLive('thermal')) coach('fuel', once);
    if (td.events.includes('inspect')) coach('inspect', once);
    if (td.events.includes('trip')) coach('trip', once);
    if (td.events.includes('quake')) coach('quake', { once: true, mood: 'ouch' });
    if (td.weather === 'typhoon' && hasLive('wind')) coach('typhoon', once);
    if (td.weather === 'calm' && hasLive('wind')) coach('calm', once);
    if (S.forecast.events.includes('retire')) coach('retire', once);
    if (EC.predictWorthy(S)) setTimeout(() => { if (phase === 'play' && $('modalBack').hidden) askPredict(false); }, 1300);
  }
  pickBubbles();
}
function onDayEnd(s) {
  dayCard(s);
  if (s.pred) { snd(s.pred.ok ? 'right' : 'wrong'); coach(s.pred.ok ? 'predOk' : 'predNg', { mood: s.pred.ok ? 'happy' : 'normal' }); }
  if (s.bonus) {
    snd('mix'); banner([{ icon: '🌈', text: `ミックス！ ${s.kinds.length}種類で のりきった +${s.bonus}🪙`, cls: 'good' }]);
    coach('mix', { once: true, mood: 'happy' }); chappyMood = 'jump'; chappyT = 2.5;
    world.burst(C.hall[0], C.hall[1], 'spark', 40); world.hearts();
  } else { if (!s.pred) snd('dayEnd'); if (!s.bh) { chappyMood = 'happy'; chappyT = 2; } }
}

/* ---------- キャラのひとこと ---------- */
function pickBubbles() {
  const n = S.now, L = EC.LINES, cand = [], first = {};
  if (!n) { bubbles = []; return; }
  S.plants.forEach(p => { if (!p.left && !first[p.type]) first[p.type] = p; });
  const add = (p, text, pr) => { if (p) cand.push({ p, text, pr }); };
  const h = Math.floor(S.hour);
  if (first.solar) {
    const p = first.solar;
    if (n.sun < 0.03) add(p, h >= 17 && h <= 20 ? L.solar.dusk : L.solar.sleep, h >= 17 && h <= 20 ? 3 : 1);
    else if (p.waste) add(p, L.solar.waste, 3); else if (p.shade < 0.6) add(p, L.solar.shade, 2.5); else if (n.sun > 0.7) add(p, L.solar.sun, 1);
  }
  if (first.wind) { const p = first.wind; if (p.cut) add(p, L.wind.stop, 3); else if (n.wind < 0.12) add(p, L.wind.weak, 2); else if ((h >= 19 || h < 5) && n.wind > 0.35) add(p, L.wind.night, 2); else if (n.wind > 0.6) add(p, L.wind.strong, 1); }
  const tripped = S.plants.find(p => p.type === 'thermal' && p.off);
  if (tripped) add(tripped, L.thermal.trip, 3);
  const resting = S.plants.find(p => p.type === 'thermal' && !p.left && !p.off && p.mode === 'rest');
  if (resting) add(resting, L.thermal.rest, 1.5);
  const warming = S.plants.find(p => p.type === 'thermal' && p.mode !== 'rest' && p.warm < 1);
  if (warming) add(warming, L.thermal.warm, 2.6);
  const th = S.plants.find(p => p.type === 'thermal' && !p.left && !p.off && p.mode !== 'rest' && p.warm >= 1);
  if (th) { const o = th.out / P.thermal.cap; if (S.broke) add(th, L.thermal.broke, 4); else if (S.fx.fuel > 1 && o > 0.05) add(th, L.thermal.fuel, 2.5); else if (o > 0.92) add(th, L.thermal.full, 2); else if (n.curt > 0.5 && n.thMin > 0.5) add(th, L.thermal.min, 2.8); else if (o > 0.35) add(th, L.thermal.work, 0.5); }
  const nk = S.plants.find(p => p.type === 'nuclear' && !p.left);
  if (nk) add(nk, nk.off ? L.nuclear.inspect : nk.waste ? L.nuclear.waste : L.nuclear.work, nk.off ? 3 : nk.waste ? 2.5 : 0.3);
  if (first.battery) { const p = first.battery; if (n.soc < 0.03 && n.short > 0) add(p, L.battery.empty, 4); else if (n.g.battery > 0.1) add(p, L.battery.out, 3); else if (n.soc > 0.97) add(p, L.battery.full, 1); else if (n.charge > 0.1) add(p, L.battery.charge, 2); }
  if (first.hydro) add(first.hydro, L.hydro.work, 0.1);
  if (first.geo) add(first.geo, S.onsenAngry.size ? L.geoOnsen : L.geo.work, S.onsenAngry.size ? 1.5 : 0.1);
  cand.sort((a, b) => b.pr - a.pr);
  const t0 = performance.now();
  bubbles = cand.slice(0, 2).map(c => Object.assign(c, { t0 }));
}

/* ---------- 町の人の声（いろんな立場がある） ---------- */
function voice(force) {
  if (phase !== 'play' || !townList.length) return;
  const cand = [], V = EC.VOICES, n = S.now, last = S.hist[S.hist.length - 1];
  const push = (key, w, id) => cand.push({ key, w, id });
  if (n && n.sf > 0.02) push('dark', 6, order[0]);
  if (force !== 'dark') {
    S.worried.forEach((type, id) => push(type === 'thermal' ? 'smoke' : type === 'wind' ? 'noise' : 'nuke', 3, id));
    if (S.onsenAngry.size) push('onsen', 3);
    if (S.fx.fuel > 1 && n && n.g.thermal > n.D * 0.3) push('price', 3);
    if (S.earth >= 60) push('hot', 2.5);
    const solarN = S.plants.filter(p => p.type === 'solar').length;
    if (solarN >= 10) push('panels', 2); else if (solarN) push('likeSun', 1);
    if (hasLive('wind')) push('likeWind', 0.8);
    if (last && !last.bh) push('stable', 1.2);
    if (last && last.ratio < 0.5) push('clean', 1.4);
    if (last && last.kinds.length >= 4) push('mix', 1.4);
  }
  if (!cand.length) return;
  let x = Math.random() * cand.reduce((a, c) => a + c.w, 0), pick = cand[0];
  for (const c of cand) { x -= c.w; if (x <= 0) { pick = c; break; } }
  const list = V[pick.key];
  let pos = pick.id ? townList.find(t => t.id === pick.id) : null;
  if (!pos && pick.key === 'onsen') { const tid = [...S.onsenAngry][0]; pos = { r: Math.floor(tid / N), c: tid % N }; }
  if (!pos) pos = townList[Math.floor(Math.random() * townList.length)];
  voices.push({ text: list[Math.floor(Math.random() * list.length)], av: EC.AVATARS[Math.floor(Math.random() * EC.AVATARS.length)], r: pos.r, c: pos.c, t0: performance.now(),
    bad: ['dark', 'smoke', 'noise', 'nuke', 'onsen', 'price', 'hot', 'panels'].includes(pick.key) });
  if (voices.length > 2) voices.shift();
}

/* ---------- 上のバー ---------- */
let lastMoney = -1, fcKey = '';
function hud() {
  $('year').textContent = mir.animYear || S.year;   // ⏩ 季節の アニメ中は その年
  const h = Math.floor(S.hour), m = Math.floor((S.hour - h) * 6) * 10;
  $('clock').textContent = `${h}:${String(m).padStart(2, '0')}`;
  drawDial();
  const money = Math.floor(S.money);
  if (money !== lastMoney) {
    const el = $('money').parentElement;
    if (money > lastMoney && lastMoney >= 0 && money - lastMoney < 30) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    $('money').textContent = fmt(money); lastMoney = money;
  }
  $('score').textContent = fmt(S.score);
  $('hpBar').style.width = S.hp + '%';
  $('hpChip').classList.toggle('hurt', !!(S.now && S.now.sf > 0.02));
  $('earthBar').style.width = S.earth + '%';
  $('earthFace').textContent = S.earth >= 85 ? '🥵' : S.earth >= 60 ? '😓' : '🌏';
  $('earthChip').classList.toggle('hot', S.earth >= 60);
  const f = S.forecast, key = f.year + f.weather + f.events.join();
  if (key !== fcKey) {
    fcKey = key;
    $('forecast').innerHTML = `<small>あした</small>${C.weather[f.weather].icon}${f.events.map(k => EVI[k]).join('')}`;
    $('forecast').classList.toggle('alert', f.events.some(k => BAD_EV.includes(k)) || f.weather === 'typhoon' || f.weather === 'calm');
  }
  $('btnSave').disabled = S.save.used || phase !== 'play';
  renderCards();
}
function drawDial() {
  const cv = $('dial'), r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
  if (!r.width) return;
  if (cv.width !== Math.round(r.width * d)) { cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); }
  const g = cv.getContext('2d'), w = r.width, R = w / 2 - 1, cx = w / 2, cy = w / 2;
  g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, w);
  const A = h => h / 24 * Math.PI * 2 - Math.PI / 2;
  g.fillStyle = '#26345E'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
  g.fillStyle = '#BFE3FF'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, A(C.sun.rise), A(C.sun.set)); g.closePath(); g.fill();
  g.strokeStyle = '#FFFFFF'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R - 1, 0, 7); g.stroke();
  const a = A(S.hour);
  g.strokeStyle = '#1E2A38'; g.lineWidth = 2.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (R - 3), cy + Math.sin(a) * (R - 3)); g.stroke();
  g.fillStyle = EC.sunAt(S.hour) > 0 ? '#FFC21A' : '#FFF4C8'; g.beginPath(); g.arc(cx + Math.cos(a) * (R - 5), cy + Math.sin(a) * (R - 5), 4.5, 0, 7); g.fill();
}

/* ---------- 左の電気メーター（色が線より上なら OK） ---------- */
let tubeMax = 40;
function tube() {
  const cv = $('tube'), r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1), n = S.now;
  if (!r.width) return;
  if (cv.width !== Math.round(r.width * d) || cv.height !== Math.round(r.height * d)) { cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); }
  const g = cv.getContext('2d'), w = r.width, h = r.height;
  g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
  const x0 = 4, x1 = w - 4, y0 = 4, y1 = h - 4;
  g.fillStyle = '#E6EDF5'; rr(g, x0, y0, x1 - x0, y1 - y0, 14); g.fill();
  if (!n) return;
  const sum = C.stack.reduce((a, k) => a + n.g[k], 0);
  const want = Math.max(n.D * 1.3, sum + n.curt + 2, sum + Math.min(n.spare, n.D * 0.5) + 2, 12);
  tubeMax += (want - tubeMax) * (want > tubeMax ? 0.2 : 0.02);
  const sc = (y1 - y0 - 8) / tubeMax;
  g.save(); rr(g, x0, y0, x1 - x0, y1 - y0, 14); g.clip();
  let y = y1;
  const segs = [];
  C.stack.forEach(k => {
    const v = n.g[k]; if (v <= 0.01) return;
    const hh = v * sc;
    const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, shade(P[k].color, 0.25)); gr.addColorStop(0.5, P[k].color); gr.addColorStop(1, shade(P[k].color, -0.12));
    g.fillStyle = gr; g.fillRect(x0, y - hh, x1 - x0, hh);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x0, y - hh, x1 - x0, 1);
    segs.push([k, y - hh / 2, hh]);
    y -= hh;
  });
  const yD = y1 - n.D * sc;
  if (n.spare > 0.3 && n.short <= 0.05) {   // まだ出せる余裕（うすく）
    const hh = Math.min(n.spare, tubeMax) * sc;
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x0, y - hh, x1 - x0, hh);
    g.strokeStyle = 'rgba(30,42,56,.35)'; g.setLineDash([4, 3]); g.lineWidth = 1.5; g.strokeRect(x0 + 3, y - hh, x1 - x0 - 6, hh); g.setLineDash([]);
  }
  if (n.curt > 0.05) { const hh = n.curt * sc; stripes(g, x0, y - hh, x1 - x0, hh, 'rgba(150,160,175,.65)'); y -= hh; }
  if (n.short > 0.05) {
    const blink = 0.55 + 0.35 * Math.sin(performance.now() / 120);
    g.globalAlpha = blink; g.fillStyle = EC.BLACK; g.fillRect(x0, yD, x1 - x0, (y1 - n.D * sc + n.short * sc) - yD); g.globalAlpha = 1;   // 停電＝まっくら（黒）
  }
  // どの色がだれか（キャラの顔）
  segs.forEach(([k, cy, hh]) => { const im = icons[k]; if (im && im.complete && hh >= 16) { const s = Math.min(26, hh - 2, w - 14); g.drawImage(im, (w - s) / 2, cy - s / 2, s, s); } });
  g.restore();
  g.strokeStyle = '#1E2A38'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0 - 2, yD); g.lineTo(x1 + 2, yD); g.stroke();
  g.fillStyle = '#1E2A38'; g.beginPath(); g.moveTo(x1 + 3, yD); g.lineTo(x1 - 4, yD - 5); g.lineTo(x1 - 4, yD + 5); g.fill();
  g.font = '15px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText('🏠', w / 2, yD - 2);
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2; rr(g, x0, y0, x1 - x0, y1 - y0, 14); g.stroke();
  const face = n.sf > 0.02 ? '😱' : n.curt > 1 ? '😅' : n.spare < n.D * 0.12 ? '😬' : '😊';
  const fe = $('meterFace'); if (fe.textContent !== face) fe.textContent = face;
  fe.classList.toggle('bad', n.sf > 0.02);
  $('meterBat').hidden = !S.bCap; if (S.bCap) $('batBar').style.width = Math.round(n.soc * 100) + '%';
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function stripes(g, x, y, w, h, col) {
  if (h <= 0) return;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = col; g.globalAlpha = 0.35; g.fillRect(x, y, w, h); g.globalAlpha = 1;
  g.strokeStyle = col; g.lineWidth = 4;
  for (let i = -h; i < w + h; i += 9) { g.beginPath(); g.moveTo(x + i, y + h); g.lineTo(x + i + h, y); g.stroke(); }
  g.restore();
}
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255; if (f < 0) { r *= 1 + f; gg *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; gg += (255 - gg) * f; b += (255 - b) * f; } return `rgb(${r | 0},${gg | 0},${b | 0})`; }
function loadIcons() { C.order.forEach(k => { if (!icons[k]) { const im = new Image(); im.src = EC.charaIcon(k, 'normal'); icons[k] = im; } }); }

/* ---------- 3D の上のふきだし・札・町の人の声 ---------- */
const lbs = new Map();
function put(key, cls, html, r, c, dy, color) {
  let el = lbs.get(key);
  if (!el) { el = document.createElement('div'); $('labels').appendChild(el); lbs.set(key, el); }
  if (el.className !== cls) el.className = cls;
  if (el._h !== html) { el.innerHTML = html; el._h = html; }
  if (color) el.style.setProperty('--c', color);
  const p = world.screenOf(r, c, dy);
  el.style.display = p.ok ? '' : 'none';
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  return el;
}
function labels() {
  const keep = new Set(), now = performance.now();
  bubbles.forEach((b, i) => {
    if (now - b.t0 > 3800 || b.p.left || !S.plants.includes(b.p)) return;
    const key = 'bub' + i; keep.add(key);
    put(key, 'lb bub', b.text, b.p.r, b.p.c, DY[b.p.type], P[b.p.type].color);
  });
  voices.forEach((v, i) => {
    if (now - v.t0 > 3600) return;
    const key = 'v' + i; keep.add(key);
    put(key, 'lb voice' + (v.bad ? ' bad' : ''), `<i>${v.av}</i>${v.text}`, v.r, v.c, 36);
  });
  S.plants.forEach(p => {
    let key = null, html = '', cls = 'lb tag';
    if (p.left > 0) { key = 's' + p.id; html = `🔨 あと${p.left}年`; }
    else if (p.off) { key = 'o' + p.id; html = p.off === 'inspect' ? '🔧 点検中' : p.off === 'quake' ? '🫨 停止' : '💥 故障'; cls += ' warn'; }
    else if (p.type === 'thermal' && p.mode === 'rest') { key = 'z' + p.id; const soon = S.hour >= 14.5 && S.hour < 19.5; html = soon ? '⏰ 起こして！' : '💤 休み中'; if (soon) cls += ' warn pulse'; }
    else if (p.type === 'thermal' && p.warm < 1) { key = 'w' + p.id; html = `🔥 じゅんび ${Math.round(p.warm * 100)}%`; }
    else if (p.retire && p.retire - S.year <= (mir.on ? 6 : 3)) { key = 'r' + p.id; html = `👴 引退まで${p.retire - S.year}年`; cls += ' warn'; }
    if (!key) return;
    keep.add(key); put(key, cls, html, p.r, p.c, p.left > 0 ? 54 : 6);
  });
  lbs.forEach((el, key) => { if (!keep.has(key)) { el.remove(); lbs.delete(key); } });
}
function coinFx() {
  const now = performance.now();
  if (now - lastCoinFx < 280 || !townList.length) return;
  lastCoinFx = now;
  const lit = townList.filter(t => !view.dark.has(t.id)); if (!lit.length) return;
  const t = lit[Math.floor(Math.random() * lit.length)], p = world.screenOf(t.r, t.c, 30);
  if (!p.ok) return;
  const el = document.createElement('div'); el.className = 'lb coin'; el.textContent = '+🪙';
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  $('labels').appendChild(el); setTimeout(() => el.remove(), 1000);
}

/* ---------- カード ---------- */
let cardSig = '';
function renderCards(force) {
  const w = tutor.on && tutor.step ? tutor.step.wait + '' : '';
  const spotK = /^select:/.test(w) ? w.split(':')[1] : null;
  const sig = mir.on + C.order.map(k => [S.unlocked.has(k), S.money >= EC.cost(S, k), sel === k, newTypes.has(k), EC.cost(S, k), spotK === k].join()).join('|');
  if (!force && sig === cardSig) return;
  cardSig = sig;
  $('cards').innerHTML = C.order.map(k => {
    const p = P[k];
    if (!S.unlocked.has(k) && (stg.on || mir.on)) return '';
    if (mir.on) return `<button class="card ${sel === k ? 'sel' : ''}" data-k="${k}" style="--c:${p.color}"><img src="${EC.charaIcon(k)}" alt="${p.name}"><b>${p.name}</b><small>⏳${C.mirai.lead[k]}年</small></button>`;
    if (!S.unlocked.has(k)) return `<button class="card lock" disabled><div class="q">?</div><b>${p.unlock}年</b><small>&nbsp;</small></button>`;
    const cost = EC.cost(S, k);
    return `<button class="card ${sel === k ? 'sel' : ''} ${S.money < cost ? 'poor' : ''} ${newTypes.has(k) ? 'new' : ''} ${spotK === k ? 'spot' : ''}" data-k="${k}" style="--c:${p.color}">`
      + `<img src="${EC.charaIcon(k)}" alt="${p.name}"><b>${p.name}</b><small>🪙${cost}</small></button>`;
  }).join('');
  $('cards').querySelectorAll('.card[data-k]').forEach(b => { b.onclick = () => select(b.dataset.k); });
}
function select(k) {
  if (phase !== 'play' || stg.running) return;
  if (tutor.on) { const w = tutor.step.wait + ''; if (!/^(select|build):/.test(w) || w.split(':')[1] !== k) { if (sel !== k) { snd('bad'); return; } } }
  snd('pick');
  sel = sel === k ? null : k; focus = null; delArm = null; newTypes.delete(k);
  if (sel) { showCardPop(sel); highlight(sel); hlT = 0.6; tutEvent('select', k); }
  else {
    hidePop(); world.setHighlight([], []); world.setHover(null);
    if (tutor.on && /^build:/.test(tutor.step.wait)) tutGo(tutor.i - 1);
  }
  renderCards(true);
}
function highlight(k) {
  const ok = [], warn = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const why = EC.canPlace(S, k, r, c);
    if (!why || why === 'money') ((mir.on ? EC.Mirai.warn : EC.placeWarn)(S, k, r, c) ? warn : ok).push([r, c]);
  }
  world.setHighlight(ok, warn);
}
function bestTile(k) {
  let best = null, bd = 1e9;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (EC.canPlace(S, k, r, c) || EC.placeWarn(S, k, r, c)) continue;
    const d = Math.hypot(r - C.hall[0], c - C.hall[1]); if (d < bd) { bd = d; best = { r, c }; }
  }
  return best;
}
const placeText = k => P[k].where.map(w => PLACE[w]).join('・');
const co2Text = k => P[k].co2 >= 300 ? '🌫️🌫️🌫️ CO₂多い' : P[k].co2 >= 30 ? '🌫️ CO₂少し' : '🍃 CO₂ほぼ0';
// ⚡ 大きさ：メーターの「使う 量」と 同じ ものさしで、晴れの 昼と 夜に 出せる 量
const outOf = k => k === 'solar' ? [P.solar.cap * C.solarPeak, 0] : k === 'wind' ? [P.wind.cap * C.windBase, P.wind.cap * C.windBase] : k === 'hydro' ? [P.hydro.cap * C.hydroCF, P.hydro.cap * C.hydroCF] : [P[k].cap, P[k].cap];
function iconsOf(k) {
  const p = P[k];
  if (mir.on) { const o = outOf(k).map(Math.round); return `<span>⏳ 使えるまで ${C.mirai.lead[k]}年</span><span>👴 使える ${C.mirai.life[k]}年</span><span>${k === 'battery' ? `⚡ 出す 力 ${o[0]}（ためた 分）` : `⚡ 昼 ${o[0]}・夜 ${o[1]}`}</span><span>📍${placeText(k)}</span><span>${co2Text(k)}</span><span>🏗️ 🪙${p.cost}</span>`; }
  return `<span>🪙${EC.cost(S || { cost: {} }, k)}</span><span>⏱${p.build ? p.build + '年' : 'すぐ'}</span><span>📍${placeText(k)}</span><span>${co2Text(k)}</span>`;
}
function showCardPop(k) {
  const p = P[k], el = $('pop');
  el.style.setProperty('--c', p.color);
  el.innerHTML = `<img class="big" src="${EC.charaIcon(k, 'happy')}" alt=""><div class="txt"><h3>${p.chara}<small>${p.name}</small></h3><span class="tagline">${p.tag}</span>`
    + `<div class="icons">${iconsOf(k)}<span class="real" data-real="${k}">📏 ほんとうの 大きさ</span></div><canvas class="shape"></canvas></div><button class="x" id="popX">✕</button>`;
  el.hidden = false;
  drawShape(el.querySelector('canvas'), k);
  $('popX').onclick = () => select(k);
}
function showPlantPop(b) {
  const p = P[b.type], el = $('pop');
  el.style.setProperty('--c', p.color);
  const tw = tutor.on ? tutor.step.wait : '';
  const toggle = b.type === 'thermal' && !b.left && !mir.on ? `<button class="btn-toggle ${(tw === 'rest' || tw === 'wake') ? 'tutpulse' : ''}" id="popMode"></button>` : '';
  el.innerHTML = `<img class="big" src="${EC.charaIcon(b.type, view.moods.get(b.id) || 'normal')}" alt=""><div class="txt"><h3>${p.chara}<small>${p.name}</small></h3><span class="tagline">${p.tag}</span>`
    + `<div class="icons" id="popState"></div><div class="live"><em id="popLive"></em></div>`
    + `<div class="pop-btns">${toggle}<button class="btn-del" id="popDel">${mir.on ? '👋 はやめに 引退させる' : '🚜 こわす'}</button></div></div><button class="x" id="popX">✕</button>`;
  el.hidden = false;
  $('popX').onclick = () => { focus = null; hidePop(); };
  if ($('popMode')) $('popMode').onclick = () => toggleThermal(b);
  $('popDel').onclick = () => {
    if (tutor.on) { snd('bad'); return; }
    if (delArm !== b) { delArm = b; $('popDel').textContent = '🚜 もう一度で こわす（お金はもどらない）'; return; }
    EC.demolish(S, b.r, b.c); world.burst(b.r, b.c, 'poof'); snd('bad'); focus = null; delArm = null; hidePop();
    if (mir.on) miraiPanel();
  };
  popLive();
}
function toggleThermal(b) {
  if (b.off) { toast('💥 いまは 止まっている'); return; }
  if (b.mode === 'rest') { EC.setMode(S, b, 'on'); snd('wake'); world.burst(b.r, b.c, 'spark', 30); tutEvent('wake'); }
  else { EC.setMode(S, b, 'rest'); snd('rest'); tutEvent('rest'); }
  pickBubbles(); popLive();
}
function popLive() {
  if (!focus) return;
  if (!S.plants.includes(focus)) { focus = null; hidePop(); return; }
  const b = focus, p = P[b.type], st = $('popState'), live = $('popLive');
  if (!st) return;
  const pct = Math.round(b.out / p.cap * 100);
  let txt = b.left > 0 ? `🔨 完成まで あと${b.left}年` : mir.on ? '✅ 発電できる' : b.off ? (b.off === 'inspect' ? '🔧 点検中' : '💥 止まっている') : b.type === 'battery' ? `🔋 ${Math.round((S.now ? S.now.soc : 0) * 100)}%` : `⚡ ${pct}%`;
  if (b.type === 'thermal' && b.mode === 'rest') txt = '💤 休み中（燃料 0）';
  else if (b.type === 'thermal' && b.warm < 1 && !b.off) txt = `🔥 じゅんび中 ${Math.round(b.warm * 100)}%`;
  const extra = b.retire ? `<span>👴 ${b.retire}年に引退</span>` : '';
  if (mir.on) live.style.width = '0%';
  const html = `<span>${txt}</span>${extra}`;
  if (st._h !== html) { st.innerHTML = html; st._h = html; }
  if (!mir.on) live.style.width = (b.type === 'battery' ? (S.now ? S.now.soc : 0) * 100 : pct) + '%';
  const mb = $('popMode');
  if (mb) { const t = b.mode === 'rest' ? '🔥 起こす' : '😴 休ませる'; if (mb.textContent !== t) mb.textContent = t; mb.classList.toggle('wake', b.mode === 'rest'); }
}
function hidePop() { $('pop').hidden = true; }

/* ---------- 24時間の形（いつ発電する？） ---------- */
function drawShape(cv, k) {
  const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
  const g = cv.getContext('2d'), w = r.width, h = r.height, col = P[k].color;
  g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
  const X = t => 4 + t / 24 * (w - 8);
  g.fillStyle = 'rgba(38,52,94,.12)'; g.fillRect(X(0), 0, X(C.sun.rise) - X(0), h); g.fillRect(X(C.sun.set), 0, X(24) - X(C.sun.set), h);
  g.font = '12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
  g.fillText('🌙', X(2.5), 2); g.fillText('☀️', X(12), 2); g.fillText('🌙', X(21.5), 2);
  const base = k === 'battery' ? h * 0.62 : h - 3, amp = k === 'battery' ? h * 0.3 : h - 18;
  const v = t => {
    switch (k) {
      case 'solar': return EC.sunAt(t);
      case 'wind': return clamp(0.42 + 0.24 * Math.sin(t / 2.1) + 0.14 * Math.sin(t * 1.7 + 1) + 0.08 * Math.sin(t * 4.3), 0.05, 1);
      case 'thermal': return 0.25 + 0.6 * C.demandShape[Math.floor(t) % 24];
      case 'hydro': return 0.55; case 'geo': return 0.45; case 'nuclear': return 0.95;
      case 'battery': return t > 9 && t < 15 ? -0.8 : t > 17 && t < 22 ? 0.9 : 0;
    }
    return 0;
  };
  g.beginPath(); g.moveTo(X(0), base);
  for (let i = 0; i <= 96; i++) { const t = i / 4; g.lineTo(X(t), base - v(t) * amp); }
  g.lineTo(X(24), base); g.closePath();
  g.fillStyle = col; g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1;
  if (k === 'thermal') { g.font = '900 16px sans-serif'; g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText('↕', X(12), base - amp * 0.35); }
  if (k === 'battery') { g.strokeStyle = '#1E2A38'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(0), base); g.lineTo(X(24), base); g.stroke(); g.font = '900 11px sans-serif'; g.fillStyle = '#1E2A38'; g.textBaseline = 'middle'; g.fillText('ためる', X(12), base + amp * 0.45); g.fillText('出す', X(19.5), base - amp * 0.55); }
}

/* ---------- 地図をタップ ---------- */
function onTap(t) {
  if (phase !== 'play') return;
  if (sel) {
    if (!t) { select(sel); return; }
    const why = EC.canPlace(S, sel, t.r, t.c);
    if (why) { snd('bad'); toast(why === 'where' ? `📍 ${placeText(sel)} に置こう` : REASON[why]); return; }
    if (mir.on) { const v = EC.Mirai.warn(S, sel, t.r, t.c); if (v) miraiVoice(sel, t, v); else miraiPlace(sel, t, false); return; }
    const warn = EC.placeWarn(S, sel, t.r, t.c), k = sel, cost = EC.cost(S, k);
    EC.build(S, k, t.r, t.c);
    snd('place'); world.sync(S, true); world.burst(t.r, t.c, 'spark', 20);
    floatText(t.r, t.c, `-${cost}🪙`);
    if (warn) coach(warn, { once: true, mood: 'ouch' });
    sel = null; hidePop(); world.setHighlight([], []); world.setHover(null);
    renderCards(true);
    tutEvent('build', k);
    return;
  }
  if (!t) return;
  const b = S.tiles[t.r][t.c].b;
  if (b && b.kind === 'plant') { focus = b; delArm = null; showPlantPop(b); snd('tap'); }
  else { focus = null; hidePop(); }
}
function floatText(r, c, text) {
  const p = world.screenOf(r, c, 30); if (!p.ok) return;
  const el = document.createElement('div'); el.className = 'lb coin'; el.style.color = '#E8604C'; el.textContent = text;
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  $('labels').appendChild(el); setTimeout(() => el.remove(), 1000);
}

/* ---------- チャッピーのコーチ ---------- */
const coachQ = []; let coachCur = null, coachT = 0;
function coach(key, o) {
  o = o || {};
  if (tutor.on || stg.on) return;    // チュートリアル・ステージ中は台本だけ
  if (o.once && seen[key]) return;
  seen[key] = 1;
  const lines = EC.COACH[key]; if (!lines) return;
  coachQ.push({ lines, mood: o.mood || 'normal' });
  if (coachQ.length > 3) coachQ.splice(0, coachQ.length - 3);
  if (!coachCur) nextCoach(); else coachT = Math.min(coachT, 1);   // いまのひとことを早めに切り上げる
}
function coachShow(item) {
  const el = $('coach');
  coachCur = item;
  if (!item) { el.hidden = true; return; }
  const mood = item.mood === 'ouch' ? 'ouch' : item.mood === 'happy' ? 'happy' : 'normal';
  $('coachChappy').innerHTML = Chappy2D.svg(mood, item.mood === 'happy' ? 'wave' : '');
  $('coachSay').innerHTML = item.lines.join('<br>') + (item.tap ? '<span class="tap">▶ タップ</span>' : '');
  el.hidden = false; el.classList.toggle('wait', !!item.tap);
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  coachT = item.sticky ? Infinity : 2.6 + item.lines.join('').length * 0.09;
}
function nextCoach() { coachShow(coachQ.shift() || null); }
function coachTick(dt) {
  if (!coachCur || coachT === Infinity) return;
  coachT -= dt; if (coachT <= 0) nextCoach();
}
function coachTap() {
  if (tutor.on) { if (tutor.step.wait === 'tap') { snd('tap'); tutGo(tutor.i + 1); } return; }
  if (coachCur) nextCoach();
}

/* ---------- お知らせ ---------- */
let bannerTimer, toastTimer, dayTimer;
function banner(items) {
  const el = $('banner');
  el.innerHTML = items.map((it, i) => `<div class="bn ${it.cls || ''}" style="animation-delay:${i * 0.12}s"><i>${it.icon}</i><b>${it.text}</b></div>`).join('');
  el.hidden = false; clearTimeout(bannerTimer); bannerTimer = setTimeout(() => (el.hidden = true), 2600);
}
function toast(msg) { const el = $('toast'); el.textContent = msg; el.style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.style.opacity = 0), 1800); }

/* ---------- 1年のまとめ ---------- */
function dayCard(s) {
  const w = C.weather[s.weather], el = $('daycard');
  const dh = s.houses1 - s.houses0;
  const cause = s.cause ? EC.CAUSE[s.cause] : null;
  el.innerHTML = `<div class="dc-head"><b>${s.year}年</b><span>${w.icon}${s.events.filter(k => k !== 'unlock').map(k => EVI[k]).join('')}</span><em style="background:${s.bh ? EC.BLACK : '#34B56A'}">${s.bh ? '⚡停電' : '✨停電ゼロ'}</em></div>`
    + `<canvas class="dc-chart"></canvas>`
    + `<div class="dc-row"><div><small>停電</small>${s.bh}時間</div><div><small>お金</small>+${s.coins}</div><div><small>CO₂</small>${Math.round(s.ratio * 100)}%</div><div><small>点数</small>${s.pts >= 0 ? '+' : ''}${s.pts}</div></div>`
    + (cause ? `<div class="dc-cause">${cause[0]} ${cause[1]}</div>` : '')
    + (s.pred ? `<div class="dc-pred ${s.pred.ok ? 'ok' : ''}">🔮 よそう「${s.pred.yes ? '停電する' : 'しない'}」→ ${s.pred.ok ? `的中！ +${C.predBonus}🪙` : 'はずれ…　なぜだろう？'}</div>` : '')
    + (s.mvp ? `<div class="dc-mvp"><img src="${EC.charaIcon(s.mvp, 'happy')}" alt="">${s.peakH}時のMVP ${P[s.mvp].chara}${dh ? `　🏠${dh > 0 ? '+' : ''}${dh}` : ''}</div>` : '')
    + (s.bonus ? `<div class="dc-mix">🌈 ミックス！ +${s.bonus}🪙</div>` : '');
  el.hidden = false;
  drawDay(el.querySelector('canvas'), s.log);
  clearTimeout(dayTimer); dayTimer = setTimeout(() => (el.hidden = true), s.bh || s.pred ? 6500 : 4500);
}
function drawDay(cv, L) {
  const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
  const g = cv.getContext('2d'), w = r.width, h = r.height;
  g.setTransform(d, 0, 0, d, 0, 0);
  let max = 1; for (let i = 0; i < 24; i++) max = Math.max(max, L.D[i], C.stack.reduce((a, k) => a + L.gen[k][i], 0) + L.curt[i]);
  max *= 1.1;
  const bw = (w - 8) / 24, H = h - 6, Y = v => 3 + H - v / max * H;
  g.fillStyle = 'rgba(38,52,94,.1)'; g.fillRect(4, 0, bw * 6, h); g.fillRect(4 + bw * 19, 0, bw * 5, h);
  for (let i = 0; i < 24; i++) {
    let y = 3 + H;
    C.stack.forEach(k => { const v = L.gen[k][i]; if (v <= 0) return; const hh = v / max * H; g.fillStyle = P[k].color; g.fillRect(4 + i * bw + 0.5, y - hh, bw - 1, hh); y -= hh; });
    if (L.curt[i] > 0.05) { const hh = L.curt[i] / max * H; g.fillStyle = 'rgba(150,160,175,.6)'; g.fillRect(4 + i * bw + 0.5, y - hh, bw - 1, hh); }
    if (L.short[i] > 0.02 * L.D[i]) { const hh = L.short[i] / max * H; g.fillStyle = EC.BLACK; g.fillRect(4 + i * bw + 0.5, y - hh, bw - 1, hh); }
  }
  g.strokeStyle = '#1E2A38'; g.lineWidth = 2; g.beginPath();
  for (let i = 0; i < 24; i++) { if (!L.D[i]) continue; const y = Y(L.D[i]); g.moveTo(4 + i * bw, y); g.lineTo(4 + (i + 1) * bw, y); }
  g.stroke();
}

/* ---------- 新しい電源 ---------- */
function showNew(k) {
  const p = P[k];
  openModal(`<div class="newc"><span class="ribbon">🆕 新しい電源！</span><br><img src="${EC.charaIcon(k, 'happy')}" alt="">`
    + `<h2>${p.chara}<small style="font-size:15px;color:#5B6B7E;margin-left:6px">${p.name}</small></h2><span class="tagline" style="background:${p.color}">${p.tag}</span>`
    + `<div class="icons">${iconsOf(k)}</div><canvas></canvas>`
    + `<div class="gb"><span class="g">◎ ${p.good}</span><span class="b">△ ${p.bad}</span></div><button class="btn go" id="newOk">OK！</button></div>`);
  snd('newcard');
  drawShape($('modal').querySelector('canvas'), k);
  $('newOk').onclick = () => { closeModal(); coach('newCard', { mood: 'happy' }); };
}

/* ---------- よそう（今日、停電すると思う？） ---------- */
function askPredict(tut) {
  const t = tut ? S.forecast : S.today, w = C.weather[t.weather];
  const evs = t.events.filter(k => BAD_EV.includes(k)).map(k => EVI[k]).join('');
  openModal(`<div class="pred"><div class="pred-ic">${w.icon}${evs}</div><h2>🔮 よそうしてみよう</h2>
    <p class="q">${tut ? 'あしたの 夕方' : 'きょう'}、<b>停電</b>すると 思う？</p>
    <div class="row2"><button class="btn red" id="pYes">⚡ する</button><button class="btn go" id="pNo">💡 しない</button></div>
    ${tut ? '' : '<button class="btn small" id="pSkip">わからない（とばす）</button><p class="hint2">あたると 🪙ボーナス。理由も 考えてみよう</p>'}</div>`);
  snd('predict');
  const done = yes => {
    closeModal(); snd('tap');
    if (tut) { tutor.pred = yes; tutEvent('predict'); return; }
    if (yes != null) { EC.predict(S, yes); toast(yes ? '🔮「停電する」と よそう' : '🔮「停電しない」と よそう'); }
  };
  $('pYes').onclick = () => done(true); $('pNo').onclick = () => done(false);
  if ($('pSkip')) $('pSkip').onclick = () => done(null);
}

/* ---------- チュートリアル ---------- */
function tutStart() {
  startCommon(EC.newGame('tutorial', { tutorial: true }), 'tutorial');
  tutor.on = true; tutor.pred = null;
  document.body.classList.add('tutmode');
  tutGo(0);
}
function tutGo(i) {
  const st = EC.TUTORIAL[i]; if (!st) return;
  tutor.i = i; tutor.step = st; tutor.run = st.run || 0;
  let lines = st.say;
  if (st.result) {
    const L = S.log, bad = L.short.some((v, h) => v > 0.02 * Math.max(1, L.D[h]));
    const hit = tutor.pred === bad;
    lines = bad ? ['⚡ やっぱり 停電…', '💨は 風まかせ なんだ'] : ['セーフ！ でも…', '風まかせは あぶないね'];
    if (tutor.pred != null) lines.push(hit ? '🔮 よそう 的中！' : '🔮 よそうと ちがった！');
    snd(hit ? 'right' : 'wrong');
  }
  coachShow({ lines, mood: st.mood || 'normal', tap: st.wait === 'tap', sticky: true });
  setSpot(st.focus || null);
  if (st.wait === 'predict') setTimeout(() => askPredict(true), 700);
  if (st.wait === 'done') setTimeout(tutDone, 1000);
  renderCards(true);
  if (focus && (st.wait === 'rest' || st.wait === 'wake')) showPlantPop(focus);
}
function tutEvent(type, arg) {
  if (!tutor.on || !tutor.step) return;
  const w = tutor.step.wait;
  if (w === type || w === type + ':' + arg) tutGo(tutor.i + 1);
}
function tutCheck() {
  const w = tutor.step.wait + '';
  let m = /^hour:([\d.]+)(?:@(\d+))?$/.exec(w);
  if (m && S.hour >= +m[1] && (!m[2] || S.year === +m[2])) { tutGo(tutor.i + 1); return true; }
  m = /^day:(\d+)$/.exec(w);
  if (m && S.year >= +m[1]) { tutGo(tutor.i + 1); return true; }
  return false;
}
function tutDone() {
  tutor.on = false; setSpot(null); document.body.classList.remove('tutmode');
  store.tutDone = true; saveStore();
  snd('fanfare');
  openModal(`<div class="res"><div class="over-why">🎓</div><h2>チュートリアル クリア！</h2>
    <div class="cp-mini">${Chappy2D.svg('happy', 'jump')}</div>
    <div class="learned"><span>⚡ 線より上</span><span>☀️ 昼だけ</span><span>🔥 起こすのに時間</span><span>💨 風まかせ</span><span>🔋 ためて夜へ</span><span>🌈 組み合わせ</span></div>
    <div class="row2"><button class="btn" id="tdTitle">🏠 タイトル</button><button class="btn go" id="tdPlay">▶ 本番スタート</button></div></div>`);
  $('tdPlay').onclick = () => { closeModal(); startGame('free'); };
  $('tdTitle').onclick = () => { closeModal(); showTitle(); };
}
let spotTarget = null;
function setSpot(f) { spotTarget = f; if (!f) $('spot').hidden = true; }
function spotTick() {
  const el = $('spot');
  if (!spotTarget || !tutor.on || !$('modalBack').hidden) { el.hidden = true; return; }
  let x, y, r, dim = true;
  if (spotTarget[0] === '#') {
    const b = document.querySelector(spotTarget).getBoundingClientRect(); x = b.left + b.width / 2; y = b.top + b.height / 2; r = Math.max(b.width, b.height) / 2 + 10;
  } else if (spotTarget.startsWith('card:')) {
    const e = document.querySelector(`.card[data-k="${spotTarget.slice(5)}"]`); if (!e) { el.hidden = true; return; }
    const b = e.getBoundingClientRect(); x = b.left + b.width / 2; y = b.top + b.height / 2; r = Math.max(b.width, b.height) / 2 + 8;
  } else if (spotTarget.startsWith('tile:')) {
    const k = spotTarget.slice(5);
    const p = k === 'rest' ? S.plants.find(q => q.type === 'thermal' && q.mode === 'rest') : S.plants.find(q => q.type === k && !q.left);
    if (!p) { el.hidden = true; return; }
    const s = world.screenOf(p.r, p.c, 18); x = s.x; y = s.y; r = 54;
    const mb = $('popMode');
    if (!$('pop').hidden && mb && (tutor.step.wait === 'rest' || tutor.step.wait === 'wake')) { const b = mb.getBoundingClientRect(); x = b.left + b.width / 2; y = b.top + b.height / 2; r = b.width / 2 + 10; }
  } else if (spotTarget === 'hl') {
    if (!sel) { el.hidden = true; return; }
    const t = bestTile(sel); if (!t) { el.hidden = true; return; }
    const s = world.screenOf(t.r, t.c, 4); x = s.x; y = s.y; r = 30; dim = false;
  }
  const hole = $('spotHole'), hand = $('spotHand');
  hole.style.left = (x - r) + 'px'; hole.style.top = (y - r) + 'px'; hole.style.width = hole.style.height = (r * 2) + 'px';
  hand.style.left = (x + r * 0.35) + 'px'; hand.style.top = (y + r * 0.45) + 'px';
  el.classList.toggle('nodim', !dim); el.hidden = false;
}

/* ---------- 結果 ---------- */
function endGame() {
  phase = 'over'; sel = null; focus = null; hidePop(); world.setHighlight([], []); coachQ.length = 0; coachShow(null);
  const R = EC.result(S);
  const prev = store.best;
  if (!prev || R.score > prev.score) store.best = { score: R.score, rank: R.rank };
  if (mode === 'daily') { const d = today(); if (!store.daily || store.daily.date !== d || R.score > store.daily.score) store.daily = { date: d, score: R.score, rank: R.rank }; }
  saveStore();
  snd(R.win ? 'fanfare' : 'over');
  chappyMood = R.win ? 'jump' : 'ouch'; chappyT = 99;
  if (R.win) world.hearts();
  setTimeout(() => showResult(R, prev), R.win ? 600 : 1200);
}
function showResult(R, prev) {
  const colors = { S: '#F5B301', A: '#34B56A', B: '#2F6FB0', C: '#9FB0C6' };
  let head;
  if (R.win) head = `<h2>🏁 2050年！ 任期おわり</h2>`;
  else {
    let hint = '';
    if (R.why === 'earth') hint = '🔥 火力に たよりすぎたかも';
    else {
      const cnt = {}; S.hist.forEach(h => { if (h.cause) cnt[h.cause] = (cnt[h.cause] || 0) + 1; });
      const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
      hint = top ? `${EC.CAUSE[top][0]} ${EC.CAUSE[top][1]}が 多かった` : '⚡ 電気が たりなかった';
    }
    head = `<div class="over-why">${R.why === 'earth' ? '🥵' : '🏚️'}</div><h2>${R.why === 'earth' ? '地球が あつくなりすぎた…' : '町の人が いなくなっちゃった…'}</h2><div class="hint">${hint}</div>`;
  }
  const stars = [0, 1, 2].map(i => `<span class="${i < R.stars ? '' : 'off'}">⭐</span>`).join('');
  const best = prev ? `ベスト ${fmt(Math.max(prev.score, R.score))}` : 'はじめての記録！';
  const items = ['thermal', 'nuclear', 'hydro', 'geo', 'wind', 'solar', 'other'];
  const tests = EC.STRESS.map(sc => Object.assign({ sc }, EC.stressTest(S, Object.assign({}, sc))));
  const weak = tests.slice().sort((a, b) => b.bh - a.bh)[0];
  openModal(`<div class="res">${head}
    <div class="rank" style="color:${colors[R.rank]}">${R.rank}</div>
    <div class="stars">${stars}</div>
    <div style="font-size:12px;font-weight:900;color:#5B6B7E">⭐2050年まで　⭐CO₂を8割へらす　⭐停電した年 3年以下</div>
    <div class="score">${fmt(R.score)}点<small>${best}</small></div>
    ${mode === 'daily' ? `<div class="best" style="display:inline-block;margin-top:4px">📅 きょうのステージ ${today()}　きょうのベスト ${fmt(store.daily.score)}点</div>` : ''}
    <div class="nums"><div><small>🏙️ 人口</small>${fmt(S.houses * 100 + S.factories * 300)}人</div><div><small>🌫️ CO₂</small>${R.ratio <= 1 ? '-' + Math.round((1 - R.ratio) * 100) : '+' + Math.round((R.ratio - 1) * 100)}%</div><div><small>⚡ 停電した年</small>${S.blackoutYears}年</div></div>
    <h3>🧪 あなたの町、ほんとうに強い？</h3>
    <div class="tests">${tests.map(t => `<div class="${t.bh ? 'ng' : 'ok'}"><i>${t.sc.icon}</i><b>${t.sc.name}</b><span>${t.bh ? `⚡ 停電 ${t.bh}時間` : '✅ 停電なし'}</span><small>💸 燃料 ${t.fuel}🪙</small></div>`).join('')}</div>
    <div class="think">🤔 ${weak.bh ? `「${weak.sc.name}」に 弱いみたい。どうすれば 強くなる？` : 'どの テストも 合格！ でも 電気代や 町の人の 気もちは？'}</div>
    <h3>あなたの町の電気 と 日本</h3>
    <div class="donuts"><div><canvas id="d0"></canvas>あなたの町</div><div><canvas id="d1"></canvas>${C.japan[0].label}</div><div><canvas id="d2"></canvas>${C.japan[1].label}</div></div>
    <div class="legend">${items.map(k => `<span><i style="background:${k === 'other' ? '#C5CCD6' : P[k].color}"></i>${k === 'other' ? 'その他' : P[k].name}</span>`).join('')}</div>
    <h3>4つの見方で ふりかえり</h3>
    <canvas class="radar" id="radar"></canvas>
    <button class="btn small" id="toNotes">🤔 ゲームと ほんとうの ちがい</button>
    <div class="row2"><button class="btn" id="toTitle">🏠 タイトル</button><button class="btn go" id="again">▶ もういちど</button></div></div>`);
  requestAnimationFrame(() => {
    donut($('d0'), R.mix, items); donut($('d1'), C.japan[0].mix, items); donut($('d2'), C.japan[1].mix, items);
    radar($('radar'), R.radar);
  });
  $('again').onclick = () => { closeModal(); startGame(mode); };
  $('toTitle').onclick = () => { closeModal(); showTitle(); };
  $('toNotes').onclick = () => showNotes(() => showResult(R, prev));
}
function donut(cv, mix, items) {
  const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
  const g = cv.getContext('2d'), w = r.width, R = w / 2 - 3;
  g.setTransform(d, 0, 0, d, 0, 0);
  const tot = items.reduce((a, k) => a + (mix[k] || 0), 0) || 1;
  let a = -Math.PI / 2;
  items.forEach(k => { const v = (mix[k] || 0) / tot; if (v <= 0) return; g.fillStyle = k === 'other' ? '#C5CCD6' : P[k].color; g.beginPath(); g.moveTo(w / 2, w / 2); g.arc(w / 2, w / 2, R, a, a + v * Math.PI * 2); g.closePath(); g.fill(); a += v * Math.PI * 2; });
  g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2, w / 2, R * 0.55, 0, 7); g.fill();
  const re = ((mix.solar || 0) + (mix.wind || 0) + (mix.hydro || 0) + (mix.geo || 0) + (mix.other || 0)) / tot;
  g.fillStyle = '#5B6B7E'; g.font = `900 ${Math.max(9, R * 0.17)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('再エネ', w / 2, w / 2 - R * 0.14);
  g.fillStyle = '#1E2A38'; g.font = `900 ${Math.max(11, R * 0.26)}px sans-serif`;
  g.fillText(`${Math.round(re * 100)}%`, w / 2, w / 2 + R * 0.12);
}
function radar(cv, v) {
  const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
  const g = cv.getContext('2d'), w = r.width, h = r.height, cx = w / 2, cy = h / 2 + 2, R = Math.min(w / 2 - 70, h / 2 - 26);
  g.setTransform(d, 0, 0, d, 0, 0);
  const ax = [['⚡ 安定', v.stable], ['🌏 環境', v.env], ['🪙 経済', v.money], ['🛡️ 安心', v.safe]];
  const pt = (i, k) => { const a = -Math.PI / 2 + i * Math.PI / 2; return [cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k]; };
  g.strokeStyle = '#DCE4EE'; g.lineWidth = 1;
  [0.25, 0.5, 0.75, 1].forEach(k => { g.beginPath(); ax.forEach((_, i) => { const [x, y] = pt(i, k); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.stroke(); });
  g.beginPath(); ax.forEach((a, i) => { const [x, y] = pt(i, a[1] / 100); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
  g.fillStyle = 'rgba(15,181,170,.3)'; g.fill(); g.strokeStyle = '#0FB5AA'; g.lineWidth = 2.5; g.stroke();
  g.fillStyle = '#1E2A38'; g.font = '900 12px sans-serif'; g.textBaseline = 'middle';
  ax.forEach((a, i) => {
    const [x, y] = pt(i, 1);
    g.textAlign = i === 1 ? 'left' : i === 3 ? 'right' : 'center';
    g.fillText(`${a[0]} ${Math.round(a[1])}`, x + (i === 1 ? 6 : i === 3 ? -6 : 0), y + (i === 0 ? -12 : i === 2 ? 12 : 0));
  });
}

/* ---------- 🗺️ おまけ「町の地図で 2050年へ」（立地と うつりかわり） ----------
   時間は 止めて、地図に 建てる → ⏩ 3年 すすめる（完成・引退）→ 4つの 日で ためす を 2050年まで くりかえす。しくみは mirai.js */
const MI = () => C.mirai;
const pctOf = ck => Math.round(ck.co2 / mir.hist[0].co2 * 100);
const icon = k => `<img class="mi-ic" src="${EC.charaIcon(k)}" alt="${P[k].name}">`;
function miraiStart() {
  startCommon(EC.Mirai.newTown(), 'mirai');
  Object.assign(mir, { on: true, hist: [], talks: [] });
  document.body.classList.add('miraimode'); S.hour = 11;
  mir.last = EC.Mirai.check(S); mir.hist.push(Object.assign({ done: [], gone: [] }, mir.last));
  renderCards(true); miraiPanel(); miraiIntro();
}
function miraiIntro(back) {
  const L = MI().lead, F = MI().life, f40 = EC.Mirai.demandAt(MI().demand.y1);
  openModal(`<h2>🗺️ 町の地図で 2050年へ</h2>
    <p class="sub2">2026年の 町長に なった。古い 発電所は いつか 引退し、町が 使う 電気は ふえていく。<br><b>2050年まで、4つの日（晴れ・雨・風なし・猛暑）で 停電させずに、CO₂を へらそう。</b></p>
    <div class="how mi-how">
      <div><i>⏳</i>建てるのに 時間が かかる<small>☀️🔋${L.solar}年・💧${L.hydro}年・💨${L.wind}年・🔥${L.thermal}年・♨️${L.geo}年</small></div>
      <div><i>👴</i>使える 年数が ある<small>☀️💨🔋${F.solar}年・🔥💧♨️${F.thermal}年 で 引退</small></div>
      <div><i>📍</i>置ける 場所が きまっている<small>近くの 人と 話し合うと 完成が おくれる</small></div>
      <div><i>📈</i>使う 量が ふえる<small>2040年に 約${f40.toFixed(2)}倍（国の 見通し）</small></div>
      <div><i>⏩</i>1回で 3年 すすむ<small>8回で 2050年。毎回 4つの日で ためす</small></div>
      <div><i>⚛️</i>原子力は 新しく 建てない<small>建てるのに かかる 年数の 公式な 資料が ない ため</small></div>
    </div>
    <p class="mi-src">📚 ⏳：FIT/FIPの 運転開始期限（☀️💧💨）・資源エネルギー庁（🔥 計画から 約10年）・調達価格等算定委員会（♨️ 調査から 約14年）　👴：発電コスト検証（稼働年数）　📈：第7次エネルギー基本計画（2040年度 1.1〜1.2兆kWh）。🔋の 年数と、話し合いで おくれる 年数は ゲームの きまり</p>
    <button class="btn go" id="miGo">${back ? 'とじる' : '▶ はじめる'}</button>`);
  $('miGo').onclick = () => { closeModal(); if (typeof back === 'function') back(); else coachShow({ lines: ['カードを えらんで 地図に 建てよう', '👴の 札が 出たら、引退の 合図！'], mood: 'happy' }); };
}
function miraiPlace(k, t, talk) {
  EC.Mirai.build(S, k, t.r, t.c, talk);
  if (talk) mir.talks.push(k);
  snd('place'); world.sync(S, true); world.burst(t.r, t.c, 'spark', 20);
  floatText(t.r, t.c, `⏳${MI().lead[k] + (talk ? MI().talk : 0)}年`);
  sel = null; hidePop(); world.setHighlight([], []); world.setHover(null);
  renderCards(true); miraiPanel();
}
// 🗣️ 町の 人の 声：話し合って 建てる（おくれる）か、べつの 場所に するか
function miraiVoice(k, t, v) {
  openModal(`<div class="res mi-voice"><div class="mi-face">${v[0]}</div><h2>${v[1]}</h2><p class="mi-say">「${v[2]}」</p>
    <p class="sub2">${P[k].name}を ここに 建てるには、町の 人と 話し合う 時間が いる。</p>
    <div class="row2"><button class="btn" id="mvNo">📍 べつの 場所に する</button><button class="btn go" id="mvYes">🤝 話し合って 建てる<small>完成が ${MI().talk}年 おそくなる</small></button></div>
    <p class="mi-src">（おくれる 年数は ゲームの きまり。ほんとうは 場所に よって ちがう）</p></div>`);
  $('mvNo').onclick = () => { snd('tap'); closeModal(); };
  $('mvYes').onclick = () => { closeModal(); miraiPlace(k, t, true); };
}
function miraiPanel() {
  let el = $('mirPanel');
  if (!el) { el = document.createElement('aside'); el.id = 'mirPanel'; $('app').appendChild(el); }
  el.hidden = !mir.on; if (!mir.on) return;
  const ck = mir.last, end = S.year >= C.endYear;
  const build = S.plants.filter(p => p.left > 0).sort((a, b) => a.left - b.left);
  const old = S.plants.filter(p => !p.left && p.retire && p.retire - S.year <= 6).sort((a, b) => a.retire - b.retire);
  el.innerHTML = `<div class="mp-year"><small>いまは</small><b>${S.year}年</b>${end ? '' : `<span>⏩ つぎは ${S.year + MI().step}年</span>`}</div>
    <div class="mp-row"><span>📈 町が 使う 量</span><b>×${EC.Mirai.demandAt(S.year).toFixed(2)}</b></div>
    <div class="mp-row"><span>🌫️ CO₂（2026年を 100）</span><b>${pctOf(ck)}%</b></div>
    <div class="mp-days"><b>🗾 いまの 町で 4つの日</b><div>${ck.days.map(d => `<span class="${d.bh ? 'ng' : 'ok'}">${d.icon}<em>${d.bh ? '⚡' : '⭕'}</em><small>${d.name}</small></span>`).join('')}</div></div>
    <div class="mp-list"><b>🔨 建設中</b>${build.length ? build.map(p => `<span>${icon(p.type)}あと${p.left}年${p.talk ? '🤝' : ''}</span>`).join('') : '<small>なし</small>'}</div>
    <div class="mp-list warn"><b>👴 6年 以内に 引退</b>${old.length ? old.map(p => `<span>${icon(p.type)}${p.retire}年</span>`).join('') : '<small>なし</small>'}</div>
    <button class="btn go" id="mpNext">${end ? '🏁 けっかを 見る' : `⏩ 3年 すすめる`}</button>
    <div class="mp-hist">${mir.hist.map(h => `<span class="${h.black ? 'ng' : 'ok'}" title="${h.year}年"><small>${String(h.year).slice(2)}</small>${h.black ? '⚡' : '⭕'}</span>`).join('')}</div>`;
  $('mpNext').onclick = () => { snd('tap'); end ? miraiResult() : miraiNext(); };
}
// ⏩ 3年 すすむ ようす：春→夏→秋→冬 を 3回（地図の 色と、花びら・きらきら・葉・雪）。タップで とばせる
const SEASONS = [['spring', '🌸', '春', ['🌸', '🌸', '🌼']], ['summer', '🌻', '夏', ['✨', '🌻', '✨']], ['autumn', '🍁', '秋', ['🍁', '🍂', '🍁']], ['winter', '❄️', '冬', ['❄️', '❄️', '⛄']]];
function miraiSeasons(from, done) {
  const v = $('view'), ov = document.createElement('div'), lab = document.createElement('div'), n = MI().step * 4;
  const fast = matchMedia('(prefers-reduced-motion: reduce)').matches, ms = fast ? 120 : 420;
  ov.className = 'mi-season'; v.appendChild(ov); lab.className = 'mi-slabel'; $('app').appendChild(lab);
  let i = 0, end = false, iv = 0;
  const finish = () => { if (end) return; end = true; clearInterval(iv); mir.animYear = 0; delete v.dataset.season; ov.remove(); lab.remove(); done(); };
  const tick = () => {
    if (i >= n) return finish();
    const [k, ic, nm, fx] = SEASONS[i % 4], y = from + 1 + Math.floor(i / 4);
    v.dataset.season = k; ov.dataset.season = k; mir.animYear = y;
    lab.innerHTML = `<b>${y}年</b><span>${ic} ${nm}</span><em>${Array.from({ length: n }, (_, j) => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</em>`;
    if (!fast) for (let j = 0; j < 12; j++) {   // ふってくる もの
      const e = document.createElement('i'); e.textContent = fx[j % fx.length];
      e.style.left = Math.random() * 100 + '%'; e.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px'); e.style.setProperty('--r', (Math.random() * 540 - 270) + 'deg');
      e.style.animationDuration = (1.2 + Math.random() * 0.9) + 's'; e.style.animationDelay = Math.random() * 0.3 + 's';
      ov.appendChild(e); setTimeout(() => e.remove(), 2600);
    }
    if (i % 4 === 0) snd('pick');
    i++;
  };
  ov.onclick = lab.onclick = finish;
  tick(); iv = setInterval(tick, ms);
}
function miraiNext() {
  if (sel) select(sel); focus = null; hidePop(); coachShow(null);
  const b = $('mpNext'); if (b) b.disabled = true;
  miraiSeasons(S.year, miraiAdvance);
}
function miraiAdvance() {
  const from = S.year, r = EC.Mirai.advance(S);
  r.gone.forEach(g => world.burst(g.r, g.c, 'poof')); r.done.forEach(p => world.burst(p.r, p.c, 'spark', 30));
  world.sync(S, true);
  const ck = EC.Mirai.check(S); mir.last = ck;
  mir.hist.push(Object.assign({ done: r.done.map(p => p.type), gone: r.gone.map(g => g.type) }, ck));
  snd(ck.black ? 'wrong' : 'good'); chappyMood = ck.black ? 'ouch' : 'jump'; chappyT = 3;
  miraiPanel(); miraiTurn(from, r, ck);
}
function miraiTurn(from, r, ck) {
  const worst = ck.days.slice().sort((a, b) => b.bh - a.bh)[0];
  const think = ck.black ? '⚡ 停電！ 引退した 発電所の かわりは 間に合った？ 完成まで 何年も かかる ものは、引退より 前に 建てはじめないと 間に合わない。'
    : r.gone.length ? '👋 引退した 分を うめられた！ つぎに 引退するのは どれ？ そのとき 何が 完成している？' : '⭕ 停電なし。CO₂は へっている？';
  openModal(`<div class="res"><h2>📅 ${from}年 → ${S.year}年</h2>
    <div class="mi-ev">${r.done.length ? `<div class="ok">✅ 完成 ${r.done.map(p => icon(p.type)).join('')}</div>` : ''}${r.gone.length ? `<div class="ng">👋 引退 ${r.gone.map(g => icon(g.type)).join('')}<small>（使える 年数が きた）</small></div>` : ''}<div>📈 使う 量 ×${ck.f.toFixed(2)}　🌫️ CO₂ ${pctOf(ck)}%</div></div>
    <h3>🗾 4つの日で ためすと</h3>
    <div class="tests">${ck.days.map(d => `<div class="${d.bh ? 'ng' : 'ok'}"><i>${d.icon}</i><b>${d.name}</b><span>${d.bh ? `⚡ 停電 ${d.bh}時間` : '✅ 停電なし'}</span></div>`).join('')}</div>
    ${worst.bh ? `<h3>${worst.icon} ${worst.name}の 1日</h3><canvas class="res-chart" id="miChart"></canvas>
    <div class="legend">${C.stack.filter(k => worst.log.gen[k].some(v => v > 0.05)).map(k => `<span><i style="background:${P[k].color}"></i>${P[k].name}</span>`).join('')}<span><i style="background:${EC.BLACK}"></i>停電</span><span><i style="background:#96A0AF"></i>捨てた電気</span></div>` : ''}
    <div class="think">🤔 ${think}</div>
    <button class="btn go" id="miOk">${S.year >= C.endYear ? '🏁 けっかへ' : '▶ 計画を つづける'}</button></div>`);
  if (worst.bh) requestAnimationFrame(() => { const cv = $('miChart'); if (cv) drawDay(cv, worst.log); });   // すぐ 次へ すすんだ ときは かかない
  $('miOk').onclick = () => { closeModal(); if (S.year >= C.endYear) miraiResult(); };
}
function miraiResult() {
  const H = mir.hist, turns = H.slice(1), nb = turns.filter(h => h.black).length, last = H[H.length - 1];
  openModal(`<div class="res"><h2>🏁 2050年！ 町長の しごと おわり</h2>
    <div class="nums"><div><small>⚡ 停電した 回</small>${nb} / ${turns.length}</div><div><small>🌫️ CO₂（2026年を 100）</small>${pctOf(last)}%</div><div><small>🏗️ 建てた お金</small>🪙${S.spent}</div></div>
    <h3>📅 うつりかわり</h3>
    <div class="mi-tl">${H.map(h => `<div class="${h.black ? 'ng' : 'ok'}"><b>${h.year}</b><span>${h.days.map(d => d.bh ? '⚡' : '⭕').join('')}</span><span>🌫️${pctOf(h)}%</span><span>${h.done.length ? `<i>✅</i>${h.done.map(icon).join('')}` : ''}${h.gone.length ? `<i>👋</i>${h.gone.map(icon).join('')}` : ''}</span></div>`).join('')}</div>
    <p class="mi-src">⭕⚡＝ 晴れ・雨・風なし・猛暑　✅のあと＝完成、👋のあと＝引退${mir.talks.length ? `　🤝 話し合って 建てた：${mir.talks.length}回` : ''}</p>
    <h3>✍️ ふりかえり</h3>
    <label class="jp-ta mi-ta"><span>⏳ もっと 早く 決めれば よかった ことは？ なぜ？</span><textarea id="miT1" rows="2"></textarea></label>
    <label class="jp-ta mi-ta"><span>📍 場所で こまった ことは？（置ける 場所・町の 人の 声）</span><textarea id="miT2" rows="2"></textarea></label>
    <div class="row2"><button class="btn" id="miAgain">🔄 もう一度</button><button class="btn go" id="miEnd">📝 記録して おわる</button></div></div>`);
  const save = () => EC.Log && EC.Log.add({ t: 'mirai', black: nb, turns: turns.length, co2: pctOf(last), spent: S.spent, talks: mir.talks.length, texts: [$('miT1').value.trim(), $('miT2').value.trim()] });
  $('miAgain').onclick = () => { save(); miraiStart(); };
  $('miEnd').onclick = () => { save(); closeModal(); showTitle(); };
}

/* ---------- ステージ（1ステージで1つのことを学ぶ） ---------- */
const freeOpen = () => !!(store.stages && store.stages[8]);
function learnedHTML(k) {
  const L = (store.learned || {})[k];
  return L && L.length ? `<p class="learned-z">${L.map(t => `✅ ${t}`).join('<br>')}</p>` : '<p class="learned-z off">？ まだ わからない（ステージで 見つけよう）</p>';
}
function stageSelect() {
  const prog = store.stages || {};
  openModal(`<h2>🗺️ ステージ</h2><p class="sub2">1ステージで 1つのことを 学ぼう</p><div class="stg-grid">${EC.STAGE_LIST.map((d, i) => {
    const st = prog[d.id] || 0, open = i === 0 || prog[EC.STAGE_LIST[i - 1].id];
    return `<button class="stg-card ${open ? '' : 'locked'} ${st ? 'done' : ''}" data-i="${i}"><i>${open ? d.icon : '🔒'}</i><span><b>${d.id}. ${d.title}</b><small>${open ? d.goal : 'まえのステージを クリアしよう'}</small></span><em>${'⭐'.repeat(st)}${'☆'.repeat(3 - st)}</em></button>`;
  }).join('')}</div><button class="btn" id="sgBack">もどる</button>`);
  $('modal').querySelectorAll('.stg-card').forEach(b => { b.onclick = () => { if (b.classList.contains('locked')) { snd('bad'); return; } snd('tap'); stageStart(+b.dataset.i); }; });
  $('sgBack').onclick = () => { closeModal(); showTitle(); };
}
function stageStart(i) {
  const d = EC.STAGE_LIST[i];
  startCommon(EC.newGame('stage' + d.id, { stage: d }), 'stage');
  Object.assign(stg, { on: true, i, def: d, running: false, days: 0 });
  document.body.classList.add('stagemode');
  $('mission').innerHTML = `<b>ステージ${d.id}</b><span>${d.icon} ${d.goal}</span>`; $('mission').hidden = false;
  $('btnRun').hidden = false; $('btnRun').disabled = false;
  coachShow({ lines: d.intro.concat(['カードで 置いたら ▶で ためそう！']), mood: 'happy', sticky: true });
}
function hourRanges(hs) {
  const out = []; let a = hs[0], b = hs[0];
  hs.slice(1).concat([null]).forEach(h => { if (h === b + 1) { b = h; return; } out.push(a === b ? `${a}時` : `${a}〜${b + 1}時`); a = b = h; });
  return out.join('、');
}
function stageRun() {
  if (!stg.on || stg.running || phase !== 'play') return;
  if (sel) select(sel);
  focus = null; hidePop(); coachShow(null);
  stg.running = true; $('btnRun').disabled = true; snd('good');
}
function stageDayEnd() {
  stg.days++;
  if (stg.days >= stg.def.days.length) { stg.running = false; setTimeout(stageResult, 700); }
}
function stageResult() {
  const d = stg.def, H = S.hist, r = { E: {}, served: 0, fuel: 0, money: S.money, curt: 0, bh: 0, kinds: 0, fail: null };
  C.stack.forEach(k => { r.E[k] = 0; });
  let vre = 0; const kinds = new Set();
  H.forEach(h => {
    C.stack.forEach(k => { r.E[k] += h.E[k]; }); r.served += h.served; r.fuel += h.fuel; r.curt += h.curtE; vre += h.E.solar + h.E.wind;
    h.kinds.forEach(k => kinds.add(k));
    const f = h.shortHours.filter(x => x >= d.win[0] && x < d.win[1]); r.bh += f.length;
    if (f.length && !r.fail) r.fail = { h, hour: f[0], hours: f };
  });
  r.curt = r.curt / Math.max(1, r.curt + vre); r.kinds = kinds.size;
  const okFuel = !d.fuelMax || r.fuel <= d.fuelMax, clear = !r.bh && okFuel;
  const stars = clear ? d.stars.filter(st => st[1](r)).length : 0;
  store.stages = store.stages || {}; store.stages[d.id] = Math.max(store.stages[d.id] || 0, stars);
  if (clear) { store.learned = store.learned || {}; Object.entries(d.learn).forEach(([k, t]) => { const L = store.learned[k] = store.learned[k] || []; if (!L.includes(t)) L.push(t); }); }
  saveStore();
  let why = '';
  if (r.bh) { const c = EC.CAUSE[r.fail.h.cause] || ['⚡', '電気が たりない']; why = `${hourRanges(r.fail.hours)}に 停電！ ${c[0]} ${c[1]}`; }
  else if (!okFuel) why = `💸 燃料代が ${Math.round(r.fuel)}🪙（目標は ${d.fuelMax}🪙 以内）`;
  const next = EC.STAGE_LIST[stg.i + 1];
  snd(clear ? 'fanfare' : 'wrong'); chappyMood = clear ? 'jump' : 'ouch'; chappyT = 3;
  if (clear) world.hearts();
  openModal(`<div class="res">
    <h2>${clear ? '🎉 クリア！' : '😣 おしい！'}</h2>
    <div class="stars">${[0, 1, 2].map(i => `<span class="${i < stars ? '' : 'off'}">⭐</span>`).join('')}</div>
    <div class="star-list">${d.stars.map(st => { const ok = clear && st[1](r); return `<span class="${ok ? 'ok' : ''}">${ok ? '✅' : '⬜'} ${st[0]}</span>`; }).join('')}</div>
    ${why ? `<div class="hint">${why}</div>` : ''}
    <canvas class="res-chart" id="resChart"></canvas>
    <div class="legend">${C.stack.filter(k => S.unlocked.has(k) || r.E[k] > 0).map(k => `<span><i style="background:${P[k].color}"></i>${P[k].name}</span>`).join('')}<span><i style="background:${EC.BLACK}"></i>停電</span><span><i style="background:#96A0AF"></i>捨てた電気</span></div>
    ${clear ? `<div class="learn-box"><b>📖 わかったこと（ずかんに のったよ）</b>${Object.entries(d.learn).map(([k, t]) => `<div><img src="${EC.charaIcon(k, 'happy')}" alt="">${P[k].name}：${t}</div>`).join('')}</div>`
      : `<div class="think">💡 ヒント：${d.tip}</div>`}
    <div class="row2"><button class="btn ${clear ? '' : 'go'}" id="rRetry">🔄 もう一度</button>${clear && next ? '<button class="btn go" id="rNext">▶ つぎの ステージ</button>' : ''}${clear && !next ? '<button class="btn go" id="rFree">🏙️ フリープレイへ</button>' : ''}</div>
    <button class="btn small" id="rList">🗺️ ステージ一覧</button></div>`);
  requestAnimationFrame(() => drawDay($('resChart'), r.fail ? r.fail.h.log : H[H.length - 1].log));
  $('rRetry').onclick = () => stageStart(stg.i);
  if ($('rNext')) $('rNext').onclick = () => stageStart(stg.i + 1);
  if ($('rFree')) $('rFree').onclick = () => startGame('free');
  $('rList').onclick = () => { showTitle(); stageSelect(); };
}

/* ---------- モーダル ---------- */
function openModal(html, cls) { $('modal').className = cls || ''; $('modal').innerHTML = html; $('modalBack').hidden = false; $('modal').scrollTop = 0; }
function closeModal() { $('modalBack').hidden = true; }

/* ---------- タイトル・あそびかた・図鑑・メニュー ---------- */
function showTitle() {
  phase = 'title'; mode = 'free'; document.body.classList.add('titlemode'); document.body.classList.remove('tutmode', 'stagemode', 'miraimode');
  mir.on = false; miraiPanel();
  stg.on = false; stg.running = false; $('mission').hidden = true; $('btnRun').hidden = true;
  tutor.on = false; setSpot(null);
  sel = null; focus = null; hidePop(); coachQ.length = 0; coachShow(null); $('daycard').hidden = true; $('banner').hidden = true;
  lbs.forEach(el => el.remove()); lbs.clear();
  S = titleTown(); world.reset(S); world.resetView(); world.setHighlight([], []);
  const letters = ['エ', 'ネ', 'ル', 'ギ', 'ー', 'シ', 'テ', 'ィ'], cols = ['#E8604C', '#F79A3E', '#F5B301', '#34B56A', '#0FB5AA', '#2F6FB0', '#7B5CC4', '#E8604C'];
  openModal(`<div class="title">
    <div class="logo">${letters.map((l, i) => `<span style="background:${cols[i]};animation-delay:${i * 0.06}s">${l}</span>`).join('')}</div>
    <div class="tagline">町長になって ⚡電気を とどけよう！</div>
    <div class="lineup">${C.order.map((k, i) => `<img src="${EC.charaIcon(k, 'happy')}" style="animation-delay:${i * 0.12}s" alt="${P[k].name}">`).join('')}</div>
    <div class="menu tmenu"><button class="btn wide main" id="tStory" style="background:#7B5CC4;color:#fff;box-shadow:0 5px 0 #5A3F9E">📘 シナリオ<small>町の電気をまかされた！ 第1部〜第4部</small></button>
      <button class="btn wide main" id="tJapan" style="background:#E8604C;color:#fff;box-shadow:0 5px 0 #B8432F">🗾 大作戦 3D<small>日本エネルギーミックス</small></button>
      <div class="omake"><b>🗺️ おまけ：町の地図で 2050年へ</b><span>どこに 建てる？ いつ 建てはじめる？ 建てるのに かかる 年数と 使える 年数</span><div><button class="btn mini" id="tMirai">▶ あそぶ</button></div></div></div>
    <div class="snd-row"><button id="tReport">📝 学習レポート（PDF）</button><button id="tZukan">📖 ずかん</button><button id="tBgm">${store.bgm ? '🎵 BGM ON' : '🎵 BGM OFF'}</button><button id="tSfx">${store.sfx ? '🔊 効果音 ON' : '🔇 効果音 OFF'}</button></div>
  </div>`, 'clear');
  $('modalBack').style.background = 'rgba(255,255,255,.12)';
  $('tMirai').onclick = () => { snd('tap'); miraiStart(); };
  $('tZukan').onclick = () => { snd('tap'); showZukan(showTitle); };
  $('tStory').onclick = () => { snd('tap'); closeModal(); EC.Story.open(showTitle); };
  $('tJapan').onclick = () => { snd('tap'); closeModal(); EC.Japan.open(showTitle); };
  $('tReport').onclick = () => { snd('tap'); EC.Report.open(); };
  $('tBgm').onclick = () => { store.bgm = !store.bgm; AU.setBgm(store.bgm); saveStore(); $('tBgm').textContent = store.bgm ? '🎵 BGM ON' : '🎵 BGM OFF'; };
  $('tSfx').onclick = () => { store.sfx = !store.sfx; AU.setSfx(store.sfx); saveStore(); $('tSfx').textContent = store.sfx ? '🔊 効果音 ON' : '🔇 効果音 OFF'; };
}
// 🏠 どこからでも トップへ（シナリオ・大作戦3Dの 中では 右上に いつも 出る）
function quitModes() { document.querySelectorAll('.ec-talk,#rp,.ec-home').forEach(e => e.remove()); if ($('jp')) EC.Japan._quit(); if ($('story')) EC.Story._quit(); }
EC.goTop = () => { quitModes(); showTitle(); };
function homeHub() {
  if (document.querySelector('.ec-home')) return;
  const el = document.createElement('div'); el.className = 'ec-home';
  el.innerHTML = `<div class="hm-card"><div class="hm-head"><i>🏠</i><b>どこへ 行く？</b></div>
    <div class="hm-go"><button class="btn go" data-g="top">🏠 トップ画面へ もどる</button>
      <button class="btn" data-g="story" style="background:#7B5CC4;color:#fff;box-shadow:0 5px 0 #5A3F9E">📘 シナリオ<small>部を えらぶ</small></button>
      <button class="btn" data-g="japan" style="background:#E8604C;color:#fff;box-shadow:0 5px 0 #B8432F">🗾 大作戦 3D<small>モードを えらぶ</small></button>
      <button class="btn" data-g="report">📝 学習レポート<small>PDFで 保存</small></button>
      <button class="btn ghost" data-g="back">◀ このまま つづける</button></div>
    <p>ここまでの 記録は 学習レポートに のこっているよ</p></div>`;
  document.body.appendChild(el); snd('tap');
  el.onclick = e => { if (e.target === el) el.remove(); };
  el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
    const g = b.dataset.g; snd('tap'); el.remove();
    if (g === 'back') return;
    if (g === 'report') return EC.Report.open();
    quitModes(); showTitle();
    if (g === 'story') { closeModal(); EC.Story.open(showTitle); }
    if (g === 'japan') { closeModal(); EC.Japan.open(showTitle); }
  });
}
const homeBtn = document.createElement('button'); homeBtn.id = 'ecHome'; homeBtn.textContent = '🏠 トップ'; homeBtn.hidden = true; homeBtn.onclick = homeHub;
document.body.appendChild(homeBtn);
new MutationObserver(() => { homeBtn.hidden = !($('story') || $('jp')); }).observe(document.body, { childList: true });
function askTutorial() {
  openModal(`<div class="res"><div class="cp-mini">${Chappy2D.svg('happy', 'wave')}</div><h2>はじめて？</h2>
    <p style="font-weight:800;color:#5B6B7E">🎓 3分の チュートリアルで あそびかたを おぼえよう！</p>
    <div class="row2"><button class="btn" id="aSkip">▶ いきなり 本番</button><button class="btn go" id="aTut">🎓 チュートリアル</button></div></div>`);
  $('aTut').onclick = () => { closeModal(); tutStart(); };
  $('aSkip').onclick = () => { closeModal(); startGame('free'); };
}
function startCommon(newS, m) {
  mode = m; closeModal(); $('modalBack').style.background = '';
  document.body.classList.remove('titlemode', 'tutmode');
  S = newS; EC.tick(S, 0.001, []);     // メーターに最初から中身を出す
  world.reset(S); world.resetView(); world.setHighlight([], []);
  phase = 'play'; paused = false; speedIdx = 0; sel = null; focus = null; bubbles = []; voices = []; seen = {}; newTypes = new Set(); pendingNew = [];
  orderVer = -1; lastMoney = -1; fcKey = ''; tubeMax = 40; cardSig = ''; tutor.on = false; setSpot(null);
  stg.on = false; stg.running = false; document.body.classList.remove('stagemode', 'miraimode'); $('mission').hidden = true; $('btnRun').hidden = true;
  mir.on = false; miraiPanel();
  $('daycard').hidden = true; coachQ.length = 0; coachShow(null); updateCtrl();
  loadIcons(); renderCards(true);
}
function startGame(m) {
  startCommon(EC.newGame(m === 'daily' ? 'daily:' + today() : null), m || 'free');
  banner([{ icon: mode === 'daily' ? '📅' : '🏙️', text: mode === 'daily' ? `きょうのステージ（${today()}）` : `${S.year}年 スタート！` }]);
  coach('start', { mood: 'happy' });
}
function showHow(back) {
  openModal(`<h2>❓ あそびかた</h2><div class="how">
    <div><i>⚡</i>メーターの 色が<br>━ 線より上なら OK<small>下だと 停電！</small></div>
    <div><i>🧱</i>カードを えらんで<br>光るマスに 置く<small>場所で 置けるものが ちがう</small></div>
    <div><i>🌙☁️🍃</i>夜・くもり・風なし<br>に そなえよう<small>あしたの天気は 上に出る</small></div>
    <div><i>😴🔥</i>昼は 🔥を 休ませ<br>夕方の前に 起こす<small>起きるまで 1時間半</small></div>
    <div><i>🌏</i>🔥が多いと<br>地球が あつくなる<small>満タンで おわり</small></div>
    <div><i>🔮</i>よそうクイズ<br>あたると ボーナス<small>理由も 考えよう</small></div>
    <div><i>📢</i>ピンチのときは<br>節電おねがい<small>1年に1回</small></div>
    <div><i>🏁</i>2050年まで<br>町を まもろう<small>いろんな電源の ミックスが カギ</small></div>
  </div><button class="btn go" id="howOk">OK！</button>`);
  $('howOk').onclick = () => { closeModal(); if (typeof back === 'function') back(); };
}
function showZukan(back) {
  openModal(`<h2>📖 電源キャラ ずかん</h2><div class="zk">${C.order.map(k => { const p = P[k]; return `<div class="z"><img src="${EC.charaIcon(k, 'happy')}" alt=""><h3>${p.chara}<small>${p.name}</small></h3>`
    + `<span class="tagline" style="background:${p.color}">${p.tag}</span><canvas data-k="${k}"></canvas>`
    + `<p>🪙${p.cost}　⏱${p.build ? p.build + '年' : 'すぐ'}　${co2Text(k)}</p><p>📍${placeText(k)}</p><p class="good">◎ ${p.good}</p><p class="bad">△ ${p.bad}</p><p class="fact">📚 ${p.fact}</p>${learnedHTML(k)}<button class="btn small" data-real="${k}">📏 ほんとうの 大きさ（写真）</button></div>`; }).join('')}</div>
    <button class="btn small" id="zkNotes">🤔 ゲームと ほんとうの ちがい</button>
    <button class="btn go" id="zkOk">とじる</button>`);
  requestAnimationFrame(() => $('modal').querySelectorAll('canvas[data-k]').forEach(cv => drawShape(cv, cv.dataset.k)));
  $('zkOk').onclick = () => { closeModal(); if (typeof back === 'function') back(); };
  $('zkNotes').onclick = () => showNotes(() => showZukan(back));
}
function showNotes(back) {
  openModal(`<h2>🤔 ゲームと ほんとうの ちがい</h2>
    <p class="sub2">このゲームは「モデル」＝ ほんとうを 単純にしたもの。どこが ちがうか 考えてみよう。</p>
    <div class="notes">${EC.NOTES.map(([i, t]) => `<div><i>${i}</i><span>${t}</span></div>`).join('')}</div>
    <div class="think">🤔 ほかに ちがうところは ある？ ほんとうの 数字を 調べたら、ゲームの 結果は どう かわりそう？</div>
    <button class="btn go" id="ntOk">とじる</button>`);
  $('ntOk').onclick = () => { closeModal(); if (typeof back === 'function') back(); };
}
function showMenu() {
  if (phase !== 'play') return;
  openModal(`<h2>⏸ ひと休み</h2><div class="menu" style="display:flex;flex-direction:column">
    <button class="btn go" id="mBack">▶ つづける</button>
    ${stg.on ? '<div class="row2"><button class="btn warm" id="mRetry">🔄 やりなおす</button><button class="btn" id="mList">🗺️ ステージ一覧</button></div>' : ''}
    <div class="row2"><button class="btn warm" id="mZukan">📖 ずかん</button><button class="btn" id="mHow">❓ あそびかた</button></div>
    <div class="row2"><button class="btn" id="mBgm">${store.bgm ? '🎵 BGM ON' : '🎵 BGM OFF'}</button><button class="btn" id="mSfx">${store.sfx ? '🔊 効果音 ON' : '🔇 効果音 OFF'}</button></div>
    <button class="btn small" id="mNotes">🤔 ゲームと ほんとうの ちがい</button>
    <button class="btn red" id="mTitle">🏠 タイトルへ（この町はおわり）</button></div>`);
  $('mBack').onclick = closeModal;
  if ($('mRetry')) { $('mRetry').onclick = () => stageStart(stg.i); $('mList').onclick = () => { showTitle(); stageSelect(); }; }
  $('mZukan').onclick = () => showZukan(showMenu);
  $('mHow').onclick = () => mir.on ? miraiIntro(showMenu) : showHow(showMenu);
  $('mNotes').onclick = () => showNotes(showMenu);
  $('mBgm').onclick = () => { store.bgm = !store.bgm; AU.setBgm(store.bgm); saveStore(); $('mBgm').textContent = store.bgm ? '🎵 BGM ON' : '🎵 BGM OFF'; };
  $('mSfx').onclick = () => { store.sfx = !store.sfx; AU.setSfx(store.sfx); saveStore(); $('mSfx').textContent = store.sfx ? '🔊 効果音 ON' : '🔇 効果音 OFF'; };
  $('mTitle').onclick = () => { closeModal(); showTitle(); };
}

/* ---------- ボタン ---------- */
function updateCtrl() {
  $('btnPause').textContent = paused ? '▶' : '⏸'; $('btnPause').classList.toggle('on', paused);
  $('btnSpeed').textContent = ['▶', '▶▶', '▶▶▶'][speedIdx];
}
function bindUI() {
  // 音は、さいしょにどこかをさわったときに鳴らせるようになる
  window.addEventListener('pointerdown', () => AU.unlock(), { capture: true });
  window.addEventListener('keydown', () => AU.unlock(), { capture: true });
  $('btnPause').onclick = () => { if (phase !== 'play' || tutor.on) return; paused = !paused; updateCtrl(); snd('tap'); };
  $('btnSpeed').onclick = () => { if (tutor.on) return; speedIdx = (speedIdx + 1) % C.speeds.length; updateCtrl(); snd('tap'); };
  $('btnMenu').onclick = () => { snd('tap'); showMenu(); };
  $('btnSave').onclick = () => {
    if (phase !== 'play' || (!running() && !(tutor.on && tutor.step.wait === 'save'))) return;
    if (EC.useSave(S)) { snd('save'); coach('save', { mood: 'happy' }); banner([{ icon: '📢', text: '節電中！ 3時間 使う量 -20%' }]); $('btnSave').classList.remove('hot'); tutEvent('save'); }
  };
  $('coach').onclick = coachTap;
  $('btnRun').onclick = stageRun;
  $('daycard').onclick = () => { $('daycard').hidden = true; };
  $('modalBack').addEventListener('click', e => { if (e.target === $('modalBack') && phase === 'play' && !$('modal').querySelector('#newOk, #pYes')) closeModal(); });
  window.addEventListener('keydown', e => {
    if (phase !== 'play') return;
    if (e.key === ' ' && !tutor.on) { e.preventDefault(); paused = !paused; updateCtrl(); }
    if (e.key === 'Escape') { if (sel) select(sel); else if (focus) { focus = null; hidePop(); } }
    const i = '1234567'.indexOf(e.key); if (i >= 0 && S.unlocked.has(C.order[i])) select(C.order[i]);
  });
}

// テスト・調整用（URL に ?debug を付けたときだけ）：時間を早送りしたり、状態を見たりできる
if (/[?&]debug/.test(location.search)) {
  window.__ec = {
    get S() { return S; }, get phase() { return phase; }, get world() { return world; }, get bubbles() { return bubbles; }, get tutor() { return tutor; },
    run(hours) { const ev = []; while (hours > 1e-6 && S && !S.over) { const h = Math.min(0.05, hours); EC.tick(S, h, ev); hours -= h; if (tutor.on && tutor.run && tutCheck()) break; } handle(ev); },
    start: m => startGame(m || 'free'), mirai: () => miraiStart(), mnext: () => miraiAdvance(), mseason: () => miraiNext(), get mir() { return mir; }, place: (k, r, c, talk) => miraiPlace(k, { r, c }, talk), tut: () => tutStart(), stage: i => stageStart(i), run1: () => stageRun(), get stg() { return stg; }, select, tap: (r, c) => onTap({ r, c }), coachTap, toggle: toggleThermal, store
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
