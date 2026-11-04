# Источники 3D-моделей

Все модели распространяются по лицензии **CC0 1.0** (общественное достояние): их можно использовать
в коммерческих проектах без указания авторства. Авторов всё равно указываем — это честно и помогает им.

| Что | Автор | Набор | Лицензия |
| --- | --- | --- | --- |
| Дома, машины, фонари, светофоры, скамейки, гидранты (`assets/city.glb`) | Kay Lousberg | [KayKit City Builder Bits](https://kaylousberg.itch.io/city-builder-bits) ([GitHub](https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0)) | CC0 1.0 |
| Персонажи и анимации (`assets/chars/*.glb`, `assets/anims.glb`) | Quaternius | [Ultimate Animated Character Pack](https://quaternius.com/packs/ultimatedanimatedcharacter.html) | CC0 1.0 |

## Что изменено

- Модели городского набора объединены в один файл `city.glb` с общей текстурой, геометрия сжата (KHR_mesh_quantization).
- У персонажей анимации вынесены в общий файл `anims.glb` (Idle, Walk, Run, Shoot_OneHanded, RecieveHit, Death, Victory, Defeat):
  у всех моделей один скелет, поэтому клипы подходят каждому. Цвета кожи и одежды задаются в игре.
- Соответствие персонажей игры исходным моделям: Глеб — Casual_Bald, Тимур — Casual2_Male, Артём — Soldier_Male,
  Савва — OldClassy_Male, Рустам — Casual3_Male, Кира — Casual2_Female, Майя — Casual_Female, Зоя — Soldier_Female,
  Ольга — BlueSoldier_Female, Ника — Ninja_Female; бандиты — Ninja_Male, Casual_Male, Casual3_Male; бригадир — Suit_Male.
