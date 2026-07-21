import { useEffect, useRef, useState, useCallback } from 'react';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import { InstrumentName, instruments } from '../data/instruments';
import { ChordDef } from '../data/chords';
import { pianoSongs, type PianoSong } from '../data/songs';
import { drumPatterns } from '../data/drums';

export type ArpeggioPattern = 'Up' | 'Down' | 'Up & Down' | 'Random';
export type ArpeggioRate = '4n' | '8n' | '8t' | '16n';
export type AccompanimentPattern = 'Root & Fifth' | 'Octaves' | 'Alberti' | 'Waltz';
export type PianoVoicing = 'Compact' | 'Open' | 'Concert' | 'Wide' | 'Cinematic';
export type PianoSound = 'Open Stage Grand' | 'Concert Grand' | 'Bright Grand' | 'Warm Studio Piano';
export type ViolinStyle = 'Smooth Legato' | 'Bass Guitar' | 'Cinematic Pads';

const PIANO_SOUND_PROFILES: Record<PianoSound, { low: number; mid: number; high: number; width: number; chorus: number; ambience: number }> = {
  'Open Stage Grand': { low: 2.2, mid: 0.8, high: 1.8, width: 0.58, chorus: 0.08, ambience: 0.16 },
  'Concert Grand': { low: 2.8, mid: 1.2, high: 0.8, width: 0.42, chorus: 0.04, ambience: 0.23 },
  'Bright Grand': { low: 0.8, mid: 1.4, high: 3.2, width: 0.5, chorus: 0.06, ambience: 0.14 },
  'Warm Studio Piano': { low: 3.2, mid: 1.8, high: -1.2, width: 0.3, chorus: 0.03, ambience: 0.12 },
};

export interface PianoSettings {
  arpeggio: boolean;
  accompaniment: boolean;
  accompanimentPattern: AccompanimentPattern;
  voicing: PianoVoicing;
  pattern: ArpeggioPattern;
  rate: ArpeggioRate;
  bpm: number;
  beatsPerBar: 2 | 3 | 4 | 6;
  pedal: boolean;
  ambience: number;
  brightness: number;
}

export interface PerformanceNotes {
  bass: string;
  chord: string;
  arpeggio: string;
}

export type PianoHand = 'left' | 'right';

export interface SongPlayback {
  songId: string | null;
  playing: boolean;
  measure: number;
  totalMeasures: number;
  chord: string;
  melodyNote: string;
  accompanimentNotes: string[];
  melodyNotes: string[];
  chordNotes: string[];
  progress: number;
  activeNotes: string[];
  keyboardSize: 61 | 88;
  midiMode: boolean;
}

const PIANO_SAMPLES: Record<string, string> = {
  A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
  A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
  A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
  A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
  A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
  A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
  A6: 'A6.mp3', C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
  A7: 'A7.mp3', C8: 'C8.mp3',
};
const LEGATO_VIOLIN_SAMPLES = { C4: 'violin-1-C4.wav' };
const VIOLIN_MIX_OFFSET_DB = 1;
const INTERACTIVE_LOOK_AHEAD = 0.01;
const SONG_LOOK_AHEAD = 0.04;
const MIDI_START_DELAY = 0.05;
const ARRANGEMENT_START_DELAY = 0.015;

const DEFAULT_PIANO_SETTINGS: PianoSettings = {
  arpeggio: true,
  accompaniment: true,
  accompanimentPattern: 'Root & Fifth',
  voicing: 'Concert',
  pattern: 'Up & Down',
  rate: '8n',
  bpm: 96,
  beatsPerBar: 4,
  pedal: true,
  ambience: 22,
  brightness: 55,
};

const EMPTY_NOTES: PerformanceNotes = { bass: '—', chord: '—', arpeggio: '—' };
const EMPTY_SONG: SongPlayback = { songId: null, playing: false, measure: 0, totalMeasures: 0, chord: '—', melodyNote: '—', accompanimentNotes: [], melodyNotes: [], chordNotes: [], progress: 0, activeNotes: [], keyboardSize: 61, midiMode: false };
const midiCache = new Map<string, Promise<Midi>>();
const loadMidi = (url: string) => {
  let request = midiCache.get(url);
  if (!request) {
    request = fetch(url).then(response => {
      if (!response.ok) throw new Error(`Unable to load MIDI: ${response.status}`);
      return response.arrayBuffer();
    }).then(buffer => new Midi(buffer));
    midiCache.set(url, request);
  }
  return request;
};
const transpose = (note: string, semitones: number) => Tone.Frequency(note).transpose(semitones).toNote();
const unique = <T,>(items: T[]) => [...new Set(items)];
const noteFromMidi = (midi: number) => Tone.Frequency(midi, 'midi').toNote();

// Choose an independent string voice from the current harmony. It favours small
// movements and moves against the piano melody, which creates a composed
// counter-line instead of a doubled melody.
function counterNote(harmony: string[], melodyMidi: number, previous: number | null, melodyDirection: number, step: number) {
  const pitchClasses = unique(harmony.map(note => Tone.Frequency(note).toMidi() % 12));
  const candidates = Array.from({ length: 23 }, (_, index) => 57 + index)
    .filter(midi => pitchClasses.includes(midi % 12))
    .filter(midi => {
      const interval = Math.abs(midi - melodyMidi) % 12;
      return interval !== 1 && interval !== 2 && interval !== 11;
    });
  if (candidates.length === 0) return Math.max(57, Math.min(79, melodyMidi - 7));
  const target = previous === null
    ? melodyMidi - (step % 2 === 0 ? 7 : 4)
    : previous - Math.sign(melodyDirection) * (step % 3 === 0 ? 3 : 2);
  return candidates.reduce((best, candidate) => {
    const movement = previous === null ? 0 : Math.abs(candidate - previous);
    const crossingPenalty = candidate >= melodyMidi ? 9 : 0;
    const leapPenalty = movement > 5 ? (movement - 5) * 2.5 : 0;
    const score = Math.abs(candidate - target) + crossingPenalty + leapPenalty;
    const bestMovement = previous === null ? 0 : Math.abs(best - previous);
    const bestScore = Math.abs(best - target) + (best >= melodyMidi ? 9 : 0) + (bestMovement > 5 ? (bestMovement - 5) * 2.5 : 0);
    return score < bestScore ? candidate : best;
  }, candidates[0]);
}

function patternNotes(notes: string[], pattern: ArpeggioPattern) {
  if (pattern === 'Down') return [...notes].reverse();
  if (pattern === 'Up & Down' && notes.length > 2) return [...notes, ...notes.slice(1, -1).reverse()];
  return notes;
}

function fullVoicing(notes: string[], voicing: PianoVoicing) {
  const root = notes[0];
  const fifth = notes[Math.min(2, notes.length - 1)];
  switch (voicing) {
    case 'Compact': return unique([...notes, transpose(root, 12)]);
    case 'Open': return unique([transpose(root, -12), transpose(fifth, -12), ...notes, transpose(root, 12)]);
    case 'Wide': return unique([transpose(root, -12), transpose(fifth, -12), ...notes, ...notes.map(note => transpose(note, 12))]);
    case 'Cinematic': return unique([transpose(root, -24), transpose(fifth, -12), ...notes, ...notes.map(note => transpose(note, 12)), transpose(root, 24)]);
    default: return unique([transpose(root, -12), transpose(fifth, -12), ...notes, transpose(root, 12), transpose(fifth, 12)]);
  }
}

function bassPattern(notes: string[], pattern: AccompanimentPattern, beatsPerBar: number) {
  const root = transpose(notes[0], -12);
  const fifth = transpose(notes[Math.min(2, notes.length - 1)], -12);
  const octave = notes[0];
  if (pattern === 'Octaves') return [root, octave];
  if (pattern === 'Alberti') return [root, fifth, octave, fifth];
  if (pattern === 'Waltz') return Array.from({ length: beatsPerBar }, (_, index) => index === 0 ? root : fifth);
  return [root, fifth];
}

export function useChordPlayer() {
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const pianoRef = useRef<Tone.Sampler | null>(null);
  const loopsRef = useRef<Tone.Loop[]>([]);
  const currentChordRef = useRef<ChordDef | null>(null);
  const arpStepRef = useRef(0);
  const bassStepRef = useRef(0);
  const settingsRef = useRef(DEFAULT_PIANO_SETTINGS);
  const songEventIdsRef = useRef<number[]>([]);
  const songPartsRef = useRef<Tone.Part[]>([]);
  const songRequestRef = useRef(0);
  const drumSynthsRef = useRef<{ kick: Tone.MembraneSynth; snare: Tone.NoiseSynth; metal: Tone.MetalSynth } | null>(null);
  const songVisualTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const songNoteCountsRef = useRef<Map<string, number>>(new Map());
  const handNotesRef = useRef<Record<PianoHand, string[]>>({ left: [], right: [] });
  const instrumentRef = useRef<InstrumentName>('Grand Piano');
  const [instrument, setInstrumentState] = useState<InstrumentName>('Grand Piano');
  const [volume, setVolume] = useState(2);
  const [pianoReady, setPianoReady] = useState(false);
  const [pianoSettings, setPianoSettingsState] = useState(DEFAULT_PIANO_SETTINGS);
  const [performanceNotes, setPerformanceNotes] = useState<PerformanceNotes>(EMPTY_NOTES);
  const [songPlayback, setSongPlayback] = useState<SongPlayback>(EMPTY_SONG);
  const [songTempo, setSongTempoState] = useState(100);
  const songTempoRef = useRef(100);
  const [drumPattern, setDrumPatternState] = useState('none');
  const drumPatternRef = useRef('none');
  const [pianoSound, setPianoSoundState] = useState<PianoSound>('Open Stage Grand');
  const pianoSoundRef = useRef<PianoSound>('Open Stage Grand');
  const synthVolumeRef = useRef<Tone.Volume | null>(null);
  const pianoVolumeRef = useRef<Tone.Volume | null>(null);
  const drumVolumeRef = useRef<Tone.Volume | null>(null);
  const pianoEqRef = useRef<Tone.EQ3 | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const pianoWidenerRef = useRef<Tone.StereoWidener | null>(null);
  const pianoChorusRef = useRef<Tone.Chorus | null>(null);
  const legatoViolinRef = useRef<Tone.Sampler | null>(null);
  const bassGuitarRef = useRef<Tone.MonoSynth | null>(null);
  const cinematicPadsRef = useRef<Tone.PolySynth<Tone.Synth> | null>(null);
  const violinVolumeRef = useRef<Tone.Volume | null>(null);
  const violinVibratoRef = useRef<Tone.Vibrato | null>(null);
  const [violinEnabled, setViolinEnabledState] = useState(false);
  const violinEnabledRef = useRef(false);
  const [violinStyle, setViolinStyleState] = useState<ViolinStyle>('Smooth Legato');
  const violinStyleRef = useRef<ViolinStyle>('Smooth Legato');

  useEffect(() => {
    Tone.getContext().lookAhead = INTERACTIVE_LOOK_AHEAD;
    const limiter = new Tone.Limiter(-1).toDestination();
    const synthVolume = new Tone.Volume(volume).connect(limiter);
    const synth = new Tone.PolySynth(Tone.Synth).connect(synthVolume);
    const pianoVolume = new Tone.Volume(volume).connect(limiter);
    const reverb = new Tone.Reverb({ decay: 3.2, preDelay: 0.022, wet: DEFAULT_PIANO_SETTINGS.ambience / 100 }).connect(pianoVolume);
    const widener = new Tone.StereoWidener(PIANO_SOUND_PROFILES['Open Stage Grand'].width).connect(reverb);
    const chorus = new Tone.Chorus({ frequency: 0.28, delayTime: 2.4, depth: 0.08, spread: 120, wet: PIANO_SOUND_PROFILES['Open Stage Grand'].chorus }).connect(widener).start();
    const compressor = new Tone.Compressor({ threshold: -16, ratio: 2.2, attack: 0.012, release: 0.24 }).connect(chorus);
    const eq = new Tone.EQ3({ low: 2.2, mid: 0.8, high: 1.8, lowFrequency: 210, highFrequency: 3200 }).connect(compressor);
    const piano = new Tone.Sampler({ urls: PIANO_SAMPLES, baseUrl: '/audio/piano/', attack: 0, release: 1.2, onload: () => setPianoReady(true) }).connect(eq);
    // A separate orchestral bus keeps the violin spacious without washing out
    // the piano's attacks.
    const violinVolume = new Tone.Volume(volume + VIOLIN_MIX_OFFSET_DB).connect(limiter);
    const violinReverb = new Tone.Reverb({ decay: 5.4, preDelay: 0.035, wet: 0.48 }).connect(violinVolume);
    const violinWidener = new Tone.StereoWidener(0.72).connect(violinReverb);
    const violinChorus = new Tone.Chorus({ frequency: 1.35, delayTime: 3.2, depth: 0.14, spread: 150, wet: 0.16 }).connect(violinWidener).start();
    const violinVibrato = new Tone.Vibrato({ frequency: 5.35, depth: 0.105, wet: 0.2 }).connect(violinChorus);
    const violinFilter = new Tone.Filter({ frequency: 5200, type: 'lowpass', rolloff: -24 }).connect(violinVibrato);
    const bassCompressor = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.008, release: 0.16 }).connect(violinVolume);
    const bassFilter = new Tone.Filter({ frequency: 1450, type: 'lowpass', rolloff: -24 }).connect(bassCompressor);
    const bassGuitar = new Tone.MonoSynth({
      oscillator: { type: 'fatsawtooth', count: 2, spread: 8 },
      filter: { type: 'lowpass', rolloff: -24, Q: 1.2 },
      envelope: { attack: 0.008, decay: 0.18, sustain: 0.58, release: 0.16 },
      filterEnvelope: { attack: 0.004, decay: 0.16, sustain: 0.28, release: 0.12, baseFrequency: 80, octaves: 3.1 },
    }).connect(bassFilter);
    const padReverb = new Tone.Reverb({ decay: 7.5, preDelay: 0.045, wet: 0.5 }).connect(violinVolume);
    const padWidener = new Tone.StereoWidener(0.88).connect(padReverb);
    const cinematicPads = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsine', count: 3, spread: 28 },
      envelope: { attack: 0.65, decay: 0.8, sustain: 0.72, release: 2.8 },
    }).connect(padWidener);
    const legatoViolin = new Tone.Sampler({ urls: LEGATO_VIOLIN_SAMPLES, baseUrl: '/audio/violin/', attack: 0.025, release: 0.7 }).connect(violinFilter);
    const drumVolume = new Tone.Volume(volume - 6).connect(limiter);
    const drumCompressor = new Tone.Compressor({ threshold: -12, ratio: 3.5, attack: 0.004, release: 0.12 }).connect(drumVolume);
    const kick = new Tone.MembraneSynth({ pitchDecay: 0.028, octaves: 6.5, envelope: { attack: 0.001, decay: 0.24, sustain: 0, release: 0.06 } }).connect(drumCompressor);
    const snare = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.14, sustain: 0 } }).connect(drumCompressor);
    const metal = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.075, release: 0.025 }, harmonicity: 5.1, modulationIndex: 20, resonance: 4200, octaves: 1.3 }).connect(drumCompressor);
    synthRef.current = synth;
    pianoRef.current = piano;
    synthVolumeRef.current = synthVolume;
    pianoVolumeRef.current = pianoVolume;
    drumVolumeRef.current = drumVolume;
    pianoEqRef.current = eq;
    reverbRef.current = reverb;
    pianoWidenerRef.current = widener;
    pianoChorusRef.current = chorus;
    legatoViolinRef.current = legatoViolin;
    bassGuitarRef.current = bassGuitar;
    cinematicPadsRef.current = cinematicPads;
    violinVolumeRef.current = violinVolume;
    violinVibratoRef.current = violinVibrato;
    drumSynthsRef.current = { kick, snare, metal };
    return () => {
      loopsRef.current.forEach(loop => loop.dispose());
      songPartsRef.current.forEach(part => part.dispose());
      if (songVisualTimerRef.current) clearInterval(songVisualTimerRef.current);
      songEventIdsRef.current.forEach(id => Tone.getTransport().clear(id));
      kick.dispose(); snare.dispose(); metal.dispose(); drumCompressor.dispose(); drumVolume.dispose(); bassGuitar.dispose(); bassFilter.dispose(); bassCompressor.dispose(); cinematicPads.dispose(); padWidener.dispose(); padReverb.dispose(); legatoViolin.dispose(); violinFilter.dispose(); violinVibrato.dispose(); violinChorus.dispose(); violinWidener.dispose(); violinReverb.dispose(); violinVolume.dispose(); piano.dispose(); eq.dispose(); compressor.dispose(); chorus.dispose(); widener.dispose(); reverb.dispose(); pianoVolume.dispose(); synth.dispose(); synthVolume.dispose(); limiter.dispose();
    };
  }, []);

  useEffect(() => {
    // Give piano samples network/decode priority. MIDI preloading begins only
    // after the playable instrument is ready, avoiding first-load contention.
    if (!pianoReady) return;
    const preloadTimer = window.setTimeout(() => {
      pianoSongs.forEach(song => {
        if (!song.midiUrl) return;
        loadMidi(song.midiUrl).catch(() => midiCache.delete(song.midiUrl!));
      });
    }, 250);
    return () => window.clearTimeout(preloadTimer);
  }, [pianoReady]);

  useEffect(() => { synthRef.current?.set(instruments[instrument] as never); }, [instrument]);
  useEffect(() => {
    synthVolumeRef.current?.volume.rampTo(volume, 0.05);
    pianoVolumeRef.current?.volume.rampTo(volume, 0.05);
    drumVolumeRef.current?.volume.rampTo(volume - 6, 0.05);
    violinVolumeRef.current?.volume.rampTo(volume + VIOLIN_MIX_OFFSET_DB, 0.05);
  }, [volume]);

  const releaseAccompaniment = useCallback(() => {
    legatoViolinRef.current?.releaseAll(Tone.immediate());
    bassGuitarRef.current?.triggerRelease(Tone.immediate());
    cinematicPadsRef.current?.releaseAll(Tone.immediate());
  }, []);

  const setViolinEnabled = useCallback((enabled: boolean) => {
    violinEnabledRef.current = enabled;
    setViolinEnabledState(enabled);
    if (!enabled) releaseAccompaniment();
  }, [releaseAccompaniment]);

  const setViolinStyle = useCallback((style: ViolinStyle) => {
    violinStyleRef.current = style;
    setViolinStyleState(style);
    releaseAccompaniment();
  }, [releaseAccompaniment]);

  const configureViolin = useCallback(() => {
    violinVibratoRef.current?.wet.rampTo(0.2, 0.12);
  }, []);

  const triggerAccompaniment = useCallback((note: string, duration: number, time: number, velocity: number, harmony: string[] = []) => {
    const style = violinStyleRef.current;
    if (style === 'Smooth Legato') {
      legatoViolinRef.current?.triggerAttackRelease(note, duration, time, velocity);
      return;
    }
    if (style === 'Bass Guitar') {
      let midi = Tone.Frequency(note).toMidi();
      while (midi > 52) midi -= 12;
      while (midi < 28) midi += 12;
      bassGuitarRef.current?.triggerAttackRelease(noteFromMidi(midi), Math.min(duration, 0.9), time, Math.min(0.72, velocity + 0.14));
      return;
    }
    const source = harmony.length > 0 ? harmony : [note, transpose(note, 7), transpose(note, 12)];
    const pitchClasses = [...new Set(source.map(value => Tone.Frequency(value).toMidi() % 12))];
    const voicing = pitchClasses.slice(0, 4).map((pitchClass, index) => noteFromMidi(48 + pitchClass + (index > 1 ? 12 : 0)));
    cinematicPadsRef.current?.triggerAttackRelease(voicing, Math.max(1.4, duration), time, Math.min(0.38, velocity));
  }, []);

  const stopPatterns = useCallback(() => {
    loopsRef.current.forEach(loop => loop.dispose());
    loopsRef.current = [];
    arpStepRef.current = 0;
    bassStepRef.current = 0;
    setPerformanceNotes(EMPTY_NOTES);
  }, []);

  const clearSong = useCallback(() => {
    songRequestRef.current += 1;
    const transport = Tone.getTransport();
    songEventIdsRef.current.forEach(id => transport.clear(id));
    songEventIdsRef.current = [];
    songPartsRef.current.forEach(part => part.dispose());
    songPartsRef.current = [];
    if (songVisualTimerRef.current) clearInterval(songVisualTimerRef.current);
    songVisualTimerRef.current = null;
    songNoteCountsRef.current.clear();
    releaseAccompaniment();
    setSongPlayback(EMPTY_SONG);
  }, [releaseAccompaniment]);

  const startPatterns = useCallback((chord: ChordDef) => {
    loopsRef.current.forEach(loop => loop.dispose());
    loopsRef.current = [];
    arpStepRef.current = 0;
    bassStepRef.current = 0;
    if (instrumentRef.current !== 'Grand Piano' || !pianoRef.current?.loaded) return;
    const loops: Tone.Loop[] = [];

    if (settingsRef.current.arpeggio) loops.push(new Tone.Loop((time) => {
      const settings = settingsRef.current;
      const notes = patternNotes([...chord.notes, ...chord.notes.map(note => transpose(note, 12))], settings.pattern);
      const note = settings.pattern === 'Random' ? notes[Math.floor(Math.random() * notes.length)] : notes[arpStepRef.current % notes.length];
      arpStepRef.current += 1;
      pianoRef.current?.triggerAttackRelease(note, settings.rate, time, 0.82);
      Tone.getDraw().schedule(() => setPerformanceNotes(current => ({ ...current, arpeggio: note })), time);
    }, settingsRef.current.rate).start(0));

    if (settingsRef.current.accompaniment) loops.push(new Tone.Loop((time) => {
      const settings = settingsRef.current;
      const notes = bassPattern(chord.notes, settings.accompanimentPattern, settings.beatsPerBar);
      const note = notes[bassStepRef.current % notes.length];
      bassStepRef.current += 1;
      pianoRef.current?.triggerAttackRelease(note, '4n', time, 0.68);
      Tone.getDraw().schedule(() => setPerformanceNotes(current => ({ ...current, bass: note })), time);
    }, '4n').start(0));

    loopsRef.current = loops;
    const transport = Tone.getTransport();
    transport.bpm.value = settingsRef.current.bpm;
    transport.timeSignature = settingsRef.current.beatsPerBar;
    if (transport.state !== 'started') transport.start();
  }, []);

  const releaseChord = useCallback(() => {
    stopPatterns();
    clearSong();
    synthRef.current?.releaseAll(Tone.immediate());
    if (pianoRef.current) {
      pianoRef.current.release = settingsRef.current.pedal && instrumentRef.current === 'Grand Piano' ? 1.8 : 0.25;
      pianoRef.current.releaseAll(Tone.immediate());
    }
    currentChordRef.current = null;
  }, [clearSong, stopPatterns]);

  const playChord = useCallback((chord: ChordDef | null) => {
    if (!chord) return releaseChord();
    if (currentChordRef.current?.notes.join('|') === chord.notes.join('|')) return;
    stopPatterns();
    synthRef.current?.releaseAll(Tone.immediate());
    pianoRef.current?.releaseAll(Tone.immediate());
    if (instrumentRef.current === 'Grand Piano' && pianoRef.current?.loaded) {
      const voicedNotes = fullVoicing(chord.notes, settingsRef.current.voicing);
      pianoRef.current.triggerAttack(voicedNotes, Tone.immediate(), 0.48);
      setPerformanceNotes({ bass: '—', chord: voicedNotes.join(' · '), arpeggio: '—' });
      startPatterns(chord);
    } else synthRef.current?.triggerAttack(chord.notes, Tone.immediate());
    currentChordRef.current = chord;
  }, [releaseChord, startPatterns, stopPatterns]);

  const setInstrument = useCallback((next: InstrumentName) => {
    releaseChord(); instrumentRef.current = next; setInstrumentState(next);
  }, [releaseChord]);

  const setPianoSettings = useCallback((patch: Partial<PianoSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setPianoSettingsState(next);
    Tone.getTransport().bpm.rampTo(next.bpm, 0.05);
    Tone.getTransport().timeSignature = next.beatsPerBar;
    reverbRef.current?.wet.rampTo(next.ambience / 100, 0.1);
    if (pianoRef.current) pianoRef.current.release = next.pedal ? 1.8 : 0.25;
    pianoEqRef.current?.high.rampTo((next.brightness - 50) / 5, 0.1);
    pianoEqRef.current?.low.rampTo((50 - next.brightness) / 12, 0.1);
    const chord = currentChordRef.current;
    if (chord && instrumentRef.current === 'Grand Piano') {
      pianoRef.current?.releaseAll(Tone.immediate());
      const voicedNotes = fullVoicing(chord.notes, next.voicing);
      pianoRef.current?.triggerAttack(voicedNotes, Tone.immediate(), 0.48);
      setPerformanceNotes(current => ({ ...current, chord: voicedNotes.join(' · ') }));
      startPatterns(chord);
    }
  }, [startPatterns]);

  const sustainChord = useCallback(() => {}, []);

  const setSongTempo = useCallback((tempo: number) => {
    const nextTempo = Math.min(220, Math.max(40, Math.round(tempo)));
    songTempoRef.current = nextTempo;
    setSongTempoState(nextTempo);
  }, []);

  const setDrumPattern = useCallback((pattern: string) => {
    drumPatternRef.current = pattern;
    setDrumPatternState(pattern);
  }, []);

  const setPianoSound = useCallback((sound: PianoSound) => {
    const profile = PIANO_SOUND_PROFILES[sound];
    pianoSoundRef.current = sound;
    setPianoSoundState(sound);
    pianoEqRef.current?.low.rampTo(profile.low, 0.15);
    pianoEqRef.current?.mid.rampTo(profile.mid, 0.15);
    pianoEqRef.current?.high.rampTo(profile.high, 0.15);
    pianoWidenerRef.current?.width.rampTo(profile.width, 0.15);
    pianoChorusRef.current?.wet.rampTo(profile.chorus, 0.15);
    reverbRef.current?.wet.rampTo(profile.ambience, 0.15);
  }, []);

  const playNote = useCallback((note: string) => {
    if (instrumentRef.current === 'Grand Piano' && pianoRef.current?.loaded) {
      pianoRef.current.triggerAttack(note, Tone.immediate(), 0.78);
    } else {
      synthRef.current?.triggerAttack(note, Tone.immediate());
    }
  }, []);

  const releaseNote = useCallback((note: string) => {
    if (instrumentRef.current === 'Grand Piano' && pianoRef.current?.loaded) {
      pianoRef.current.release = settingsRef.current.pedal ? 1.8 : 0.25;
      pianoRef.current.triggerRelease(note, Tone.immediate());
    } else {
      synthRef.current?.triggerRelease(note, Tone.immediate());
    }
  }, []);

  const releaseHandChord = useCallback((hand: PianoHand) => {
    const notes = handNotesRef.current[hand];
    if (notes.length === 0) return;
    if (instrumentRef.current === 'Grand Piano' && pianoRef.current?.loaded) {
      pianoRef.current.release = 0.35;
      pianoRef.current.triggerRelease(notes, Tone.immediate());
    } else {
      synthRef.current?.triggerRelease(notes, Tone.immediate());
    }
    handNotesRef.current[hand] = [];
    setPerformanceNotes(current => ({
      ...current,
      [hand === 'left' ? 'bass' : 'chord']: '—',
    }));
  }, []);

  const playHandChord = useCallback((hand: PianoHand, chord: ChordDef | null) => {
    if (!chord) { releaseHandChord(hand); return; }
    const root = chord.notes[0];
    const fifth = chord.notes[Math.min(2, chord.notes.length - 1)];
    const notes = hand === 'left'
      ? unique([transpose(root, -12), transpose(fifth, -12), root])
      : unique([...chord.notes.map(note => transpose(note, 12)), transpose(root, 24)]);
    if (handNotesRef.current[hand].join('|') === notes.join('|')) return;
    releaseHandChord(hand);
    if (instrumentRef.current === 'Grand Piano' && pianoRef.current?.loaded) {
      pianoRef.current.release = 0.45;
      pianoRef.current.triggerAttack(notes, Tone.immediate(), hand === 'left' ? 0.55 : 0.44);
    } else {
      synthRef.current?.triggerAttack(notes, Tone.immediate(), hand === 'left' ? 0.62 : 0.5);
    }
    handNotesRef.current[hand] = notes;
    setPerformanceNotes(current => hand === 'left'
      ? { ...current, bass: notes.join(' · ') }
      : { ...current, chord: notes.join(' · ') });
  }, [releaseHandChord]);

  const playSong = useCallback(async (song: PianoSong) => {
    stopPatterns();
    clearSong();
    const requestId = songRequestRef.current;
    currentChordRef.current = null;
    synthRef.current?.releaseAll(Tone.immediate());
    pianoRef.current?.releaseAll(Tone.immediate());
    if (!pianoRef.current?.loaded) return;
    configureViolin();
    // Sampler attacks issued before WAV decoding finishes are silent, so wait
    // for the selected Logic sample before scheduling the performance.
    if (violinEnabledRef.current && violinStyleRef.current === 'Smooth Legato' && !legatoViolinRef.current?.loaded) {
      await Tone.loaded();
      if (requestId !== songRequestRef.current) return;
    }

    if (song.midiUrl) {
      const playbackRate = songTempoRef.current / song.bpm;
      // Enter performance mode before any loading/parsing/scheduling work. Home
      // uses this state to disable the camera and MediaPipe immediately.
      setSongPlayback({
        songId: song.id,
        playing: true,
        measure: 0,
        totalMeasures: 0,
        chord: '—',
        melodyNote: '—',
        accompanimentNotes: [],
        melodyNotes: [],
        chordNotes: [],
        progress: 0,
        activeNotes: [],
        keyboardSize: 61,
        midiMode: true,
      });
      const midi = await loadMidi(song.midiUrl);
      if (requestId !== songRequestRef.current) return;
      const selectedDrums = song.allowDrums === false ? undefined : drumPatterns.find(pattern => pattern.id === drumPatternRef.current);
      const drumMidi = selectedDrums ? await loadMidi(selectedDrums.midiUrl) : null;
      if (requestId !== songRequestRef.current) return;
      // A larger audio look-ahead prevents dense MIDI passages from missing an
      // attack on slower browsers. Interactive latency is restored when stopped.
      Tone.getContext().lookAhead = SONG_LOOK_AHEAD;
      // MIDI pedal events provide the sustain; the sampler release only adds a
      // short natural damper tail after each calculated note-off.
      if (pianoRef.current) pianoRef.current.release = 0.1;
      reverbRef.current?.wet.rampTo(PIANO_SOUND_PROFILES[pianoSoundRef.current].ambience, 0.1);
      const transport = Tone.getTransport();
      transport.stop();
      transport.position = 0;
      const [midiNumerator, midiDenominator] = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4];
      transport.timeSignature = [midiNumerator, midiDenominator];
      const ids: number[] = [];
      // Play acoustic-piano tracks only. Identical copied tracks are recognized by
      // their tick/duration/pitch fingerprints and discarded to prevent doubling.
      const trackFingerprints = new Set<string>();
      const performanceTracks = midi.tracks.filter(track => {
        if (track.notes.length === 0 || track.instrument.percussion || song.excludedMidiChannels?.includes(track.channel) || (!song.includeAllPitchedTracks && track.instrument.family !== 'piano')) return false;
        // Some exports duplicate each hand with tiny humanized tick offsets, so an
        // exact event fingerprint is insufficient. Musical role + event count
        // identifies those copies while preserving distinct RH and LH tracks.
        const role = track.name.trim().toLowerCase().replace(/piano|staff|[-_\s]/g, '');
        const fingerprint = `${role}|${track.notes.length}|${track.instrument.name}`;
        if (trackFingerprints.has(fingerprint)) return false;
        trackFingerprints.add(fingerprint);
        return true;
      });
      const performanceEvents = performanceTracks.flatMap(track => {
        const name = track.name.toLowerCase();
        const averageMidi = track.notes.reduce((sum, note) => sum + note.midi, 0) / track.notes.length;
        const hand = name.includes('right') || name.includes('rh') || (!name.includes('left') && !name.includes('lh') && (performanceTracks.length === 1 || averageMidi >= 60)) ? 'right' : 'left';
        const pedalChanges = track.controlChanges[64] ?? [];
        return track.notes.map(note => {
          const noteEndTick = note.ticks + note.durationTicks;
          const pedalAtRelease = pedalChanges.reduce((state, change) => change.ticks <= noteEndTick ? change.value : state, 0);
          const pedalUp = pedalAtRelease >= 0.5 ? pedalChanges.find(change => change.ticks > noteEndTick && change.value < 0.5) : undefined;
          const pedalDuration = pedalUp ? midi.header.ticksToSeconds(pedalUp.ticks) - note.time : note.duration;
          const performedDuration = Math.max(note.duration, Math.min(pedalDuration, note.duration + 3.5));
          return { note, hand, performedDuration } as const;
        });
      });
      const performanceNotes = performanceEvents.map(event => event.note);
      const requires88Keys = performanceNotes.some(note => note.midi < 36 || note.midi > 96);
      const ticksPerMeasure = midi.header.ppq * midiNumerator * (4 / midiDenominator);
      const totalMeasures = Math.ceil(midi.durationTicks / ticksPerMeasure);

      const mergedEvents = new Map<string, [number, { name: string; duration: number; velocity: number; hand: 'left' | 'right' }]>();
      performanceEvents.forEach(({ note, hand, performedDuration }) => {
        const noteTime = note.time / playbackRate;
        const noteDuration = Math.max(0.045, performedDuration / playbackRate);
        const event = {
          name: note.name,
          duration: noteDuration,
          velocity: Math.min(0.94, Math.max(0.16, note.velocity)),
          hand,
        };
        const key = `${Math.round(noteTime * 200)}|${note.name}`;
        const existing = mergedEvents.get(key);
        if (!existing) mergedEvents.set(key, [noteTime, event]);
        else {
          existing[1].duration = Math.max(existing[1].duration, event.duration);
          existing[1].velocity = Math.max(existing[1].velocity, event.velocity);
        }
      });
      const partEvents = [...mergedEvents.values()].sort((a, b) => a[0] - b[0]);
      const midiPart = new Tone.Part((time, event) => {
          if (requestId !== songRequestRef.current) return;
          const stageVelocity = Math.min(0.98, 0.18 + Math.pow(event.velocity, 0.78) * 0.8);
          pianoRef.current?.triggerAttackRelease(event.name, event.duration, time, stageVelocity);
      }, partEvents).start(0);
      songPartsRef.current = [midiPart];

      if (violinEnabledRef.current) {
        // Compose a counter-melody on a musical grid. Lower-hand notes provide
        // the harmony; the upper voice only informs contrary contour and never
        // supplies the violin's actual pitch.
        const layerStyle = violinStyleRef.current;
        const upper = performanceEvents.filter(event => event.hand === 'right' && event.note.midi >= 55);
        const lower = performanceEvents.filter(event => event.hand === 'left' || event.note.midi < 60);
        const beatSeconds = 60 / songTempoRef.current;
        const gridSeconds = beatSeconds * (layerStyle === 'Bass Guitar' ? 1 : layerStyle === 'Cinematic Pads' ? 4 : 2);
        const violinEvents: [number, { name: string; duration: number; velocity: number; harmony: string[] }][] = [];
        let previousCounter: number | null = null;
        let previousMelody = upper[0]?.note.midi ?? 72;
        const phrasePoints = Array.from({ length: Math.ceil((midi.duration / playbackRate) / gridSeconds) }, (_, step) => {
              // Occasional eighth-note displacement keeps the solo conversational
              // instead of landing mechanically on every strong beat.
              const displacement = layerStyle === 'Smooth Legato' && step % 4 === 2 ? beatSeconds * 0.5 : 0;
              const time = step * gridSeconds + displacement;
              const sourceTime = time * playbackRate;
              const melody = [...upper].reverse().find(event => event.note.time <= sourceTime + 0.08)?.note.midi ?? previousMelody;
              return { time, melody, gap: gridSeconds };
            });
        phrasePoints.forEach(({ time, melody, gap }, step) => {
          const sourceTime = time * playbackRate;
          const soundingHarmony = lower.filter(event => event.note.time <= sourceTime && event.note.time + event.performedDuration > sourceTime).map(event => event.note.name);
          const recentHarmony = lower.filter(event => event.note.time <= sourceTime).slice(-4).map(event => event.note.name);
          const harmony = soundingHarmony.length > 0 ? soundingHarmony : recentHarmony;
          if (harmony.length === 0) return;
          const selected = counterNote(harmony, melody, previousCounter, melody - previousMelody, step);
          if (layerStyle === 'Smooth Legato' && step > 0 && step % 3 === 1 && time > 0.09) {
            const approach = selected + (melody - previousMelody >= 0 ? -1 : 1);
            violinEvents.push([time - 0.075, {
              name: noteFromMidi(approach),
              duration: 0.065,
              velocity: 0.25,
              harmony,
            }]);
          }
          const phraseArc = 0.34 + 0.1 * Math.sin(((step % 8) / 7) * Math.PI);
          violinEvents.push([time, {
            name: noteFromMidi(selected),
            duration: gridSeconds * (layerStyle === 'Bass Guitar' ? 0.72 : layerStyle === 'Cinematic Pads' ? 1.08 : (step % 4 === 3 ? 0.72 : 0.94)),
            velocity: layerStyle === 'Bass Guitar' ? (step % 4 === 0 ? 0.52 : 0.38) : layerStyle === 'Cinematic Pads' ? 0.3 : phraseArc,
            harmony,
          }]);
          previousCounter = selected;
          previousMelody = melody;
        });
        const violinPart = new Tone.Part((time, event) => {
          if (requestId === songRequestRef.current) triggerAccompaniment(event.name, event.duration, time, event.velocity, event.harmony);
        }, violinEvents).start(0);
        songPartsRef.current.push(violinPart);
      }

      if (drumMidi) {
        const drumNotes = drumMidi.tracks.flatMap(track => track.notes);
        const [drumNumerator, drumDenominator] = drumMidi.header.timeSignatures[0]?.timeSignature ?? [4, 4];
        const drumMeasureTicks = drumMidi.header.ppq * drumNumerator * (4 / drumDenominator);
        const drumLoopMeasures = Math.max(1, Math.round(drumMidi.durationTicks / drumMeasureTicks));
        const drumLoopTicks = drumMeasureTicks * drumLoopMeasures;
        const songLoopTicks = ticksPerMeasure * drumLoopMeasures;
        const drumLoopSeconds = midi.header.ticksToSeconds(songLoopTicks) / playbackRate;
        const drumEvents = drumNotes.map(note => [
          (note.ticks / drumLoopTicks) * drumLoopSeconds,
          { midi: note.midi, velocity: Math.max(0.2, note.velocity) },
        ] as [number, { midi: number; velocity: number }]);
        const drumPart = new Tone.Part((time, event) => {
          if (requestId !== songRequestRef.current) return;
          const drums = drumSynthsRef.current;
          if (!drums) return;
          if (event.midi === 35 || event.midi === 36) drums.kick.triggerAttackRelease('C1', '16n', time, Math.min(1, event.velocity * 1.08));
          else if ([38, 39, 40].includes(event.midi)) drums.snare.triggerAttackRelease('16n', time, event.velocity * 0.78);
          else drums.metal.triggerAttackRelease('32n', time, event.velocity * (event.midi >= 49 && event.midi <= 59 ? 0.34 : 0.2));
        }, drumEvents).start(0);
        drumPart.loop = true;
        drumPart.loopEnd = drumLoopSeconds;
        songPartsRef.current.push(drumPart);
      }

      for (let measureIndex = 0; measureIndex < totalMeasures; measureIndex += 1) {
        const startTick = measureIndex * ticksPerMeasure;
        const endTick = startTick + ticksPerMeasure;
        const measureTime = midi.header.ticksToSeconds(startTick) / playbackRate;
        ids.push(transport.scheduleOnce(time => {
          Tone.getDraw().schedule(() => setSongPlayback(current => ({
            ...current,
            measure: measureIndex + 1,
            chord: '—',
            progress: (measureTime / (midi.duration / playbackRate)) * 100,
          })), time);
        }, measureTime));
      }

      ids.push(transport.scheduleOnce(time => {
        pianoRef.current?.releaseAll(time);
        transport.stop(time + 0.02);
        Tone.getDraw().schedule(() => {
          if (songVisualTimerRef.current) clearInterval(songVisualTimerRef.current);
          songVisualTimerRef.current = null;
          Tone.getContext().lookAhead = INTERACTIVE_LOOK_AHEAD;
          if (pianoRef.current) pianoRef.current.release = settingsRef.current.pedal ? 1.8 : 0.25;
          reverbRef.current?.wet.rampTo(settingsRef.current.ambience / 100, 0.08);
          songNoteCountsRef.current.clear();
          setSongPlayback(current => ({ ...current, playing: false, progress: 100, activeNotes: [], melodyNote: '—', accompanimentNotes: [], melodyNotes: [], chordNotes: [] }));
        }, time);
      }, midi.duration / playbackRate + 0.05));
      songEventIdsRef.current = ids;
      setSongPlayback({ songId: song.id, playing: true, measure: 0, totalMeasures, chord: '—', melodyNote: '—', accompanimentNotes: [], melodyNotes: [], chordNotes: [], progress: 0, activeNotes: [], keyboardSize: requires88Keys ? 88 : 61, midiMode: true });
      transport.start(`+${MIDI_START_DELAY}`);
      // Visual state is sampled at 25 FPS. This caps React work regardless of how
      // dense the score becomes and leaves the main thread free for audio.
      const scaledEvents = performanceEvents.map(({ note, hand, performedDuration }) => ({
        name: note.name,
        midi: note.midi,
        hand,
        start: note.time / playbackRate,
        end: (note.time + performedDuration) / playbackRate,
      }));
      songVisualTimerRef.current = setInterval(() => {
        if (transport.state !== 'started') return;
        const position = transport.seconds;
        const soundingEvents = scaledEvents.filter(event => event.start <= position && event.end > position);
        const activeNotes = unique(soundingEvents.map(event => event.name));
        const explicitLeft = soundingEvents.filter(event => event.hand === 'left');
        const rightOrUpper = soundingEvents.filter(event => event.hand === 'right' && (explicitLeft.length > 0 || event.midi >= 60));
        const accompanimentEvents = explicitLeft.length > 0
          ? explicitLeft
          : soundingEvents.filter(event => event.midi < 60);
        const highestMelodyMidi = rightOrUpper.reduce((highest, event) => Math.max(highest, event.midi), -Infinity);
        const melodyEvents = rightOrUpper.filter(event => event.midi === highestMelodyMidi);
        const chordEvents = rightOrUpper.filter(event => event.midi !== highestMelodyMidi);
        const accompanimentNotes = unique(accompanimentEvents.map(event => event.name));
        const melodyNotes = unique(melodyEvents.map(event => event.name));
        const chordNotes = unique(chordEvents.map(event => event.name));
        let melodyNote = '—';
        for (let index = scaledEvents.length - 1; index >= 0; index -= 1) {
          const event = scaledEvents[index];
          if (event.hand === 'right' && event.start <= position) { melodyNote = event.name; break; }
        }
        setSongPlayback(current => ({
          ...current,
          activeNotes,
          accompanimentNotes,
          melodyNotes,
          chordNotes,
          melodyNote,
          progress: Math.min(100, (position / (midi.duration / playbackRate)) * 100),
        }));
      }, 40);
      return;
    }

    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;
    transport.bpm.value = song.bpm;
    transport.timeSignature = song.beatUnit === 8 ? [song.beatsPerBar, 8] : song.beatsPerBar;
    const beatSeconds = 60 / song.bpm;
    const measureSeconds = beatSeconds * song.beatsPerBar;
    const ids: number[] = [];
    const phraseVelocity = (measureIndex: number, step: number, steps: number) => {
      const phrase = 0.82 + 0.1 * Math.sin(((measureIndex + step / Math.max(steps, 1)) / 4) * Math.PI);
      const accent = step === 0 ? 0.07 : step % 2 === 0 ? 0.025 : -0.015;
      return Math.min(0.98, phrase + accent);
    };
    let generatedCounterNote: number | null = null;
    let generatedMelodyNote = 72;

    song.measures.forEach((measure, measureIndex) => {
      const measureStart = measureIndex * measureSeconds;
      // Keep harmony in the middle register so it supports, rather than masks,
      // the melody. Closely voiced triads also move more naturally between bars.
      const harmonyNotes: string[] = measure.chordNotes.map(note => transpose(note, 12));
      const hasWrittenScore = Boolean(measure.score?.length);
      // Score-led songs use a warm, lower chord layer. Generated arrangements use
      // the brighter upper voicing. Both are driven by this exact measure tick.
      const performedHarmony = hasWrittenScore ? measure.chordNotes : harmonyNotes;
      ids.push(transport.scheduleOnce(time => {
        // Harmony, bass downbeat and UI all land on the exact same transport tick.
        // Keeping the chord as one sampler event prevents perceived chord drift.
        pianoRef.current?.triggerAttackRelease(
          performedHarmony,
          measureSeconds * (hasWrittenScore ? 0.88 : 0.98),
          time,
          hasWrittenScore ? 0.2 : 0.33,
        );
        Tone.getDraw().schedule(() => setSongPlayback(current => ({
          ...current,
          measure: measureIndex + 1,
          chord: measure.chord,
          progress: (measureIndex / song.measures.length) * 100,
          activeNotes: performedHarmony,
        })), time);
      }, measureStart));

      if (!hasWrittenScore) for (let beat = 0; beat < song.beatsPerBar; beat += 1) {
        ids.push(transport.scheduleOnce(time => {
          const root = transpose(measure.chordNotes[0], -12);
          const fifth = transpose(measure.chordNotes[Math.min(2, measure.chordNotes.length - 1)], -12);
          const bassNote = beat === 0 || (song.beatsPerBar === 4 && beat === 2) ? root : fifth;
          pianoRef.current?.triggerAttackRelease(bassNote, beatSeconds * 0.82, time, beat === 0 ? 0.6 : 0.4);
          if (beat === 0) pianoRef.current?.triggerAttackRelease(transpose(root, -12), beatSeconds * 0.94, time, 0.42);
        }, measureStart + beat * beatSeconds));
      }

      measure.score?.forEach(event => {
        const eventStart = measureStart + event.beat * beatSeconds;
        const duration = event.duration * beatSeconds;
        ids.push(transport.scheduleOnce(time => {
          pianoRef.current?.triggerAttackRelease(event.note, duration, time, event.velocity ?? (event.hand === 'left' ? 0.5 : 0.76));
          Tone.getDraw().schedule(() => setSongPlayback(current => ({
            ...current,
            melodyNote: event.hand === 'right' ? event.note : current.melodyNote,
            activeNotes: unique([...current.activeNotes, event.note]),
          })), time);
          Tone.getDraw().schedule(() => setSongPlayback(current => ({
            ...current,
            // A melody release must not visually release the same pitch while the
            // chord layer is still holding it.
            activeNotes: current.activeNotes.filter(note => note !== event.note || performedHarmony.includes(note)),
          })), time + duration);
        }, eventStart));
      });

      const stepSeconds = measureSeconds / measure.melody.length;
      const melodyEvents = measure.melody
        .map((note, step) => note ? { note, step } : null)
        .filter((event): event is { note: string; step: number } => event !== null);
      melodyEvents.forEach(({ note, step }, eventIndex) => {
        const nextStep = melodyEvents[eventIndex + 1]?.step;
        // Connect adjacent notes, but preserve written rests. This removes clipped
        // notes without smearing phrases together.
        const stepsUntilNext = nextStep === undefined ? measure.melody.length - step : nextStep - step;
        const duration = stepSeconds * (stepsUntilNext === 1 ? 0.96 : Math.min(stepsUntilNext * 0.84, 1.65));
        ids.push(transport.scheduleOnce(time => {
          pianoRef.current?.triggerAttackRelease(note, duration, time, phraseVelocity(measureIndex, step, measure.melody.length));
          Tone.getDraw().schedule(() => setSongPlayback(current => ({
            ...current,
            melodyNote: note,
            activeNotes: unique([...current.activeNotes, note]),
          })), time);
          Tone.getDraw().schedule(() => setSongPlayback(current => ({
            ...current,
            activeNotes: current.activeNotes.filter(active => active !== note || harmonyNotes.includes(note)),
          })), time + duration);
        }, measureStart + step * stepSeconds));
      });

      if (violinEnabledRef.current) {
        const layerStyle = violinStyleRef.current;
        const violinSteps = layerStyle === 'Bass Guitar' ? song.beatsPerBar : layerStyle === 'Cinematic Pads' ? 1 : Math.max(1, Math.ceil(song.beatsPerBar / 2));
        const firstMelody = measure.melody.find(Boolean);
        if (measureIndex === 0 && firstMelody) generatedMelodyNote = Tone.Frequency(firstMelody).toMidi();
        const violinPoints = Array.from({ length: violinSteps }, (_, step) => {
              const position = Math.floor((step / violinSteps) * measure.melody.length);
              return { position, start: measureStart + (step / violinSteps) * measureSeconds, slot: measureSeconds / violinSteps, melody: measure.melody.slice(0, position + 1).reverse().find(Boolean) };
            });
        violinPoints.forEach((point, step) => {
          const nearbyMelody = point.melody ?? measure.melody.slice(0, point.position + 1).reverse().find(Boolean);
          const melodyMidi = nearbyMelody ? Tone.Frequency(nearbyMelody).toMidi() : generatedMelodyNote;
          const selected = counterNote(measure.chordNotes, melodyMidi, generatedCounterNote, melodyMidi - generatedMelodyNote, measureIndex * violinSteps + step);
          const phraseStep = measureIndex * violinSteps + step;
          if (layerStyle === 'Smooth Legato' && phraseStep > 0 && phraseStep % 3 === 1 && point.start > 0.09) {
            const approach = selected + (melodyMidi - generatedMelodyNote >= 0 ? -1 : 1);
            ids.push(transport.scheduleOnce(time => triggerAccompaniment(
              noteFromMidi(approach), 0.065, time, 0.25, measure.chordNotes,
            ), point.start - 0.075));
          }
          const phraseArc = 0.34 + 0.1 * Math.sin(((phraseStep % 8) / 7) * Math.PI);
          ids.push(transport.scheduleOnce(time => triggerAccompaniment(
            noteFromMidi(selected),
            layerStyle === 'Cinematic Pads' ? measureSeconds * 1.04 : point.slot * (layerStyle === 'Bass Guitar' ? 0.72 : 0.9),
            time,
            layerStyle === 'Bass Guitar' ? (step === 0 ? 0.52 : 0.38) : layerStyle === 'Cinematic Pads' ? 0.3 : phraseArc,
            measure.chordNotes,
          ), point.start));
          generatedCounterNote = selected;
          generatedMelodyNote = melodyMidi;
        });
      }
    });

    const totalSeconds = song.measures.length * measureSeconds;
    ids.push(transport.scheduleOnce(time => {
      Tone.getDraw().schedule(() => setSongPlayback(current => ({ ...current, playing: false, progress: 100, melodyNote: '—', accompanimentNotes: [], melodyNotes: [], chordNotes: [], activeNotes: [] })), time);
    }, totalSeconds));
    songEventIdsRef.current = ids;
    // Do not announce the first chord early; its scheduled callback updates every
    // visual on the same audio-clock instant as the first piano attack.
    setSongPlayback({ songId: song.id, playing: true, measure: 0, totalMeasures: song.measures.length, chord: '—', melodyNote: '—', accompanimentNotes: [], melodyNotes: [], chordNotes: [], progress: 0, activeNotes: [], keyboardSize: 61, midiMode: false });
    transport.start(`+${ARRANGEMENT_START_DELAY}`);
  }, [clearSong, configureViolin, stopPatterns, triggerAccompaniment]);

  const stopSong = useCallback(() => {
    clearSong();
    Tone.getTransport().stop();
    pianoRef.current?.releaseAll(Tone.immediate());
    releaseAccompaniment();
    Tone.getContext().lookAhead = INTERACTIVE_LOOK_AHEAD;
    if (pianoRef.current) pianoRef.current.release = settingsRef.current.pedal ? 1.8 : 0.25;
    reverbRef.current?.wet.rampTo(settingsRef.current.ambience / 100, 0.08);
  }, [clearSong, releaseAccompaniment]);

  return {
    instrument, setInstrument, volume, setVolume, playChord, sustainChord, releaseChord,
    pianoSettings, setPianoSettings, pianoReady, performanceNotes, playNote, releaseNote,
    songPlayback, playSong, stopSong, songTempo, setSongTempo, drumPattern, setDrumPattern,
    pianoSound, setPianoSound, violinEnabled, setViolinEnabled, violinStyle, setViolinStyle,
    playHandChord, releaseHandChord,
  };
}
