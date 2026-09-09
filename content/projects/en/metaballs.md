---
locale: en
slug: metaballs
title: Metaball lava lamp — an interactive background in pure WebGL
description: 'Flowing blobs of lava that melt together and split apart: the metaball field is computed in a fragment shader, 23 KB with no dependencies, the cursor drags the lava with it, and the palette follows the site theme.'
client: Web graphics
industry: Widgets
categories:
  - webgl
position: 26
featured: false
status: published
navigation: false
period: "2026"
updated: 2026-09-09
engagement: completed
services:
  - Fragment shader of a metaball field
  - Widget for a section background or header
  - Cursor and touch response
  - Palette adapted to the site theme
demo:
  widget: metaballs
  alt: A lava lamp — blobs merging into one flow and drifting apart, following the cursor
  tunable: true
  params:
    count: 14
    speed: 1.2
    turbulence: 0.65
    blobSize: 0.065
    threshold: 0.6
    hue: 1
    saturation: 1.6
    glow: 0.45
    gloss: 1.1
    relief: 1.3
    cursorLava: 1
    cursorPullLava: 1
    cursorPullRadius: 0.45
    cursorSize: 1.3
metrics:
  - value: 23 KB
    label: widget size, 8 KB gzipped, no dependencies
  - value: "0"
    label: libraries — a single fragment shader
  - value: "14"
    label: blobs max in one field
cover:
  src: /media/projects/metaballs/metaballs-cover.jpg
  alt: A dark background with a warm orange glow in the center — the atmosphere of a lava lamp
  width: 1680
  height: 945
media: []
---

## The task

A background that comes alive: not a static image and not a heavy 3D scene, but something in between — noticeable motion that does not distract from the content and weighs nothing.

The classic lava lamp fits perfectly: slow flowing shapes everyone knows, and it is simpler under the hood than it looks.

## The work

- blobs are Gaussian "hills" in a single field, and the lava boundary is a smoothed threshold over their sum: close blobs merge continuously and drift apart just as smoothly;
- the whole calculation fits in one fragment shader: a single full-screen triangle covers the view, and the widget weighs 23 KB, 8 KB gzipped, with no dependencies;
- a blob gets its volume from lighting rather than a second colour. The normal does not come from the field gradient — that is zero both at a blob's centre and at its rim, so the silhouette never turned away from the light and a blob read as a flat patch. It comes from the height of the dome over the threshold instead: the derivative of the square root blows up at the rim, the normal rotates to horizontal, and the edge of a sphere appears. The rest is ordinary shading — a fill light from the shadow side, a compact specular, a fresnel rim;
- the cursor adds its own blob to the field and pulls nearby ones toward it. The pull is bounded by a radius and fades smoothly to zero at its edge: without that it reached from any corner of the frame and every blob eventually merged into one. Touch drives the lava exactly as the mouse does, while a vertical swipe still scrolls the page;
- the field has no screen of its own: the canvas is transparent, the lava lives directly on the site theme background and recolours when the theme is switched;
- performance guards: caps on devicePixelRatio and buffer area, rendering paused off-screen, and the system "reduce motion" setting respected.

## The result

A lightweight interactive background that drops into any page with one line and needs neither a build step nor libraries. The lava on this page is that file, not a video.

The direction is still developing: next come modes for specific site sections and more expressive blob shapes.