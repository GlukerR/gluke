---
locale: en
slug: image-particles
title: A portrait in particles — an interactive field in pure WebGL
description: 'A photograph is broken into twenty thousand dots: the portrait assembles from particles and parts wherever the cursor passes. Pure WebGL, one draw call, zero dependencies.'
client: Web graphics
industry: Interactive widgets
categories:
  - webgl
position: 27
featured: false
status: published
navigation: false
period: "2026"
updated: 2026-09-08
engagement: completed
services:
  - Breaking a photograph into particles
  - Donor preparation and tone correction
  - Cursor repulsion graded by depth
  - Adapted to the light and dark themes
demo:
  widget: image-particles
  alt: A man's portrait in profile assembled from glowing dots — they part under the cursor
  src: /media/projects/image-particles/donor.png
  tunable: true
  params:
    density: 1
    dotSize: 1.6
    scatter: 0.02
    depth: 0.04
    flow: 1.4
    colorSat: 0.3
    contrast: 1.35
    floor: 0.28
    shadowFill: 0.08
    radius: 0.5
    repel: 0.1
    glide: 0.12
    parallax: 1
metrics:
  - value: ~21K
    label: particles in frame — donor pixels with the empty background dropped
  - value: "0"
    label: libraries — a single gl.POINTS draw call
  - value: 2D
    label: effect — particles from an image, not a 3D scene
cover:
  src: /media/projects/image-particles/image-particles-cover.jpg
  alt: A man's portrait in profile made of glowing dots on a black background
  width: 1680
  height: 945
media: []
---

## The task

Show a photograph so that it is not merely a photograph: the image is broken into twenty thousand dots, the portrait assembles from them and parts wherever the cursor passes.

The condition is a lightweight 2D effect with no 3D scene and no build step: pure WebGL, one file, zero dependencies. All a page needs is the donor image and one line to load it.

## The work

- the donor's pixels are read once on the CPU and packed into a vertex buffer: index, position, angle and colour — seven floats per particle. The shader needs no texture at all; vertex texture fetch is unreliable on some GPUs;
- the empty background never enters the buffer, as in the original. But the original cuts at 34/255 and throws away the subject's shadows along with the background — on a backlit portrait only the lit strip of the head survives. We cut an order of magnitude lower and give the shadows their own slider: a dot's "presence" is decoupled from its tone, otherwise the dark half of a face simply disappears;
- the donor's tone is corrected inside the shader: an S-curve separates lights from darks and a floor removes background noise. A photograph as-is gives dots of almost identical size, and a face reads as a blob rather than a shape. Both are sliders on the page;
- the widget finds its own frame by luminance mass, not by "is there a pixel above the threshold": a single grain of noise in a corner would otherwise stretch the crop across the whole donor and the subject assembles tiny;
- the sampling step follows the display: sampling finer than the screen can show is pointless — bright areas clot into a patch and the midtones disappear;
- on start the particles fly in from a random scatter and assemble into the original image — that is the live assembly of the picture;
- the cursor pushes the dots within the image plane: the closer, the stronger the scatter, with smooth mouse following and a slight depth parallax. How hard a dot is pushed follows its depth — the front layer clears out of the way completely, the back one stays put and holds the subject's shape. Without that the cursor punched straight through the picture and left an empty hole;
- the whole calculation lives in the vertex shader: a single gl.POINTS draw call, noise and positions computed on the GPU;
- the field has no screen of its own: the canvas is transparent and lives on the site theme background; in the light theme the dots turn "inky" and the black donor background disappears;
- performance guards: caps on devicePixelRatio and buffer area, rendering paused off-screen, and the system "reduce motion" setting respected.

## The result

The portrait lives on the page by itself: the dots breathe, the cursor pushes the front layer aside, and no two moments look the same. This is not a video and not a sprite — twenty thousand particles are computed in the vertex shader in a single draw call.

The donor is set in the case configuration rather than in code: a logo, a product or another photograph can take its place. Preparing a donor is a separate script — crop, black point, separation of lights and darks. Without it a backlit portrait falls apart: the face blows out to a white patch and the shadow vanishes entirely.

The panel under the image is real, and all thirteen parameters are live: dot density and size, tone correction, depth, cursor radius and strength. The extremes give quite different pictures — from a dense cloud to a sparse dotted outline.