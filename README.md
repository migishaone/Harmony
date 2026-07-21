<p align="center">
  <img src="public/harmony-logo.svg" alt="Harmony" width="330">
</p>

<p align="center">
  A touchless musical instrument powered by hand gestures, computer vision,
  and real-time browser audio.
</p>

<p align="center">
  <a href="https://github.com/migishaone/Harmony/actions"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/migishaone/Harmony/ci.yml?branch=main&label=build"></a>
  <a href="https://github.com/migishaone/Harmony"><img alt="Node.js 20.19 or newer" src="https://img.shields.io/badge/Node.js-%E2%89%A520.19-339933?logo=nodedotjs&logoColor=white"></a>
  <a href="LICENSE"><img alt="Elastic License 2.0" src="https://img.shields.io/badge/license-Elastic%202.0-00bfb3"></a>
</p>

## Overview

Harmony turns a webcam into an expressive musical interface. Point toward a
section of the chord wheel to perform chords without touching the screen, or
use the on-screen controls and piano keyboard for direct interaction. Audio,
hand tracking, and the bundled hand-landmark model run in the browser—no
application backend is required.

## Highlights

- **Touchless performance:** real-time hand and fingertip tracking at up to 30
  frames per second, with GPU acceleration and automatic CPU fallback.
- **Musical depth:** 36 selectable instrument voices, all 12 major and minor
  keys, chromatic layouts, and filters for nine chord families.
- **Sampled grand piano:** full-chord voicings, arpeggios, accompaniment
  patterns, sustain, tempo, meter, ambience, and tone controls.
- **Song performance:** bundled MIDI arrangements with adjustable tempo, piano
  character, optional drums, and violin layers.
- **Visual feedback:** live hand state, active chord, performance notes, song
  progress, and an interactive piano keyboard.
- **Private by design:** webcam frames are processed locally and are not
  uploaded by Harmony.

## How to play

1. Select **Initialize System** and allow webcam access.
2. Hold your hand where the camera can see it clearly.
3. Extend your index finger and point inside a chord-wheel sector.
4. Move between sectors to change chords; move outside the wheel to release.
5. Choose a key, chord family, instrument, or Grand Piano performance setting
   from the controls.

Mouse and touch interaction remain available for the chord wheel, selectors,
song library, and piano keyboard.

## Technology

| Area | Technology |
| --- | --- |
| Interface | React 19, TypeScript, Tailwind CSS 4, Radix UI |
| Build | Vite 7 |
| Hand tracking | MediaPipe Tasks Vision |
| Audio | Tone.js and the Web Audio API |
| MIDI | `@tonejs/midi` |
| Routing and data | Wouter and TanStack Query |

## Requirements

- Node.js 20.19 or newer
- npm 10 or newer
- A modern desktop browser with WebRTC, WebAssembly, and Web Audio support
- A webcam and audio output

For webcam access outside `localhost`, the application must be served over
HTTPS. A well-lit environment and an uncluttered background produce the best
tracking results.

## Getting started

```bash
git clone https://github.com/migishaone/Harmony.git
cd Harmony
cp .env.example .env
npm install
npm run dev
```

Open <http://localhost:3001>, select **Initialize System**, and grant camera
access when prompted. Change `PORT` in `.env` if port `3001` is unavailable.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Vite development server |
| `npm run typecheck` | Run TypeScript validation without emitting files |
| `npm run build` | Type-check and create a production build in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm start` | Serve the production preview on all network interfaces |

## Production deployment

Create the optimized static build:

```bash
npm ci
npm run build
```

Deploy the generated `dist/` directory to an HTTPS-enabled static host. Configure
the host to fall back to `index.html` for client-side routes. The included
`ecosystem.config.cjs` can run `npm start` with PM2 when a Node-managed preview
process is appropriate.

## Architecture

```text
public/
  audio/              Bundled instrument samples
  mediapipe/          Local hand-landmark model and WebAssembly runtime
  songs/              MIDI arrangements used by the song player
src/
  components/         Musical controls and reusable interface components
  data/               Chords, instruments, drum patterns, and song metadata
  hooks/              Hand-tracking and audio-performance engines
  lib/                Shared utilities
  pages/              Route-level views
```

The camera stream enters the local hand-tracking hook, which maps the index
finger position to a chord-wheel sector. The audio engine then schedules notes,
samples, accompaniment, and effects through Tone.js. Camera frames do not leave
the browser.

## Privacy and permissions

Harmony requests camera access only to detect hand landmarks. Processing uses
the model and WebAssembly files bundled in `public/mediapipe/`. The project has
no backend, user accounts, analytics integration, or database. Browser camera
permissions can be revoked at any time through site settings.

## Contributing

Bug reports and focused pull requests are welcome through
[GitHub Issues](https://github.com/migishaone/Harmony/issues). Before submitting
a change:

1. Create a branch from `main`.
2. Keep the change focused and document user-visible behavior.
3. Run `npm run typecheck` and `npm run build`.
4. Confirm that any new media or code can legally be distributed with the
   project.

By contributing, you agree that your contribution may be distributed under the
project's license. Please use GitHub Issues for reproducible bugs and avoid
including private camera images, credentials, or personal data.

## License

Copyright © 2026 **Xenova Labs CBC**. Harmony is source-available under the
[Elastic License 2.0](LICENSE).

You may use, copy, modify, and redistribute the source code subject to the
license terms. You may not offer Harmony's substantial functionality to third
parties as a hosted or managed service, circumvent protected license-key
functionality, or remove licensing and copyright notices. Modified copies must
identify their changes and include the license terms.

Third-party libraries and assets remain under their respective licenses. See
[NOTICE](NOTICE) and the attribution files distributed with those assets,
including [`public/audio/piano/README.md`](public/audio/piano/README.md).

---

<p align="center">
  Built and maintained by <strong>Xenova Labs CBC</strong>.
</p>
