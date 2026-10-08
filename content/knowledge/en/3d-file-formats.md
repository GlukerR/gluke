---
locale: en
slug: 3d-file-formats
title: 3D file formats — GLB, FBX, OBJ, USDZ, STEP — which one for what
description: How 3D model formats differ, which one to ask for for a website, AR, another 3D program or manufacturing, and what gets lost when converting from one to another.
summary: 'For a website and AR on Android, GLB; for AR on iPhone, USDZ; for handing over to another 3D program and for animation, FBX; for plain geometry, OBJ; for manufacturing and CAD, STEP. GLB and USDZ keep the model together with materials and textures in one file, OBJ keeps geometry with basic materials, STEP keeps exact surfaces without materials. Going from CAD to polygons turns the exact shape into a mesh of triangles, and materials often have to be set up again when moving between programs.'
section: formats
audience:
  - client
  - developer
position: 1
status: published
updated: 2026-10-08
cases:
  - getic
  - hilbert-house
  - m1-group
related:
  - deliverables
  - source-materials
---

"Send us the model" — in which format? The answer decides whether the file opens for whoever needs it and how much work has to be redone.

## Which format for which task

::kb-figure{art="format-map" alt="A map: website and 3D viewer — GLB; AR on Android — GLB; AR on iPhone and iPad — USDZ; another 3D program — FBX; plain geometry — OBJ; manufacturing and CAD — STEP."}
On the left, what you need to do with the model; on the right, which file to ask for.
::

## What's inside each format

::kb-figure{art="format-contents" alt="A table of what GLB, FBX, OBJ, USDZ and STEP store — geometry, materials, textures inside the file, animation and exact surfaces. GLB and USDZ store almost everything except exact surfaces; STEP stores only exact geometry."}
A full circle means it stores it, half means partly or not always, empty means no.
::

- **GLB** is the binary version of glTF, the open standard for 3D on the web. Geometry, materials, [textures](/knowledge/glossary#texture) and animation in one file. The standard for web [viewers](/knowledge/glossary#viewer) and AR on Android.
- **[USDZ](/knowledge/glossary#usdz)** is Apple's format for augmented reality: the model opens in AR straight from the browser on iPhone and iPad. It holds the model with materials and textures.
- **FBX** is an exchange format between 3D programs and game engines. It carries animation and the part hierarchy well; materials don't always transfer accurately and often need adjusting.
- **OBJ** is an old, simple format: geometry and basic materials in a companion `.mtl` file, textures as separate files. It opens almost anywhere.
- **STEP** is a [CAD](/knowledge/glossary#cad) format: exact surfaces, as in engineering software, without textures. It's for manufacturing and engineers, not for a website.

For 3D printing, STL or 3MF are used — they contain geometry only.

## What gets lost in conversion

::kb-figure{art="tessellation" alt="Left: an exact circle from CAD. Middle: the same circle with 12 sides, facets visible. Right: with 40 sides, smooth but with a much denser mesh."}
Tessellation: an exact surface becomes a mesh. The finer the mesh, the smoother and heavier the model.
::

- **CAD to polygons.** Exact surfaces are turned into a mesh of triangles — that's called tessellation. A fine mesh is smooth but heavy; a coarse one is light but shows facets. Going back from polygons to exact CAD doesn't happen without manual work.
- **Between 3D programs.** Geometry almost always transfers; materials and lighting often don't. That's why the scene source is worth more for further work — see [What to ask a 3D artist to hand over](/knowledge/deliverables).
- **Animation.** OBJ and STEP don't have it at all.

## Which format to ask for

- **For a website or AR**: GLB, plus USDZ if you need AR on iPhone.
- **So another contractor can continue the work**: FBX together with the scene source.
- **For manufacturing**: STEP from an engineer. A model made for rendering usually won't do for a machine: its job is to look like the product, not to set tolerances.
- **If unsure**: say where the model will be used, and the format will be picked for the task.

## What it looks like in practice

- [Getic](/projects/getic): one delivery pipeline — eight files per model, FBX plus a set of maps, so each new item is picked up by the engine without manual tweaking.
- [Hilbert](/projects/hilbert-house): OBJ and MTL from Archicad in, GLB out for viewing in the browser and in AR.
- [M1 GROUP](/projects/m1-group): GLB and USDZ export for AR viewing on marketplaces.

## Common mistakes

- Asking for "the model as a JPG" — that's a picture, not a model.
- Expecting a web GLB to work for manufacturing.
- Converting FBX to GLB with an online converter and wondering where the materials went.
- Forgetting USDZ when AR on iPhone is needed.

## Checklist

1. Where the model will be used.
2. Website and AR on Android — GLB; AR on iPhone — USDZ.
3. Further work — FBX plus the scene source.
4. Manufacturing — STEP from an engineer.
5. Test the file where it's needed: on the website, in AR, in the contractor's program.
