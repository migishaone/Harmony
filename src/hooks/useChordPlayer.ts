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
  key: string;
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
const EMPTY_SONG: SongPlayback = { songId: null, playing: false, measure: 0, totalMeasures: 0, chord: '—', melodyNote: '—', accompanimentNotes: [], melodyNotes: [], chordNotes: [], progress: 0, activeNotes: [], keyboardSize: 61, midiMode: false, key: '—' };
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
  const chordPianoRef = useRef<Tone.Sampler | null>(null);
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
  const instrumentRef = useRef<InstrumentName>('Grand Piano');
  const [instrument, setInstrumentState] = useState<InstrumentName>('Grand Piano');
  const [volume, setVolume] = useState(2);
  const [pianoReady, setPianoReady] = useState(false);
  const [pianoSettings, setPianoSettingsState] = useState(DEFAULT_PIANO_SETTINGS);
  const [performanceNotes, setPerformanceNotes] = useState<PerformanceNotes>(EMPTY_NOTES);
  const [songPlayback, setSongPlayback] = useState<SongPlayback>(EMPTY_SONG);
  const [songTempo, setSongTempoState] = useState(100);
  const songTempoRef = useRef(100);
  const [songKey, setSongKeyState] = useState('C Major');
  const songKeyRef = useRef('C Major');
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
    // Ring chords have their own voice. Releasing a ring chord can therefore
    // never release notes currently owned by song playback.
    const chordPiano = new Tone.Sampler({ urls: PIANO_SAMPLES, baseUrl: '/audio/piano/', attack: 0, release: 1.2 }).connect(eq);
    const drumVolume = new Tone.Volume(volume - 6).connect(limiter);
    const drumCompressor = new Tone.Compressor({ threshold: -12, ratio: 3.5, attack: 0.004, release: 0.12 }).connect(drumVolume);
    const kick = new Tone.MembraneSynth({ pitchDecay: 0.028, octaves: 6.5, envelope: { attack: 0.001, decay: 0.24, sustain: 0, release: 0.06 } }).connect(drumCompressor);
    const snare = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.14, sustain: 0 } }).connect(drumCompressor);
    const metal = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.075, release: 0.025 }, harmonicity: 5.1, modulationIndex: 20, resonance: 4200, octaves: 1.3 }).connect(drumCompressor);
    synthRef.current = synth;
    pianoRef.current = piano;
    chordPianoRef.current = chordPiano;
    synthVolumeRef.current = synthVolume;
    pianoVolumeRef.current = pianoVolume;
    drumVolumeRef.current = drumVolume;
    pianoEqRef.current = eq;
    reverbRef.current = reverb;
    pianoWidenerRef.current = widener;
    pianoChorusRef.current = chorus;
    drumSynthsRef.current = { kick, snare, metal };
    return () => {
      loopsRef.current.forEach(loop => loop.dispose());
      songPartsRef.current.forEach(part => part.dispose());
      if (songVisualTimerRef.current) clearInterval(songVisualTimerRef.current);
      songEventIdsRef.current.forEach(id => Tone.getTransport().clear(id));
      kick.dispose(); snare.dispose(); metal.dispose(); drumCompressor.dispose(); drumVolume.dispose(); chordPiano.dispose(); piano.dispose(); eq.dispose(); compressor.dispose(); chorus.dispose(); widener.dispose(); reverb.dispose(); pianoVolume.dispose(); synth.dispose(); synthVolume.dispose(); limiter.dispose();
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
  }, [volume]);

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
    setSongPlayback(EMPTY_SONG);
  }, []);

  const startPatterns = useCallback((chord: ChordDef) => {
    loopsRef.current.forEach(loop => loop.dispose());
    loopsRef.current = [];
    arpStepRef.current = 0;
    bassStepRef.current = 0;
    if (instrumentRef.current !== 'Grand Piano' || !chordPianoRef.current?.loaded) return;
    const loops: Tone.Loop[] = [];

    if (settingsRef.current.arpeggio) loops.push(new Tone.Loop((time) => {
      const settings = settingsRef.current;
      const notes = patternNotes([...chord.notes, ...chord.notes.map(note => transpose(note, 12))], settings.pattern);
      const note = settings.pattern === 'Random' ? notes[Math.floor(Math.random() * notes.length)] : notes[arpStepRef.current % notes.length];
      arpStepRef.current += 1;
      chordPianoRef.current?.triggerAttackRelease(note, settings.rate, time, 0.82);
      Tone.getDraw().schedule(() => setPerformanceNotes(current => ({ ...current, arpeggio: note })), time);
    }, settingsRef.current.rate).start(0));

    if (settingsRef.current.accompaniment) loops.push(new Tone.Loop((time) => {
      const settings = settingsRef.current;
      const notes = bassPattern(chord.notes, settings.accompanimentPattern, settings.beatsPerBar);
      const note = notes[bassStepRef.current % notes.length];
      bassStepRef.current += 1;
      chordPianoRef.current?.triggerAttackRelease(note, '4n', time, 0.68);
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
    synthRef.current?.releaseAll(Tone.immediate());
    if (chordPianoRef.current) {
      chordPianoRef.current.release = settingsRef.current.pedal && instrumentRef.current === 'Grand Piano' ? 1.8 : 0.25;
      chordPianoRef.current.releaseAll(Tone.immediate());
    }
    currentChordRef.current = null;
  }, [stopPatterns]);

  const playChord = useCallback((chord: ChordDef | null) => {
    if (!chord) return releaseChord();
    if (currentChordRef.current?.notes.join('|') === chord.notes.join('|')) return;
    stopPatterns();
    synthRef.current?.releaseAll(Tone.immediate());
    chordPianoRef.current?.releaseAll(Tone.immediate());
    if (instrumentRef.current === 'Grand Piano' && chordPianoRef.current?.loaded) {
      const voicedNotes = fullVoicing(chord.notes, settingsRef.current.voicing);
      chordPianoRef.current.triggerAttack(voicedNotes, Tone.immediate(), 0.48);
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
    if (chordPianoRef.current) chordPianoRef.current.release = next.pedal ? 1.8 : 0.25;
    pianoEqRef.current?.high.rampTo((next.brightness - 50) / 5, 0.1);
    pianoEqRef.current?.low.rampTo((50 - next.brightness) / 12, 0.1);
    const chord = currentChordRef.current;
    if (chord && instrumentRef.current === 'Grand Piano') {
      chordPianoRef.current?.releaseAll(Tone.immediate());
      const voicedNotes = fullVoicing(chord.notes, next.voicing);
      chordPianoRef.current?.triggerAttack(voicedNotes, Tone.immediate(), 0.48);
      setPerformanceNotes(current => ({ ...current, chord: voicedNotes.join(' · ') }));
      startPatterns(chord);
    }
  }, [startPatterns]);

  const setSongTempo = useCallback((tempo: number) => {
    const nextTempo = Math.min(220, Math.max(40, Math.round(tempo)));
    songTempoRef.current = nextTempo;
    setSongTempoState(nextTempo);
  }, []);

  const setSongKey = useCallback((key: string) => {
    songKeyRef.current = key;
    setSongKeyState(key);
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

  const playSong = useCallback(async (song: PianoSong) => {
    stopPatterns();
    clearSong();
    const requestId = songRequestRef.current;
    currentChordRef.current = null;
    chordPianoRef.current?.releaseAll(Tone.immediate());
    synthRef.current?.releaseAll(Tone.immediate());
    pianoRef.current?.releaseAll(Tone.immediate());
    if (!pianoRef.current?.loaded) return;
    const chromatic = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const sourceRoot = song.key.split(' ')[0];
    const targetRoot = songKeyRef.current.split(' ')[0];
    const rawShift = chromatic.indexOf(targetRoot) - chromatic.indexOf(sourceRoot);
    const semitoneShift = rawShift > 6 ? rawShift - 12 : rawShift < -6 ? rawShift + 12 : rawShift;
    const songNote = (note: string) => semitoneShift === 0 ? note : transpose(note, semitoneShift);
    const songChord = (chord: string) => chord.replace(/^[A-G]#?/, root => {
      const index = chromatic.indexOf(root);
      return index < 0 ? root : chromatic[(index + semitoneShift + 12) % 12];
    });
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
        key: songKeyRef.current,
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
      const requires88Keys = performanceNotes.some(note => note.midi + semitoneShift < 36 || note.midi + semitoneShift > 96);
      const ticksPerMeasure = midi.header.ppq * midiNumerator * (4 / midiDenominator);
      const totalMeasures = Math.ceil(midi.durationTicks / ticksPerMeasure);

      const mergedEvents = new Map<string, [number, { name: string; duration: number; velocity: number; hand: 'left' | 'right' }]>();
      performanceEvents.forEach(({ note, hand, performedDuration }) => {
        const noteTime = note.time / playbackRate;
        const noteDuration = Math.max(0.045, performedDuration / playbackRate);
        const event = {
          name: songNote(note.name),
          duration: noteDuration,
          velocity: Math.min(0.94, Math.max(0.16, note.velocity)),
          hand,
        };
        const key = `${Math.round(noteTime * 200)}|${event.name}`;
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
      setSongPlayback({ songId: song.id, playing: true, measure: 0, totalMeasures, chord: '—', melodyNote: '—', accompanimentNotes: [], melodyNotes: [], chordNotes: [], progress: 0, activeNotes: [], keyboardSize: requires88Keys ? 88 : 61, midiMode: true, key: songKeyRef.current });
      transport.start(`+${MIDI_START_DELAY}`);
      // Keep two ordered cursors instead of filtering the complete score on every
      // frame. Dense MIDI files can contain tens of thousands of notes; rescanning
      // all of them 25 times a second starves the audio thread on slower devices.
      const scaledEvents = performanceEvents.map(({ note, hand, performedDuration }, id) => ({
        id,
        name: songNote(note.name),
        midi: note.midi + semitoneShift,
        hand,
        start: note.time / playbackRate,
        end: (note.time + performedDuration) / playbackRate,
      })).sort((a, b) => a.start - b.start);
      const endingEvents = [...scaledEvents].sort((a, b) => a.end - b.end);
      const soundingById = new Map<number, typeof scaledEvents[number]>();
      let startCursor = 0;
      let endCursor = 0;
      let previousPosition = -1;
      let latestMelodyNote = '—';
      songVisualTimerRef.current = setInterval(() => {
        if (transport.state !== 'started') return;
        const position = transport.seconds;
        // Reset safely if the transport is rewound or restarted.
        if (position < previousPosition) {
          soundingById.clear();
          startCursor = 0;
          endCursor = 0;
          latestMelodyNote = '—';
        }
        previousPosition = position;
        while (startCursor < scaledEvents.length && scaledEvents[startCursor].start <= position) {
          const event = scaledEvents[startCursor++];
          soundingById.set(event.id, event);
          if (event.hand === 'right') latestMelodyNote = event.name;
        }
        while (endCursor < endingEvents.length && endingEvents[endCursor].end <= position) {
          soundingById.delete(endingEvents[endCursor++].id);
        }
        const soundingEvents = [...soundingById.values()];
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
        setSongPlayback(current => ({
          ...current,
          activeNotes,
          accompanimentNotes,
          melodyNotes,
          chordNotes,
          melodyNote: latestMelodyNote,
          progress: Math.min(100, (position / (midi.duration / playbackRate)) * 100),
        }));
      }, 50);
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
    song.measures.forEach((measure, measureIndex) => {
      const measureStart = measureIndex * measureSeconds;
      // Keep harmony in the middle register so it supports, rather than masks,
      // the melody. Closely voiced triads also move more naturally between bars.
      const transposedChordNotes = measure.chordNotes.map(songNote);
      const harmonyNotes: string[] = transposedChordNotes.map(note => transpose(note, 12));
      const hasWrittenScore = Boolean(measure.score?.length);
      // Score-led songs use a warm, lower chord layer. Generated arrangements use
      // the brighter upper voicing. Both are driven by this exact measure tick.
      const performedHarmony = hasWrittenScore ? transposedChordNotes : harmonyNotes;
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
          chord: songChord(measure.chord),
          progress: (measureIndex / song.measures.length) * 100,
          activeNotes: performedHarmony,
        })), time);
      }, measureStart));

      if (!hasWrittenScore) for (let beat = 0; beat < song.beatsPerBar; beat += 1) {
        ids.push(transport.scheduleOnce(time => {
          const root = transpose(transposedChordNotes[0], -12);
          const fifth = transpose(transposedChordNotes[Math.min(2, transposedChordNotes.length - 1)], -12);
          const bassNote = beat === 0 || (song.beatsPerBar === 4 && beat === 2) ? root : fifth;
          pianoRef.current?.triggerAttackRelease(bassNote, beatSeconds * 0.82, time, beat === 0 ? 0.6 : 0.4);
          if (beat === 0) pianoRef.current?.triggerAttackRelease(transpose(root, -12), beatSeconds * 0.94, time, 0.42);
        }, measureStart + beat * beatSeconds));
      }

      measure.score?.forEach(event => {
        const transposedNote = songNote(event.note);
        const eventStart = measureStart + event.beat * beatSeconds;
        const duration = event.duration * beatSeconds;
        ids.push(transport.scheduleOnce(time => {
          pianoRef.current?.triggerAttackRelease(transposedNote, duration, time, event.velocity ?? (event.hand === 'left' ? 0.5 : 0.76));
          Tone.getDraw().schedule(() => setSongPlayback(current => ({
            ...current,
            melodyNote: event.hand === 'right' ? transposedNote : current.melodyNote,
            activeNotes: unique([...current.activeNotes, transposedNote]),
          })), time);
          Tone.getDraw().schedule(() => setSongPlayback(current => ({
            ...current,
            // A melody release must not visually release the same pitch while the
            // chord layer is still holding it.
            activeNotes: current.activeNotes.filter(note => note !== transposedNote || performedHarmony.includes(note)),
          })), time + duration);
        }, eventStart));
      });

      const stepSeconds = measureSeconds / measure.melody.length;
      const melodyEvents = measure.melody
        .map((note, step) => note ? { note: songNote(note), step } : null)
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

    });

    const totalSeconds = song.measures.length * measureSeconds;
    ids.push(transport.scheduleOnce(time => {
      Tone.getDraw().schedule(() => setSongPlayback(current => ({ ...current, playing: false, progress: 100, melodyNote: '—', accompanimentNotes: [], melodyNotes: [], chordNotes: [], activeNotes: [] })), time);
    }, totalSeconds));
    songEventIdsRef.current = ids;
    // Do not announce the first chord early; its scheduled callback updates every
    // visual on the same audio-clock instant as the first piano attack.
    setSongPlayback({ songId: song.id, playing: true, measure: 0, totalMeasures: song.measures.length, chord: '—', melodyNote: '—', accompanimentNotes: [], melodyNotes: [], chordNotes: [], progress: 0, activeNotes: [], keyboardSize: 61, midiMode: false, key: songKeyRef.current });
    transport.start(`+${ARRANGEMENT_START_DELAY}`);
  }, [clearSong, stopPatterns]);

  const stopSong = useCallback(() => {
    clearSong();
    Tone.getTransport().stop();
    pianoRef.current?.releaseAll(Tone.immediate());
    Tone.getContext().lookAhead = INTERACTIVE_LOOK_AHEAD;
    if (pianoRef.current) pianoRef.current.release = settingsRef.current.pedal ? 1.8 : 0.25;
    reverbRef.current?.wet.rampTo(settingsRef.current.ambience / 100, 0.08);
  }, [clearSong]);

  return {
    instrument, setInstrument, volume, setVolume, playChord, releaseChord,
    pianoSettings, setPianoSettings, pianoReady, performanceNotes, playNote, releaseNote,
    songPlayback, playSong, stopSong, songTempo, setSongTempo, songKey, setSongKey, drumPattern, setDrumPattern,
    pianoSound, setPianoSound,
  };
}
