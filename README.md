# Harmony

Harmony is a browser-based touchless musical instrument. It uses your webcam to track hand direction and plays chords through the Web Audio API.

Grand Piano mode uses locally bundled Salamander Grand Piano recordings and
adds full-chord voicing, tempo-synchronized arpeggios, sustain pedal, meter,
room ambience, and tone controls. See `public/audio/piano/README.md` for sample
attribution.

## Requirements

- Node.js 20.19 or newer
- npm 10 or newer
- A modern browser with webcam access

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3001`, select **Initialize System**, and allow camera access when prompted.

The local port is configured with `PORT` in `.env`. Copy `.env.example` when setting up another environment.

## Commands

- `npm run dev` starts the local development server.
- `npm run typecheck` checks the TypeScript source.
- `npm run build` creates a production build in `dist/`.
- `npm run preview` serves the production build using the port configured in `.env`.

## Project structure

```text
public/              Static browser assets
src/components/      App and reusable UI components
src/data/            Chord and instrument definitions
src/hooks/           Hand tracking and audio behavior
src/lib/             Shared utilities
src/pages/           Route-level screens
```

The app runs entirely in the browser and does not require a backend, database, or externally hosted hand-tracking model.

## License

Copyright (c) 2026 Xenova Labs CBC. Harmony is source-available under the
[Elastic License 2.0](LICENSE).

You may use, copy, modify, and redistribute the source code subject to the
license terms. You may not offer Harmony's substantial features as a hosted or
managed service, circumvent license-key functionality, or remove licensing and
copyright notices. Modified copies must clearly identify their changes and
include the license.

Third-party libraries and assets retain their own licenses. See [NOTICE](NOTICE)
and the attribution files included with those assets.
