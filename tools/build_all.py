# Одна команда — все сборки «Ночного тарифа» сразу (владелец: «все изменения должны происходить во всех сборках одновременно»):
#   1) сайт index.html (он же мини-приложения ВК, Telegram и MAX — у них тот же адрес),
#   2) офлайн-файл night-fare-offline.html (модели внутри файла),
#   3) Пикабу: pikabu/index.html (напрямую через Пикабу) и dist/pikabu + архив dist/nochnoy-tarif-pikabu.zip (для Студии),
#   4) проверка старых браузеров (ES2018) и одинаковой версии во всех сборках.
# Исходник игры — src/game.html, шапка сайта — src/head_site.html. Запуск: python3 tools/build_all.py
import base64, os, re, subprocess, sys, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
src = open(P('src', 'game.html'), encoding='utf-8').read()
head = open(P('src', 'head_site.html'), encoding='utf-8').read()
i = src.index('</style>\n') + len('</style>\n')
out = head + src[:i] + '</head>\n<body>\n' + src[i:].rstrip('\n') + '\n</body>\n</html>\n'
open(P('index.html'), 'w', encoding='utf-8').write(out)
files = ['city.glb', 'anims.glb'] + ['chars/%s.glb' % n for n in 'gleb timur artem savva rustam kira maya zoya olga nika thug1 thug2 thug3 boss vera mark crow'.split()]
emb = '<script>window.NF_ASSETS = {' + ','.join('"%s":"%s"' % (f, base64.b64encode(open(P('assets', f), 'rb').read()).decode()) for f in files) + '};</script>\n'
tag = '<script src="lib/three/build/three.min.js"></script>'
assert out.count(tag) == 1, 'three.js tag not found once'
open(P('night-fare-offline.html'), 'w', encoding='utf-8').write(out.replace(tag, emb + tag))
print('site + offline:', len(out), 'bytes')
subprocess.run([sys.executable, P('tools', 'build_pikabu.py')], check=True)
# old browsers
lc = subprocess.run(['node', P('tools', 'legacy-check.js'), P('index.html')], capture_output=True, text=True)
print((lc.stdout or lc.stderr).strip().splitlines()[-1] if (lc.stdout or lc.stderr) else 'legacy check: no output')
if lc.returncode: print('!! legacy check failed (if acorn is missing: npm i --prefix tools acorn)'); sys.exit(1)
# the same version everywhere
ver = lambda t: (re.search(r"APP_VER = '(v\d+)'", t) or [None, '?'])[1]
vs = {f: ver(open(P(f), encoding='utf-8').read()) for f in ['index.html', 'night-fare-offline.html', 'pikabu/index.html', 'dist/pikabu/index.html']}
vs['dist/nochnoy-tarif-pikabu.zip'] = ver(zipfile.ZipFile(P('dist', 'nochnoy-tarif-pikabu.zip')).read('index.html').decode('utf-8'))
print('versions:', vs)
if len(set(vs.values())) != 1: print('!! the builds have different versions'); sys.exit(1)
print('all builds:', ver(src))
