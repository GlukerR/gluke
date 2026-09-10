---
locale: en
slug: particles
title: A model in particles — surface-sampled point cloud in three.js
description: 'A finished 3D model is rebuilt into a point cloud right in the browser: the points appear gradually, glowing lines crawl across the surface, and density, colour and speed are all tuned right on the page.'
client: Web graphics
industry: Widgets
categories:
  - webgl
position: 26
featured: false
status: published
navigation: false
period: "2026"
updated: 2026-09-07
engagement: completed
services:
  - Surface sampling of a model
  - Point cloud in three.js
  - Palette tuned to light and dark themes
  - A parameter lab on the page
demo:
  widget: particles
  alt: A deer rebuilt into a cloud of glowing points — the points appear gradually and lines crawl across the surface
  tunable: true
  model: /media/projects/particles/deer.glb
  params:
    points: 21000
    pointSize: 0.9
    spread: 0.08
    revealSpeed: 0.195
    pointOpacity: 0.145
    brightness: 1
    paths: 8
    pathStep: 0.11
    pathSpeed: 13
    lineTail: 1850
    lineFade: 9.5
    lineOpacity: 0.425
    lineDisplace: 0.05
    hueShift: 0
    lineHueSpread: 0.5
    lineShimmer: 0.09
    spin: 0.01
    tilt: 0.17
metrics:
  - value: 21K
    label: triangles in the source model
  - value: "18"
    label: parameters you can turn right on the page
  - value: 21K
    label: points by default, up to 80 thousand in the lab
cover:
  src: /media/projects/particles/particles-cover.jpg
  alt: A deer made of glowing points on a dark background, with lines tracing its silhouette
  width: 1680
  height: 945
media: []
---

## The task

Showing a 3D model on a site usually means one of two things: a still from a render, or a viewer you can spin. Both are long familiar and say nothing about the geometry itself.

We wanted a third option: take a finished model file and build the effect from it right in the browser — so the shape reads clearly but is not served head-on, and so everything can be tuned live instead of being dialled in beforehand in an editor.

The demo model is our own deer: a single mesh, 21,248 triangles, 65 KB with Draco compression. Nothing was prepared specially for the effect — it is an ordinary working file.

## The work

- the points are scattered by `MeshSurfaceSampler` from three.js: it builds a table of face areas across the mesh and then returns a random point on the surface. Each face is picked in proportion to its area, so density does not depend on how the model happens to be triangulated — the deer's body and the thin branches of its antlers are covered just as evenly;
- when a model has several parts, the budget is split between them by the same area, and the table is cached per geometry: instances of one mesh do not need their own;
- the cloud does not appear all at once. The points are computed up front but revealed progressively by growing the draw range, so the model seems to draw itself. Appending to the buffer every frame, as tutorials do, is unnecessary — that recreates the attribute on every frame;
- lines crawl across the surface at the same time: the next point is picked at random and accepted only if it is close enough to the previous one. Each line takes its own hue, spread symmetrically around the base tone, so a violet base is joined by blue and magenta. A line has a tail, and it is erased by shifting the draw window rather than deleting data — so a line can keep crawling indefinitely without running into the buffer size;
- a point is drawn as a circle via `gl_PointCoord`, with no texture, and shrinks with distance: otherwise the far half of the model looks as dense as the near one and the volume disappears;
- point size, camera clipping planes and framing are all derived from the model's own dimensions. Files arrive in different units, and without this one model turned into a solid silhouette while another sailed past the far plane entirely — both bugs surfaced when the model was swapped;
- colour is mixed from two tones by height and the whole palette rotates with a single hue slider. The site theme switches both the palette and the blending mode: on a dark background the points add up and glow, on a light one additive blending would wash everything out;
- performance guards: caps on devicePixelRatio and buffer area, rendering paused off-screen, and the system "reduce motion" setting respected.

## The result

The widget is not tied to the deer: the model is set in the case configuration rather than in code, and any `.glb` can take its place. The drawing never finishes: once the cloud is complete the widget does not reset it but starts replacing the oldest points with fresh ones in a loop — erasing behind, appearing ahead. The lines behave the same way, so anyone arriving later finds work in progress rather than a finished picture.

The panel under the model is real, and all eighteen parameters are live. The extremes give quite different pictures: drop the point reveal speed to zero and only the lines remain, sketching the deer across an invisible surface; remove the lines and a bare cloud is left; add a tail and the lines turn into short running strokes.

This is the only one of our widgets that needs an engine: three.js plus the model file itself. The other three — the pyramid, the star field and the lava lamp — get by on a couple of dozen kilobytes and zero dependencies. Here the cost is different, and it buys something different: the ability to take any finished model and show it like this.
