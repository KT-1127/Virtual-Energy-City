/* エネルギーシティ ― 📝 学習の 記録・💬 話し合いタイム・学習レポート（PDF）
   EC.Log    ：シナリオ・大作戦3Dで 何を 選び、どうなったかを この 端末に 記録（localStorage）
   EC.Talk   ：各部の おわりの 話し合いタイム（問い・自分の 結果・3分タイマー・メモ）。授業で 使わない ときは OFF に できる
   EC.Report ：記録 ＋ 自分の 意見 ＋ ふりかえり（評価の めやす）を 1枚に まとめ、印刷 → 「PDFに 保存」 */
(function (g) {
const EC = g.EC = g.EC || {};
const KEY = 'ec.log.v1', RKEY = 'ec.report.v1';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sfx = n => EC.Audio && EC.Audio.sfx(n);

/* ---------- 記録 ---------- */
EC.Log = {
  add(e) { const L = load(KEY, []); e.at = Date.now(); L.push(e); save(KEY, L.slice(-600)); },
  all() { return load(KEY, []); },
  clear() { save(KEY, []); save(RKEY, {}); }
};

/* ---------- 💬 話し合いタイム ----------
   左：🪪 わたしの カード（o.card。友だちに 見せながら 話す）　右：問い・話し方の ヒント・タイマー・メモ */
const FRAMES = {
  p1: ['わたしは「〇〇」を えらんだ。理由は 〇〇', '〇〇さんは 〇〇を えらんで、結果は 〇〇だった', 'ちがいが 出たのは 〇〇の 日・〇〇の 時間'],
  p2: ['わたしの 公約は 〇〇。だから 〇〇を えらんだ', '公約に 入れなかった 〇〇は 〇〇に なった', '〇〇さんの 町は 〇〇に 強い。わたしの 町は 〇〇'],
  p3: ['わたしの 町は 〇〇の 日に 強い。理由は 〇〇', '〇〇の 日に 弱いのは 〇〇だから', '〇〇さんの 〇〇を まねしたい'],
  jp: ['わたしは 〇〇を 1位に した。なぜなら 〇〇', '〇〇さんと 同じ（ちがう）のは 〇〇', 'わたしの 宣言の 弱点は 〇〇。それを 〇〇で おぎなう']
};
EC.Talk = {
  esc,
  on() { try { return localStorage.getItem('ec.talk') !== '0'; } catch (e) { return true; } },
  set(v) { try { localStorage.setItem('ec.talk', v ? '1' : '0'); } catch (e) {} },
  show(host, o, then) {
    if (!EC.Talk.on() || (EC.Story && EC.Story.fast)) return then();
    const el = document.createElement('div'); el.className = 'ec-talk';
    const fr = FRAMES[o.key] || [];
    el.innerHTML = `<div class="tk-card ${o.card ? 'has' : ''}"><div class="tk-head"><i>💬</i><b>話し合いタイム</b></div>
      <div class="tk-cols">${o.card ? `<div class="tk-mine"><div class="tk-mh">🪪 わたしの カード<small>友だちに 見せながら 話そう</small></div>${o.card}</div>` : `<div class="tk-me">きみ：${o.me || ''}</div>`}
      <div class="tk-talk"><div class="tk-q">${o.q}</div>
      ${fr.length ? `<div class="tk-fr"><b>🗣️ こんな ふうに 話してみよう</b>${fr.map(x => `<span>${x}</span>`).join('')}</div>` : ''}
      <div class="tk-timer"><button class="btn" id="tkT">⏱ 3分 はかる</button><b id="tkC"></b></div>
      <label class="tk-memo"><span>✍️ 友だちの 考えで「なるほど！」と 思ったこと</span><textarea id="tkM" rows="2" placeholder="例：〇〇さんは 地熱を えらんでいた。国産で 安定するから。"></textarea></label>
      </div></div>
      <div class="row2"><button class="btn" id="tkS">とばす</button><button class="btn go" id="tkN">▶ つぎへ</button></div></div>`;
    (host || document.body).appendChild(el);
    sfx('epStart');
    let iv = 0;
    el.querySelector('#tkT').onclick = () => {
      clearInterval(iv); let left = 180; const cl = el.querySelector('#tkC');
      const f = () => { cl.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; if (left-- <= 0) { clearInterval(iv); cl.textContent = '⏰ 時間！'; sfx('alarm'); } };
      f(); iv = setInterval(f, 1000); sfx('tap');
    };
    const end = keep => {
      clearInterval(iv);
      const memo = el.querySelector('#tkM').value.trim();
      if (keep && memo) EC.Log.add({ t: 'talk', key: o.key, q: o.q.replace(/<[^>]+>/g, ''), memo });
      el.remove(); then();
    };
    el.querySelector('#tkS').onclick = () => end(false);
    el.querySelector('#tkN').onclick = () => end(true);
  }
};

/* ---------- 📝 学習レポート ---------- */
const PRI = { stab: '⚡安定', env: '🌏環境', econ: '💴経済', safe: '🛡️安全', self: '🗾自給' };
const KEYS = ['thermal', 'nuclear', 'hydro', 'solar', 'wind', 'geo'];
const RUBRIC = [
  { k: 'r1', name: '発電方法の 特徴', kind: '知識・技能',
    A: '5つ以上の 発電方法の 長所と 短所を、ゲームの 体験や 数値を 根拠に 説明できる', B: '主な 発電方法の 長所と 短所を 説明できる', C: '長所か 短所の 一方しか 説明できない' },
  { k: 'r2', name: 'グラフの 読み取り', kind: '知識・技能',
    A: '停電や すてた 電気の 時間と 原因を 読み取り、対策と 結びつけて 説明できる', B: '停電や すてた 電気の 時間を 読み取れる', C: 'グラフの 読み取りに 助けが 必要' },
  { k: 'r3', name: '状況に 応じた 判断', kind: '思考・判断・表現',
    A: '安定・環境・経済・安全・自給の 得と 損を くらべ、理由を もって 選択・設計できる', B: '2つ くらいの ものさしで くらべて 選べる', C: '1つの ものさしだけで 選んでいる' },
  { k: 'r4', name: '自分の 考え', kind: '主体的に 学習に 取り組む 態度',
    A: '事実の データと 友だちの 意見を ふまえ、これからの 電気の 使い方を 根拠と ともに 表している', B: '自分の 考えを 理由と ともに 表している', C: '考えの 表し方が 十分でない' }
];
const OPS = [['op1', 'これからの 日本の 電気、わたしは こう 考える（理由を 2つ 以上）'], ['op2', 'はじめと くらべて、考えが 変わった ところ'], ['op3', '友だちの 意見で 取り入れたい こと・くらしで できること']];

function mixBar(m) {
  const P = EC.CFG.plants;
  return `<span class="rp-mix">${KEYS.filter(k => m[k] > 0).map(k => `<i style="width:${m[k]}%;background:${P[k].color}" title="${P[k].name} ${m[k]}%">${m[k] >= 9 ? P[k].icon + m[k] : ''}</i>`).join('')}</span>`;
}
// 記録を 部ごと・チャプターごとに 整理（いちばん 新しい 挑戦を 見せる）
function digest(L) {
  const runs = {}, cur = {}, tries = {}, jp = {}, talks = {};
  let decl = null, voice = null, mirai = null, quiz = [0, 0], read = [0, 0], miss = 0, eps = 0, design = null, designTries = 0;
  L.forEach(e => {
    if (e.t === 'pledge') cur[e.part] = [];
    if (e.t === 'ep') { if (e.no === 1) cur[e.part] = []; (cur[e.part] = cur[e.part] || []).push(e); miss += e.miss || 0; eps++; }
    if (e.t === 'end') { runs[e.part] = { eps: cur[e.part] || [], end: e }; tries[e.part] = (tries[e.part] || 0) + 1; cur[e.part] = []; }
    if (e.t === 'design') { design = e; designTries += e.tries || 0; }
    if (e.t === 'jp') { const j = jp[e.ch] || { n: 0 }; jp[e.ch] = Object.assign(e, { n: j.n + 1 }); }
    if (e.t === 'quiz') { quiz[1]++; if (e.ok) quiz[0]++; }
    if (e.t === 'read') { read[1]++; if (e.ok) read[0]++; }
    if (e.t === 'decl') decl = e;
    if (e.t === 'voice') voice = e;
    if (e.t === 'mirai') mirai = e;
    if (e.t === 'talk') talks[e.key] = e;
  });
  return { runs, tries, jp, decl, voice, mirai, quiz, read, miss, eps, design, designTries, talks };
}
function sheet() {
  const L = EC.Log.all(), D = digest(L), me = load(RKEY, {}), dt = new Date();
  const kinds = new Set(); Object.values(D.runs).forEach(r => Object.entries(r.end.town || {}).forEach(([k, n]) => { if (n > 0) kinds.add(k); }));
  Object.values(D.jp).forEach(j => KEYS.forEach(k => { if (j.mix[k] > 0) kinds.add(k); }));
  const partName = { 1: '第1部 町の 電気', 2: '第2部 町が 大きくなる', 3: '第3部 みらいの 町を 設計' };
  const run = n => { const r = D.runs[n]; if (!r) return `<div class="rp-none">${partName[n]}：まだ 記録なし</div>`;
    return `<div class="rp-run"><h4>${partName[n]} <small>挑戦 ${D.tries[n]}回</small></h4>
      ${r.end.pri ? `<div class="rp-pri">📣 公約：${r.end.pri.map(k => PRI[k]).join('・')}</div>` : ''}
      ${r.eps.length ? `<div class="rp-path">${r.eps.map(e => `<span class="${e.clear ? 'ok' : 'ng'}">${e.icon} ${esc(e.pick)} ${e.clear ? '⭕' : '❌'}${e.weak ? `<small>弱点：${esc(e.weak)}</small>` : ''}</span>`).join('<i>▸</i>')}</div>` : ''}
      ${n === 3 && D.design ? `<div class="rp-path"><span>🧰 ${Object.entries(D.design.d).filter(([, v]) => v > 0).map(([k, v]) => `${(EC.CFG.plants[k] || { icon: k === 'link' ? '🔌' : '⏰' }).icon}×${v}`).join(' ')}　ためした 回数 ${D.designTries}回</span>${D.design.why ? `<span>💪 強み：${esc(D.design.why.strong)}</span><span>⚠️ 弱み：${esc(D.design.why.weak)}</span><span>🧰 役に 立った：${esc(D.design.why.tool)}</span>` : ''}</div>` : ''}
      <div class="rp-end"><b>${r.end.icon} ${esc(r.end.end)}</b>${r.end.stars.map(x => `<span class="${x.ok ? 'ok' : ''} ${x.pri ? 'pri' : ''}">${x.k}${x.name} ${esc(x.v)} ${x.ok ? '⭐' : '☆'}</span>`).join('')}</div></div>`; };
  const jps = Object.values(D.jp);
  const ev = {
    r1: `使った 電源 ${kinds.size}種類／大臣クイズ 正解 ${D.quiz[0]}/${D.quiz[1]}`,
    r2: `グラフ探偵 ${D.eps}話・まちがい 合計 ${D.miss}回／表の 読み取り 1回で 正解 ${D.read[0]}/${D.read[1]}`,
    r3: `公約 達成 ${[2, 3].map(n => D.runs[n] ? `第${n}部 ${D.runs[n].end.stars.filter(x => x.pri && x.ok).length}/3` : '').filter(Boolean).join('・') || '—'}／設計 ${D.designTries}回 ためした／大作戦 ${jps.filter(j => j.ok).length}チャプター 達成`,
    r4: `宣言 ${D.decl ? '✔' : '—'}／話し合いメモ ${Object.keys(D.talks).length}件`
  };
  return `<div class="rp-sheet" id="rpSheet">
    <header class="rp-hd"><div><small>エネルギーシティ</small><h2>⚡ エネルギーミックス 学習レポート</h2></div>
      <div class="rp-who"><span>${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日</span>
        ${['yr', 'cl', 'no', 'name'].map((k, i) => `<label>${['年', '組', '番', '名前'][i]}<span class="rp-ed in ${k}" contenteditable="true" data-k="${k}">${esc(me[k] || '')}</span></label>`).join('')}</div></header>
    <section><h3>📘 シナリオの 記録</h3>${[1, 2, 3].map(run).join('')}</section>
    <section><h3>🗾 日本エネルギーミックス大作戦 3D</h3>
      ${jps.length ? `<table class="rp-tbl"><tr><th>チャプター</th><th>わりあい</th><th>CO₂</th><th>コスト</th><th>停電しない日</th><th>国産</th><th>結果</th></tr>${jps.map(j => `<tr><td>${esc(j.mode)}<br><b>${esc(j.ch)}</b></td><td>${mixBar(j.mix)}</td><td>${j.r.co2}%</td><td>${j.r.cost}円</td><td>${j.r.stab}/4日</td><td>${j.r.self}%</td><td>${j.rank ? `<b class="rk">${j.rank}</b>` : ''}${j.ok ? '✅' : '—'}<small>${j.n}回</small></td></tr>`).join('')}</table>` : '<div class="rp-none">まだ 記録なし</div>'}</section>
    ${D.mirai ? `<section><h3>🗺️ おまけ：町の地図で 2050年へ</h3><div class="rp-path"><span>⚡ 停電した 回 ${D.mirai.black}/${D.mirai.turns}</span><span>🌫️ CO₂ 2026年の ${D.mirai.co2}%</span><span>🏗️ 🪙${D.mirai.spent}</span>${D.mirai.talks ? `<span>🤝 話し合い ${D.mirai.talks}回</span>` : ''}</div>${['⏳ もっと 早く 決めれば よかった こと', '📍 場所で こまった こと'].map((h, i) => D.mirai.texts[i] ? `<p class="rp-talk"><small>${h}</small>${esc(D.mirai.texts[i])}</p>` : '').join('')}</section>` : ''}
    <section><h3>📜 わたしの エネルギーミックス宣言</h3>
      ${D.decl ? `<div class="rp-decl"><div>${mixBar(D.decl.mix)}<p>大切に する 順：${D.decl.pri.map((k, i) => `<b>${i + 1}位 ${PRI[k]}</b>`).join('　')}</p></div>
        ${['いちばん たよる 電源と 理由', '弱点の おぎない方', 'くらしで できること'].map((h, i) => D.decl.texts[i] ? `<p><span>${h}</span>${esc(D.decl.texts[i])}</p>` : '').join('')}${D.voice ? `<p><span>🗣️ 国民への 説明（${esc(D.voice.who)}へ）</span>${esc(D.voice.text)}</p>` : ''}</div>` : '<div class="rp-none">まだ 宣言して いない（大作戦3Dの さいごに 宣言できる）</div>'}</section>
    ${Object.keys(D.talks).length ? `<section><h3>💬 話し合いメモ</h3>${Object.values(D.talks).map(t => `<p class="rp-talk"><small>${esc(t.q)}</small>${esc(t.memo)}</p>`).join('')}</section>` : ''}
    <section><h3>✍️ 自分の 意見</h3>${OPS.map(([k, h]) => `<div class="rp-op"><span>${h}</span><div class="rp-ed box" contenteditable="true" data-k="${k}">${esc(me[k] || '')}</div></div>`).join('')}</section>
    <section class="rp-rub"><h3>🔎 ふりかえり（評価の めやす）<small>自分で ○を つけよう。右の らんは 先生が 記入</small></h3>
      <table class="rp-tbl rub"><tr><th>観点</th><th>A（十分）</th><th>B（おおむね）</th><th>C（もう少し）</th><th>記録から</th><th>自分</th><th>先生</th></tr>
      ${RUBRIC.map(r => `<tr><td><b>${r.name}</b><small>${r.kind}</small></td><td>${r.A}</td><td>${r.B}</td><td>${r.C}</td><td class="ev">${ev[r.k]}</td>
        <td class="self">${['A', 'B', 'C'].map(x => `<button data-r="${r.k}" data-v="${x}" class="${me['self_' + r.k] === x ? 'on' : ''}">${x}</button>`).join('')}</td><td class="tc"></td></tr>`).join('')}</table></section>
    <footer>数値は 公的データ（資源エネルギー庁・電力中央研究所 ほか）を もとに した ゲーム用の めやす。安全性などの 点数は 作者の 考え方で、人によって ちがう。</footer>
  </div>`;
}
EC.Report = {
  open(back) {
    const el = document.createElement('div'); el.id = 'rp';
    el.innerHTML = `<div class="rp-bar"><button class="btn" id="rpBack">◀ もどる</button><b>📝 学習レポート</b>
      <span class="rp-tip">名前と 意見を 書いて、<b>🖨️ → 送信先「PDFに 保存」</b></span>
      <button class="btn go" id="rpPrint">🖨️ PDFで 保存</button><button class="btn ghost" id="rpClear">🗑️ 記録を けす</button></div>${sheet()}`;
    document.body.appendChild(el);
    const keep = () => { const me = load(RKEY, {}); el.querySelectorAll('[data-k]').forEach(x => { me[x.dataset.k] = x.innerText.trim(); }); el.querySelectorAll('.self button.on').forEach(b => { me['self_' + b.dataset.r] = b.dataset.v; }); save(RKEY, me); };
    el.addEventListener('input', keep);
    el.querySelectorAll('.self button').forEach(b => b.onclick = () => { el.querySelectorAll(`.self button[data-r="${b.dataset.r}"]`).forEach(x => x.classList.toggle('on', x === b)); keep(); sfx('tap'); });
    el.querySelector('#rpBack').onclick = () => { keep(); el.remove(); back && back(); };
    el.querySelector('#rpPrint').onclick = () => { keep(); document.body.classList.add('printing'); setTimeout(() => { g.print(); document.body.classList.remove('printing'); }, 60); };
    el.querySelector('#rpClear').onclick = () => { if (g.confirm('この 端末の 学習の 記録と レポートの 入力を ぜんぶ けします。よいですか？')) { EC.Log.clear(); el.remove(); EC.Report.open(back); } };
  }
};
})(window);
