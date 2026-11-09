# Сборка «Ночного тарифа» для Пикабу Игр (через GamePush): папка dist/pikabu и архив dist/nochnoy-tarif-pikabu.zip.
# Берёт собранный index.html сайта и:
#  - сообщает игре, что она на Пикабу (window.NF_PLATFORM = 'pikabu'): без нашего входа, ссылок на сайт и другие площадки, оплаты и рекламы сайта;
#  - подставляет проект GamePush (tools/pikabu.json: {"id": "...", "token": "..."} — публичные номер проекта и токен; без них SDK не подключается);
#  - убирает манифест и сервис-воркер (игра живёт на хостинге GamePush), ссылку canonical и метки соцсетей сайта.
# Запуск: python3 tools/build_pikabu.py
import json, os, re, shutil, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'pikabu')
cfg_path = os.path.join(ROOT, 'tools', 'pikabu.json')
cfg = json.load(open(cfg_path)) if os.path.exists(cfg_path) else {}
html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
html = re.sub(r'<link rel="manifest"[^>]*>\n?', '', html)
html = re.sub(r'<link rel="canonical"[^>]*>\n?', '', html)
html = re.sub(r'<meta property="og:[^>]*>\n?', '', html)
html = re.sub(r'<meta name="twitter:[^>]*>\n?', '', html)
tag = '<script>window.NF_PLATFORM = "pikabu"; window.NF_GP = %s;</script>\n' % json.dumps({'id': str(cfg.get('id', '')), 'token': str(cfg.get('token', ''))})
i = html.index('<meta charset="utf-8">') + len('<meta charset="utf-8">\n')
html = html[:i] + tag + html[i:]
assert '<link rel="manifest"' not in html
if os.path.exists(OUT): shutil.rmtree(OUT)
os.makedirs(OUT)
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(html)
for d in ['lib', 'assets', 'icons']: shutil.copytree(os.path.join(ROOT, d), os.path.join(OUT, d))
shutil.copy(os.path.join(ROOT, 'favicon.ico'), OUT)
z = os.path.join(ROOT, 'dist', 'nochnoy-tarif-pikabu.zip')
with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as f:
    for base, _, files in os.walk(OUT):
        for n in files:
            p = os.path.join(base, n); f.write(p, os.path.relpath(p, OUT))
print('pikabu build:', OUT, '| zip', round(os.path.getsize(z) / 1e6, 1), 'MB | GamePush project', cfg.get('id') or 'НЕ ЗАДАН')
