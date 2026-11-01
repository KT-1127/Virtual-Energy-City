/* エネルギーシティ ― 需給シミュレーション（DOMを使わないのでNodeでもテストできる） */
(function () {
const EC = (typeof window !== 'undefined' ? window : globalThis).EC;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = a => a.reduce((x, y) => x + y, 0);

/* ---------- シード付き乱数（「今日のステージ」で全員同じ条件にする） ---------- */
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

/* ---------- 1日の条件をつくる ---------- */
// o: { n:稼働中の基数, houses, factories, ev, stage, rng }
EC.makeDay = function (o) {
  const B = EC.BALANCE, se = EC.SEASONS[o.stage.season];
  const fx = Object.assign({ dem: 1, sun: 1, wind: 1, fuel: 1, nuc: 1, hydro: 1, trip: 0 }, o.ev.fx);
  const r = o.rng, R = (a, b) => a + r() * (b - a);
  const D = se.home.map((v, h) => o.houses * B.demand.house * v * fx.dem + o.factories * B.demand.factory * se.factory(h));
  const wb = fx.wind * (o.stage.wind || 1) * R(0.3, 0.6), ph = R(0, 6);
  const W = D.map((_, h) => clamp(wb * (0.75 + 0.5 * Math.sin(h / 3.8 + ph) + R(-0.12, 0.12)), 0, 1));
  const SUN = D.map((_, h) => (h > se.sunStart && h < se.sunEnd)
    ? Math.sin(Math.PI * (h - se.sunStart) / (se.sunEnd - se.sunStart)) * se.sunMax * fx.sun * R(0.85, 1) : 0);
  const n = Object.assign({}, o.n);
  if (fx.trip) n.thermal = Math.max(0, n.thermal - fx.trip);
  return { D, W, SUN, fx, n, fuelMul: fx.fuel * (o.stage.fuel || 1), season: se };
};

/* ---------- 1日の運転 ---------- */
EC.newRun = function (p) {
  const P = EC.PLANTS, B = EC.BALANCE;
  const bCap = p.n.battery * P.battery.store, bPow = p.n.battery * P.battery.cap;
  const log = { D: [], gen: {}, short: [], curt: [], soc: [], ramp: [], charge: [], nukeCurt: [], vreRaw: [], fuel: [], thMax: [] };
  EC.STACK.forEach(k => (log.gen[k] = []));
  return { p, h: 0, bE: bCap * B.battery.startSoc, bCap, bPow, thPrev: null, ctrl: { save: 0, boost: 0, hold: false }, log };
};

// 1時間すすめる。止められない電源 → 余れば充電・それでも余れば捨てる → 足りなければ蓄電池・火力 → それでも足りなければ停電
EC.stepHour = function (run) {
  const B = EC.BALANCE, P = EC.PLANTS, p = run.p, n = p.n, fx = p.fx, c = run.ctrl, h = run.h, L = run.log;
  const d = p.D[h] * (c.save > 0 ? 1 - B.actions.save.cut : 1);
  const g = {
    nuclear: n.nuclear * P.nuclear.cap * P.nuclear.cf * fx.nuc,
    geo: n.geo * P.geo.cap * P.geo.cf,
    hydro: n.hydro * P.hydro.cap * P.hydro.cf * fx.hydro,
    wind: n.wind * P.wind.cap * p.W[h],
    solar: n.solar * P.solar.cap * p.SUN[h],
    battery: 0, thermal: 0
  };
  const vreRaw = g.wind + g.solar;
  const must = g.nuclear + g.geo + g.hydro + g.wind + g.solar;
  let short = 0, curt = 0, charge = 0, ramp = false, nukeCurt = 0, thMax = 0;
  if (must >= d) {
    const sur = must - d;
    charge = Math.min(sur, run.bPow, (run.bCap - run.bE) / B.battery.eff);
    run.bE += charge * B.battery.eff;
    curt = sur - charge;
    let left = curt;
    for (const k of EC.CURTAIL) { const x = Math.min(left, g[k]); g[k] -= x; left -= x; if (k === 'nuclear') nukeCurt = x; }
    run.thPrev = 0;
  } else {
    let need = d - must;
    const cap = n.thermal * P.thermal.cap * (c.boost > 0 ? B.actions.boost.cap : 1);
    const rampMax = (c.boost > 0 || run.thPrev === null) ? Infinity : run.thPrev + n.thermal * P.thermal.cap * B.thermalRamp;
    thMax = Math.min(cap, rampMax);
    const useBat = x => { const dis = Math.min(x, run.bPow, run.bE); run.bE -= dis; g.battery += dis; return x - dis; };
    const useTh = x => { const t = Math.min(x, thMax); g.thermal = t; return x - t; };
    // ふだんは蓄電池が先（燃料の節約）。温存中は火力が先で、蓄電池は最後の手段
    if (c.hold) { need = useTh(need); need = useBat(need); } else { need = useBat(need); need = useTh(need); }
    if (need > 1e-6 && rampMax < cap && g.thermal >= rampMax - 1e-6) ramp = true;
    short = need > 1e-6 ? need : 0;
    run.thPrev = g.thermal;
  }
  const fuel = g.thermal * B.fuelPrice * p.fuelMul * (c.boost > 0 ? B.actions.boost.fuel : 1);
  const rec = { h, d, g, short, curt, charge, ramp, nukeCurt, vreRaw, fuel, thMax, soc: run.bCap ? run.bE / run.bCap : 0 };
  if (L) {
    L.D.push(d); EC.STACK.forEach(k => L.gen[k].push(g[k]));
    L.short.push(short); L.curt.push(curt); L.soc.push(rec.soc); L.ramp.push(ramp); L.charge.push(charge);
    L.nukeCurt.push(nukeCurt); L.vreRaw.push(vreRaw); L.fuel.push(fuel); L.thMax.push(thMax);
  }
  if (c.save > 0) c.save--;
  if (c.boost > 0) c.boost--;
  run.h++;
  return rec;
};

// この先 k 時間でピンチ（停電）になりそうな最初の時刻。なければ -1
EC.peek = function (run, k) {
  const sim = { p: run.p, h: run.h, bE: run.bE, bCap: run.bCap, bPow: run.bPow, thPrev: run.thPrev, ctrl: Object.assign({}, run.ctrl), log: null };
  for (let i = 0; i < k && sim.h < 24; i++) { const r = EC.stepHour(sim); if (r.short > 0.05) return r.h; }
  return -1;
};

/* ---------- 1日の集計 ---------- */
// mt: 維持費の合計、houses/factories: 税収計算用
EC.finish = function (run, o) {
  const B = EC.BALANCE, P = EC.PLANTS, L = run.log, p = run.p;
  const E = {}; EC.STACK.forEach(k => (E[k] = sum(L.gen[k])));
  const demE = sum(L.D), shortE = sum(L.short), served = demE - shortE;
  const curtE = sum(L.curt), vre = sum(L.vreRaw), chargeE = sum(L.charge);
  let co2 = 0; EC.STACK.forEach(k => (co2 += E[k] * P[k].co2));
  const intensity = served > 0 ? co2 / served : 0;
  const fuel = sum(L.fuel), running = fuel + o.mt;
  const price = B.priceBase + B.priceK * running / Math.max(1, demE);
  const income = o.houses * B.income.house + o.factories * B.income.factory;
  const blackHours = L.short.filter(x => x > 0.05).length;
  return { E, demE, shortE, served, curtE, vre, chargeE, intensity, fuel, mt: o.mt, running, price, income, blackHours,
    nukeCurtE: sum(L.nukeCurt), peakH: L.D.indexOf(Math.max(...L.D)), n: p.n, fx: p.fx };
};

/* ---------- 原因メッセージ・コンボ・MVP（学びの核心） ---------- */
EC.analyze = function (run, res, ev, year) {
  const L = run.log, P = EC.PLANTS, notes = [], n = res.n, se = run.p.season;
  const used = k => res.E[k] > 0.05 * Math.max(1, res.served);
  const kinds = EC.STACK.filter(k => k !== 'battery' && used(k)).length;
  const hrs = L.short.map((v, h) => (v > 0.05 ? h : -1)).filter(h => h >= 0);

  if (hrs.length) {
    const span = hrs.length > 1 ? `${hrs[0]}時〜${hrs[hrs.length - 1] + 1}時` : `${hrs[0]}時`;
    const eve = hrs.some(h => h >= 16 && h <= 21), night = hrs.some(h => h < 6 || h >= 22), morning = hrs.some(h => h >= 6 && h <= 9);
    const rampHit = hrs.some(h => L.ramp[h]);
    const batUsedEarly = run.bCap > 0 && hrs.some(h => L.soc[h] < 0.03) && L.gen.battery.some((v, h) => v > 0 && h < 15);
    if (ev.id === 'inspect') notes.push(['bad', `${span}に停電。大きな原子力が止まった穴を、ほかの電源でうめられませんでした。ひとつの大きな電源にたよると、止まった時のダメージも大きくなります。`]);
    else if (ev.id === 'trip') notes.push(['bad', `${span}に停電。火力が1基故障して、その分をおぎなえませんでした。どんな発電所もいつか止まります。予備の力（余裕）を持っておこう。`]);
    else if ((ev.id === 'cloud' || ev.id === 'snow') && n.solar > 0 && !night) notes.push(['bad', `${span}に停電。${ev.id === 'snow' ? '雪' : 'くもり'}で太陽光が弱く、昼の電気が足りませんでした。太陽光は天気まかせです。`]);
    else if ((ev.id === 'nowind' || ev.id === 'typhoon') && n.wind > 0) notes.push(['bad', `${span}に停電。${ev.id === 'typhoon' ? '台風で風車が止まり' : '風が弱く'}、風力がほとんど発電できませんでした。風力も天気まかせです。`]);
    else if (rampHit) notes.push(['bad', `${span}に停電。火力は急には全力を出せません（1時間に少しずつしか上げられない）。${eve ? '夕方に太陽光が一気に減るのに追いつけませんでした。' : ''}🔒蓄電池の温存や🔥フルパワーで乗りきろう。`]);
    else if (batUsedEarly && eve) notes.push(['bad', `${span}に停電。蓄電池を早い時間に使い切ってしまいました。🔒温存して、夕方のピークにとっておこう。`]);
    else if (eve && n.solar > 0) notes.push(['bad', `${span}に停電。夕方、日がしずんで太陽光が止まったのに、代わりの電源が足りませんでした。`]);
    else if (morning && se.sunMax < 1) notes.push(['bad', `${span}に停電。冬の朝は暖房で電気を使うのに、まだ日がのぼっていません。`]);
    else if (night) notes.push(['bad', `${span}に停電。夜は太陽光がゼロ。夜も発電できる電源が必要です。`]);
    else notes.push(['bad', `${span}に停電。町の電気の使用量に、発電所が追いついていません。`]);
  }
  if (res.vre > 0 && res.curtE / res.vre > 0.15) {
    const pct = Math.round(res.curtE / res.vre * 100);
    notes.push(['warn', `昼に電気が余り、再エネの${pct}%を捨てました（出力制御）。` +
      (n.battery > 0 ? '蓄電池をふやせば、もっとためられます。' : year >= 2028 ? '蓄電池があれば、夕方用にためておけます。' : '2028年に登場する蓄電池なら、ためておけます。')]);
  }
  if (res.nukeCurtE > 1) notes.push(['warn', '原子力は出力を下げにくく、余った分を捨てることになりました。大きな電源は、使う量とのバランスが大切です。']);
  const thShare = res.E.thermal / Math.max(1, res.served);
  if (ev.id === 'fuel') notes.push(thShare > 0.4
    ? ['bad', `燃料が高くなり、電気代が${res.price.toFixed(1)}円に。火力にたよりすぎると、世界の燃料の値段にふりまわされます。`]
    : ['good', '燃料が高くなりましたが、火力が少ないので電気代への影響は小さくすみました。']);

  // コンボ
  const combos = [];
  const eveBat = sum(L.gen.battery.filter((_, h) => h >= 16));
  if (n.solar > 0 && n.battery > 0 && res.chargeE > 2 && eveBat > 2) combos.push('battery_night');
  const nightWind = sum(L.gen.wind.filter((_, h) => h < 6 || h >= 19)), nightD = sum(L.D.filter((_, h) => h < 6 || h >= 19));
  if (used('solar') && nightWind > 0.15 * nightD) combos.push('baton');
  if (!hrs.length && res.E.thermal > 0 && (res.E.solar + res.E.wind) > 0.3 * res.served) combos.push('filler');
  if (['hydro', 'geo', 'nuclear'].filter(used).length >= 2) combos.push('base');
  if (kinds >= 4 && !hrs.length) combos.push('mix');
  if (ev.id === 'fuel' && thShare < 0.25 && !hrs.length) combos.push('fuelproof');

  if (!hrs.length) {
    if (kinds >= 3 && ev.id !== 'calm') notes.push(['good', `${kinds}種類の電源がささえ合って、「${ev.t}」を乗りこえました。これがエネルギーミックスの強さです。`]);
    else if (!notes.length) notes.push(['good', '一日中、停電なし。町に電気をとどけられました。']);
  }

  // MVP：使用量のピークの時間に、いちばん多く発電した電源
  const ph = res.peakH;
  let mvp = null, best = 0;
  EC.STACK.forEach(k => { if (L.gen[k][ph] > best) { best = L.gen[k][ph]; mvp = k; } });
  return { notes: notes.slice(0, 3), combos, kinds, mvp, peakH: ph };
};
})();
