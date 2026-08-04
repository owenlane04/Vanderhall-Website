# Vanderhall Motor Works website

Static V1 implementation generated from the confirmed files in `../Plans/` and the source media in `../Assets/`.

## Commands

```sh
npm install
npm run images
npm run build
npm run check
npm run verify:browser
```

Serve the folder locally before running browser verification:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

## Structure

- `src/` contains the data model, reusable render primitives, source styles, and build script.
- `assets/images/` contains WebP delivery files generated at quality 80.
- `scripts/site.js` is the minimal browser interaction layer.
- Route folders and root `index.html` are the generated static site.
- `work/` contains browser and Lighthouse reports and is ignored by Git.

## Required before production

Visible `MISSING` blocks are intentional development gates. They identify unverified prices, dealer records, legal wording, imagery, copy, dimensions, weights, and specifications. Replace only from verified Vanderhall source material, then rebuild and rerun all checks.
