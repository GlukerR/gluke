---
locale: en
slug: pleprism
title: Pleprism — a pure WebGL 3D prism for a site header
description: 'A volumetric prism computed by a shader rather than built from polygons: 27 KB with no dependencies and no build step, the logo fused into the material of the faces, dropped into any site with one line.'
client: In-house project
industry: Web graphics and widgets
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
  widget: prism
  alt: An interactive 3D prism — it spins on its own and moves away from the cursor
  logo: /media/projects/pleprism/g-mark.svg
  tunable: true
  params:
    height: 2
    baseWidth: 3.5
    scale: 2.1
    phase: [1, 4.3, 2.2]
    saturation: 1.4
    colorFrequency: 1
    glow: 1
    bloom: 1.05
    spin: 0.22
    timeScale: 0.5
    tilt: 0.18
    # Флаг виджета назван наоборот своему эффекту: при `true` призма
    # следует за курсором, при `false` — уходит от него. Проверено
    # замером: yaw +0.84 уводит яркую грань на противоположную сторону.
    invert: false
    hoverStrength: 0.85
    hoverStrengthY: 0.35
    inertia: 0.055
    logoScale: 0.44
    logoY: 0.36
    logoGlow: 16
    logoDepth: 0.13
metrics:
  - value: 27 KB
    label: widget size, 9.8 KB gzipped
  - value: "0"
    label: dependencies and build steps
  - value: SDF
    label: volume computed by a shader, not polygons
cover:
  src: /media/projects/pleprism/pleprism-cover.jpg
  alt: A 3D prism glowing purple and magenta with the GLUKE logo on its faces
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
- the idle spin is combined with an inverted, damped response to the cursor: the prism moves away from the mouse rather than following it;
- performance guards: caps on devicePixelRatio and buffer area, rendering paused off-screen, and the system "reduce motion" setting respected.

## The result

A single 27 KB file, 9.8 KB compressed, with no dependencies and no build step. The live prism at the top of this page is that file, not a video.

Everything is computed by the shader, so the weight does not depend on how complex the shape is: the geometry has no vertices, no triangles and no textures. The cost sits elsewhere — in fill rate: a hundred steps for every pixel of every frame. Hence the resolution caps on narrow screens, without which a phone would heat up for the sake of a background decoration.
