---
locale: en
slug: getic
title: 3D catalogue of MikroTik networking hardware for Getic
description: More than 50 optimized 3D models of MikroTik hardware for an interactive catalogue, catalogue assets and product videos for an international distributor with offices in Latvia and Germany.
client: Getic
industry: Networking hardware and e-commerce
categories:
  - orgtech
position: 1
featured: true
status: published
navigation: false
period: 2021-2026
engagement: completed
clientUrl: https://www.getic.com/
services:
  - 3D models for web viewers
  - Product animations
  - Catalogue renders for product pages
  - Renders in interior scenes
metrics:
  - value: 50+
    label: models for the web catalogue
  - value: 2021–2026
    label: length of the engagement
  - value: WebGL
    label: prepared for interactive viewing
cover:
  src: /media/projects/getic/router-collection-hero.png
  alt: A collection of networking hardware models on a dark background
  width: 2880
  height: 1620
model:
  src: /media/projects/getic/mikrotik-lhg-60g.glb
  alt: 'Interactive 3D model of the MikroTik LHG 60G router — rotate and inspect the device'
  width: 2880
  height: 1620
  autoRotate: true
  emissivePulse: 5
  emissivePulseHz: 0.7
  metalness: 0.88
  diffuseLift: 30
  rotation: 180
  autoRotateSpeed: 1.2
  environmentIntensity: 0.5
  hemisphereLight: 0.5
  keyLight: 0.8
  fillLight: 0.4
  zoomMin: 1.2
  zoomMax: 1.7
media:
  - src: /media/projects/getic/rb5009-production.mp4
    alt: A promo video of the MikroTik RB5009 router with captions, rotation and views of the device from every side
    width: 1920
    height: 1016
    kind: video
    autoplay: true
    loop: true
    poster: /media/projects/getic/mikrotik-router-neon.png
  - src: /media/projects/getic/hex-poe-router.png
    alt: A white MikroTik hEX PoE router with five Ethernet ports on a white background
    width: 1130
    height: 620
    kind: image
  - src: /media/projects/getic/cloud-router-switch.png
    alt: A rack-mounted MikroTik Cloud Router Switch with Ethernet and SFP ports on a white background
    width: 1130
    height: 620
    kind: image
  - src: /media/projects/getic/getic-port-insert-animation.mp4
    alt: A 3D animation of a network cable being plugged into a MikroTik switch
    width: 1280
    height: 1280
    kind: video
    loop: true
    triple: true
    poster: /media/projects/getic/getic-port-insert-poster.jpg
  - src: /media/projects/getic/getic-cable-coil-animation.mp4
    alt: A 3D animation of a network cable coiling into a spiral
    width: 1280
    height: 1280
    kind: video
    loop: true
    triple: true
    poster: /media/projects/getic/getic-cable-coil-poster.jpg
  - src: /media/projects/getic/getic-connector-types-animation.mp4
    alt: A 3D animation of patch cords with different connector types
    width: 1280
    height: 1280
    kind: video
    loop: true
    triple: true
    poster: /media/projects/getic/getic-connector-types-poster.jpg
  - src: /media/projects/getic/folder5-2.jpg
    alt: Five switches in pastel colours on diagonal colour bands
    width: 1680
    height: 945
    kind: image
    wide: true
  - src: /media/projects/getic/behance-l009.jpg
    alt: "Three MikroTik switches on podiums: red, white and black"
    width: 1400
    height: 1400
    kind: image
    triple: true
  - src: /media/projects/getic/crs309-51.jpg
    alt: A MikroTik CRS309 switch on a marble surface lit by diagonal light
    width: 1400
    height: 1400
    kind: image
    triple: true
  - src: /media/projects/getic/crs312-61.jpg
    alt: A MikroTik CRS312 switch on a wooden shelf with books in sunlight
    width: 1400
    height: 1400
    kind: image
    triple: true
  - src: /media/projects/getic/mikrotik-router-neon.png
    alt: A black MikroTik router with cooling fins against purple and pink light strips
    width: 1920
    height: 1080
    kind: image
    wide: true
---

## The task

Getic is an international distributor of MikroTik hardware with offices in Latvia and Germany. The library was not built for a one-off shoot but for a catalogue that keeps growing: every new item has to join the existing row and open in the viewer right on its product page.

The source data consisted of drawings, dimensions and photographs of the real devices.

## The work

We created more than 50 models of networking hardware and prepared them for use on the web:

- modeling of housings, ports, connectors and cooling elements;
- PBR texturing: normal, metallic/roughness, height and emissive maps for the indicator lights;
- a single delivery pipeline — eight files per model (FBX plus the map set), so every new item is picked up by the engine without manual work;
- two geometry versions for different jobs: a heavy one for catalogue renders and a lightweight one for mobile traffic, where model weight decides everything;
- texture compression for the engine: JPEG 2k/4k, DXT5 for the normal maps;
- catalogue renders for the product pages;
- product animation and promo videos.

A separate strand of work covered short animations of the cable products for their catalogue cards: plugging a cable into a switch port, a cable coiling into a spiral, a run through the connector types.

Integrating the models into the CMS and into the Three.js viewer was handled by the client's team. GLUKE did not develop the Getic website and did not build the 3D viewer itself.

## The result

A library of 50+ models in the agreed formats, catalogue imagery and video assets. The models are prepared for interactive viewing in the browser, so the same asset serves both the web catalogue and the renders.

The catalogue with the 3D viewer on its product pages is publicly available — [getic.ru/shop/mikrotik](https://www.getic.ru/shop/mikrotik).
