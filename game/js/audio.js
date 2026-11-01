/* エネルギーシティ ― 音（BGM・効果音・まわりの音）
   音声ファイルは使わず、Web Audio でその場で鳴らす（ネットなしで動く）。曲はこのゲームのオリジナル。
   昼は木琴っぽい明るい曲、夜はオルゴールの静かな曲。停電中は低いパルスが重なる。 */
(function (g) {
const EC = g.EC;
const A = (EC.Audio = {});
let ctx = null, master, bgmBus, sfxBus, ambBus, noiseBuf, rainG, windG, windF;
let bgmOn = true, sfxOn = true, mood = 'title', song = 'title', tension = 0, step = 0, nextT = 0;
const TEMPO = 104, ST = 60 / TEMPO / 2;   // 8分音符の長さ
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

/* ---------- 曲（8小節 × 8ステップ） ---------- */
const CH = { C: [48, [60, 64, 67]], G: [43, [59, 62, 67]], Am: [45, [57, 60, 64]], F: [41, [57, 60, 65]], Em: [40, [59, 64, 67]] };
const SONGS = {
  day: {
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'], inst: 'mallet', drums: true,
    lead: [76, 0, 79, 76, 72, 0, 74, 76, 74, 0, 71, 67, 71, 0, 74, 0, 72, 0, 76, 72, 69, 0, 71, 72, 77, 0, 76, 0, 74, 72, 69, 0,
           79, 0, 76, 79, 72, 0, 76, 0, 74, 0, 79, 0, 77, 76, 74, 0, 72, 0, 69, 72, 77, 0, 76, 74, 74, 0, 71, 0, 67, 0, 0, 0]
  },
  night: {
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'C'], inst: 'box', drums: false,
    lead: [76, 0, 0, 72, 0, 0, 69, 0, 72, 0, 0, 69, 0, 0, 65, 0, 67, 0, 72, 0, 76, 0, 0, 0, 74, 0, 0, 71, 0, 67, 0, 0,
           69, 0, 72, 0, 76, 0, 79, 0, 77, 0, 0, 76, 0, 72, 0, 0, 74, 0, 71, 0, 74, 0, 79, 0, 76, 0, 0, 0, 72, 0, 0, 0]
  },
  title: {
    chords: ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G'], inst: 'bell', drums: true,
    lead: [72, 0, 76, 0, 79, 0, 76, 0, 81, 0, 79, 76, 72, 0, 0, 0, 77, 0, 81, 0, 79, 0, 77, 0, 74, 0, 76, 77, 79, 0, 0, 0,
           72, 0, 76, 0, 79, 0, 84, 0, 83, 0, 79, 0, 76, 0, 0, 0, 77, 0, 76, 0, 74, 0, 72, 0, 74, 0, 79, 0, 72, 0, 0, 0]
  }
};

/* ---------- 楽器 ---------- */
function voice(bus, f, t, dur, type, vol, attack, slideTo) {
  const o = ctx.createOscillator(), gn = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.006)); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn).connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
function noiseHit(bus, t, dur, vol, type, freq, q, sweepTo) {
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
  src.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); if (q) f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(gn).connect(bus); src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}
const INST = {
  mallet: (m, t) => { voice(bgmBus, mtof(m), t, 0.42, 'sine', 0.16); voice(bgmBus, mtof(m) * 4, t, 0.07, 'sine', 0.04); },
  box: (m, t) => { voice(bgmBus, mtof(m + 12), t, 1.1, 'sine', 0.09); voice(bgmBus, mtof(m + 24), t, 0.35, 'triangle', 0.025); },
  bell: (m, t) => { voice(bgmBus, mtof(m), t, 0.6, 'triangle', 0.1); voice(bgmBus, mtof(m) * 2.01, t, 0.3, 'sine', 0.05); }
};
function pad(tones, t, vol) {
  tones.forEach(m => { const o = ctx.createOscillator(), gn = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sine'; o.frequency.value = mtof(m); f.type = 'lowpass'; f.frequency.value = 1200;
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + 0.35); gn.gain.exponentialRampToValueAtTime(0.0001, t + ST * 8);
    o.connect(f).connect(gn).connect(bgmBus); o.start(t); o.stop(t + ST * 8 + 0.1); });
}
function kick(t, v) { voice(bgmBus, 150, t, 0.16, 'sine', v || 0.22, 0.003, 45); }
function hat(t, v) { noiseHit(bgmBus, t, 0.04, v || 0.035, 'highpass', 7500); }

function playStep(i, t) {
  const S = SONGS[song], bar = Math.floor(i / 8) % 8, pos = i % 8, [root, tones] = CH[S.chords[bar]];
  // ベース
  if (song === 'night') { if (pos === 0) voice(bgmBus, mtof(root), t, 1.6, 'triangle', 0.1, 0.02); }
  else { const bp = [root, 0, 0, root + 12, root + 7, 0, root + 12, 0][pos]; if (bp) voice(bgmBus, mtof(bp), t, 0.26, 'triangle', 0.13); }
  // コード
  if (pos === 0) pad(tones, t, song === 'night' ? 0.022 : 0.016);
  // メロディ
  const n = S.lead[i % 64]; if (n) INST[S.inst](n, t);
  // ドラム
  if (S.drums && tension < 0.5) { if (pos === 0 || pos === 4) kick(t); if (pos === 2 || pos === 6) hat(t, 0.05); else if (pos % 2) hat(t, 0.018); }
  // 停電中：低いパルスと、ピンポン
  if (tension > 0.05) {
    voice(bgmBus, mtof(root - 12), t, 0.2, 'square', 0.035 * tension, 0.004);
    if (pos === 0 || pos === 4) { voice(bgmBus, 880, t, 0.12, 'square', 0.025 * tension); voice(bgmBus, 660, t + ST, 0.12, 'square', 0.025 * tension); }
  }
  // 夜の虫
  if (song === 'night' && Math.random() < 0.18) for (let k = 0; k < 3; k++) voice(ambBus, 4200 + Math.random() * 300, t + k * 0.06 + Math.random() * 0.1, 0.04, 'sine', 0.012);
}
function schedule() {
  if (!ctx || ctx.state !== 'running') return;
  while (nextT < ctx.currentTime + 0.15) {
    if (step % 8 === 0 && song !== mood) song = mood;      // 小節のあたまで曲をかえる
    if (bgmOn) playStep(step, nextT);
    nextT += ST; step = (step + 1) % 64;
  }
}

/* ---------- はじめる（ユーザーの操作のあとでないと鳴らせない） ---------- */
A.unlock = function () {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp).connect(ctx.destination);
      bgmBus = ctx.createGain(); bgmBus.gain.value = bgmOn ? 0.34 : 0; bgmBus.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 0.8 : 0; sfxBus.connect(master);
      ambBus = ctx.createGain(); ambBus.gain.value = sfxOn ? 0.7 : 0; ambBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // 雨と風（ずっと流しておき、大きさだけ変える）
      const rain = ctx.createBufferSource(); rain.buffer = noiseBuf; rain.loop = true;
      const rf = ctx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 1500;
      rainG = ctx.createGain(); rainG.gain.value = 0; rain.connect(rf).connect(rainG).connect(ambBus); rain.start();
      const wind = ctx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
      windF = ctx.createBiquadFilter(); windF.type = 'bandpass'; windF.frequency.value = 500; windF.Q.value = 0.9;
      windG = ctx.createGain(); windG.gain.value = 0; wind.connect(windF).connect(windG).connect(ambBus); wind.start();
      nextT = ctx.currentTime + 0.1;
      setInterval(schedule, 30);
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) {}
};
A.tick = () => schedule();     // 画面の描画ループからも呼ぶ（タイマーがおくれても曲がとぎれないように）
A.setBgm = on => { bgmOn = on; if (bgmBus) bgmBus.gain.setTargetAtTime(on ? 0.34 : 0, ctx.currentTime, 0.1); };
A.setSfx = on => { sfxOn = on; if (sfxBus) { sfxBus.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.05); ambBus.gain.setTargetAtTime(on ? 0.7 : 0, ctx.currentTime, 0.1); } };
A.setMood = m => { if (SONGS[m]) mood = m; };
A.setTension = v => { tension = v; };
A.setWeather = (rain, wind) => {
  if (!ctx) return;
  rainG.gain.setTargetAtTime(rain * 0.14, ctx.currentTime, 0.6);
  windG.gain.setTargetAtTime(Math.max(0, wind - 0.2) * 0.09, ctx.currentTime, 0.6);
  windF.frequency.setTargetAtTime(350 + wind * 500 + Math.sin(ctx.currentTime) * 80, ctx.currentTime, 0.4);
};
// 大きなジングルのときは BGM を少し下げる
function duck(sec) { if (!bgmBus || !bgmOn) return; const t = ctx.currentTime; bgmBus.gain.cancelScheduledValues(t); bgmBus.gain.setValueAtTime(0.08, t); bgmBus.gain.setTargetAtTime(0.34, t + sec, 0.4); }

/* ---------- 効果音 ---------- */
const arp = (notes, gap, dur, type, vol, t0) => notes.forEach((m, i) => voice(sfxBus, mtof(m), t0 + i * gap, dur, type, vol));
const SFX = {
  tap: t => voice(sfxBus, 900, t, 0.06, 'triangle', 0.08),
  pick: t => voice(sfxBus, 660, t, 0.12, 'sine', 0.12, 0.004, 990),
  place: t => { voice(sfxBus, 260, t, 0.14, 'sine', 0.2, 0.004, 560); arp([84, 88, 91], 0.05, 0.12, 'triangle', 0.07, t + 0.06); },
  coin: t => { voice(sfxBus, 988, t, 0.06, 'square', 0.035); voice(sfxBus, 1319, t + 0.05, 0.14, 'square', 0.035); },
  black: t => { voice(sfxBus, 220, t, 0.7, 'sawtooth', 0.09, 0.005, 50); noiseHit(sfxBus, t, 0.35, 0.12, 'lowpass', 800, 0, 120); },
  restore: t => voice(sfxBus, 330, t, 0.4, 'sine', 0.12, 0.01, 990),
  alert: t => { [0, 0.22].forEach(d => { voice(sfxBus, 880, t + d, 0.1, 'square', 0.05); voice(sfxBus, 660, t + d + 0.1, 0.1, 'square', 0.05); }); },
  good: t => arp([72, 76, 79], 0.08, 0.18, 'triangle', 0.1, t),
  mix: t => { arp([79, 83, 86, 91, 95], 0.06, 0.2, 'triangle', 0.08, t); voice(sfxBus, mtof(96), t + 0.35, 0.6, 'sine', 0.05); },
  newcard: t => { duck(1.2); arp([72, 76, 79, 84], 0.09, 0.25, 'triangle', 0.1, t); voice(sfxBus, mtof(84), t + 0.4, 0.7, 'sine', 0.08); },
  built: t => arp([88, 91, 96], 0.05, 0.16, 'sine', 0.07, t),
  house: t => voice(sfxBus, 880, t, 0.08, 'sine', 0.06),
  leave: t => voice(sfxBus, 392, t, 0.3, 'triangle', 0.07, 0.01, 300),
  wake: t => { noiseHit(sfxBus, t, 0.5, 0.12, 'bandpass', 200, 1.2, 2400); voice(sfxBus, 90, t, 0.25, 'sine', 0.18, 0.005, 60); },
  rest: t => { voice(sfxBus, 660, t, 0.25, 'sine', 0.08); voice(sfxBus, 440, t + 0.2, 0.4, 'sine', 0.08); },
  ready: t => { voice(sfxBus, mtof(88), t, 0.5, 'sine', 0.08); voice(sfxBus, mtof(100), t, 0.25, 'sine', 0.03); },
  bad: t => voice(sfxBus, 170, t, 0.2, 'sawtooth', 0.07),
  predict: t => arp([72, 79], 0.12, 0.2, 'sine', 0.1, t),
  right: t => { duck(0.8); arp([72, 76, 79, 84], 0.07, 0.18, 'triangle', 0.11, t); },
  wrong: t => arp([67, 66, 63], 0.13, 0.25, 'triangle', 0.09, t),
  save: t => { voice(sfxBus, 600, t, 0.1, 'square', 0.05); voice(sfxBus, 800, t + 0.1, 0.16, 'square', 0.05); },
  dayEnd: t => { voice(sfxBus, mtof(84), t, 0.8, 'sine', 0.06); voice(sfxBus, mtof(79), t + 0.25, 0.9, 'sine', 0.06); },
  dawn: t => { for (let k = 0; k < 4; k++) voice(ambBus, 2600 + Math.random() * 600, t + k * 0.16 + Math.random() * 0.05, 0.09, 'sine', 0.025, 0.005, 3600 + Math.random() * 500); },
  fanfare: t => { duck(2.5); arp([72, 76, 79, 84, 79, 84, 88], 0.12, 0.3, 'triangle', 0.12, t); [60, 64, 67, 72].forEach(m => voice(sfxBus, mtof(m), t + 0.85, 1.4, 'sine', 0.05, 0.05)); },
  over: t => { duck(2.5); arp([67, 63, 60, 55], 0.24, 0.45, 'triangle', 0.1, t); },
  // ---- シナリオの 大きな 場面 ----
  drumroll: t => {      // だんだん 速く・大きく なる ドラムロール → シンバル
    duck(2.2); let d = 0, gap = 0.07, v = 0.03;
    while (d < 1.25) { noiseHit(sfxBus, t + d, 0.06, v, 'bandpass', 1800, 0.8); voice(sfxBus, 180, t + d, 0.05, 'triangle', v * 0.6, 0.002, 120); d += gap; gap = Math.max(0.032, gap * 0.95); v = Math.min(0.16, v * 1.07); }
  },
  cymbal: t => noiseHit(sfxBus, t, 1.8, 0.22, 'highpass', 5200),
  clearBig: t => {      // ジャーン！ ＋ ファンファーレ ＋ キラキラ
    duck(4.5);
    noiseHit(sfxBus, t, 1.8, 0.22, 'highpass', 5200); voice(sfxBus, 130, t, 0.5, 'sine', 0.3, 0.003, 45);
    [60, 64, 67, 72].forEach(m => { voice(sfxBus, mtof(m), t, 0.35, 'sawtooth', 0.035, 0.01); voice(sfxBus, mtof(m + 12), t, 0.35, 'square', 0.02, 0.01); });
    const mel = [[67, 0.4, 0.14], [72, 0.55, 0.14], [76, 0.7, 0.14], [79, 0.85, 0.5], [76, 1.4, 0.14], [79, 1.55, 1.1]];
    mel.forEach(([m, d, l]) => { voice(sfxBus, mtof(m), t + d, l, 'square', 0.05, 0.008); voice(sfxBus, mtof(m - 12), t + d, l, 'triangle', 0.09, 0.008); });
    [65, 69, 72, 77].forEach(m => voice(sfxBus, mtof(m), t + 1.4, 0.14, 'sawtooth', 0.025)); [67, 72, 76, 79, 84].forEach(m => voice(sfxBus, mtof(m), t + 1.55, 1.3, 'sawtooth', 0.022, 0.02));
    voice(sfxBus, 120, t + 1.55, 0.6, 'sine', 0.28, 0.003, 45); noiseHit(sfxBus, t + 1.55, 1.6, 0.16, 'highpass', 6000);
    for (let k = 0; k < 10; k++) voice(sfxBus, mtof(96 + (k * 5) % 12), t + 0.9 + k * 0.07, 0.12, 'sine', 0.04);
  },
  failBig: t => {       // ドーン … ワ・ワ・ワ・ワーン（がっかりトロンボーン）
    duck(4);
    voice(sfxBus, 90, t, 0.7, 'sine', 0.32, 0.003, 35); noiseHit(sfxBus, t, 0.5, 0.14, 'lowpass', 600, 0, 80);
    [[392, 370], [370, 349], [349, 330]].forEach(([a, b], i) => { voice(sfxBus, a, t + 0.45 + i * 0.38, 0.34, 'sawtooth', 0.06, 0.02, b); voice(sfxBus, a / 2, t + 0.45 + i * 0.38, 0.34, 'triangle', 0.08, 0.02, b / 2); });
    for (let k = 0; k < 7; k++) { const a = 330 - k * 3; voice(sfxBus, a, t + 1.6 + k * 0.13, 0.15, 'sawtooth', 0.055, 0.01, a - 9); voice(sfxBus, a / 2, t + 1.6 + k * 0.13, 0.15, 'triangle', 0.07, 0.01, (a - 9) / 2); }
  },
  alarm: t => {         // 新しい 課題：サイレン ＋ ドン
    duck(3);
    for (let k = 0; k < 3; k++) { voice(sfxBus, 620, t + k * 0.42, 0.21, 'square', 0.05, 0.005, 930); voice(sfxBus, 930, t + k * 0.42 + 0.21, 0.21, 'square', 0.05, 0.005, 620); }
    voice(sfxBus, 70, t + 1.3, 0.8, 'sine', 0.3, 0.003, 40); [43, 46, 50].forEach(m => voice(sfxBus, mtof(m), t + 1.3, 0.9, 'sawtooth', 0.05, 0.01)); noiseHit(sfxBus, t + 1.3, 0.6, 0.14, 'lowpass', 900);
  },
  epStart: t => {       // シュッ ＋ ゴーン（話の はじまり）
    duck(2.5);
    noiseHit(sfxBus, t, 0.55, 0.12, 'bandpass', 300, 1.5, 4000);
    [55, 62, 67, 74].forEach((m, i) => voice(sfxBus, mtof(m), t + 0.45 + i * 0.01, 2.2, 'sine', 0.1 - i * 0.015, 0.01));
    arp([79, 84, 88, 91], 0.06, 0.25, 'triangle', 0.06, t + 0.5);
  },
  star: t => { voice(sfxBus, 880, t, 0.18, 'sine', 0.14, 0.003, 1760); voice(sfxBus, 100, t, 0.18, 'sine', 0.2, 0.003, 50); arp([96, 100, 103], 0.04, 0.12, 'triangle', 0.05, t + 0.08); },
  starNo: t => voice(sfxBus, 140, t, 0.2, 'triangle', 0.1, 0.003, 90),
  ending: t => {        // エンディング：オルゴール風の しめくくり
    duck(5); noiseHit(sfxBus, t, 1.6, 0.14, 'highpass', 6000);
    [72, 76, 79, 84, 83, 79, 81, 84].forEach((m, i) => { voice(sfxBus, mtof(m), t + i * 0.18, 0.6, 'sine', 0.1); voice(sfxBus, mtof(m + 12), t + i * 0.18, 0.3, 'triangle', 0.03); });
    [60, 64, 67, 72, 76].forEach(m => voice(sfxBus, mtof(m), t + 1.5, 2.2, 'sine', 0.05, 0.05));
  }
};
A.sfx = function (name) {
  if (!ctx || !sfxOn || ctx.state !== 'running') return;
  const f = SFX[name]; if (f) try { f(ctx.currentTime + 0.01); } catch (e) {}
};
})(window);
