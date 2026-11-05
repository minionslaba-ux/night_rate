# Модели оружия

14 стволов — набор **Flat Guns East / West** из [petroulacl/fps-asset-kit](https://github.com/petroulacl/fps-asset-kit) (лицензия **CC0**, можно в коммерческом проекте). Файлы переименованы по id из `weapons.json` (`assets/arsenal/models/<id>.glb`, сжаты meshopt).
В игре материалы заменяются на сталь/полимер/дерево/латунь (функции `wpnMat` и `wpnLoad` в index.html — по именам материалов `M_PCL_Flat_*`).

Гранатомёт «Шлагбаум» в наборе отсутствует: в игре это простая процедурная модель (труба, раструб, рукоять).

| id | исходная модель |
|---|---|
| shmel | Pistol_Compact_West |
| kobra | Pistol_Full_West |
| shershen | Pistol_Compact_East |
| buldog | Pistol_Full_East |
| pchela | SMG_Compact_West |
| ten | SMG_Full_West |
| vihr | SMG_Full_East |
| myasnik | Shotgun_Pump_West |
| taran | Shotgun_Auto_West |
| voron | Rifle_Assault_East |
| sokol | Rifle_Assault_West |
| molot | Rifle_Battle_West |
| polyarnik | Sniper_Rifle_West |
| beton | Sniper_Material_West |

Модели ориентированы стволом вдоль оси Z — в превью поворачиваются на −90° по Y.
