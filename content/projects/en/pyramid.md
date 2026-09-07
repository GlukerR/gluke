---
locale: en
slug: pyramid
title: Glowing pyramid — a pure WebGL 3D widget
description: 'A volumetric pyramid computed by a shader rather than built from polygons: 30 KB with no dependencies and no build step, the logo fused into the material of the faces, dropped into any site with one line.'
client: Web graphics
industry: Widgets
categories:
  - webgl
position: 22
featured: false
status: published
navigation: false
period: "2026"
updated: 2026-09-05
engagement: completed
services:
  - SDF raymarch shader
  - Widget for a site header
  - Palette tuned to the brand
  - Optimization for mobile
demo:
  widget: pyramid
  alt: An interactive 3D pyramid — it spins on its own and moves away from the cursor
  logo: /media/projects/pyramid/g-mark.svg
  tunable: true
  params:
    rise: 2
    baseSpan: 3.5
    zoom: 2.1
    hues: [1, 4.3, 2.2]
    vividness: 1.4
    bandRate: 1
    radiance: 1
    flare: 1.05
    drift: 0.22
    flowRate: 0.5
    lean: 0.18
    # Флаг назван наоборот своему эффекту: при `true` призма следует за
    # курсором, при `false` — уходит от него. Проверено замером: разворот
    # +0.84 уводит яркую грань на сторону, противоположную курсору.
    recoil: false
    swayX: 0.85
    swayY: 0.35
    easing: 0.055
    markSize: 0.44
    markHeight: 0.36
    markGlow: 16
    markDepth: 0.13
metrics:
  - value: 30 KB
    label: widget size, 10 KB gzipped
  - value: "0"
    label: dependencies and build steps
  - value: SDF
    label: volume computed by a shader, not polygons
cover:
  src: /media/projects/pyramid/pyramid-cover.jpg
  alt: A 3D pyramid outlined in a rainbow gradient — magenta along the upper edges, blue and green toward the base — with the GLUKE logo near the apex
  width: 1680
  height: 945
media: []
---

## The task

A site header needs an object that looks expensive and weighs nothing. The usual route is a model plus an engine: three.js alone pulls in hundreds of kilobytes, the model file comes on top, and all of it serves one shape that simply spins nicely.

We wanted to skip the model entirely and end up with a widget that drops into any site — Tilda, WordPress, plain HTML — in two lines and with no build step.

## The work

- the pyramid is described mathematically: an SDF of an anisotropic octahedron intersected with a half-space, so no model file exists at all;
- volume and glow are accumulated by a raymarch loop, a hundred steps per pixel, gathering colour along the ray;
- the logo is not a texture stuck on top — it is mixed into the material inside the marching loop, so it glows with the same light as the face and sits beneath its surface;
- the palette is exposed as parameters: the R/G/B phases are the main control, and the whole character of the glow follows from them;
- the idle spin is combined with an inverted, damped response to the cursor: the pyramid moves away from the mouse rather than following it;
- performance guards: caps on devicePixelRatio and buffer area, rendering paused off-screen, and the system "reduce motion" setting respected.

## The result

A single 30 KB file, 10 KB compressed, with no dependencies and no build step. The live pyramid at the top of this page is that file, not a video.

Everything is computed by the shader, so the weight does not depend on how complex the shape is: the geometry has no vertices, no triangles and no textures. The cost sits elsewhere — in fill rate: a hundred steps for every pixel of every frame. Hence the resolution caps on narrow screens, without which a phone would heat up for the sake of a background decoration.
