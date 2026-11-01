/* エネルギーシティ ― 🗺️ おまけ「町の地図で 2050年へ」の しくみ（画面は main.js）
   ねらい：シナリオ・大作戦3Dでは 見えにくい「立地（どこに 建てるか）」と「うつりかわり（建てるのに 時間が かかり、建てたら 何十年も 残る）」
   数値の 根拠は config.js の mirai と 数値の根拠チェック.md */
(function (g) {
const EC = g.EC, C = EC.CFG, P = C.plants, M = C.mirai;

// 4つの 日（大作戦3Dと 同じ。倍率は config.js の weather：東京エリア 2024年 実績）
const DAYS4 = [['sunny', '☀️', '晴れ'], ['rain', '🌧️', '雨'], ['calm', '🍃', '風なし'], ['heat', '🥵', '猛暑']];
const KINDS = ['solar', 'wind', 'hydro', 'battery', 'geo', 'thermal'];   // 建てられる もの（⚛️は 新しく 建てられない）

// 使う 量の 倍率（2026年＝1）
const demandAt = y => {
  const d = M.demand, e = yy => d.e0 + (d.e1 - d.e0) * (Math.min(yy, d.y1) - d.y0) / (d.y1 - d.y0);
  return e(y) / e(C.startYear);
};

function newTown() {
  const S = EC.newGame('mirai', { stage: { houses: C.startHouses, money: 1e9, unlock: KINDS, plants: M.start.map(([r, c, k]) => [r, c, k]), days: [{ weather: 'sunny' }], base: 580 } });
  S.plants.forEach((p, i) => { const y = M.start[i][3]; p.built = y; p.retire = y + M.life[p.type]; });
  S.instant = false; S.thFirst = true; S.spent = 0; S.hour = 11; S.mirai = { hist: [] };
  // はじめの 年に もう 引退して いる ものは いない ように（建った 年は 町の 設定）
  EC.recalc(S);
  return S;
}

// 建てる（talk：町の 人と 話し合って 建てる → 完成が おくれる）
function build(S, k, r, c, talk) {
  const res = EC.build(S, k, r, c);
  if (res.why) return res;
  const b = res.b, L = M.lead[k] + (talk ? M.talk : 0);
  b.left = L; b.built = S.year; b.retire = S.year + L + M.life[k]; b.talk = !!talk;
  S.spent += P[k].cost; EC.recalc(S);
  return res;
}

// 町の 人の 声（第4部の 国民の 声と 同じ 心配。数は 使わない）
function warn(S, k, r, c) {
  const w = EC.placeWarn(S, k, r, c);
  if (w === 'nearThermal') return ['🏡', '近くに 住む 人', 'けむりや 大きな 音が 心配。'];
  if (w === 'nearWind') return ['🏡', '近くに 住む 人', '風車の 音や 景色が 気になる。'];
  if (w === 'onsen') return ['♨️', '温泉旅館の 人', '近くで 地熱発電を すると、温泉の お湯が へらないか 心配。'];
  if (k === 'wind' && EC.coastal(S, r, c)) return ['🎣', '漁師', '海ぞいに 風車が ならぶと、漁の じゃまに ならないか 心配。'];
  if (k === 'hydro') return ['🏞️', '山の 村の 人', '新しい ダムを つくると、村や 森が 水の 底に しずむかもしれない。'];
  return null;
}

// 4つの 日で ためす（その年の 使う 量で）
function check(S) {
  const f = demandAt(S.year);
  const days = DAYS4.map(([w, icon, name]) => {
    const t = EC.stressTest(S, { id: 'mirai:' + w, weather: w, fx: { dem: (C.weather[w].fx.dem || 1) * f } });
    return { w, icon, name, bh: t.bh, fuel: t.fuel, log: t.log };
  });
  let gr = 0, e = 0;   // CO₂（g/kWh）：4つの 日を 合わせて（🔋は ためた 電気を 出すだけなので 数えない）
  days.forEach(d => C.stack.forEach(k => { if (k === 'battery') return; const s = d.log.gen[k].reduce((a, b) => a + b, 0); gr += s * P[k].co2; e += s; }));
  return { year: S.year, f, days, black: days.filter(d => d.bh).length, co2: e ? gr / e : 0, fuel: Math.round(days.reduce((a, d) => a + d.fuel, 0) / days.length) };
}

// 3年 すすめる：建設中の ものが 完成し、稼働年数を こえた ものが 引退する
function advance(S) {
  const to = S.year + M.step, done = [], gone = [];
  S.plants.forEach(p => { if (p.left > 0) { p.left = Math.max(0, p.left - M.step); if (!p.left) { p.warm = 1; done.push(p); } } });
  S.year = to;
  S.plants.filter(p => p.retire && p.retire <= to).forEach(p => { gone.push({ type: p.type, r: p.r, c: p.c, built: p.built }); EC.demolish(S, p.r, p.c); });
  EC.recalc(S);
  return { done, gone };
}

EC.Mirai = { DAYS4, KINDS, demandAt, newTown, build, warn, check, advance };
})(typeof window !== 'undefined' ? window : globalThis);
