---
locale: en
slug: image-specs
title: Images for the web, marketplaces and print — size, format, resolution
description: How many pixels a website and WB and Ozon listings need, what 300 DPI means for print, when you need a transparent PNG and when a JPEG, and how to get every format from one render.
summary: 'On screen only pixels matter: an image for a website is made about twice as wide as the space it takes on the page, so it stays sharp on phones and laptops. As of October 2026, WB and Ozon expect a vertical 3:4 frame; 900×1200 passes on both, but more headroom is better, for example 1500×2000. For print, work from the sheet size: 300 DPI at the final size, lossless TIFF. A transparent background means PNG — JPEG can''t store transparency.'
section: formats
audience:
  - marketing
  - client
position: 2
status: published
updated: 2026-10-08
cases:
  - wiederkraft
  - m1-group
  - nitrogen
related:
  - 3d-brief
  - deliverables
---

The same render goes to the website, a marketplace listing and a print catalog — and each place needs its own file. If you say so upfront, all of them come from a single render.

## Pixels for screens

A screen shows pixels; DPI means nothing to it. An image for a website is made about twice as wide as its space on the page: if the picture sits in an 800-pixel column, the file is around 1600. Then it stays sharp on high-density screens — on phones and most laptops.

Compression to modern formats such as WebP or AVIF is usually done by the website or CDN itself. A good-quality JPEG or PNG is enough to hand over.

## Marketplaces

As of October 2026, Wildberries and Ozon expect a vertical 3:4 frame. 900×1200 passes on both, but more headroom is better: when zoomed in the listing, a larger frame such as 1500×2000 stays sharp. Formats are JPEG or PNG, up to 10 MB per file.

Covers have "blind zones" — areas overlapped by the platform's badges and buttons. Text and important details don't go there.

Platform requirements change, so check your seller dashboard before uploading.

## Print: DPI and centimeters

::kb-figure{art="pixels-vs-dpi" alt="A 3000-pixel-wide file and two prints: at 300 DPI it's 25 centimeters and sharp, at 150 DPI it's 51 centimeters and softer, with bigger pixels. Below, the formula: centimeters equal pixels divided by DPI times 2.54."}
The file has the same pixels — only the sheet size changes, and how large each pixel lands.
::

DPI is how many pixels fall on an inch of paper. Print that's looked at up close — a catalog, a brochure — needs 300 DPI at the final size. Posters and banners viewed from a distance need less; the print shop will give the exact value.

The formula: centimeters = pixels ÷ DPI × 2.54. A 3000-pixel-wide file at 300 DPI is 25 cm. For the long side of an A4 sheet, 29.7 cm, you need about 3500 pixels.

The format for print is lossless TIFF. Agree on the print color profile with the print shop.

## One render, several frames

::kb-figure{art="aspect-crops" alt="One render with the product in the middle and three frames over it: a vertical 3:4 for marketplaces, a 1:1 square and a wide 16:9 for a website banner."}
With room around the product, one render yields all three frames.
::

If you leave room around the product, one render can be cropped into a vertical frame for a marketplace, a square and a wide banner. Name all the platforms upfront — otherwise the wide frame has to be rendered again. How to put this into a brief is covered in [How to brief a 3D artist](/knowledge/3d-brief).

## JPEG or PNG

::kb-figure{art="png-vs-jpeg" alt="Two panels on a colored background. Left, JPEG: a white rectangle around the product. Right, PNG with transparency: the product sits right on the background."}
JPEG can't store transparency: on a colored page, a white "box" stays around the product.
::

- **JPEG**: for renders on white or a scene background. The file is light; no transparency.
- **PNG**: when you need transparency and the product goes on different backdrops. The file is heavier.
- **TIFF**: for print.

A shadow on a transparent background is made as a separate semi-transparent layer. If you need it, say so in the brief.

## What it looks like in practice

- [WiederKraft](/projects/wiederkraft): one model goes into the product listing, the catalog and large-format print — 300 DPI TIFF files were prepared for print.
- [M1 GROUP](/projects/m1-group): covers for WB and Ozon designed around the marketplaces' "blind zones".
- [Nitrogen](/projects/nitrogen): catalog renders on a transparent background for the catalog and the website.

## Common mistakes

- Stretching a small image for print: the DPI number in the file settings adds no sharpness.
- Sending a heavy PNG where a JPEG would do, and the other way round.
- Cropping tight to the product, then asking for a wide banner.
- Trusting marketplace requirements from a two-year-old article.

## Checklist

1. A list of every platform and every spot on the website.
2. For the website, a file twice as wide as its space on the page.
3. For WB and Ozon, 3:4, at least 900×1200, better with headroom; check the dashboard.
4. For print, the sheet size and 300 DPI at the final size, as TIFF.
5. Transparent background — PNG, with the shadow as a separate layer.
6. Room around the product if you need different frames.
