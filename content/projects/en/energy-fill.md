---
locale: en
slug: energy-fill
title: Filling a logo with energy — an engine in WebGL
description: 'A beam of light enters the mark and spreads through the shape from inside: the front travels by geodesic distance within the outline, not as a circular wipe. One fragment shader, no dependencies, the logo is swapped as a file.'
client: Web graphics
industry: Widgets
categories:
  - webgl
position: 29
featured: false
status: published
navigation: false
period: "2026"
engagement: active
services:
  - Fragment shader that fills along the shape
  - Distance maps baked from the logo mask
  - A "beam — fill — pulse" scene
  - Parameter lab
demo:
  widget: energy-fill
  alt: A triangular mark with a beam of light entering it and spreading through the shape from inside
  logo: /media/projects/energy-fill/mark.svg
  tunable: true
  params:
    markPick: 0
    markAlt: /media/projects/pyramid/g-mark.svg
    detail: 2
    markSize: 0.99
    markShift: 0
    markFit: 0
    entryAngle: 30
    beamReach: 1.1
    beamWidth: 0.05
    beamNoise: 0.8
    beamGlow: 1.6
    frontWidth: 0.06
    frontGlow: 1.4
    fillNoise: 0.16
    noiseScale: 7
    frontFlow: 0.5
    grain: 0.22
    grainScale: 14
    grainSteps: 7
    idle: 0.55
    idleShape: 1.3
    idleSpeed: 0.15
    idleTight: 5
    rim: 0.9
    rimWidth: 0.14
    halo: 1
    haloWidth: 0.15
    soft: 0.55
    softWidth: 0.29
    bloom: 0.5
    bloomWidth: 1.28
    shock: 1.45
    shockWidth: 0.22
    burst: 0
    burstScale: 3.5
    burstSpeed: 0.5
    hue: 0.147
    saturation: 0.91
    dormant: 0.3
    charge: 0.7
    fillTime: 1
    flash: 0.35
    hold: 1.4
    ambient: 3
    loop: 1
    freeze: 0
    scrub: 0.37
metrics:
  - value: 3 s
    label: the whole scene — beam, fill, pulse
  - value: "0"
    label: libraries — a single fragment shader
  - value: 1 file
    label: the logo is swapped as an SVG, nothing is baked ahead of time
cover:
  src: /media/projects/energy-fill/energy-fill-cover.jpg
  alt: A triangular mark filled with the brand yellow, glowing against a dark background
  width: 1680
  height: 945
media: []
---

## The task

A first pass at the engine. The mark on stage is a placeholder: a triangle with a triangle cut out of its centre. The ring is deliberate — it shows at once whether the fill is honest: a circular wipe would light a far corner before its neighbour, while a wave travelling through the shape goes around the ring. The real logo drops in as a single file.

## The work

- the fill front follows the geodesic distance inside the outline: the arrival map is baked from the logo mask in the browser on load, and in a frame it costs one texture sample;
- the same texture holds the mark coverage, the distance to the edge from inside and the distance to the mark from outside — that gives the rim and the halo with no second pass and no blur into a separate buffer;
- the beam, the fill and the pulse are one timeline; the lab loops it, a site header would play it once;
- the panel below exposes the same parameters as the widget config. "Freeze frame" and "Moment in the scene" stop time so the front can be inspected: live it passes in a fraction of a second.
