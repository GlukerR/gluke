---
locale: en
slug: mobile-3d-performance
title: Why a 3D model lags on a phone and how to fix it
description: What makes up a 3D model's weight, why GPU memory matters as much as file size, what draw calls are, and how KTX2 and Meshopt speed a model up on a phone.
summary: 'A model lags when it''s too heavy for the phone on at least one of three counts: file size (slow to load), GPU memory (textures and geometry don''t fit) and the number of draw calls (too many separate parts and materials). The fix is lighter geometry, smaller and compressed textures — KTX2 stays compressed even in GPU memory — geometry compression with Meshopt or Draco, and merged materials.'
section: realtime
audience:
  - developer
  - client
position: 2
status: published
updated: 2026-10-08
cases:
  - hilbert-house
  - rp-grand
  - getic
related:
  - 3d-viewer-on-website
  - lod
  - ar-on-website
---

On a work computer the model spins smoothly, but on the buyer's phone it takes a minute to load and stutters. The cause is almost always in one of three places.

## Three causes

1. **A heavy file**: slow to download over mobile internet.
2. **Not enough GPU memory**: the model doesn't fit in the phone's memory, so the browser stutters or reloads the page.
3. **Too many draw calls**: the GPU gets hundreds of small jobs instead of a few large ones.

## Textures: file size and memory are different things

::kb-figure{art="texture-memory" alt="Two pairs of bars. JPEG or PNG: a short bar on disk and a very long one in GPU memory. KTX2: slightly longer on disk, short in memory."}
JPEG and PNG are compact on disk, but the GPU unpacks them in full. KTX2 stays compressed in memory too.
::

JPEG and PNG are compact on disk, but the GPU unpacks them in full. A 4096×4096 texture takes about 64 MB of memory, however small the file. **KTX2** stays compressed even in GPU memory, which is why textures for the web and AR are converted to it.

::kb-figure{art="texture-size" alt="Three nested squares to scale: 1024, 2048 and 4096 pixels per side. Labels on the right: 1024 — memory times one, 2048 — four times more, 4096 — sixteen times more."}
Twice the side means four times the memory.
::

Each doubling of a texture's side means four times the memory. Going from 4096 to 2048 saves three quarters. On a phone screen the difference isn't visible for most parts.

## Geometry

A dense [mesh](/knowledge/glossary#mesh) means more vertices, a heavier file and more work for the GPU. Hidden parts are removed, the mesh is simplified where it won't show, and the geometry itself is compressed with Meshopt or Draco.

## Draw calls

::kb-figure{art="draw-calls" alt="Left: twelve parts with different materials, twelve lines to the GPU. Right: the parts merged into three materials, three lines."}
Every part with its own material is a separate job for the GPU.
::

Every separate part with its own material is a separate job for the GPU — a draw call. Hundreds of them slow down even a powerful phone. Parts are merged and materials are reduced to a few.

## How to check

- Open the model on an **average** phone, not a flagship.
- Look at the file size and the load time over mobile internet.
- Open the model in a technical [viewer](/knowledge/glossary#viewer) such as gltf.report: it shows the triangle count, texture sizes and materials.

For scenes with many objects there's one more technique — levels of detail; see [LOD](/knowledge/lod).

## What it looks like in practice

- [Hilbert](/projects/hilbert-house): AR runs on a phone, and the house has to stay in memory alongside the camera and tracking. The models were moved to Meshopt and KTX2 — in engine memory they take three to four times less than the original [GLBs](/knowledge/glossary#glb).
- [RP Grand](/projects/rp-grand): materials reduced to three — body, interior, glass — to keep draw calls minimal; the full car is around nine thousand triangles.
- [Getic](/projects/getic): textures compressed for the engine and a lighter geometry version for mobile traffic.

## Common mistakes

- Looking only at file size and ignoring memory.
- 4096 textures on every small part.
- Hundreds of separate materials.
- Testing only on a work computer.

## Checklist

1. File size.
2. Texture sizes and the KTX2 format.
3. Geometry: hidden parts removed, Meshopt or Draco compression.
4. A few materials, not hundreds.
5. A test on an average phone.
