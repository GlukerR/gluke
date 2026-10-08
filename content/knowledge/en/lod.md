---
locale: en
slug: lod
title: LOD — what levels of detail are and when you need them
description: Why make several versions of one 3D model, how they switch with distance, and when LOD is really needed — in games and large scenes — and when one optimized model is enough.
summary: 'LOD means several versions of one model with different detail: the full one for close-ups, a simplified one for mid-range and almost a silhouette for far away. The engine switches between them by distance to the camera, so a scene with hundreds of objects stays fast. LOD is needed in games and large interactive scenes; for a single product in a website viewer, one well-optimized model is usually enough.'
section: realtime
audience:
  - developer
  - artist
position: 4
status: published
updated: 2026-10-08
cases:
  - rp-grand
related:
  - mobile-3d-performance
  - 3d-viewer-on-website
---

A car at the far end of a street takes up a few dozen pixels on screen — drawing it with every headlight and grille is pointless. LOD lets each object be drawn with exactly as much detail as is visible.

## The levels

::kb-figure{art="lod-levels" alt="One car in three versions: LOD0 with a dense mesh, windows and wheel rims; LOD1 with a sparser mesh and simpler wheels; LOD2 almost a silhouette with no windows."}
The mesh thins out, while the silhouette and color stay the same.
::

- **LOD0**: the full model for close-ups.
- **LOD1**: simplified — small details removed, a sparser mesh.
- **LOD2**: almost a silhouette for far away.

The number of levels and how much they're simplified depend on the project.

## How they switch

::kb-figure{art="lod-distance" alt="A camera on the left and three distance zones: near — LOD0, a large car; mid — LOD1, a smaller car; far — LOD2, a very small car."}
The farther the object, the smaller it is on screen and the simpler the version.
::

The engine checks how far the object is from the camera, or how much of the screen it covers, and picks a level. The switch should go unnoticed, so only what can't be seen at that distance anyway is simplified.

## When you need it and when you don't

::kb-figure{art="lod-when" alt="Four situations: a game with cars on a street — LOD; a big scene such as a village or a plant — LOD; one product in a viewer — one model; AR of a single object — one model."}
LOD is needed when there are many objects at different distances.
::

- **Games and simulators**: many objects at different distances.
- **Large interactive scenes**: a village, a plant, a residential complex.
- **One product in a [viewer](/knowledge/glossary#viewer)**: the camera is always close, so one optimized model is enough. How to make it lighter is covered in [Why a 3D model lags on a phone](/knowledge/mobile-3d-performance).
- **AR of a single object**: one model as well.

## What to put in the brief

- **The budget**: how many triangles and materials each level may have. The developer or the project's engine sets it.
- **How many levels** and at what distances they switch.
- **What stays the same on every level**: the silhouette, the color, recognizable details.

## What it looks like in practice

[RP Grand](/projects/rp-grand): car assets for a mobile game — LOD0, the full build for close-ups, around nine thousand triangles; LOD1 for mid-range; LOD2, a silhouette for distant streets. In the case study's interactive garage you can switch the levels and look at the mesh.

## Common mistakes

- Making LODs for a single model in a viewer.
- Simplifying so much that the silhouette changes: the switch becomes visible.
- Different materials on different levels: the object "flickers" in color when it switches.

## Checklist

1. Is LOD needed: are there many objects at different distances?
2. A triangle and material budget for each level.
3. Switching distances.
4. The same silhouette and color on every level.
