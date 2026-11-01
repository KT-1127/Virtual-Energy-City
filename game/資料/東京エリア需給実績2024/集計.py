"""東京エリア 2024年 需給実績（東京電力パワーグリッド公開CSV）から、ゲームの 数値の 根拠に なる 値を 出す。
python -I tepco_stats.py <csvフォルダ>
列：DATE,TIME,エリア需要,原子力,火力(LNG),火力(石炭),火力(石油),火力(その他),水力,地熱,バイオマス,太陽光実績,太陽光制御量,風力実績,風力制御量,揚水,蓄電池,連系線,その他,合計（MW・30分ごと）"""
import sys, os, glob, statistics as stt
from collections import defaultdict
rows = []
for p in sorted(glob.glob(os.path.join(sys.argv[1], '*.csv'))):
    for ln in open(p, 'rb').read().decode('utf-8', 'replace').splitlines():
        c = ln.split(',')
        if len(c) < 19 or not c[0][:4].isdigit(): continue
        y, m, d = map(int, c[0].split('/')); hh, mm = map(int, c[1].split(':'))
        v = [float(x or 0) for x in c[2:20]]
        rows.append(dict(m=m, day=(m, d), h=hh, dem=v[0], solar=v[9] + v[10], wind=v[11] + v[12], thermal=sum(v[2:6])))
print('rows', len(rows))
def shape(sel):
    acc = defaultdict(list)
    for r in sel: acc[r['h']].append(r['dem'])
    a = [stt.mean(acc[h]) for h in range(24)]; mx = max(a)
    return [round(x / mx, 2) for x in a]
for nm, ms in [('夏 7-8月', (7, 8)), ('冬 1-2月', (1, 2)), ('春 4-5月', (4, 5)), ('1年', tuple(range(1, 13)))]:
    print('需要の形', nm, shape([r for r in rows if r['m'] in ms]))
# 1日の 合計
day = defaultdict(lambda: dict(dem=0, peak=0, solar=0, wind=0))
for r in rows:
    D = day[r['day']]; D['dem'] += r['dem'] / 2; D['peak'] = max(D['peak'], r['dem']); D['solar'] += r['solar'] / 2; D['wind'] += r['wind'] / 2
def per_month(m, key):
    return sorted((v[key], k) for k, v in day.items() if k[0] == m)
for m in (7, 8):
    pk = per_month(m, 'peak'); vals = [x for x, _ in pk]
    print(f'{m}月 1日の最大需要: 最大 {pk[-1][0]:.0f}MW({pk[-1][1]}) 中央値 {stt.median(vals):.0f} → 最大/中央値 {pk[-1][0] / stt.median(vals):.3f}')
    en = per_month(m, 'dem'); ev = [x for x, _ in en]
    print(f'{m}月 1日の使う量: 最大/中央値 {en[-1][0] / stt.median(ev):.3f}')
for m in range(1, 13):
    so = per_month(m, 'solar'); sv = [x for x, _ in so]
    print(f'{m}月 太陽光 1日: 最小/最大 {so[0][0] / so[-1][0]:.2f}  最小/中央値 {so[0][0] / stt.median(sv):.2f}  下から10%/上から10% {sv[len(sv)//10] / sv[-1 - len(sv)//10]:.2f}')
# 晴れた日の 太陽光の 時間の 形（その月で 太陽光が 多い 上位5日の 平均、最大を 1）
for m in (6, 8, 12):
    top = [k for _, k in per_month(m, 'solar')[-5:]]
    acc = defaultdict(list)
    for r in rows:
        if r['day'] in top: acc[r['h']].append(r['solar'])
    a = [stt.mean(acc[h]) for h in range(24)]; mx = max(a)
    print(f'{m}月 晴れた日の 太陽光の 形', [round(x / mx, 2) for x in a])
wy = [x for x, _ in sorted((v['wind'], k) for k, v in day.items())]
print('風力 1日（1年）: 最小/中央値 %.2f  最大/中央値 %.2f  中央値 %.0f MWh' % (wy[0] / stt.median(wy), wy[-1] / stt.median(wy), stt.median(wy)))
