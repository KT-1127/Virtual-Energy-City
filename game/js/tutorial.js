/* エネルギーシティ ― チュートリアルの台本（3日間・約3分）
   say：チャッピーのひとこと / focus：光らせる場所 / run：時間をすすめる速さ（ないときは止まる）
   wait：つぎへ進む合図
     tap … ひとことをタップ　select:x … カードをえらぶ　build:x … 建てる
     rest / wake … 火力を休ませる・起こす　save … 節電　predict … よそう
     hour:h（@年） … その時刻まで進む　day:年 … その年になる　done … おわり */
(function (g) {
const EC = g.EC;
EC.TUTORIAL = [
  { say: ['町長、ようこそ！', 'この町に ⚡電気を とどけよう！'], mood: 'happy', wait: 'tap' },
  { say: ['これが ⚡メーター', '色が ━線より 上なら OK！'], focus: '#meter', wait: 'tap' },
  { say: ['🔥火力発電・💧水力発電・☀️太陽光発電が', '電気を つくってるよ'], focus: 'tile:thermal', wait: 'tap' },
  { say: ['☀️太陽光発電を もう1つ 置こう！', 'カードを タップ'], focus: 'card:solar', wait: 'select:solar' },
  { say: ['光っているマスを タップ！'], focus: 'hl', wait: 'build:solar' },
  { say: ['いいね！ お昼まで すすめるよ'], run: 5, wait: 'hour:12' },
  { say: ['メーターの 上の 灰色を 見て！', '電気が あまって すててる…'], focus: '#meter', wait: 'tap' },
  { say: ['🔥は 起きていると', '少しは 発電を つづけるんだ'], focus: 'tile:thermal', wait: 'tap' },
  { say: ['🔥火力発電を タップして', '「休ませる」を おそう'], focus: 'tile:thermal', wait: 'rest' },
  { say: ['すてる電気が へった！', '燃料と CO₂も へるよ'], run: 5, wait: 'hour:15.8' },
  { say: ['🌇 もうすぐ 夕方！', '休んでる 🔥を 起こそう'], focus: 'tile:rest', wait: 'wake' },
  { say: ['🔥が 全力に なるまで', '1時間半 かかる。早めが コツ！'], run: 4, wait: 'hour:18.3' },
  { say: ['日が しずむと ☀️は おやすみ…', '電気が たりない！'], focus: '#meter', wait: 'tap' },
  { say: ['📢節電を おして', 'みんなに 協力してもらおう！'], focus: '#btnSave', wait: 'save' },
  { say: ['のりきった！', '夜も 電気を つくれる電源が いるね'], run: 6, wait: 'day:2027' },
  { say: ['きょうは 💨風が 強い日', '💨風力発電を 置こう！'], focus: 'card:wind', wait: 'select:wind' },
  { say: ['🌊海ぞいか ⛰️山の 光るマス', '（練習なので すぐ 完成）'], focus: 'hl', wait: 'build:wind' },
  { say: ['夜まで すすめるよ'], run: 6, wait: 'hour:19.5' },
  { say: ['💨は 夜も 回る！', '停電しなかったね'], focus: 'tile:wind', wait: 'tap' },
  { say: ['右上の 「あした」を 見て！', 'あしたは 🍃風なし…'], focus: '#forecast', wait: 'tap' },
  { say: ['🔮 どうなると 思う？', 'よそうしてみよう'], wait: 'predict', run: 6, until: 'day:2028' },
  { say: ['たしかめてみよう！'], run: 6, wait: 'hour:19.6@2028' },
  { result: true, wait: 'tap' },
  { say: ['ひとつの 電源だけに たよると', '天気しだいで 停電しちゃう'], wait: 'tap' },
  { say: ['🔋蓄電池なら', '昼の あまりを 夜に 使える！'], focus: 'card:battery', wait: 'tap' },
  { say: ['🔥を 使うと 🌏が あつくなる', '満タンで ゲームオーバー！'], focus: '#earthChip', wait: 'tap' },
  { say: ['いろんな電源を 組み合わせて', 'どんな日も のりきろう！'], mood: 'happy', wait: 'tap' },
  { say: ['🎓 チュートリアル クリア！'], mood: 'happy', wait: 'done' }
];
})(window);
