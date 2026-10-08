---
locale: en
slug: source-materials
title: What materials a 3D artist needs — drawings, CAD, photos or a sample
description: What to prepare before 3D modeling a product — which source materials give the exact shape, which give the look, and what to do if there are no drawings.
summary: 'Two kinds of information are needed: shape and size (a CAD model, dimensioned drawings or a physical sample) and appearance (photos, color codes, material samples). The most accurate start is a CAD model plus photos of the finished product; without drawings, the model is built from a sample or from detailed photos with a tape measure in the frame. And always say where the result will be used: that decides how detailed the model has to be.'
section: preparation
audience:
  - client
position: 1
status: published
updated: 2026-10-08
cases:
  - getic
  - house-guru
  - hilbert-house
related:
  - photo-for-3d
  - color-and-materials
  - 3d-brief
---

The first thing a 3D artist asks is "what do you have?". The answer decides how accurate the model will be and how many questions will come up along the way. The good news: you can almost always start with what you already have — what matters is knowing what those materials are missing.

## Shape and appearance come from different sources

Source materials answer two different questions: **what shape and size the product is** and **what it looks like**. Few sources cover both, so they almost always have to be gathered from several places.

::kb-figure{art="form-plus-look" alt="A diagram as an equation: shape (CAD, drawings or a sample) plus appearance (photos, color codes, samples) equals the finished 3D model."}
A model is built from two halves: exact geometry and how the product looks in real life.
::

## What each source gives you

::kb-figure{art="sources-matrix" alt="Four cards: CAD model, drawings, sample, photos. Each has two meters, shape and look. CAD and drawings are exact on shape but say almost nothing about the look; a sample fills both meters; photos give the look partially and the shape approximately."}
The meters show how accurately each source conveys the product's shape and appearance.
::

| Source | Shape and size | Appearance | Keep in mind |
|---|---|---|---|
| CAD model (STEP, SolidWorks, Inventor, KOMPAS) | exact | barely | The most accurate start. Colors and textures in CAD are usually placeholders |
| Dimensioned drawings (PDF, DWG) | exact | no | All views are needed, plus sections of complex areas |
| Physical sample | exact, if measured | yes | The best source for materials and small details |
| Photos | approximate | partly | Color in photos is skewed by light and the camera |
| Model from Archicad, SketchUp, Revit | yes | usually not | Geometry is there; materials and furnishing have to be made |

## What matters most for an exact shape

If you have a CAD model, send it in the native format or as [STEP](/knowledge/glossary#step), a universal exchange format that keeps exact surfaces. A PDF drawing is a step back by comparison: the model is rebuilt from it, and every missing dimension becomes a question.

It's fine if the CAD model has everything, down to the screws inside the housing: the 3D artist will remove what isn't needed. But say what has to be visible — for example, whether you need a [cutaway](/knowledge/glossary#cutaway) or an [exploded view](/knowledge/glossary#exploded-view).

Drawings without 3D work too, as long as they have dimensions and complex areas (fillets, ribs, holes) are shown in separate views or sections.

## If there are no drawings

The model can be built from a physical sample or from photos. A sample is better: it can be measured and looked at from any angle. With photos, a tape measure must be in the frame, in the plane of the product, or dimensions have to be guessed from proportions. How to shoot is covered in detail in [How to photograph a product for 3D modeling](/knowledge/photo-for-3d).

## What's needed for appearance

- **Color**: a RAL or Pantone code, or better, a physical sample of the finish. Photos are unreliable for color: the same product looks different in two shots. More in [How to specify color and material](/knowledge/color-and-materials).
- **Texture and gloss**: matte, glossy, textured, fabric — close-up photos of the surface in daylight.
- **Logos and lettering**: as vector files (SVG, PDF, AI), not screenshots.
- **Variants**: a list of colors and configurations if there are several. Then the model is built so variants can be switched, not redrawn.

## Say where the result will be used

This isn't a source material, but without it the sources can't be read correctly. A model for a large catalog render, for a marketplace listing and for viewing in a phone browser needs different levels of detail. Extra detail slows a web model down; missing detail shows immediately in a close-up.

::kb-figure{art="detail-by-use" alt="The same panel with a knob at three levels of detail: for the web and AR, a simple mesh; for a catalog, a medium mesh with bevels; for a close-up, a dense mesh with rounded edges and screws."}
One product, three levels of detail. The larger the product appears in the frame, the more detail the model needs.
::

## What it looks like in practice

- [Getic](/projects/getic): the sources were drawings, dimensions and photos of real devices — the basis for more than 50 network equipment models viewed right on the product page.
- [HouseGuru](/projects/house-guru): there were no drawings; the models were built from physical product samples.
- [Hilbert](/projects/hilbert-house): the input was OBJ and MTL exports from Archicad — clean building geometry without materials or interiors. Materials, furnishing and AR optimization had to be done separately.

## Common mistakes

- Sending only marketing photos from the website: they are retouched, shot in perspective and don't show the sides or back.
- Describing color in words, like "dark gray": everyone pictures a different one.
- Not mentioning variants upfront: a model built for one color and one configuration is harder to turn into a series.
- Not saying where the result will be used: the model ends up either too heavy for the web or too simple for a close-up.

## Checklist

1. Shape: a CAD model (STEP or native format) **or** dimensioned drawings **or** a sample.
2. Appearance: photos from all sides, a color code or finish sample, close-ups of the texture.
3. Logos and lettering as vector files.
4. A list of color and configuration variants.
5. Where the result will be used and how large the product will be in the frame.
6. Examples of images you like the style of — yours or anyone else's.
