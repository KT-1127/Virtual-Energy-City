"""東京エリア 2024年 需給実績から、ゲームの 1日の 形を 出す（集計.py の つづき）
python 集計2.py <csvフォルダ>
・使う量の 形（1年の 平均、最大＝1）
・晴れの日の 太陽光の 形（各月で 太陽光の 多い 上位3日の 平均を、12か月 平均。最大＝1）
・太陽光の 1日の 量：雨の日（各月 下から1割）・くもりの日（各月 中央値）÷ 晴れの日（各月 上から1割）の 12か月 平均"""
import sys, os, glob, statistics as stt
from collections import defaultdict
rows = []
for p in sorted(glob.glob(os.path.join(sys.argv[1], '*.csv'))):
    for ln in open(p, 'rb').read().decode('utf-8', 'replace').splitlines():
        c = ln.split(',')
        if len(c) < 19 or not c[0][:4].isdigit(): continue
        y, m, d = map(int, c[0].split('/')); hh = int(c[1].split(':')[0])
        v = [float(x or 0) for x in c[2:20]]
        rows.append((m, d, hh, v[0], v[9] + v[10]))
acc = defaultdict(list)
for m, d, h, dem, so in rows: acc[h].append(dem)
a = [stt.mean(acc[h]) for h in range(24)]; mx = max(a)
print('demand_year', [round(x / mx, 2) for x in a])
day = defaultdict(float)
for m, d, h, dem, so in rows: day[(m, d)] += so / 2
shapes, rain, cloud = [], [], []
for m in range(1, 13):
    ks = sorted((v, k) for k, v in day.items() if k[0] == m); vs = [v for v, _ in ks]; n = len(vs) // 10
    rain.append(vs[n] / vs[-1 - n]); cloud.append(stt.median(vs) / vs[-1 - n])
    top = [k for _, k in ks[-3:]]; s = defaultdict(list)
    for mm, dd, h, dem, so in rows:
        if (mm, dd) in top: s[h].append(so)
    t = [stt.mean(s[h]) for h in range(24)]; tm = max(t); shapes.append([x / tm for x in t])
sh = [stt.mean(x[h] for x in shapes) for h in range(24)]; sm = max(sh)
print('solar_clear_year', [round(x / sm, 2) for x in sh], 'sum', round(sum(x / sm for x in sh), 2))
print('rain/clear %.2f  cloud/clear %.2f' % (stt.mean(rain), stt.mean(cloud)))
