---
locale: ru
slug: cascadia
title: Интерактивная 3D-среда жилого комплекса в Unreal Engine 5
description: "Интерактивная 3D-среда жилого комплекса в Unreal Engine 5: осмотр домов и территории в реальном времени, динамическая погода, смена сезонов."
client: Каскад
industry: Интерактивные презентации недвижимости
categories:
  - exteriors
position: 14
featured: false
status: published
navigation: false
period: "2025"
engagement: completed
services:
  - Интерактивная 3D-среда в Unreal Engine 5
  - Окружение и ландшафт
  - Освещение, материалы и погода
  - Динамическая погода и время суток
  - Оптимизация под real-time
metrics:
  - value: "3"
    label: "жилых комплекса: Kaskada, Visioner, Greenwood"
  - value: Оптимизация
    label: проекта под стабильные 80 FPS
  - value: Интерактивно
    label: смена погоды и времени суток
cover:
  src: /media/projects/cascadia/cover.jpg
  alt: Жилой комплекс — интерактивная 3D-среда в Unreal Engine 5, вид на фасад здания с парковкой и озеленением
  width: 1680
  height: 945
media:
  - src: /media/projects/cascadia/cascadia-green.jpg
    alt: Интерактивная среда жилого комплекса — вид на квартал среди зелёных холмов
    width: 1280
    height: 720
    kind: image
  - src: /media/projects/cascadia/render-top-01.jpg
    alt: Интерактивная среда жилого комплекса — вид сверху, квартал с благоустройством
    width: 1680
    height: 1120
    kind: image
  - src: /media/projects/cascadia/cascadia-aerial-day.jpg
    alt: Интерактивная среда жилого комплекса — вид с высоты на весь комплекс с дорогами и деревьями
    width: 1680
    height: 992
    kind: image
  - src: /media/projects/cascadia/cascadia-extra.jpg
    alt: Интерактивная среда жилого комплекса — зимний вид с высоты, заснеженные холмы и деревья
    width: 1680
    height: 1254
    kind: image
  - src: /media/projects/cascadia/cascadia-day.jpg
    alt: Интерактивная среда жилого комплекса — дневной вид на здания с уровня улицы
    width: 1280
    height: 774
    kind: image
  - src: /media/projects/cascadia/cascadia-entrance.jpg
    alt: Интерактивная среда жилого комплекса — входная группа с площадью
    width: 888
    height: 594
    kind: image
  - src: /media/projects/cascadia/cascadia-plaza.jpg
    alt: Интерактивная среда жилого комплекса — башни комплекса на фоне неба с дорогой и деревьями
    width: 1680
    height: 944
    kind: image
  - src: /media/projects/cascadia/cascadia-flyover.mp4
    alt: Видеооблёт жилого комплекса Каскад — анимация камеры вокруг зданий на склоне
    width: 1920
    height: 1080
    kind: video
    loop: true
---

## Задача

Три жилых комплекса — Kaskada, Visioner и Greenwood — нужно было показать покупателю не картинкой, а средой, по которой можно пройти самому. Сцена пришла от клиента сырой: 17 000 объектов после импорта из Revit, без оптимизации и настроенных материалов.

## Ход работы

- очистка сцены от 17 000 пустых объектов после импорта из Revit;
- настройка PBR-материалов зданий, ландшафта и стекла (Parallax Windows);
- ландшафт: рельеф, дороги, бордюры, парковки, детские площадки, автобусные остановки; автоматический материал с блендингом по высоте;
- расстановка деревьев и растений (Quixel Megascans), настройка LOD, теней и ветра;
- освещение через Ultra Dynamic Sky: смена дня/ночи и четырёх погод (солнце, тучи, дождь, снег) с пост-процессингом;
- оптимизация под real-time: Virtual Textures, мастер-материалы через инстансы, World Partition, цель 80 FPS;
- Blueprint-системы динамической погоды и времени суток.

## Результат

Рабочая UE5-сцена с динамической погодой и временем суток, настроенным окружением для трёх жилых комплексов и стабильной производительностью. Разработка проекта остановлена до релиза.
