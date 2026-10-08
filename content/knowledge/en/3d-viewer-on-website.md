---
locale: en
slug: 3d-viewer-on-website
title: An interactive 3D model on a website — how it works and what the model needs
description: How 3D viewing on a product page works, what loading speed depends on, what a web-ready model looks like and how to embed it on a website — in plain words.
summary: 'A model on a website is a GLB file that the browser downloads and the device''s GPU draws, which is why you can rotate it with a mouse or a finger. Speed depends on the file size and how much memory the model takes on a phone, so for the web the model is made lighter: simpler geometry, compressed textures. While it loads, a poster image shows in its place. The model is embedded with a ready-made viewer, such as Google''s open-source model-viewer, or a custom one built on three.js.'
section: realtime
audience:
  - client
  - developer
position: 1
status: published
updated: 2026-10-08
cases:
  - getic
  - softlogic
  - rp-grand
related:
  - mobile-3d-performance
  - ar-on-website
  - 3d-file-formats
---

A buyer rotates the product, zooms in on the connectors, looks underneath — that convinces better than ten photos. But 3D on a website only works if the model is made for the web: a model taken straight from a catalog render loads slowly and may not open on a phone at all.

## How it works

::kb-figure{art="viewer-pipeline" alt="Four steps: a GLB file with the model and textures, download over the network, the device GPU draws it via WebGL, the screen shows the picture frame by frame."}
From file to screen: the browser downloads the model, the GPU redraws it every frame.
::

1. The model is stored as a **[GLB](/knowledge/glossary#glb)** file — geometry, materials and [textures](/knowledge/glossary#texture) in one file.
2. The browser **downloads** the file, like an image, only heavier.
3. The device's **GPU** draws the model via WebGL — the standard for 3D graphics in browsers — afresh every frame. That's why it can be rotated.

## While the model loads

::kb-figure{art="poster-then-model" alt="Three states of the block on the page: at once, a poster image; then the poster faded with a loading bar; finally the model, ready to rotate."}
The page is never blank: poster first, then the model.
::

A poster image — a render of the same angle — shows first. Once the model has downloaded, it replaces the poster and can be rotated. The page is never blank, and on a slow connection the visitor still sees the product.

## What the model needs

::kb-figure{art="heavy-vs-light" alt="Two versions of one model. From the catalog render: a very dense mesh and long bars for mesh weight, textures and loading time. Light, made for the web: a sparser mesh and bars several times shorter."}
The same model, from the catalog render and made light for the web. The bars are for comparison, with no numbers.
::

- **Lighter geometry**: hidden parts removed, a [mesh](/knowledge/glossary#mesh) no denser than the screen can show.
- **Compressed textures** of a sensible size.
- **Few materials.**
- **Correct scale and orientation**: the model stands up rather than lying on its side.

Catalog renders and the web model are often two versions of one model, a heavy one and a light one. Why the heavy one lags is covered in [Why a 3D model lags on a phone](/knowledge/mobile-3d-performance).

## How to embed it

- **A ready-made viewer.** model-viewer is Google's open-source web component: it goes on the page as a single tag and handles rotation, zoom, a poster and AR.
- **A custom viewer on three.js** when you need a special interface: switching variants, animation, a configurator.
- **What to give the developer**: the GLB, the poster and, if you need AR on iPhone, a [USDZ](/knowledge/glossary#usdz). Formats are covered in [3D file formats](/knowledge/3d-file-formats).

## What it looks like in practice

- [Getic](/projects/getic): more than 50 network equipment models viewed on the product page, in two geometry versions — heavy for catalog renders and light for mobile traffic. The client's team integrated them into a three.js viewer.
- [SoftLogic](/projects/softlogic): a GLB model runs in a web viewer at the bottom of the product page on the client's website.
- [RP Grand](/projects/rp-grand): a live 3D model right in the case study — you can rotate it and look closely.

## Common mistakes

- Putting a catalog-render model on the website without making it lighter.
- No poster: an empty block while the model loads.
- A model without real scale: it "floats" on the website and looks like a toy in AR.
- Loading the model right away even if the visitor never scrolls to it.

## Checklist

1. A GLB made light for the web.
2. A poster of the same angle.
3. Scale and orientation.
4. A viewer: ready-made or custom.
5. A USDZ if you need AR on iPhone.
6. A test on an average phone, not just on a work computer.
