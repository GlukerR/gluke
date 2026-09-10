---
locale: en
slug: hilbert-house
title: Cottage 3D models for interactive viewing and AR
description: A series of GLB cottage models for Hilbert with interiors visible through the windows — one catalogue style, browser viewing, and an AR fitting of the house on the plot from a phone.
client: Hilbert
industry: Residential construction
categories:
  - webgl
  - exteriors
position: 12
featured: false
status: published
navigation: false
period: "2026"
updated: 2026-09-09
engagement: active
clientUrl: https://hilbert-house.ru/projects/cottages-e/3d-model-e
services:
  - Cottage 3D models for a web viewer
  - Interiors behind the windows — parallax and low-poly
  - One visual standard across the catalogue
  - GLB optimisation for browsers and mobile AR
metrics:
  - value: 4+
    label: cottage models in one style
  - value: 3-4x
    label: less engine memory after optimisation
  - value: AR
    label: the house placed on the plot at full scale
cover:
  src: /media/projects/hilbert-house/cover.jpg
  alt: A cottage from the E collection on the Hilbert website — a facade of full-height glazing with the interiors visible through it
  width: 1680
  height: 945
model:
  src: /media/projects/hilbert-house/e300.glb
  alt: Interactive 3D model of the E300 cottage — rotate it and inspect the house from every side
  width: 1680
  height: 945
  autoRotate: true
  emissivePulse: 0
  metalness: 1
  diffuseLift: 0
  rotation: 160
  autoRotateSpeed: 0.8
  environmentIntensity: 0.5
  hemisphereLight: 1.6
  keyLight: 0.5
  fillLight: 0.35
  zoomMin: 0.7
  zoomMax: 1.8
  fit: 0.95
media:
  - src: /media/projects/hilbert-house/site-collection-e.jpg
    alt: The E collection page on the Hilbert website — the cottage 3D model in the interactive viewer, with house specifications and collection cards below it
    width: 1400
    height: 1466
    kind: image
    triple: true
    caption: The E collection on the client's site — the very model shown in the header of this case
  - src: /media/projects/hilbert-house/site-collection-l.jpg
    alt: The L collection page on the Hilbert website — a 3D model of a long cottage with a curved canopy, and the house specifications
    width: 1400
    height: 1455
    kind: image
    triple: true
    caption: The L collection — a house with a curved canopy over the terrace
  - src: /media/projects/hilbert-house/site-collection-r.jpg
    alt: The R collection page on the Hilbert website — a 3D model of a cottage with concrete and stone facades, next to cards of the other houses in the collection
    width: 1400
    height: 1466
    kind: image
    triple: true
    caption: The R collection — the textured facades that made the masonry balance so tricky
  - src: /media/projects/hilbert-house/r250.glb
    alt: Interactive 3D model of the R-250 cottage — rotate the house and study its concrete facades and the interiors behind the windows
    width: 1680
    height: 1229
    kind: '3d'
    poster: /media/projects/hilbert-house/r250-poster.jpg
    wide: false
    solo: true
    autoRotate: true
    emissivePulse: 0
    metalness: 1
    diffuseLift: 0
    rotation: 90
    autoRotateSpeed: 0.8
    environmentIntensity: 0.5
    hemisphereLight: 1.6
    keyLight: 0.5
    fillLight: 0.35
    zoomMin: 0.7
    zoomMax: 1.8
    fit: 1.3
    canvasScale: 1
---

## The task

Hilbert builds country houses as ready-made collections — named after the letters of the brand itself, from H to T, each with several sizes. Every collection has a "3D model of the collection" section on the website: a visitor rotates the house in the browser, and from a phone places it in augmented reality right on the plot, at full scale. That called for models in GLB, with interiors visible through the windows, and in one consistent style, so that houses from the same line would not look like work from different studios.

The input was OBJ and MTL exports from Archicad: clean building geometry with no materials, no surroundings and nothing inside. There were no interior sources at all, only finished renders from the client's visualiser, shot in perspective. They could not simply be placed behind the glass — furniture gets cropped and the room geometry skews.

## How we worked

The first model, E300, was built as the reference: it set the level of detail the rest of the catalogue was then matched to. For the interiors we assembled a hybrid — parallax images for smaller rooms and low-poly furniture in half-light for the open ground floor. The light inside is deliberately dim, so that in a web viewer it reads as a lived-in house rather than a lit shop window, and does not give away the simplified geometry.

Then came the series — R-250, Beton 250, L-330 and revisions to L-350. Each house was brought to the same catalogue language: blinds instead of curtains, downlights instead of chandeliers, facade textures based on photo references, a tidy plot under the building. The concrete collection needed extra work on its three-dimensional brickwork — it is visible on the facade, it is the signature of the line, and simplification could not be allowed to flatten it. Dark brick collapsed into a flat mass in the viewer and light brick looked like a toy, so the shade was tuned until the depth of the masonry read from any angle.

Optimisation was a stage of its own. AR runs on a phone, and the house has to be not only downloaded but held in memory alongside the camera and tracking. All models moved to Meshopt and KTX2: they take three to four times less engine memory than the original GLB files, so a house opens and spins smoothly even on a mid-range phone.

## The outcome

The catalogue got a series of models with one style and one level of detail: the house can be inspected from every side, and looking through the windows shows there really are rooms inside. The models run on the Hilbert website itself — [collection E](https://hilbert-house.ru/projects/cottages-e/3d-model-e), [collection L](https://hilbert-house.ru/projects/cottages-l/3d-model-l), [collection R](https://hilbert-house.ru/projects/cottages-r/3d-model-r).

The E300 model in the header of this case is the same one the client runs: the same geometry and the same baked lighting, with the interior textures compressed a little further for our viewer. The project continues — new collections are still being added.
