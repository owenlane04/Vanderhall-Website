# Footer social artwork: sources and terms

Six marks, one per destination in the footer's social row. Added in V22 (2026-08-13), which replaced
the six text links V11-I had shipped. Every file here was downloaded from a real URL and is recorded
below with that URL and the permission it rests on. **No file in this directory was drawn, traced,
recoloured, or geometry-edited.** `src/data/social-icons.mjs` reads these files at build time, so the
artwork on the page is derived from the bytes in this directory and a missing file fails the build.

`check-content.mjs` asserts that this file names every glyph the build inlines and cites a URL for
each. If you add or replace a mark, add its row here in the same commit.

## What ships

| File | Platform | Source | Basis | Colour as delivered |
|---|---|---|---|---|
| `facebook.svg` | Facebook | Meta brand asset `facebook-app.svg`, internal id `f_logo_RGB-White_1024`, retrieved 2026-08-13 via `https://web.archive.org/web/20191113032915id_/https://facebookbrand.com/wp-content/uploads/2019/10/Copy-of-facebook-app.svg` | Official Meta artwork. "You may also use the 'f' logo to drive to your presence on Facebook", and Meta's correct-use examples include a website footer. See `https://www.meta.com/brand/resources/facebook/logo/` | White `#FFFFFE` |
| `instagram.svg` | Instagram | Meta brand asset `instagram.svg`, internal id `glyph-logo_May2016`, retrieved 2026-08-13 via `https://web.archive.org/web/20191113032924id_/https://facebookbrand.com/wp-content/uploads/2019/10/Copy-of-instagram.svg` | Official Meta artwork. "Use the glyph to point to your presence on Instagram", any solid colour permitted, 29px minimum. See `https://www.meta.com/brand/resources/instagram/instagram-brand/` | White `#FFFFFF` |
| `x.svg` | X | `logo.svg` from the official toolkit archive `https://about.x.com/content/dam/about-twitter/x/brand-toolkit/x-logo.zip`, retrieved 2026-08-13 | Official. The brand guide exists so partners can "signpost where your audience can find you". Black or white only. Permission is revocable at X's discretion. `https://about.x.com/en/who-we-are/brand-toolkit` | White |
| `linkedin.png` | LinkedIn | `InBug-White.png` from the official archive `https://content.linkedin.com/content/dam/me/business/en-us/amp/xbu/linkedin-revised-brand-guidelines/logos/in-logo.zip`, retrieved 2026-08-13 | Official, and the **"in" bug only**. Permitted "as a hyperlink to your LinkedIn profile, company page" and "in a series of social media icons showing your participation in those sites". `https://brand.linkedin.com/in-logo` | White, 840x779 |
| `tiktok.svg` | TikTok | `https://raw.githubusercontent.com/simple-icons/simple-icons/master/icons/tiktok.svg`, retrieved 2026-08-13 | **CC0 (Simple Icons), not official artwork.** See the note below. | No fill attribute; inherits `currentColor` |
| `youtube.svg` | YouTube | `https://raw.githubusercontent.com/simple-icons/simple-icons/master/icons/youtube.svg`, retrieved 2026-08-13 | **CC0 (Simple Icons), not official artwork.** See the note below. | No fill attribute; inherits `currentColor` |

## Why two of the six are CC0 rather than official

Both official sources were fetched and neither yields a single-colour glyph:

- **TikTok.** The official developer-portal logo pack
  (`https://sf16-va.tiktokcdn.com/obj/eden-va2/uvzhqeh7nuhd/tt4d/logo-pack.zip`) was downloaded in
  full. Its icon files are multi-colour by design (black plus `#25F4EE` cyan and `#FE2C55` red), and
  the only vectors in the pack are 315x44 "Log in with TikTok" buttons carrying the wordmark.
  Producing a monochrome glyph from either would mean editing the artwork, which is exactly what the
  licence forbids.
- **YouTube.** `brand.youtube` serves a JavaScript application that exposes no asset URLs. The one
  live official vector, `https://www.gstatic.com/youtube/img/branding/youtubelogo/svg/youtubelogo.svg`,
  is the full wordmark lockup; isolating the play button from it is an edit.

The Simple Icons project releases its files under CC0 1.0 (public domain), which settles the copyright
in the drawing. It does **not** grant trademark permission, and neither platform publishes the
self-serve permission the other four do. Those two asks are open and tracked in `INTEGRATION.md` under
`social-icon-rights`. **This directory must not gain a `linkedin.svg` from Simple Icons**: LinkedIn's
mark was removed from that project after a legal notice from Microsoft, and the official PNG above is
the only version this site may use.

## Rules for anyone changing these

1. **Never hand-author or trace path data.** A file here must be bytes downloaded from a stated source.
2. **Never use the LinkedIn wordmark.** Only the "in" bug is permitted for a footer link.
   `check-content.mjs` fails the build if this file names a wordmark asset.
3. **White only.** White is an approved rendering for all six. Grey is approved by Instagram alone, so
   the row must not adopt the footer's grey text tone; the build asserts the computed fill is white.
   **Known size deviation.** The marks render at **20px**, after Owen asked twice on 2026-08-13 for
   smaller logos (30px originally, then 24, then 20). That is below Instagram's stated 29x29px
   minimum and exactly ON YouTube's stated 20px minimum; only Facebook's 16px is cleared with room.
   These are legibility guidelines rather than conditions of the permissions quoted above, and the
   request was explicit, so the size ships. But the row is now at the smallest size that does not
   break a published brand minimum outright: **do not shrink it further without a decision**, and
   raise this if Vanderhall ever asks Instagram or YouTube to review the footer.
4. **Do not recolour or reshape.** These files keep their published fills. The build wraps them, it
   does not edit them. An earlier version stripped fill attributes to force `currentColor` and made
   the Facebook and Instagram marks render as invisible boxes while every automated assertion still
   passed, because an invisible path has the bounding box of a visible one. Look at the row after
   changing anything in it.
