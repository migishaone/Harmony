import { createRoot } from 'react-dom/client';
import * as Tone from 'tone';

import App from './App';

import './index.css';

// Audio latency is chosen when the native AudioContext is constructed. Setting
// it later is ignored (and is read-only in Opera), so install the low-latency
// context before React mounts and before any instruments are created.
Tone.setContext(new Tone.Context({
  latencyHint: 'interactive',
  lookAhead: 0,
  updateInterval: 0.01,
}));

createRoot(document.getElementById('root')!).render(<App />);
