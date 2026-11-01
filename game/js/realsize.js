/* エネルギーシティ ― 📏 ほんとうの 大きさ（写真つき）
   ゲームの 発電所「1つ」を 本物の 発電所に 置きかえると どれくらいか。
   置きかえ方：🔥1つ（⚡15）＝ 川崎火力発電所 1号系列 150万kW とし、ほかの 電源も 同じ 比（⚡1＝10万kW）で 置きかえる。
   ゲームの 町（家 10けん）とは 大きさが 合わない ことを 画面にも 書く。数値の 出典は 各項目の src と 数値の根拠チェック.md 7章 */
(function (g) {
const EC = g.EC, C = EC.CFG, P = C.plants;
const UNIT = 10;      // ⚡1 ＝ 10万kW
const BASE = ((g.document && document.currentScript && document.currentScript.src) || '').replace(/js\/realsize\.js.*$/, '');   // 写真の 場所（この ファイルから 見て ../assets/real）
const DOME = 4.7;     // 東京ドームの 面積 約4.7ha（46,755m²）
// ref：写真の 発電所（kw：万kW、area：ha、count：[数, 単位]）
const REF = {
  thermal: { ref: '川崎火力発電所 1号系列（神奈川県・LNG）', kw: 150, area: 28, src: '東京電力 資料（敷地 約28万m²・150万kW）' },
  solar: { ref: '鹿児島七ツ島メガソーラー発電所（鹿児島県）', kw: 7, area: 127, src: '京セラほか 発表（7万kW・約127万m²）' },
  wind: { ref: '郡山布引高原風力発電所（福島県）', kw: 6.598, count: [33, '基'], src: '環境省 資料（65,980kW・風車 33基）' },
  hydro: { ref: '黒部川第四発電所（富山県・黒部ダム）', kw: 33.5, src: '関西電力 資料（33.5万kW）' },
  geo: { ref: '八丁原発電所（大分県・日本で いちばん 大きい 地熱発電所）', kw: 11, src: '九州電力 資料（11万kW）', more: '日本の 地熱発電を ぜんぶ 合わせても 約60万kW（資源エネルギー庁 2024年）' },
  nuclear: { ref: '柏崎刈羽原子力発電所 6号機（新潟県）', kw: 135.6, count: [1, '基'], src: '東京電力 資料（6号機 135.6万kW）', photo: '写真は 7基 ぜんぶ' },
  battery: { ref: '紀の川蓄電所（和歌山県）', kw: 4.8, kwh: 11.3, src: '関西電力・オリックス 発表（2024年：4.8万kW・11.3万kWh）', photo: '写真は べつの 蓄電所（韮塚蓄電所・群馬県）' }
};
// 写真：ウィキメディア・コモンズ（assets/real/credits.json と 同じ）
const PH = {
  thermal: ['Ketsudan', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:%E5%B7%9D%E5%B4%8E%E7%81%AB%E5%8A%9B.JPG'],
  solar: ['Sakoppi', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Kagoshima_Nanatsujima_Solar_Plant_2020.jpg'],
  wind: ['BehBeh at Japanese Wikipedia', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:NunobikiWindFarm200704294.jpg'],
  hydro: ['foooomio', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0', 'https://commons.wikimedia.org/wiki/File:Kurobe_Dam_(14894503080).jpg'],
  geo: ['Herman Darnel Ibrahi…', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Hatchobaru_Geothermal_Power_Plant_Japan_-_panoramio.jpg'],
  nuclear: ['皓月旗', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Kashiwazaki-Kariwa_Nuclear_Power_Plant_14-Aug-2019_(cropped).jpg'],
  battery: ['Qurren', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Nirazuka_Battery_Storage_Power_Station_2.jpg']
};
const ORDER = ['thermal', 'solar', 'wind', 'hydro', 'geo', 'nuclear', 'battery'];
const r1 = v => v >= 100 ? Math.round(v / 10) * 10 : v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
const kwOf = (k, n) => P[k].cap * UNIT * n;   // 万kW

// n 個 分を 本物に 置きかえた ことば
function equiv(k, n) {
  const R = REF[k], kw = kwOf(k, n), times = kw / R.kw, out = [];
  out.push(`<b class="rs-big">約 ${r1(kw)}万kW</b>${k === 'battery' ? `<small>（ためられる 量 約${r1(P.battery.store * UNIT * n)}万kWh）</small>` : ''}`);
  out.push(`＝ 写真の ${R.ref.replace(/（.*$/, '')}の <b>約${r1(times)}${R.count && R.count[0] === 1 ? R.count[1] : 'か所'}分</b>`);
  if (R.area) { const ha = times * R.area; out.push(`📐 広さ 約${r1(ha)}ha（東京ドーム 約${r1(ha / DOME)}個分）`); }
  if (R.count && R.count[0] > 1) out.push(`🌀 風車 約${r1(times * R.count[0])}${R.count[1]}`);
  return out;
}

let el = null;
// k：見せる 電源、build：{solar:7,...}（選択肢の ときの 組み合わせ）、mode：'game'（ゲームの 1つと 置きかえ）か 'ref'（写真と 本物の 大きさだけ）
function show(k, build, mode) {
  mode = mode || 'game';
  if (!el) { el = document.createElement('div'); el.className = 'ec-real'; el.onclick = e => { if (e.target === el) hide(); }; }
  document.body.appendChild(el);
  const R = REF[k], ph = PH[k], p = P[k];
  const sum = build && Object.keys(build).filter(x => REF[x] && build[x] > 0);
  el.innerHTML = `<div class="rs-card"><div class="rs-head"><img src="${EC.charaIcon(k, 'happy')}" alt=""><b>📏 ${p.icon} ${p.name}の ほんとうの 大きさ</b><button class="rs-x" aria-label="とじる">✕</button></div>
    <div class="rs-tabs">${ORDER.map(x => `<button data-k="${x}" class="${x === k ? 'on' : ''}">${P[x].icon}<small>${P[x].name}</small></button>`).join('')}</div>
    <figure class="rs-ph"><img src="${BASE}assets/real/${k}.jpg" alt="${R.ref}"><figcaption>📷 ${R.ref}${R.photo ? `（${R.photo}）` : ''}<br><small>撮影：${ph[0]}／<a href="${ph[2]}" target="_blank" rel="noopener">${ph[1]}</a>／<a href="${ph[3]}" target="_blank" rel="noopener">ウィキメディア・コモンズ</a></small></figcaption></figure>
    <div class="rs-body">
      <p class="rs-ref">🏭 写真の 発電所：<b>${r1(R.kw)}万kW</b>${R.kwh ? `・${R.kwh}万kWh` : ''}${R.area ? `・広さ 約${R.area}ha（東京ドーム 約${r1(R.area / DOME)}個分）` : ''}${R.count && R.count[0] > 1 ? `・風車 ${R.count[0]}${R.count[1]}` : ''}<small>出典：${R.src}</small></p>
      ${R.more ? `<p class="rs-more">💡 ${R.more}</p>` : ''}
      ${mode === 'game' ? `<div class="rs-game"><b>🎮 ゲームの ${p.icon}${p.name} 1つ（⚡${p.cap}）を 本物に すると</b>${equiv(k, 1).map(t => `<p>${t}</p>`).join('')}</div>` : ''}
      ${mode === 'game' && sum && sum.length ? `<div class="rs-game sel"><b>👉 この 選択（${sum.map(x => `${P[x].icon}×${build[x]}`).join(' ')}）だと</b>${sum.map(x => `<p>${P[x].icon} ${equiv(x, build[x]).slice(0, 3).join('　')}</p>`).join('')}</div>` : ''}
      <p class="rs-note">${mode === 'game' ? '⚠️ ゲームの 🔥1つ を 本物の 大きな 火力発電所 1か所（川崎火力 1号系列 150万kW）と したときの 大きさ。ゲームの 町（家 10けん）とは 大きさが 合わない。<br>' : ''}⚡出力が 同じでも、1年に つくれる 電気は ちがう（☀️は 昼だけ、💨は 風しだい）。</p>
    </div></div>`;
  el.querySelector('.rs-x').onclick = hide;
  el.querySelectorAll('.rs-tabs button').forEach(b => b.onclick = () => show(b.dataset.k, build, mode));
  EC.Audio && EC.Audio.sfx && EC.Audio.sfx('tap');
}
function hide() { if (el && el.parentNode) el.remove(); }
// data-real="電源" を つけた ものを タップすると ひらく（data-b：組み合わせ、data-mode：'ref'）。ボタンの 中でも 選択より 先に うけとる
document.addEventListener('click', e => {
  const x = e.target.closest && e.target.closest('[data-real]'); if (!x) return;
  e.stopPropagation(); e.preventDefault();
  let b = null; try { b = x.dataset.b ? JSON.parse(x.dataset.b) : null; } catch (er) {}
  show(x.dataset.real, b, x.dataset.mode);
}, true);
EC.Real = { show, hide, REF, UNIT };
})(typeof window !== 'undefined' ? window : globalThis);
