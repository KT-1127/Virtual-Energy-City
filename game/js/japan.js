/* エネルギーシティ ― 🗾 日本エネルギーミックス大作戦 3D
   本家「日本エネルギーミックス大作戦」（あなたは エネルギー大臣。スライダーで 日本の 電源の わりあいを 決める）を 3Dの 日本地図で 再現。
   ・モード：はじめてのミッション／ストーリー（環境・安定・持続ルート ＋ 2050年）／リアル日本（2024→2030→2040）／フリー
   ・ものさし：CO₂（2024年度比）・発電コスト・停電しない日（4つの 日）＋ 国産率・安全性・持続可能性
   ・決めた わりあいで「日本の 1日（24時間）」を ためせる → 比率では 見えない 夜・雨・風なし・猛暑が 見える
   ・地図：わりあい 5%で キャラ1人、🔥の けむり＝CO₂、🚢タンカー＝輸入燃料、☀️パネル畑
   ・スライダーは ほかを 勝手に 動かさない。「のこり」を 見ながら 自分で 合計100%に する（ふやす には 何かを へらす）
   ・最後に「わたしの エネルギーミックス宣言」を 画像で 保存
   数値は js/facts.js の 公的データを もとに ゲーム用に 丸めた もの。 */
(function (g) {
const EC = g.EC, T = g.THREE, F = EC.FACTS;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sfx = n => EC.Audio && EC.Audio.sfx(n);

/* ---------- 電源 ----------
   co2：1kWhあたり（電中研LCA。火力は 2024年度の 石炭・LNG・石油の わりあいで 平均＝約690g）
   cost：発電コスト（円/kWh。発電コスト検証 2025年2月とりまとめ・2023年・政策経費あり。🔥は 石炭24.8・LNG19.1・石油43.8 を 2024年度の わりあいで 平均、♨️は 地熱 16.1〜16.8 の 中ほど）
   safe・sust：安全性・持続可能性（1〜5、本家の 考え方）
   dom：国産（1）か 輸入燃料（0）か　cf：24時間の 計算で 使う「わりあい→出せる力」の 係数
     ☀️ 0.207＝晴れの日の 形の 合計 6.99時間 × 1年の 平均の 日／晴れの日 0.71 ÷ 24（東京エリア 2024年）
     🔥 0.592＝1÷1.69（東京エリア 2024年：火力の 出力の 1年の 最大は 平均の 1.69倍）
   init・maint：初期費用・維持費の「安さ」　waste：廃棄物の あつかいやすさ　social：社会的受容性（1〜5、高いほど よい）
   ここまでの 1〜5は 本家の アドバンス・専門家モードと 同じ（本家の 考え方）
   capf：設備利用率（%。発電コスト検証2025 の モデルプラント：☀️事業用18.3・💨陸上29.6・💧中水力54.7・♨️地熱83・🔥⚛️70） */
const SRC = [
  { k: 'thermal', name: '火力', sub: '石炭・LNG・石油', icon: '🔥', co2: 690, cost: 24.1, safe: 3, sust: 1, dom: 0, cf: 0.592, init: 2, maint: 2, waste: 2, capf: 70, social: 3,
    good: '天気に 関係なく 出せて、出力も すぐ 調整できる', bad: 'CO₂が いちばん 多い・燃料の ほとんどを 輸入' },
  { k: 'nuclear', name: '原子力', sub: 'ウランの 核分裂', icon: '⚛️', co2: 20, cost: 12.6, safe: 2, sust: 3, dom: 1, cf: 1, init: 1, maint: 4, waste: 1, capf: 70, social: 1,
    good: 'CO₂が 少なく、昼も 夜も 大量に 安定', bad: '事故の 影響が 大きい・廃棄物の 処分場が 未定・出力を 変えにくい' },
  { k: 'hydro', name: '水力', sub: 'ダム・川', icon: '💧', co2: 11, cost: 13.0, safe: 4, sust: 5, dom: 1, cf: 1, init: 2, maint: 5, waste: 5, capf: 54.7, social: 4,
    good: 'CO₂が 少なく 安い。出力の 調整も できる', bad: '大きな ダムを 建てる 場所が もう 少ない' },
  { k: 'solar', name: '太陽光', sub: 'パネル', icon: '☀️', co2: 38, cost: 10.9, safe: 5, sust: 5, dom: 1, cf: 0.207, init: 4, maint: 5, waste: 3, capf: 18.3, social: 4,
    good: 'つくる お金が 安く、燃料いらず', bad: '夜は 0・雨の 日は 晴れの日の 約3割。広い 土地が いる' },
  { k: 'wind', name: '風力', sub: '陸上・洋上', icon: '💨', co2: 26, cost: 16.3, safe: 4, sust: 5, dom: 1, cf: 1, init: 3, maint: 4, waste: 4, capf: 29.6, social: 3,
    good: '夜も 回れる・燃料いらず', bad: '風まかせ。建てる 場所（海・山）が 限られる' },
  { k: 'geo', name: '地熱・バイオ', sub: '地熱・木くず など', icon: '♨️', co2: 13, cost: 16.5, safe: 4, sust: 5, dom: 1, cf: 1, init: 2, maint: 4, waste: 5, capf: 83, social: 2,
    good: '天気に 関係なく 安定・CO₂が 少ない', bad: 'コストが 高め・温泉や 国立公園と 場所が 重なる' }
];
const KEYS = SRC.map(s => s.k), S_ = Object.fromEntries(SRC.map(s => [s.k, s]));
const COL = k => EC.CFG.plants[k].color;
// 2024年度の 日本（確報）を 6つに まとめた もの（地熱・バイオ＝地熱0.4＋バイオマス4.2）
const BASE = { thermal: 67.5, nuclear: 9.4, hydro: 7.4, solar: 9.9, wind: 1.2, geo: 4.6 };
const I0 = SRC.reduce((a, s) => a + BASE[s.k] * s.co2, 0) / 100;

/* ---------- ものさし ---------- */
function metrics(m) {
  const w = f => SRC.reduce((a, s) => a + m[s.k] * f(s), 0) / 100;
  const vre = m.solar + m.wind, integ = 0;   // 統合コストは 式の 根拠が ないので 足さない（ことばで 説明）
  const co2g = w(s => s.co2);
  return {
    co2: Math.round(co2g / I0 * 100), co2g: Math.round(co2g),
    cost: Math.round((w(s => s.cost) + integ) * 10) / 10, integ: Math.round(integ * 10) / 10,
    stab: 4 - blackDays(m).length,   // 安定：4つの 日の うち 停電しない 日の 数（本家の 点数は 根拠が ないので 使わない）
    self: Math.round(w(s => s.dom * 100)), safe: Math.round(w(s => s.safe) * 10) / 10, sust: Math.round(w(s => s.sust) * 10) / 10,
    renew: Math.round(m.hydro + m.solar + m.wind + m.geo), vre: Math.round(vre),
    init: Math.round(w(s => s.init) * 10) / 10, maint: Math.round(w(s => s.maint) * 10) / 10, waste: Math.round(w(s => s.waste) * 10) / 10,
    capf: Math.round(w(s => s.capf) * 10) / 10, social: Math.round(w(s => s.social) * 10) / 10
  };
}
const MET = {
  co2: { icon: '🌏', name: 'CO₂', unit: '%', low: true, lo: 0, hi: 120, margin: 5,
    def: '2024年度の 日本を 100% と したときの CO₂の 量。🔥火力が 多いほど ふえる。', fmt: v => v + '%' },
  cost: { icon: '💴', name: '発電コスト', unit: '円', low: true, lo: 10, hi: 18, margin: 0.3,
    def: '1kWh つくるのに かかる お金（国の 発電コスト検証 2025年2月・2023年の 値。CO₂対策の 費用なども ふくむ）。<br>☀️💨が ふえると、ためる・予備の 発電所の お金（統合コスト）も 必要に なる。国の 試算では 2040年の 太陽光は 7.0〜8.9円、統合コストを 足すと 15.3〜36.9円（ここでは 足していない）。', fmt: v => v.toFixed(1) + '円' },
  stab: { icon: '🔌', name: '停電しない日', unit: '日', lo: 0, hi: 4, margin: 0,
    def: '4つの 日（晴れ・雨・風なし・猛暑）の うち、1時間ごとに 見て 停電しない 日の 数。使う 量・太陽光・風の 強さは 東京エリア 2024年の 実データ、ためる 設備は いまの 揚水発電の 量で 計算。<br>（本家の「安定性の 点数」は 根拠と なる 資料が ないので 使わない）', fmt: v => v + '/4日' },
  self: { icon: '🗾', name: '国産率', unit: '%', lo: 0, hi: 100, margin: 3,
    def: '輸入した 燃料に たよらない 電気の わりあい（🔥火力 以外）。⚛️は 燃料を 長く 使えるので「準国産」と 数える（国の 考え方）。', fmt: v => v + '%' },
  safe: { icon: '🛡️', name: '安全性', unit: '', lo: 1, hi: 5, margin: 0.2,
    def: '事故や 災害の ときの 影響・廃棄物の あつかい（5が 安全）。⚛️は 事故の 影響と 放射性廃棄物が 課題。<br>※この 点数は ゲームの 作者の 考え方。ふだんの 事故の 少なさや 大気汚染を 重く 見る 人も いる。', fmt: v => v.toFixed(1) },
  sust: { icon: '♻️', name: '持続可能性', unit: '', lo: 1, hi: 5, margin: 0.2,
    def: 'これからも ずっと 使い続けられるか（5が よい）。石炭・石油・LNGは いつか なくなる。<br>※この 点数は ゲームの 作者の 考え方。', fmt: v => v.toFixed(1) },
  renew: { icon: '🌱', name: '再エネ', unit: '%', lo: 0, hi: 100, margin: 3,
    def: '水力・太陽光・風力・地熱・バイオマスの 合計。', fmt: v => v + '%' },
  // ↓ アドバンス・博士（専門家）モード（本家と 同じ 数値。1〜5は 高いほど よい）
  init: { icon: '🏗️', name: '初期費用の 安さ', unit: '', lo: 1, hi: 5, margin: 0.2,
    def: '発電所を 建てる ときの お金の 安さ（5が 安い）。⚛️は 数千億円、💧の ダムや ♨️も 高い。☀️は 安い。<br>※1〜5の 点数は 本家（大作戦）の 考え方。', fmt: v => v.toFixed(1) },
  maint: { icon: '🔧', name: '維持費の 安さ', unit: '', lo: 1, hi: 5, margin: 0.2,
    def: '動かし続ける お金の 安さ（5が 安い）。🔥は 燃料を 買い続けるので 高い。💧☀️は 燃料が いらず 安い。<br>※1〜5の 点数は 本家（大作戦）の 考え方。', fmt: v => v.toFixed(1) },
  waste: { icon: '🗑️', name: '廃棄物処理', unit: '', lo: 1, hi: 5, margin: 0.2,
    def: '使った あとの ごみ・廃棄物の あつかいやすさ（5が よい）。⚛️は 放射性廃棄物（最終処分地が 未定）、☀️は 古い パネルの 大量廃棄が 課題。<br>※1〜5の 点数は 本家（大作戦）の 考え方。', fmt: v => v.toFixed(1) },
  capf: { icon: '📈', name: '設備利用率', unit: '%', lo: 0, hi: 100, margin: 2,
    def: '1年じゅう 全力で 動いた ときに くらべて、どれだけ 発電したか（国の 発電コスト検証 2025年2月）。⚛️🔥約70%・♨️約83%・💧約55%・💨約30%・☀️約18%。<br>低いと、同じ 電気を つくるのに たくさんの 設備が いる。', fmt: v => v.toFixed(1) + '%' },
  social: { icon: '👥', name: '社会的受容性', unit: '', lo: 1, hi: 5, margin: 0.2,
    def: '地域や 国民に 受け入れられやすいか（5が よい）。⚛️は 事故への 不安、♨️は 温泉地との 調整、💨は 音や 景色が 課題に なりやすい。<br>※1〜5の 点数は 本家（大作戦）の 考え方。人や 地域に よって ちがう。', fmt: v => v.toFixed(1) }
};

/* ---------- 目標 ---------- */
// {m:'co2', op:'<=', v} ものさし ／ {src:'thermal', op, v} 1つの電源 ／ {sum:[..], op, v, name} 合計 ／ {src, min, max} はんい
const gVal = (gl, r, m) => gl.days ? 4 - blackDays(m).length : gl.m ? r[gl.m] : gl.sum ? gl.sum.reduce((a, k) => a + m[k], 0) : m[gl.src];
function gOk(gl, r, m) {
  if (gl.days) return !blackDays(m).length;
  const v = gVal(gl, r, m);
  if (gl.min != null) return v >= gl.min && v <= gl.max;
  if (gl.op === '<') return v < gl.v - 1e-9;
  if (gl.op === '>') return v > gl.v + 1e-9;
  return gl.op === '<=' ? v <= gl.v + 1e-9 : v >= gl.v - 1e-9;
}
function gText(gl) {
  if (gl.days) return (gl.pl ? '📣' : '') + '⚡ 4つの日 どれも 停電なし';
  if (gl.base) return `📣${MET[gl.m].icon}${MET[gl.m].name} 2024年度（${MET[gl.m].fmt(gl.v)}）より ${BETTER[gl.m]}`;
  const who = gl.m ? `${MET[gl.m].icon}${MET[gl.m].name}` : gl.sum ? gl.name : `${S_[gl.src].icon}${S_[gl.src].name}`;
  const u = gl.m ? MET[gl.m].unit : '%';
  if (gl.min != null) return `${who} ${gl.min}〜${gl.max}${u}`;
  return `${who} ${gl.v}${u}${gl.op === '<=' ? '以下' : '以上'}`;
}
const gNear = (gl, r, m) => gl.m && !gl.min ? (gl.op[0] === '<' ? gl.v - r[gl.m] : r[gl.m] - gl.v) >= MET[gl.m].margin : true;
const BETTER = { co2: '少なく', cost: '安く', safe: '高く', self: '高く' };

/* ---------- ステージ ---------- */
// 上限：国が 見こんでいる いちばん 多い わりあい（2040年度＝第7次エネルギー基本計画：☀️23〜29・💨4〜8・💧8〜10・地熱1〜2＋バイオ5〜6・⚛️2割程度、
//        2030年度＝第6次：☀️14〜16・💨5・💧11・地熱1＋バイオ5・⚛️20〜22）。🔥は 2024年度の 実際（67.5%）より ふやさない
const LIM = {
  y2040: { thermal: 68, nuclear: 20, hydro: 10, solar: 29, wind: 8, geo: 8 },
  y2030: { thermal: 68, nuclear: 22, hydro: 11, solar: 16, wind: 5, geo: 6 }
};
LIM.free = LIM.y2040; LIM.y2024 = LIM.y2040;
// チャプターの 目標の 数（CO₂◯%以下 など）は ゲームの 課題の 設定。上限・計算の 数値は 資料から（game/数値の根拠チェック.md）。
// 目標は「上限の 中で、4つの 日 どれも 停電しない」組み合わせで 達成できるかを 確かめて 決めた
const NOTE_PLAN = '国の 計画は、蓄電池や 送電線を ふやし、予備の 火力を 残す ことも 前提に している。このゲームは いまの 揚水発電だけで 計算し、えらんだ わりあいの 分しか 火力が 動かないので、国の めやすの わりあいでも 猛暑の 夕方に 足りなく なる。';
const FINAL = { id: 'f2050', title: '2050年 脱炭素社会へ', era: '2050年', lim: LIM.free, show: ['co2', 'cost', 'stab', 'renew', 'safe', 'self'],
  goals: [{ m: 'co2', op: '<=', v: 78 }, { m: 'cost', op: '<=', v: 19.5 }, { m: 'renew', op: '>=', v: 33 }, { m: 'safe', op: '>=', v: 3.2 }],
  intro: ['いよいよ 2050年。国は「カーボンニュートラル（CO₂の 排出を 実質ゼロ）」を めざしている。', 'でも この ゲームの 道具（いまの 6つの 電源と 揚水発電）だけでは、停電させずに どこまで へらせる？'],
  hint: '🔥を 50%くらいまで。⚛️💧♨️を 多めに、☀️💨は 雨と 猛暑の 日の 夕方を 見ながら。',
  learn: () => `この ゲームの 道具だけでは、停電しないように すると CO₂は 2024年の 7割くらいが 限界。実質ゼロには、蓄電池の 大量導入・送電線・水素や アンモニアの 発電・CO₂を 回収する 火力など、ここに ない しくみが 必要。${NOTE_PLAN}`, quiz: ['plan', 'cost'] };
const MODES = {
  mission: { icon: '🎓', name: 'はじめての ミッション', desc: 'スライダーの 使い方と、ものさしを 体験', chapters: [
    { id: 'm1', title: '再エネを ふやしてみよう', era: 'ミッション1', lim: LIM.free,
      goals: [{ m: 'renew', op: '>=', v: 30 }, { m: 'co2', op: '<=', v: 85 }], show: ['co2', 'cost', 'stab', 'renew'],
      intro: ['大臣、はじめまして！ 秘書の チャッピーです。', 'いまの 日本は 🔥火力が 約7割。まずは 再エネ（💧☀️💨♨️）を 30%以上に ふやしてみましょう。', '合計は 100%。ふやす 前に、まず 🔥を へらして「のこり」を つくってね！'],
      hint: 'まず 🔥火力を 左へ（へらす）。あいた「のこり」を 💧☀️💨♨️に 入れよう。', quiz: ['co2'] },
    { id: 'm2', title: '火力を いちばん 少なく してみよう', era: 'ミッション2', lim: LIM.free,
      goals: [{ src: 'thermal', op: '<=', v: 30 }], show: ['co2', 'cost', 'stab', 'renew'],
      intro: ['CO₂が いちばん 多いのは 🔥火力。ほかの 電源を 上限まで ふやして、🔥を 30%以下に できる？', '上限は 国が 2040年度までに 見こんでいる いちばん 多い わりあい。'],
      hint: '⚛️💧☀️💨♨️を ぜんぶ 上限まで ふやすと、🔥は 25%まで へらせる。', quiz: ['nuclear'],
      noS: `🔍 発見！ ほかを 上限まで ふやして 🔥を へらすと、雨や 猛暑の 日の 夕方に 足りなく なり 停電する。🔥は CO₂が 多くても「夕方を ささえる 調整役」。<br>${NOTE_PLAN}<br>👉 だから 次からは「⚡ 4つの日 どれも 停電なし」も 目標に 入るよ。` },
    { id: 'm3', title: '2030年に 向けて CO₂を へらせ', era: 'ミッション3', lim: LIM.free,
      goals: [{ m: 'co2', op: '<=', v: 80 }, { m: 'cost', op: '<=', v: 19.5 }], show: ['co2', 'cost', 'stab'],
      intro: ['国は 2030年度に 温室効果ガスを 2013年度比 46%へらす 目標を 立てた。', 'CO₂と コスト、2つを 満たせるかな？', 'これからは「⚡ 4つの日 どれも 停電なし」も 目標！ 停電する 国は 合格に できない。'],
      hint: '🔥を 50%台に。💧💨♨️は 上限まで、⚛️と ☀️を 1割くらいずつ。🔥（24.1円）を へらすと コストも 下がる。', quiz: ['cost'] }
  ] },
  env: { icon: '🌏', name: '環境重視ルート', desc: 'とにかく CO₂を へらしたい！ 地球に やさしい 大臣', story: true, chapters: [
    { id: 'e1', title: 'CO₂を とにかく へらせ！', era: 'チャプター1', lim: LIM.free, goals: [{ m: 'co2', op: '<=', v: 85 }], show: ['co2', 'cost', 'stab'],
      intro: ['「地球温暖化を 止めて！」国民の 声が 高まっている。', 'まずは CO₂を 2024年の 85%以下に！'], hint: '🔥を へらして、CO₂の 少ない 電源を ふやそう。', quiz: ['co2'] },
    { id: 'e2', title: '地球も 大事、でも 停電は こまる', era: 'チャプター2', lim: LIM.free, goals: [{ m: 'co2', op: '<=', v: 80 }], show: ['co2', 'cost', 'stab'],
      intro: ['CO₂は へった！ …でも「雨の 日や 猛暑の 夕方に 電気が 足りない」と 工場から 苦情が。', 'CO₂を もっと へらしながら、停電しない 日本に しよう。'], hint: '☀️💨ばかりだと 夕方に 足りない。⚛️💧♨️で ささえ、🔥は 50%台に。', quiz: ['store', 'grid'] },
    { id: 'e3', title: 'バランスの とれた ミックスを', era: 'チャプター3', lim: LIM.free, goals: [{ m: 'co2', op: '<=', v: 82 }, { m: 'cost', op: '<=', v: 19.5 }], show: ['co2', 'cost', 'stab'],
      intro: ['こんどは「電気代が 高い！」と 家計の 声。', 'CO₂・停電なし・コスト、3つの バランスを とろう。'], hint: '🔥（24.1円）は いちばん 高い。☀️（10.9円）・⚛️（12.6円）・💧（13.0円）は 安め。', quiz: ['cost'] },
    FINAL] },
  stab: { icon: '🔌', name: '安定重視ルート', desc: '停電は ぜったい イヤ！ 安定供給を 最優先する 大臣', story: true, chapters: [
    { id: 's1', title: 'とにかく 停電ゼロ！', era: 'チャプター1', lim: LIM.free, goals: [{ m: 'co2', op: '<=', v: 95 }], show: ['co2', 'cost', 'stab'],
      intro: ['2022年3月、地震と 寒さで はじめての「電力需給ひっ迫警報」が 出た。', '二度と 停電の 心配を させない！ 4つの 日 どれも 停電なしで、CO₂も 2024年より 少し へらそう。'], hint: '雨の 日は ☀️が 約3割、猛暑の 日は 使う 量が 約1.16倍。夕方を ささえる 🔥⚛️💧♨️を しっかり。', quiz: ['grid'] },
    { id: 's2', title: '安定＋環境の 両立に チャレンジ', era: 'チャプター2', lim: LIM.free, goals: [{ m: 'co2', op: '<=', v: 82 }, { m: 'self', op: '>=', v: 45 }], show: ['co2', 'cost', 'stab', 'self'],
      intro: ['停電は へったけど「CO₂が 多すぎる」「輸入に たよりすぎ」と 心配の 声。', '停電なしの まま、CO₂を へらし、国産率も 上げよう。'], hint: '🔥を へらし、天気に 左右されない ⚛️💧♨️で おきかえる。', quiz: ['nuclear'] },
    { id: 's3', title: '安定を 保ちつつ コストも', era: 'チャプター3', lim: LIM.free, goals: [{ m: 'co2', op: '<=', v: 82 }, { m: 'cost', op: '<=', v: 19.4 }, { m: 'self', op: '>=', v: 45 }], show: ['co2', 'cost', 'stab', 'self'],
      intro: ['安定と 環境の 両立が 見えてきた。', '最後は コストも 下げて、ぜんぶ そろえよう。'], hint: '♨️（16.5円）・💨（16.3円）は 高め。⚛️・💧・☀️は 安め。🔥は 50%台に。', quiz: ['cost'] },
    FINAL] },
  sust: { icon: '🔁', name: '持続重視ルート', desc: '今の くらしも、未来の 世代も 大切に したい 大臣', story: true, chapters: [
    { id: 'u1', title: '安い 電気は 正義？', era: 'チャプター1', lim: LIM.free, goals: [{ m: 'cost', op: '<=', v: 19.3 }], show: ['co2', 'cost', 'stab'],
      intro: ['燃料の 値上がりで 電気代が 上がり、くらしが 苦しい…', 'まずは 発電コストを 19.3円以下に！（2024年は 約20.4円）'], hint: '燃料代の かかる 🔥（24.1円）を へらし、☀️（10.9円）・⚛️（12.6円）・💧（13.0円）を ふやす。', quiz: ['cost'] },
    { id: 'u2', title: '料金だけで なく 環境も', era: 'チャプター2', lim: LIM.free, goals: [{ m: 'cost', op: '<=', v: 19.3 }, { m: 'co2', op: '<=', v: 82 }], show: ['co2', 'cost', 'stab'],
      intro: ['安く なった！ でも 未来の 地球は？', 'コストを 守りながら CO₂も へらそう。'], hint: '☀️は 安くて CO₂も 少ない。でも 夕方と 雨の 日に 足りなく なる。⚛️💧と 組み合わせよう。', quiz: ['self'] },
    { id: 'u3', title: '料金・環境・停電なしの バランス', era: 'チャプター3', lim: LIM.free, goals: [{ m: 'cost', op: '<=', v: 19.2 }, { m: 'co2', op: '<=', v: 82 }], show: ['co2', 'cost', 'stab'],
      intro: ['安くて きれいな 電気。でも 止まっては 意味が ない。', 'コスト・CO₂・停電なし、ぜんぶ そろえよう。'], hint: '☀️で 安く、⚛️💧で 夕方を ささえる。🔥は 50%台。', quiz: ['grid'] },
    FINAL] },
  real: { icon: '🗾', name: 'リアル日本', desc: '2024年の 本当の 日本 → 2030年 → 2040年の 国の めあてへ', chapters: [
    { id: 'r1', title: '2024年度の 日本を 再現しよう', era: '2024年度', lim: LIM.y2024, start: { thermal: 59, nuclear: 12, hydro: 9, solar: 12, wind: 2, geo: 6 }, show: ['co2', 'cost', 'stab', 'self'],
      goals: [{ src: 'thermal', min: 65, max: 68 }, { src: 'nuclear', min: 8, max: 11 }, { src: 'hydro', min: 6, max: 9 }, { src: 'solar', min: 8, max: 12 }, { src: 'wind', min: 0, max: 2 }, { src: 'geo', min: 3, max: 6 }],
      ref: { thermal: [67, 68], nuclear: [9, 10], hydro: [7, 8], solar: [10, 10], wind: [1, 1], geo: [4, 5] }, refName: '2024年の 実際（答え）', refHide: true,
      intro: ['まずは いまの 日本を 知ろう。', '2024年度、日本の 電気は どの つくり方が 何%だった？ 予想して 合わせてみて！', '（上限は 国が 2040年度までに 見こんでいる いちばん 多い わりあい）'],
      hint: '🔥火力 約67%・⚛️原子力 約9%・💧水力 約7%・☀️太陽光 約10%・💨風力 約1%・♨️地熱とバイオ 約5%。', quiz: ['mix', 'self'],
      learn: () => `2024年度（確報）：🔥67.5%（LNG 32.2・石炭 28.1・石油等 7.2）・⚛️9.4%・💧7.4%・☀️9.9%・💨1.2%・♨️地熱とバイオ 4.6%。エネルギー自給率は 約16%。<small>出典：${F.SRC.mix2024}</small>` },
    { id: 'r2', title: '2030年度の めあてを 設計しよう', era: '2030年度', lim: LIM.y2030, show: ['co2', 'cost', 'stab', 'self'],
      goals: [{ m: 'co2', op: '<=', v: 78 }, { m: 'self', op: '>=', v: 50 }],
      ref: { thermal: [41, 41], nuclear: [20, 22], hydro: [11, 11], solar: [14, 16], wind: [5, 5], geo: [6, 6] },
      intro: ['国は 2030年度に 温室効果ガスを 2013年度比 46%へらす 目標。', '電気の めあて（第6次エネルギー基本計画）は 再エネ 36〜38%・原子力 20〜22%・火力 約41%。', 'スライダーの うすい 帯が 国の めあて。上限は めあての いちばん 多い わりあい。'],
      hint: '⚛️💧♨️☀️💨を 上限近くまで。🔥は 50%くらい。国の めあて（🔥41%）だと 猛暑の 夕方に 足りなく なる。', quiz: ['plan', 'nuclear'],
      learn: () => `2030年度の めあて：再エネ ${F.target2030.renew}（太陽光 ${F.target2030.solar}・風力 ${F.target2030.wind}・水力 ${F.target2030.hydro}）・原子力 ${F.target2030.nuclear}・LNG ${F.target2030.lng}・石炭 ${F.target2030.coal}。<small>出典：${F.SRC.plan6}</small><br>${NOTE_PLAN}` },
    { id: 'r3', title: '2040年度へ ― 第7次エネルギー基本計画', era: '2040年度', lim: LIM.y2040, show: ['co2', 'cost', 'stab', 'self', 'safe'],
      goals: [{ m: 'co2', op: '<=', v: 78 }, { m: 'cost', op: '<=', v: 19.4 }, { m: 'self', op: '>=', v: 48 }],
      ref: { thermal: [30, 40], nuclear: [20, 20] },
      intro: ['2025年、国は 2040年度の めやすを 決めた。再エネ 4〜5割・原子力 2割程度・火力 3〜4割。', 'どれか 1つに たよらない「組み合わせ」。きみなら どう 組み合わせる？'],
      hint: '💧💨♨️を 上限まで、⚛️と ☀️を 1割くらいずつ、🔥は 50%くらい。🔥を 3〜4割まで へらすと、この ゲームでは 雨や 猛暑の 夕方に 足りない。', quiz: ['store', 'plan', 'cost'],
      learn: () => `2040年度の めやす：再エネ ${F.target2040.renew}・原子力 ${F.target2040.nuclear}・火力 ${F.target2040.thermal}。<small>出典：${F.SRC.plan7}</small><br>${NOTE_PLAN}` }
  ] },
  // 🔬 アドバンス：ベーシックで「できた！」と 思った 組み合わせも、別の ものさしで 見ると…？（本家 MODE 02。目標の 数は この ゲームの 計算に 合わせた）
  adv: { icon: '🔬', name: 'アドバンス', desc: 'ものさし 7つ。初期費用・維持費・安全性・持続可能性も 見る', chapters: [
    { id: 'a1', title: '低コスト・高安全な 再エネミックス', era: 'チャレンジ1', lim: LIM.free, enabled: ['thermal', 'hydro', 'solar', 'wind', 'geo'], start: { thermal: 65, nuclear: 7, hydro: 8, solar: 12, wind: 3, geo: 5 },
      goals: [{ m: 'co2', op: '<=', v: 90 }, { m: 'init', op: '>=', v: 2.2 }, { m: 'safe', op: '>=', v: 3.3 }, { sum: ['solar', 'wind'], name: '☀️＋💨', op: '>=', v: 20 }], show: ['co2', 'cost', 'stab', 'init', 'maint', 'safe', 'sust'],
      intro: ['ここからは ものさしが 7つ！ 🏗️初期費用・🔧維持費・🛡️安全性・♻️持続可能性も 見よう。', 'ミッションで「できた！」と 思った 組み合わせも、別の ものさしで 見ると…？', '⚛️原子力は 7%で 固定。☀️＋💨を 20%以上に！'],
      hint: '☀️は 初期費用が 安く（★4）安全（★5）。🔥💧♨️は 初期費用が 高め。☀️を 多めに、💨を 上限まで、🔥は 60%くらい。', quiz: ['cost'] },
    { id: 'a2', title: '持続可能な 社会を めざして', era: 'チャレンジ2', lim: LIM.free, start: { thermal: 55, nuclear: 9, hydro: 8, solar: 12, wind: 6, geo: 10 },
      goals: [{ m: 'co2', op: '<=', v: 82 }, { m: 'maint', op: '>=', v: 3.1 }, { m: 'safe', op: '>=', v: 3.3 }, { m: 'sust', op: '>=', v: 2.5 }], show: ['co2', 'cost', 'stab', 'init', 'maint', 'safe', 'sust'],
      intro: ['石炭・石油・LNGは いつか なくなる。ずっと 使い続けられる 電気を 考えよう。', '燃料の いらない 電源は 維持費も 安い。でも 安全性と 停電なしも わすれずに。'],
      hint: '💧💨♨️を 上限まで、☀️を 1割台、⚛️は 安全性（★2）が 低いので 5%くらい、🔥は 50%台。', quiz: ['self'] },
    { id: 'a3', title: 'すべての バランスを 極める', era: 'チャレンジ3', lim: LIM.free,
      goals: [{ m: 'co2', op: '<=', v: 82 }, { m: 'cost', op: '<=', v: 19.4 }, { m: 'maint', op: '>=', v: 3.0 }, { m: 'safe', op: '>=', v: 3.3 }, { m: 'sust', op: '>=', v: 2.4 }], show: ['co2', 'cost', 'stab', 'init', 'maint', 'safe', 'sust'],
      intro: ['最後は 5つの ものさしと 停電なしを ぜんぶ 満たそう。', '1つを よく すると、ほかが 下がる。どこで 折り合いを つける？'],
      hint: '💧💨♨️を 上限まで、☀️を 1割台、⚛️は 5%くらい、🔥は 50%台。', quiz: ['plan'] }
  ] },
  // 🎓 博士（専門家）モード：廃棄物・設備利用率・社会的受容性も 入れた ものさし 10の 最難関（本家 MODE 05・かくしモード）
  expert: { icon: '🎓', name: '博士（専門家）モード', desc: 'ものさし 10。廃棄物処理・設備利用率・社会的受容性も 見る 最難関', hidden: true, chapters: [
    { id: 'x1', title: '廃棄物と 設備利用率を 理解する', era: 'チャプター1', lim: LIM.free,
      goals: [{ m: 'co2', op: '<=', v: 85 }, { m: 'cost', op: '<=', v: 20.0 }, { m: 'waste', op: '>=', v: 2.5 }, { m: 'capf', op: '>=', v: 60 }], show: ['co2', 'cost', 'stab', 'init', 'maint', 'safe', 'sust', 'waste', 'capf', 'social'],
      intro: ['🎓 博士モードへ ようこそ！ 現実の 日本が かかえる 本当の 課題を 考えよう。', '🗑️廃棄物処理：⚛️の 放射性廃棄物、☀️パネルの 大量廃棄 など。', '📈設備利用率：☀️は 約18%、⚛️🔥は 約70%（国の 発電コスト検証）。同じ 電気を つくるのに 必要な 設備の 数が ちがう。'],
      hint: '🔥を 50%台、💧💨♨️を 上限まで、⚛️を 5%くらい、のこりを ☀️に。', quiz: ['nuclear'] },
    { id: 'x2', title: '社会的受容性を 考える', era: 'チャプター2', lim: LIM.free,
      goals: [{ m: 'co2', op: '<=', v: 84 }, { m: 'cost', op: '<=', v: 20.0 }, { m: 'waste', op: '>=', v: 2.6 }, { m: 'capf', op: '>=', v: 60 }, { m: 'social', op: '>=', v: 2.8 }], show: ['co2', 'cost', 'stab', 'init', 'maint', 'safe', 'sust', 'waste', 'capf', 'social'],
      intro: ['技術的に すぐれていても、社会が 受け入れなければ 建てられない。', '👥 ⚛️は 事故への 不安（1）、♨️は 温泉地との 調整（2）、💨は 音や 景色（3）。☀️💧は 受け入れられやすい（4）。'],
      hint: '🔥を 50%台、💧💨♨️を 上限まで、⚛️を 5%くらい、☀️を 1割くらい。', quiz: ['geo'] },
    { id: 'x3', title: '2024年度の 日本を 10の ものさしで 見る', era: 'チャプター3', lim: LIM.free, show: ['co2', 'cost', 'stab', 'init', 'maint', 'safe', 'sust', 'waste', 'capf', 'social'],
      goals: [{ m: 'co2', op: '<=', v: 105 }, { m: 'cost', op: '<=', v: 21.0 }, { m: 'waste', op: '>=', v: 2.4 }, { m: 'capf', op: '>=', v: 60 }, { src: 'thermal', min: 65, max: 68 }, { src: 'nuclear', min: 8, max: 11 }, { src: 'hydro', min: 6, max: 9 }, { src: 'solar', min: 8, max: 12 }],
      intro: ['いまの 日本（2024年度）を 再現して、10の ものさしで 見てみよう。', '🔥火力 約67%・⚛️原子力 約9%・💧水力 約7%・☀️太陽光 約10%・💨風力 約1%・♨️地熱とバイオ 約5%。'],
      hint: '🔥67%・⚛️9%・💧7%・☀️10%・💨1%・♨️6% に すると ぴったり。', quiz: ['mix'] },
    { id: 'x4', title: '2050年 脱炭素社会へ', era: 'チャプター4', lim: LIM.free, show: ['co2', 'cost', 'stab', 'init', 'maint', 'safe', 'sust', 'waste', 'capf', 'social'],
      goals: [{ m: 'co2', op: '<=', v: 78 }, { m: 'cost', op: '<=', v: 19.5 }, { m: 'waste', op: '>=', v: 2.6 }, { m: 'capf', op: '>=', v: 58 }, { m: 'social', op: '>=', v: 2.8 }],
      intro: ['最後は 2050年。いまの 日本（🔥約7割）から、脱炭素の 日本へ。', 'この ゲームの 道具だけで、停電させずに どこまで 行ける？'],
      hint: '🔥を 50%くらい、💧💨♨️を 上限まで、⚛️を 1割くらい、☀️を 1割くらい。', learn: () => FINAL.learn(), quiz: ['plan'] }
  ] },
  // 📘 シナリオ 第4部（モード選択には 出さない）。目標は 第3部の 公約から つくる（p4Goals）
  p4: { icon: '📘', name: 'シナリオ 第4部「日本の 大臣へ」', desc: '', hidden: true, chapters: [
    { id: 'p4', title: '町長の 公約を 日本でも 守れる？', era: '2040年度', lim: LIM.y2040, show: ['co2', 'cost', 'stab', 'self', 'safe'], goals: [], intro: [], quiz: [],
      hint: '🔥を 少し へらし、その 分を ⚛️💧💨♨️☀️に。雨と 猛暑の 日の 夕方を 見ながら。' }] },
  // 🎓 チュートリアル（モード選択の ⓪）：画面の 見かた・目標・ボタンを 1つずつ 指で さして 説明する（tutSteps）
  tut: { icon: '🎓', name: 'チュートリアル', desc: '画面の 見かた・目標・ボタンを 1つずつ', hidden: true, chapters: [
    { id: 't0', title: '大臣の しごとを おぼえよう', era: 'チュートリアル', lim: LIM.free, goals: [{ m: 'renew', op: '>=', v: 30 }], show: ['co2', 'cost', 'stab', 'renew'], intro: [], quiz: [],
      hint: '🔥を 少し へらして、💧☀️💨♨️（再エネ）に 入れよう。☀️だけを ふやしすぎると 停電する 日が 出るよ。',
      learn: () => '画面の 見かたは これで OK！ つぎは ①はじめての ミッションで、ものさしを 体験しよう。' }] },
  free: { icon: '🧪', name: 'フリー', desc: '上限の 中で 自由に 組み合わせて、いつでも 宣言できる', chapters: [
    { id: 'free', title: '自由に 組み合わせよう', era: 'フリー', lim: LIM.free, goals: [], show: ['co2', 'cost', 'stab', 'self', 'safe', 'sust', 'renew'],
      intro: ['上限の 中で 自由に 組み合わせて、日本の 1日を ためしてみよう。', 'できたら「宣言する」で きみの 考えを まとめよう。'], hint: '', quiz: [] }
  ] }
};
// ⚡ 4つの日 停電なし：安定供給は 大前提なので、どの チャプターも 目標の 1つに 入れる
//   （m2「火力ゼロ」は 停電する ことを 見つける 実験なので 入れない）
const DAYGOAL = { days: true };
Object.values(MODES).forEach(M => M.chapters.forEach(ch => { if (ch.goals.length && !ch.noS && !ch.goals.includes(DAYGOAL)) ch.goals.push(DAYGOAL); }));
const ROUTES = ['env', 'stab', 'sust'];
// モード選択：おすすめの 順番と むずかしさ（★1〜5。ものさしと 目標の 数で 決めた ゲームの 中の 目安）
const ORDER = { mission: ['①', 1], story: ['②', 2], real: ['③', 3], adv: ['④', 4], expert: ['⑤', 5] };

/* ---------- わりあいの 調整（合計100%・上限・つかえない電源・🔒固定） ---------- */
function normalize(mix, k, v, ch, locks) {
  const en = ch.enabled || KEYS, lim = ch.lim, m = Object.assign({}, mix);
  KEYS.forEach(x => { if (!en.includes(x)) m[x] = 0; });
  m[k] = clamp(Math.round(v), 0, lim[k]);
  const others = en.filter(x => x !== k && !(locks && locks[x]));
  const fixed = en.filter(x => x === k || (locks && locks[x])).reduce((a, x) => a + m[x], 0);
  let need = 100 - fixed - others.reduce((a, x) => a + m[x], 0);
  // 足りない／多すぎる 分を、余地に 合わせて 配る（整数）
  for (let it = 0; it < 200 && need !== 0; it++) {
    const cand = others.filter(x => need > 0 ? m[x] < lim[x] : m[x] > 0);
    if (!cand.length) break;
    const room = cand.map(x => need > 0 ? lim[x] - m[x] : m[x]), tot = room.reduce((a, b) => a + b, 0);
    let moved = 0;
    cand.forEach((x, i) => { const d = Math.trunc(need * room[i] / tot); const dd = need > 0 ? Math.min(d, lim[x] - m[x]) : Math.max(d, -m[x]); m[x] += dd; moved += dd; });
    need -= moved;
    if (need !== 0 && !moved) {    // 端数：いちばん 余地の ある 電源へ 1ずつ
      const x = cand.slice().sort((a, b) => (need > 0 ? (lim[b] - m[b]) - (lim[a] - m[a]) : m[b] - m[a]))[0];
      m[x] += Math.sign(need); need -= Math.sign(need);
    }
  }
  if (need !== 0) m[k] = clamp(m[k] + need, 0, lim[k]);   // ほかが 動けないときは 自分を もどす
  return m;
}
const total = m => KEYS.reduce((a, k) => a + (m[k] || 0), 0);
// 合計が 100%に 足りない あいだは、決めた 分の 中の わりあいで ものさしを 見せる
const norm = m => { const t = total(m); if (!t || t === 100) return m; const o = {}; KEYS.forEach(k => { o[k] = m[k] * 100 / t; }); return o; };
function startMix(ch) {
  if (ch.start) { const m = {}; KEYS.forEach(k => { m[k] = ch.start[k] || 0; }); return m; }
  // ふつうは 2024年の 日本から（上限・つかえない電源に 合わせる）
  let m = {}; KEYS.forEach(k => { m[k] = Math.round(BASE[k]); });
  m.thermal = 100 - KEYS.filter(k => k !== 'thermal').reduce((a, k) => a + m[k], 0);
  return normalize(m, 'thermal', Math.min(m.thermal, ch.lim.thermal), ch, null);
}

/* ---------- 24時間の 計算（日本の 1日：平均需要＝100） ---------- */
// about：その日に 何が かわるか（画面に 出す。風の 強さは ふつうの 日＝0.35）
const DAYS = {
  sunny: { icon: '☀️', name: '晴れ', sun: 1, wind: 1, dem: 1, about: '☀️ よく 晴れて、風は ふつう' },
  cloud: { icon: '🌧️', name: '雨', sun: 0.32, wind: 1, dem: 1, about: '☀️は 晴れの日の 約3割（東京エリア 2024年）' },
  calm: { icon: '🍃', name: '風なし', sun: 1, wind: 0.1, dem: 1, about: '💨は ふつうの 日の 約1割（東京エリア 2024年で いちばん 風の 弱い 日）' },
  heat: { icon: '🥵', name: '猛暑', sun: 1, wind: 0.64, dem: 1.16, about: '使う 量が 約1.16倍（2024年7月で いちばん 使った 日）。夏は 💨も 1年の 平均の 約0.64倍' }
};
const sunAt = h => (h > 5.5 && h < 18.5) ? Math.sin(Math.PI * (h - 5.5) / 13) : 0;
const windAt = (h, day) => clamp(day.wind * (0.8 + 0.4 * Math.sin(h / 3.5 + 1)) / 0.8, 0, 1.8);   // 1日の 中の ゆらぎ（平均は 変えない）
const lerpH = (a, h) => { const i = Math.floor(h) % 24, f = h - Math.floor(h); return a[i] * (1 - f) + a[(i + 1) % 24] * f; };
const solarAt = h => lerpH(EC.CFG.solarShape, h);   // 晴れの日の 太陽光の 形（東京エリア 2024年、最大＝1）
// 4つの日の うち 停電する 日（わりあいが 同じなら 前の 計算を 使う）
let bdKey = '', bdVal = [];
function blackDays(m) { const k = KEYS.map(x => m[x]).join(','); if (k !== bdKey) { bdKey = k; bdVal = Object.values(DAYS).filter(d => simulate(m, d).black.length); } return bdVal; }
const rangesH = hs => { const out = []; let a = hs[0], b = hs[0]; hs.slice(1).concat([null]).forEach(h => { if (h === b + 1) { b = h; return; } out.push(a === b ? `${a}時` : `${a}〜${b + 1}時`); a = b = h; }); return out.join('・'); };
function demandShape() {
  const s = EC.CFG.demandShape.slice();   // 東京エリア 2024年 実績の 1日の 形（config.js）
  const mm = s.reduce((a, b) => a + b, 0) / 24;
  return s.map(v => v / mm);
}
// ためる 設備（揚水発電・蓄電池）：日本に もとから ある 分 ＋ 統合コストで 用意する 分（☀️＋💨が 25%を こえた 分）
// ためる 設備：いまの 揚水発電（出力 2,072万kW＝発電コスト検証2021の 資料・9社、蓄電容量 約130GWh＝JST 低炭素社会戦略センター 2019年）を、
// 1年の 平均の 使う 量（9,911億kWh÷8,760時間）＝100 に そろえた 値。ためて 出すと 3割 へる（発電コスト検証2021「揚水動力の ロス率 30%」）
const STORE = { p: 18.3, e: 115, eff: 0.7 };
const storeOf = () => STORE;
function simulate(share, day) {
  const D = demandShape().map(v => v * 100 * day.dem), cap = {}, sto = storeOf(share);
  SRC.forEach(s => { cap[s.k] = share[s.k] / s.cf; });
  let soc = sto.e * 0.5, hours = [];
  for (let pass = 0; pass < 2; pass++) {   // 2日 まわして 2日目を 見る（夜の 🔋は 前の日の 昼に ためた 分）
    hours = [];
    for (let h = 0; h < 24; h++) {
      const gg = { nuclear: cap.nuclear, geo: cap.geo, hydro: cap.hydro,
        wind: cap.wind * windAt(h, day),
        solar: cap.solar * solarAt(h) * day.sun, thermal: 0, store: 0 };
      const must = gg.nuclear + gg.geo + gg.hydro + gg.wind + gg.solar;
      let curt = 0, short = 0, chg = 0;
      if (must >= D[h]) {
        const sur = must - D[h]; chg = Math.min(sur, sto.p, (sto.e - soc) / sto.eff); soc += chg * sto.eff; curt = sur - chg;
        let left = sur; ['solar', 'wind', 'hydro', 'geo', 'nuclear'].forEach(k => { const x = Math.min(left, gg[k]); gg[k] -= x; left -= x; });
      } else {
        let need = D[h] - must; gg.thermal = Math.min(need, cap.thermal); need -= gg.thermal;
        gg.store = Math.min(need, sto.p, soc); soc -= gg.store; need -= gg.store;
        short = need > 1e-6 ? need : 0;
      }
      hours.push({ h, D: D[h], g: gg, curt, short, chg, soc: soc / sto.e });
    }
  }
  return { hours, sto, black: hours.filter(x => x.short > x.D * 0.02).map(x => x.h), curtE: hours.reduce((a, x) => a + x.curt, 0), served: hours.reduce((a, x) => a + x.D - x.short, 0) };
}
function hourWord(x) {
  if (x.short > x.D * 0.02) return ['s-ng', `⬛ つくる ＜ 使う → 停電！`];
  if (x.curt > x.D * 0.03) return ['s-waste', '🗑️ ためきれずに あまった 電気を すてている'];
  if (x.chg > x.D * 0.03) return ['s-save', '🔋 あまった 電気を ためている（揚水・蓄電池）'];
  if (x.g.store > x.D * 0.03) return ['s-use', '🔋 ためた 電気で ささえている'];
  if (x.g.thermal > x.D * 0.5) return ['s-ok', '🔥 火力が がんばって 調整中'];
  return ['s-ok', '✅ つくる ＝ 使う。ぴったり！'];
}

/* ---------- 日本地図（ブロック）：H北海道 T東北 K関東 C中部 N近畿 G中国 S四国 Q九州 ---------- */
const MAP = [
  '..............HHH.....', '.............HHHHH....', '............HHHHHHH...', '.............HHHHH....', '..............HH......',
  '..............TT......', '.............TTT......', '.............TTTT.....', '............TTTT......', '............TTTT......',
  '...........CCTTT......', '..........CCCKKK......', '.........CCCCKKK......', '........NNCCCKK.......', '......GNNNCC..........',
  '....GGGNNN............', '...GGGG.SSS...........', '..QQ.....SS...........', '.QQQ..................', '.QQQ..................', '..QQ..................'];
const REG = {
  H: { name: '北海道', col: '#A9DCF0', dem: 4 }, T: { name: '東北', col: '#B5E3A8', dem: 7 }, K: { name: '関東', col: '#FFD9A0', dem: 33 },
  C: { name: '中部', col: '#C9E8B0', dem: 13 }, N: { name: '近畿', col: '#FFC9B9', dem: 16 }, G: { name: '中国', col: '#D7C8F0', dem: 6 },
  S: { name: '四国', col: '#BFE6D9', dem: 3 }, Q: { name: '九州', col: '#FFE6A8', dem: 10 }
};
// どの電源が どの地方に 向いているか（キャラを 置く 場所）
const FIT = {
  solar: { Q: 3, C: 2, K: 2, N: 2, G: 2, S: 2, T: 1.5, H: 1 }, wind: { H: 4, T: 4, Q: 1.5, C: 0.5 },
  geo: { Q: 4, T: 3, H: 1.5, C: 1 }, hydro: { C: 4, T: 3, H: 1.5, N: 1, Q: 1 },
  nuclear: { N: 3, Q: 2, T: 1, H: 1, C: 1, G: 1, S: 1 }, thermal: { K: 4, N: 3, C: 3, Q: 2, T: 1, G: 1, H: 1 }
};
const CELL = 22;

/* ---------- 状態 ---------- */
let root = null, onBack = null, opts = {}, R3 = null, st = null, mix = {}, locks = {}, day = DAYS.sunny, run = null, lastR = null, dragFrom = null, saveKey = 'ec.jp.v2';
const store = () => { try { return JSON.parse(localStorage.getItem(saveKey) || '{}'); } catch (e) { return {}; } };
const storeSet = o => { try { localStorage.setItem(saveKey, JSON.stringify(Object.assign(store(), o))); } catch (e) {} };

function open(back, o) {
  onBack = back; opts = o || {};
  root = document.createElement('div'); root.id = 'jp';
  root.innerHTML = `<div id="jpView"></div>
    <div class="jp-top"><button id="jpBack">◀ もどる</button><b class="jp-ttl" id="jpTtl">🗾 日本エネルギーミックス大作戦 3D</b><div class="jp-goals" id="jpGoals"></div></div>
    <div class="jp-left" id="jpLeft"></div>
    <div class="jp-right" id="jpRight"></div>
    <div class="jp-legend" id="jpLegend"></div>
    <div class="jp-bottom" id="jpBottom" hidden></div>
    <div class="jp-modal" id="jpModal" hidden></div>`;
  document.body.appendChild(root);
  // 上の バー（目標の チップ）が 2行に なっても、左右の パネルが その 下から はじまるように
  const bar = root.querySelector('.jp-top'), barH = () => { if (root) root.style.setProperty('--jpTop', bar.offsetTop + bar.offsetHeight + 'px'); };
  if (g.ResizeObserver) new ResizeObserver(barH).observe(bar); else barH();
  root.querySelector('#jpBack').onclick = () => { sfx('tap'); if (opts.mode || !st || st.screen === 'menu') return close(); showMenu(); };
  KEYS.forEach(k => { mix[k] = Math.round(BASE[k]); }); mix.thermal = 100 - KEYS.filter(k => k !== 'thermal').reduce((a, k) => a + mix[k], 0);
  try { build3D(); } catch (e) { R3 = null; }
  EC.Audio && EC.Audio.setMood && EC.Audio.setMood('day');
  st = { screen: 'menu' };
  if (opts.mode) startMode(opts.mode); else if (!store().tutDone) tutAsk(); else showMenu();
}
function close() {
  tut.on = false; cancelAnimationFrame(tut.raf); tut.el = null;
  if (R3) { cancelAnimationFrame(R3.raf); R3.ro.disconnect(); R3.renderer.dispose(); }
  R3 = null; run = null; root.remove(); root = null;
  if (onBack) onBack();
}

/* ---------- モード選択 ---------- */
function modal(html, cls) {
  const m = root.querySelector('#jpModal'); m.hidden = false; m.className = 'jp-modal ' + (cls || '');
  m.innerHTML = `<div class="jp-card">${html}</div>`;
  const c = m.firstChild; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
  return c;
}
const hideModal = () => { root.querySelector('#jpModal').hidden = true; };
const secretary = (lines, mood) => `<div class="jp-talk"><div class="jp-cp">${g.Chappy2D ? Chappy2D.svg(mood || 'normal', mood === 'happy' ? 'wave' : '') : '🤖'}</div><div class="jp-say">${lines.join('<br>')}</div></div>`;
function showMenu() {
  st = { screen: 'menu' }; run = null; root.classList.remove('playing');
  ['#jpLeft', '#jpRight', '#jpGoals', '#jpLegend'].forEach(s => { root.querySelector(s).innerHTML = ''; });
  root.querySelector('#jpBottom').hidden = true;
  root.querySelector('#jpTtl').textContent = '🗾 日本エネルギーミックス大作戦 3D';
  if (R3) R3.spin = true;
  const sv = store().cleared || {};
  // ①〜⑤＝おすすめの 順番、★＝むずかしさ（多いほど むずかしい）、クリアした 数は 別に 表示
  const diff = n => `<span class="jp-diff">むずかしさ <b>${'★'.repeat(n)}</b>${'☆'.repeat(5 - n)}</span>`;
  const prog = (c, n) => `<span class="jp-prog ${c >= n ? 'done' : ''}">${c >= n ? '✅ ぜんぶ クリア' : `クリア ${c} / ${n}`}</span>`;
  const card = k => { const M = MODES[k], n = M.chapters.length, c = Math.min(sv[k] || 0, n); return `<button class="jp-mode" data-k="${k}"><em class="no">${ORDER[k][0]}</em><i>${M.icon}</i><b>${M.name}</b><small>${M.desc}</small>${diff(ORDER[k][1])}${prog(c, n)}</button>`; };
  const nStory = ROUTES.filter(r => (sv[r] || 0) >= MODES[r].chapters.length).length;
  const unlocked = store().expert || (sv.adv || 0) >= MODES.adv.chapters.length;
  const c = modal(`<div class="jp-hero"><small>あなたは</small><b>⚡ エネルギー大臣 ⚡</b><span>日本の 電気を どう つくる？ 6つの 電源の わりあいを 決めよう</span><button class="jp-globe" title="？">🌏</button></div>`
    + secretary(['大臣、ようこそ！ 秘書の チャッピーです。', 'スライダーで わりあいを 決めると、3Dの 日本が 変わります。けむり＝CO₂、🚢＝輸入燃料 ですよ！'], 'happy')
    + `<p class="jp-order">👉 <b>⓪チュートリアル → ①から 順番に</b> すすむと わかりやすいよ。<span>★が 多いほど むずかしい</span></p>`
    + `<div class="jp-modes"><button class="jp-mode tut" data-k="tut"><em class="no">⓪</em><i>🎓</i><b>チュートリアル</b><small>画面の 見かた・目標・ボタンを 1つずつ（約5分）</small><span class="jp-prog ${store().tutDone ? 'done' : 'first'}">${store().tutDone ? '✅ おわった' : '👆 はじめての 人は ここから'}</span></button>${card('mission')}<button class="jp-mode story" data-k="story"><em class="no">${ORDER.story[0]}</em><i>📖</i><b>ストーリー</b><small>3つの ルートから 大臣の 道を えらぶ → 2050年へ</small>${diff(ORDER.story[1])}<span class="jp-prog ${nStory >= 3 ? 'done' : ''}">ルート ${ROUTES.map(r => MODES[r].icon + ((sv[r] || 0) >= MODES[r].chapters.length ? '✅' : '')).join(' ')}</span></button>${card('real')}${card('adv')}${unlocked ? card('expert') : `<button class="jp-mode lock" data-k="lock"><em class="no">${ORDER.expert[0]}</em><i>🔒</i><b>？？？</b><small>④アドバンスを ぜんぶ クリアすると あらわれる…（どこかの 🌏にも ひみつが？）</small>${diff(ORDER.expert[1])}</button>`}<button class="jp-mode free" data-k="free"><em class="no any">いつでも</em><i>${MODES.free.icon}</i><b>${MODES.free.name}</b><small>${MODES.free.desc}</small><span class="jp-prog">目標なし・じっけん用</span></button></div>`
    + `<p class="jp-note">数値は 国の 統計・審議会資料を もとに ゲーム用に 丸めた めやすです（資源エネルギー庁 2024年度確報・第7次エネルギー基本計画・電力中央研究所 ほか）。</p>`, 'menu');
  c.querySelectorAll('.jp-mode').forEach(b => b.onclick = () => { if (b.dataset.k === 'lock') { sfx('bad'); return; } sfx('pick'); b.dataset.k === 'story' ? showRoutes() : startMode(b.dataset.k); });
  c.querySelector('.jp-globe').onclick = () => { if (unlocked) { sfx('tap'); return; } storeSet({ expert: true }); sfx('clearBig'); showMenu(); };
}
function showRoutes() {
  const c = modal(`<h3>📖 どんな 大臣に なる？</h3>` + secretary(['ルートに よって 大事に する ものが ちがいます。', 'でも 最後は どのルートも「2050年 脱炭素」。ほかの ものさしを わすれると ワナが…？'], 'normal')
    + `<div class="jp-modes">${ROUTES.map(k => `<button class="jp-mode" data-k="${k}"><i>${MODES[k].icon}</i><b>${MODES[k].name}</b><small>${MODES[k].desc}</small></button>`).join('')}</div>
    <button class="btn ghost" id="jpRB">◀ もどる</button>`, 'menu');
  c.querySelectorAll('.jp-mode').forEach(b => b.onclick = () => { sfx('pick'); startMode(b.dataset.k); });
  c.querySelector('#jpRB').onclick = showMenu;
}

/* ---------- チャプター ---------- */
function startMode(k) {
  if (k === 'p4' && !(opts.pri && opts.pri.length === 3)) return p4Pledge();
  st = { screen: 'play', mode: k, M: MODES[k], ci: 0, tries: [], asked: new Set(), results: [] };
  if (k === 'p4') { const ch = MODES.p4.chapters[0]; ch.goals = p4Goals(opts.pri); ch.intro = p4Intro(opts.pri); }
  startChapter();
}

/* ---------- 📘 シナリオ 第4部「日本の 大臣へ」 ----------
   リアル日本（国の めあてを 再現・挑戦する）とは ちがい、町長の 公約を 日本で 守れるかを ためし、
   国民の 声に 大臣として 説明し、国の めやすと くらべてから 宣言する。
   公約の 目標は「2024年度の 日本より よく する」（目標の 数を 作者が 決めない） */
const P4GOAL = { env: { m: 'co2', op: '<' }, econ: { m: 'cost', op: '<' }, safe: { m: 'safe', op: '>' }, self: { m: 'self', op: '>' } };
const priName = k => { const x = PRI.find(p => p[0] === k); return x[1] + x[2].replace(/（.*$/, ''); };
function p4Goals(pri) {
  const b = metrics(BASE), gs = pri.map(k => k === 'stab' ? { days: true, pl: true } : Object.assign({ v: b[P4GOAL[k].m], base: true, pl: true }, P4GOAL[k]));
  if (!pri.includes('stab')) gs.push(DAYGOAL);   // 停電しないことは 大前提
  return gs;
}
const p4Intro = pri => [`きみは 町長から 日本の <b>エネルギー大臣</b>に なった！ 町長の ときの 公約は <b>${pri.map(priName).join('・')}</b>。`,
  '🏘️ 町と ちがう ところ：① 日本の 電気の 約7割は 🔥火力で、燃料の ほとんどは 輸入（自給率 約16%）。② 発電所を 置ける 場所に 限りが ある（上限＝国の 2040年度の めやす）。③ 発電所の 近くに 住む 人、温泉や 海で はたらく 人など、たくさんの 人が いる。',
  '🎯 公約の ものさしを、いまの 日本（2024年度）より よく しよう。決めたら、<b>国民の 声</b>に 大臣として 答えるよ。'];
// 公約の 記録が ない ときは ここで 決める
function p4Pledge() {
  const pick = [];
  root.querySelector('#jpTtl').textContent = '📘 シナリオ 第4部「日本の 大臣へ」';
  const c = modal(`<div class="jp-chhead"><small>📘 シナリオ 第4部</small><b>📣 大臣の 公約</b></div>` + secretary(['町長の ときの 公約が 見つかりません。', '大臣として 大事に する ものを 3つ えらんでください。'], 'normal')
    + `<div class="jp-pri">${PRI.map(([k, ic, nm]) => `<button data-k="${k}"><i>${ic}</i>${nm}<b></b></button>`).join('')}</div><button class="btn go" id="jpPG" disabled>この 公約で すすむ ▶</button>`, 'menu');
  c.querySelectorAll('.jp-pri button').forEach(b => b.onclick = () => {
    const k = b.dataset.k, i = pick.indexOf(k); if (i >= 0) pick.splice(i, 1); else if (pick.length < 3) pick.push(k);
    c.querySelectorAll('.jp-pri button').forEach(x => { const j = pick.indexOf(x.dataset.k); x.classList.toggle('on', j >= 0); x.querySelector('b').textContent = j >= 0 ? '✔' : ''; });
    c.querySelector('#jpPG').disabled = pick.length < 3; sfx('tap');
  });
  c.querySelector('#jpPG').onclick = () => { sfx('pick'); opts.pri = pick.slice(); EC.Log && EC.Log.add({ t: 'pledge', part: 4, pri: opts.pri }); startMode('p4'); };
}
// 🗣️ 国民の 声：2024年度より ふやした 電源・へらした 火力ごとに、実際に 言われている 心配（数は 使わない）
const VOICE = {
  nuclear: ['🏡', '原子力発電所の 近くに 住む 人', '事故が 起きたら、ふるさとに 住めなく なるかもしれない。放射性廃棄物を 最後に うめる 場所も まだ 決まっていないよね？'],
  solar: ['⛰️', '山の ふもとに 住む 人', '山を 切りひらいて パネルを ならべると、景色が 変わるし、大雨の ときの 土砂くずれも 心配。'],
  wind: ['🎣', '海で はたらく 漁師', '海に 風車が たくさん 建つと、漁の じゃまに ならないか 心配。'],
  geo: ['♨️', '温泉旅館の 人', '近くで 地熱発電を すると、温泉の お湯が へらないか 心配。'],
  hydro: ['🏞️', '山の 村の 人', '新しい ダムを つくると、村や 森が 水の 底に しずむかもしれない。'],
  thermal: ['🏭', '火力発電所の ある 町の 人', '火力を へらすと、発電所で はたらく 人の 仕事は どう なるの？'],
  co2: ['🧒', '子ども', 'CO₂が へっていないよ。地球温暖化は だいじょうぶ？'],
  cost: ['🔧', '工場で はたらく 人', '電気代が 上がると、ものを つくる お金が ふえて こまる。']
};
function voices(r) {
  const b = metrics(BASE), cons = [];
  ['nuclear', 'solar', 'wind', 'geo', 'hydro'].forEach(k => { if (mix[k] > BASE[k]) cons.push(k); });
  if (mix.thermal < BASE.thermal) cons.push('thermal');
  if (r.co2 >= b.co2) cons.push('co2');
  if (r.cost > b.cost) cons.push('cost');
  const pros = [r.co2 < b.co2 ? '🧒 子ども「CO₂が へって、地球温暖化が 少しでも おさえられると いいな」' : '', r.self > b.self ? '🚢 港の 人「輸入に たよる 分が へると、外国で 争いが あっても 燃料の 心配が へる」' : '', r.cost < b.cost ? '🏪 お店の 人「電気を つくる お金が へるのは うれしい」' : ''].filter(Boolean);
  let who = null;
  const c = modal(`<div class="jp-chhead"><small>📘 第4部</small><b>🗣️ 国民の 声に 答えよう</b></div>`
    + secretary(['大臣、国民から 声が とどいています。', 'ものさしが よく なっても、こまる 人が いる ことも あります。<b>いちばん 大事だと 思う 心配</b>を 1つ えらんで、大臣として 説明してください。'], 'normal')
    + (pros.length ? `<div class="jp-vpos">${pros.map(t => `<span>😊 ${t}</span>`).join('')}</div>` : '')
    + `<h4>😟 心配の 声 <small>（2024年度より ふやした・へらした 電源から）</small></h4><div class="jp-voices">${cons.map(k => `<button data-k="${k}"><i>${VOICE[k][0]}</i><b>${VOICE[k][1]}</b><span>「${VOICE[k][2]}」</span></button>`).join('')}</div>
    <label class="jp-ta"><span>えらんだ 人へ：なぜ この わりあいに したか ＋ 心配を へらす 工夫</span><textarea id="jpVT" rows="3" placeholder="例：CO₂を へらす ために ふやしました。場所を えらぶ ときは、地元の 人と 話し合って 決めます。"></textarea></label>
    <div class="row2"><button class="btn" id="jpVB">◀ わりあいを 見なおす</button><button class="btn go" id="jpVG" disabled>📣 説明する</button></div>`, 'wide');
  const t = c.querySelector('#jpVT'), go = c.querySelector('#jpVG'), paint = () => { go.disabled = !who || !t.value.trim(); };
  c.querySelectorAll('.jp-voices button').forEach(bt => bt.onclick = () => { who = bt.dataset.k; c.querySelectorAll('.jp-voices button').forEach(x => x.classList.toggle('on', x === bt)); sfx('tap'); paint(); t.focus(); });
  t.oninput = paint;
  c.querySelector('#jpVB').onclick = () => { sfx('tap'); hideModal(); };
  go.onclick = () => { st.voice = { who: VOICE[who][1], text: t.value.trim() }; EC.Log && EC.Log.add(Object.assign({ t: 'voice' }, st.voice)); sfx('right'); comparePlan(); };
}
// 🧩 国の 2040年度の めやすと くらべる（どれが 正しいか では なく、国は 何を 前提に しているかを 考える）
const PLAN40 = [['thermal', '🔥 火力', 30, 40, m => m.thermal], ['nuclear', '⚛️ 原子力', 20, 20, m => m.nuclear], ['renew', '🌱 再エネ', 40, 50, m => m.hydro + m.solar + m.wind + m.geo]];
function comparePlan() {
  const gap = PLAN40.map(([k, nm, lo, hi, f]) => { const v = f(mix); return { k, nm, lo, hi, v, d: v < lo ? v - lo : v > hi ? v - hi : 0 }; });
  const far = Math.max(...gap.map(x => Math.abs(x.d)));
  const c = modal(`<div class="jp-chhead"><small>📘 第4部</small><b>🧩 国の めやすと くらべよう</b></div>
    <div class="jp-sbs">${sbar('きみ', segOf(mix))}${sbar('2024年', segOf(BASE))}${sbar(...REFBAR.r3)}</div>
    <div class="jp-rq"><b>👆 国の 2040年度の めやすと くらべて、きみの 案で いちばん はなれているのは？</b></div>
    <div class="jp-qa">${gap.map((x, i) => `<button class="btn" data-i="${i}">${x.nm}</button>`).join('')}</div><div id="jpCF"></div>`, 'wide');
  let miss = 0;
  c.querySelectorAll('.jp-qa [data-i]').forEach(bt => bt.onclick = () => {
    const x = gap[+bt.dataset.i], ok = Math.abs(x.d) === far;
    if (!ok) { miss++; sfx('bad'); c.querySelector('#jpCF').innerHTML = `<div class="jp-qfb ng"><b>🤔 もう 一度</b><p>${x.nm}は きみ ${x.v}%、国は ${x.lo === x.hi ? `${x.lo}%程度` : `${x.lo}〜${x.hi}%`}。帯の 長さを くらべよう。</p></div>`; return; }
    sfx('right'); EC.Log && EC.Log.add({ t: 'read', where: 'p4', ok: !miss });
    c.querySelectorAll('.jp-qa [data-i]').forEach(y => { y.disabled = true; if (Math.abs(gap[+y.dataset.i].d) === far) y.classList.add('go'); });
    c.querySelector('#jpCF').innerHTML = `<div class="jp-qfb ok"><b>⭕ そう！</b><p>${gap.map(y => `${y.nm}：きみ <b>${y.v}%</b> ／ 国 ${y.lo === y.hi ? `${y.lo}%程度` : `${y.lo}〜${y.hi}%`}${y.d ? `（${Math.abs(y.d)} ${y.d > 0 ? '多い' : '少ない'}）` : '（はんいの 中）'}`).join('<br>')}</p>
      <p>${NOTE_PLAN}</p><p>⚖️ どちらが 正しい では なく、<b>国の 案は 何を 前提に しているか</b>（蓄電池・送電線・予備の 火力・水素など）を 考えて、宣言に 生かそう。</p><small>出典：${F.SRC.plan7}</small></div>
      <button class="btn go" id="jpCN">📜 宣言へ</button>`;
    c.querySelector('#jpCN').onclick = () => { sfx('tap'); declare(); };
  });
}
function chapter() { return st.M.chapters[st.ci]; }
function startChapter() {
  const ch = chapter();
  st.screen = 'play'; st.tries = []; st.showRef = false; st.whyAsked = false; locks = {}; run = null;
  root.querySelector('#jpBottom').hidden = true; root.classList.remove('playing');   // まえの チャプターの 1日の グラフを けす
  mix = startMix(ch);
  if (R3) R3.spin = false;
  hideModal(); buildHUD(); update(true);
  if (st.mode === 'tut') return tutStart();
  cutIn('ep', { no: ch.era, icon: st.M.icon, title: ch.title, goal: ch.goals.length ? ch.goals.map(gText).join('　') : '自由に ためそう', alert: false }, () => {
    const c = modal(`<div class="jp-chhead"><small>${st.M.icon} ${st.M.name}・${ch.era}</small><b>${ch.title}</b></div>` + secretary(ch.intro, 'normal')
      + (ch.goals.length ? `<div class="jp-goalbox"><b>🎯 目標</b>${ch.goals.map(gl => `<span>${gText(gl)}</span>`).join('')}</div>` : '')
      + `<div class="jp-how"><span>① 電源の キャラを タップ → 📖 特徴カード</span><span>② 何かを へらして「のこり」を つくり、ほかに 入れる（合計100%）</span><span>③ ものさしと 🗾4つの日の ⭕⚡を 見る。⚡＝停電。日を タップで その日の ようす</span><span>④「✅ 決定」で 結果発表</span></div>
      <button class="btn go" id="jpStart">はじめる ▶</button>`);
    c.querySelector('#jpStart').onclick = () => { sfx('tap'); hideModal(); };
  });
}
function cutIn(kind, o, then) {
  const el = document.createElement('div'); el.className = 'st-fx ' + kind; root.appendChild(el);
  let done = false;
  const end = () => { if (done) return; done = true; el.classList.add('out'); setTimeout(() => el.remove(), 260); then && then(); };
  if (kind === 'ep') { el.innerHTML = `<div class="fx-no">${o.no}</div><div class="fx-icon">${o.icon}</div><div class="fx-title">${o.title}</div><div class="fx-goal">🎯 ${o.goal}</div>`; sfx('epStart'); }
  else if (kind === 'drum') { el.innerHTML = '<div class="fx-drum">けっかは<span>.</span><span>.</span><span>.</span></div>'; sfx('drumroll'); el.onclick = end; return setTimeout(end, 1350); }
  else if (kind === 'clear') { el.innerHTML = `<div class="rays"></div><div class="fx-big">${o.big}</div><div class="fx-sub">${o.sub}</div>` + [...Array(70)].map((_, i) => `<i class="cf" style="left:${Math.random() * 100}%;background:${['#F5B301', '#EB4B43', '#2FC1DA', '#34B56A', '#7B5CC4', '#FF7FB6'][i % 6]};animation-delay:${Math.random() * 0.6}s;animation-duration:${1.6 + Math.random() * 1.2}s"></i>`).join(''); sfx('clearBig'); }
  else if (kind === 'fail') { el.innerHTML = `<div class="fx-bulb">💡</div><div class="fx-big">${o.big}</div><div class="fx-sub">${o.sub}</div>`; sfx('failBig'); }
  let ready = false; setTimeout(() => { ready = true; el.insertAdjacentHTML('beforeend', '<div class="fx-next">👆 タップで すすむ</div>'); }, 1400);
  el.onclick = () => { if (ready) end(); };
}

/* ---------- 🏆 ものさしの 説明と ランキング（右上の アイコン・上の 目標チップから ひらく） ---------- */
const STAR = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const RANK = {
  co2: { v: s => s.co2, low: true, f: v => v + 'g', what: '1kWh つくる ときの CO₂（つくる・運ぶ・こわすまで ふくむ）', src: '電力中央研究所（🔥は 2024年度の 石炭・LNG・石油の わりあいで 平均）' },
  cost: { v: s => s.cost, low: true, f: v => v.toFixed(1) + '円', what: '1kWh つくるのに かかる お金', src: '発電コスト検証 2025年（2023年の 値）' },
  capf: { v: s => s.capf, f: v => v + '%', what: '1年じゅう 全力の ときに くらべて どれだけ 発電したか', src: '発電コスト検証 2025年' },
  self: { v: s => s.dom, f: v => v ? '◯ 国産（⚛️は 準国産）' : '✕ 燃料を 輸入', what: '燃料を 輸入に たよるか', bar: false },
  renew: { v: s => ['hydro', 'solar', 'wind', 'geo'].includes(s.k) ? 1 : 0, f: v => v ? '◯ 再エネ' : '✕ 再エネ では ない', what: '再生可能エネルギーか', bar: false },
  // 停電しないか：1つの 電源では 決まらないので 順位は つけず、天気・時間に 左右されるかで 2つに 分ける
  // ◎○△✕ は どの 天気・時間の ものか わかるように、1つずつ アイコンと 名前を 上に つける
  stab: { v: s => WX[s.k].d.every(x => x === '◎') ? 1 : 0, f: (v, s) => `<span class="rk-wx">${WXH.map(([ic, nm], j) => `<i class="${WX[s.k].d[j] === '✕' ? 'x' : WX[s.k].d[j] === '△' ? 'm' : ''}"><small>${ic}${nm}</small>${WX[s.k].d[j]}</i>`).join('')}</span>`,
    what: '天気・時間に 左右されないか', bar: false,
    key: '◎ いつも 出せる　○ 出せるが 天気で かわる　△ 少ししか 出せない　✕ 出せない',
    note: '⚡ 停電しないかは 1つの 電源では 決まらない。夕方や 夜に すぐ 出せる 電源と、ためる 設備が 足りるか（組み合わせ）で 決まる。' }
};
['safe', 'sust', 'init', 'maint', 'waste', 'social'].forEach(k => { RANK[k] = { v: s => s[k], f: v => STAR(v), what: '1〜5の 点数（高いほど よい）', src: 'ゲーム（本家「大作戦」）の 考え方。人に よって 考えが ちがう', bar: false }; });
function rankHTML(mk) {
  const R = RANK[mk]; if (!R) return '';
  const rows = SRC.map(s => ({ s, v: R.v(s) })).sort((a, b) => R.low ? a.v - b.v : b.v - a.v), mx = Math.max(...rows.map(x => x.v)) || 1;
  let no = 0, prev = null;
  rows.forEach((x, i) => { if (x.v !== prev) no = i + 1; x.no = no; prev = x.v; });
  return `<div class="jp-rk"><h4>🏆 6つの 電源の ランキング <small>${R.low ? '⬇ 少ない ほど よい' : '⬆ よい 順'}・${R.what}</small></h4>
    ${rows.map(x => `<div class="rk-row ${x.no === 1 ? 'top' : ''}"><b class="rk-no">${x.no}位</b><img src="${EC.charaIcon(x.s.k, 'happy')}" alt=""><span class="rk-nm">${x.s.icon} ${x.s.name}</span>${R.bar === false ? '<span class="rk-sp"></span>' : `<p class="rk-bar"><i style="width:${Math.max(2, x.v / mx * 100)}%;background:${COL(x.s.k)}"></i></p>`}<em class="rk-v">${R.f(x.v, x.s)}</em><small class="rk-me">${st && st.screen === 'play' ? `いま ${mix[x.s.k]}%` : ''}</small></div>`).join('')}
    ${R.key ? `<p class="rk-key">${R.key}</p>` : ''}${R.note ? `<p class="rk-note">${R.note}</p>` : ''}${R.src ? `<p class="rk-src">出典：${R.src}</p>` : ''}</div>`;
}
function metModal(mk) {
  const c = modal(`<h3>${MET[mk].icon} ${MET[mk].name}とは？</h3><p class="jp-def">${MET[mk].def}</p>${rankHTML(mk)}<button class="btn go" id="jpOK">わかった</button>`);
  c.querySelector('#jpOK').onclick = () => { sfx('tap'); hideModal(); };
}

/* ---------- 🎓 チュートリアル：画面の 一部だけ 明るく して、指で さしながら 1つずつ 説明する ----------
   at：明るく する 場所（セレクタ。配列なら まとめて）　next：「つぎへ」ボタン　ready：つぎへを おせる 条件
   wait：その 操作を したら 自動で つぎへ　hide：案内を かくして 待つ（カットインを タップで すすめる とき） */
const tut = { on: false, i: 0, steps: null, el: null, raf: 0, t0: 0, solar0: 0 };
const Q = q => root && root.querySelector(q);
const openModal = q => !!Q(`#jpModal:not([hidden]) ${q}`);
function tutSteps() {
  return [
    { text: '大臣、チュートリアルへ ようこそ！ 秘書の チャッピーです。<br>ここでは、日本の 電気を 6つの 電源で どう つくるか（<b>わりあい</b>）を 決めます。<b>画面の 見かたと ボタン</b>を、1つずつ 説明しますね。', next: true },
    { at: '#jpGoals', text: '🎯 上に ならんだ チップが <b>目標</b>（クリアの 条件）です。⬜ が ✅ に かわったら 達成。<b>ぜんぶ ✅ に して「決定」</b>すると クリア！<br>チップを タップすると、くわしい 説明も 見られます。', next: true },
    { at: '#jpLeft', text: '左は <b>電源の わりあい</b>。円グラフが いまの わりあいで、合計は いつも <b>100%</b>。<br>それぞれに <b>上限</b>（国の めやす）が あって、それより 多くは できません。', next: true },
    { at: '.jp-src[data-k=thermal] .ic', text: 'キャラを タップすると、その 電源の <b>📖 特徴カード</b>（ステータス）が 見られます。<br>👆 <b>🔥火力の キャラ</b>を タップしてみよう！', wait: () => openModal('.jp-srchead') },
    { at: '#jpModal .jp-card', text: 'これが 特徴カード。<b>◎長所・△短所</b>、<b>天気と 時間で どう かわるか</b>、<b>6つの 電源との くらべ</b>（CO₂・コスト）、<b>上限の 理由</b>が わかります。<br>◀ ▶ で ほかの 電源も 見られます。', next: true },
    { at: '#jpModal #jpOK', text: '見おわったら 👆「<b>とじる</b>」', wait: () => Q('#jpModal').hidden },
    { at: '.jp-src[data-k=thermal] .pm[data-d="-1"]', text: 'わりあいは <b>＋ − ボタン</b> か <b>スライダー</b>で 変えます。<br>まず 🔥火力を へらして「<b>のこり</b>」を つくろう。👆 <b>−</b> を <b>5回</b> おしてね', wait: () => 100 - total(mix) >= 5 },
    { at: '#jpFree', text: '「<b>のこり</b>」が できました！ のこりが ある あいだは、決定も ためしも できません。', next: true },
    { at: '.jp-src[data-k=solar] .pm[data-d="1"]', text: 'のこりを ☀️<b>太陽光</b>に 入れよう。👆 <b>＋</b> を おして、<b>合計 100%</b> に してね', wait: () => total(mix) === 100 && mix.solar > tut.solar0 },
    { at: '#jpMets', text: '右上は <b>ものさし</b>。わりあいを 変えると 数字と <b>▲▼</b>（どれだけ 変わったか）が 動きます。<br><b>｜の 線</b>が 目標で、<b class="g">緑</b>＝目標クリア、<b class="r">赤</b>＝まだ。', next: true },
    { at: '.jp-met[data-m=co2] .q', text: 'ものさしの <b>アイコン</b>を タップすると、くわしい 説明と <b>6つの 電源の ランキング</b>が 見られます。<br>👆 <b>🌏</b> を タップ！', wait: () => openModal('.jp-rk') },
    { at: '#jpModal .jp-rk', text: 'CO₂を <b>いちばん 出さない 電源から、いちばん 出す 電源まで</b>、数字で ならんでいます。「いま ○%」は きみの わりあい。<br>どの 電源を ふやすか・へらすか 考える ヒントに しよう。', next: true },
    { at: '#jpModal #jpOK', text: '👆「<b>わかった</b>」で とじよう', wait: () => Q('#jpModal').hidden },
    { at: '#jpTip', text: 'ここは <b>チャッピーの ヒント</b>。何を すれば よいか 迷ったら、ここを 見てね。', next: true },
    { at: '.jp-days', hand: '.jp-days button[data-d=cloud]', text: '<b>4つの日</b>（晴れ・雨・風なし・猛暑）で、1時間ごとに 停電しないか ためした 結果です。<b>⭕＝停電なし、⚡＝停電</b>。<br>👆 <b>🌧️雨</b> を タップすると、その日の 1日が 流れます', wait: () => !!run },
    { at: '#jpBottom', text: '下に <b>1日の グラフ</b>。色は 電源、<b>黒い 線</b>が 使う 量、<b>黒い ブロック</b>が 停電、灰色は あまって すてた 電気。⏩ で とばせます。', next: true, ready: () => !run },
    { enter: () => { tut.need = Math.max(0, 30 - metrics(norm(mix)).renew - (100 - total(mix))); }, at: ['.jp-src[data-k=thermal] .pct', '.jp-src[data-k=thermal] .btns'], hand: '.jp-src[data-k=thermal] .pm[data-d="-1"]',
      text: () => `さあ、目標を ぜんぶ ✅ に しよう！ いま 再エネは <b>${metrics(norm(mix)).renew}%</b>。目標の 30%まで あと <b>${tut.need}</b>。<br>まず 🔥火力を へらして「のこり」を つくろう。👆 <b>−</b> を <b>${tut.need}回</b> おしてね`, wait: () => 100 - total(mix) >= tut.need },
    { at: ['.jp-src[data-k=solar] .pct', '.jp-src[data-k=solar] .btns'], hand: '.jp-src[data-k=solar] .pm[data-d="1"]',
      text: 'のこりを ☀️<b>太陽光</b>（再エネ）に 入れよう。👆 <b>＋</b> を おして <b>合計 100%</b> に。<br>（💧水力・💨風力・♨️地熱バイオに 入れても 再エネが ふえるよ）', wait: () => total(mix) === 100 && chapter().goals.every(gl => gOk(gl, metrics(mix), mix)) },
    { at: '#jpGo', text: '目標が ぜんぶ ✅！ 👆「<b>✅ この わりあいで 決定！</b>」を おそう', wait: () => st.tries.length > 0 },
    { hide: true, wait: () => openModal('.jp-rank') },
    { at: '#jpModal .jp-rank', text: '<b>結果発表</b>！ ランク（S〜C）と、目標を 達成できたか。<br>ここからは、結果の <b>見る 順番</b>を 案内します（ほかの チャプターでも 同じ）。', next: true },
    { at: '#jpModal .jp-gt', text: '① <b>目標</b> 1つずつの 結果。✅＝達成、❌＝まだ。数字と 目標の 線も 見よう。', next: true },
    { at: '#jpModal .jp-days4', text: '② <b>4つの日</b>の 結果。⚡ が あると、その日の グラフと「どうすれば 停電しない？」が 出ます。', next: true },
    { at: '#jpModal .jp-sbs', text: '③ きみの <b>わりあい</b>を、2024年の 日本と くらべる 帯グラフ。', next: true },
    { at: ['#jpModal #jpRQ', '#jpModal .jp-c2'], hand: () => { const go = Q('#jpModal #jpRQgo'); if (go && !go.disabled) return go; const row = [...root.querySelectorAll('#jpModal .jp-c2 [data-mk]')].find(r => !r.querySelector('.ch button.on')); return row ? { el: row, side: 'left' } : go; },
      text: '④ ここが 大事！ 2024年と くらべて、ものさしが <b>よく</b> なったか <b>わるく</b> なったか、<b>1行ずつ 自分で 判定</b>します（⬇＝少ない ほど よい、⬆＝多い ほど よい に 注意）。<br>👆 指の 行の「よく・おなじ・わるく」を えらぼう。<b>ぜんぶ えらぶと「たしかめる」が 緑</b>に なるので、おしてね', wait: () => /\b(ok|ng)\b/.test((Q('#jpModal #jpRQ') || {}).className || '') },
    { at: '#jpModal #jpRQ', text: '答え あわせ。わるく なった ものさしは「<b>どれだけ</b>」下がったかも 見よう。<b>1つを よく すると、ほかが 下がる</b> ことも あります。', next: true },
    { at: '#jpModal #jpNext', text: '⑤ 読みおわったら、いちばん 下の <b>緑の ボタン</b>で 進みます（ふだんは「▶ つぎの チャプターへ」）。<br>もう一度 ためしたい ときは「🔄 もう一度」。👆 おしてみよう', wait: () => !openModal('.jp-rank') }
  ];
}
function tutAsk() {
  st = { screen: 'menu' };
  const c = modal(`<div class="jp-hero"><small>はじめての 大臣へ</small><b>🎓 チュートリアル</b><span>画面の 見かた・目標・ボタン・結果の 見かたを、1つずつ 指で さして 説明します（約5分）</span></div>`
    + secretary(['大臣、はじめまして！ 秘書の チャッピーです。', 'まずは チュートリアルで、どこを 見て、どの ボタンを おせば よいかを おぼえましょう！'], 'happy')
    + `<div class="row2"><button class="btn" id="jpTN">モード選択へ</button><button class="btn go" id="jpTY">🎓 チュートリアルから はじめる</button></div>`, 'menu');
  c.querySelector('#jpTY').onclick = () => { sfx('pick'); startMode('tut'); };
  c.querySelector('#jpTN').onclick = () => { sfx('tap'); showMenu(); };
}
function tutStart() {
  if (!tut.el) {
    tut.el = document.createElement('div'); tut.el.className = 'jp-tut';
    tut.el.innerHTML = `<i class="tt-b"></i><i class="tt-b"></i><i class="tt-b"></i><i class="tt-b"></i><div class="tt-hole"></div><div class="tt-hand">👆</div>
      <div class="tt-box"><div class="tt-cp">${g.Chappy2D ? Chappy2D.svg('happy', '') : '🤖'}</div><div class="tt-say"></div>
        <button class="tt-quit" id="ttSkip" title="チュートリアルを やめる">✕ やめる</button>
        <div class="tt-row"><small class="tt-no"></small><span class="tt-do">👆 光っている ところを タップ</span><button class="btn small go" id="ttNext">つぎへ ▶</button></div></div>
      <div class="tt-ask" hidden><div><b>チュートリアルを やめますか？</b><p>最後まで 見ると、どこを 見て、どの ボタンを おせば よいか わかります。</p>
        <button class="btn go" id="ttGoOn">▶ つづける</button><button class="tt-quit2" id="ttQuit">やめる</button></div></div>`;
    root.appendChild(tut.el);
    // 暗い ところで ホイールを 回しても、開いている 窓は スクロールできる
    tut.el.querySelectorAll('.tt-b').forEach(b => b.addEventListener('wheel', e => { const sc = Q('#jpModal:not([hidden]) .jp-card'); if (sc) sc.scrollTop += e.deltaY; }, { passive: true }));
    tut.el.querySelector('#ttNext').onclick = () => { const s = tut.steps[tut.i]; if (s && s.ready && !s.ready()) return; sfx('tap'); tutGo(tut.i + 1); };
    const ask = tut.el.querySelector('.tt-ask');
    tut.el.querySelector('#ttSkip').onclick = () => { sfx('tap'); ask.hidden = false; };
    tut.el.querySelector('#ttGoOn').onclick = () => { sfx('tap'); ask.hidden = true; };
    tut.el.querySelector('#ttQuit').onclick = () => { sfx('tap'); tutEnd(); };
  }
  tut.on = true; tut.steps = tutSteps(); tut.solar0 = mix.solar;
  tutGo(0); cancelAnimationFrame(tut.raf); tut.raf = requestAnimationFrame(tutFrame);
}
function tutEnd() {
  tut.on = false; cancelAnimationFrame(tut.raf); storeSet({ tutDone: true });
  if (tut.el) { tut.el.remove(); tut.el = null; }
}
const tutTargets = at => (Array.isArray(at) ? at : at ? [at] : []).map(q => typeof q === 'string' ? Q(q) : q).filter(Boolean);   // セレクタ か 要素
function tutRect(at) {
  const rs = tutTargets(at).map(e => e.getBoundingClientRect()).filter(r => r.width && r.height);
  if (!rs.length) return null;
  return { l: Math.min(...rs.map(r => r.left)), t: Math.min(...rs.map(r => r.top)), r: Math.max(...rs.map(r => r.right)), b: Math.max(...rs.map(r => r.bottom)) };
}
function tutGo(i) {
  const s = tut.steps[i];
  if (!s) return tutEnd();
  tut.i = i; tut.t0 = performance.now();
  const e = tutTargets(s.at)[0]; if (e && e.closest('.jp-card')) e.scrollIntoView({ block: 'center', behavior: 'smooth' });
  tut.el.classList.toggle('hide', !!s.hide);
  if (s.enter) s.enter();
  tut.el.querySelector('.tt-say').innerHTML = (typeof s.text === 'function' ? s.text() : s.text) || '';
  tut.el.querySelector('.tt-no').textContent = `${tut.steps.slice(0, i + 1).filter(x => !x.hide).length} / ${tut.steps.filter(x => !x.hide).length}`;
  tut.el.querySelector('#ttNext').hidden = !s.next;
  tut.el.querySelector('.tt-do').hidden = !!s.next || !s.wait;   // 生徒が タップする 番は ボタンの かわりに ことばで
}
function tutFrame() {
  if (!tut.on || !root || !tut.el) return;
  const s = tut.steps[tut.i];
  if (s.wait && performance.now() - tut.t0 > 250 && s.wait()) { sfx('right'); tutGo(tut.i + 1); }
  else if (!s.hide) tutLayout(s);
  tut.raf = requestAnimationFrame(tutFrame);
}
function tutLayout(s) {
  const W = innerWidth, H = innerHeight, R = tutRect(s.at), pad = 6, [bt, bb, bl, br] = tut.el.querySelectorAll('.tt-b'), hole = tut.el.querySelector('.tt-hole');
  const set = (el, l, t, w, h) => { el.style.cssText = `left:${l}px;top:${t}px;width:${Math.max(0, w)}px;height:${Math.max(0, h)}px`; };
  let box = null;
  if (R) {
    const l = Math.max(0, R.l - pad), t = Math.max(0, R.t - pad), r = Math.min(W, R.r + pad), b = Math.min(H, R.b + pad);
    set(bt, 0, 0, W, t); set(bb, 0, b, W, H - b); set(bl, 0, t, l, b - t); set(br, r, t, W - r, b - t);
    set(hole, l, t, r - l, b - t); hole.hidden = false; box = { l, t, r, b };
  } else { set(bt, 0, 0, W, H); [bb, bl, br].forEach(x => set(x, 0, 0, 0, 0)); hole.hidden = true; }
  // 説明の 箱：明るい ところに かぶらない 場所へ（下 → 上 → 右 → 左 → まんなか）
  const tb = tut.el.querySelector('.tt-box'), bw = tb.offsetWidth, bh = tb.offsetHeight, m = 12;
  let x = (W - bw) / 2, y = (H - bh) / 2;
  if (box) {
    const cx = clamp((box.l + box.r) / 2 - bw / 2, m, W - bw - m), cy = clamp((box.t + box.b) / 2 - bh / 2, m, H - bh - m);
    if (box.b + m + bh < H - m) { x = cx; y = box.b + m; } else if (box.t - m - bh > m) { x = cx; y = box.t - m - bh; }
    else if (box.r + m + bw < W - m) { x = box.r + m; y = cy; } else if (box.l - m - bw > m) { x = box.l - m - bw; y = cy; }
    else { x = cx; y = H - bh - m; }
  }
  tb.style.left = x + 'px'; tb.style.top = y + 'px';
  // 指：おす ところ（hand が あれば そこ）
  let hv = typeof s.hand === 'function' ? s.hand() : s.hand; const side = hv && hv.side; if (side) hv = hv.el;
  const hand = tut.el.querySelector('.tt-hand'), HR = tutRect(hv || s.at);
  hand.hidden = !(s.wait && HR);
  if (!hand.hidden) {   // ふつうは 下から 👆、side:'left' は 左から 👉（行 ぜんたいを さす）
    hand.textContent = side ? '👉' : '👆'; hand.classList.toggle('side', !!side);
    hand.style.left = (side ? Math.max(4, HR.l - 44) : (HR.l + HR.r) / 2 - 14) + 'px'; hand.style.top = (side ? (HR.t + HR.b) / 2 - 20 : Math.min(H - 44, HR.b - 4)) + 'px';
  }
  const nb = tut.el.querySelector('#ttNext'); if (s.next) nb.disabled = !!(s.ready && !s.ready());
}
function tutFinish() {
  tutEnd(); sfx('clearBig');
  const c = modal(`<div class="jp-hero"><small>🎓 チュートリアル</small><b>クリア！ 準備 OK</b><span>これで 大臣の しごとが できます</span></div>`
    + `<div class="jp-tutsum"><span>🎯 上の チップ＝目標（タップで くわしく）</span><span>📖 キャラを タップ＝特徴カード</span><span>＋ − ・スライダーで わりあい（合計100%）</span><span>📊 右上の アイコン＝説明と ランキング</span><span>🗾 4つの日を タップ＝1日の グラフ</span><span>✅ 決定 → ①目標 ②4つの日 ③わりあい ④表を 判定 ⑤緑の ボタンで 進む</span></div>`
    + secretary(['つぎは ①はじめての ミッション。スライダーと ものさしを 体験しよう！'], 'happy')
    + `<div class="row2"><button class="btn" id="jpTM">モード選択へ</button><button class="btn go" id="jpT1">① はじめての ミッションへ ▶</button></div>`, 'menu');
  c.querySelector('#jpT1').onclick = () => { sfx('pick'); startMode('mission'); };
  c.querySelector('#jpTM').onclick = () => { sfx('tap'); showMenu(); };
}

/* ---------- 画面（スライダー・ものさし） ---------- */
function buildHUD() {
  const ch = chapter(), en = ch.enabled || KEYS;
  root.querySelector('#jpTtl').innerHTML = `${st.M.icon} <span>${ch.era}</span> ${ch.title}`;
  root.querySelector('#jpLeft').innerHTML = `<div class="jp-mixhead"><canvas id="jpDonut" width="120" height="120"></canvas><div><b>電源の わりあい</b><div class="jp-free" id="jpFree"></div></div></div>`
    + SRC.map(s => {
      const on = en.includes(s.k), lim = ch.lim[s.k], ref = ch.ref && (!ch.refHide || st.showRef) && ch.ref[s.k];
      return `<div class="jp-src ${on ? '' : 'off'}" data-k="${s.k}" style="--c:${COL(s.k)};--lim:${lim}%">
        <button class="ic" title="特徴カード"><img src="${EC.charaIcon(s.k, 'happy')}" alt=""><i>📖</i></button>
        <div class="mid"><b class="nm" title="特徴カード">${s.icon} ${s.name}<small>${s.sub}</small></b>
          <div class="trk">${ref ? `<i class="ref" style="left:${ref[0]}%;width:${Math.max(1.2, ref[1] - ref[0])}%" title="国の めあて"></i>` : ''}<input type="range" min="0" max="100" step="1" value="${mix[s.k]}" ${on ? '' : 'disabled'}></div>
          <small class="lim">${on ? `上限 ${lim}%` : 'このステージでは 使えない'}${ref ? `　<em>▮ ${ch.refName || '国の めあて'}</em>` : ''}</small></div>
        <div class="pct"><span>${mix[s.k]}</span>%</div>
        <div class="btns"><button class="pm" data-d="1" ${on ? '' : 'disabled'}>＋</button><button class="pm" data-d="-1" ${on ? '' : 'disabled'}>−</button></div></div>`;
    }).join('');
  root.querySelectorAll('.jp-src').forEach(row => {
    const k = row.dataset.k, inp = row.querySelector('input');
    inp.addEventListener('pointerdown', () => { dragFrom = metrics(norm(mix)); });
    inp.oninput = () => { if (run) { inp.value = mix[k]; return; } setV(k, +inp.value, row); };
    inp.onchange = () => { dragFrom = null; sfx('tap'); };
    row.querySelectorAll('.pm').forEach(b => b.onclick = () => { if (run) return; dragFrom = metrics(norm(mix)); setV(k, mix[k] + +b.dataset.d, row); sfx('tap'); setTimeout(() => { dragFrom = null; }, 900); });
    ['.ic', '.nm'].forEach(q => { row.querySelector(q).onclick = e => { e.stopPropagation(); sfx('tap'); showSource(k); }; });
  });
  const show = ch.show || ['co2', 'cost', 'stab'];
  root.querySelector('#jpRight').innerHTML = `<div class="jp-mets ${show.length >= 7 ? 'many' : ''}" id="jpMets">${show.map(mk => `<div class="jp-met" data-m="${mk}"><button class="q">${MET[mk].icon}</button><span class="nm">${MET[mk].name}</span><b class="val"></b><i class="dl"></i><div class="bar"><em></em><u></u></div></div>`).join('')}</div>
    <div class="jp-tip" id="jpTip"></div>
    <div class="jp-dayh"><b>🗾 4つの日で 停電しない？</b><small>👆 日を タップ → その日の 1日を 見る</small></div>
    <div class="jp-days">${Object.entries(DAYS).map(([k, d]) => `<button data-d="${k}" class="${DAYS[k] === day ? 'on' : ''}" title="${d.about}">${d.icon}<small>${d.name}</small><em></em></button>`).join('')}</div>
    <button class="jp-go" id="jpGo">${ch.goals.length ? '✅ この わりあいで 決定！' : '📜 宣言する'}</button>`;
  root.querySelectorAll('.jp-met .q').forEach(b => b.onclick = () => { sfx('tap'); metModal(b.parentNode.dataset.m); });
  root.querySelector('#jpGoals').onclick = e => {   // 目標の チップ → その ものさしの 説明と ランキング
    const sp = e.target.closest('span[data-i]'); if (!sp) return;
    const gl = chapter().goals[+sp.dataset.i]; sfx('tap');
    if (gl.m) metModal(gl.m); else if (gl.days) metModal('stab'); else if (gl.src) showSource(gl.src);
  };
  root.querySelectorAll('.jp-days button').forEach(b => b.onclick = () => { if (run || total(mix) !== 100) return; day = DAYS[b.dataset.d]; root.querySelectorAll('.jp-days button').forEach(x => x.classList.toggle('on', x === b)); startRun(); });
  root.querySelector('#jpGo').onclick = () => ch.goals.length ? decide() : declare();
  root.querySelector('#jpLegend').innerHTML = '<span>👤 キャラ1人＝5%</span><span>🌫️ けむり＝CO₂</span><span>🚢 タンカー＝輸入燃料</span><span>🖱️ ドラッグで 回す・ホイールで 近づく</span><button class="jp-cam" id="jpCam"></button>';
  const cb = root.querySelector('#jpCam'), camLbl = () => { cb.textContent = `🎥 自動カメラ：${R3 && R3.auto ? 'ON' : 'OFF'}`; cb.classList.toggle('off', !(R3 && R3.auto)); };
  camLbl(); cb.onclick = () => { if (!R3) return; R3.auto = !R3.auto; try { localStorage.setItem('ec.jp.cam', R3.auto ? '1' : '0'); } catch (e) {} sfx('tap'); camLbl(); };
}
// 1つの 電源だけを 変える（上限と「のこり」より 上には 行かない）
function setV(k, v, row) {
  const lim = chapter().lim[k], room = 100 - total(mix) + mix[k], nv = clamp(Math.round(v), 0, Math.min(lim, room));
  if (v > nv) { if (!st.flash) { row.classList.remove('bump'); void row.offsetWidth; row.classList.add('bump'); sfx('bad'); } st.flash = v > lim ? `${S_[k].icon} 上限は ${lim}%` : 'のこり 0%！ 先に ほかを へらそう'; clearTimeout(st.flashT); st.flashT = setTimeout(() => { st.flash = null; root && update(); }, 1600); }
  mix[k] = nv; update();
  if (R3) R3.focus = { k, t: performance.now() / 1000 };   // 🎥 その 電源の 発電所へ 寄る
}
function update(first) {
  const ch = chapter(), free = 100 - total(mix), r = metrics(norm(mix));
  const fe = root.querySelector('#jpFree');
  if (fe) { fe.className = 'jp-free ' + (st.flash ? 'warn' : free ? 'left' : 'ok'); fe.innerHTML = st.flash ? `⚠️ ${st.flash}` : free ? `のこり <b>${free}%</b><small>どこかに 入れよう</small>` : '✅ 合計 <b>100%</b>'; }
  paintDays();
  ['#jpRun', '#jpGo'].forEach(q => { const b = root.querySelector(q); if (b) { b.disabled = !!free; b.title = free ? `のこり ${free}% を 入れてね` : ''; } });
  root.querySelectorAll('.jp-src').forEach(row => { const k = row.dataset.k; row.querySelector('.pct span').textContent = mix[k]; const inp = row.querySelector('input'); if (document.activeElement !== inp || +inp.value !== mix[k]) inp.value = mix[k]; });
  // ものさし（目標の 線つき）
  root.querySelectorAll('.jp-met').forEach(el => {
    const mk = el.dataset.m, M = MET[mk], v = r[mk], gl = ch.goals.find(x => x.m === mk);
    el.querySelector('.val').textContent = M.fmt(v);
    el.querySelector('.bar em').style.width = clamp((v - M.lo) / (M.hi - M.lo) * 100, 0, 100) + '%';
    const u = el.querySelector('.bar u'); u.style.display = gl ? '' : 'none'; if (gl) u.style.left = clamp((gl.v - M.lo) / (M.hi - M.lo) * 100, 0, 100) + '%';
    el.classList.toggle('ok', !!gl && gOk(gl, r, mix)); el.classList.toggle('ng', !!gl && !gOk(gl, r, mix));
    const dl = el.querySelector('.dl');
    if (dragFrom) { const d = Math.round((v - dragFrom[mk]) * 10) / 10; const good = M.low ? d < 0 : d > 0; dl.textContent = d ? (d > 0 ? '▲' : '▼') + Math.abs(d) : ''; dl.className = 'dl ' + (d ? (good ? 'up' : 'dn') : ''); }
    else dl.textContent = '';
  });
  root.querySelector('#jpGoals').innerHTML = ch.goals.map((gl, i) => { const ok = !free && gOk(gl, r, mix); return `<span class="${ok ? 'ok' : ''} ${gl.m || gl.days || gl.src ? 'tap' : ''}" data-i="${i}" title="タップで くわしく">${ok ? '✅' : '⬜'} ${gText(gl)}</span>`; }).join('');
  root.querySelector('#jpTip').innerHTML = tip(r);
  drawDonut();
  if (R3) R3.dirty = true;
  if (!first && st.tries.length === 0 && !st.touched) st.touched = true;
}
function paintDays() {
  const full = total(mix) === 100, bd = full ? blackDays(mix) : [];
  root.querySelectorAll('.jp-days button').forEach(b => { const ng = bd.includes(DAYS[b.dataset.d]); b.disabled = !full; b.classList.toggle('ok', full && !ng); b.classList.toggle('ng', ng); b.querySelector('em').textContent = !full ? '' : ng ? '⚡' : '⭕'; });
}
function tip(r) {
  const ch = chapter(), bad = ch.goals.filter(gl => !gOk(gl, r, mix)), free = 100 - total(mix);
  if (free) return `💬 のこり <b>${free}%</b>。どの 電源に 入れる？ 合計 100%に なったら ためせるよ`;
  if (!ch.goals.length) return `💬 ${r.vre > 40 ? '☀️💨が 多い！ 晴れの昼は あまり、夜や 雨の 日は 足りなく なりやすい。' : ''}🗾 4つの日の ⭕⚡を 見よう。日を タップすると 1日の ようすが わかる`;
  if (!bad.length) return '💬 目標を ぜんぶ 満たしています！ ✅ 決定しよう';
  const gl = bad[0];
  if (gl.days) return `💬 ⚡ ${blackDays(mix).map(d => d.icon + d.name).join('・')}の日に 停電！ その日を タップして、<b>何時に 足りないか</b> 見てみよう`;
  if (gl.m === 'co2') return `💬 CO₂が 多め。🔥火力を へらして、${['nuclear', 'hydro', 'solar', 'wind', 'geo'].filter(k => (ch.enabled || KEYS).includes(k)).map(k => S_[k].icon).join('')}を ふやそう`;

  if (gl.m === 'cost') return r.integ > 0.5 ? `💬 ☀️💨が 多くて 統合コスト ＋${r.integ}円。少し へらすか、🔥♨️（高め）を へらそう` : '💬 コストが 高め。🔥（燃料代）や ♨️を へらし、☀️💧⚛️を ふやそう';
  if (gl.m === 'self') return '💬 国産率を 上げるには、輸入燃料の 🔥を へらす';
  if (gl.m === 'renew') return '💬 再エネ（💧☀️💨♨️）を ふやそう';
  if (gl.m === 'safe') return '💬 安全性が 低め。⚛️（事故・廃棄物）や 🔥を 少し へらそう';
  if (MORETIP[gl.m]) return '💬 ' + MORETIP[gl.m];
  if (gl.src || gl.sum) return `💬 ${gText(gl)} に しよう（いまは ${Math.round(gVal(gl, r, mix))}%）`;
  return '';
}
function drawDonut() {
  const cv = root.querySelector('#jpDonut'); if (!cv) return;
  const gx = cv.getContext('2d'); gx.clearRect(0, 0, 120, 120);
  let a0 = -Math.PI / 2;
  SRC.map(s => [COL(s.k), mix[s.k]]).concat([['#D5DCE5', 100 - total(mix)]]).forEach(([c, v]) => { const a = v / 100 * Math.PI * 2; if (a <= 0) return; gx.beginPath(); gx.moveTo(60, 60); gx.arc(60, 60, 56, a0, a0 + a); gx.closePath(); gx.fillStyle = c; gx.fill(); a0 += a; });
  gx.beginPath(); gx.arc(60, 60, 30, 0, Math.PI * 2); gx.fillStyle = '#fff'; gx.fill();
  const r = metrics(mix);
  gx.fillStyle = '#1E2A38'; gx.textAlign = 'center'; gx.font = '900 13px sans-serif'; gx.fillText('再エネ', 60, 55); gx.font = '900 17px sans-serif'; gx.fillText(r.renew + '%', 60, 74);
}
// 📖 電源カード：天気・時間で どう かわるか（4つの日と 夜）＋ 6つの 電源の 中での くらべ
const WX = {
  thermal: { d: ['◎', '◎', '◎', '◎', '◎'], how: '必要な ときに 上げ下げ できる「調整役」。でも 燃料を もやす' },
  nuclear: { d: ['◎', '◎', '◎', '◎', '◎'], how: '昼も 夜も 同じ 量。上げ下げは にがて' },
  hydro: { d: ['◎', '◎', '◎', '◎', '◎'], how: 'ほぼ 一定。ダムの 水で 少し 上げ下げ できる' },
  solar: { d: ['◎', '△', '◎', '◎', '✕'], how: '昼だけ。夕方から 弱く なり、夜は 0。雨の 日は 晴れの日の 約3割', alt: ['cloud', '雨'] },
  wind: { d: ['○', '○', '✕', '○', '○'], how: '風まかせ。夜も 回れるが、風が ないと 止まる。日本では 季節風の ふく 冬に 多く、夏（猛暑の 日）は 少し 弱め', alt: ['calm', '風なし'] },
  geo: { d: ['◎', '◎', '◎', '◎', '◎'], how: '天気に 関係なく 一定' }
};
const WXH = [['☀️', '晴れ'], ['🌧️', '雨'], ['🍃', '風なし'], ['🥵', '猛暑'], ['🌙', '夜']];
const LIMWHY = { thermal: '2024年度の 実際（67.5%）より ふやさない', nuclear: '国の めやすの いちばん 多い わりあい（2040年度：2割程度）', hydro: '国の めやす（2040年度：8〜10%）。ダムを つくれる 場所が もう 少ない', solar: '国の めやす（2040年度：23〜29%）。置ける 土地・屋根で 決まる', wind: '国の めやす（2040年度：4〜8%）。風の 強い 海や 山に 限られる', geo: '国の めやす（2040年度：地熱1〜2%＋バイオマス5〜6%）。温泉・国立公園と 場所が 重なる' };
// 1日の 出せる 量の 形（晴れ＝実線、弱い 日＝点線）
function shapeSVG(k) {
  const W = 260, H = 64, dem = demandShape(), dm = Math.max(...dem), y = v => (H - 14 - v * (H - 22)).toFixed(1);
  const f = { thermal: h => dem[Math.floor(h)] / dm * 0.85, nuclear: () => 0.8, hydro: () => 0.65, geo: () => 0.7, solar: h => solarAt(h), wind: h => windAt(h, DAYS.sunny) / 1.6 }[k];
  const f2 = { solar: h => solarAt(h) * DAYS.cloud.sun, wind: h => windAt(h, DAYS.calm) / 1.6 }[k];
  const pts = fn => [...Array(49)].map((_, i) => `${(i / 48 * W).toFixed(1)},${y(fn(Math.min(i / 2, 23.99)))}`).join(' ');
  return `<svg class="jp-shape" viewBox="0 0 ${W} ${H}"><rect width="${W * 6 / 24}" height="${H - 12}" fill="#26345E" opacity=".08"/><rect x="${W * 19 / 24}" width="${W * 5 / 24}" height="${H - 12}" fill="#26345E" opacity=".08"/>
    ${f2 ? `<polyline points="${pts(f2)}" fill="none" stroke="#8C98A8" stroke-width="2.5" stroke-dasharray="5 4"/>` : ''}<polyline points="${pts(f)}" fill="none" stroke="${COL(k)}" stroke-width="3.5" stroke-linejoin="round"/>
    ${[0, 6, 12, 18, 24].map(t => `<text x="${Math.max(8, Math.min(W - 10, t / 24 * W))}" y="${H - 1}" text-anchor="middle">${t}時</text>`).join('')}</svg>`;
}
function showSource(k) {
  const s = S_[k], L = F.lca, cost = F.cost2030;
  const fact = { thermal: `CO₂：石炭 ${L.coal}g・LNG ${L.lng}g・石油 ${L.oil}g（1kWh）／ 燃料の ほとんどを 輸入（原油の 中東依存度 約${F.oilMideast.v}%）`,
    nuclear: `CO₂：${L.nuclear}g ／ ${F.nuclearRestart.note} ／ 高レベル放射性廃棄物の 最終処分地は まだ 決まっていない`,
    hydro: `CO₂：${L.hydro}g（いちばん 少ない）／ 発電コスト ${cost.hydro}円`, solar: `CO₂：${L.solar}g ／ 2040年の コスト ${F.cost2040.solar}円（いちばん 安い）。でも 統合コストを 足すと ${F.cost2040.integSolar}円`,
    wind: `CO₂：${L.wind}g ／ 陸上 ${cost.wind}円・洋上 ${F.cost2040.windSea}円`, geo: `地熱 CO₂：${L.geo}g ／ 地熱資源量 ${F.geo.resource}。${F.geo.note}` }[k];
  const w = WX[k], i0 = KEYS.indexOf(k), lim = chapter().lim[k];
  // 6つの 電源の 中で いちばん よい＝緑・いちばん わるい＝赤
  const bar = (ic, nm, v, txt, low, all) => { const mx = Math.max(...all), mn = Math.min(...all), cl = v === (low ? mn : mx) ? 'lo' : v === (low ? mx : mn) ? 'hi' : '';
    return `<div class="sb"><span>${ic} ${nm}<small>${low ? '少ない ほど よい' : '多い ほど よい'}</small></span><p><i class="${cl}" style="width:${Math.max(4, v / mx * 100)}%"></i></p><b>${txt}</b></div>`; };
  const star = n => `${'★'.repeat(n)}<s>${'☆'.repeat(5 - n)}</s>`;
  const c = modal(`<div class="jp-srchead" style="--c:${COL(k)}"><img src="${EC.charaIcon(k, 'happy')}" alt=""><div><b>${s.icon} ${s.name}</b><small>${s.sub}</small></div><span class="jp-cno">${i0 + 1} / ${SRC.length}</span></div>
    <div class="jp-cols"><div>
      <div class="jp-gb"><p class="g">◎ ${s.good}</p><p class="b">△ ${s.bad}</p></div>
      <h5 class="jp-h5">🗾 天気と 時間で どう かわる？</h5>
      <div class="jp-wx">${WXH.map(([ic, nm], i) => `<span class="${w.d[i] === '✕' ? 'x' : w.d[i] === '△' ? 'm' : 'o'}"><i>${ic}</i><b>${w.d[i]}</b><small>${nm}</small></span>`).join('')}</div>
      ${shapeSVG(k)}<p class="jp-how1"><span class="ln" style="background:${COL(k)}"></span>晴れの 1日${w.alt ? `　<span class="ln dash"></span>${w.alt[1]}の 日` : ''}<br><b>${w.how}</b></p>
    </div><div>
      <h5 class="jp-h5">📊 6つの 電源と くらべると</h5>
      <div class="jp-sbars">${bar('🌏', 'CO₂', s.co2, `${s.co2}g`, true, SRC.map(x => x.co2))}${bar('💴', 'コスト', s.cost, `${s.cost}円`, true, SRC.map(x => x.cost))}${bar('📈', '設備利用率', s.capf, `${s.capf}%`, false, SRC.map(x => x.capf))}</div>
      <div class="jp-stars"><span>🛡️ 安全性 <b>${star(s.safe)}</b></span><span>♻️ 持続 <b>${star(s.sust)}</b></span><span>🗾 国産 <b>${s.dom ? '◯' : '✕ 輸入'}</b></span>
        ${(chapter().show || []).includes('init') ? `<span>🏗️ 初期費用の 安さ <b>${star(s.init)}</b></span><span>🔧 維持費の 安さ <b>${star(s.maint)}</b></span>` : ''}
        ${(chapter().show || []).includes('waste') ? `<span>🗑️ 廃棄物処理 <b>${star(s.waste)}</b></span><span>👥 社会的受容性 <b>${star(s.social)}</b></span><span>📈 設備利用率 <b>${s.capf}%</b></span>` : ''}</div>
      ${lim != null ? `<p class="jp-limw">📏 上限 <b>${lim}%</b>：${LIMWHY[k]}</p>` : ''}
      <p class="jp-fact">📚 ${fact}</p>
      <button class="btn small jp-real" data-real="${k}" data-mode="ref">📏 ほんとうの 発電所の 大きさ（写真）</button>
    </div></div>
    <div class="row2"><button class="btn" data-n="-1">◀ まえ</button><button class="btn go" id="jpOK">とじる</button><button class="btn" data-n="1">つぎ ▶</button></div>`, 'wide');
  c.querySelector('#jpOK').onclick = () => { sfx('tap'); hideModal(); };
  c.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { sfx('tap'); showSource(KEYS[(i0 + +b.dataset.n + KEYS.length) % KEYS.length]); });
}

/* ---------- 1日 ためす ---------- */
function startRun() {
  if (run || total(mix) !== 100) return;
  sfx('good');
  run = { r: simulate(mix, day), t: 0, warned: false };
  root.classList.add('playing');
  const b = root.querySelector('#jpBottom'); b.hidden = false;
  b.innerHTML = `<div class="jp-clock" id="jpClock">6:00</div><div class="jp-dabout">${day.icon} ${day.name}の日：${day.about}</div><canvas id="jpChart"></canvas><div class="st-state" id="jpState"></div>
    <div class="jp-cleg">${SRC.map(s => `<span><i style="background:${COL(s.k)}"></i>${s.icon}</span>`).join('')}<span><i style="background:${COL('battery')}"></i>🔋ためた 電気</span><span><i class="line"></i>使う 量</span><span><i style="background:${EC.BLACK}"></i>停電</span><span><i style="background:rgba(150,160,175,.7)"></i>すてた</span></div>
    <button class="btn" id="jpSkip">⏩</button>`;
  b.querySelector('#jpSkip').onclick = () => { if (run) run.t = 18; };
  // 3Dが 使えない 端末（R3 なし）でも 1日を すすめる（ふだんは 3Dの ループが tickRun を よぶ）
  if (!R3) { let last = performance.now(); const step = now => { if (!run || !root) return; tickRun(Math.min(0.1, (now - last) / 1000)); last = now; if (run) requestAnimationFrame(step); }; requestAnimationFrame(step); }
}
function tickRun(dt) {
  run.t = Math.min(18, run.t + dt * 2.2);
  const hour = 6 + run.t, h = Math.min(23, Math.floor(hour)), x = run.r.hours[h];
  R3 && (R3.hour = hour, R3.view = x);
  const ck = root.querySelector('#jpClock'); if (ck) ck.textContent = `${Math.floor(hour) % 24}:00`;
  drawChart(run.r, h + 1);
  const s = root.querySelector('#jpState'); if (s && s.dataset.h != h) { const [cl, tx] = hourWord(x); s.dataset.h = h; s.className = 'st-state ' + cl; s.textContent = `${h}時　${tx}`; }
  if (x.short > x.D * 0.02 && !run.warned) { run.warned = true; sfx('black'); }
  if (run.t >= 18) {
    const r = run.r; run = null; R3 && (R3.view = null, R3.hour = 13); lastR = r;
    root.classList.remove('playing');
    const curt = Math.round(r.curtE / r.served * 100);
    const msg = r.black.length ? `⚡ ${day.icon}${day.name}の日、${r.black[0]}時ごろ から 停電… ${r.black.some(hh => hh >= 18 || hh < 6) ? '夜も つくれる 電源が 足りない' : '調整できる 電源が 足りない'}`
      : curt >= 5 ? `✅ 停電なし！ でも 昼に 電気が ${curt}% あまって すてた（九州で 実際に おきている）` : `✅ ${day.icon}${day.name}の日も 停電なし！ ほかの 天気も ためしてみよう`;
    const s2 = root.querySelector('#jpState'); if (s2) { s2.className = 'st-state ' + (r.black.length ? 's-ng' : 's-ok'); s2.textContent = msg; }
    paintDays();
    const tp = root.querySelector('#jpTip'); if (tp && r.black.length && chapter().goals.every(gl => gl.days || gOk(gl, metrics(mix), mix))) tp.innerHTML = '💬 ものさしは 目標クリア。でも 1時間ごとに 見ると <b>停電</b>！ 安定性の 点数は 1年の 平均。<b>⚡ 4つの日 停電なし</b>も 目標だよ';
    sfx(r.black.length ? 'bad' : 'right');
  }
}
function drawChart(r, upto, cv0, mark) {
  const cv = cv0 || root.querySelector('#jpChart'); if (!cv) return;
  const rc = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); if (!rc.width) return;
  cv.width = rc.width * d; cv.height = rc.height * d;
  const gx = cv.getContext('2d'), w = rc.width, h = rc.height; gx.setTransform(d, 0, 0, d, 0, 0);
  let max = 1; r.hours.forEach(x => { max = Math.max(max, x.D, SRC.reduce((a, s) => a + x.g[s.k], 0) + x.g.store + x.curt); }); max *= 1.1;
  const bw = (w - 8) / 24, H = h - 14;
  gx.fillStyle = 'rgba(38,52,94,.08)'; gx.fillRect(4, 0, bw * 6, H); gx.fillRect(4 + bw * 19, 0, bw * 5, H);
  r.hours.forEach((x, i) => {
    if (i >= upto && i >= 6) return;
    let y = H;
    ['nuclear', 'geo', 'hydro', 'wind', 'solar', 'store', 'thermal'].forEach(k => { const v = x.g[k]; if (v <= 0) return; const hh = v / max * H; gx.fillStyle = COL(k === 'store' ? 'battery' : k); gx.fillRect(4 + i * bw + 0.5, y - hh, bw - 1, hh); y -= hh; });
    if (x.curt > 0.5) { const hh = x.curt / max * H; gx.fillStyle = 'rgba(150,160,175,.7)'; gx.fillRect(4 + i * bw + 0.5, y - hh, bw - 1, hh); }
    if (x.short > x.D * 0.02) { const hh = x.short / max * H; gx.fillStyle = EC.BLACK; gx.fillRect(4 + i * bw + 0.5, y - hh, bw - 1, hh); }
  });
  gx.strokeStyle = '#1E2A38'; gx.lineWidth = 2.5; gx.beginPath();
  r.hours.forEach((x, i) => { const y = H - x.D / max * H; if (!i) gx.moveTo(4, y); else gx.lineTo(4 + i * bw, y); gx.lineTo(4 + (i + 1) * bw, y); });
  gx.stroke();
  gx.font = '900 10px sans-serif'; gx.fillStyle = '#5B6B7E'; gx.textAlign = 'center';
  [0, 6, 12, 18, 24].forEach(t => gx.fillText(t + '時', Math.max(10, Math.min(w - 12, 4 + t * bw)), h - 2));
  if (mark) { gx.strokeStyle = '#FF7A00'; gx.lineWidth = 2.5; r.black.forEach(hh => gx.strokeRect(4 + hh * bw + 1, 1, bw - 2, H - 1)); }
}

/* ---------- 決定 → 結果 ---------- */
function decide() {
  if (run || total(mix) !== 100) return;
  const ch = chapter(), r = metrics(mix), oks = ch.goals.map(gl => gOk(gl, r, mix)), all = oks.every(Boolean);
  const nOk = oks.filter(Boolean).length, near = all && ch.goals.every(gl => gNear(gl, r, mix));
  const days = Object.values(DAYS).map(d => ({ d, b: simulate(mix, d).black.length })), black = days.filter(x => x.b);
  const rank = all ? (near && !black.length ? 'S' : 'A') : nOk >= Math.ceil(ch.goals.length / 2) ? 'B' : 'C';
  st.tries.push({ mix: Object.assign({}, mix), r, rank });
  EC.Log && EC.Log.add({ t: 'jp', mode: st.M.name, ch: `${ch.era} ${ch.title}`, mix: Object.assign({}, mix), r: { co2: r.co2, cost: r.cost, stab: r.stab, self: r.self, safe: r.safe }, rank, ok: all, black: black.length });
  if (all) { const sv = store().cleared || {}; sv[st.mode] = Math.max(sv[st.mode] || 0, st.ci + 1); storeSet({ cleared: sv }); }
  if (R3) { R3.party = all ? 3 : 0; }
  const onlyDays = !all && ch.goals.every((gl, i) => gl.days || oks[i]);
  const sub = all ? (rank === 'S' ? '目標を よゆうで 達成！' : black.length ? `目標は 達成！ でも ${black.map(x => x.d.icon).join('')} の日に 停電…` : '目標を ぜんぶ 達成！')
    : onlyDays ? `ものさしは 合格。でも ${black.map(x => x.d.icon).join('')} の日に 停電…` : `目標 ${nOk}/${ch.goals.length} 達成`;
  cutIn('drum', {}, () => cutIn(all ? 'clear' : 'fail', { big: all ? (rank === 'S' ? 'Sランク！' : 'クリア！') : 'あと すこし…', sub }, () => result(ch, r, oks, rank, days)));
}
// 100%の 帯（きみ・2024年・国の めあてを 同じ 形で ならべる）
const segOf = m => SRC.map(x => [COL(x.k), m[x.k], x.icon]);
const sbar = (label, segs) => `<div class="jp-sb"><span>${label}</span><div>${segs.map(([c, v, ic]) => v > 0 ? `<i style="width:${v}%;background:${c}">${v >= 8 ? `${ic}${Math.round(v)}` : ''}</i>` : '').join('')}</div></div>`;
const REFBAR = { r2: ['2030年 国の めあて', segOf({ thermal: 41, nuclear: 21, hydro: 11, solar: 15, wind: 5, geo: 6 })], r3: ['2040年 国の めやす', [[COL('thermal'), 35, '🔥'], [COL('nuclear'), 20, '⚛️'], ['#4CC38A', 45, '🌱再エネ']]] };
function result(ch, r, oks, rank, days) {
  const all = oks.every(Boolean), last = st.ci >= st.M.chapters.length - 1;
  const black = days.filter(x => x.b), nOk = oks.filter(Boolean).length;
  const hints = ch.goals.filter((gl, i) => !oks[i] && !gl.days).map(gl => tipFor(gl, r));
  const onlyDays = !all && black.length && ch.goals.every((gl, i) => gl.days || oks[i]), ask = black.length && !ch.noS && !st.whyAsked;
  const show = (ch.show || []).length >= 7 ? Array.from(new Set(['co2', 'cost', 'stab'].concat(ch.goals.filter(gl => gl.m).map(gl => gl.m))))
    : Array.from(new Set((ch.show || []).concat(['co2', 'cost', 'stab', 'self'])));
  const b0 = metrics(BASE), pc = (mk, v) => clamp((v - MET[mk].lo) / (MET[mk].hi - MET[mk].lo) * 100, 0, 100);
  const c = modal(`<div class="jp-rank r${rank}"><i>${rank}</i><div><b>${all ? '🎉 目標 達成！' : '😣 目標まで あと すこし'}</b><small>${st.M.icon} ${ch.era}「${ch.title}」</small></div></div>
    <div class="jp-cols"><div>
      <p class="jp-flow">👀 見る 順番：<b>①</b>目標 → <b>②</b>4つの日 → <b>③</b>わりあい → <b>④</b>表を 判定して「たしかめる」 → <b>⑤</b>いちばん 下の 緑の ボタンで 進む</p>
      <div class="jp-verdict"><div class="${all ? 'ok' : 'ng'}"><i>🎯</i><span>ものさしの 目標</span><b>${nOk}/${ch.goals.length}</b></div><div class="${black.length ? 'ng' : 'ok'}"><i>🗾</i><span>日本の 1日（4つの 日）</span><b>${black.length ? `⚡ ${black.length}日 停電` : '⭕ 停電なし'}</b></div></div>
      <p class="jp-srule">🏅 <b>S</b> ＝ 目標を よゆうで 達成　<b>A</b> ＝ 目標を 達成${ch.goals.includes(DAYGOAL) ? '　<span>（⚡ 4つの日 停電なしも 目標）</span>' : ''}</p>
      ${black.length && ch.noS ? `<div class="jp-gap find">${ch.noS}</div>` : ''}
      ${onlyDays ? '<div class="jp-gap">🤔 ものさしは 合格。でも 1時間ごとに 見ると <b>停電</b>！ わりあいは <b>1年の 平均</b>。☀️の ない 夜や 雨の 日は、<b>すぐ 出せる 電源</b>と <b>ためた 電気</b>が 足りるかで 決まる。</div>' : ''}
      <h4><em class="jp-n">①</em>🎯 目標</h4><div class="jp-gt">${ch.goals.map((gl, i) => `<div class="${oks[i] ? 'ok' : 'ng'}"><i>${oks[i] ? '✅' : '❌'}</i><span>${gText(gl)}</span><b>${gl.days ? `${4 - black.length}/4日` : gl.m ? MET[gl.m].fmt(r[gl.m]) : Math.round(gVal(gl, r, mix)) + '%'}</b>${gl.m && gl.min == null ? `<p class="g"><em style="width:${pc(gl.m, r[gl.m])}%"></em><u style="left:${pc(gl.m, gl.v)}%"></u></p>` : ''}</div>`).join('')}</div>
      <h4><em class="jp-n">③</em>🧩 わりあいを くらべる</h4>
      <div class="jp-sbs">${sbar('きみ', segOf(mix))}${all || !ch.refHide ? sbar('2024年', segOf(BASE)) : ''}${REFBAR[ch.id] ? sbar(...REFBAR[ch.id]) : ''}</div>
      <h4><em class="jp-n">④</em>📊 2024年の 日本と くらべて</h4>
      <div class="jp-rq" id="jpRQ"><b>👆 2024年と くらべて、1つずつ <span class="up">よく なった</span>？ <span class="dn">わるく なった</span>？<small>⬇⬆の「よい 向き」に 注意</small></b><button class="btn small go" id="jpRQgo" disabled></button></div>
      <div class="jp-c2 ask">${show.map(mk => { const M = MET[mk], b = b0[mk], v = r[mk], better = M.low ? v < b : v > b, cl = v === b ? 'eq' : better ? 'up' : 'dn';
        return `<div data-mk="${mk}" data-cl="${cl}"><span>${M.icon} ${M.name}<small>${M.low ? '⬇ 少ない ほど よい' : '⬆ 多い ほど よい'}</small></span><p><i class="b0" style="width:${pc(mk, b)}%"></i><small>2024 ${M.fmt(b)}</small></p><p><i class="b1" style="width:${pc(mk, v)}%"></i><small>きみ <b>${M.fmt(v)}</b></small></p><em class="ch" data-t="${v === b ? 'おなじ' : better ? 'よく なった' : 'わるく なった'}"><button data-v="up">よく</button><button data-v="eq">おなじ</button><button data-v="dn">わるく</button></em></div>`; }).join('')}</div>
    </div><div>
      <h4><em class="jp-n">②</em>🗾 日本の 1日で ためすと</h4><div class="jp-days4">${days.map(x => `<div class="${x.b ? 'ng' : 'ok'}"><i>${x.d.icon}</i><b>${x.b ? '⚡' : '⭕'}</b><span>${x.d.name}${x.b ? `<br>停電 ${x.b}時間` : ''}</span></div>`).join('')}</div>
      ${black.length ? '<div class="jp-why" id="jpWhy"></div>' : ''}
      ${hints.length ? `<div class="jp-hint"><b>💡 ヒント</b>${hints.map(h => `<p>${h}</p>`).join('')}${st.tries.length >= 2 ? `<p class="more">📖 ${ch.hint}</p>${ch.refHide ? '<p class="more">▮ スライダーに 答えの 帯を 出したよ</p>' : ''}` : ''}</div>` : ''}
      ${all && ch.learn ? `<div class="jp-learn">📚 ${ch.learn()}</div>` : ''}
    </div></div>
    <div class="row2">${all ? `<button class="btn" id="jpAgain">🔄 もう一度 ちょうせん</button><button class="btn go" id="jpNext">${st.mode === 'tut' ? '🎓 チュートリアル おわり ▶' : st.mode === 'p4' ? '🗣️ 国民の 声へ' : last ? '📜 宣言へ' : '▶ つぎの チャプターへ'}</button>` : `<button class="btn go" id="jpAgain">🔄 わりあいを 見なおす</button>`}</div>`, 'wide');
  c.querySelector('#jpAgain').onclick = () => { sfx('tap'); hideModal(); if (!all && ch.refHide && st.tries.length >= 2 && !st.showRef) { st.showRef = true; buildHUD(); update(); } };
  if (black.length) dayWhy(c, ch, black, ask);
  const nx = c.querySelector('#jpNext');
  readCheck(c, show, nx, r, ch);
  if (nx) nx.onclick = () => { if (st.mode === 'tut') return tutFinish(); sfx('tap'); st.results.push({ ch, mix: Object.assign({}, mix), r, rank }); quiz(ch, () => { if (st.mode === 'p4') voices(r); else if (last) declare(); else { st.ci++; startChapter(); } }); };
}
/* ⚡ 停電した 日：その日の グラフを 見て「どうすれば 停電しない？」を 考える
   （スライダーを 動かして ⭕に する だけで 終わらせない。チャプターで はじめて 停電した ときは 答えるまで もどれない） */
function dayWhy(c, ch, black, gate) {
  const box = c.querySelector('#jpWhy'), d = black[0].d, sr = simulate(mix, d), when = rangesH(sr.black), night = sr.black.some(h => h >= 18 || h < 6);
  const why = d === DAYS.heat ? '猛暑の 夕方は 使う 量が ふえるのに、☀️は 弱く なる' : d === DAYS.calm ? '風が ない 日は 💨が ほとんど 回らない' : d === DAYS.cloud ? '雨の 日は ☀️が 晴れの日の 約3割で、夜は 0' : '晴れの 日でも 夜は ☀️が 0';
  const opts = [{ t: '🔥⚛️💧♨️ 天気に 左右されない 電源を ふやす', ok: true },
    { t: '☀️ 太陽光だけを もっと ふやす', fb: night ? `停電は ${when}。☀️は 夜 0。ふやすと 昼に ためる 電気は ふえるけど、ためられる 量には 限りが ある` : `${d.name}の日は ☀️が 弱い。ふやしても 足りない 時間が のこる` },
    d === DAYS.calm ? { t: '💨 風力を もっと ふやす', fb: '風が ない 日は、風車が 何本 あっても 回らない' } : { t: '🔥 火力を もっと へらす', fb: `${when}に すぐ 出せる 電源が もっと へって、もっと 足りなく なる` }];
  const order = [[1, 0, 2], [2, 1, 0], [0, 2, 1]][st.tries.length % 3].map(i => opts[i]);
  box.innerHTML = `<h4>⚡ ${d.icon}${d.name}の日、<b>${when}</b>に 停電</h4><p class="jp-dabout">${d.about}</p><canvas class="jp-whyc"></canvas>
    <div class="jp-cleg"><span><i style="background:${EC.BLACK}"></i>停電</span><span><i class="line"></i>使う 量</span><span><i style="background:${COL('battery')}"></i>🔋ためた 電気</span><span><i style="background:${COL('thermal')}"></i>🔥</span><span><i style="background:${COL('solar')}"></i>☀️</span></div>`
    + (ch.noS ? '' : `<p class="jp-wq">👉 どうすれば 停電しない？</p><div class="jp-wo">${order.map((o, i) => `<button class="btn" data-i="${i}">${o.t}</button>`).join('')}</div><div class="jp-wfb"></div>`);
  requestAnimationFrame(() => drawChart(sr, 24, box.querySelector('canvas'), true));
  if (ch.noS) return;
  const again = c.querySelector('#jpAgain'), label = again.innerHTML, fb = box.querySelector('.jp-wfb');
  if (gate) { again.disabled = true; again.innerHTML = '👆 先に「どうすれば 停電しない？」に 答えよう'; }
  let miss = 0;
  box.querySelectorAll('.jp-wo button').forEach(b => b.onclick = () => {
    const o = order[+b.dataset.i];
    if (!o.ok) { miss++; sfx('bad'); fb.className = 'jp-wfb ng'; fb.innerHTML = '🤔 ' + o.fb; return; }
    sfx('right'); b.classList.add('go'); box.querySelectorAll('.jp-wo button').forEach(x => { x.disabled = true; });
    fb.className = 'jp-wfb ok'; fb.innerHTML = `⭕ そう！ ${why}。そんな ときは <b>天気に 左右されない 電源</b>が ささえる。<br>⚖️ だから いろいろな 電源を <b>組み合わせる（ミックス）</b>。でも 🔥は CO₂、⚛️は 安全、♨️は コスト… どれを ふやすかは きみ しだい！`;
    EC.Log && EC.Log.add({ t: 'read', where: 'jpday', ok: !miss });
    st.whyAsked = true; again.disabled = false; again.innerHTML = label;
  });
}
// 📊 表を 読む：ものさしを 1つずつ「よく／おなじ／わるく」と 自分で 判定してから 答えを 見る（読まずに 進めない・答えを 先に 見せない）
function readCheck(c, show, nx, r, ch) {
  const box = c.querySelector('#jpRQ'), go = box.querySelector('#jpRQgo'), rows = [...c.querySelectorAll('.jp-c2 [data-mk]')], ans = {};
  const M = mk => MET[mk].name, worse = rows.filter(x => x.dataset.cl === 'dn').map(x => x.dataset.mk), better = rows.filter(x => x.dataset.cl === 'up').map(x => x.dataset.mk);
  const label = nx ? nx.innerHTML : '';
  if (nx) { nx.disabled = true; nx.innerHTML = '👆 先に 📊の 表を たしかめよう'; }
  const left = () => rows.length - Object.keys(ans).length;
  const paint = () => { go.disabled = left() > 0; go.textContent = left() ? `👆 あと ${left()}つ えらんでね` : '✅ たしかめる'; };
  rows.forEach(x => x.querySelectorAll('.ch button').forEach(bt => bt.onclick = () => {
    ans[x.dataset.mk] = bt.dataset.v; x.querySelectorAll('.ch button').forEach(o => o.classList.toggle('on', o === bt)); sfx('tap'); paint(); }));
  paint();
  go.onclick = () => {
    if (left()) return;
    const miss = rows.filter(x => ans[x.dataset.mk] !== x.dataset.cl), ok = !miss.length;
    sfx(ok ? 'right' : 'bad'); EC.Log && EC.Log.add({ t: 'read', where: 'jp', ok });
    rows.forEach(x => { const cl = x.dataset.cl, em = x.querySelector('em'), hit = ans[x.dataset.mk] === cl, k = cl === 'eq' ? '' : cl;
      x.querySelector('.b1').className = 'b1 ' + k; em.className = k; em.textContent = `${hit ? '⭕' : '❌'} ${em.dataset.t}`; if (!hit) x.classList.add('miss'); });
    // わるく なった ものは「どれだけ」「目標は 守れているか」を そのまま 伝える（あきらめた とは 決めつけない）
    const b0 = metrics(BASE), down = mk => { const X = MET[mk], b = b0[mk], v = r[mk], gl = ch.goals.find(x => x.m === mk);
      const how = Math.abs(v - b) / (X.hi - X.lo) < 0.05 ? '少し ' : '', verb = X.low ? (mk === 'co2' ? 'ふえた' : '高く なった') : '下がった';
      return `<b class="dn">${X.name}</b>は ${how}${verb}（${X.fmt(b)} → ${X.fmt(v)}）。${gl ? (gOk(gl, r, mix) ? `でも 目標の「${gText(gl)}」は 守れている。` : `目標の「${gText(gl)}」に とどいていない。`) : ''}`; };
    const give = worse.length ? `${better.length ? `${better.map(M).join('・')}が よく なった。そのかわり、` : ''}${worse.map(t => `<span class="dl">・${down(t)}</span>`).join('')}⚖️ 1つを よく すると、ほかが 下がる ことが ある。<b>どこまでなら 下がっても よいか</b>を 考えて 決めよう。`
      : 'どれも 2024年より よく なった！ でも ⚡停電の 日や、表に ない もの（土地・材料・反対の 声）は どうかな？';
    box.className = 'jp-rq ' + (ok ? 'ok' : 'ng');
    box.innerHTML = `<b>${ok ? '⭕ ぜんぶ 正解！' : `🤔 ${miss.length}つ ちがった（❌の 行）。⬇⬆の「よい 向き」を 見なおそう`}</b><p>${give}</p>`;
    if (nx) { nx.disabled = false; nx.innerHTML = label; }
  };
}
// アドバンス・博士モードの ものさしの ヒント（★は 本家の 1〜5）
const MORETIP = {
  sust: '持続可能性が 低め。いつか なくなる 燃料の 🔥（★1）を へらし、💧☀️💨♨️（★5）を ふやそう',
  init: '初期費用が 高め。☀️（★4）💨（★3）は 安い。⚛️（★1）🔥💧♨️（★2）は 高い',
  maint: '維持費が 高め。燃料を 買い続ける 🔥（★2）を へらし、💧☀️（★5）を ふやそう',
  waste: '廃棄物処理が 心配。⚛️（★1）🔥（★2）を へらし、💧♨️（★5）💨（★4）を ふやそう',
  capf: '設備利用率が 低い。☀️（約18%）💨（約30%）が 多いと 下がる。♨️（約83%）⚛️🔥（約70%）は 高い',
  social: '社会的受容性が 低め。⚛️（★1）♨️（★2）を へらし、☀️💧（★4）を ふやそう'
};
function tipFor(gl, r) {
  if (MORETIP[gl.m]) return `${MET[gl.m].name} ${MET[gl.m].fmt(r[gl.m])}。` + MORETIP[gl.m].replace(/^[^。]+。/, '');
  if (gl.m === 'co2') return `CO₂が ${r.co2}%。🔥火力（${S_.thermal.co2}g）を へらせば 大きく へる。`;
  if (gl.m === 'cost') return `発電コスト ${r.cost}円。🔥24.1円が いちばん 高い。☀️10.9円・⚛️12.6円・💧13.0円は 安め、💨16.3円・♨️16.5円は その あいだ。`;
  if (gl.m === 'self') return `国産率 ${r.self}%。🔥火力の 燃料は ほぼ 輸入。🔥を へらすと 上がる。`;
  if (gl.m === 'renew') return `再エネ ${r.renew}%。💧☀️💨♨️を ふやそう。`;
  if (gl.m === 'safe') return `安全性 ${r.safe}。⚛️（★2）を へらし、☀️（★5）💧💨♨️（★4）を ふやすと 上がる。`;
  return `${gText(gl)}（いまは ${Math.round(gVal(gl, r, mix))}%）`;
}
function quiz(ch, then) {
  const pool = EC.QUIZ.filter(q => (ch.quiz || []).includes(q.tag) && !st.asked.has(q.q));
  if (!pool.length) return then();
  const q = pool[0]; st.asked.add(q.q);
  const c = modal(`<div class="jp-qhead">🧠 大臣クイズ</div><h3 class="jp-q">${q.q}</h3><div class="jp-qa">${q.a.map((a, i) => `<button class="btn" data-i="${i}">${a}</button>`).join('')}</div><div id="jpQfb"></div>`);
  c.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
    const ok = +b.dataset.i === q.ok; sfx(ok ? 'right' : 'bad'); EC.Log && EC.Log.add({ t: 'quiz', q: q.q, ok });
    c.querySelectorAll('[data-i]').forEach(x => { x.disabled = true; if (+x.dataset.i === q.ok) x.classList.add('go'); });
    c.querySelector('#jpQfb').innerHTML = `<div class="jp-qfb ${ok ? 'ok' : 'ng'}"><b>${ok ? '⭕ 正解！' : '❌ ざんねん'}</b><p>${q.why}</p><small>出典：${q.src}</small></div><button class="btn go" id="jpQn">つぎへ ▶</button>`;
    c.querySelector('#jpQn').onclick = then;
  });
}

/* ---------- 宣言 ---------- */
const PRI = [['env', '🌏', '環境（CO₂を へらす）'], ['stab', '🔌', '安定（停電させない）'], ['econ', '💴', '経済（安い 電気）'], ['safe', '🛡️', '安全（事故・災害に 強い）'], ['self', '🗾', '自給（輸入に たよらない）']];
function declare() {
  st.screen = 'decl';
  const pri = [];
  const c = modal(`<div class="jp-chhead"><small>📜 さいごの しごと</small><b>わたしの エネルギーミックス宣言</b></div>`
    + secretary(['大臣、おつかれさまでした！ さいごに、きみの 考えを 宣言に しましょう。', '正解は ひとつでは ありません。理由が 言えれば それが きみの 答えです。'], 'happy')
    + `<h4>① 大事に したい 順に タップ（上位3つ）</h4><div class="jp-pri">${PRI.map(([k, ic, nm]) => `<button data-k="${k}"><i>${ic}</i>${nm}<b></b></button>`).join('')}</div>
    <h4>② きみの 考えを 書こう</h4>
    <label class="jp-ta"><span>いちばん たよる 電源と、その 理由</span><textarea id="jpT1" rows="2" placeholder="例：☀️太陽光。燃料が いらず CO₂が 少ないから。"></textarea></label>
    <label class="jp-ta"><span>その 電源の 弱点を どう おぎなう？</span><textarea id="jpT2" rows="2" placeholder="例：夜は 蓄電池と 水力、くもりの 日は 火力を 少し 残して ささえる。"></textarea></label>
    <label class="jp-ta"><span>わたしの くらしで できること</span><textarea id="jpT3" rows="2" placeholder="例：夕方の 電気を 使う 時間を ずらす。"></textarea></label>
    <div class="row2"><button class="btn" id="jpDB">◀ もどる</button><button class="btn go" id="jpDG">📜 宣言書を つくる</button></div>`, 'wide');
  c.querySelectorAll('.jp-pri button').forEach(b => b.onclick = () => {
    const k = b.dataset.k, i = pri.indexOf(k);
    if (i >= 0) pri.splice(i, 1); else if (pri.length < 3) pri.push(k);
    c.querySelectorAll('.jp-pri button').forEach(x => { const j = pri.indexOf(x.dataset.k); x.classList.toggle('on', j >= 0); x.querySelector('b').textContent = j >= 0 ? j + 1 : ''; });
    sfx('tap');
  });
  c.querySelector('#jpDB').onclick = () => { hideModal(); st.screen = 'play'; };
  c.querySelector('#jpDG').onclick = () => {
    const t = ['#jpT1', '#jpT2', '#jpT3'].map(s => c.querySelector(s).value.trim());
    if (pri.length < 3 || !t[0]) { c.querySelector('.jp-pri').classList.add('shake'); setTimeout(() => c.querySelector('.jp-pri') && c.querySelector('.jp-pri').classList.remove('shake'), 400); sfx('bad'); return; }
    certificate(pri, t);
  };
}
function certificate(pri, t) {
  const r = metrics(mix), W = 1200, H = 820, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const gx = cv.getContext('2d');
  const grd = gx.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#FFF9E8'); grd.addColorStop(1, '#EAF4FF'); gx.fillStyle = grd; gx.fillRect(0, 0, W, H);
  gx.strokeStyle = '#C9A227'; gx.lineWidth = 10; gx.strokeRect(24, 24, W - 48, H - 48); gx.lineWidth = 2; gx.strokeRect(40, 40, W - 80, H - 80);
  gx.fillStyle = '#1E2A38'; gx.textAlign = 'center'; gx.font = '900 46px sans-serif'; gx.fillText('わたしの エネルギーミックス宣言', W / 2, 110);
  const dt = new Date(); gx.font = '700 20px sans-serif'; gx.fillStyle = '#5B6B7E';
  gx.fillText(`${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日　${st.M ? st.M.name : ''}`, W / 2, 145);
  // ドーナツ
  let a0 = -Math.PI / 2; const cx = 230, cy = 340;
  SRC.forEach(s => { const a = mix[s.k] / 100 * Math.PI * 2; if (a <= 0) return; gx.beginPath(); gx.moveTo(cx, cy); gx.arc(cx, cy, 150, a0, a0 + a); gx.closePath(); gx.fillStyle = COL(s.k); gx.fill(); a0 += a; });
  gx.beginPath(); gx.arc(cx, cy, 78, 0, Math.PI * 2); gx.fillStyle = '#fff'; gx.fill();
  gx.fillStyle = '#1E2A38'; gx.font = '900 22px sans-serif'; gx.fillText('再エネ', cx, cy - 6); gx.font = '900 34px sans-serif'; gx.fillText(r.renew + '%', cx, cy + 32);
  gx.textAlign = 'left'; gx.font = '800 21px sans-serif';
  SRC.forEach((s, i) => { const x = 80 + (i % 2) * 165, y = 530 + Math.floor(i / 2) * 34; gx.fillStyle = COL(s.k); gx.fillRect(x, y - 17, 20, 20); gx.fillStyle = '#1E2A38'; gx.fillText(`${s.name} ${mix[s.k]}%`, x + 28, y); });
  // ものさし
  const ms = ['co2', 'cost', 'stab', 'self', 'safe'];
  gx.font = '900 22px sans-serif'; gx.fillStyle = '#1E2A38'; gx.fillText('ものさし', 430, 200);
  ms.forEach((mk, i) => { gx.font = '800 21px sans-serif'; gx.fillStyle = '#3D4C5E'; gx.fillText(`${MET[mk].name}：${MET[mk].fmt(r[mk])}`, 430, 236 + i * 32); });
  // 優先
  gx.font = '900 22px sans-serif'; gx.fillStyle = '#1E2A38'; gx.fillText('大切に する 順', 760, 200);
  pri.forEach((k, i) => { const p = PRI.find(x => x[0] === k); gx.font = '800 22px sans-serif'; gx.fillStyle = '#7B5CC4'; gx.fillText(`${i + 1}位　${p[2]}`, 760, 238 + i * 36); });
  // 文
  const wrap = (text, x, y, mw, lh) => { let line = '', yy = y; for (const ch of text) { if (gx.measureText(line + ch).width > mw) { gx.fillText(line, x, yy); line = ch; yy += lh; } else line += ch; } if (line) gx.fillText(line, x, yy); return yy + lh; };
  let y = 420; const lbl = ['いちばん たよる 電源と 理由', '弱点の おぎない方', 'くらしで できること'];
  t.forEach((tx, i) => { if (!tx) return; gx.font = '900 19px sans-serif'; gx.fillStyle = '#0FB5AA'; gx.fillText('■ ' + lbl[i], 430, y); gx.font = '700 21px sans-serif'; gx.fillStyle = '#1E2A38'; y = wrap(tx, 450, y + 32, 690, 30) + 8; });
  gx.font = '700 15px sans-serif'; gx.fillStyle = '#8A97A8'; gx.textAlign = 'center';
  gx.fillText('数値は 公的データを もとに した ゲーム用の めやす（エネルギーシティ・日本エネルギーミックス大作戦3D）', W / 2, H - 58);
  const url = cv.toDataURL('image/png');
  const list = (store().decl || []).slice(-9); list.push({ date: dt.toISOString(), mix: Object.assign({}, mix), pri, t }); storeSet({ decl: list });
  EC.Log && EC.Log.add({ t: 'decl', mix: Object.assign({}, mix), pri, texts: t });
  sfx('ending');
  const c = modal(`<h3>📜 宣言書が できました！</h3><img class="jp-cert" src="${url}" alt="宣言書">
    <p class="jp-def">画像を 保存して、友だちの 宣言と くらべてみよう。どこが 同じで、どこが ちがう？ なぜ？</p>
    <div class="row2"><a class="btn" id="jpDL" download="energy-mix-declaration.png" href="${url}">💾 画像を 保存</a><button class="btn" id="jpRep">📝 学習レポート（PDF）</button><button class="btn go" id="jpFin">${opts.onDone ? '▶ つぎへ' : '🏠 モード選択へ'}</button></div>`, 'wide');
  c.querySelector('#jpRep').onclick = () => { sfx('tap'); EC.Report && EC.Report.open(); };
  const fin = () => { if (opts.onDone) { const f = opts.onDone; opts.onDone = null; f({ mix: Object.assign({}, mix), pri, t }); close(); } else showMenu(); };
  c.querySelector('#jpFin').onclick = () => { sfx('tap'); EC.Talk ? EC.Talk.show(root, st.mode === 'p4'
    ? { key: 'p4', me: `📜 ${pri.map(k => PRI.find(x => x[0] === k)[1]).join('')}`, card: declCard(pri, t), q: '<b>ちがう 声</b>を えらんだ 人と くらべよう。<br>だれの 心配に、<b>どう 説明</b>した？ 国の めやすと いちばん ちがったのは どこ？ それは なぜ？' }
    : { key: 'jp', me: `📜 ${pri.map(k => PRI.find(x => x[0] === k)[1]).join('')}`, card: declCard(pri, t), q: '友だちの 宣言と くらべよう。<br><b>1位</b>は 同じ？ ちがうなら <b>なぜ</b>？ 宣言の わりあいは どう ちがう？' }, fin) : fin(); };
}

// 🪪 話し合いで 見せる 宣言の カード：わりあい・大事な 順・3つの 考え・ものさし
function declCard(pri, t) {
  const r = metrics(mix), esc = EC.Talk.esc, row = (h, body) => `<div class="tc-row"><span class="tc-h">${h}</span><div>${body}</div></div>`;
  return `<div class="tc-end">📜 <b>わたしの エネルギーミックス宣言</b></div>
    <div class="tc-mix">${SRC.map(s => mix[s.k] > 0 ? `<i style="width:${mix[s.k]}%;background:${COL(s.k)}">${mix[s.k] >= 9 ? s.icon + mix[s.k] : ''}</i>` : '').join('')}</div>
    <div class="tc-mixv">${SRC.map(s => `<span>${s.icon}${s.name} <b>${mix[s.k]}%</b></span>`).join('')}</div>`
    + row('🥇 大事な 順', pri.map((k, i) => { const x = PRI.find(p => p[0] === k); return `<em>${i + 1}位 ${x[1]} ${x[2]}</em>`; }).join(''))
    + (st.mode === 'p4' && opts.pri ? row('📣 公約', opts.pri.map(k => `<em>${priName(k)}</em>`).join('')) : '')
    + ['いちばん たよる 電源と 理由', '弱点の おぎない方', 'くらしで できること'].map((h, i) => t[i] ? row(['🔑', '🩹', '🏠'][i] + ' ' + h, `<p class="tc-t">${esc(t[i])}</p>`) : '').join('')
    + (st.mode === 'p4' && st.voice ? row('🗣️ 国民への 説明', `<p class="tc-t"><b>${esc(st.voice.who)}</b>へ：${esc(st.voice.text)}</p>`) : '')
    + row('📊 ものさし', `<div class="tc-stars">${['co2', 'cost', 'stab', 'self', 'safe'].map(mk => `<span>${MET[mk].icon} ${MET[mk].name}<b>${MET[mk].fmt(r[mk])}</b></span>`).join('')}</div>`);
}

/* ---------- 3D ---------- */
function build3D() {
  const W3 = EC.W3, host = root.querySelector('#jpView');
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.outputColorSpace = T.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(30, 1, 5, 9000);
  const hemi = new T.HemisphereLight('#EAF4FF', '#B9A88E', 1.4), sun = new T.DirectionalLight('#FFF4E2', 2.4);
  sun.position.set(-200, 500, 300); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -320, right: 320, top: 320, bottom: -320, near: 50, far: 1500 }); sun.shadow.camera.updateProjectionMatrix();
  scene.add(hemi, sun);
  const R = MAP.length, Cn = MAP[0].length, X = c => (c - Cn / 2) * CELL, Z = r => (r - R / 2) * CELL;
  // 海（ゆれる 波）
  const seaMat = W3.toy('#4FB0E8', { roughness: 0.08, clearcoat: 1 });
  scene.add(W3.mesh(W3.roundedBox(2600, 10, 2600, 26), seaMat, 0, -10, 0, false));
  const cells = []; MAP.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.') cells.push([r, c, ch]); }));
  const isLand = (r, c) => r >= 0 && r < R && c >= 0 && c < Cn && MAP[r][c] !== '.';
  // 海からの きょり → 高さ（まんなかが 山）
  const dist = new Map(); let q = [];
  cells.forEach(([r, c]) => { if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !isLand(r + a, c + b))) { dist.set(r * 99 + c, 0); q.push([r, c]); } });
  while (q.length) { const nq = []; q.forEach(([r, c]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const rr = r + a, cc = c + b, k = rr * 99 + cc; if (isLand(rr, cc) && !dist.has(k)) { dist.set(k, dist.get(r * 99 + c) + 1); nq.push([rr, cc]); } })); q = nq; }
  const hgt = (r, c) => 4 + Math.min(3, dist.get(r * 99 + c) || 0) * 5 + ((r * 7 + c * 3) % 3);
  const land = new T.InstancedMesh(W3.roundedBox(CELL - 1.2, 1, CELL - 1.2, 4), W3.toy('#FFFFFF', { roughness: 0.55, clearcoat: 0.3 }), cells.length);
  const m4 = new T.Matrix4(), col = new T.Color(), q4 = new T.Quaternion(), sc = new T.Vector3();
  cells.forEach(([r, c, ch], i) => { const hh = hgt(r, c); m4.compose(new T.Vector3(X(c), hh / 2 - 6, Z(r)), q4, sc.set(1, hh + 6, 1)); land.setMatrixAt(i, m4); land.setColorAt(i, col.set(REG[ch].col).offsetHSL(0, 0.12, -0.04 - (dist.get(r * 99 + c) || 0) * 0.04)); });
  land.castShadow = land.receiveShadow = true; scene.add(land);
  // 地方の 名前
  Object.entries(REG).forEach(([k, Rg]) => {
    const cs = cells.filter(x => x[2] === k), cr = cs.reduce((a, x) => a + x[0], 0) / cs.length, cc = cs.reduce((a, x) => a + x[1], 0) / cs.length;
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 72; const gx = cv.getContext('2d');
    gx.font = '900 40px sans-serif'; gx.textAlign = 'center'; gx.lineWidth = 9; gx.strokeStyle = 'rgba(255,255,255,.95)'; gx.strokeText(Rg.name, 128, 52); gx.fillStyle = '#3D4C5E'; gx.fillText(Rg.name, 128, 52);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), transparent: true, depthWrite: false })); sp.scale.set(70, 20, 1);
    sp.position.set(X(cc) + (k === 'Q' ? -30 : k === 'S' ? 20 : 40), 46, Z(cr)); sp.renderOrder = 5; scene.add(sp);
  });
  // 町の 明かり
  const lights = [];
  cells.forEach(([r, c, ch]) => {
    const n = REG[ch].dem > 12 ? 2 : REG[ch].dem > 5 ? 1 : ((r + c) % 3 === 0 ? 1 : 0);
    for (let i = 0; i < n; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: W3.glowTex, color: '#FFC86B', transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); s.scale.set(26, 26, 1); s.position.set(X(c) + (i ? 5 : -4), hgt(r, c) + 4, Z(r) + (i ? -4 : 3)); scene.add(s); lights.push(s); }
  });
  // 太陽光パネル畑（わりあい 1%で 2まい）
  const panelGeo = new T.BoxGeometry(5, 0.7, 3.4), panels = new T.InstancedMesh(panelGeo, new T.MeshPhysicalMaterial({ color: '#2B4C8C', roughness: 0.25, clearcoat: 1, metalness: 0.2 }), 110);
  panels.count = 0; panels.castShadow = true; scene.add(panels);
  const solarCells = slotList('solar', cells).slice(0, 55), pSpots = [];
  solarCells.forEach(([r, c], i) => { for (let j = 0; j < 2; j++) pSpots.push([X(c) + (j ? 5 : -5) + ((i * 7) % 3) - 1, hgt(r, c) + 0.9, Z(r) + (j ? -4 : 4)]); });
  // CO₂の もや
  const haze = new T.Mesh(new T.CircleGeometry(330, 48), new T.MeshBasicMaterial({ color: '#7D8796', transparent: true, opacity: 0, depthWrite: false }));
  haze.rotation.x = -Math.PI / 2; haze.position.set(0, 95, 10); scene.add(haze);
  // タンカー（輸入燃料）
  const ports = [[12, 16], [14, 9], [17, 3], [10, 15], [15, 6], [13, 13]].map(([r, c]) => new T.Vector3(X(c), 0, Z(r)));
  const ships = ports.map((p, i) => {
    const gp = new T.Group();
    gp.add(W3.mesh(W3.roundedBox(30, 6, 10, 3), W3.toy('#E8604C'), 0, 2, 0));
    [-9, -1, 7].forEach(x => gp.add(W3.mesh(new T.SphereGeometry(3.6, 12, 8), W3.toy('#F4F6FA'), x, 6.5, 0)));
    gp.add(W3.mesh(W3.roundedBox(6, 7, 8, 2), W3.toy('#FFFFFF'), 13, 7, 0));
    const from = new T.Vector3(p.x + (i % 2 ? 260 : 300), 0, p.z + (i % 3 - 1) * 120 + 150);
    gp.visible = false; scene.add(gp);
    return { gp, from, to: new T.Vector3(p.x + 30, 0, p.z + 26), t: i / ports.length };
  });
  const resize = () => { const w = host.clientWidth, h = host.clientHeight; if (!w) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(host); resize();
  R3 = { renderer, scene, camera, sun, hemi, cells, X, Z, hgt, lights, panels, pSpots, haze, ships, charas: [], smoke: [], ro, host, raf: 0, last: performance.now(), hour: 13, view: null, dirty: true,
    cam: { th: 0, ph: 0.93, r: 980, zoom: 1, idle: 99, tx: 10, tz: 60 }, spin: true, party: 0, auto: camAuto() };
  orbit(renderer.domElement);
  R3.raf = requestAnimationFrame(loop);
}
// 電源ごとの 置き場所の じゅんばん（向いている 地方から、決まった 順に）
function slotList(k, cells) {
  const fit = FIT[k], out = [];
  cells.forEach(([r, c, ch]) => { const f = fit[ch] || 0; if (f) out.push([r, c, f * (0.6 + ((r * 31 + c * 17 + k.length * 7) % 40) / 100)]); });
  return out.sort((a, b) => b[2] - a[2]);
}
function sync3D() {
  if (!R3) return; R3.dirty = false;
  const W3 = EC.W3, want = [];
  SRC.forEach(s => {
    const n = mix[s.k] >= 2.5 ? Math.max(1, Math.round(mix[s.k] / 5)) : 0;
    const sl = slotList(s.k, R3.cells), step = s.k === 'solar' ? 5 : 1;    // ☀️は 畑と かさならないよう 間を あける
    for (let i = 0; i < n; i++) want.push({ key: s.k + i, k: s.k, i, at: sl[(i * step) % sl.length] });
  });
  // 同じ マスに 2人 来ないように ずらす
  const used = new Set();
  R3.charas = R3.charas.filter(c => { if (want.some(w => w.key === c.key)) return true; R3.scene.remove(c.rig.root); return false; });
  let fresh = 0;
  want.forEach(w => {
    let [r, c] = w.at; let tries = 0; while (used.has(r * 99 + c) && tries++ < 30) { const sl = slotList(w.k, R3.cells); [r, c] = sl[(w.i + tries * 3) % sl.length]; }
    used.add(r * 99 + c);
    let ex = R3.charas.find(x => x.key === w.key);
    if (!ex) { const rig = W3.makeChara({ type: w.k, id: w.i + 3 }, true); rig.root.scale.setScalar(0.001); R3.scene.add(rig.root); ex = { key: w.key, k: w.k, rig, pop: -fresh * 0.08, id: w.i + 3 }; R3.charas.push(ex); fresh++; }
    ex.rig.root.position.set(R3.X(c), R3.hgt(r, c) - 0.5, R3.Z(r)); ex.rig.root.rotation.y = -0.35;
  });
  if (fresh) sfx('built');
  // パネル畑
  const np = Math.min(R3.pSpots.length, Math.round(mix.solar * 2)), m4 = new T.Matrix4(), rot = new T.Quaternion().setFromEuler(new T.Euler(-0.35, 0.2, 0));
  for (let i = 0; i < np; i++) { const [x, y, z] = R3.pSpots[i]; m4.compose(new T.Vector3(x, y, z), rot, new T.Vector3(1, 1, 1)); R3.panels.setMatrixAt(i, m4); }
  R3.panels.count = np; R3.panels.instanceMatrix.needsUpdate = true;
  // タンカー・もや
  const ns = Math.round(mix.thermal / 12);
  R3.ships.forEach((s, i) => { s.gp.visible = i < ns; });
  R3.hazeTo = clamp((metrics(mix).co2 - 25) / 130, 0, 0.5);
}
function loop(now) {
  if (!R3) return;
  const dt = Math.min(0.1, (now - R3.last) / 1000); R3.last = now; const t = now / 1000;
  if (EC.Audio && EC.Audio.tick) EC.Audio.tick();
  if (run) tickRun(dt);
  if (R3.dirty) sync3D();
  const hh = R3.hour % 24, e = sunAt(hh), dayK = clamp((e + 0.06) / 0.3, 0, 1), cloudy = run && day === DAYS.cloud;
  R3.sun.intensity = 0.35 + 2.0 * dayK * (cloudy ? 0.55 : 1); R3.hemi.intensity = 0.4 + 1.0 * dayK;
  R3.sun.position.set(-Math.cos(Math.PI * (hh - 6) / 12) * 420, 120 + e * 460, 300);
  R3.host.style.background = `linear-gradient(180deg, ${dayK > 0.5 ? (cloudy ? '#B4C0CC' : '#BFDDF7') : '#1A2448'} 0%, ${dayK > 0.5 ? '#F4F8FC' : '#2E3A66'} 100%)`;
  const x = R3.view, dark = x ? clamp(x.short / x.D * 1.6, 0, 1) : 0;
  R3.lights.forEach((l, i) => { const off = (i % 10) / 10 < dark; l.material.opacity = (1 - dayK) * (off ? 0.04 : 0.85); });
  // もや
  R3.haze.material.opacity += ((R3.hazeTo || 0) - R3.haze.material.opacity) * Math.min(1, dt * 3);
  // キャラ
  const sunDir = R3.sun.position.clone().normalize();
  R3.charas.forEach(c => {
    if (c.pop < 1) { c.pop += dt * 2.4; const p = Math.max(0, c.pop); c.rig.root.scale.setScalar(Math.max(0.001, 0.4 * (p >= 1 ? 1 : 1 + Math.sin(p * Math.PI) * 0.35) * Math.min(1, p * 1.4))); }
    let mood = 'normal', out = 0.6;
    if (x) { out = x.g[c.k] > 0.5 ? 0.8 : 0; mood = c.k === 'solar' && e <= 0.02 ? 'sleep' : c.k === 'wind' && day === DAYS.calm ? 'sad' : x.short > x.D * 0.02 ? 'sweat' : c.k === 'thermal' && x.g.thermal > x.D * 0.4 ? 'sweat' : 'happy'; }
    else if (R3.party > 0) mood = 'happy';
    if (c.rig.face.userData.mood !== mood) { c.rig.face.material = EC.W3.faceMat(c.k, mood); c.rig.face.userData.mood = mood; }
    EC.W3.animRig(c.rig, { id: c.id, type: c.k, out: EC.CFG.plants[c.k].cap * out, mode: 'on', warm: 1 }, mood, t, dt, { sun: e * (cloudy ? 0.5 : 1), wind: run && day === DAYS.calm ? 0.02 : 0.45, soc: 0.6 }, sunDir);
  });
  R3.party = Math.max(0, R3.party - dt);
  // けむり（🔥の 上に もくもく）
  const th = R3.charas.filter(c => c.k === 'thermal');
  while (R3.smoke.length < th.length * 3) { const s = new T.Sprite(new T.SpriteMaterial({ map: EC.W3.puffTex, color: '#8C96A3', transparent: true, opacity: 0, depthWrite: false })); s.userData.ph = Math.random(); R3.scene.add(s); R3.smoke.push(s); }
  R3.smoke.forEach((s, i) => {
    const c = th[Math.floor(i / 3)]; if (!c) { s.visible = false; return; }
    s.visible = true; s.userData.ph = (s.userData.ph + dt * 0.25) % 1; const p = s.userData.ph, b = c.rig.root.position;
    s.position.set(b.x + Math.sin(t + i) * 3 + p * 10, b.y + 14 + p * 40, b.z - 2 - p * 6); s.scale.setScalar(8 + p * 22); s.material.opacity = (1 - p) * 0.55 * (x ? (x.g.thermal > 0.5 ? 1 : 0.2) : 1);
  });
  // タンカー
  R3.ships.forEach(s => { if (!s.gp.visible) return; s.t = (s.t + dt * 0.035) % 1; const p = s.t; s.gp.position.lerpVectors(s.from, s.to, Math.min(1, p * 1.15)); s.gp.position.y = -3 + Math.sin(t * 2 + p * 9) * 0.6; s.gp.lookAt(s.to.x, s.gp.position.y, s.to.z); s.gp.rotateY(-Math.PI / 2); s.gp.scale.setScalar(p > 0.9 ? Math.max(0.01, (1 - p) * 10) : Math.min(1, p * 12)); });
  // カメラ
  const cm = R3.cam; cm.idle += dt;
  if (R3.spin && cm.idle > 3) { cm.th += dt * 0.08; ease(cm, [10, 60, 1, cm.th, 0.93], dt); }
  else if (!R3.spin && R3.auto && cm.idle > 5) camDirect(cm, t, dt);
  const rr = cm.r * cm.zoom, tx = cm.tx, tz = cm.tz;
  R3.camera.position.set(tx + rr * Math.sin(cm.th) * Math.cos(cm.ph), rr * Math.sin(cm.ph), tz + rr * Math.cos(cm.th) * Math.cos(cm.ph));
  R3.camera.lookAt(tx, 0, tz);
  const w = R3.host.clientWidth, h = R3.host.clientHeight, L = root.querySelector('#jpLeft'), Rt = root.querySelector('#jpRight');
  const lw = L && L.offsetWidth && w > 900 ? L.offsetWidth + 12 : 0, rw = Rt && Rt.offsetWidth && w > 900 ? Rt.offsetWidth + 12 : 0;
  R3.camera.setViewOffset(w, h, (rw - lw) / 2, 0, w, h);
  R3.renderer.render(R3.scene, R3.camera);
  R3.raf = requestAnimationFrame(loop);
}
/* ---------- 🎥 自動カメラ ----------
   さわっていない あいだ：日本全体 → 地方に 寄る → 引く を ゆっくり くりかえす。スライダーを 動かすと その 電源の 発電所へ 寄る。
   「日本の 1日」の あいだは 全体を 見ながら ゆれる。マウスで さわると 止まり、5秒 たつと もどる。
   「動きを へらす」設定の パソコンでは はじめは OFF（凡例の ボタンで 切りかえ） */
const camAuto = () => { try { const v = localStorage.getItem('ec.jp.cam'); if (v) return v === '1'; } catch (e) {} return !(g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches); };
const REGC = {};
function regC(k) {   // 地方の まん中（地図の マスから）
  if (!REGC[k]) { let sx = 0, sz = 0, n = 0; MAP.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === k) { sx += (c - MAP[0].length / 2) * CELL; sz += (r - MAP.length / 2) * CELL; n++; } })); REGC[k] = [sx / n, sz / n]; }
  return REGC[k];
}
// [地方（null＝全体）, ズーム, 横の 角度, たての 角度]　1つ 8秒
const TOUR = [[null, 1, 0, 0.93], ['K', 0.5, 0.3, 0.8], ['N', 0.5, -0.15, 0.82], ['Q', 0.55, -0.35, 0.82], [null, 0.92, 0.25, 0.98], ['H', 0.55, 0.35, 0.82], ['T', 0.5, 0.2, 0.8], ['C', 0.5, 0.05, 0.82]];
function ease(cm, gl, dt) {
  const k = 1 - Math.exp(-dt * 0.7);
  cm.tx += (gl[0] - cm.tx) * k; cm.tz += (gl[1] - cm.tz) * k; cm.zoom += (gl[2] - cm.zoom) * k; cm.th += (gl[3] - cm.th) * k; cm.ph += (gl[4] - cm.ph) * k;
}
function camDirect(cm, t, dt) {
  cm.th = Math.atan2(Math.sin(cm.th), Math.cos(cm.th));   // メニューで 何回も 回った 分を もどす（ぐるぐる 巻きもどらない ように）
  const f = R3.focus && t - R3.focus.t < 4 ? R3.charas.filter(c => c.k === R3.focus.k) : [];
  if (f.length) { const x = f.reduce((a, c) => a + c.rig.root.position.x, 0) / f.length, z = f.reduce((a, c) => a + c.rig.root.position.z, 0) / f.length; return ease(cm, [x, z, 0.55, cm.th, 0.8], dt); }
  if (run) return ease(cm, [10, 60, 0.85, Math.sin(t * 0.15) * 0.3, 0.9], dt);
  const seg = TOUR[Math.floor(t / 8) % TOUR.length], c = seg[0] ? regC(seg[0]) : [10, 60];
  ease(cm, [c[0], c[1], seg[1], seg[2] + Math.sin(t * 0.2) * 0.05, seg[3]], dt);
}
function orbit(el) {
  const pts = new Map(); let pinch = 0;
  el.style.touchAction = 'none'; el.style.cursor = 'grab';
  el.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => {
    if (!R3 || !pts.has(e.pointerId)) return;
    const [x0, y0] = pts.get(e.pointerId), cm = R3.cam; pts.set(e.pointerId, [e.clientX, e.clientY]); cm.idle = 0;
    if (pts.size === 1) { cm.th -= (e.clientX - x0) * 0.005; cm.ph = clamp(cm.ph + (e.clientY - y0) * 0.004, 0.25, 1.45); }
    else { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) cm.zoom = clamp(cm.zoom * pinch / d, 0.4, 1.6); pinch = d; }
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => { if (!R3) return; e.preventDefault(); R3.cam.zoom = clamp(R3.cam.zoom * Math.exp(e.deltaY * 0.001), 0.4, 1.6); R3.cam.idle = 0; }, { passive: false });
  el.addEventListener('dblclick', () => { if (R3) Object.assign(R3.cam, { th: 0, ph: 0.93, zoom: 1 }); });
}

EC.Japan = { open, _quit: () => { onBack = null; opts = {}; if (root) close(); }, _metrics: metrics, _modes: MODES, _normalize: normalize, _startMix: startMix, _sim: simulate, _days: DAYS, _gOk: gOk, _base: BASE, _src: SRC, _keys: KEYS, _tut: () => tut, _p4: { goals: p4Goals, set: m => { Object.assign(mix, m); update(); }, voices: () => voices(metrics(mix)), compare: () => comparePlan() } };
})(window);
