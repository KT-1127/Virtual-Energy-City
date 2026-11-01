/* エネルギーシティ ― 町と電気のしくみ（画面を使わないので Node でもテストできる）
   1日＝1年。時間は止まらずに流れ、そのつど「使う量」と「つくる量」をくらべる。 */
(function (g) {
const EC = g.EC, C = EC.CFG, P = C.plants;
const N = C.map.length;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = a => a.reduce((x, y) => x + y, 0);
const lerp24 = (a, h) => { const i = Math.floor(h) % 24, f = h - Math.floor(h); return a[i] * (1 - f) + a[(i + 1) % 24] * f; };

/* ---------- 乱数（シード付き） ---------- */
EC.rng = function (seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
EC.hash = function (s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/* ---------- 地形 ---------- */
const inMap = (r, c) => r >= 0 && c >= 0 && r < N && c < N;
function around(S, r, c, d, fn) { for (let R = r - d; R <= r + d; R++) for (let Cc = c - d; Cc <= c + d; Cc++) if ((R !== r || Cc !== c) && inMap(R, Cc)) fn(S.tiles[R][Cc], R, Cc); }
EC.coastal = (S, r, c) => { let k = false; around(S, r, c, 1, t => { if (t.t === '~') k = true; }); return k; };
EC.placeKinds = function (S, r, c) {
  const t = S.tiles[r][c].t, k = [];
  if (t === 'g') { k.push('plain'); if (EC.coastal(S, r, c)) k.push('coast'); }
  if (t === 'm') k.push('mountain');
  if (t === 'r') { k.push('river'); let up = false; around(S, r, c, 2, u => { if (u.t === 'm' || u.t === 'o') up = true; }); if (up) k.push('upriver'); }
  return k;
};
const hallDist = (r, c) => Math.hypot(r - C.hall[0], c - C.hall[1]);

/* ---------- はじめる ---------- */
// opt.tutorial：チュートリアルの町（台本どおりの天気・すぐ完成・町は大きくならない）
EC.newGame = function (seed, opt) {
  opt = opt || {};
  const TU = opt.stage || (opt.tutorial ? C.tutorial : null);
  seed = seed == null ? String(Math.random()) : String(seed);
  const S = {
    seed, rng: EC.rng(EC.hash(seed)), nextId: 1, tut: !!TU,
    tiles: C.map.map(row => [...row].map(t => ({ t, b: null }))),
    plants: [], houses: 0, factories: 0, townVer: 0,
    year: C.startYear, hour: TU && TU.startHour != null ? TU.startHour : C.startHour, money: TU ? TU.money : C.startMoney, hp: 100, earth: C.startEarth,
    bE: 0, bCap: 0, bPow: 0, cost: { solar: P.solar.cost },
    unlocked: new Set(TU ? TU.unlock : C.order.filter(k => P[k].unlock <= C.startYear)),
    save: { left: 0, used: false }, coinAcc: 0, inBlack: false, broke: false,
    base: null, blackoutHours: 0, blackoutYears: 0, mixDays: 0, hist: [], over: null, score: 0,
    anger: 0, worried: new Map(), onsenAngry: new Set(), now: null, pred: null, lastPred: 0,
    script: TU ? TU.days : null, instant: !!TU, noGrowth: !!TU, hpFloor: TU ? 25 : 0, baseFix: TU ? (TU.base || 580) : null
  };
  const id = () => S.nextId++;
  S.tiles[C.hall[0]][C.hall[1]].b = { kind: 'hall', id: id() };
  (opt.stage ? [] : C.startPlants).forEach(([r, c, type, retire]) => {
    const b = { kind: 'plant', type, r, c, id: id(), left: 0, old: !!retire, retire: retire || null, out: 0, mode: 'on', warm: 1 };
    S.tiles[r][c].b = b; S.plants.push(b);
  });
  if (TU) TU.plants.forEach(([r, c, type]) => { const b = { kind: 'plant', type, r, c, id: id(), left: 0, out: 0, mode: 'on', warm: 1, built: C.startYear }; S.tiles[r][c].b = b; S.plants.push(b); });
  // 家（役場のまわり）
  const cand = [];
  S.tiles.forEach((row, r) => row.forEach((t, c) => { if (t.t === 'g' && !t.b) cand.push([hallDist(r, c) + S.rng() * 0.6, r, c]); }));
  cand.sort((a, b) => a[0] - b[0]).slice(0, TU ? TU.houses : C.startHouses).forEach(([, r, c]) => addHouseAt(S, r, c));
  // 木（町から遠い平地）
  S.tiles.forEach((row, r) => row.forEach((t, c) => { if (t.t === 'g' && !t.b && hallDist(r, c) > 3.6 && S.rng() < 0.22) t.b = { kind: 'tree', id: id(), r, c }; }));
  recalc(S);
  S.forecast = { year: C.startYear, weather: 'sunny', events: [] };
  newDay(S, []);
  return S;
};

function addHouseAt(S, r, c) {
  const t = S.tiles[r][c];
  t.b = { kind: 'house', id: S.nextId++, r, c, col: Math.floor(S.rng() * C.houseColors.length) };
  S.houses++; S.townVer++;
  return t.b;
}

/* ---------- 建てる・こわす ---------- */
// 建てられない理由：locked / occupied / where / money（null なら建てられる）
EC.canPlace = function (S, type, r, c) {
  if (!inMap(r, c)) return 'where';
  if (!S.unlocked.has(type)) return 'locked';
  const b = S.tiles[r][c].b;
  if (b && b.kind !== 'tree') return 'occupied';
  const kinds = EC.placeKinds(S, r, c);
  if (!P[type].where.some(w => kinds.includes(w))) return 'where';
  if (S.money < EC.cost(S, type)) return 'money';
  return null;
};
EC.cost = (S, type) => S.cost[type] != null ? S.cost[type] : P[type].cost;
// 建ててもいいけれど、町の人が反対する場所（けむり・音・不安・温泉）
EC.placeWarn = function (S, type, r, c) {
  const rule = C.accept[type];
  if (rule) { let k = false; around(S, r, c, rule.r, t => { if (t.b && t.b.kind === 'house') k = true; }); if (k) return rule.key; }
  if (type === 'geo') { let k = false; around(S, r, c, 1, t => { if (t.t === 'o') k = true; }); if (k) return 'onsen'; }
  return null;
};
EC.build = function (S, type, r, c) {
  const why = EC.canPlace(S, type, r, c);
  if (why) return { why };
  const t = S.tiles[r][c], tree = t.b && t.b.kind === 'tree';
  S.money -= EC.cost(S, type);
  const b = { kind: 'plant', type, r, c, id: S.nextId++, left: S.instant ? 0 : P[type].build, out: 0, built: S.year, mode: 'on', warm: 1 };
  t.b = b; S.plants.push(b);
  if (!b.left) activate(S, b);
  recalc(S);
  return { b, tree };
};
EC.recalc = S => recalc(S);
EC.demolish = function (S, r, c) {
  const t = S.tiles[r][c], b = t.b;
  if (!b || b.kind !== 'plant') return false;
  t.b = null; S.plants = S.plants.filter(p => p !== b);
  recalc(S);
  return true;
};
// 火力を休ませる・起こす（起きるまで少し時間がかかる）
EC.setMode = function (S, p, mode) {
  if (!p || p.type !== 'thermal' || p.left) return false;
  if (p.mode === mode) return false;
  p.mode = mode;
  if (mode === 'rest') p.warm = 0;
  return true;
};
function activate(S, b) { if (b.type === 'nuclear') b.nextInspect = S.year + C.inspectEvery; b.warm = 1; }
function recalc(S) {
  const act = S.plants.filter(p => !p.left && p.type === 'battery');
  S.bCap = act.length * P.battery.store; S.bPow = act.length * P.battery.cap; S.bE = Math.min(S.bE, S.bCap);
  S.anger = 0; S.worried = new Map(); S.onsenAngry = new Set();
  S.plants.forEach(p => {
    const rule = C.accept[p.type];
    if (rule) {
      let near = false;
      around(S, p.r, p.c, rule.r, t => { if (t.b && t.b.kind === 'house') { near = true; S.worried.set(t.b.id, p.type); } });
      if (near) S.anger += rule.hp;
    }
    if (p.type === 'geo') around(S, p.r, p.c, 1, (t, R, Cc) => { if (t.t === 'o') { S.anger += C.hp.angerOnsen; S.onsenAngry.add(R * N + Cc); } });
  });
}

/* ---------- 天気・できごと ---------- */
function rollForecast(S) {
  const y = S.year + 1, r = EC.rng(EC.hash(S.seed + ':' + y));
  const hot = S.earth >= C.extreme.at;
  const ws = Object.entries(C.weather).filter(([, w]) => !w.from || y >= w.from).map(([k, w]) => {
    let wt = w.w; if (hot && C.extreme[k]) wt *= C.extreme[k]; return [k, wt];
  });
  let x = r() * sum(ws.map(a => a[1])), weather = ws[0][0];
  for (const [k, wt] of ws) { x -= wt; if (x <= 0) { weather = k; break; } }
  const events = [];
  if (C.order.some(k => P[k].unlock === y)) events.push('unlock');
  if (S.plants.some(p => p.retire === y)) events.push('retire');
  if (C.cheapYears.includes(y)) events.push('cheap');
  if (S.plants.some(p => p.type === 'nuclear' && p.left <= 1 && (p.nextInspect || y + C.inspectEvery + Math.max(0, p.left - 1)) === y)) events.push('inspect');
  const has = k => S.plants.some(p => p.type === k && p.left <= 1);
  ['fuel', 'trip', 'quake'].forEach(k => {
    const e = C.events[k];
    if (y < e.from || r() >= e.p) return;
    if (k === 'trip' && !has('thermal')) return;
    if (k === 'quake' && !has('nuclear') && !has('thermal')) return;
    events.push(k);
  });
  return { year: y, weather, events };
}
function scriptDay(S, year) {
  const d = S.script[year - C.startYear];
  return d ? { year, weather: d.weather, events: d.events || [], wind: d.wind } : null;
}

function newDay(S, ev) {
  const calm = y => ({ year: y, weather: 'sunny', events: [] });   // 台本のあとは何も起きない日
  const today = S.script ? (scriptDay(S, S.year) || calm(S.year)) : S.forecast;
  today.events.forEach(k => {
    if (k === 'unlock') { const ts = C.order.filter(t => P[t].unlock === S.year); ts.forEach(t => S.unlocked.add(t)); ev.push({ k: 'unlock', types: ts }); }
    if (k === 'cheap') S.cost.solar = Math.max(8, S.cost.solar - C.cheapBy);
  });
  setupDay(S, today, EC.rng(EC.hash(S.seed + ':day:' + S.year)));
  S.forecast = S.script ? (scriptDay(S, S.year + 1) || calm(S.year + 1)) : rollForecast(S);
  ev.push({ k: 'newDay', today });
}
// 1日の天気・風・雲・記録を用意する（ストレステストでも使う）
function setupDay(S, today, r) {
  S.today = today;
  const w = C.weather[today.weather];
  S.fx = Object.assign({ dem: 1, sun: 1, wind: 1, hydro: 1, fuel: 1 }, w.fx);
  S.plants.forEach(p => { p.off = null; });
  today.events.forEach(k => {
    if (k === 'fuel') Object.assign(S.fx, C.events.fuel.fx);
    if (k === 'inspect') S.plants.forEach(p => { if (p.type === 'nuclear' && !p.left && p.nextInspect === S.year) { p.off = 'inspect'; p.nextInspect += C.inspectEvery; } });
    if (k === 'quake') { S.plants.forEach(p => { if (p.type === 'nuclear' && !p.left) p.off = 'quake'; }); tripOne(S, r, 'quake'); }
    if (k === 'trip') tripOne(S, r, 'trip');
    if (k === 'down') S.plants.forEach(p => { if (p.type === 'nuclear' && !p.left) p.off = 'inspect'; });
  });
  const base = today.wind != null ? today.wind : C.windBase * S.fx.wind, ph = r() * 6;   // 1日の 中の ゆらぎは 平均を 変えない
  let n = 0;
  S.W = Array.from({ length: 24 }, (_, h) => { n = n * 0.6 + (r() - 0.5) * 0.25; return clamp(base * (0.75 + 0.5 * Math.sin(h / 3.8 + ph)) + n * base * (today.wind != null ? 0.3 : 1), 0, 1.6); });
  const [cnt, rad, dark] = w.clouds;
  S.clouds = Array.from({ length: cnt }, () => ({ x: -3 + r() * 17, z: -1 + r() * 13, r: rad * (0.8 + r() * 0.4), dark, vz: (r() - 0.5) * 0.15 }));
  S.save = { left: 0, used: false };
  S.log = { D: z24(), short: z24(), curt: z24(), charge: z24(), imp: z24(), exp: z24(), gen: Object.fromEntries(C.stack.map(k => [k, z24()])) };
  S.day = { coins: 0, fuel: 0, grams: 0, earth0: S.earth, broke: false, upkeep: 0 };
}
const z24 = () => new Array(24).fill(0);
function tripOne(S, r, why) {
  const th = S.plants.filter(p => p.type === 'thermal' && !p.left && !p.off);
  if (!th.length) return;
  const old = th.filter(p => p.old), pick = (old.length ? old : th)[Math.floor(r() * (old.length || th.length))];
  pick.off = why;
}

/* ---------- 雲と日ざし ---------- */
EC.sunAt = h => (h > C.sun.rise && h < C.sun.set) ? Math.sin(Math.PI * (h - C.sun.rise) / (C.sun.set - C.sun.rise)) : 0;   // 空の 明るさ（見た目）
EC.solarAt = h => lerp24(C.solarShape, h) * C.solarPeak;   // 太陽光の 出力（東京エリア 2024年の 晴れの日の 形）
function moveClouds(S, dtH, wind) {
  S.clouds.forEach(cl => {
    cl.x += (0.5 + wind * 1.6) * dtH; cl.z += cl.vz * dtH;
    if (cl.x > N + 3) { cl.x = -4; cl.z = -1 + S.rng() * 13; }
    if (cl.z < -2) cl.z = N + 1; if (cl.z > N + 2) cl.z = -1;
  });
}
EC.shadeAt = function (S, r, c) {
  let f = 1;
  S.clouds.forEach(cl => {
    const d = Math.hypot(c - cl.x, r - cl.z); if (d >= cl.r) return;
    const s = cl.dark ? 0.15 : C.cloudShade, k = clamp((d - cl.r * 0.7) / (cl.r * 0.3), 0, 1);
    f = Math.min(f, s + (1 - s) * k);
  });
  return f;
};

/* ---------- 時間をすすめる（dtH 時間ぶん） ---------- */
// ev にできごと（UI・演出用）を入れて返す
EC.tick = function (S, dtH, ev) {
  if (S.over) return ev;
  const h = S.hour, fx = S.fx, hi = Math.min(23, Math.floor(h)), TH = C.thermal;
  let D = (S.houses * C.demand.house + S.factories * C.demand.factory) * lerp24(C.demandShape, h) * fx.dem;
  if (S.save.left > 0) { D *= 1 - C.save.cut; S.save.left = Math.max(0, S.save.left - dtH); }   // 📢節電（町づくりだけ。20%は 根拠を 確かめていない）
  const sun = EC.solarAt(h) * fx.sun, wind = lerp24(S.W, h);
  const storm = S.today.weather === 'typhoon' && h >= 8 && h <= 22;   // 台風の間、風車は安全のため止める
  moveClouds(S, dtH, wind);

  const g = { nuclear: 0, geo: 0, hydro: 0, wind: 0, solar: 0, battery: 0, thermal: 0 }, awake = [];
  for (const p of S.plants) {
    p.out = 0; p.cut = false; p.shade = 1; p.waste = false;
    if (p.left > 0 || p.off) continue;
    const cap = P[p.type].cap;
    switch (p.type) {
      case 'solar': p.shade = EC.shadeAt(S, p.r, p.c); p.out = cap * sun; break;   // 雲の 影は 見た目だけ（天気の 倍率に ふくまれる）
      case 'wind': { const w = Math.min(1, wind); p.cut = storm; p.out = storm ? 0 : cap * w; break; }
      case 'hydro': p.out = cap * C.hydroCF; break;
      case 'geo': case 'nuclear': p.out = cap; break;
      case 'thermal':
        if (p.mode === 'rest') continue;
        if (p.warm < 1) { p.warm = Math.min(1, p.warm + dtH / TH.warmup); if (p.warm >= 1) ev.push({ k: 'warm', p }); }
        awake.push(p); continue;
      default: continue;
    }
    g[p.type] += p.out;
  }
  // 起きている火力は、最低でも minLoad だけ発電し続ける（すぐには止められない）
  const thMax = sum(awake.map(p => P.thermal.cap * p.warm)), thMin = thMax * TH.minLoad;
  const rate = C.fuel * fx.fuel, afford = S.money / (rate * dtH);
  const must = g.nuclear + g.geo + g.hydro + g.wind + g.solar;
  let short = 0, curt = 0, charge = 0, imp = 0, exp = 0, th = Math.min(thMin, afford);
  const eff = C.batteryEff;
  S.broke = th < thMin - 1e-6;
  if (must + th >= D) {
    const sur = must + th - D;
    charge = Math.min(sur, S.bPow, Math.max(0, (S.bCap - S.bE) / (eff * dtH)));
    S.bE += charge * eff * dtH; curt = sur - charge;
    let left = curt;
    for (const k of C.curtail) {
      const x = Math.min(left, g[k]); if (x <= 0) continue;
      const ratio = (g[k] - x) / g[k];
      S.plants.forEach(p => { if (p.type === k) { p.out *= ratio; if (x > 0.05) p.waste = true; } });
      g[k] -= x; left -= x;
    }
  } else {
    let need = D - must - th;
    // thFirst（おまけ「町の地図で 2050年へ」）：🔥を 先に 上げ、ためた 電気は 🔥でも 足りない ときの ために とっておく
    if (S.thFirst) { const ex = Math.min(need, thMax - th, Math.max(0, afford - th)); th += ex; need -= ex; }
    const dis = Math.min(need, S.bPow, S.bE / dtH); S.bE -= dis * dtH; need -= dis; g.battery = dis;
    const extra = Math.min(need, thMax - th, Math.max(0, afford - th));
    if (afford - th < Math.min(need, thMax - th) - 1e-6) S.broke = true;
    th += extra; need -= extra;
    short = need > 1e-6 ? need : 0;
  }
  g.thermal = th;
  awake.forEach(p => { p.out = thMax ? th * (P.thermal.cap * p.warm) / thMax : 0; });
  const fuel = (th * rate + g.nuclear * C.fuelNuc) * dtH; S.money = Math.max(0, S.money - fuel); S.day.fuel += fuel;
  if (S.broke) S.day.broke = true;

  // お金・町の元気・地球
  const sf = D > 0 ? short / D : 0;
  const inc = (S.houses * C.income.house + S.factories * C.income.factory) * (1 - sf) * dtH;
  let up = 0; S.plants.forEach(p => { if (!p.left) up += P[p.type].upkeep * (p.type === 'thermal' && p.mode === 'rest' ? 0.5 : 1); });
  S.money = Math.max(0, S.money + inc - up / 24 * dtH); S.day.upkeep += up / 24 * dtH;
  S.day.coins += inc; S.coinAcc += inc;
  if (S.coinAcc >= 1) { const n = Math.floor(S.coinAcc); S.coinAcc -= n; ev.push({ k: 'coin', n }); }
  if (sf > 0.005) S.hp -= C.hp.drain * sf * dtH; else S.hp += C.hp.regen * dtH;
  S.hp -= S.anger * dtH;
  S.hp = clamp(S.hp, S.hpFloor, 100);
  let grams = 0; C.stack.forEach(k => { grams += g[k] * P[k].co2; });
  S.day.grams += grams * dtH;
  S.earth = Math.max(C.earth.floor, S.earth + (grams * C.earth.perGram - C.earth.decay) * dtH);

  // 記録（1時間ごと）
  const L = S.log;
  L.D[hi] += D * dtH; L.short[hi] += short * dtH; L.curt[hi] += curt * dtH; L.charge[hi] += charge * dtH; L.imp[hi] += imp * dtH; L.exp[hi] += exp * dtH;
  C.stack.forEach(k => { L.gen[k][hi] += g[k] * dtH; });
  // まだ出せる余裕（起きている火力の残り＋蓄電池の残り）：メーターにうすく出す
  const batLeft = S.bE > 0.1 ? Math.max(0, S.bPow - g.battery) : 0;
  S.now = { D, g, short, curt, charge, must, sun, wind, sf, soc: S.bCap ? S.bE / S.bCap : 0,
    spare: (S.money > 1 ? Math.max(0, thMax - th) : 0) + batLeft, thMin: th > 0 ? Math.min(th, thMin) : 0 };

  if (sf > 0.02 && !S.inBlack) { S.inBlack = true; ev.push({ k: 'blackStart' }); }
  else if (sf < 0.005 && S.inBlack) { S.inBlack = false; ev.push({ k: 'blackEnd' }); }

  // 時計
  const before = Math.floor(h);
  S.hour += dtH;
  if (Math.floor(S.hour) !== before && S.hour < 24) ev.push({ k: 'hour', h: Math.floor(S.hour) });
  if (S.hp <= 0) { S.over = 'hp'; ev.push({ k: 'over', why: 'hp' }); return ev; }
  if (S.earth >= 100) { S.earth = 100; S.over = 'earth'; ev.push({ k: 'over', why: 'earth' }); return ev; }
  if (S.hour >= 24) { S.hour -= 24; endDay(S, ev); }
  return ev;
};

/* ---------- 節電おねがい ---------- */
EC.useSave = function (S) {
  if (S.over || S.save.used) return false;
  S.save.used = true; S.save.left = C.save.hours; S.hp = Math.max(1, S.hp - C.save.hp);
  return true;
};

/* ---------- よそう（今日、停電すると思う？） ---------- */
EC.predictWorthy = function (S) {
  if (S.tut || S.year < C.startYear + 1) return false;
  if (S.lastPred && S.year - S.lastPred < C.predictEvery) return false;
  const w = S.today.weather, e = S.today.events, has = k => S.plants.some(p => p.type === k && !p.left);
  return (w === 'calm' && has('wind')) || ((w === 'cloudy' || w === 'rain') && has('solar')) || w === 'typhoon' || w === 'heat'
    || e.some(k => k === 'inspect' || k === 'trip' || k === 'quake');
};
EC.predict = function (S, yes) { S.pred = { year: S.year, yes }; S.lastPred = S.year; };

/* ---------- 1日（1年）のおわり ---------- */
function endDay(S, ev) {
  const L = S.log, E = {};
  C.stack.forEach(k => { E[k] = sum(L.gen[k]); });
  const demE = sum(L.D), shortE = sum(L.short), served = Math.max(1, demE - shortE);
  const shortHours = []; for (let i = 0; i < 24; i++) if (L.short[i] > 0.02 * Math.max(1, L.D[i])) shortHours.push(i);
  const bh = shortHours.length;
  const intensity = S.day.grams / served;
  if (S.base == null) S.base = S.baseFix || intensity;
  const ratio = intensity / S.base;
  const kinds = C.stack.filter(k => k !== 'battery' && E[k] >= 0.08 * served);
  const peakH = L.D.indexOf(Math.max(...L.D));
  let mvp = null, best = 0; C.stack.forEach(k => { if (L.gen[k][peakH] > best) { best = L.gen[k][peakH]; mvp = k; } });
  const hard = S.today.weather !== 'sunny' || S.today.events.some(e => ['fuel', 'trip', 'quake', 'inspect'].includes(e));
  let bonus = 0;
  if (!bh && hard && kinds.length >= 3) { bonus = C.mixBonus * kinds.length; S.money += bonus; S.mixDays++; }
  // よそうの答え合わせ
  let pred = null;
  if (S.pred && S.pred.year === S.year) { pred = { yes: S.pred.yes, ok: S.pred.yes === bh > 0 }; if (pred.ok) S.money += C.predBonus; S.pred = null; }
  // その日の点数
  const SC = C.score;
  let pts = bh ? -SC.blackHour * bh : SC.day;
  pts += Math.round(clamp(1 - ratio, 0, 1) * SC.clean) + (kinds.length >= 3 ? kinds.length * SC.kind : 0) + (bonus ? SC.mix : 0) + (pred && pred.ok ? SC.pred : 0);
  S.score = Math.max(0, S.score + pts);
  const sum0 = { year: S.year, bh, shortHours, coins: Math.round(S.day.coins), fuel: Math.round(S.day.fuel), earthD: S.earth - S.day.earth0,
    ratio, kinds, mvp, peakH, bonus, pred, pts, E, served, demE, curtE: sum(L.curt), weather: S.today.weather, events: S.today.events.slice(),
    cause: bh ? cause(S, shortHours) : null, log: L, houses0: S.houses };
  S.blackoutHours += bh; if (bh) S.blackoutYears++;
  S.hist.push(sum0);
  ev.push({ k: 'dayEnd', sum: sum0 });

  // 2030年の目標
  if (S.year === 2030 && !S.tut) {
    const ok = ratio <= C.goal2030; S.goal2030 = ok;
    if (ok) S.money += C.bonus2030;
    ev.push({ k: 'goal2030', ok });
  }
  // 町の成長
  if (!S.noGrowth) {
    if (!bh) {
      const add = S.hp >= C.growth.hpGood ? C.growth.good : C.growth.ok; let m = 0;
      for (let i = 0; i < add; i++) { const t = growHouse(S, ev); if (t) m++; }
      if (add && !m) ev.push({ k: 'noLand' });
      const need = C.factoryAt.filter(x => S.houses >= x).length;
      if (S.factories < need && S.hp >= 50) growFactory(S, ev);
    } else {
      let k = Math.min(3, Math.ceil(bh / 2));
      while (k-- > 0) leaveHouse(S, ev);
    }
  }
  sum0.houses1 = S.houses;
  // 建設
  S.plants.forEach(p => { if (p.left > 0) { p.left--; if (!p.left) { activate(S, p); ev.push({ k: 'built', p }); } } });
  // 次の年へ
  S.year++;
  if (S.year > C.endYear) { S.over = 'win'; recalc(S); ev.push({ k: 'over', why: 'win' }); return; }
  S.plants.filter(p => p.retire && p.retire <= S.year).forEach(p => { S.tiles[p.r][p.c].b = null; ev.push({ k: 'retired', p }); });
  S.plants = S.plants.filter(p => !(p.retire && p.retire <= S.year));
  recalc(S);
  newDay(S, ev);
}

function cause(S, hrs) {
  const ev = S.today.events, has = k => S.plants.some(p => p.type === k && !p.left);
  if (ev.includes('quake') && has('nuclear')) return 'quake';
  if (ev.includes('inspect')) return 'inspect';
  if (S.day.broke) return 'broke';
  if (ev.includes('trip')) return 'trip';
  const w = S.today.weather, day = hrs.some(h => h >= 8 && h <= 16);
  if (w === 'typhoon') return 'typhoon';
  if (w === 'calm' && has('wind')) return 'calm';
  if ((w === 'cloudy' || w === 'rain') && has('solar') && day) return 'cloud';
  if (w === 'heat') return 'heat';
  if (S.plants.some(p => p.type === 'thermal' && !p.left && !p.off && p.mode === 'rest')) return 'rest';
  if (hrs.some(h => h >= 16 && h <= 20)) return has('solar') ? 'dusk' : 'base';
  if (hrs.some(h => h >= 21 || h < 6)) return 'night';
  return 'base';
}

// 家は、けむり・音・原子力の近くには建たない
function nearRule(S, r, c) {
  let k = false;
  S.plants.forEach(p => { const rule = C.accept[p.type]; if (rule && Math.max(Math.abs(p.r - r), Math.abs(p.c - c)) <= rule.r) k = true; });
  return k;
}
function growHouse(S, ev) {
  let best = null, bd = 1e9;
  S.tiles.forEach((row, r) => row.forEach((t, c) => {
    if (t.t !== 'g' || (t.b && t.b.kind !== 'tree')) return;
    let adj = false;
    around(S, r, c, 1, u => { if (u.b && (u.b.kind === 'house' || u.b.kind === 'factory' || u.b.kind === 'hall')) adj = true; });
    if (!adj || nearRule(S, r, c)) return;
    const d = hallDist(r, c) + S.rng() * 0.9;
    if (d < bd) { bd = d; best = [r, c]; }
  }));
  if (!best) return null;
  const tree = S.tiles[best[0]][best[1]].b;
  const b = addHouseAt(S, best[0], best[1]);
  ev.push({ k: 'houseAdd', b, tree: !!tree });
  return b;
}
function growFactory(S, ev) {
  let best = null, bd = 1e9;
  S.tiles.forEach((row, r) => row.forEach((t, c) => {
    if (t.t !== 'g' || (t.b && t.b.kind !== 'tree')) return;
    let adj = false; around(S, r, c, 1, u => { if (u.b && u.b.kind === 'house') adj = true; });
    if (!adj) return;
    const d = hallDist(r, c) + S.rng() * 0.5; if (d < bd) { bd = d; best = [r, c]; }
  }));
  if (!best) return;
  const t = S.tiles[best[0]][best[1]];
  t.b = { kind: 'factory', id: S.nextId++, r: best[0], c: best[1] }; S.factories++; S.townVer++;
  ev.push({ k: 'factoryAdd', b: t.b });
}
function leaveHouse(S, ev) {
  if (S.houses <= 4) return;
  let worst = null, wd = -1;
  S.tiles.forEach((row, r) => row.forEach((t, c) => { if (t.b && t.b.kind === 'house') { const d = hallDist(r, c); if (d > wd) { wd = d; worst = t; } } }));
  if (!worst) return;
  ev.push({ k: 'houseLeave', b: worst.b });
  worst.b = null; S.houses--; S.townVer++;
  recalc(S);
}

/* ---------- 停電する家の順番（町の外側から） ---------- */
EC.townOrder = function (S) {
  const list = [];
  S.tiles.forEach((row, r) => row.forEach((t, c) => { if (t.b && (t.b.kind === 'house' || t.b.kind === 'factory')) list.push([hallDist(r, c), t.b.id]); }));
  return list.sort((a, b) => b[0] - a[0]).map(a => a[1]);
};

/* ---------- ストレステスト：あなたの町を、きびしい1日でためす ---------- */
EC.stressTest = function (S0, sc) {
  const S = Object.assign({}, S0);
  S.plants = S0.plants.filter(p => !p.left).map(p => Object.assign({}, p, { off: null, mode: 'on', warm: 1 }));
  Object.assign(S, { rng: EC.rng(EC.hash('stress:' + sc.id)), money: 1e7, hp: 1e9, hpFloor: 0, earth: 0, over: null, coinAcc: 0, inBlack: false,
    hour: 0, bE: S0.bCap * 0.5, pred: null, hist: [], anger: 0 });
  setupDay(S, { year: S.year, weather: sc.weather || 'sunny', events: [], wind: sc.wind }, EC.rng(EC.hash('stressday:' + sc.id)));
  Object.assign(S.fx, sc.fx || {});
  S.save = { left: 0, used: true };
  if (sc.down) {
    let big = null; S.plants.forEach(p => { if (p.type !== 'battery' && p.type !== 'solar' && p.type !== 'wind' && (!big || P[p.type].cap > P[big.type].cap)) big = p; });
    if (big) big.off = 'down';
    sc.downType = big ? big.type : null;
  }
  const ev = [];
  while (S.hour < 23.95 && !S.over) EC.tick(S, Math.min(0.1, 23.95 - S.hour), ev);
  let bh = 0; for (let i = 0; i < 24; i++) if (S.log.short[i] > 0.02 * Math.max(1, S.log.D[i])) bh++;
  return { bh, fuel: Math.round(S.day.fuel), down: sc.downType || null, log: S.log };
};

/* ---------- 結果 ---------- */
EC.result = function (S) {
  const last = S.hist[S.hist.length - 1], ratio = last ? last.ratio : 1, win = S.over === 'win';
  const stars = win ? 1 + (ratio <= C.stars.co2 ? 1 : 0) + (S.blackoutYears <= C.stars.blackoutYears ? 1 : 0) : 0;
  const score = Math.max(0, Math.round(S.score + S.houses * 60 + S.factories * 200 + clamp(1 - ratio, 0, 1) * 1500));
  const rank = !win ? 'C' : stars === 3 ? 'S' : stars === 2 ? 'A' : 'B';
  const mix = {}; if (last) C.stack.filter(k => k !== 'battery').forEach(k => { mix[k] = last.E[k] / last.served * 100; });
  const avgFuel = S.hist.length ? sum(S.hist.map(h => h.fuel)) / S.hist.length : 0;
  const radar = {
    stable: clamp(100 - S.blackoutHours * 3, 0, 100),
    env: clamp((1 - ratio) * 100, 0, 100),
    money: clamp(100 - avgFuel * 2.2, 0, 100),
    safe: clamp(S.hp, 0, 100)
  };
  return { win, stars, score, rank, ratio, mix, radar, why: S.over };
};
})(typeof window !== 'undefined' ? window : globalThis);
