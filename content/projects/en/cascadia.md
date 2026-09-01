---
locale: en
slug: cascadia
title: Interactive 3D residential environment in Unreal Engine 5
description: "An interactive 3D environment of a residential complex in Unreal Engine 5: buyers explore the buildings in real time, with dynamic weather and seasons."
client: Cascadia
industry: Interactive real estate presentations
categories:
  - exteriors
position: 14
featured: false
status: published
navigation: false
period: "2025"
engagement: completed
services:
  - Interactive 3D environment in Unreal Engine 5
  - Environment and landscape
  - Lighting, materials and weather
  - Dynamic weather and time of day
  - Real-time optimization
about: |
  For three residential complexes — Kaskada, Visioner and Greenwood — we built an interactive 3D environment in Unreal Engine 5: buyers explore the buildings and grounds in real time, switch the time of day and weather, and view the quarter in different seasons.

  The scene arrived raw from the client — 17,000 objects after importing from Revit, unoptimized, with no materials set up — so the project was rebuilt from scratch: building and glass materials reworked, landscape, roads, parking lots, playgrounds and greenery created, trees and plants placed.

  Lighting and dynamic weather (sun, clouds, rain, snow) with a day/night cycle were set up separately, and the scene was optimized for a stable 80 FPS. Development was paused before release.
metrics:
  - value: "3"
    label: "residential complexes: Kaskada, Visioner, Greenwood"
  - value: Optimization
    label: of the project for a stable 80 FPS
  - value: Interactive
    label: weather and time-of-day switching
cover:
  src: /media/projects/cascadia/cover.jpg
  alt: Residential complex — interactive 3D environment in Unreal Engine 5, view of the building facade with parking and landscaping
  width: 1680
  height: 945
media:
  - src: /media/projects/cascadia/cascadia-green.jpg
    alt: Interactive residential environment — view of the quarter among green hills
    width: 1280
    height: 720
    kind: image
  - src: /media/projects/cascadia/render-top-01.jpg
    alt: Interactive residential environment — aerial view, quarter with landscaping
    width: 1680
    height: 1120
    kind: image
  - src: /media/projects/cascadia/cascadia-aerial-day.jpg
    alt: Interactive residential environment — elevated view of the whole complex with roads and trees
    width: 1680
    height: 992
    kind: image
  - src: /media/projects/cascadia/cascadia-extra.jpg
    alt: Interactive residential environment — winter aerial view, snow-covered hills and trees
    width: 1680
    height: 1254
    kind: image
  - src: /media/projects/cascadia/cascadia-day.jpg
    alt: Interactive residential environment — daytime view of the buildings from street level
    width: 1280
    height: 774
    kind: image
  - src: /media/projects/cascadia/cascadia-entrance.jpg
    alt: Interactive residential environment — entrance group with a plaza
    width: 888
    height: 594
    kind: image
  - src: /media/projects/cascadia/cascadia-plaza.jpg
    alt: Interactive residential environment — the complex towers against the sky with a road and trees
    width: 1680
    height: 944
    kind: image
  - src: /media/projects/cascadia/cascadia-flyover.mp4
    alt: Flyover video of the Cascada residential complex — camera animation around the buildings on a hillside
    width: 1920
    height: 1080
    kind: video
    loop: true
---

## Task

A residential complex needed an interactive real-time 3D environment in Unreal Engine 5: buyers were supposed to explore the territory and buildings in real time, with changing time of day, weather and seasons. The scene arrived raw from the client — 17,000 objects after importing from Revit, unoptimized, with no materials set up.

## What GLUKE did

- cleaning 17,000 empty objects from the scene after the Revit import;
- PBR material setup for buildings, landscape and glass (Parallax Windows);
- landscape: terrain, roads, curbs, parking lots, playgrounds, bus stops; automatic height-blended material;
- tree and plant placement (Quixel Megascans), LOD, shadows and wind setup;
- lighting through Ultra Dynamic Sky: day/night cycle and four weathers (sun, clouds, rain, snow) with post-processing;
- real-time optimization: Virtual Textures, master materials via instances, World Partition, 80 FPS target;
- Blueprint systems for dynamic weather and time of day.

## Result

A working UE5 environment with dynamic weather and time of day, dressed surroundings for three residential complexes and stable performance. Development was paused before release.
