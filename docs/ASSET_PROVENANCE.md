# Verso — Asset & Font Provenance

Authoritative provenance for the brand assets and fonts introduced in the
Phase 1 cinematic dark foundation. Created 2026-07-12 (UTC). Dark-only V1.

> This file is created by Phase 1 and is intentionally **not** linked from
> `README.md` or any other doc during Phase 1 (documentation cross-linking is a
> later-phase task).

---

## 1. Source of the brand assets

The Dawn logo family and the interface/narrative icon set are copied **verbatim**
(no redraw, restroke, recolor, or geometry change) from the locked Claude Design
production package, `verso-brand-handoff/` (delivered as `landing page.zip`).
All logo/icon SVGs and `app-icon-1024.png` are originals created for Verso; the
package records no third-party embedded assets.

---

## 2. Logo assets (copied verbatim from handoff `logo/`)

| Repository destination | SHA-256 |
|---|---|
| `src/assets/brand/logo/verso-dawn-full.svg` | `80cda7ddd2a729e9accefeb39aeada4048d6307cc6e40bd648e183079da8a784` |
| `src/assets/brand/logo/verso-dawn-symbol.svg` | `a311843756890566a0c2e886a8ccd558d4e750a4f9bc8a414b7ed6d0625d5dfa` |
| `src/assets/brand/logo/verso-wordmark.svg` | `556095111fa0b6c25f916a389712b635d9b9c9748259d0123d20b2eaf476e44a` |
| `src/assets/brand/logo/verso-dawn-on-dark.svg` | `a0e229eb58bbd1eb88eff5bd8e561efa9172d85795be16965e02c9bb334e944f` |
| `src/assets/brand/logo/verso-dawn-on-light.svg` | `204304e6a95a47fc887c7ad68e2f9acd65ef61b83731188670584701afccd587` |
| `src/assets/brand/logo/verso-dawn-monochrome.svg` | `91f523772042f0e3009d40be51aa892f80569a795c7d02e84c6771be69c35157` |
| `src/assets/brand/logo/verso-dawn-small-nav.svg` | `e42a88e0f361ffc60869570e27701a6a3dc22244ca4490b1118d4430fd12968f` |
| `src/assets/brand/logo/app-icon-1024.png` | `5f841874720fa9740c5f616dbae30b605706c4e1e075914425965366d713c44a` |

---

## 3. Icon assets (copied verbatim from handoff `icons/`)

UI icons are `24×24`, `1.5px` stroke, `currentColor` (color-controlled via CSS
mask in `BrandIcon`). Narrative icons are `48×48` with baked brand colors.

| Repository destination | SHA-256 |
|---|---|
| `src/assets/brand/icons/ui-home.svg` | `fd483b92658c1592c594fb724390e44d6c239494e82e148f81be28c9510eb108` |
| `src/assets/brand/icons/ui-memorize.svg` | `dcd93ffdb00c8d0115be7c080fb51531946bdd43486c165c43da0c9a02a69b35` |
| `src/assets/brand/icons/ui-cards.svg` | `f15cdb07dd282c204f36dd62812c91ad708028ac920fb51b52b3c4f60d06bf28` |
| `src/assets/brand/icons/ui-paths.svg` | `fa7bb4888247e49182c9fc7e4c7131afd24f5d2dfa9ecac1dafea046813810c4` |
| `src/assets/brand/icons/ui-saved.svg` | `32a90d8effb97149717e09f9f6c7fe0ecb628d0e0d5b641c70a87dfc0c0c40ce` |
| `src/assets/brand/icons/ui-clue.svg` | `175be1f1fa1f87cafdea05e7b3c5d288705b0e1ed0c39bb98fac1bf3722edd12` |
| `src/assets/brand/icons/ui-share.svg` | `867bf347c0c2cf9e48424d86d9b3ec2afc94281d51d568ba707cd8092f917084` |
| `src/assets/brand/icons/ui-delete.svg` | `d568e155d9f5ef3348eeb1617638a7925a7b4e4e953dc85444b5cdf4a0718616` |
| `src/assets/brand/icons/ui-search.svg` | `404913f52fde05ad352e089e02ad0458542a5cde9b1e35e49a6140b7b5c206d6` |
| `src/assets/brand/icons/ui-settings.svg` | `fb79886995eac8773125a09a3ba3c62ef4f7963dbb9be0ab8bb0a1747d48e143` |
| `src/assets/brand/icons/ui-language.svg` | `f74473d52221473984fc47d4fcc33c14c2dbd898ee0c7486b0c8465e220d5680` |
| `src/assets/brand/icons/ui-previous.svg` | `01939b15d3bbf79bb22a624f64b0335ef0b0114714a0d5e3d130d5274fce1fea` |
| `src/assets/brand/icons/ui-next.svg` | `eee56e5a0b6564706c4955f60426aa58df3009e00f1a516ac94090c722e07423` |
| `src/assets/brand/icons/ui-completion.svg` | `007b6a3a616ed56f2d4ff7a03030537ebc247fb1dc2f5745072d44cf14b84dcc` |
| `src/assets/brand/icons/ui-progress.svg` | `cf30444bedb86c77ec6a13c4bd57d85e9fdfce22fa5e719712883ea254c8e4d0` |
| `src/assets/brand/icons/narrative-plant.svg` | `f3809f2d0ebdf30c5bba61ec674612b7187b87d05ae02421b2ce9e5c700fb442` |
| `src/assets/brand/icons/narrative-tend.svg` | `9f5c313ba9eef12f34e28424619537a8ed9e25ff57abfeeddab6da0b724a4bdb` |
| `src/assets/brand/icons/narrative-harvest.svg` | `d01b395d52e2e3744c65d70230ab47c2c53f11f0a0aa764f2205185173a293ea` |

---

## 4. PWA icons & favicons

**Master:** `src/assets/brand/logo/app-icon-1024.png`
SHA-256 `5f841874720fa9740c5f616dbae30b605706c4e1e075914425965366d713c44a`
(1024×1024, from handoff `logo/app-icon-1024.png`).

**Derived (high-quality Lanczos downscale from the 1024 master; no crop, recolor,
sharpen, blur, text, padding, or artwork alteration):**

| Destination | Size | Method | SHA-256 |
|---|---|---|---|
| `public/icon-192.png` | 192×192 | Pillow 11.3.0 `Image.LANCZOS` | `8a747866f53e30fe35ccf1191149dad5f02935f7fb85697bf3650a96fa416be9` |
| `public/icon-512.png` | 512×512 | Pillow 11.3.0 `Image.LANCZOS` | `965f0ffb4c2e0d19dd3b8ecccb767e4a30ef5a1d7a6c7fd3de50b0ab9558853a` |

**Favicons / Apple touch icon (verbatim copies of the handoff files, no resize):**

| Destination | Source (handoff) | SHA-256 |
|---|---|---|
| `public/apple-touch-icon.png` | `logo/favicon-180.png` (180×180) | `11a6613fafa8972c9c047d233766683e55ef7d21790bec22efb0a7f300da61cd` |
| `public/favicon-32.png` | `logo/favicon-32.png` (32×32) | `d185e25a511c839631cc68965583461342fa452f23cab2a87d005271a61648a6` |
| `public/favicon-16.png` | `logo/favicon-16.png` (16×16) | `8e59bdb0d51138205b290ba3d5a8bbe86bcdb61ecb038b2d00e053a549720240` |

### Maskable-icon status — DEFERRED

The handoff does not explicitly approve the Dawn app icon as maskable. Phase 1
therefore ships **ordinary icons only**: `public/manifest.json` declares
`"purpose": "any"` and **does not** claim `"maskable"`. A maskable icon may be
approved only through a separately authorized phase, via explicit handoff
approval or an objective safe-zone validation (all important artwork inside the
centered safe-zone circle of radius = 40% of the icon size). No artwork
alteration is to be performed to force maskability.

---

## 5. Fonts — Fraunces + Hanken Grotesk (self-hosted, SIL OFL 1.1)

Both families are SIL Open Font License 1.1 (free for commercial/app embedding).
Source: the official `google/fonts` repository. Downloaded to a temporary
directory under `/tmp` (not committed). Converted TTF → WOFF2 in a temporary
Python venv (`/tmp/verso-font-tools`) with **fonttools 4.60.2 + brotli** only
(no global install, no npm dependency, no `package.json`/lockfile change).

**Conversion method:** `fontTools.ttLib.TTFont(src)` → `font.flavor = "woff2"` →
`font.save(out)`. All tables are preserved, so variable axes, family/style
names, weight ranges, optical sizing (`opsz`), and font metadata are retained.

**Conversion date:** 2026-07-12 (UTC).

### Source TTFs (official google/fonts)

| Family / style | Source URL | Source SHA-256 |
|---|---|---|
| Fraunces upright (variable) | `https://raw.githubusercontent.com/google/fonts/main/ofl/fraunces/Fraunces%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf` | `177ff6c0f14e5550a3c624247cd1189611d4eb65d000b14944c63d967958abbb` |
| Fraunces italic (variable) | `https://raw.githubusercontent.com/google/fonts/main/ofl/fraunces/Fraunces-Italic%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf` | `b24448c43702fac4ee856781d461a0dfba8d8e594b6e8e190234b75fed2c0e01` |
| Hanken Grotesk upright (variable) | `https://raw.githubusercontent.com/google/fonts/main/ofl/hankengrotesk/HankenGrotesk%5Bwght%5D.ttf` | `813b3f8fa0965405669a89b38e51bbefd95eef6b8e20d1cb2d8c10cce062662f` |

Preserved variable axes:
- Fraunces (both styles): `opsz` 9–144, `wght` 100–900, `SOFT` 0–100, `WONK` 0–1.
- Hanken Grotesk: `wght` 100–900.

### Generated WOFF2 (committed)

| Destination | SHA-256 |
|---|---|
| `public/fonts/fraunces-variable.woff2` | `966a28c36291ac836ff5c987d63ecb97c88eff58db997e9a3aaff9c97487696d` |
| `public/fonts/fraunces-variable-italic.woff2` | `8262d660e427a911bef45836776eb1b077f1c5727c73e19c3246cc1ca3da5739` |
| `public/fonts/hanken-grotesk-variable.woff2` | `78abd4141042d8b2ebd3bdc8714ffd44b8b970e1dc60818cc77bea720df2d7ff` |

### License files (official OFL.txt, copied verbatim)

| Destination | Source URL | Source SHA-256 |
|---|---|---|
| `public/fonts/licenses/Fraunces-OFL-1.1.txt` | `https://raw.githubusercontent.com/google/fonts/main/ofl/fraunces/OFL.txt` | `bdf4c22802eaf804f998195871c6b8938aac2ac14b2d78a8bd66a6f1eced833b` |
| `public/fonts/licenses/Hanken-Grotesk-OFL-1.1.txt` | `https://raw.githubusercontent.com/google/fonts/main/ofl/hankengrotesk/OFL.txt` | `e02ccb89a86839b22feff7872ff5cc355cc0f58318d29eee20e2cf83a612f16d` |

### Typography finding (explicit)

- **Fraunces upright and italic are required** (display, Scripture, titles,
  numerals, earned moments, and the single approved italic emphasis).
- **Hanken Grotesk upright is required** (body, UI, controls, navigation,
  labels, instructions, captions, feedback).
- **Hanken Grotesk italic is NOT specified or used** by the approved handoff.
  `typography/typography.md`, `Verso-Brand-Guidelines.html`,
  `components/components.html`, and `screens/screens.css` all load Hanken upright
  weights only; italic emphasis belongs to Fraunces.
- **No Hanken italic file was acquired**, no Hanken italic `@font-face` exists,
  and new Phase 1 Hanken text does not use synthesized italics
  (`font-synthesis: none` is set on `body`).

---

## 6. Wheat photograph — provenance recorded, integration deferred

The signature wheat image is **not copied or integrated** in Phase 1 (image work
is Phase 7). Provenance is recorded here so it is on file:

- Original filename: `wheat-ethereal.jpg`
- Lovable asset ID: `542871a9-21df-4244-a3fc-17e03d9ff107`
- Original Lovable pointer path: `src/assets/wheat-cinematic.jpg.asset.json`
- Creation timestamp: `2026-06-19T07:21:39Z`
- MIME type: `image/jpeg`
- Attribution requirement: none recorded
- Commercial-use restriction: none recorded
- Handoff master: `assets/wheat-original.jpg`
- Byte-identical handoff copy: `assets/hero-wheat.jpg`
- SHA-256: `6593c49573909bbc068a9ded6c5318f38d30b7b27fc38e73fc0bbd1bfc37f1ff`

Notes:
- The handoff's responsive PNG variants (`wheat-desktop.png`, `wheat-tablet.png`,
  `wheat-portrait.png`) are **not** literal crops of the master; they are
  separate renders. Do not treat them as authoritative crops.
- True responsive crops/downscales will be derived later from the confirmed
  master and integrated in Phase 7.
