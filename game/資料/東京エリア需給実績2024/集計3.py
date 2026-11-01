"""東京エリア 2024年：風力の 月ごとの 平均（1年の 平均＝1）と、太陽光の 1年の 平均の 日 ÷ 晴れの日（各月 上から1割）"""
import sys, os, glob, statistics as stt
from collections import defaultdict
day, wm = defaultdict(float), defaultdict(list)
for p in sorted(glob.glob(os.path.join(sys.argv[1], '*.csv'))):
    for ln in open(p, 'rb').read().decode('utf-8', 'replace').splitlines():
        c = ln.split(',')
        if len(c) < 19 or not c[0][:4].isdigit(): continue
        y, m, d = map(int, c[0].split('/')); v = [float(x or 0) for x in c[2:20]]
        day[(m, d)] += (v[9] + v[10]) / 2; wm[m].append(v[11] + v[12])
ya = stt.mean(x for m in wm for x in wm[m])
print('wind month/year', {m: round(stt.mean(wm[m]) / ya, 2) for m in sorted(wm)})
r = []
for m in range(1, 13):
    vs = sorted(v for k, v in day.items() if k[0] == m); n = len(vs) // 10
    r.append(stt.mean(vs) / vs[-1 - n])
print('solar mean/clear %.2f' % stt.mean(r))
