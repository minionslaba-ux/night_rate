# Промпты для генерации 3D-моделей «Ночного тарифа»

Для генераторов вроде Meshy, Tripo или Rodin. Промпты на английском: так генераторы понимают лучше. Перед каждым — что это и где будет в игре.

## Общие требования (вставлять в каждый промпт или задать в настройках)

```
game-ready low-poly asset, realistic PBR materials, clean topology, single object, no ground plane, no background,
neutral lighting, no text, no logos, no brand names, no license plates, real-world scale in meters
```

Технически:
- **Формат** GLB, ось Y вверх, перед модели смотрит на +Z, точка опоры — центр основания (низ модели на нуле).
- **Треугольники:** мелкий предмет 1–4 тыс., машина 15–25 тыс., здание-ориентир 10–30 тыс.
- **Текстуры:** одна текстура 1024 px (base color + roughness/metallic + normal). На iPhone игра сама уменьшит до 512.
- **Без надписей и логотипов** — марки машин, названия фирм и реальные гербы нельзя. Вывески игра рисует сама.
- **Имя файла** — латиницей, как в списке ниже (например `paris_kiosk.glb`), класть в `assets/models/props/`.

---

## 1. Париж (эпизод 20)

**paris_kiosk.glb** — круглая афишная тумба с куполом (стоит на тротуарах).
```
Parisian advertising column, round dark green cast-iron column with a small dome roof and decorative crown, blank poster surface, 3 m tall, low-poly game asset
```

**paris_cafe_set.glb** — столик кафе с двумя стульями.
```
Parisian bistro set: small round marble-top table with black cast-iron base and two rattan bistro chairs, low-poly game asset
```

**paris_lamp.glb** — уличный фонарь.
```
ornate 19th-century Paris street lamp, black cast-iron post with lantern head, warm glass, 4.5 m tall, low-poly game asset
```

**paris_fountain.glb** — питьевой фонтанчик.
```
small ornate green cast-iron drinking fountain with four caryatid figures holding a dome, 2.7 m tall, low-poly game asset
```

**paris_moped.glb** — мопед «Ласточек».
```
small black 50cc moped scooter, matte black with chrome details, top case box at the back, 1.8 m long, low-poly game asset
```

**paris_boat.glb** — речной катер на Сене.
```
small dark river motorboat with a low cabin, wooden deck, 9 m long, no markings, low-poly game asset
```

**paris_newsstand.glb** — газетный киоск.
```
Parisian green newsstand kiosk with small curved roof, closed shutters, 3 m wide, low-poly game asset
```

**paris_metro_entrance.glb** — вход в метро (стиль модерн, без надписей).
```
art nouveau metro station entrance, green cast-iron railings shaped like plant stems with two amber globe lamps, stairs going down, no signage, low-poly game asset
```

**paris_tower.glb** — железная башня (силуэт для финала, без деталей ближе 50 м).
```
tall lattice iron tower, brown-bronze wrought iron, four curved legs, three observation platforms, simplified silhouette for distant view, 300 m tall, low-poly game asset
```

## 2. Лондон (эпизод 21)

**london_phone_box.glb** — красная телефонная будка (без надписей и короны).
```
red cast-iron telephone box with domed roof and small window panes, no text, no emblems, 2.5 m tall, low-poly game asset
```

**london_postbox.glb** — красный почтовый столбик.
```
red cylindrical cast-iron pillar post box with black base and cap, no text, no emblems, 1.6 m tall, low-poly game asset
```

**london_bus.glb** — двухэтажный автобус (без надписей).
```
red double-decker city bus, modern rounded design, two floors of windows, open rear platform door, no text, no advertisements, 11 m long, low-poly game asset
```

**london_cab.glb** — чёрное такси (своя форма, не копия реальной модели).
```
classic black hackney-style taxi cab, rounded upright body, tall roof, yellow roof light without text, 4.6 m long, generic design not a real car brand, low-poly game asset
```

**london_lamp.glb** — фонарь викторианский.
```
Victorian street lamp, dark green cast-iron post with four-sided glass lantern, 4 m tall, low-poly game asset
```

**london_bench.glb** — скамья набережной.
```
Victorian embankment bench, dark green cast-iron sides with ornate pattern and wooden slats, 2 m long, low-poly game asset
```

**london_clock_tower.glb** — часовая башня (для миссии «по бою часов», своя, не копия реальной).
```
tall gothic revival clock tower, yellow-grey limestone, large illuminated clock faces on four sides, pointed spire roof, 90 m tall, original design, low-poly game asset
```

**london_bascule_bridge.glb** — разводной мост с двумя башнями.
```
gothic stone bascule bridge with two tall towers and high walkways between them, road deck in the middle, original design, 240 m long, low-poly game asset
```

## 3. Нью-Йорк (эпизод 22)

**ny_hydrant.glb** — пожарный гидрант.
```
red-yellow cast-iron fire hydrant, 0.8 m tall, low-poly game asset
```

**ny_hotdog_cart.glb** — тележка с хот-догами.
```
street food cart with steel body, striped umbrella, small grill and cooler, no text, 2 m long, low-poly game asset
```

**ny_water_tower.glb** — водонапорный бак на крыше.
```
rooftop wooden water tank on steel legs with conical roof and ladder, 6 m tall, low-poly game asset
```

**ny_fire_escape.glb** — пожарная лестница (секция на один этаж).
```
black steel fire escape section for one floor: balcony platform with railing and a diagonal stair, 5 m wide, 3.4 m tall, low-poly game asset
```

**ny_yellow_cab.glb** — жёлтое такси (своя форма).
```
yellow city taxi sedan, generic modern design not a real car brand, roof sign without text, checker stripe on doors, 4.9 m long, low-poly game asset
```

**ny_subway_entrance.glb** — вход в метро.
```
city subway entrance stairs with green steel railings and two globe lamps, no signage, low-poly game asset
```

**ny_steam_stack.glb** — оранжево-белая труба пара на дороге.
```
orange and white striped road steam chimney tube, 2 m tall, low-poly game asset
```

**ny_newspaper_boxes.glb** — ряд газетных автоматов.
```
row of four colorful metal newspaper vending boxes, no text, low-poly game asset
```

**ny_crane.glb** — башенный кран (для миссии на балках).
```
construction tower crane, yellow lattice mast and jib, counterweight, 60 m tall, low-poly game asset
```

**ny_liberty_ferry.glb** — паром (миссия «Последний паром»).
```
orange passenger ferry boat, two decks, rounded bow, no text, 60 m long, low-poly game asset
```

## 4. Порт-Северный и сезон 3

**ps_bus_stop.glb** — остановка.
```
modern city bus shelter with glass panels, bench and small roof, no advertisements, 4 m wide, low-poly game asset
```

**ps_trash_container.glb** — мусорный контейнер.
```
green steel dumpster with plastic lid, slightly dirty, 2 m long, low-poly game asset
```

**ps_barrier.glb** — бетонный блок-ограждение.
```
concrete jersey road barrier with red-white stripes, 2 m long, low-poly game asset
```

**ps_kiosk_shawarma.glb** — ночной ларёк.
```
small night street food kiosk, metal booth with serving window and awning, warm light inside, no text, 3 m wide, low-poly game asset
```

**ps_gang_suv.glb** — чёрный внедорожник «Монолита».
```
black armored full-size SUV, tinted windows, bull bar, generic design not a real car brand, 5.2 m long, low-poly game asset
```

**ps_police_car.glb** — полицейская машина (своя раскраска).
```
white and blue police sedan with roof light bar, generic design not a real car brand, no text, 4.8 m long, low-poly game asset
```

**ps_motel_sign.glb** — вывеска мотеля на столбе (без текста — текст рисует игра).
```
retro roadside motel sign on a tall pole, arrow shape with bulb border, blank sign face, 8 m tall, low-poly game asset
```

**ps_container_ship.glb** — контейнеровоз у причала.
```
container ship with stacked colorful shipping containers, dark hull, no text, 120 m long, low-poly game asset
```

## 5. Персонажи (если будешь делать новых)

Нужны в позе T, без оружия в руках, рост 1,75–1,85 м, до 15 тыс. треугольников, одна текстура 1024. Риг игра не берёт из генератора: анимации общие, ставлю сам.

```
realistic adult man, taxi driver, leather jacket, jeans, short dark hair, T-pose, full body, game-ready low-poly character, no accessories in hands
```
```
realistic adult woman, journalist, long coat, scarf, shoulder bag, T-pose, full body, game-ready low-poly character
```
```
gang member, black hoodie, red bandana around neck, cargo pants, sneakers, T-pose, full body, game-ready low-poly character
```

---

## Как передать мне готовые модели

1. Скачай GLB (в настройках экспорта: «GLB», «Y up», текстуры внутри файла).
2. Назови файл как в списке.
3. Пришли файлы сюда или положи в папку `assets/models/props/` в репозитории.

Каждую модель я проверю: размер, треугольники, вес файла и как она выглядит в игре на телефоне. Если что-то не подойдёт, скажу, что поправить в промпте.
