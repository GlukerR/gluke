---
locale: en
slug: constellation
title: Constellation — an interactive star field in pure WebGL
description: 'A living star field with no dependencies and no build step: star-points drift slowly, close pairs join into glowing threads, and the cursor behaves like a warm hand — links near it flare up while the nearest stars gently step aside.'
client: Web graphics
industry: Widgets
categories:
  - webgl
position: 23
featured: false
status: published
navigation: false
period: "2026"
updated: 2026-09-06
engagement: completed
services:
  - Pure WebGL with no dependencies
  - Star field with connecting threads
  - Cursor response
  - Optimization for mobile
demo:
  widget: constellation
  alt: Interactive star field — star-points joined by glowing threads, reacting to the cursor
  tunable: true
  params: {}
metrics:
  - value: 20 KB
    label: widget size, 7 KB gzipped
  - value: "0"
    label: dependencies and build steps
  - value: "6"
    label: stars per 100×100 px square — the density stays the same on any screen
cover:
  src: /media/projects/constellation/constellation-cover.jpg
  alt: The star field on a dark background — glowing points joined by threads
  width: 1680
  height: 945
media: []
---

## The task

An interactive background for a website usually means "engine plus model plus megabytes". Here the goal was the opposite: an effect that looks expensive but weighs like an image, drops into any page in one line, and needs neither a build step nor libraries.

## The work

- the field is rendered by a pair of shaders in pure WebGL — no three.js, no model files;
- stars drift along their own paths and twinkle with different phases, so the motion never feels mechanical;
- links are computed on the CPU by a distance threshold: there are only a couple of hundred pairs per frame, cheap even on a phone;
- the cursor acts as a warm hand: threads near it flare up and the closest stars step aside smoothly;
- performance guards: caps on devicePixelRatio and buffer area, rendering paused off-screen, and the system "reduce motion" setting respected.

## The result

A single 20 KB file, 7 KB compressed, with zero dependencies and zero build steps. The live field at the top of this page is that very file — the same code you can drop into any site.
