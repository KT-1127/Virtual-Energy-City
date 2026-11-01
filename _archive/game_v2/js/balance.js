/* =========================================================
   エネルギーシティ ― 調整用データ
   ゲームの数値・電源・イベント・ステージ・セリフ・実績は
   すべてこのファイルにまとめています。
   ここを書きかえるだけで、遊びの手ざわりを調整できます。
   ========================================================= */
(function () {
const EC = (window.EC = window.EC || {});

/* ---------- 全体のバランス ---------- */
EC.BALANCE = {
  startYear: 2026, endYear: 2050, yearsPerTurn: 2, // 1ターン＝2年（13ターンで約8分）
  startMoney: 120,
  startSat: 60,
  startHouses: 10,
  co2Base: 580,        // CO₂比較の基準（g/kWh）＝2025年ごろの町。co2r = 原単位 ÷ これ
  goal2030: 0.54,      // 2030年：46%削減
  bonus2030: 60,
  demand: { house: 3, factory: 8 },      // 1軒・1工場あたりの最大需要
  income: { house: 5, factory: 14 },     // 1年あたりの税収
  fuelPrice: 0.04,     // 火力1あたりの燃料費
  priceBase: 8, priceK: 300,             // 電気代 = base + K ×（燃料費＋維持費）÷ 需要
  thermalRamp: 0.5,    // 火力が1時間に上げられる出力（最大出力に対する割合）
  battery: { eff: 0.9, startSoc: 0.3 },
  sat: { base: 84, perBlackHour: 6, maxBlack: 50, priceFree: 20, perPrice: 2, co2: 22, onsen: 8, nukeNear: 6, smooth: 0.6 },
  growth: { high: 70, mid: 55 },         // 満足度がこれ以上で家が2軒・1軒ふえる
  factoryAt: [14, 20, 27, 34, 42],       // 家がこの数になると工場が来る
  score: { noBlack: 100, perBlackHour: -40, clean: 100, priceFree: 30, perPrice: 3, combo: 50, mixBonus: 0.1 },
  rank: { S: { co2: 0.18, black: 3, sat: 70 }, A: { co2: 0.4, black: 10, sat: 55 }, B: { co2: 0.65, black: 25, sat: 0 } },
  actions: {
    save:  { uses: 2, hours: 3, cut: 0.15, sat: 2 },   // 節電おねがい：3時間 需要-15%、満足度-2
    boost: { uses: 1, hours: 4, cap: 1.25, fuel: 1.5 } // 火力フルパワー：4時間 出力1.25倍・急上昇OK、燃料1.5倍
  },
  hourMs: 650,         // 1時間のアニメ時間（ミリ秒）
  pinchLookahead: 3    // 何時間先までピンチを予報するか
};

/* ---------- 電源（キャラクター） ---------- */
EC.PLANTS = {
  solar: { n: '太陽光', chara: 'ひなた', icon: '☀️', c: '#FFC21A', cost: 18, cap: 4, cf: 1, mt: 0.5, co2: 50, turns: 0,
    where: '平地（家や工場と土地をとりあう）',
    good: '安くてすぐ建つ。燃料ゼロでCO₂も少ない', bad: '夜はゼロ。くもりや雪に弱い',
    profile: 'お日さまが大好きな元気っ子。昼は最強だけど、日がしずむとすぐねむくなっちゃう。',
    fact: '日本の発電量の約1割（2023年度）。平地が少ない日本では、屋根やため池の上にも置かれています。' },
  wind: { n: '風力', chara: 'ふうた', icon: '🌬️', c: '#2FC1DA', cost: 25, cap: 7, cf: 1, mt: 1, co2: 15, turns: 1,
    where: '海ぞいの平地・山',
    good: 'CO₂がとても少ない。風があれば夜も発電', bad: '風まかせ。風が弱い年や台風の日は止まる',
    profile: '気まぐれな風の子。風が吹けば夜でもがんばるけど、風がない日は動けない。',
    fact: '日本の発電量の約1%。海の上に建てる「洋上風力」が、これからの期待の星です。' },
  thermal: { n: '火力', chara: 'ほむら', icon: '🔥', c: '#EB4B43', cost: 35, cap: 15, cf: 1, mt: 2, co2: 670, turns: 1,
    where: '海ぞいの平地（燃料を船で運ぶ）',
    good: '出力を上げ下げして、足りない分をうめられる', bad: 'CO₂がとても多い。燃料は輸入で値段が変わる。急には全力を出せない',
    profile: 'たよれる調整役。足りない分をうめてくれるけど、急に全力は出せないし燃料代もかかる。',
    fact: '日本の発電量の約7割（LNG・石炭・石油）。燃料のほとんどを海外から輸入しています。' },
  hydro: { n: '水力', chara: 'みずき', icon: '💧', c: '#2B7DE9', cost: 45, cap: 7, cf: 0.8, mt: 1, co2: 25, turns: 2,
    where: '川の上だけ',
    good: '一日中安定。CO₂も少ない', bad: '川がないと建てられない。建設に時間がかかる',
    profile: 'おだやかで安定した性格。一日中同じペースで発電。川がないと住めない。',
    fact: '日本の発電量の約8%。昔からある電源で、大きなダムを作れる場所はもうあまり残っていません。' },
  geo: { n: '地熱', chara: 'ゆげまる', icon: '♨️', c: '#A066D9', cost: 40, cap: 5, cf: 0.9, mt: 1, co2: 40, turns: 2,
    where: '山（温泉のとなりは反対される）',
    good: '天気に関係なく一日中安定', bad: '山にしか建てられない。温泉の近くだと住民が反対',
    profile: '地球のぬくもりで動くのんびり屋。天気に関係なくいつも一定。温泉とはライバル。',
    fact: '日本の地熱資源量は世界3位クラス。でも国立公園や温泉地と重なり、発電量は約0.3%です。' },
  nuclear: { n: '原子力', chara: 'げんた', icon: '⚛️', c: '#FF8A2A', cost: 110, cap: 30, cf: 0.9, mt: 6, co2: 15, turns: 3,
    where: '海ぞいの平地（冷却水が必要）。家の2マス以内は反対される',
    good: '大量の電気を一日中安定して作る。CO₂が少ない', bad: '高くて建設6年。出力を下げにくい。点検の年は丸ごと止まる',
    profile: '力持ちのまじめ者。大量の電気をずっと作るけど、急には止まれない。点検の年はお休み。',
    fact: '日本の発電量の約9%。CO₂は少ないが、安全性、放射性廃棄物の処分、地域の理解が課題です。' },
  battery: { n: '蓄電池', chara: 'ためるん', icon: '🔋', c: '#34B56A', cost: 35, cap: 6, store: 24, cf: 1, mt: 1, co2: 0, turns: 0, unlock: 2028,
    where: '平地',
    good: '余った電気をためて、足りない時間に出せる', bad: '自分では発電しない。ためた分しか出せない',
    profile: 'しっかり者の貯金係。余った電気をためて、足りない時間にわけてくれる。',
    fact: '再エネがふえるほど大切に。水をくみ上げてためる「揚水発電」は、巨大な蓄電池です。' }
};
EC.ORDER = ['solar', 'wind', 'thermal', 'hydro', 'geo', 'nuclear', 'battery'];
EC.STACK = ['nuclear', 'geo', 'hydro', 'wind', 'solar', 'battery', 'thermal']; // グラフの積み上げ順
EC.CURTAIL = ['solar', 'wind', 'hydro', 'geo', 'nuclear'];                     // 余ったとき捨てる順
EC.HOUSE_COLORS = ['#EB4B43', '#FFC21A', '#2B7DE9', '#34B56A', '#2FC1DA', '#FF8A2A'];

/* ---------- 日本の実際（最終画面でくらべる） ---------- */
EC.JAPAN = [
  { label: '日本 2023年度', note: '資源エネルギー庁 エネルギー需給実績（速報）', mix: { thermal: 68.6, nuclear: 8.5, hydro: 7.6, solar: 9.8, wind: 1.1, geo: 0.3, other: 4.1 } },
  { label: '日本 2040年度の見通し', note: '第7次エネルギー基本計画（再エネ4〜5割・原子力2割程度・火力3〜4割）', mix: { thermal: 35, nuclear: 20, hydro: 9, solar: 26, wind: 6, geo: 1, other: 3 } }
];

/* ---------- 季節（1日の需要と日照） ---------- */
const factoryShape = h => (h >= 8 && h <= 17) ? 1 : (h === 6 || h === 7 || h === 18 || h === 19) ? 0.7 : 0.45;
EC.SEASONS = {
  summer: { name: '真夏', factory: factoryShape, sunStart: 5.5, sunEnd: 18.5, sunMax: 1,
    home: [.5, .45, .42, .42, .45, .55, .68, .78, .8, .78, .78, .8, .82, .82, .8, .8, .85, .95, 1, 1, .95, .85, .72, .6] },
  winter: { name: '真冬', factory: factoryShape, sunStart: 6.8, sunEnd: 16.8, sunMax: 0.6,
    home: [.6, .55, .52, .52, .55, .68, .88, 1, .95, .8, .72, .7, .7, .7, .72, .78, .9, 1, 1, .98, .92, .85, .75, .66] }
};

/* ---------- イベント（予報に出る） ---------- */
// fx: dem=需要, sun=太陽光, wind=風力, fuel=燃料価格, nuc=原子力, hydro=水力, trip=止まる火力の数
EC.EVENTS = [
  { id: 'calm', w: 3, t: 'おだやかな年', icon: '🌤️', d: '大きな出来事はなさそう。', fx: {}, weather: null },
  { id: 'heat', w: 2, season: 'summer', t: '記録的な猛暑', icon: '🥵', d: 'エアコンで電気の使用量が15%アップ。', fx: { dem: 1.15 }, weather: 'heat' },
  { id: 'cold', w: 2, season: 'winter', t: '大寒波', icon: '🥶', d: '暖房で電気の使用量が20%アップ。', fx: { dem: 1.2 }, weather: 'snow' },
  { id: 'cloud', w: 2, t: 'くもりが続く', icon: '☁️', d: '太陽光が半分以下に。', fx: { sun: 0.45 }, weather: 'cloud' },
  { id: 'snow', w: 2, season: 'winter', t: '大雪', icon: '❄️', d: 'パネルに雪がつもり、太陽光がほぼゼロ。', fx: { sun: 0.12 }, weather: 'snow' },
  { id: 'nowind', w: 2, t: '風が弱い', icon: '🍃', d: '風力が3割しか回らない。', fx: { wind: 0.3 }, weather: null },
  { id: 'typhoon', w: 1, season: 'summer', minYear: 2028, t: '台風が接近', icon: '🌀', d: '強すぎる風で風車は安全のため停止。太陽光も弱い。', fx: { wind: 0, sun: 0.35 }, weather: 'storm' },
  { id: 'gust', w: 1.5, season: 'winter', t: '強い季節風', icon: '💨', d: '冬の風で風力が大活躍。', fx: { wind: 1.6 }, weather: 'snow', good: true },
  { id: 'fuel', w: 2, minYear: 2028, t: '燃料価格が高騰', icon: '💸', d: '世界情勢で輸入燃料が2倍以上に。', fx: { fuel: 2.3 }, weather: null },
  { id: 'inspect', w: 2.5, need: 'nuclear', t: '原子力の定期点検', icon: '🔧', d: '原子力発電所がすべて止まる。', fx: { nuc: 0 }, weather: null },
  { id: 'trip', w: 1.5, need: 'thermal', minYear: 2028, t: '火力のトラブル', icon: '⚠️', d: '火力発電所が1基、故障で止まる。', fx: { trip: 1 }, weather: null },
  { id: 'rain', w: 1, need: 'hydro', t: '雨が多い', icon: '☔', d: '川の水が多く、水力がアップ。', fx: { hydro: 1.25, sun: 0.8 }, weather: 'rain', good: true },
  { id: 'cheap', w: 1, t: '太陽光パネル値下がり', icon: '🏷️', d: '技術が進み、太陽光の建設費が3下がる。', fx: {}, cheap: 3, weather: null, good: true }
];

/* ---------- ステージ ---------- */
// 地形：g=平地 m=山 o=温泉 r=川 ~=海
EC.STAGES = [
  { id: 'plain', name: 'はじまりの町', sub: '川も山も海もある、バランスのよい町', season: 'summer', wind: 1, fuel: 1, center: [5, 7], color: '#34B56A',
    map: [
      'mmmmgggggg~~',
      'mmomgggggg~~',
      'mmmrggggggg~',
      'mmgrggggggg~',
      'mggrgggggg~~',
      'gggrgggggg~~',
      'ggggrggggg~~',
      'ggggrgggggg~',
      'gggggrgggg~~',
      'gggggrggg~~~',
      'ggggggrg~~~~',
      'gggggggr~~~~'],
    plants: [[3, 10, 'thermal', 2032], [7, 10, 'thermal', 2040], [3, 3, 'hydro']] },
  { id: 'island', name: 'しまの町', sub: '川がない！燃料は船で運ぶから高い。でも風は強い', season: 'summer', wind: 1.3, fuel: 1.4, center: [5, 6], color: '#2FC1DA',
    map: [
      '~~~~~~~~~~~~',
      '~~~gggg~~~~~',
      '~~ggmmgg~~~~',
      '~gggmomgg~~~',
      '~ggggmgggg~~',
      '~gggggggggg~',
      '~gggggggggg~',
      '~~ggggggggg~',
      '~~gggggggg~~',
      '~~~gggggg~~~',
      '~~~~gggg~~~~',
      '~~~~~~~~~~~~'],
    plants: [[2, 2, 'thermal', 2032], [9, 3, 'thermal', 2040]] },
  { id: 'snow', name: 'ゆきの町', sub: '冬の朝と夕方がピンチ。雪で太陽光も弱い', season: 'winter', wind: 1.2, fuel: 1, center: [6, 5], color: '#2B7DE9',
    map: [
      'mmmmmmmmmmmm',
      'mmmommmmrmmm',
      'mmmmmmggrmmm',
      'mmggggggrggm',
      'mggggggggrgg',
      'gggggggggrgg',
      'ggggggggggrg',
      'ggggggggggrg',
      'gggggggggggr',
      'gggggggggg~~',
      '~~~ggggg~~~~',
      '~~~~~~~~~~~~'],
    plants: [[9, 2, 'thermal', 2032], [9, 8, 'thermal', 2040], [3, 8, 'hydro']] }
];

/* ---------- コンボ（電源の相性） ---------- */
EC.COMBOS = {
  battery_night: { icon: '☀️🔋', name: 'ためて夜へ', d: '昼の太陽光をためて、夕方・夜に使った' },
  baton:         { icon: '☀️🌬️', name: '昼と夜のバトンタッチ', d: '昼は太陽光、夜は風力が町をささえた' },
  filler:        { icon: '🔥🌱', name: 'すき間うめ名人', d: '再エネ3割以上を、火力が上手におぎなった' },
  base:          { icon: '💧♨️⚛️', name: 'どっしりベース', d: '天気に左右されない電源が2種類以上' },
  mix:           { icon: '🌈', name: 'エネルギーミックス', d: '4種類以上の電源がそれぞれ活躍した' },
  fuelproof:     { icon: '🛡️', name: '燃料ショックに強い', d: '燃料高騰でも火力が少なく、電気代が安定' }
};

/* ---------- キャラクターのセリフ ---------- */
EC.LINES = {
  solar: { morning: 'おはよう！発電スタート☀️', peak: '絶好調〜！', evening: 'もう日がしずむ…あとはたのんだ！', night: 'Zzz…（夜は発電できないよ）', cloud: 'くもりで力が出ない…', curt: '作りすぎて捨てられてる…もったいない！' },
  wind: { strong: 'びゅんびゅん回るよ！', weak: '風が…こない…', night: '夜でも風があればがんばれる！', stop: '台風だから安全のため停止中！' },
  thermal: { ramp: '全力で上げてるけど追いつかない〜！', boost: 'フルパワー！🔥', fuel: '燃料が高い…お財布が…', work: '足りない分はまかせて！', trip: 'こ、故障しちゃった…' },
  hydro: { work: 'いつでも一定ペースだよ💧' },
  geo: { work: '地球の熱でぽかぽか発電♨️' },
  nuclear: { work: 'ずっと安定運転中！', curt: '急には止まれないんだ…', inspect: '点検中です🔧 今年はお休み' },
  battery: { charge: '余った電気をためてるよ！', discharge: 'いまだ、放電！', empty: 'からっぽ…もう出せない', hold: '温存中🔒 ここぞという時まで', full: '満タン！' }
};

/* ---------- 実績 ---------- */
EC.ACHIEVEMENTS = [
  { id: 'clear', icon: '🏁', name: '任期満了', d: '2050年までやりとげる' },
  { id: 'noblack', icon: '💡', name: '停電ゼロの町', d: '一度も停電せずに2050年へ' },
  { id: 'rankS', icon: '👑', name: '伝説の町長', d: 'ランクSをとる' },
  { id: 'goal2030', icon: '🎯', name: '2030年目標達成', d: '2030年にCO₂を46%削減' },
  { id: 'nothermal', icon: '🌱', name: '火力ゼロ', d: '火力が1基もないまま、停電なしの年をむかえる' },
  { id: 'nonuke', icon: '🍃', name: '原子力なしでA', d: '原子力を一度も建てずにランクA以上' },
  { id: 'all7', icon: '🌈', name: 'フルミックス', d: '7種類すべての電源を同時に動かす' },
  { id: 'combo3', icon: '🤝', name: 'コンボの達人', d: '1年で3つ以上のコンボを出す' },
  { id: 'pinch', icon: '🦸', name: 'ピンチを救え', d: 'ピンチ予報が出た日を、停電なしで乗りきる' },
  { id: 'fuelproof', icon: '🛡️', name: '燃料ショックに強い町', d: '燃料高騰の年に電気代を15円以下におさえる' },
  { id: 'nowaste', icon: '♻️', name: 'もったいない名人', d: '再エネ3割以上で、捨てた電気が3%未満の年' },
  { id: 'big', icon: '🏙️', name: '大都市', d: '家を40軒以上にする' },
  { id: 'island', icon: '🏝️', name: 'しまの町クリア', d: 'しまの町でランクB以上' },
  { id: 'snow', icon: '⛄', name: 'ゆきの町クリア', d: 'ゆきの町でランクB以上' }
];
})();
