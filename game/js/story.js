/* エネルギーシティ ― 📘 シナリオ「町の電気をまかされた！」（ゴールベースシナリオ・4部構成）
   第1部 電気の しくみ → 第2部 いろいろな 電源と 町の 声（公約を 立てる）→ 第3部 自分で 設計 → 第4部 本当の 日本（大作戦3D）
   各部の おわりに 💬話し合いタイム、記録は EC.Log に 残り 📝学習レポート（PDF）に まとまる。
   1話ずつ：課題を知る → 選ぶ（予算あり）→ よそう → 3Dの町で1日を見る → 結果（ほかの選択とくらべる）→ 新しい課題が次の話に。
   次の話は「いまの町で実際にためして、弱いところ」から決まるので、選び方によって話が分かれていく。
   まとめ：いろいろな日でためして ⭐3つ（停電・CO₂・お金）とエンディング（図鑑に記録）。 */
(function (g) {
const EC = g.EC, C = EC.CFG, P = C.plants, T = g.THREE;

/* ---------- 課題（1話） ----------
   day：ためす日　win：停電を数える時間　ok：クリア条件（停電なしのほかに）
   need：この話が出てくる条件（いまの町）　opts：選択肢（build：建てる数・save：節電）*/
const EP = {
  day: { title: '昼の電気を 用意しよう', icon: '☀️', sky: 'sunny', day: { weather: 'sunny', wind: 0.30 }, win: [10, 15],
    intro: ['新人さん、ようこそ！ 町長の チャッピーです。', 'この町の 電気を まかせたい。まずは 昼（10〜15時）の 電気から！'],
    opts: [
      { title: '太陽光発電を 7つ', good: '燃料いらず・CO₂少ない', bad: '夜は 0・天気まかせ', build: { solar: 7 } },
      { title: '火力発電を 1つ', good: '昼も夜も 出力を 調整できる', bad: 'CO₂が多い・燃料代', build: { thermal: 1 } },
      { title: '太陽光 5つ ＋ 風力 1つ', good: 'CO₂少ない・風があれば夜も', bad: '天気と風まかせ', build: { solar: 5, wind: 1 } }
    ] },
  night: { title: '夜も 電気を！', icon: '🌙', sky: 'sunny', day: { weather: 'sunny', wind: 0.30 }, win: [6, 24],
    need: () => true, intro: ['昼は うまくいった！ でも…', '日が しずむと、町が 暗くなっちゃう。夜は どうする？'],
    opts: [
      { title: '火力発電を 1つ 追加', good: '夜も 確実に 出せる', bad: 'CO₂・燃料代が ふえる', build: { thermal: 1 } },
      { title: '蓄電池を 3つ', good: 'CO₂ 0。昼の あまりを 夜へ', bad: 'ためられる 量が 足りるかな？', build: { battery: 3 } },
      { title: '蓄電池を 6つ', good: 'CO₂ 0。たくさん ためられる', bad: '費用が 高め・材料は 輸入', build: { battery: 6 } },
      { title: '太陽光 4つ ＋ 蓄電池 6つ', good: 'ためる電気も ふやす', bad: '費用が 高い', build: { solar: 4, battery: 6 } }
    ] },
  cloud: { title: 'くもりの日が 来た！', icon: '☁️', sky: 'cloudy', day: { weather: 'cloudy', wind: 0.30 }, win: [6, 24],
    need: p => p.solar > 0, intro: ['きょうは ☁️くもり。', '太陽光発電が 半分くらいしか 発電できない…'],
    opts: [
      { title: '火力発電を 予備に 1つ', good: '天気に 関係なく 出せる', bad: 'CO₂・燃料代', build: { thermal: 1 } },
      { title: '太陽光を 4つ ふやす', good: '晴れの日は もっと 強い', bad: 'くもりだと やっぱり 弱い', build: { solar: 4 } },
      { title: '蓄電池を 2つ ふやす', good: 'CO₂ 0', bad: 'ためる 電気が なければ 空っぽ', build: { battery: 2 } }
    ] },
  calm: { title: '風が ふかない日', icon: '🍃', sky: 'calm', day: { weather: 'calm', wind: 0.03 }, win: [6, 24],
    need: p => p.wind > 0, intro: ['きょうは 🍃風が ぜんぜん ない。', '風力発電が 止まってしまう…'],
    opts: [
      { title: '火力発電を 1つ', good: '風に 関係なく 出せる', bad: 'CO₂・燃料代', build: { thermal: 1 } },
      { title: '風力発電を 2つ ふやす', good: '風の日は とても 強い', bad: '風がなければ 0のまま', build: { wind: 2 } },
      { title: '蓄電池 2つ ＋ 太陽光 2つ', good: '昼に ためて 夜へ', bad: '費用が 高い', build: { battery: 2, solar: 2 } }
    ] },
  fuel: { title: '燃料が 値上がり！', icon: '💸', sky: 'sunny', day: { weather: 'sunny', wind: 0.30, events: ['fuel'] }, win: [6, 24],
    ok: (r, b) => r.fuel <= b * 0.8, okText: '燃料代を 2割 へらす',
    need: p => p.thermal > 0, intro: ['世界の 事情で 💸燃料が 値上がり！ 火力の 燃料費は 2020年→2023年で 約1.4倍に（国の 発電コスト検証）。', '火力発電に たよるほど お金が 出ていく…　目標：燃料代を 2割 へらす'],
    opts: [
      { title: '太陽光 4つ ＋ 蓄電池 3つ', good: '昼の電気を 夜に まわす', bad: '費用が 高い・🔥は 止められない', build: { solar: 4, battery: 3 } },
      { title: '火力を 1つ やめて 風力 3つ＋蓄電池 3つ', good: '燃料代も CO₂も 大きく へる', bad: '費用が 高い・風まかせ', build: { thermal: -1, wind: 3, battery: 3 } },
      { title: 'がまんして このまま', good: '建設費 0', bad: '燃料代が 高いまま', build: {}, none: true }
    ] },
  heat: { title: '記録的な 猛暑！', icon: '🥵', sky: 'heat', day: { weather: 'heat', wind: 0.19 }, win: [6, 24],
    need: () => true, intro: ['きょうは 🥵猛暑。エアコンで 電気を 使う量が 15%アップ！', 'いまの 町で のりきれる？'],
    opts: [
      { title: '火力発電を 1つ 追加', good: '確実に ふやせる', bad: 'CO₂・燃料代', build: { thermal: 1 } },
      { title: '蓄電池を 2つ', good: 'CO₂ 0', bad: 'ためる 電気が いる', build: { battery: 2 } }
    ] }
};
/* ---------- 第2部「町が 大きくなる」 ----------
   10年後、家が 10けん・工場が 1つ。⚛️原子力・♨️地熱が 選べるように なる。
   選んだ 電源に よって 次の 話が 分かれる（⚛️→大地震／♨️→温泉の 反対／🔥→燃料が 届かない／☀️🔋→雨の 日が つづく）→ 最後は CO₂目標 */
const V = (ic, who, say) => [ic, who, say];
Object.assign(EP, {
  factory: { part: 2, title: '工場が やってきた！', icon: '🏭', sky: 'sunny', day: { weather: 'sunny', wind: 0.30 }, win: [6, 24],
    intro: ['10年後。町は 家が 10けんに ふえ、大きな 工場も できた！', '工場は 昼も 夜も 電気を 使う。いまの 発電所では 夕方〜夜に 足りない…'],
    opts: [
      { title: '原子力発電を 1つ', good: 'CO₂が 少なく、昼も 夜も 大量に 安定', bad: '事故の 不安・放射性廃棄物・出力を 変えにくい', build: { nuclear: 1 },
        voice: [V('👷', '工場長', '安くて 止まらない 電気は ありがたい！'), V('👩', '近所の 人', '事故が おきたら…子どもが 心配')] },
      { title: '地熱発電を 3つ', good: '天気に 関係なく 安定・CO₂が 少ない', bad: '1つが 小さい・山や 温泉の 近くに しか 建てられない', build: { geo: 3 },
        voice: [V('🧑‍🔬', '研究者', '日本の 地熱資源は 世界3位！'), V('👘', '温泉の 女将', 'お湯が へらないか 心配…')] },
      { title: '火力発電を 1つ', good: '建てる お金が 安く、出力も 調整できる', bad: 'CO₂が 多い・燃料は ほぼ 輸入', build: { thermal: 1 },
        voice: [V('👷', '工場長', 'すぐ 建てられて 助かる'), V('🧒', '中学生', 'CO₂が ふえたら 地球は？')] },
      { title: '太陽光 6つ ＋ 蓄電池 4つ', good: '燃料いらず・CO₂ほぼ0', bad: '費用が 高い・広い 土地が いる', build: { solar: 6, battery: 4 },
        voice: [V('👨‍🌾', '農家', '畑が パネルに なるのは…'), V('🧒', '中学生', '未来に やさしい！')] }
    ],
    next: o => (o.build || {}).nuclear ? 'quake' : (o.build || {}).geo ? 'onsen' : (o.build || {}).thermal ? 'import' : (o.build || {}).solar ? 'rainy' : 'import' },
  quake: { part: 2, title: '大地震！ 大きな 発電所が 止まった', icon: '🫨', sky: 'sunny', day: { weather: 'sunny', wind: 0.30 }, win: [6, 24], prep: quakePrep,
    intro: ['大きな 地震！ 町で いちばん 大きな 発電所が 安全の ため 止まった…', '2018年 北海道では 大きな 火力発電所が 止まり、北海道 全体が 停電（ブラックアウト）した。'],
    opts: [
      { title: '火力発電を 予備に 1つ', good: 'すぐ 動かせる 予備', bad: 'CO₂・燃料の 輸入', build: { thermal: 1 }, voice: [V('👷', '工場長', '止まらない ことが いちばん 大事')] },
      { title: '地熱発電を 2つ', good: '天気に 関係なく 安定', bad: '費用が かかる・場所が 限られる', build: { geo: 2 }, voice: [V('🧑‍🔬', '研究者', '大きな 1つより、小さな たくさんも 手')] },
      { title: '太陽光 3つ ＋ 蓄電池 3つ', good: '燃料いらず・分散型', bad: '費用が 高い', build: { solar: 3, battery: 3 }, voice: [V('👩', '近所の 人', '家の 屋根にも のせられる？')] },
    ], next: () => 'co2goal' },
  onsen: { part: 2, title: '温泉の 町が 反対！', icon: '👘', sky: 'cloudy', day: { weather: 'cloudy', wind: 0.30 }, win: [6, 24],
    intro: ['地熱発電所の 近くの 温泉の 人たちが「お湯が へるかも」と 心配している。', 'しかも きょうは くもり。町の 人の 気持ちと 電気、どちらも 守るには？'],
    opts: [
      { title: '温泉の 人と 話し合い、お湯の 調査を つづける', good: '地熱を 続けられる・町の 人も 安心', bad: '話し合いに 時間が かかる', people: 1, voice: [V('👘', '温泉の 女将', 'お湯の 調査も いっしょに してくれるなら…')] },
      { title: '地熱を 1つ やめて 火力を 1つ', good: '反対は おさまる', bad: 'CO₂・燃料の 輸入が ふえる', build: { geo: -1, thermal: 1 }, voice: [V('🧒', '中学生', 'せっかくの 国産エネルギーなのに…')] },
      { title: '地熱を 1つ やめて 太陽光3＋蓄電池2', good: 'CO₂が 少ない', bad: '費用が 高い・くもりに 弱い', build: { geo: -1, solar: 3, battery: 2 }, voice: [V('👨‍🌾', '農家', 'また 畑が へるのか…')] },
      { title: '反対を 気にせず このまま', good: 'お金が かからない', bad: '町の 人の 信頼を うしなう', people: -2, none: true, voice: [V('👘', '温泉の 女将', 'わたしたちの 声は 聞いて もらえないの？')] }
    ], next: () => 'co2goal' },
  import: { part: 2, title: '輸入燃料が 値上がり！', icon: '🚢', sky: 'sunny', day: { weather: 'sunny', wind: 0.30, events: ['fuel'] }, win: [6, 24],
    ok: (r, b) => r.fuel <= b * 0.8, okText: '燃料代を 2割 へらす',
    intro: ['遠い 海で 争いが おき、燃料（LNG など）の 値段が 上がった。火力の 燃料費は 2020年→2023年で 約1.4倍（国の 発電コスト検証）。', '日本は 燃料の ほとんどを 輸入している（原油は 約95%が 中東から）。目標：燃料代を 2割 へらす'],
    opts: [
      { title: '原子力発電を 1つ', good: '燃料を 一度 入れると 長く 使える（準国産）', bad: '事故の 不安・廃棄物', build: { nuclear: 1 }, voice: [V('👷', '工場長', '輸入に 左右されない 電気が ほしい')] },
      { title: '地熱発電を 3つ', good: '国産・天気に 関係なく 安定', bad: '費用・場所', build: { geo: 3 }, voice: [V('🧑‍🔬', '研究者', '足もとの 熱は だれにも 止められない')] },
      { title: '太陽光 6つ ＋ 蓄電池 4つ', good: '国産・燃料いらず', bad: '費用が 高い・夜は ためた 分だけ', build: { solar: 6, battery: 4 }, voice: [V('🧒', '中学生', '燃料が いらないって 強い！')] },
    ], next: () => 'co2goal' },
  rainy: { part: 2, title: '雨の 日が つづく', icon: '🌧️', sky: 'cloudy', day: { weather: 'rain', wind: 0.30 }, win: [6, 24],
    intro: ['雨や くもりの 日が 何日も つづく。', '☀️が 弱く、🔋に ためる 電気も 足りない…'],
    opts: [
      { title: '地熱発電を 2つ', good: '天気に 関係なく 安定', bad: '費用・場所', build: { geo: 2 }, voice: [V('🧑‍🔬', '研究者', '雨でも 地下の 熱は 変わらない')] },
      { title: '火力発電を 1つ', good: 'すぐ 調整できる', bad: 'CO₂・輸入燃料', build: { thermal: 1 }, voice: [V('🧒', '中学生', 'ここまで 再エネで きたのに…')] },
      { title: '原子力発電を 1つ', good: '大量に 安定', bad: '事故の 不安・廃棄物', build: { nuclear: 1 }, voice: [V('👩', '近所の 人', '町に 原発は ちょっと…')] },
      { title: '蓄電池を 3つ ふやす', good: 'CO₂ 0', bad: 'ためる 電気が なければ 空っぽ', build: { battery: 3 }, voice: [V('👷', '工場長', 'ためる ものが あるのかい？')] }
    ], next: () => 'co2goal' },
  co2goal: { part: 2, title: 'CO₂を へらせ！ 国の めやす', icon: '🌏', sky: 'sunny', day: { weather: 'sunny', wind: 0.30 }, win: [6, 24],
    ok: r => r.co2 <= 40, okText: '🔥の わりあい 40%以下',
    intro: ['国は 2040年度に 火力を 3〜4割に する めやすを 出した。町の 電気の うち 🔥で つくる わりあいを 40%以下に！', '🔥は 動いていると 最低 3割は 出し続ける。CO₂を へらすには…？'],
    opts: [
      { title: '🔥火力を 1つ やめる', good: 'お金が かからない・燃料代も へる', bad: '夕方の 調整役が へる', build: { thermal: -1 }, voice: [V('👷', '工場長', '夕方の 電気は 大丈夫？')] },
      { title: '🔥を 2つまで やめて ⚛️原子力を 1つ', good: 'CO₂が 少なく 大量・安定', bad: '事故の 不安・廃棄物', build: { thermal: -2, nuclear: 1 }, voice: [V('👩', '近所の 人', '安全は だれが 守るの？')] },
      { title: '🔥を 2つまで やめて ☀️4＋🔋3', good: 'CO₂ほぼ0・国産', bad: '費用が 高い', build: { thermal: -2, solar: 4, battery: 3 }, voice: [V('👨‍🌾', '農家', '屋根や 空き地なら いいよ')] },
      { title: '🔥を 2つまで やめて ♨️地熱を 2つ', good: '安定した 国産', bad: '費用・温泉', build: { thermal: -2, geo: 2 }, voice: [V('👘', '温泉の 女将', 'ちゃんと 調べて くれるなら')] }
    ], next: () => null }
});
EP.calm2 = { part: 2, title: '風が ふかない日', icon: '🍃', sky: 'calm', day: { weather: 'calm', wind: 0.03 }, win: [6, 24], opts: [], hidden: true };
// 地震：町で いちばん 大きな 発電所が 止まる（⚛️が あれば ⚛️、なければ 🔥を 1つ）
function quakePrep(S) { const nu = S.plants.filter(p => p.type === 'nuclear'); if (nu.length) nu.forEach(p => { p.off = 'quake'; }); else { const th = S.plants.find(p => p.type === 'thermal'); if (th) th.off = 'trip'; } }
// 電池の 点検：火事の ニュースの あと 安全点検で 🔋の 約35%が 止まる（韓国 2019年：約522か所＝約35%が 運転を 止めた。報道）
const batCut = S => { const n = S.plants.filter(p => p.type === 'battery' && !p.left).length, on = n - Math.round(n * 0.35); S.bCap = on * P.battery.store; S.bPow = on * P.battery.cap; S.bE = Math.min(S.bE, S.bCap); };
/* ---------- 第3部「みらいの 町を 設計しよう」 ----------
   選ぶ だけで なく、道具を ぜんぶ 使って 自分で 組み立てる。5つの 日で 何度でも ためせる（設計 → ためす → 直す）。 */
const SUNNY = { weather: 'sunny', wind: 0.30 };
Object.assign(EP, {
  d_sun: { part: 3, title: '晴れ', icon: '☀️', sky: 'sunny', day: SUNNY, win: [6, 24], opts: [], hidden: true, about: '☀️ よく 晴れた 日' },
  d_cloud: { part: 3, title: '雨', icon: '🌧️', sky: 'cloudy', day: { weather: 'rain', wind: 0.30 }, win: [6, 24], opts: [], hidden: true, about: '🌧️ 雨で ☀️は 晴れの日の 約3割（東京エリア 2024年）。🔋に ためる 電気も 少ない' },
  d_calm: { part: 3, title: '風なし', icon: '🍃', sky: 'calm', day: { weather: 'calm', wind: 0.03 }, win: [6, 24], opts: [], hidden: true, about: '🍃 風が ほとんど ない' },
  d_quake: { part: 3, title: '大地震', icon: '🫨', sky: 'sunny', day: SUNNY, win: [6, 24], opts: [], hidden: true, prep: quakePrep, about: '🫨 いちばん 大きな 発電所が 止まった' },
  d_bat: { part: 3, title: '電池の 点検', icon: '🧯', sky: 'sunny', day: SUNNY, win: [6, 24], opts: [], hidden: true, prep: batCut, about: '🧯 よその 電池の 火事の ニュース → 安全点検で 🔋の 約3分の1が 止まった（韓国の 例：約35%）' }
});
const WEEK3 = ['d_sun', 'd_cloud', 'd_calm', 'd_quake', 'd_bat'];
// 設計で 使える 道具（数の 上限は 3Dの 置き場所）
const TOOLS = [
  { k: 'solar', max: 16 }, { k: 'wind', max: 8 }, { k: 'battery', max: 10 }, { k: 'geo', max: 5 }, { k: 'thermal', max: 4 }, { k: 'nuclear', max: 2 }
];
const PART = {
  1: { icon: '🏘️', name: '町の 電気を まかされた', desc: '電気は「つくる＝使う」。昼・夜・天気・燃料の 値段', houses: 5, factories: 0, budget: 340, first: 'day', max: 5, start: [] },
  2: { icon: '🏭', name: '町が 大きくなる', desc: '⚛️原子力・♨️地熱が 登場。地震・燃料の 輸入・町の 人の 声', houses: 10, factories: 1, budget: 520, first: 'factory', max: 3, start: [['solar', 10], ['battery', 3], ['thermal', 2]] },
  3: { icon: '🛠️', name: 'みらいの 町を 設計しよう', desc: '公約を 守れる 組み合わせを 設計 → 5つの 日で ためして 直す → ふりかえる', houses: 10, factories: 1, budget: 600, max: 0, start: [] },
  4: { icon: '🗾', name: '日本の 大臣へ', desc: '町長の 公約を 日本でも 守れる？ → 国民の 声に 説明 → 国の めやすと くらべて 宣言' }
};
[15, 15, 20, 20].forEach((m, i) => { PART[i + 1].min = m; });
const NPART = 4;
// 1つの 電源の「安全性」（大作戦3Dと 同じ ものさし、5が 安全）
const SAFE = { thermal: 3, nuclear: 2, hydro: 4, solar: 5, wind: 4, geo: 4, battery: 4 };
const HOUSES = 5, ORDER = ['night', 'cloud', 'calm', 'fuel', 'heat'];
const BUDGET = 340, TICKETS = 2, MAXEP = 5;
const NONE = { title: '何もしない', good: '建てる お金は 0', bad: 'いまの 発電所が 動きつづける。🔥が あれば 燃料代は 毎日 かかる', build: {}, none: true };
// 話に「このまま」の 選択肢が あるときは「何もしない」を 足さない（同じ 中身が 2つ 並ぶため）
function optList(E) { return E.opts.some(o => o.none) || st.ep === PART[st.part].first ? E.opts : E.opts.concat([NONE]); }
// エンディング（上から順に あてはまるもの）
const ENDS = [
  { k: 'weather', icon: '🌦️', name: 'お天気まかせの町', when: s => s.fails >= 2, say: 'いろいろな 日に 弱い町に なった。ひとつの 電源や 天気に たよりすぎ？' },
  { k: 'almost', icon: '🔧', name: 'あと一歩の町', when: s => s.fails === 1, say: 'ほとんどの 日は だいじょうぶ！ でも 1つだけ 弱点が のこった。' },
  { k: 'poor', icon: '💸', name: 'お金が たりない町', when: s => s.money < 30, say: '電気は 守れたけど、お金が ほとんど 残らなかった…' },
  { k: 'smoke', icon: '🏭', name: 'けむり もくもくの町', when: s => s.co2 > 50, say: '停電には 強い！ でも 🔥に たよって CO₂が 多い町に。' },
  { k: 'green', icon: '🌈', name: 'みどりの 未来の町', when: s => s.co2 <= 20, say: 'CO₂が とても 少なくて、停電にも 強い町！' },
  { k: 'balance', icon: '⚖️', name: 'バランス名人の町', when: () => true, say: 'いろいろな 電源を 組み合わせた、バランスの よい町！' }
];

/* ---------- ためす（いつもの需給計算） ---------- */
function freeTiles(S, k) {
  const o = [];
  for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) if (!EC.canPlace(S, k, r, c) && !EC.placeWarn(S, k, r, c)) o.push([Math.hypot(r - 5, c - 7), r, c]);
  return o.sort((a, b) => b[0] - a[0]);
}
const BUILD_ORDER = ['nuclear', 'thermal', 'wind', 'geo', 'solar', 'battery'];
function anyTiles(S, k) {   // 反対の 出る 場所しか ないとき（⚛️の 近くに 家 など）
  const o = [];
  for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) if (!EC.canPlace(S, k, r, c)) o.push([Math.hypot(r - 5, c - 7), r, c]);
  return o.sort((a, b) => b[0] - a[0]);
}
function test(plan, ep, base) {
  const E = EP[ep], PT = PART[E.part || 1];
  const S = EC.newGame('story', { stage: { houses: PT.houses, money: 99999, unlock: C.order.slice(), plants: [[3, 3, 'hydro']], days: [E.day, E.day], base: 580 } });
  S.instant = true; S.factories = PT.factories; let build = 0, warn = 0;
  const cnt = count(plan);
  BUILD_ORDER.forEach(k => { for (let i = 0; i < (cnt[k] || 0); i++) { let t = freeTiles(S, k)[0]; if (!t) { t = anyTiles(S, k)[0]; if (t) warn++; } if (t && !EC.build(S, k, t[1], t[2]).why) build += P[k].cost; } });
  // おなじ日を 2日 つづけて、2日目を 見る（🔋は 前の日の 夜の 残りから はじまる）
  const ev = []; let saved = false, ends = 0;
  for (;;) {
    if (plan.save && !saved && S.hour >= 17) { EC.useSave(S); saved = true; }
    if (E.prep) E.prep(S);
    ev.length = 0; EC.tick(S, 0.05, ev);
    if (ev.some(e => e.k === 'dayEnd')) { saved = false; if (++ends === 2) break; }
  }
  const h = S.hist[S.hist.length - 1], hours = h.shortHours.filter(x => x >= E.win[0] && x < E.win[1]);
  const okExtra = E.ok ? E.ok({ fuel: h.fuel, co2: Math.round(h.ratio * 100) }, base == null ? h.fuel : base) : true;
  // 国産率（🔥以外で つくった わりあい）と 安全性（つくった 量で 重みづけ）
  const L = h.log, gsum = k => L.gen[k].reduce((a, v) => a + v, 0), tot = C.stack.reduce((a, k) => a + gsum(k), 0) || 1;
  const impE = L.imp.reduce((a, v) => a + v, 0), self = Math.round((tot - gsum('thermal')) / (tot + impE) * 100);   // 🔌 買った 電気も 町の 外から
  const safe = Math.round(C.stack.reduce((a, k) => a + gsum(k) * (SAFE[k] || 4), 0) / tot * 10) / 10;
  return { clear: !hours.length && okExtra, hours, okExtra, fuel: h.fuel, build, imp: Math.round(L.imp.reduce((a, v) => a + v, 0)), co2: Math.round(h.ratio * 100), log: h.log, save: plan.save, self, safe, warn,
    people: (plan.people || 0) - warn - (plan.save ? 1 : 0) };
}
// 計画（選んだもの）
function newPlan(part) { return { builds: ((PART[part || 1] || PART[1]).start || []).slice(), save: false, steps: [], people: 0, link: 0, shift: false }; }
function count(plan) { const c = { solar: 0, wind: 0, battery: 0, thermal: 0, nuclear: 0, geo: 0 }; plan.builds.forEach(([k, n]) => { c[k] = Math.max(0, (c[k] || 0) + n); }); return c; }
function withOpt(plan, o) { return { builds: plan.builds.concat(Object.entries(o.build || {})), save: plan.save || !!o.save, steps: plan.steps.slice(), people: (plan.people || 0) + (o.people || 0), link: (plan.link || 0) + (o.link || 0), shift: plan.shift || !!o.shift }; }
const optCost = o => Object.entries(o.build || {}).reduce((a, [k, n]) => a + Math.max(0, n) * P[k].cost, 0) + (o.money || 0);
// 次の話：まだやっていない課題のうち、いまの町で「失敗する」もの
function nextEp(plan, done, ep, o) {
  if (ep && EP[ep].next) return EP[ep].next(o || {}, plan);
  const cands = ORDER.filter(k => !done.includes(k) && EP[k].need(count(plan)));
  return cands.find(k => !test(plan, k).clear) || null;
}
// まとめ：いろいろな日で ためす（燃料の日は 停電だけを見る）
const ENDS2 = [
  { k: 'p2bat', icon: '🔋', name: '電池に たよる町', when: s => s.c.battery >= 7 && !s.c.nuclear && s.c.geo < 3 && s.co2 <= 30, say: 'あまった 電気を ためて 夜も 再エネ！ でも 電池は 高く、材料は 輸入。点検で 止まったら どうする？' },
  { k: 'p2renew', icon: '🌈', name: '再エネと 蓄電池の 町', when: s => s.c.nuclear === 0 && s.c.geo < 3 && s.co2 <= 20, say: 'CO₂が 少なく 国産。でも お金と 土地が たくさん 必要だった。' },
  { k: 'p2weak', icon: '🌦️', name: 'そなえの たりない町', when: s => s.fails >= 2, say: '地震・燃料・天気…どれかが おきると 停電する町。1つに たよりすぎて いない？' },
  { k: 'p2nuke', icon: '⚛️', name: '原子力に たよる町', when: s => s.c.nuclear >= 2 || (s.c.nuclear >= 1 && s.self >= 80 && s.c.thermal <= 1), say: 'CO₂が 少なく 安定。でも 安全への 不安と 廃棄物の 課題が のこる。止まった ときの そなえは？' },
  { k: 'p2fossil', icon: '🚢', name: '輸入燃料に たよる町', when: s => s.co2 > 45, say: '安定して 建設も 安い。でも 燃料が 届かないと ピンチ。CO₂も 多い。' },
  { k: 'p2geo', icon: '♨️', name: '地熱の 町', when: s => s.c.geo >= 3, say: '足もとの 熱で 安定した 国産の 電気。温泉の 人との 話し合いが 大切だった。' },
  { k: 'p2mix', icon: '⚖️', name: 'ミックス名人の町', when: () => true, say: 'いろいろな 電源を 組み合わせて、どの 日も のりきれる町。これが「エネルギーミックス」！' }
];
function finalWeek(plan) {
  return ORDER.map(k => { const r = test(plan, k); return { k, r, ok: !r.hours.length }; });
}
const WEEK2 = ['factory', 'rainy', 'calm2', 'quake', 'import'];
function judge2(plan, money, week) {
  const wk = (week || WEEK2).map(k => { const r = test(plan, k); return { k, r, ok: !r.hours.length }; }), fails = wk.filter(d => !d.ok).length;
  const avg = f => Math.round(wk.reduce((a, d) => a + f(d.r), 0) / wk.length * 10) / 10;
  const co2 = Math.round(avg(r => r.co2)), self = Math.round(avg(r => r.self)), safe = avg(r => r.safe), c = count(plan);
  const people = (plan.people || 0) - wk[0].r.warn - (plan.save ? 1 : 0);
  const s = { wk, fails, co2, self, safe, money, people, save: plan.save, c, part: 2 };
  const n = wk.length, pri = (st && st.pri) || [];
  s.stars = [{ id: 'stab', k: '⚡', name: '安定', goal: `停電なしの 日 ${n}/${n}`, ok: !fails, v: n - fails, lo: 0, hi: n, g: n, fmt: v => `${v}/${n}日` },
    { id: 'env', k: '🌏', name: '環境', goal: '🔥の わりあい 40%以下', ok: co2 <= 40, v: co2, lo: 0, hi: 100, g: 40, low: true, fmt: v => `🔥${v}%` },
    { id: 'econ', k: '💴', name: '経済', goal: 'お金を 🪙80以上 のこす', ok: money >= 80, v: money, lo: 0, hi: 300, g: 80, fmt: v => `🪙${v}` },
    { id: 'safe', k: '🛡️', name: '安全', goal: '安全性 3.8以上', ok: safe >= 3.8, v: safe, lo: 1, hi: 5, g: 3.8, fmt: v => v.toFixed(1) },
    { id: 'self', k: '🗾', name: '自給', goal: '国産の 電気 60%以上', ok: self >= 60, v: self, lo: 0, hi: 100, g: 60, fmt: v => `${v}%` }];
  s.stars.forEach(x => { x.pri = pri.includes(x.id); });
  s.pri = pri; s.priOk = s.stars.filter(x => x.pri && x.ok).length;
  s.end = ENDS2.find(e => e.when(s));
  return s;
}
function judge(plan, money) {
  if (st && st.part === 3) return judge2(plan, money, WEEK3);
  if (st && st.part === 2) return judge2(plan, money);
  const wk = finalWeek(plan), fails = wk.filter(d => !d.ok).length;
  const co2 = Math.round(wk.reduce((a, d) => a + d.r.co2, 0) / wk.length);
  const fuel = Math.round(wk.reduce((a, d) => a + d.r.fuel, 0));
  const s = { wk, fails, co2, fuel, money, save: plan.save };
  const n = wk.length;
  s.stars = [{ id: 'stab', k: '⚡', name: '安定', goal: 'どんな日も 停電なし', ok: !fails, v: n - fails, lo: 0, hi: n, g: n, fmt: v => `${v}/${n}日` },
    { id: 'env', k: '🌏', name: '環境', goal: '🔥の わりあい 41%以下', ok: co2 <= 41, v: co2, lo: 0, hi: 100, g: 41, low: true, fmt: v => `🔥${v}%` },
    { id: 'econ', k: '🪙', name: 'お金', goal: '🪙60以上 のこす', ok: money >= 60, v: money, lo: 0, hi: BUDGET, g: 60, fmt: v => `🪙${v}` }];
  s.end = ENDS.find(e => e.when(s));
  return s;
}

/* ---------- 3D：小さな町のジオラマ ---------- */
let R3 = null;
const SLOT = {
  solar: [], battery: [],
  thermal: [[96, -58], [96, -18], [96, 22], [96, 62], [70, 84]],
  wind: [[140, -84], [140, -48], [140, -12], [140, 24], [140, 60], [140, 96], [-150, -86], [-118, -98], [-86, -104]],
  nuclear: [[112, 104], [122, -110], [150, 70]],
  geo: [[-128, -62], [-92, -74], [-165, -48], [-60, -100], [-150, -100]]
};
for (let z = -18; z <= 74; z += 23) for (let x = -150; x >= -150 && x <= -62; x += 22) SLOT.solar.push([x, z]);
for (let z = 46; z <= 100; z += 18) for (let x = -44; x <= 14; x += 19) SLOT.battery.push([x, z]);
const SCALE = { solar: 0.42, battery: 0.5, thermal: 0.62, wind: 0.48, hydro: 0.62, nuclear: 0.5, geo: 0.55 };
function build3D(host) {
  const W3 = EC.W3, mesh = W3.mesh, toy = W3.toy, rb = W3.roundedBox;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.outputColorSpace = T.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(30, 1, 5, 9000);
  const hemi = new T.HemisphereLight('#EAF4FF', '#B9A88E', 1.4), sun = new T.DirectionalLight('#FFF4E2', 2.4);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -260, right: 260, top: 220, bottom: -220, near: 50, far: 1400 }); sun.shadow.camera.updateProjectionMatrix();
  scene.add(hemi, sun, sun.target);
  // 海・島・砂浜・川・丘
  const sea = mesh(rb(5000, 6, 5000, 30), toy('#4FB0E8', { roughness: 0.08, clearcoat: 1 }), 0, -22, 0); sea.castShadow = false; scene.add(sea);
  scene.add(mesh(rb(360, 20, 250, 14), toy('#C9A27A', { roughness: 0.8 }), -10, -14, 0));
  scene.add(mesh(rb(352, 8, 242, 12), toy('#86CF6A', { roughness: 0.7 }), -10, -4, 0));
  scene.add(mesh(rb(60, 9, 242, 10), toy('#F2DDA4', { roughness: 0.8 }), 140, -4.4, 0));
  const river = mesh(rb(16, 2, 150, 6), toy('#5DB8F2', { roughness: 0.1, clearcoat: 1 }), -40, 0.2, 40); river.rotation.y = 0.18; scene.add(river);
  const hill = mesh(new T.SphereGeometry(60, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), toy('#5FAF57', { roughness: 0.8 }), -110, -1, -100); hill.scale.set(1.6, 0.55, 0.8); scene.add(hill);
  // 道と家
  scene.add(mesh(rb(150, 1.2, 14, 5), toy('#E8EDF3'), 30, 0.4, 8));
  scene.add(mesh(rb(14, 1.2, 120, 5), toy('#E8EDF3'), 30, 0.45, 0));
  const houses = [[0, -26], [55, -30], [-4, 34], [56, 34], [28, -66], [-18, -58], [72, -64], [38, 72], [62, -100], [-8, -98]].map(([x, z], i) => {
    const h = W3.makeHouse({ col: i * 3 + 1 }); h.scale.setScalar(0.78); h.position.set(x, 0, z); h.rotation.y = i % 2 ? -0.2 : 0.15; scene.add(h);
    return h;
  });
  const winLit = W3.std('#FFE7A0', { emissive: '#FFB84A', emissiveIntensity: 1.3 }), winOff = W3.std('#2E3442', { roughness: 0.4 }), winDayM = houses[0].userData.wins[0].material;
  [[-20, -86], [-60, -60], [84, -96], [-30, 104], [70, 104], [-160, 104], [10, -100], [-120, -40]].forEach(([x, z], i) => { const t = W3.makeTree({ r: i + 2, c: i * 3 + 1 }); t.scale.multiplyScalar(0.7); t.position.set(x, 0, z); scene.add(t); });
  // 水力発電（はじめから あるダム）
  const hydro = W3.makeChara({ type: 'hydro', id: 99 }, false); hydro.root.scale.setScalar(SCALE.hydro); hydro.root.position.set(-50, 0, -60); scene.add(hydro.root);
  // チャッピー（町長）
  const factory = W3.makeFactory ? W3.makeFactory() : new T.Group(); factory.scale.setScalar(0.85); factory.position.set(-105, 0, -36); factory.rotation.y = 0.3; factory.visible = false; scene.add(factory);
  const cp = W3.makeChappy(); cp.g.scale.setScalar(0.22); cp.g.position.set(-30, 1, 80); cp.g.rotation.y = 0.1; scene.add(cp.g);
  // くも
  const clouds = new T.Group(); scene.add(clouds);
  for (let i = 0; i < 7; i++) {
    const cg = new T.Group();
    [[0, 0, 22], [20, -3, 16], [-18, -4, 15], [8, 8, 15]].forEach(([x, y, r]) => cg.add(mesh(new T.SphereGeometry(r, 16, 12), toy('#FFFFFF', { roughness: 0.9 }), x, y, 0, false)));
    cg.position.set(-180 + i * 62, 120 + (i % 3) * 14, -60 + (i % 2) * 80); clouds.add(cg);
  }
  const resize = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(host); resize();
  R3 = { renderer, scene, camera, hemi, sun, houses, factory, hydro, cp, clouds, ro, winLit, winOff, winDayM, charas: [], host, raf: 0, last: performance.now(), sky: 'sunny', hour: 12, view: null, mood: 'normal', jump: 0,
    cam: { th: 0, ph: 0.6, zoom: 1, idle: 99, r: 0, off: 0 } };
  orbitControls(renderer.domElement);
  R3.raf = requestAnimationFrame(loop3D);
}
function dispose3D() {
  if (!R3) return;
  cancelAnimationFrame(R3.raf); R3.ro.disconnect(); R3.renderer.dispose(); R3.renderer.domElement.remove(); R3 = null;
}
// 町の発電所を いまの計画に そろえる（新しいものは ぴょこっと出る）
function syncTown(c, part) {
  if (!R3) return;
  if (part) { const PT = PART[part]; R3.houses.forEach((h, i) => { h.visible = i < PT.houses; }); R3.factory.visible = PT.factories > 0; }
  const want = [];
  Object.entries(c).forEach(([k, n]) => { for (let i = 0; i < n && i < SLOT[k].length; i++) want.push(k + i); });
  R3.charas = R3.charas.filter(ch => { if (want.includes(ch.key)) return true; R3.scene.remove(ch.rig.root); return false; });
  let fresh = 0;
  want.forEach(key => {
    if (R3.charas.some(ch => ch.key === key)) return;
    const k = key.replace(/\d+$/, ''), i = +key.match(/\d+$/)[0], [x, z] = SLOT[k][i];
    const rig = EC.W3.makeChara({ type: k, id: i + 3 }, k === 'battery');
    rig.root.position.set(x, 0, z); rig.root.rotation.y = k === 'wind' ? -0.6 : k === 'thermal' ? -0.45 : 0.25;
    rig.root.scale.setScalar(0.001); R3.scene.add(rig.root);
    R3.charas.push({ key, k, rig, id: i + 3, pop: -fresh * 0.12 }); fresh++;
  });
  if (fresh) sfx('built');
}
const sunEl = h => Math.max(0, Math.sin(Math.PI * (h - 6) / 12));
const SKY = { sunny: ['#9ED2F7', '#EAF5FF'], cloudy: ['#AEB9C6', '#E3E8EE'], calm: ['#B7DDF2', '#F2F7EC'], heat: ['#F7C68A', '#FFF0D8'] };
function loop3D(now) {
  if (!R3) return;
  const dt = Math.min(0.1, (now - R3.last) / 1000); R3.last = now; const t = now / 1000;
  if (run) tickRun(dt);
  const h = R3.hour, e = sunEl(h), dayK = Math.min(1, e / 0.25), sky = R3.sky, V = R3.view;
  const dim = sky === 'cloudy' ? 0.45 : 1;
  R3.sun.position.set(-Math.cos(Math.PI * (h - 6) / 12) * 380, 60 + e * 420, 220); R3.sun.intensity = 0.15 + 2.3 * dayK * dim;
  R3.sun.color.set(sky === 'heat' ? '#FFD9A8' : '#FFF4E2'); R3.hemi.intensity = 0.35 + 1.1 * dayK;
  const [a, b] = SKY[sky] || SKY.sunny;
  R3.host.style.background = dayK > 0.05 ? `linear-gradient(180deg, ${mix(a, '#1A2448', 1 - dayK)} 0%, ${mix(b, '#3A4676', 1 - dayK)} 70%)` : 'linear-gradient(180deg,#141C3A 0%,#2E3A66 70%)';
  R3.clouds.visible = sky === 'cloudy';
  R3.clouds.children.forEach((c, i) => { c.position.x += dt * (sky === 'calm' ? 0.5 : 6); if (c.position.x > 240) c.position.x = -240; });
  // 家の明かり：夜は ともる、停電の時間は 消える
  const short = V ? V.short : 0;
  R3.houses.forEach((hs, i) => {
    const off = short > 0 && hs.visible && (i + 0.5) / R3.houses.filter(x => x.visible).length < Math.min(1, short * 1.6 + 0.2);
    hs.userData.wins.forEach(w => { w.material = off ? R3.winOff : dayK < 0.6 ? R3.winLit : R3.winDayM; });
    hs.userData.glow.material.opacity = off ? 0 : (1 - dayK) * 0.8;
  });
  // キャラ：出力と天気で うごく
  const sunDir = R3.sun.position.clone().normalize();
  const animOne = (rig, k, id, outK, mood) => {
    const b = { id, type: k, out: P[k].cap * outK, mode: 'on', warm: 1, cut: k === 'wind' && sky === 'calm' };
    if (rig.face.userData.mood !== mood) { rig.face.material = EC.W3.faceMat(k, mood); rig.face.userData.mood = mood; }
    EC.W3.animRig(rig, b, mood, t, dt, { sun: e * dim, wind: sky === 'calm' ? 0.02 : 0.45, soc: V ? V.soc : 0.5, batFlow: V && V.bat > 0 }, sunDir);
  };
  R3.charas.forEach(ch => {
    if (ch.pop < 1) { ch.pop += dt * 2.2; const p = Math.max(0, ch.pop), s = SCALE[ch.k] * (p >= 1 ? 1 : 1 + Math.sin(p * Math.PI) * 0.35) * Math.min(1, p * 1.4); ch.rig.root.scale.setScalar(Math.max(0.001, s)); }
    const outK = V ? V.out[ch.k] || 0 : ch.k === 'solar' ? e : 0.5;
    let mood = 'normal';
    if (ch.k === 'solar' && e < 0.03) mood = 'sleep';
    else if (ch.k === 'wind' && sky === 'calm') mood = 'sad';
    else if (ch.k === 'solar' && sky === 'cloudy') mood = 'sad';
    else if (short > 0) mood = outK > 0.6 ? 'sweat' : 'ouch';
    else if (ch.k === 'thermal' && outK > 0.7) mood = 'sweat';
    else if (outK > 0.3 || ch.k === 'battery') mood = 'happy';
    animOne(ch.rig, ch.k, ch.id, outK, mood);
  });
  animOne(R3.hydro, 'hydro', 99, 0.8, short > 0 ? 'sweat' : 'normal');
  R3.jump = Math.max(0, R3.jump - dt);
  R3.cp.update(t, dt, { mood: R3.mood === 'happy' ? 'happy' : 'normal', hurt: R3.mood === 'ouch' || short > 0, jump: R3.jump > 0, wave: R3.mood === 'happy' });
  camera3D(dt);
  R3.renderer.render(R3.scene, R3.camera);
  R3.raf = requestAnimationFrame(loop3D);
}
// カメラ：島が「上のバー」と「下のカード」のあいだに ちょうど 入るように 距離と位置を 合わせる
function camera3D(dt) {
  const cm = R3.cam, host = R3.host, w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
  cm.idle += dt;
  if (R3.spin && cm.idle > 3) cm.th += dt * 0.15;     // まとめでは ゆっくり 回る（さわると 止まる）
  const panel = [root.querySelector('#stCard'), root.querySelector('#stHud')].find(e => e && !e.hidden);
  const bottom = panel ? (cm.bottom = panel.offsetHeight + 24) : (cm.bottom || 12),   // パネルが 一瞬 消えても カメラは 動かさない
    topH = 64, freeH = Math.max(h * 0.28, h - bottom - topH);
  const tn = Math.tan(T.MathUtils.degToRad(15)), sinp = Math.sin(cm.ph);
  const islandH = 250 * sinp + 60 * Math.cos(cm.ph) + 10, islandW = 370;
  const fitR = Math.max(islandW * h / (0.94 * w * 2 * tn), islandH * h / (0.94 * freeH * 2 * tn)) * cm.zoom;
  const k = Math.min(1, dt * 6);
  cm.r = cm.r ? cm.r + (fitR - cm.r) * k : fitR;
  const off = h / 2 - (topH + freeH / 2); cm.off = cm.off + (off - cm.off) * k;
  const tx = -10, ty = 15, tz = 0;
  R3.camera.position.set(tx + cm.r * Math.sin(cm.th) * Math.cos(cm.ph), ty + cm.r * sinp, tz + cm.r * Math.cos(cm.th) * Math.cos(cm.ph));
  R3.camera.lookAt(tx, ty, tz);
  R3.camera.setViewOffset(w, h, 0, cm.off, w, h);
}
// マウス・指で 回す（ドラッグ）、ホイール・ピンチで 近づく、ダブルクリックで もとにもどす
function orbitControls(el) {
  const pts = new Map(); let pinch = 0;
  el.style.touchAction = 'none'; el.style.cursor = 'grab';
  el.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; });
  el.addEventListener('pointermove', e => {
    if (!R3 || !pts.has(e.pointerId)) return;
    const [x0, y0] = pts.get(e.pointerId), cm = R3.cam; pts.set(e.pointerId, [e.clientX, e.clientY]); cm.idle = 0;
    if (pts.size === 1) { cm.th -= (e.clientX - x0) * 0.006; cm.ph = Math.max(0.12, Math.min(1.45, cm.ph + (e.clientY - y0) * 0.005)); }
    else { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) cm.zoom = Math.max(0.35, Math.min(1.8, cm.zoom * pinch / d)); pinch = d; }
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; el.style.cursor = 'grab'; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => { if (!R3) return; e.preventDefault(); R3.cam.zoom = Math.max(0.35, Math.min(1.8, R3.cam.zoom * Math.exp(e.deltaY * 0.0012))); R3.cam.idle = 0; }, { passive: false });
  el.addEventListener('dblclick', () => { if (R3) Object.assign(R3.cam, { th: 0, ph: 0.6, zoom: 1 }); });
}
function mix(a, b, k) { const A = new T.Color(a), B = new T.Color(b); return '#' + A.lerp(B, Math.max(0, Math.min(1, k))).getHexString(); }

/* ---------- 1日の早送り（3Dの町で見る） ---------- */
let run = null;
function playDay(r, c, ep, done) {
  const L = r.log, nb = Math.max(1, c.battery) * P.battery.store;
  let soc = 0; const socs = [];
  for (let i = 0; i < 24; i++) { soc = Math.max(0, Math.min(1, soc + (L.charge[i] - L.gen.battery[i]) / nb)); socs.push(soc); }
  run = { r, c, ep, done, t: 0, socs, warned: false };
  R3.sky = EP[ep].sky; R3.mood = 'normal';
  root.classList.add('playing');
  const hud = root.querySelector('#stHud'); hud.hidden = false;
  hud.innerHTML = `<div class="st-clock" id="stClock">6:00</div><canvas class="st-chart" id="stLive"></canvas><div class="st-state" id="stLiveSay"></div>${legend(r.log)}<button class="btn" id="stSkip">⏩ とばす</button>`;
  hud.querySelector('#stSkip').onclick = () => { run.t = 18; };
}
function tickRun(dt) {
  run.t = Math.min(18, run.t + dt * 2.4);
  const hour = 6 + run.t, i = Math.min(23, Math.floor(hour)), L = run.r.log, c = run.c;
  const out = {}; Object.keys(c).forEach(k => { out[k] = c[k] > 0 ? Math.min(1.2, L.gen[k][i] / (c[k] * P[k].cap)) : 0; });
  out.battery = c.battery > 0 ? Math.min(1, (L.gen.battery[i] + L.charge[i]) / (c.battery * P.battery.cap)) : 0;
  R3.hour = hour; R3.view = { short: L.short[i] > 0.02 * L.D[i] ? L.short[i] / L.D[i] : 0, out, soc: run.socs[i], bat: L.gen.battery[i] };
  const ck = root.querySelector('#stClock'); if (ck) ck.textContent = `${Math.floor(hour) % 24}:00`;
  const ls = root.querySelector('#stLiveSay'); if (ls && ls.dataset.h != i) { const [cl, tx] = hourState(L, i); ls.dataset.h = i; ls.className = 'st-state ' + cl; ls.textContent = tx; if (cl === 's-waste' && !run.wasted) { run.wasted = true; sfx('bad'); } }
  const cv = root.querySelector('#stLive'); if (cv) drawChart(cv, L, EP[run.ep].win, i + 1);
  if (R3.view.short && !run.warned) { run.warned = true; sfx('black'); }
  if (run.t >= 18) {
    const d = run.done; run = null; R3.view = null; R3.hour = 13;
    root.classList.remove('playing'); root.querySelector('#stHud').hidden = true;
    d();
  }
}

/* ---------- 画面 ---------- */
let root = null, onBack = null, st;
const sfx = n => EC.Audio && EC.Audio.sfx(n);
// ⚡ 大きさ：グラフの「使う 量」と 同じ ものさしで、晴れの 昼と 夜に 出せる 量（☀️は 晴れの 昼の いちばん 多い とき・💨は ふつうの 風・💧は 設備利用率・🔋は ためた 分が ある あいだ）
const OUT1 = { solar: [P.solar.cap * C.solarPeak, 0], wind: [P.wind.cap * C.windBase, P.wind.cap * C.windBase], hydro: [P.hydro.cap * C.hydroCF, P.hydro.cap * C.hydroCF],
  geo: [P.geo.cap, P.geo.cap], nuclear: [P.nuclear.cap, P.nuclear.cap], thermal: [P.thermal.cap, P.thermal.cap], battery: [P.battery.cap, P.battery.cap] };
function scaleOf(b) {
  let d = 0, n = 0; Object.entries(b || {}).forEach(([k, c]) => { if (OUT1[k] && c > 0) { d += OUT1[k][0] * c; n += OUT1[k][1] * c; } });
  return { d: Math.round(d), n: Math.round(n), bat: !!(b && b.battery > 0) };
}
const scaleHTML = b => { const x = scaleOf(b), k0 = Object.keys(b || {}).find(k => OUT1[k] && b[k] > 0); return x.d || x.n ? `<span class="st-scale" data-real="${k0}" data-b='${JSON.stringify(b)}' title="📏 タップで ほんとうの 大きさ（写真）"><em>☀️昼 ⚡${x.d}</em><em class="${x.n ? '' : 'zero'}">🌙夜 ⚡${x.n}${x.bat ? '<small>🔋は ためた 分</small>' : ''}</em><em class="rs-q">📏</em></span>` : ''; };
const icons = b => Object.entries(b || {}).map(([k, n]) => n < 0 ? `<span class="st-ic minus"><img src="${EC.charaIcon(k)}" alt="">✖${-n}</span>` : `<span class="st-ic"><img src="${EC.charaIcon(k)}" alt="">×${n}</span>`).join('');
function open(back) {
  onBack = back; root = document.createElement('div'); root.id = 'story';
  root.innerHTML = '<div id="stView"></div><div class="st-top" id="stTop"></div><div class="st-hud" id="stHud" hidden></div><div class="st-card" id="stCard"></div>';
  document.body.appendChild(root);
  try { build3D(root.querySelector('#stView')); } catch (e) { R3 = null; }
  EC.Audio && EC.Audio.setMood && EC.Audio.setMood('day');
  partMenu();
}
// 部を えらぶ（第1部 → 第2部 → 第3部）
const partsDone = () => { try { return JSON.parse(localStorage.getItem('ec.story.parts') || '{}'); } catch (e) { return {}; } };
function markPart(n) { const d = partsDone(); d[n] = true; try { localStorage.setItem('ec.story.parts', JSON.stringify(d)); } catch (e) {} }
function partMenu() {
  run = null; st = null;
  if (R3) { R3.spin = true; R3.sky = 'sunny'; R3.hour = 13; R3.mood = 'happy'; R3.view = null; }
  syncTown(count(newPlan(1)), 1);
  const done = partsDone();
  root.querySelector('#stTop').innerHTML = '<button id="stBack">◀ もどる</button><b class="st-no">📘 シナリオ</b>';
  root.querySelector('#stBack').onclick = close;
  root.querySelector('#stHud').hidden = true;
  const c = root.querySelector('#stCard'); c.hidden = false; c.className = 'st-card'; void c.offsetWidth; c.classList.add('pop');
  c.innerHTML = `<div class="st-banner"><small>📘 シナリオ</small><b>町の 電気を まかされた！</b><span>第1部から 第4部へ すすむと、日本の エネルギー大臣に！</span></div>`
    + `<div class="st-parts">${[1, 2, 3, 4].map(n => `<button class="st-part ${done[n] ? 'done' : ''}" data-p="${n}"><i>${PART[n].icon}</i><small>第${n}部　⏱ 約${PART[n].min}分</small><b>${PART[n].name}</b><span>${PART[n].desc}</span><em>${done[n] ? '✅ クリア' : n > 1 && !done[n - 1] ? `おすすめ：第${n - 1}部の あと` : '▶ はじめる'}</em></button>`).join('')}</div>`
    + `<div class="st-tools"><label class="st-sw"><input type="checkbox" id="stTalk" ${EC.Talk.on() ? 'checked' : ''}><span>👥 話し合いタイム（授業用）</span></label><button class="btn" id="stRep">📝 学習レポート（PDF）</button></div>`;
  c.querySelectorAll('.st-part').forEach(b => b.onclick = () => { sfx('pick'); const n = +b.dataset.p; if (n === 4) part4(); else start(n); });
  c.querySelector('#stTalk').onchange = e => { EC.Talk.set(e.target.checked); sfx('tap'); };
  c.querySelector('#stRep').onclick = () => { sfx('tap'); EC.Report.open(); };
}
// 第4部：大作戦3Dの「リアル日本」へ（おわったら シナリオに もどる）
function part4() {
  const back = onBack; onBack = null; close();
  // 第3部（なければ 第2部）の 公約を 日本へ もっていく。大作戦3Dの「リアル日本」とは 別の 流れ
  const pl = EC.Log.all().filter(e => e.t === 'pledge' && e.pri && e.pri.length === 3 && e.part <= 3).sort((a, b) => (a.part === 3) - (b.part === 3)).pop();
  EC.Japan.open(() => EC.Story.open(back), { mode: 'p4', pri: pl ? pl.pri.slice() : null, onDone: () => markPart(4) });
}
function close() { dispose3D(); run = null; root.remove(); root = null; if (onBack) onBack(); }
function start(part) {
  part = typeof part === 'number' ? part : (st && st.part) || 1;
  const PT = PART[part];
  st = { part, plan: newPlan(part), done: [], ep: PT.first, no: 1, money: PT.budget, tickets: TICKETS, pred: [0, 0], log: [], learn: { peak: 0, short: 0, curt: 0, charge: 0, empty: 0 } };
  if (R3) { R3.spin = false; Object.assign(R3.cam, { th: 0, ph: 0.6, zoom: 1 }); R3.sky = 'sunny'; R3.hour = 13; }
  syncTown(count(st.plan), part);
  if (part === 3) return pledge(design);
  if (part === 2) return pledge(() => showEp(true));
  showEp(true);
}
/* ---------- 📣 公約：大事に する 3つを 自分で 決める（★は 公約を 守れたかで つく）---------- */
const PLEDGE = [['stab', '⚡', '安定', '停電しない'], ['env', '🌏', '環境', 'CO₂を へらす'], ['econ', '💴', '経済', 'お金を のこす'], ['safe', '🛡️', '安全', '事故・災害に 強い'], ['self', '🗾', '自給', '輸入に たよらない']];
const priIcons = pri => (pri || []).map(k => PLEDGE.find(x => x[0] === k)[1]).join('');
function pledge(then) {
  if (EC.Story.fast) { st.pri = st.pri || ['stab', 'env', 'econ']; return then(); }
  const pick = [];
  const c = card(`<div class="st-banner"><small>第${st.part}部の はじめに</small><b>📣 町長の 公約</b><span>大事に する ものを 3つ えらぼう</span></div>`
    + say(['5つ ぜんぶ 満点は とても むずかしい。', 'きみが <b>大事に したい 3つ</b>を 町の 人に 約束しよう。さいごに 守れたか 見るよ！'], 'happy')
    + `<div class="st-pledge">${PLEDGE.map(([k, ic, nm, d]) => `<button data-k="${k}"><i>${ic}</i><b>${nm}</b><small>${d}</small><em></em></button>`).join('')}</div>
    <div class="row2"><button class="btn go" id="stPl" disabled>📣 この 3つを 約束する</button></div>`);
  c.querySelectorAll('.st-pledge button').forEach(b => b.onclick = () => {
    const k = b.dataset.k, i = pick.indexOf(k);
    if (i >= 0) pick.splice(i, 1); else if (pick.length < 3) pick.push(k); else { sfx('bad'); return; }
    sfx('tap');
    c.querySelectorAll('.st-pledge button').forEach(x => { const j = pick.indexOf(x.dataset.k); x.classList.toggle('on', j >= 0); x.querySelector('em').textContent = j >= 0 ? '✔' : ''; });
    c.querySelector('#stPl').disabled = pick.length < 3;
  });
  c.querySelector('#stPl').onclick = () => { st.pri = pick.slice(); sfx('star'); EC.Log.add({ t: 'pledge', part: st.part, pri: st.pri }); then(); };
}
function top() {
  root.querySelector('#stTop').innerHTML = `<button id="stBack">◀ もどる</button><b class="st-no">📘 第${st.part}部・${st.part === 3 ? '設計' : `第${st.no}話`}</b>${st.pri ? `<span class="st-chip">📣 ${priIcons(st.pri)}</span>` : ''}
    ${st.part === 3 ? '' : `<span class="st-chip money">🪙 ${st.money}</span><span class="st-chip">🎫 やりなおし ${st.tickets}</span>`}
    <span class="st-path">${st.plan.steps.map(s => `<em>${s}</em>`).join('<i>▸</i>')}</span>`;
  root.querySelector('#stBack').onclick = () => { sfx('tap'); partMenu(); };
}
function card(html, cls) {
  top();
  const c = root.querySelector('#stCard'); c.className = 'st-card ' + (cls || ''); c.innerHTML = html; c.scrollTop = 0;
  c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
  return c;
}
const say = (lines, mood) => `<div class="st-talk ${mood || ''}"><div class="st-cp">${Chappy2D.svg(mood === 'happy' ? 'happy' : mood === 'ouch' ? 'ouch' : 'normal', mood === 'happy' ? 'wave' : '')}</div><div class="st-say">${lines.join('<br>')}</div></div>`;
function goalText(E) { return E.ok ? `停電なし ＋ ${E.okText}` : `${E.win[0]}〜${E.win[1]}時に 停電しない`; }

/* ---------- 全画面の 演出（大きく・それだけを 見せる。タップで とばせる） ---------- */
function fx(kind, o, then) {
  const el = document.createElement('div'); el.className = 'st-fx ' + kind; root.appendChild(el);
  let done = false;
  const end = () => { if (done) return; done = true; el.classList.add('out'); setTimeout(() => el.remove(), 260); then && then(); };
  const confetti = n => [...Array(n)].map((_, i) => `<i class="cf" style="left:${Math.random() * 100}%;background:${['#F5B301', '#EB4B43', '#2FC1DA', '#34B56A', '#7B5CC4', '#FF7FB6'][i % 6]};animation-delay:${Math.random() * 0.6}s;animation-duration:${1.6 + Math.random() * 1.2}s;transform:rotate(${Math.random() * 360}deg)"></i>`).join('');
  let ms = 2400;
  if (kind === 'ep') {
    el.innerHTML = (o.alert ? '<div class="tape t1"></div><div class="tape t2"></div><div class="fx-alert">⚠️ 新しい 課題が 発生！</div>' : '')
      + `<div class="fx-no">第${o.no}話</div><div class="fx-icon">${o.icon}</div><div class="fx-title">${o.title}</div><div class="fx-goal">🎯 ${o.goal}</div>`;
    sfx(o.alert ? 'alarm' : 'epStart'); ms = o.alert ? 3000 : 2300;
  } else if (kind === 'drum') {
    el.innerHTML = '<div class="fx-drum">けっかは<span>.</span><span>.</span><span>.</span></div>'; sfx('drumroll'); ms = 1350;
  } else if (kind === 'clear') {
    el.innerHTML = `<div class="rays"></div><div class="fx-big">クリア！</div><div class="fx-sub">${o.sub}</div>${confetti(70)}`;
    sfx('clearBig'); ms = 2800;
  } else if (kind === 'fail') {
    el.innerHTML = `<div class="fx-bulb">💡</div><div class="fx-big">しっぱい…</div><div class="fx-sub">${o.sub}</div>`;
    sfx('failBig'); root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake'); ms = 2900;
  } else if (kind === 'ending') {
    el.innerHTML = `<div class="rays soft"></div><div class="fx-no">エンディング</div><div class="fx-icon">${o.icon}</div><div class="fx-title">${o.name}</div>${o.party ? confetti(90) : ''}`;
    sfx('ending'); ms = 3200;
  }
  // ドラムロール以外は タップするまで 出しておく（少し たってから「タップで すすむ」）
  if (kind === 'drum') { el.onclick = end; setTimeout(end, ms); }
  else { let ready = false; setTimeout(() => { ready = true; el.insertAdjacentHTML('beforeend', '<div class="fx-next">👆 タップで すすむ</div>'); }, Math.min(ms, 1600)); el.onclick = () => { if (ready) end(); }; }
}
// ① 課題
function showEp(intro) {
  const E = EP[st.ep];
  if (intro && !EC.Story.fast) { if (R3) { R3.sky = E.sky; R3.hour = st.ep === 'night' ? 20 : 13; } return fx('ep', { no: st.no, icon: E.icon, title: E.title, goal: goalText(E), alert: st.no > 1 }, () => showEp()); }
  if (R3) { R3.sky = E.sky; R3.hour = st.ep === 'night' ? 20 : 13; R3.mood = st.ep === 'day' ? 'happy' : 'ouch'; }
  const pre = st.ep === 'day' ? null : test(st.plan, st.ep);
  const c = card(`<div class="st-banner"><small>第${st.no}話</small><b>${E.icon} ${E.title}</b><span>🎯 クリア：${goalText(E)}</span></div>`
    + say(E.intro, st.ep === 'day' ? 'happy' : 'ouch')
    + (pre ? `<div class="st-now"><span>いまの 町だと…　<b class="ng">${pre.hours.length ? `⚡ ${ranges(pre.hours)} に 停電` : `💸 燃料代 ${Math.round(pre.fuel)}🪙`}</b></span><button class="btn mini" id="stWatch">▶ 3Dで 見る</button></div>` : '')
    + `<p class="st-scalecap">⚡＝ 出せる 電気の 量（グラフの「使う 量」と 同じ ものさし）。<b>☀️昼</b>＝晴れの 昼の いちばん 多い とき、<b>🌙夜</b>＝夜。<b>📏</b>を タップ → ほんとうの 発電所の 大きさ（写真）</p>`
    + `<div class="st-opts">${optList(E).map((o, i) => {
      const cost = optCost(o), can = cost <= st.money;
      return `<button class="st-opt ${o.none ? 'none' : ''}" data-i="${i}" ${can ? '' : 'disabled'}>
        <div class="st-ics">${o.save ? '<span class="st-ic big">📢</span>' : o.none ? '<span class="st-ic big">🤷</span>' : icons(o.build) + (o.link ? '<span class="st-ic big">🔌</span>' : '') + (o.shift ? '<span class="st-ic big">⏰</span>' : '')}</div>
        <b>${o.title}</b>${scaleHTML(o.build)}<span class="g">◎ ${o.good}</span><span class="b">△ ${o.bad}</span>
        ${o.voice ? `<div class="st-voice">${o.voice.map(([ic, who, t]) => `<span><i>${ic}</i><b>${who}</b>「${t}」</span>`).join('')}</div>` : ''}
        <span class="cost">${can ? `${o.money ? 'お金' : '建設費'} 🪙${cost}` : `🪙が たりない（${cost}）`}</span></button>`;
    }).join('')}</div>`);
  const opts = optList(E);
  c.querySelectorAll('.st-opt').forEach(b => b.onclick = () => { sfx('pick'); run1(opts[+b.dataset.i]); });
  const w = c.querySelector('#stWatch');
  if (w) w.onclick = () => { if (!R3) return; c.hidden = true; playDay(pre, count(st.plan), st.ep, () => { c.hidden = false; R3.sky = E.sky; }); };
}
// ③ 3Dで1日 → ④ 結果
function run1(o) {
  const E = EP[st.ep], base = test(st.plan, st.ep), np = withOpt(st.plan, o), r = test(np, st.ep, base.fuel), c = count(np);
  const prev = { plan: st.plan, money: st.money };
  syncTown(c);
  st.qmiss = 0;
  const fin = () => result(o, r, np, prev, base);
  if (R3 && !EC.Story.fast) { root.querySelector("#stCard").hidden = true; playDay(r, c, st.ep, () => {
    if (R3) { R3.mood = r.clear ? 'happy' : 'ouch'; R3.jump = r.clear ? 2.5 : 0; }
    const sub = r.clear ? goalText(E) : r.hours.length ? `⚡ ${ranges(r.hours)} に 停電` : `💸 ${E.okText}が できなかった`;
    fx('drum', {}, () => fx(r.clear ? 'clear' : 'fail', { sub }, () => { root.querySelector('#stCard').hidden = false; fin(); }));
  }); }
  else fin();
}
function result(o, r, np, prev, base) {
  const E = EP[st.ep], cost = optCost(o), fuel = Math.round(r.fuel);
  st.money = prev.money - cost - fuel;
  np.steps.push(`${E.icon}${r.clear ? '⭕' : '❌'}`);
  st.plan = np;
  if (R3) { R3.mood = r.clear ? 'happy' : 'ouch'; R3.jump = r.clear ? 1.5 : 0; }
  // くらべる：ほかの選択だったら？
  const opts = E.opts.concat(E.opts.includes(o) ? [] : [o]).map(x => { const p2 = withOpt(prev.plan, x), r2 = test(p2, st.ep, base.fuel); return { o: x, r: r2, cost: optCost(x), me: x === o }; });
  // 1行＝1つの ものさし。バーの 長さ＝数の 大きさ、緑＝いちばん よい・赤＝いちばん わるい
  const meta = [];   // 表を 読む 問題（tableQuiz）で 使う
  const SUB = { '🏗️ 建設費': 'はじめに 1回', '💸 燃料代': '🔥を 動かした 分。建てなくても 毎日 かかる', '🌫️ CO₂': '🔥で つくった わりあい' };
  const row = (name, f, unit, up) => { const vs = opts.map(f), mn = Math.min(...vs), mx = Math.max(...vs), top = Math.max(...vs.map(Math.abs), 1e-9);
    const ri = meta.push({ name, vs, best: up ? mx : mn, worst: up ? mn : mx }) - 1;
    return `<tr data-r="${ri}"><th>${name}${SUB[name] ? `<small>${SUB[name]}</small>` : ''}</th>${opts.map((x, i) => { const v = vs[i], cl = mn === mx ? 'mid' : v === (up ? mx : mn) ? 'lo' : v === (up ? mn : mx) ? 'hi' : 'mid';
      return `<td class="${x.me ? 'me' : ''}" data-i="${i}"><b>${unit(v)}</b><i class="mb ${cl}"><u style="width:${Math.max(4, Math.abs(v) / top * 100)}%"></u></i></td>`; }).join('')}</tr>`; };
  const rowUp = (name, f, unit) => row(name, f, unit, true);
  const nxt = st.no < PART[st.part].max ? nextEp(np, st.done.concat(st.ep), st.ep, o) : null;
  let msg;
  if (r.clear) msg = [`🎉 クリア！ ${goalText(E)}`, lesson(o, r, true)];
  else msg = [r.hours.length ? `😣 ${ranges(r.hours)} に 停電…` : `😣 燃料代 ${fuel}🪙（${E.okText}が できなかった）`, lesson(o, r, false)];
  const c = card(`<div class="st-banner small ${r.clear ? 'ok' : 'ng'}"><b>${r.clear ? '🎉 クリア！' : '😣 しっぱい…'}</b><span>${E.icon} ${E.title}</span></div>`
    + say(msg, r.clear ? 'happy' : 'ouch')
    + `<div class="st-cols"><div>
    <h4 class="st-h4">📈 この日の 電気（1時間ごと）<small>👆 タップで しらべる</small></h4>
    <canvas class="st-chart tap" id="stChart"></canvas>${legend(r.log)}
    <div class="st-read" id="stRead">👆 グラフの 柱を タップすると、その時間の ようすが わかるよ</div>
    </div><div>
    <div id="stQuiz"></div>
    <div id="stAfter" hidden>
    <h4 class="st-h4">⚖️ ほかの 選択と くらべると？</h4>
    <div class="st-tq" id="stTQ"></div>
    <div class="st-tblw"><table class="st-tbl"><tr><th></th>${opts.map(x => `<th class="${x.me ? 'me' : ''}">${x.me ? '👉 ' : ''}${x.o.title}${scaleHTML(x.o.build)}</th>`).join('')}</tr>
      <tr><th>けっか<small>${goalText(E)}</small></th>${opts.map(x => `<td class="${x.me ? 'me' : ''}"><b>${x.r.clear ? '⭕ クリア' : '❌'}</b><em class="${x.r.clear ? 'lo' : 'hi'}">${x.r.hours.length ? `停電 ${x.r.hours.length}時間` : x.r.clear ? '停電なし' : '燃料が 高い'}</em></td>`).join('')}</tr>
      ${row('🏗️ 建設費', x => x.cost, v => `🪙${v}`)}
      ${row('💸 燃料代', x => Math.round(x.r.fuel), v => `🪙${v}`)}
      ${row('🌫️ CO₂', x => x.r.co2, v => `🔥${v}%`)}
      ${st.part === 2 ? rowUp('🗾 自給', x => x.r.self, v => `${v}%`) + rowUp('🛡️ 安全', x => x.r.safe, v => v.toFixed(1)) + `<tr><th>😊 町の人</th>${opts.map(x => `<td class="${x.me ? 'me' : ''}"><b class="face">${x.r.people > 0 ? '😊' : x.r.people < 0 ? '😠' : '😐'}</b></td>`).join('')}</tr>` : ''}
    </table></div>
    <p class="st-tcap"><span class="lo">■</span> いちばん よい　<span class="hi">■</span> いちばん わるい</p>
    ${realFact(st.ep, r) ? `<div class="st-real">${realFact(st.ep, r)}</div>` : ''}
    </div></div></div>
    <div id="stAfter2" hidden>
    <div class="st-wallet">🪙 ${prev.money} − 建設費 ${cost} − 燃料代 ${fuel} = <b>のこり 🪙${st.money}</b></div>
    ${r.clear && nxt ? `<div class="st-next">📣 でも 新しい 課題が…　<b>${EP[nxt].icon} ${EP[nxt].title}</b></div>` : ''}
    <div class="row2">
      ${st.tickets > 0 ? `<button class="btn" id="stRe">🎫 やりなおす（のこり ${st.tickets}）</button>` : ''}
      <button class="btn go" id="stGo">${nxt ? `▶ 第${st.no + 1}話へ` : '🏁 まとめへ'}</button></div></div>`);
  // グラフ：タップで その時間を しらべる ＋ 気づきクイズ（グラフ探偵）
  const cv = c.querySelector('#stChart'), L = r.log, read = c.querySelector('#stRead');
  let sel = -1, mark = null, onTap = null;
  let focus = null;
  const redraw = () => drawChart(cv, L, E.win, 24, sel, mark, focus, performance.now() / 1000);
  const blink = () => { if (!focus || !cv.isConnected) return; redraw(); requestAnimationFrame(blink); };
  requestAnimationFrame(redraw);
  cv.onclick = e => {
    const h = chartHour(cv, e); if (h < 6 || h > 23) return;
    sel = h; redraw(); read.innerHTML = hourText(L, h); sfx('tap');
    if (onTap) onTap(h);
  };
  graphQuiz(c.querySelector('#stQuiz'), r, E, {
    tap: f => { onTap = f; }, mark: m => { mark = m; redraw(); }, focus: f => { const was = focus; focus = f; redraw(); if (f && !was) requestAnimationFrame(blink); },
    done: () => { onTap = null; mark = null; focus = null; redraw(); c.querySelector('#stQuiz').classList.add('done'); c.querySelector('#stAfter').hidden = false;
      tableQuiz(c, opts, meta, r, () => { c.querySelector('#stAfter2').hidden = false; }); }
  });
  const re = c.querySelector('#stRe');
  if (re) re.onclick = () => { st.tickets--; st.plan = prev.plan; st.money = prev.money; syncTown(count(st.plan)); showEp(); };
  c.querySelector('#stGo').onclick = () => {
    st.log.push({ ep: st.ep, o, clear: r.clear });
    EC.Log.add({ t: 'ep', part: st.part, no: st.no, icon: E.icon, ep: E.title, pick: o.title, clear: r.clear, hours: r.hours.length, co2: r.co2, miss: st.qmiss || 0, retry: TICKETS - st.tickets, weak: st.tq ? st.tq.weak : '' });
    st.done.push(st.ep);
    if (nxt) { st.ep = nxt; st.no++; showEp(true); } else summary();
  };
}
/* ⚖️ くらべる表を 読む：クリアしても「なんでも よい」で 終わらせない。
   ① きみの 選択の 弱点（いちばん わるい ものさし）→ ② その ものさしで いちばん よい 選択 → ③ その 選択の 弱点 を 表から さがす */
function tableQuiz(c, opts, meta, r, done) {
  const box = c.querySelector('#stTQ'), tbl = c.querySelector('.st-tbl'), me = opts.findIndex(x => x.me);
  const bad = (m, i) => m.best === m.worst ? 0 : (m.vs[i] - m.best) / (m.worst - m.best);   // 0＝いちばん よい・1＝いちばん わるい
  const cell = (ri, i) => tbl.querySelector(`tr[data-r="${ri}"] td[data-i="${i}"]`);
  const myBad = meta.map(m => bad(m, me)), top = Math.max(0, ...myBad), weakOk = ri => myBad[ri] > 0 && myBad[ri] >= Math.min(top, 0.5) - 1e-9;   // 大きく 負けている 行は どれでも 正解
  let step = 1, miss = 0, weak = -1, tries = 0;
  const finish = html => {
    tbl.classList.remove('ask');
    box.innerHTML = `<div class="st-qhead">⚖️ 表を 読もう ✅</div><div class="st-qfb ok">${html}<button class="btn go" id="stTQn">✅ わかった</button></div>`;
    box.querySelector('#stTQn').onclick = () => { sfx('tap'); box.querySelector('.st-qfb').classList.add('done'); box.querySelector('#stTQn').remove(); done(); };
    st.tq = { weak: weak >= 0 ? meta[weak].name.replace(/^\S+\s/, '') : '', miss: tries };
    EC.Log.add({ t: 'read', where: 'story', ok: tries === 0 });
  };
  if (top <= 0) return finish(r.clear ? 'きみの 選択は この 表では <b>どの ものさしも いちばん よい</b>！ でも 表に ない もの（土地・町の 人の 気持ち）は どうかな？'
    : 'この 表の 数は よい。でも <b class="ng">停電</b>した。いちばん 大事な ところで 足りなかった…');
  const ask = () => {
    tbl.classList.add('ask'); miss = 0;
    box.innerHTML = `<div class="st-qhead">⚖️ 表を 読もう <span>${step} / 2</span></div><div class="st-qask">${step === 1
      ? `${r.clear ? '🎉 クリア！ でも <b>かんぺき</b>かな？<br>' : ''}👉 きみの 選択が <b class="ng">ほかより 負けている</b> ものさしは？ 👉の 列で タップ！`
      : `<b>${meta[weak].name}</b>で いちばん よかった 選択は？ その マスを タップ！`}</div><div class="st-qfb" id="stTQfb"></div>`;
  };
  const wrong = msg => { sfx('bad'); miss++; tries++; const fb = box.querySelector('#stTQfb'); fb.className = 'st-qfb ng'; fb.innerHTML = '🤔 ' + msg; box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
    if (miss >= 2) (step === 1 ? meta.map((m, ri) => weakOk(ri) ? cell(ri, me) : null) : opts.map((x, i) => meta[weak].vs[i] === meta[weak].best ? cell(weak, i) : null)).forEach(e => e && e.classList.add('tq-hint')); };
  tbl.onclick = e => {
    const td = e.target.closest('td[data-i]'), tr = td && td.closest('tr[data-r]');
    if (!td || !tr || !tbl.classList.contains('ask')) return;
    const i = +td.dataset.i, ri = +tr.dataset.r, m = meta[ri];
    tbl.querySelectorAll('.tq-hint').forEach(x => x.classList.remove('tq-hint'));
    if (step === 1) {
      if (i !== me) return wrong('まずは <b>👉 きみの 列</b>の 中から さがそう');
      if (!weakOk(ri)) return wrong(myBad[ri] > 0 ? `${m.name}は すこしだけ 負けている。もっと <b class="ng">大きく 負けている</b> ものさしは？` : `${m.name}は きみが いちばん よい！ ほかより 負けている ものさしは？`);
      sfx('right'); weak = ri; td.classList.add('tq-me'); step = 2; return ask();
    }
    if (ri !== weak) return wrong(`<b>${meta[weak].name}</b>の 行の 中から さがそう`);
    if (m.vs[i] !== m.best) return wrong(`もっと よい 選択が あるよ（<b class="ok">緑の バー</b>）`);
    sfx('right'); td.classList.add('tq-x');
    const x = opts[i], xb = meta.map(mm => bad(mm, i)), xt = Math.max(0, ...xb), xw = xt > 0 ? meta.map((mm, k) => k).filter(k => xb[k] >= xt - 1e-9) : [];
    xw.forEach(k => cell(k, i).classList.add('tq-xw'));
    const but = !x.r.clear ? `でも <b class="ng">${x.r.hours.length ? '停電した' : '燃料代が 高い まま'}</b>。` : xw.length ? `でも <b class="ng">${xw.map(k => meta[k].name).join('・')}</b>が わるい。` : 'この 表では こちらの ほうが よさそう。次は くらべて えらぼう。';
    const tipW = meta[weak].name === '💸 燃料代' ? `<small>💡 ${opts[me].cost ? '' : '何も 建てなくても、'}今 ある 🔥が 動くかぎり 燃料代は 毎日 かかる（建設費は はじめに 1回だけ）。</small>` : '';
    finish(`そう！ <b>${x.o.title}</b>は ${m.name}が いちばん よい。${but}<br>⚖️ <b>どの 選択にも よい ところと 弱点が ある</b>。何を 大事に するかで 答えが かわる！${tipW}`);
  };
  ask();
}
// あまった 電気の 使いみち（🔋だけが 答えでは ない。どれにも 弱点が ある）
const WAYS = [['🔋', 'ためる', '夜に 使える', '高い・数時間分だけ・材料は 輸入・火事に 注意', '家や 発電所の 蓄電池、揚水発電'],
  ['⏰', '時間を ずらす', 'お金が ほぼ いらない', 'みんなの 協力が いる・ずらせる 量に 限り', '昼に お湯を わかす・電気自動車を 昼に 充電'],
  ['🔌', 'ほかの 地域へ 送る', 'ためなくて よい', '送電線を つくる お金・一度に 送れる 量に 限り・相手の 地域も あまっていると 送れない', '送電線で つながった となりの 町や 地方へ。九州で あまった ☀️の 電気を 本州へ'],
  ['🗑️', '少し すてる', 'いちばん 安い ことも', 'もったいない', '九州の 出力制御']];
const wayCards = () => `<div class="st-way">${WAYS.map(([ic, nm, gd, bd, ex]) => `<div><i>${ic}</i><b>${nm}</b><span class="g">⭕ ${gd}</span><span class="b">⚠️ ${bd}</span><span class="ex">例：${ex}</span></div>`).join('')}</div>`;
// 🌏 ほんとうの 日本では（ゲームの 町と 本物を つなぐ 1行）
function realFact(ep, r) {
  if (r && r.log && r.log.curt.some((v, i) => v > 0.3 && i >= 9 && i <= 15) && !['quake', 'import'].includes(ep)) return '🌏 <b>九州</b>では 春の 晴れた 昼に ☀️の 電気が あまり、毎年 <b>出力制御（すてる）</b>が おきている';
  return { night: '🌏 日本では 夜の 電気を 🔥火力と <b>💧揚水発電</b>（水を くみ上げて ためる 大きな 電池）で ささえている',
    cloud: '🌏 電力会社は <b>天気予報</b>を 見て、前の日から 発電の 計画を 立てている', rainy: '🌏 電力会社は <b>天気予報</b>を 見て、前の日から 発電の 計画を 立てている',
    calm: '🌏 日本の 💨風力は まだ <b>約1%</b>。海の 上の <b>洋上風力</b>を ふやす 計画', fuel: '🌏 2022年、世界の 燃料が 値上がりして 日本の <b>電気代が 大きく 上がった</b>',
    import: '🌏 日本は 原油の <b>約95%を 中東</b>から 輸入している', heat: '🌏 2022年6月、猛暑で 東京エリアに はじめての <b>「需給ひっ迫注意報」</b>',
    quake: '🌏 2018年9月 <b>北海道胆振東部地震</b>。大きな 🔥が 止まり 北海道 全体が <b>ブラックアウト</b>', factory: '🌏 工場や データセンターが ふえ、日本の 電気は <b>これから ふえる</b> と 予想されている',
    onsen: '🌏 日本の 地熱資源は <b>世界3位</b>。でも 多くが 国立公園や 温泉地の 近く', co2goal: '🌏 日本は <b>2050年</b>に CO₂の 排出を 実質ゼロに する 目標' }[ep] || '';
}
// 選んだものから わかること（その場の ふりかえり）
function lesson(o, r, ok) {
  const c = count(st.plan);
  if (!ok && r.hours.some(h => h >= 18) && !c.thermal && c.battery) return '🔋が 夜の とちゅうで 空っぽに… グラフで 何時に なくなったか しらべよう！';
  if (!ok && r.hours.some(h => h >= 18)) return '日が しずんだ あと、電気を 出せる 電源が たりない。';
  if (!ok && r.hours.length) return '昼でも たりない時間が あった。発電の 量が 足りない？';
  if (!ok) return '🔥が 動いているかぎり 燃料代は かかる。🔥を へらすには？';
  if (r.co2 > 50) return 'でも 電気の 半分以上を 🔥で つくった。CO₂と 燃料代が 気になる…';
  if (r.save) return 'でも 町の人には がまんして もらったね。';
  if (optCost(o) >= 100) return 'でも 建てる お金が たくさん かかった。のこりの 🪙に 注意！';
  return `気をつけたいのは「${o.bad}」こと。`;
}
/* ---------- グラフを しらべる ---------- */
const rd = v => Math.round(v);
const isShort = (L, i) => L.short[i] > 0.02 * L.D[i];
// その時間の ようす（ことばで）
function hourState(L, i) {
  if (isShort(L, i)) return ['s-ng', `⬛ つくる ＜ 使う → ${rd(L.short[i])} たりない！ 停電`];
  if (L.imp && L.imp[i] > 0.3) return ['s-use', `🔌 たりない ${rd(L.imp[i])} を となり町から 買った`];
  if (L.curt[i] > 0.3) return ['s-waste', `🗑️ つくりすぎて ${rd(L.curt[i])} あまり → ためる 場所が なくて すてた`];
  if (L.exp && L.exp[i] > 0.3) return ['s-save', `🔌 あまった ${rd(L.exp[i])} を となり町へ 送った`];
  if (L.charge[i] > 0.3) return ['s-save', `🔋 あまった ${rd(L.charge[i])} を 蓄電池に ためた`];
  if (L.gen.battery[i] > 0.3) return ['s-use', `🔋 ためた 電気を ${rd(L.gen.battery[i])} 出して 使った`];
  return ['s-ok', '✅ つくる ＝ 使う。ぴったり！'];
}
function hourText(L, i) {
  const made = C.stack.filter(k => L.gen[k][i] > 0.3).map(k => `${P[k].icon}${rd(L.gen[k][i])}`).concat(L.imp && L.imp[i] > 0.3 ? [`🔌${rd(L.imp[i])}`] : []).join(' ＋ ') || 'なし';
  const [cl, s] = hourState(L, i);
  return `<b>${i}時</b>　⚡使う 量 <b>${rd(L.D[i])}</b>　／　つくった ${made}<div class="st-state ${cl}">${s}</div>`;
}
function chartHour(cv, e) {
  const r = cv.getBoundingClientRect(), bw = (r.width - 8) / 18;
  return 6 + Math.floor((e.clientX - r.left - 4) / bw);
}
// 🔍 グラフ探偵：グラフから 自分で 気づく 問題（その日の グラフに 合わせて えらぶ）
function graphQuiz(box, r, E, api) {
  const L = r.log, H = [...Array(18)].map((_, i) => i + 6), lr = st.learn;
  const peak = H.reduce((a, i) => L.D[i] > L.D[a] ? i : a, 6);
  const shortH = H.filter(i => isShort(L, i)), outWin = shortH.every(i => i < E.win[0] || i >= E.win[1]);
  // すてた 電気：☀️💨が 発電している 時間だけを 見る（夜に 🔥の 最低出力で あまる 分は べつ）
  const reH = H.filter(i => L.gen.solar[i] + L.gen.wind[i] > 0.3);
  const curtT = reH.reduce((a, i) => a + L.curt[i], 0), curtH = reH.reduce((a, i) => L.curt[i] > L.curt[a] ? i : a, reH[0] || 6);
  const thOn = count(st.plan).thermal > 0;
  const chT = H.reduce((a, i) => a + L.charge[i], 0), chH = H.reduce((a, i) => L.charge[i] > L.charge[a] ? i : a, 6);
  const used = C.stack.filter(k => H.some(i => L.gen[k][i] > 0.3));
  const top = used.slice().sort((a, b) => H.reduce((s, i) => s + L.gen[b][i], 0) - H.reduce((s, i) => s + L.gen[a][i], 0))[0];
  const hasBat = count(st.plan).battery > 0;
  let qh = shortH[0];
  const qs = [];
  if (!lr.peak) qs.push({ learn: 'peak', focus: 'line', ask: '黒い 線は「町が 使う 電気の 量」。いちばん たくさん 使うのは 何時ごろ？', tap: h => Math.abs(h - peak) <= 1, hintMark: [peak],
    hint: '黒い 線が いちばん 高く なっている ところを さがそう',
    explain: () => `正解！ <b>${peak}時ごろ</b>。${peak >= 16 ? '夕方は みんなが 家に 帰って、明かり・料理・テレビ・おふろで 電気を たくさん 使う。でも その ころ <b>☀️は しずんで いく</b>…' : 'この日は 昼に たくさん 使った。'}` });
  const batH = H.filter(i => L.gen.battery[i] > 0.3), emptyH = batH.length ? shortH.find(i => i >= 12 && i > batH[0]) : null;
  if (emptyH && lr.empty < 2) {
    qs.push({ learn: 'empty', focus: 'battery', ask: '<b>🔋 緑の 柱</b>（蓄電池が 出した 電気）が なくなった あと、何が おきた？ その時間を タップ！', tap: h => Math.abs(h - emptyH) <= 1 && shortH.includes(h), hintMark: [emptyH],
      hint: '緑が 消えて、すぐ 黒い 四角（停電）に なる ところを さがそう' });
    qs.push({ ask: () => `${emptyH}時から 停電したのは なぜ？`, mark: () => [emptyH],
      opts: [{ t: '🔋の 電気を 使いきった', ok: true }, { t: '🔋が こわれた', fb: 'こわれては いないよ。その前の 時間は 緑が 出ているね' }, { t: '町が 電気を 使いすぎた', fb: '黒い 線を 見て。夜は 夕方より へっているよ' }],
      explain: () => `そう！ ためた 電気を <b>使いきって 空っぽ</b>に なった。🔋に ためられる 量には 限りが ある。夜に 使う 分だけ <b>ためる 量（容量）</b>が いる。<br>👉 <b>🔋を ふやす</b>？ <b>☀️を ふやす</b>？ それとも 夜に 出せる <b>🔥を 少し のこす</b>？ どれも お金や CO₂が かかる。結果の <b>くらべる表</b>で たしかめよう！` });
  }
  if (shortH.length && lr.short < 3 && !(emptyH && lr.empty < 2)) {
    qs.push({ learn: 'short', focus: 'short', ask: '<b class="ng"><i class="sw blk"></i> 黒い 四角</b>が 停電（電気が 来なくて まっくら）。停電した 時間を 1つ タップ！', tap: h => { if (shortH.includes(h)) { qh = h; return true; } return false; }, hintMark: shortH,
      hint: '線の 下に 黒い 四角が ある 柱を さがそう' });
    const madeAt = h => C.stack.filter(k => L.gen[k][h] > 0.3);
    qs.push({ ask: () => { const ks = madeAt(qh), sum = ks.reduce((a, k) => a + rd(L.gen[k][qh]), 0);
        return `<b>${qh}時</b>　⚡町が 使う 量は <b>${rd(L.D[qh])}</b>。<br>つくった 電気は ${ks.map(k => `${P[k].icon}${rd(L.gen[k][qh])}`).join(' ＋ ')} ＝ <b>${sum}</b>。<br>くらべると どうなる？`; },
      mark: () => [qh],
      opts: [{ t: '⬆️ つくる ＞ 使う', s: 'あまる', fb: '数を よく くらべて。つくった 電気の 合計は 使う 量より 大きい？' }, { t: '⬇️ つくる ＜ 使う', s: 'たりない', ok: true }, { t: '↔️ つくる ＝ 使う', s: 'ぴったり', fb: 'ぴったりなら 停電しないはず。数を くらべてみよう' }],
      explain: () => `そう！ <b>つくる 量 ＜ 使う 量</b>。グラフの <i class="sw blk"></i> 黒い 四角は つくった 電気ではなく、<b>たりない 分</b>。それが <b class="ng">停電</b>に なる。電気は <b>毎時間「つくる 量 ＝ 使う 量」</b>に そろえないと いけない！`
        + (qh >= 17 && used.includes('solar') ? '<br>☀️は 夕方に 弱く なり、夜は 0。' : '')
        + (outWin ? '<br>（この時間は ためす時間の 外だから 今回は クリア。でも 次は ここが 課題に なるかも…）' : '') });
  }
  if (curtT > 2 && lr.curt < 2) {
    qs.push({ learn: 'curt', focus: 'curt', ask: () => `<b>${curtH}時</b>の <b class="gray">灰色</b>の ところを 見て。これは どうなった 電気？`, mark: () => [curtH],
      opts: [{ t: '🔋 ためた', fb: hasBat ? 'ためた 電気は しまもよう。灰色とは ちがうよ' : 'この町に 電気を ためる 場所（🔋）は ある？' },
        { t: '🗑️ すてた', ok: true }, { t: '🏠 町で 使った', fb: '町で 使ったのは 黒い 線まで。線より 上は 使いきれなかった 分…' }],
      explain: () => 'そう、<b>すてた</b>！ 町が 使う 量より 多く つくっても、<b>ためる 場所が なければ すてるしか ない</b>（出力制御）。せっかくの ☀️が もったいない！'
        + (thOn ? '<br>🔥火力は 出力を 下げられる。でも <b>動かしている あいだは 最低 3割は 出し続ける</b>（新しい 火力の 決まり。2023年）。だから 昼に ☀️が 多いと あまってしまう。' : '') });
    qs.push({ ask: 'すてている 電気を むだに しないには？', mark: () => [curtH],
      opts: [{ t: '☀️ 太陽光を もっと ふやす', fb: 'ふやすと 昼は もっと あまって、もっと すてることに…' },
        { t: '🔋 蓄電池で ためて 夜に 使う', ok: true }, { t: '⏰ 電気を 使う 時間を 昼に ずらす', s: 'お湯を わかす・充電 など', ok: true },
        thOn ? { t: '🔥 火力を もっと 下げる', fb: '🔥は もう いちばん 下（3割）まで 下げているよ。止めると 夕方に 起こすのが まにあわない…' } : { t: '🔥 火力を ふやす', fb: '火力を ふやしても 昼の あまりは へらないよ' }],
      explain: () => '正解！ でも <b>答えは 1つでは ない</b>。どの 方法にも <b class="ng">弱点</b>が ある。' + wayCards() + '<small>ぜんぶ 🔋に ためようと すると、電池が たくさん いって 高く つく。九州では いまも 春の 昼に 少し すてている。</small>' });
  }
  // ⚛️が あると 夜も あまる（出力を 変えにくい ベースロード電源）
  const nightCurt = H.filter(i => (i >= 20 || i <= 8) && L.curt[i] > 0.3);
  if (count(st.plan).nuclear > 0 && nightCurt.length && !lr.base && qs.length < 3) qs.push({ learn: 'base', focus: 'curt', ask: () => `<b>${nightCurt[0]}時</b>（☀️が 出ていない 時間）にも <b class="gray">灰色</b>（すてた 電気）が ある。なぜ？`, mark: () => [nightCurt[0]],
    opts: [{ t: '⚛️は 出力を こまめに 変えにくい', s: '夜も 同じ だけ つくる', ok: true }, { t: '夜は 風が 強いから', fb: 'この町の 💨は 少ないよ。灰色の 下の 色を 見て' }, { t: '町の 人が 使いすぎたから', fb: '使いすぎなら 足りなくなって 停電（黒い 四角）が 出るはず' }],
    explain: () => 'そう！ ⚛️は <b>一定の 出力で 動かし続ける</b> 電源（ベースロード）。使う 量が 少ない 夜や 昼は あまって しまう。だから <b>出力を 調整できる 電源</b>（🔥💧）や 🔋との 組み合わせが 大事。' });
  if (chT > 2 && !lr.charge && qs.length < 3) qs.push({ learn: 'charge', focus: 'charge', ask: () => `<b>${chH}時</b>の 線より 上の <b>しまもよう</b>は 何？`, mark: () => [chH],
    opts: [{ t: '🔋 蓄電池に ためた', ok: true }, { t: '🗑️ すてた', fb: 'すてたのは 灰色。しまもようは…' }, { t: '⚡ 停電', fb: '停電は 黒い 四角で、線の 下に 出る。線より 上は 電気が あまっている ところ' }],
    explain: () => 'そう！ あまった 電気を <b>🔋に ためた</b>。夕方〜夜に <b>緑の 🔋</b>として 出てくるよ。グラフで さがしてみて！' });
  if (!qs.length) qs.push({ ask: 'この日、いちばん たくさん 電気を つくったのは？',
    opts: used.map(k => ({ t: `${P[k].icon} ${P[k].name}`, ok: k === top, fb: 'グラフで いちばん 面積が 大きい 色は？' })),
    explain: () => `${P[top].icon}${P[top].name}！ いちばん 面積が 大きい 色だね。${top === 'thermal' ? 'そのぶん CO₂も 多い…' : ''}` });
  let n = 0, miss = 0;
  const show = () => {
    const q = qs[n], ask = typeof q.ask === 'function' ? q.ask() : q.ask; miss = 0;
    api.mark(q.mark ? q.mark() : null); api.tap(null); api.focus(q.focus || null);
    box.className = 'st-quiz';
    box.innerHTML = `<div class="st-qhead">🔍 グラフ探偵 <span>${n + 1} / ${qs.length}</span></div><div class="st-qask">${ask}</div>`
      + (q.tap ? '<div class="st-qtap">👆 左の グラフを タップ！</div>' : `<div class="st-qopts">${q.opts.map((o, i) => `<button class="btn" data-o="${i}"><span>${o.t}</span>${o.s ? `<small>${o.s}</small>` : ''}</button>`).join('')}</div>`)
      + '<div class="st-qfb" id="stQfb"></div>';
    const fb = box.querySelector('#stQfb');
    const wrong = msg => { sfx('bad'); miss++; st.qmiss = (st.qmiss || 0) + 1; fb.className = 'st-qfb ng'; fb.innerHTML = '🤔 ' + msg; box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); if (q.tap && miss >= 2) api.mark(q.hintMark); };
    const right = () => {
      sfx('right'); api.tap(null); if (q.learn) lr[q.learn] = (lr[q.learn] || 0) + 1;
      const last = n === qs.length - 1;
      box.querySelectorAll('[data-o]').forEach(b => b.disabled = true);
      fb.className = 'st-qfb ok'; fb.innerHTML = `💡 ${q.explain ? q.explain() : 'そのとおり！'}<button class="btn go" id="stQn">${last ? '✅ わかった！ 結果を 見る' : 'つぎへ ▶'}</button>`;
      fb.querySelector('#stQn').onclick = () => { if (last) { box.innerHTML = '<div class="st-qhead">🔍 グラフ探偵 クリア！ ✅</div>'; api.done(); } else { n++; show(); } };
    };
    if (q.tap) api.tap(h => q.tap(h) ? right() : wrong(q.hint));
    else box.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { const o = q.opts[+b.dataset.o]; if (o.ok) { b.classList.add('go'); right(); } else wrong(o.fb); });
  };
  show();
}
function legend(L) {
  const used = C.stack.filter(k => L.gen[k].some(v => v > 0.05));
  return `<div class="st-leg">${used.map(k => `<span><i style="background:${P[k].color}"></i>${P[k].icon}${P[k].name}</span>`).join('')}
    <span><i class="line"></i>町が 使う 量</span><span><i style="background:${EC.BLACK}"></i>たりない 分（停電）</span>
    ${L.curt.some(v => v > 0.05) ? '<span><i style="background:rgba(150,160,175,.6)"></i>あまって すてた</span>' : ''}${L.imp && L.imp.some(v => v > 0.05) ? '<span><i style="background:#9B7BE0"></i>🔌 買った</span>' : ''}${L.exp && L.exp.some(v => v > 0.05) ? '<span><i style="background:rgba(155,123,224,.45)"></i>🔌 送った</span>' : ''}${L.charge.some(v => v > 0.05) ? '<span><i class="hatch"></i>🔋に ためた</span>' : ''}<span><i class="win"></i>ためす 時間</span></div>`;
}
// ⑤ まとめ
const pct = (x, v) => Math.max(0, Math.min(100, (v - x.lo) / (x.hi - x.lo) * 100));
const profRow = x => `<div class="pf ${x.ok ? 'ok' : 'ng'} ${x.pri ? 'pri' : ''}"><i>${x.k}</i><b>${x.name}${x.pri ? '<em>📣</em>' : ''}</b><div class="bar"><em style="width:${pct(x, x.v)}%"></em><u style="left:${pct(x, x.g)}%"></u></div><span>${x.fmt(x.v)}</span><s>${x.ok ? '⭐' : '☆'}</s><small>${x.goal}</small></div>`;
function townIcons(c, plan) {
  return `${icons(Object.fromEntries(Object.entries(c).filter(([, n]) => n > 0)))}<span class="st-ic"><img src="${EC.charaIcon('hydro')}" alt="">×1</span>${plan.link ? `<span class="st-ic big">🔌×${plan.link}</span>` : ''}${plan.shift ? '<span class="st-ic big">⏰</span>' : ''}${plan.save ? '<span class="st-ic big">📢</span>' : ''}`;
}
// 🪪 話し合いで 見せる カード：エンディング・公約・ものさし・町・えらんだ 道（第3部は 6つの 日）
function talkCard(s) {
  const row = (h, body) => `<div class="tc-row"><span class="tc-h">${h}</span><div>${body}</div></div>`;
  return `<div class="tc-end">${s.end.icon} <b>${s.end.name}</b></div>`
    + (s.pri && s.pri.length ? row('📣 公約', s.pri.map(k => { const x = PLEDGE.find(p => p[0] === k); return `<em>${x[1]} ${x[2]}<small>${x[3]}</small></em>`; }).join('')) : '')
    + row('📊 ものさし', `<div class="tc-stars">${s.stars.map(x => `<span class="${x.ok ? 'ok' : 'ng'}">${x.k} ${x.name}${x.pri ? '📣' : ''}<b>${x.fmt(x.v)}</b><i>${x.ok ? '⭐' : '☆'}</i></span>`).join('')}</div>`)
    + row('🏙️ 町', `<div class="st-ics tc-town">${townIcons(s.c || count(st.plan), st.plan)}</div>`)
    + (st.part === 3 && st.why ? row('✍️ 設計の 理由', `<div class="tc-path"><span>💪 強み：${st.why.strong}</span><span>⚠️ 弱み：${st.why.weak}</span><span>🧰 役に 立った：${st.why.tool}</span></div>`) : '')
    + (st.part === 3 ? row(`🧪 ${WEEK3.length}つの 日`, `<div class="tc-path">${s.wk.map(d => `<span class="${d.ok ? 'ok' : 'ng'}">${EP[d.k].icon} ${EP[d.k].title} ${d.ok ? '⭕' : '❌'}</span>`).join('')}</div>`)
      : st.log.length ? row('🛤️ えらんだ 道', `<div class="tc-path">${st.log.map(l => `<span class="${l.clear ? 'ok' : 'ng'}">${EP[l.ep].icon} ${l.o.title} ${l.clear ? '⭕' : '❌'}</span>`).join('')}</div>`) : '');
}
function talkFor(s) {
  const me = `${s.end.icon} ${s.end.name}${s.pri ? `　📣 ${priIcons(s.pri)}` : ''}`, card = talkCard(s);
  if (st.part === 1) return { key: 'p1', me, card, q: '同じ 話で <b>ちがう 選択</b>を した 人を さがそう。<br>なぜ それを えらんだ？ 結果は どう ちがった？' };
  if (st.part === 2) return { key: 'p2', me, card, q: '<b>ちがう 公約</b>の 人と くらべよう。<br>どの 電源を えらんだ？ <b>公約に 入れなかった ものさし</b>は どう なった？ それで よいと 考えた 理由は？' };
  return { key: 'p3', me, card, q: 'いちばん <b>ちがう 町</b>を 設計した 人と くらべよう。<br>どの 日に 強い？ <b>まねしたい ところ</b>は？' };
}
function summary() {
  const s = judge(st.plan, st.money), c = count(st.plan), P2 = st.part >= 2;
  const nStar = P2 ? s.priOk : s.stars.filter(x => x.ok).length, full = P2 ? 3 : s.stars.length;
  if (!EC.Story.fast && !summary.shown) { summary.shown = true; if (R3) { R3.spin = true; R3.sky = 'sunny'; R3.hour = 15; R3.mood = nStar >= 2 ? 'happy' : 'normal'; R3.jump = 3; } root.querySelector('#stCard').hidden = true; return fx('ending', { icon: s.end.icon, name: s.end.name, party: nStar >= 2 }, () => { root.querySelector('#stCard').hidden = false; summary(); }); }
  summary.shown = false;
  const EL = P2 ? ENDS2 : ENDS, ekey = st.part === 3 ? 'ec.story.ends3' : st.part === 2 ? 'ec.story.ends2' : 'ec.story.ends';
  let got = []; try { got = JSON.parse(localStorage.getItem(ekey) || '[]'); } catch (e) {}
  const isNew = !got.includes(s.end.k); if (isNew) got.push(s.end.k);
  try { localStorage.setItem(ekey, JSON.stringify(got)); } catch (e) {}
  markPart(st.part);
  EC.Log.add({ t: 'end', part: st.part, end: s.end.name, icon: s.end.icon, pri: s.pri || null, stars: s.stars.map(x => ({ k: x.k, name: x.name, ok: x.ok, pri: !!x.pri, v: x.fmt(x.v) })), town: c, link: st.plan.link || 0, shift: !!st.plan.shift, save: !!st.plan.save });
  if (R3) { R3.spin = true; R3.sky = 'sunny'; R3.hour = 15; R3.mood = nStar >= 2 ? 'happy' : 'normal'; R3.jump = 2; }
  for (let i = 0; i < full; i++) setTimeout(() => sfx(i < nStar ? 'star' : 'starNo'), 350 + i * 300);
  const cc = card(`<div class="st-end"><small>エンディング ${isNew ? '<em>NEW!</em>' : ''}</small><b>${s.end.icon} ${s.end.name}</b>
      <div class="st-stars">${[...Array(full)].map((_, i) => `<i class="${i < nStar ? 'on' : ''}">★</i>`).join('')}</div>${P2 ? `<span class="st-pl">📣 公約 <b>${nStar}/3</b> 達成</span>` : ''}</div>`
    + say([s.end.say], nStar >= 2 ? 'happy' : 'normal')
    + `<div class="st-cols"><div>
    <h4 class="st-h4">📊 きみの 町の ものさし <small>｜ が 目標</small></h4>
    <div class="st-prof">${s.stars.map(profRow).join('')}</div>
    ${P2 && s.c.nuclear ? '<div class="st-why">🤔 ⚛️の 安全性を <b>2</b>に したのは「事故の 影響の 大きさ・廃棄物」を 重く 見た 考え方。<b>きみなら 何点？</b></div>' : ''}
    <h4 class="st-h4">🧪 いろいろな 日で ためすと</h4>
    <div class="st-week">${s.wk.map(d => `<div class="${d.ok ? 'ok' : 'ng'}"><i>${EP[d.k].icon}</i><b>${d.ok ? '⭕' : '❌'}</b><small>${EP[d.k].title}</small></div>`).join('')}</div>
    </div><div>
    <h4 class="st-h4">🏙️ きみの 町</h4>
    <div class="st-ics wide">${townIcons(c, st.plan)}</div>
    ${st.log.length ? `<div class="st-path2">${st.log.map(l => `<span class="${l.clear ? 'ok' : 'ng'}">${EP[l.ep].icon} ${l.o.title}</span>`).join('<i>▸</i>')}</div>` : ''}
    <h4 class="st-h4">📗 エンディング図鑑 ${got.length}/${EL.length}</h4>
    <div class="st-zukan">${EL.map(e => got.includes(e.k) ? `<span class="${e.k === s.end.k ? 'now' : ''}">${e.icon}<small>${e.name}</small></span>` : '<span class="lock">❓<small>？？？</small></span>').join('')}</div>
    </div></div>
    <div class="row2"><button class="btn" id="stAgain">🔄 ちがう道で もう一度</button><button class="btn" id="stRep2">📝 レポート</button><button class="btn go" id="stClose">${st.part < NPART ? `▶ 第${st.part + 1}部へ` : '🏠 おわる'}</button></div>`, 'end');
  const part = st.part;
  const nextPart = () => { if (part === 1) start(2); else if (part === 2) start(3); else if (part === 3) part4(); else partMenu(); };
  cc.querySelector('#stAgain').onclick = () => start(part);
  cc.querySelector('#stRep2').onclick = () => { sfx('tap'); EC.Report.open(); };
  cc.querySelector('#stClose').onclick = () => { sfx('tap'); EC.Talk.show(root, talkFor(s), nextPart); };
}
/* ---------- 🛠️ 第3部：設計 → ためす → 直す ---------- */
const toolOf = t => P[t.k] ? { icon: P[t.k].icon, name: P[t.k].name, cost: P[t.k].cost, img: EC.charaIcon(t.k) } : t;
function designPlan(d) { return { builds: TOOLS.filter(t => P[t.k]).map(t => [t.k, d[t.k]]), save: false, steps: [], people: 0, link: d.link, shift: !!d.shift }; }
const designCost = d => TOOLS.reduce((a, t) => a + d[t.k] * (P[t.k] ? P[t.k].cost : t.cost), 0);
function judgeDesign(d) {
  const plan = designPlan(d), cost = designCost(d), s = judge2(plan, 0, WEEK3);
  const fuel = s.wk.reduce((a, x) => a + Math.round(x.r.fuel), 0), money = PART[3].budget - cost - fuel;
  const ec = s.stars.find(x => x.id === 'econ'); ec.v = money; ec.ok = money >= 80;
  s.money = money; s.priOk = s.stars.filter(x => x.pri && x.ok).length; s.cost = cost; s.fuel = fuel; s.plan = plan;
  return s;
}
function design() {
  const PT = PART[3];
  st.d = st.d || { solar: 4, wind: 0, battery: 2, geo: 0, thermal: 1, nuclear: 0 };
  st.dTests = 0; st.dSel = st.dSel || 0;
  if (R3) { R3.sky = 'sunny'; R3.hour = 13; R3.mood = 'normal'; R3.spin = false; }
  const c = card(`<div class="st-banner small"><small>第3部・設計</small><b>🛠️ 公約を 守れる 組み合わせを 設計しよう</b><span>めあて：📣 公約 ${priIcons(st.pri)}　＋　⚡ ${WEEK3.length}つの 日 停電なし　＋　🪙 予算 ${PT.budget} 以内</span></div>
    <div class="st-dz"><div><h4 class="st-h4">🏗️ 発電所・設備・取り組みを えらぶ</h4><div id="stDT"></div></div><div id="stDR"></div></div>
    <div class="row2"><button class="btn go" id="stDGo">✅ この 町に 決める</button></div>`, 'end design');
  let s = null, timer = 0;
  const tools = () => {
    const cost = designCost(st.d);
    c.querySelector('#stDT').innerHTML = `<div class="st-budget ${cost > PT.budget ? 'over' : ''}"><div class="bar"><em style="width:${Math.min(100, cost / PT.budget * 100)}%"></em></div><b>🪙 ${cost}</b><small>/ 予算 ${PT.budget}</small></div>`
      + TOOLS.map(t => { const o = toolOf(t), n = st.d[t.k], can = n < t.max && cost + o.cost <= PT.budget;
        return `<div class="st-tool ${n ? 'on' : ''} ${st.dInfo === t.k ? 'open' : ''}" data-k="${t.k}">${o.img ? `<img src="${o.img}" alt="">` : `<i>${o.icon}</i>`}<b class="nm" title="せつめい">${o.icon} ${o.name} <u>？</u>${t.desc ? `<small>${t.desc}</small>` : ''}${!P[t.k] ? '' : t.k === 'battery' ? `<small class="st-s1" data-real="battery">1つ 出す 力 ⚡${scaleOf({ battery: 1 }).d}（ためた 分だけ）📏</small>` : `<small class="st-s1" data-real="${t.k}">1つ ☀️昼 ⚡${scaleOf({ [t.k]: 1 }).d}・🌙夜 ⚡${scaleOf({ [t.k]: 1 }).n} 📏</small>`}</b><em>🪙${o.cost}</em>
          <button class="mn" ${n ? '' : 'disabled'}>−</button><span>${n}</span><button class="pl" ${can ? '' : 'disabled'}>＋</button>${st.dInfo === t.k ? `<p class="st-tinfo">${TOOLINFO[t.k]}</p>` : ''}</div>`; }).join('')
      + '<p class="st-tcap">👆 名前を タップ → 何が できるか</p>';
    c.querySelectorAll('.st-tool').forEach(row => {
      const k = row.dataset.k, t = TOOLS.find(x => x.k === k);
      row.querySelector('.mn').onclick = () => { st.d[k] = Math.max(0, st.d[k] - 1); sfx('tap'); tools(); later(); };
      row.querySelector('.pl').onclick = () => { st.d[k] = Math.min(t.max, st.d[k] + 1); sfx('pick'); tools(); later(); };
      row.querySelector('.nm').onclick = () => { st.dInfo = st.dInfo === k ? null : k; sfx('tap'); tools(); };
    });
  };
  const later = () => { clearTimeout(timer); c.querySelector('#stDR').classList.add('busy'); timer = setTimeout(evalNow, 140); };
  const evalNow = () => {
    s = judgeDesign(st.d); st.dTests++;
    st.plan = s.plan; st.money = s.money;
    syncTown(count(s.plan));
    const d = s.wk[st.dSel], L = d.r.log;
    if (R3) R3.sky = EP[d.k].sky;
    const box = c.querySelector('#stDR'); box.classList.remove('busy');
    // 上（いつも 見える）：いろいろな 日の 結果と ものさし。下：えらんだ 日の グラフ・原因と 対策
    box.innerHTML = `<div class="st-dtop"><h4 class="st-h4">🧪 ${s.wk.length}つの 日で ためす <small>👆 日を タップ → 下に グラフ</small></h4>
      <div class="st-week pick">${s.wk.map((x, i) => `<button class="${x.ok ? 'ok' : 'ng'} ${i === st.dSel ? 'sel' : ''}" data-i="${i}"><i>${EP[x.k].icon}</i><b>${x.ok ? '⭕' : '❌'}</b><small>${EP[x.k].title}</small></button>`).join('')}</div>
      <h4 class="st-h4">📊 ものさし <small>｜ が 目標・📣 が 公約</small></h4>
      <div class="st-prof mini">${s.stars.map(profRow).join('')}</div>
      <p class="st-tcap">💸 ${s.wk.length}日間の 燃料代 🪙${s.fuel}　→　のこり 🪙${s.money}<br>📚 目標の 🔥40%・国産60%は 国の 2040年度の めやす。安全性の 点数は 作者の 考え方</p></div>
      <canvas class="st-chart tap" id="stDC"></canvas>${legend(L)}
      <div class="st-read" id="stDRead"><span class="st-about">${EP[d.k].about || ''}</span>${d.ok ? '✅ この 日は 停電なし' : `⚡ <b class="ng">${ranges(d.r.hours)}</b> に 停電`}　👆 グラフを タップで しらべる</div>
      ${d.ok ? '' : `<div class="st-fix">💡 <b>原因：</b>${DAYFIX[d.k][0]}<br>🧰 <b>対策の ヒント：</b>${DAYFIX[d.k][1]}</div>`}`;
    box.querySelectorAll('.st-week button').forEach(b => b.onclick = () => { st.dSel = +b.dataset.i; sfx('tap'); evalNow(); });
    const cv = box.querySelector('#stDC'), rd2 = box.querySelector('#stDRead');
    let sel = -1; const draw = () => drawChart(cv, L, EP[d.k].win, 24, sel);
    requestAnimationFrame(draw);
    cv.onclick = e => { const h = chartHour(cv, e); if (h < 6 || h > 23) return; sel = h; draw(); rd2.innerHTML = hourText(L, h); sfx('tap'); };
  };
  tools(); evalNow();
  c.querySelector('#stDGo').onclick = () => {
    if (designCost(st.d) > PT.budget) { sfx('bad'); return; }
    sfx('pick'); st.log = [];
    if (EC.Story.fast) { EC.Log.add({ t: 'design', d: Object.assign({}, st.d), cost: designCost(st.d), tries: st.dTests, pri: st.pri }); return summary(); }
    designWhy(s || judgeDesign(st.d));
  };
}
// 停電した 日の 原因と 対策の ヒント（答えは 1つに しない）
const DAYFIX = {
  d_sun: ['晴れでも 夜は ☀️が 0。夜に 出せる 電気が 足りない', '夜に 出せる 電源（🔥⚛️♨️💨）・🔋 昼に ためる'],
  d_cloud: ['雨で ☀️が 弱く、🔋に ためる 電気も 少ない', '天気に 左右されない 電源（🔥⚛️♨️）・💨'],
  d_calm: ['風が なくて 💨が 止まる', '💨に たよりすぎない。ほかの 電源・🔋'],
  d_quake: ['いちばん 大きな 発電所が 止まる', '大きな 発電所 1つに たよらない（いくつかに 分ける）'],
  d_bat: ['点検で 🔋の 約3分の1が 止まる', '🔋に たよりすぎない。夜に 出せる 電源']
};
// 名前を タップした ときの 説明（はたらきだけ。根拠を 確かめていない 数は 書かない）
const TOOLINFO = {
  solar: '昼だけ 発電。夜は 0、雨の 日は 弱い。燃料いらず・CO₂ 少ない。',
  wind: '風まかせ。夜も 回るが、風が ない 日は 止まる。燃料いらず・CO₂ 少ない。',
  battery: 'あまりを ためて あとで 出す。ためられる 量には 限りが ある。材料は ほぼ 輸入・火事への そなえ・交換が いる。',
  geo: '天気に 関係なく 一定・国産。',
  thermal: 'いつでも 上げ下げ できる 調整役。動かす かぎり 燃料代が かかり、CO₂も 多い。燃料は ほぼ 輸入。',
  nuclear: '大量に 一定。CO₂ 少ない。止まると 一度に たくさん 止まる（地震など）。'
};
/* ---------- ✍️ 決める 前の ふりかえり：強み・弱み・役に 立った 道具を 1つずつ えらぶ（話し合い・レポートに のこる） ---------- */
function designWhy(s) {
  const strong = s.stars.filter(x => x.ok).map(x => `${x.k} ${x.name}`);
  const weak = s.wk.filter(w => !w.ok).map(w => `${EP[w.k].icon} ${EP[w.k].title}の 日`).concat(s.stars.filter(x => !x.ok && x.id !== 'stab').map(x => `${x.k} ${x.name}`));
  const used = TOOLS.filter(t => st.d[t.k] > 0).map(t => { const o = toolOf(t); return `${o.icon} ${o.name}`; });
  const Q = [['strong', 'この 町の いちばんの 強みは？', strong.length ? strong : ['まだ ない']], ['weak', 'まだ 弱い ところ・ゆずった ものは？', weak.length ? weak : ['とくに なし']], ['tool', 'いちばん 役に 立った 発電所・設備・取り組みは？', used.length ? used : ['なし']]];
  const pick = {};
  const c = card(`<div class="st-banner small"><small>第3部・ふりかえり</small><b>✍️ この 町に 決める 前に</b><span>1つずつ えらぼう（話し合いと レポートに のこるよ）</span></div>
    ${Q.map(([k, q, opts]) => `<div class="st-why" data-q="${k}"><h4 class="st-h4">${q}</h4><div>${opts.map(o => `<button class="wc">${o}</button>`).join('')}</div></div>`).join('')}
    <div class="row2"><button class="btn" id="stWB">◀ もう少し 直す</button><button class="btn go" id="stWG" disabled>✅ この 町に 決める</button></div>`, 'end design');
  c.querySelectorAll('.st-why').forEach(box => box.querySelectorAll('.wc').forEach(b => b.onclick = () => {
    pick[box.dataset.q] = b.textContent; box.querySelectorAll('.wc').forEach(x => x.classList.toggle('on', x === b)); sfx('tap');
    c.querySelector('#stWG').disabled = Object.keys(pick).length < Q.length;
  }));
  c.querySelector('#stWB').onclick = () => { sfx('tap'); design(); };
  c.querySelector('#stWG').onclick = () => {
    sfx('pick'); st.why = pick;
    EC.Log.add({ t: 'design', d: Object.assign({}, st.d), cost: designCost(st.d), tries: st.dTests, pri: st.pri, why: pick });
    summary();
  };
}
function ranges(hs) {
  if (!hs.length) return '';
  const out = []; let a = hs[0], b = hs[0];
  hs.slice(1).concat([null]).forEach(h => { if (h === b + 1) { b = h; return; } out.push(a === b ? `${a}時` : `${a}〜${b + 1}時`); a = b = h; });
  return out.join('、');
}
// グラフ：色＝電源ごとの発電、線＝町が使う量、黒＝停電（まっくら）、灰色＝すてた電気。upto まで かく（早送り用）
let hatch = null;
/* focus：注目させる もの（'line' 黒い線・'short' 停電・'curt' すてた・'charge' ためた・'battery' 蓄電池）。
   それ以外を うすくして、注目する ものを 点滅・光らせる（ft：時間） */
function drawChart(cv, L, win, upto, sel, mark, focus, ft) {
  const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
  if (!r.width) return;
  if (cv.width !== Math.round(r.width * d)) { cv.width = r.width * d; cv.height = r.height * d; }
  const gx = cv.getContext('2d'), w = r.width, h = r.height; gx.setTransform(d, 0, 0, d, 0, 0); gx.clearRect(0, 0, w, h);
  const imp = L.imp || L.D.map(() => 0), exp = L.exp || imp;
  let max = 1; for (let i = 0; i < 24; i++) max = Math.max(max, L.D[i], C.stack.reduce((a, k) => a + L.gen[k][i], 0) + L.curt[i] + imp[i] + exp[i]);
  max *= 1.12; const x0 = 4, bw = (w - 8) / 18, H = h - 18, X = i => x0 + (i - 6) * bw, Y = v => 3 + H - v / max * H;
  if (!hatch) { const pc = document.createElement('canvas'); pc.width = pc.height = 8; const p = pc.getContext('2d'); p.strokeStyle = 'rgba(255,255,255,.85)'; p.lineWidth = 2; p.beginPath(); p.moveTo(0, 8); p.lineTo(8, 0); p.stroke(); hatch = pc; }
  const pulse = focus ? 0.5 + 0.5 * Math.sin((ft || 0) * 6) : 0;
  // ためす 時間：☀️の 黄色と まぎれないよう、うすい むらさきの 背景と 上の 帯で しめす
  gx.fillStyle = 'rgba(123,92,196,.07)'; gx.fillRect(X(win[0]), 0, (win[1] - win[0]) * bw, H + 3);
  gx.fillStyle = '#7B5CC4'; gx.fillRect(X(win[0]), 0, (win[1] - win[0]) * bw, 3);
  // 柱の 部品（focus で 何を 光らせるか 決めるため、種類ごとに 記録）
  const parts = [];
  for (let i = 6; i < Math.min(24, upto); i++) {
    let y = 3 + H;
    C.stack.forEach(k => { const v = L.gen[k][i]; if (v <= 0) return; const hh = v / max * H; parts.push({ k: k === 'battery' ? 'battery' : 'gen', x: X(i) + 0.5, y: y - hh, h: hh, c: P[k].color }); y -= hh; });
    if (imp[i] > 0.05) { const hh = imp[i] / max * H; parts.push({ k: 'link', x: X(i) + 0.5, y: y - hh, h: hh, c: '#9B7BE0' }); y -= hh; }   // 🔌 となり町から 買った
    if (L.charge[i] > 0.05) { const hh = L.charge[i] / max * H; parts.push({ k: 'charge', x: X(i) + 0.5, y, h: hh, hatch: true }); }   // しまもよう＝蓄電池に ためた
    if (exp[i] > 0.05) { const hh = exp[i] / max * H; parts.push({ k: 'link', x: X(i) + 0.5, y: y - hh, h: hh, c: 'rgba(155,123,224,.45)' }); y -= hh; }   // 🔌 となり町へ 送った
    if (L.curt[i] > 0.05) { const hh = L.curt[i] / max * H; parts.push({ k: 'curt', x: X(i) + 0.5, y: y - hh, h: hh, c: 'rgba(150,160,175,.75)' }); y -= hh; }
    if (L.short[i] > 0.02 * L.D[i]) { const hh = L.short[i] / max * H; parts.push({ k: 'short', x: X(i) + 0.5, y: y - hh, h: hh, c: EC.BLACK }); }
  }
  const paint = p => { if (p.hatch) { gx.fillStyle = gx.createPattern(hatch, 'repeat'); } else gx.fillStyle = p.c; gx.fillRect(p.x, p.y, bw - 1, p.h); };
  parts.forEach(paint);
  const line = (lw, col) => { gx.strokeStyle = col; gx.lineWidth = lw; gx.lineJoin = 'round'; gx.beginPath(); for (let i = 6; i < 24; i++) { const y = Y(L.D[i]); if (i === 6) gx.moveTo(X(i), y); else gx.lineTo(X(i), y); gx.lineTo(X(i + 1), y); } gx.stroke(); };
  line(2.5, '#1E2A38');
  if (focus) {
    // ほかを 少し うすく（電源の 色は 見分けられる 濃さに のこす）。注目する ものは 色の 光では なく、太い ふちで 目立たせる（☀️の 黄色と まぎれないように）
    gx.fillStyle = 'rgba(255,255,255,.5)'; gx.fillRect(0, 0, w, H + 4);
    if (focus === 'line') {
      line(5 + 2 * pulse, '#fff'); line(3 + 1.5 * pulse, '#1E2A38');
    } else {
      if (focus !== 'short') parts.filter(p => p.k === 'short').forEach(paint);   // 停電の 黒は いつも 濃く
      line(2, 'rgba(30,42,56,.55)');
      parts.filter(p => p.k === focus).forEach(p => { paint(p);
        gx.strokeStyle = '#1E2A38'; gx.lineWidth = 2.5 + 1.5 * pulse; gx.strokeRect(p.x - 1, p.y - 1, bw + 1, p.h + 2);
        gx.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * pulse})`; gx.lineWidth = 1.5; gx.strokeRect(p.x + 1.5, p.y + 1.5, bw - 4, Math.max(0, p.h - 3)); });
    }
  }
  if (mark && mark.length) {   // 注目する時間：ほかを うすくして、わくと ラベル
    gx.fillStyle = 'rgba(255,255,255,.62)';
    for (let i = 6; i < 24; i++) if (!mark.includes(i)) gx.fillRect(X(i), 0, bw, H + 3);
    parts.filter(p => p.k === 'short').forEach(paint);   // 停電の 黒は うすめない（すてた 電気の 灰色と まぎれないように）
    gx.strokeStyle = '#FF7A00'; gx.lineWidth = 3.5;
    mark.forEach(i => gx.strokeRect(X(i) + 1.5, 1.5, bw - 3, H + 1));
    const i0 = mark[0], lab = mark.length > 1 ? '👀 ここ' : `👀 ${i0}時`;
    gx.font = '900 12px sans-serif'; const tw = gx.measureText(lab).width + 12, lx = Math.max(2, Math.min(w - tw - 2, X(i0) + bw / 2 - tw / 2));
    gx.fillStyle = '#FF7A00'; gx.beginPath(); gx.roundRect ? gx.roundRect(lx, 3, tw, 18, 9) : gx.rect(lx, 3, tw, 18); gx.fill();
    gx.fillStyle = '#fff'; gx.textAlign = 'center'; gx.fillText(lab, lx + tw / 2, 16);
  }
  if (sel >= 6) { gx.strokeStyle = '#7B5CC4'; gx.lineWidth = 3; gx.setLineDash([5, 3]); gx.strokeRect(X(sel) + 1, 1, bw - 2, H + 2); gx.setLineDash([]); }
  gx.font = '900 11px sans-serif'; gx.fillStyle = '#5B6B7E'; gx.textAlign = 'center';
  [6, 9, 12, 15, 18, 21, 24].forEach(t => gx.fillText(t + '時', Math.max(14, Math.min(w - 14, X(t))), h - 3));
}

EC.Story = { open, _quit: () => { onBack = null; if (root) close(); }, _test: test, _ep: EP, _next: nextEp, _plan: newPlan, _with: withOpt, _judge: judge, _judge2: judge2, _cost: optCost, _fx: fx, _design: judgeDesign, _tools: TOOLS, _week3: WEEK3, _st: v => { st = v; } };
})(window);
