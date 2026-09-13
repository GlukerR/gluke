---
locale: ru
slug: rp-grand
title: Автомобильные ассеты для мобильной open-world игры — интерактивная 3D-модель
description: 'Модульные автомобильные ассеты для мобильной open-world игры: варианты обвеса переключаются в реальном времени, LOD0/1/2 под дистанцию, перекраска без текстур — по UV-маске шейдером. Интерактивная модель прямо в кейсе.'
client: RP Grand
industry: Игровые ассеты
categories:
  - webgl
position: 30
featured: false
status: published
navigation: false
period: "2026"
updated: 2026-09-11
engagement: completed
clientUrl: https://rpgrand.com
services:
  - Модульные автомобильные ассеты
  - Варианты обвеса в одном файле
  - LOD0/1/2 под дистанцию
  - Перекраска без текстур — шейдером по UV-маске
metrics:
  - value: 9 тыс.
    label: трисов — полная сборка в LOD0
  - value: 3×3×3
    label: вариантов бамперов, юбок и спойлеров
  - value: LOD0/1/2
    label: три уровня детализации под дистанцию
cover:
  src: /media/projects/rp-grand/rp-grand-cover.jpg
  alt: Спортивный купе с тёмным кузовом, повёрнутое в три четверти, на тёмном фоне
  width: 1680
  height: 945
model:
  src: /media/projects/rp-grand/coupe-gt-lod0.glb
  alt: 'Интерактивная 3D-модель автомобиля — вращайте и осматривайте кузов и детали'
  width: 1680
  height: 945
  autoRotate: true
  autoRotateSpeed: 1.4
  metalness: 0.75
  diffuseLift: 12
  rotation: 180
  environmentIntensity: 0.6
  hemisphereLight: 0.6
  keyLight: 0.9
  fillLight: 0.45
  zoomMin: 1.1
  zoomMax: 1.6
  fit: 0.85
  canvasScale: 1
configurator:
  manifest: /media/projects/rp-grand/coupe-gt.json
  garage:
    src: /media/projects/rp-grand/garage.glb
    # зал большой, а реквизит (верстак, антресоль, чужие машины) стоит уже
    # в 6 м от нашей: с общим кадрированием камера упиралась бы в него.
    # fit задаёт саму дистанцию (≈6,0 м), zoomMax — предел отъезда (6,3 м)
    fit: 0.77
    zoomMax: 1.26
    # облёт — полный круг: зал замкнут, меши есть со всех сторон и стопорить
    # камеру нечем. Дуга (`orbitFrom`/`orbitTo`) осталась полем для окружений
    # с проёмом в стене — здесь она не задана
    # по высоте — от уровня машины и не выше 38°: выше камера уходит
    # под крышу зала (она висит примерно в 4,5 м над машиной)
    tiltFrom: 3
    tiltTo: 38
  # музыка зала: трек подхватывается только после сборки сцены, играет
  # с нулевой громкости и набирает её за 4 с; выключается кнопкой в углу сцены
  audio:
    tracks:
      - src: /media/projects/rp-grand/audio/night-street-racing.mp3
        title: Night Street Racing
        artist: GVIDON
      - src: /media/projects/rp-grand/audio/race-till-sunset.mp3
        title: Race Till Sunset
        artist: LemonMusicStudio
      - src: /media/projects/rp-grand/audio/call-of-the-streets.mp3
        title: The Call of the Streets
        artist: LemonMusicStudio
    volume: 0.35
    fadeIn: 4
media: []
---

## Задача

Серия автомобильных ассетов для мобильной open-world игры. Модели должны быть game-ready: выдерживать real-time рендер на мобильных устройствах, переключаться между вариантами в рантайме и работать на любой дистанции — от витрины до проезжающей по улице машины.

## Ход работы

- каждая машина собрана модульно: бамперы, юбки и спойлеры — отдельные ноды с вариантами, все варианты лежат в одном файле и включаются/выключаются в рантайме;
- три уровня детализации: LOD0 — полная сборка для ближнего плана, LOD1 — для средней дистанции, LOD2 — силуэт для дальних улиц;
- перекраска без текстур: детали разложены по UV-маске, цвет подставляется шейдером — один ассет красится в любой цвет без отдельных файлов;
- материалы сведены к трём (кузов, салон, стекло) — минимум draw calls на сцену;
- геометрия оптимизирована под мобильный real-time: полная сборка — около девяти тысяч трисов.

## Результат

Модели приняты и вошли в вышедшую мобильную игру. В кейсе — живая 3D-модель: вращайте её мышью или пальцем, приближайте, рассматривайте детали. Это LOD0 — та же геометрия, что стоит в игре на ближней дистанции.