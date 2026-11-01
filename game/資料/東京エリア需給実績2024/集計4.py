"""東京エリア 2024年：火力（LNG・石炭・石油・その他）の 出力の 1年の 最大 ÷ 平均（火力が ふだんの 何倍まで 出したか）"""
import sys, os, glob, statistics as stt
th = []
for p in sorted(glob.glob(os.path.join(sys.argv[1], '*.csv'))):
    for ln in open(p, 'rb').read().decode('utf-8', 'replace').splitlines():
        c = ln.split(',')
        if len(c) < 19 or not c[0][:4].isdigit(): continue
        v = [float(x or 0) for x in c[2:20]]; th.append(sum(v[2:6]))
print('thermal max/mean %.2f  (max %.0f MW, mean %.0f MW)' % (max(th) / stt.mean(th), max(th), stt.mean(th)))
