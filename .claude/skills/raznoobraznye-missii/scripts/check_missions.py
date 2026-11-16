#!/usr/bin/env python3
"""Проверка каталога миссий (скилл «Разнообразные миссии»).

Запуск: python3 check_missions.py docs/missii-katalog.md [--min-dist 300] [--gap 3]
Читает все строки markdown-таблиц, где есть колонки «Глава» и «Глагол».
Ошибки (код выхода 1):
  - в одной главе два одинаковых глагола;
  - глагол повторяется чаще, чем раз в --gap глав подряд;
  - больше одной миссии «сбор» или «удержание зоны» в главе;
  - старты миссий одной главы ближе --min-dist метров (если есть X и Z);
  - в главе из 4+ обычных миссий нет одного из типов: вождение, бой, спокойная, головоломка;
  - одинаковый твист в одной главе.
Предупреждения: пустые глагол/тип/твист/провал, одинаковая длина всех миссий главы.
"""
import math, re, sys
from collections import OrderedDict, defaultdict

LIMITED = {'сбор', 'удержание зоны', 'удержание', 'постоять в круге', 'собрать'}
TYPES = ['вождение', 'бой', 'спокойная', 'головоломка']


def norm(s):
    return re.sub(r'\s+', ' ', (s or '').strip().lower().replace('ё', 'е'))


def read_rows(path):
    rows, head = [], None
    for line in open(path, encoding='utf-8'):
        line = line.strip()
        if not line.startswith('|'):
            head = None
            continue
        cells = [c.strip() for c in line.strip('|').split('|')]
        if all(re.fullmatch(r':?-{2,}:?', c or '--') for c in cells):
            continue
        low = [norm(c) for c in cells]
        if 'глава' in low and 'глагол' in low:
            head = low
            continue
        if head and len(cells) >= len(head):
            rows.append({h: cells[i] for i, h in enumerate(head)})
    return rows


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__); return 2
    path = args[0]
    min_dist = float(args[args.index('--min-dist') + 1]) if '--min-dist' in args else 300.0
    gap = int(args[args.index('--gap') + 1]) if '--gap' in args else 3
    rows = read_rows(path)
    if not rows:
        print('Нет строк каталога: нужна таблица с колонками «Глава» и «Глагол».'); return 1
    chapters = OrderedDict()
    for r in rows:
        chapters.setdefault(r.get('глава', '?'), []).append(r)
    errors, warns = [], []
    last_seen = {}
    order = list(chapters)
    verb_count = defaultdict(int)
    for ci, ch in enumerate(order):
        ms = chapters[ch]
        seen, twists, limited = {}, {}, 0
        for m in ms:
            v = norm(m.get('глагол'))
            name = m.get('название') or m.get('№') or '?'
            if not v:
                warns.append(f'гл.{ch} «{name}»: пустой глагол'); continue
            verb_count[v] += 1
            if v in seen:
                errors.append(f'гл.{ch}: глагол «{v}» дважды — «{seen[v]}» и «{name}»')
            seen[v] = name
            if v in LIMITED:
                limited += 1
            if v in last_seen and ci - last_seen[v] < gap and last_seen[v] != ci:
                errors.append(f'гл.{ch} «{name}»: глагол «{v}» уже был в гл.{order[last_seen[v]]} (чаще, чем раз в {gap} главы)')
            tw = norm(m.get('твист'))
            if not tw:
                warns.append(f'гл.{ch} «{name}»: нет твиста')
            elif tw in twists:
                errors.append(f'гл.{ch}: одинаковый твист у «{twists[tw]}» и «{name}»')
            else:
                twists[tw] = name
            if not norm(m.get('провал')):
                warns.append(f'гл.{ch} «{name}»: не указано, как проигрывают')
        for m in ms:
            v = norm(m.get('глагол'))
            if v:
                last_seen[v] = ci
        if limited > 1:
            errors.append(f'гл.{ch}: {limited} миссии «сбор/удержание зоны» (можно не больше одной)')
        regular = [m for m in ms if norm(m.get('тип')) != 'босс']
        if len(regular) >= 4:
            have = {norm(m.get('тип')) for m in regular}
            miss = [t for t in TYPES if t not in have]
            if miss:
                errors.append(f'гл.{ch}: нет типов {", ".join(miss)}')
        pts = []
        for m in ms:
            try:
                pts.append((float(m.get('x', '')), float(m.get('z', '')), m.get('название') or '?'))
            except ValueError:
                pass
        for i in range(len(pts)):
            for j in range(i + 1, len(pts)):
                d = math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])
                if d < min_dist:
                    errors.append(f'гл.{ch}: старты «{pts[i][2]}» и «{pts[j][2]}» в {d:.0f} м (меньше {min_dist:.0f})')
        lens = [norm(m.get('длина')) for m in ms if norm(m.get('длина'))]
        if len(lens) >= 3 and len(set(lens)) == 1:
            warns.append(f'гл.{ch}: у всех миссий одинаковая длина ({lens[0]})')
    print(f'Миссий: {len(rows)}, глав: {len(order)}')
    print('Глаголы:', ', '.join(f'{v} ×{n}' for v, n in sorted(verb_count.items(), key=lambda x: -x[1])))
    for w in warns:
        print('  предупреждение:', w)
    for e in errors:
        print('  ОШИБКА:', e)
    print('Итог:', 'есть ошибки — переделать' if errors else 'ок')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
