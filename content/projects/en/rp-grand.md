---
locale: en
slug: rp-grand
title: Vehicle assets for a mobile open-world game — interactive 3D model
description: 'Modular vehicle assets for a mobile open-world game: body-kit variants switch in real time, LOD0/1/2 for draw distance, repainting without textures — by UV mask in a shader. The interactive model lives right in the case.'
client: RP Grand
industry: Game assets
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
  - Modular vehicle assets
  - Body-kit variants in a single file
  - LOD0/1/2 for draw distance
  - Repainting without textures — shader by UV mask
metrics:
  - value: 9k
    label: triangles — full build at LOD0
  - value: 3×3×3
    label: bumper, skirt and spoiler variants
  - value: LOD0/1/2
    label: three levels of detail for draw distance
cover:
  src: /media/projects/rp-grand/rp-grand-cover.jpg
  alt: A sports coupe with a dark body, turned three-quarters, on a dark background
  width: 1680
  height: 945
model:
  src: /media/projects/rp-grand/coupe-gt-lod0.glb
  alt: 'Interactive 3D model of a car — rotate and inspect the body and details'
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
  vehicles:
    - manifest: /media/projects/rp-grand/coupe-gt.json
      thumb: /media/projects/rp-grand/vehicles/coupe-gt.webp
    - manifest: /media/projects/rp-grand/coupe-sport.json
      thumb: /media/projects/rp-grand/vehicles/coupe-sport.webp
    # длинная ось этой выгрузки повёрнута на 90° относительно остальных
    - manifest: /media/projects/rp-grand/coupe-jdm.json
      rotation: 90
      thumb: /media/projects/rp-grand/vehicles/coupe-jdm.webp
    - manifest: /media/projects/rp-grand/roadster.json
      thumb: /media/projects/rp-grand/vehicles/roadster.webp
    - manifest: /media/projects/rp-grand/sedan.json
      thumb: /media/projects/rp-grand/vehicles/sedan.webp
    - manifest: /media/projects/rp-grand/sedan-awd.json
      thumb: /media/projects/rp-grand/vehicles/sedan-awd.webp
    - manifest: /media/projects/rp-grand/crossover-ev.json
      thumb: /media/projects/rp-grand/vehicles/crossover-ev.webp
  garage:
    src: /media/projects/rp-grand/garage.glb
    # the hall is big while the props (bench, mezzanine, other cars) already
    # stand about 6 m from ours: with the shared framing the camera would run
    # into them. `fit` sets the distance itself (≈6.0 m), `zoomMax` caps pull-back
    fit: 0.77
    zoomMax: 1.26
    # the orbit is a full circle: the hall is closed, there is geometry on every
    # side and nothing to stop the camera on. The arc (`orbitFrom`/`orbitTo`)
    # stays as a field for environments with a gap in the wall; unused here
    # vertically from the car's level up to 38°: any higher and the camera goes
    # under the hall roof (it hangs roughly 4.5 m above the car)
    tiltFrom: 3
    tiltTo: 38
  # hall music: the track is picked up only after the scene is built, starts at
  # zero volume and ramps up over 4 s; toggled by the button in the stage corner
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

## The task

A series of vehicle assets for a mobile open-world game. The models had to be game-ready: hold up in real-time rendering on mobile devices, switch between variants at runtime and work at any distance — from a showcase to a car driving past on the street.

## The work

- each car is built modular: bumpers, skirts and spoilers are separate nodes with variants, all variants live in one file and turn on and off at runtime;
- three levels of detail: LOD0 — the full build for close-ups, LOD1 — for mid distance, LOD2 — a silhouette for far streets;
- repainting without textures: parts are laid out on a UV mask, the colour is applied in a shader — one asset takes any colour with no extra files;
- materials are reduced to three (body, interior, glass) — minimal draw calls per scene;
- geometry is optimized for mobile real-time: the full build is about nine thousand triangles.

## The result

The models were accepted and shipped in the released mobile game. The case holds a live 3D model: rotate it with a mouse or a finger, zoom in, inspect the details. This is LOD0 — the same geometry the game uses at close range.