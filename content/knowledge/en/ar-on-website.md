---
locale: en
slug: ar-on-website
title: A product or a house in augmented reality — how AR on a website works
description: How a visitor places a product or a house at full size through their phone camera, which files iPhone and Android need, why scale matters and how much memory the model can take.
summary: 'AR on a website is a button next to the 3D model: the phone opens the camera and places the model on the floor, a table or a plot at full size, without a separate app. iPhone and iPad need the model as USDZ, Android as GLB; ready-made viewers such as model-viewer show the button and pick the file on their own. The model must be at real-world scale and light: the phone keeps it in memory alongside the camera and spatial tracking.'
section: realtime
audience:
  - client
  - developer
position: 3
status: published
updated: 2026-10-08
cases:
  - hilbert-house
  - m1-group
related:
  - 3d-viewer-on-website
  - mobile-3d-performance
  - 3d-file-formats
---

Will the sofa fit the living room, will the house fit the plot — AR answers that right through the phone camera, with no app.

## What the visitor sees

::kb-figure{art="ar-flow" alt="Three phone screens: the page with a 3D model and an AR button; the camera showing a room and looking for the floor; the product standing on the room's floor."}
Three steps: the button, finding the floor, the product in the room.
::

1. The page shows a 3D model and a "View in AR" button.
2. The phone opens the camera and finds the floor or a table.
3. The model appears at full size: you can walk around it and turn it.

No app to install. On iPhone and iPad it's the built-in AR Quick Look [viewer](/knowledge/glossary#viewer); on Android, Google's Scene Viewer on phones that support ARCore.

## Which files you need

::kb-figure{art="ar-formats" alt="iPhone and iPad — USDZ, the AR Quick Look viewer; Android — GLB, Scene Viewer, needs ARCore. The viewer on the page picks the file itself."}
One product, two files. The page viewer hands the phone the right one.
::

iPhone and iPad need USDZ, Android needs GLB. Ready-made viewers such as [model-viewer](/knowledge/glossary#model-viewer) show the AR button and hand the phone the right file. More on formats in [3D file formats](/knowledge/3d-file-formats).

## Scale 1:1

::kb-figure{art="ar-scale" alt="Two scenes with a person for scale. Top: a house in meters, at full size. Bottom: a house exported in the wrong units, the size of a box at the person's feet."}
The model must be in meters, or the house ends up the size of a box.
::

The model must be in real-world units — meters. If it was exported in centimeters or arbitrary units, a house ends up the size of a box and an armchair the size of a house.

## Memory and weight

The phone runs the camera, tracks the space and draws the model all at once. A heavy model stutters or closes the view. How to make it lighter is covered in [Why a 3D model lags on a phone](/knowledge/mobile-3d-performance).

## What to prepare

- A 3D model at real-world scale.
- GLB and USDZ.
- For large objects, a decision on what's visible inside — for example, interiors in a house's windows.
- A [poster](/knowledge/glossary#poster) for the page while the model loads.

## What it looks like in practice

- [Hilbert](/projects/hilbert-house): a visitor places a house at full size right on their plot from a phone. The GLB models with interiors in the windows were moved to Meshopt and KTX2 so the house opens and rotates smoothly even on an average phone.
- [M1 GROUP](/projects/m1-group): GLB and USDZ export for AR viewing on marketplaces.

## Common mistakes

- A model in the wrong units.
- GLB only: AR on iPhone needs USDZ. Some viewers can build it themselves, but it's more reliable to prepare it separately.
- A heavy model that stutters along with the camera.
- Testing on just one phone.

## Checklist

1. Real-world scale, in meters.
2. GLB and USDZ.
3. A light model.
4. An AR button in the viewer.
5. Testing on both iPhone and Android.
