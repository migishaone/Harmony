import { useEffect, useState, useMemo, useRef } from 'react';
import * as Tone from 'tone';
import { useHandDetection } from '../hooks/useHandDetection';
import { useChordPlayer } from '../hooks/useChordPlayer';
import { keySets, ChordType } from '../data/chords';
import { ChordWheel } from '../components/ChordWheel';
import { InstrumentSelector } from '../components/InstrumentSelector';
import { KeySelector } from '../components/KeySelector';
import { WelcomeOverlay } from '../components/WelcomeOverlay';
import { PianoControls } from '../components/PianoControls';
import { PianoKeyboard } from '../components/PianoKeyboard';
import { SongLibrary } from '../components/SongLibrary';
import { ChordNoteList } from '../components/ChordNoteList';
import { pianoSongs } from '../data/songs';

const GESTURE_SWITCH_STABILITY_MS = 90;
const GESTURE_RELEASE_GRACE_MS = 320;

export function Home() {
  const [started, setStarted] = useState(false);
  const [activeKeySet, setActiveKeySet] = useState(keySets[0]); // Default C Major
  const [filterType, setFilterType] = useState<ChordType | "All">("All");
  
  const { instrument, setInstrument, volume, setVolume, playChord, releaseChord, pianoSettings, setPianoSettings, pianoReady, performanceNotes, playNote, releaseNote, songPlayback, playSong, stopSong, songTempo, setSongTempo, songKey, setSongKey, drumPattern, setDrumPattern, pianoSound, setPianoSound } = useChordPlayer();
  const {
    pointerPosition,
    openness,
    detected,
    fingerCount,
    isPointing,
    handedness,
    videoRef,
  } = useHandDetection(!songPlayback.midiMode);

  const [activeSector, setActiveSector] = useState<number | null>(null);
  const [directSector, setDirectSector] = useState<number | null>(null);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const tempoRestartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureCandidateRef = useRef<{ sector: number | null; since: number }>({ sector: null, since: 0 });
  
  // Filter chords based on selection
  const visibleChords = useMemo(() => {
    if (filterType === "All") return activeKeySet.chords;
    return activeKeySet.chords.filter(c => c.type === filterType);
  }, [activeKeySet, filterType]);
  const pointerAngle = useMemo(() => {
    if (!pointerPosition || !wheelRef.current) return null;
    const rect = wheelRef.current.getBoundingClientRect();
    return Math.atan2(pointerPosition.y - (rect.top + rect.height / 2), pointerPosition.x - (rect.left + rect.width / 2));
  }, [pointerPosition]);
  const handleStart = async () => {
    await Tone.start();
    setStarted(true);
  };

  const selectSector = (sector: number | null) => {
    // The song scheduler owns the shared transport while it is playing. Ring
    // input is ignored so a click, touch, or pointer-leave cannot stop the song.
    if (songPlayback.playing) return;
    setDirectSector(sector);
    if (!started) return;
    setActiveSector(sector);
    if (sector === null) releaseChord();
    else playChord(visibleChords[sector]);
  };

  // A key or filter change creates a new mapping; never leave notes from the
  // previous mapping sounding or keep an out-of-range sector selected.
  useEffect(() => {
    if (songPlayback.playing) return;
    setActiveSector(null);
    setDirectSector(null);
    releaseChord();
  }, [visibleChords, releaseChord, songPlayback.playing]);

  const handlePlaySong = (song: Parameters<typeof playSong>[0]) => {
    const songKeySet = keySets.find(keySet => keySet.name === song.key);
    if (songKeySet) setActiveKeySet(songKeySet);
    setFilterType('All');
    setActiveSector(null);
    setDirectSector(null);
    setSongTempo(song.bpm);
    setSongKey(song.key);
    playSong(song);
  };

  const handleSongKeyChange = (key: string) => {
    setSongKey(key);
    if (!songPlayback.songId) return;
    const activeSong = pianoSongs.find(song => song.id === songPlayback.songId);
    if (activeSong) playSong(activeSong);
  };

  const handleSongTempoChange = (tempo: number) => {
    setSongTempo(tempo);
    if (!songPlayback.playing || !songPlayback.songId) return;
    const activeSong = pianoSongs.find(song => song.id === songPlayback.songId);
    if (!activeSong) return;
    if (tempoRestartRef.current) clearTimeout(tempoRestartRef.current);
    tempoRestartRef.current = setTimeout(() => playSong(activeSong), 180);
  };

  const handleDrumPatternChange = (pattern: string) => {
    setDrumPattern(pattern);
    if (!songPlayback.playing || !songPlayback.songId) return;
    const activeSong = pianoSongs.find(song => song.id === songPlayback.songId);
    if (activeSong) playSong(activeSong);
  };

  useEffect(() => () => {
    if (tempoRestartRef.current) clearTimeout(tempoRestartRef.current);
  }, []);

  useEffect(() => {
    // Song playback owns the audio engine. Camera jitter must not select or
    // release ring chords while a score is being performed.
    if (songPlayback.playing) return;
    if (directSector !== null) return;
    let target: number | null = null;
    if (!detected || !isPointing || pointerAngle === null || !wheelRef.current || visibleChords.length === 0) {
      target = null;
    } else {
      const rect = wheelRef.current.getBoundingClientRect();
      const distance = Math.hypot(pointerPosition!.x - (rect.left + rect.width / 2), pointerPosition!.y - (rect.top + rect.height / 2));
      const size = Math.min(rect.width, rect.height);
      if (distance >= size * 0.125 && distance <= size * 0.475) {
        const anglePerSector = (2 * Math.PI) / visibleChords.length;
        const normalized = (pointerAngle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
        target = Math.floor(((normalized + anglePerSector / 2) % (Math.PI * 2)) / anglePerSector);
      }
    }

    if (target === activeSector) {
      gestureCandidateRef.current = { sector: target, since: performance.now() };
      return;
    }

    // The first valid gesture must always produce sound immediately. Requiring
    // several identical camera frames here can leave the piano silent when a
    // naturally jittery fingertip crosses sector edges between detections.
    if (activeSector === null && target !== null) {
      gestureCandidateRef.current = { sector: target, since: performance.now() };
      setActiveSector(target);
      playChord(visibleChords[target]);
      return;
    }

    const now = performance.now();
    if (gestureCandidateRef.current.sector !== target) {
      gestureCandidateRef.current = { sector: target, since: now };
      return;
    }
    // Hand tracking commonly loses the fingertip for one or two frames while
    // the player moves between sectors. Switching should feel responsive, but
    // silence should require a longer, deliberate move away from the wheel.
    const requiredStability = target === null
      ? GESTURE_RELEASE_GRACE_MS
      : GESTURE_SWITCH_STABILITY_MS;
    if (now - gestureCandidateRef.current.since < requiredStability) return;

    setActiveSector(target);
    if (target === null) releaseChord();
    else playChord(visibleChords[target]);
  }, [pointerAngle, pointerPosition, detected, isPointing, visibleChords, activeSector, directSector, songPlayback.playing, playChord, releaseChord]);

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col overflow-x-hidden bg-background text-foreground">
      {!started && <WelcomeOverlay onStart={handleStart} />}
      
      {/* Background Webcam Feed */}
      <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden bg-slate-950 opacity-20">
        <video 
          ref={videoRef}
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }} // Mirror effect
        />
        <div className="pointer-events-none absolute inset-0 bg-background/55" />
      </div>

      {detected && isPointing && pointerPosition && <div className="fixed z-30 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary pointer-events-none"
        style={{ left: pointerPosition.x, top: pointerPosition.y }} aria-hidden="true" />}

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-4">
          <img src="/harmony-logo.svg" alt="Harmony" className="hidden h-9 w-auto sm:block" />
          <div className="px-3 py-1.5 border border-primary bg-primary/10 text-primary font-mono text-xs uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            {songPlayback.playing && songPlayback.midiMode ? 'MIDI: PURE PIANO' : `CHORD: ${activeSector === null ? 'NONE' : visibleChords[activeSector]?.name}`}
          </div>
          
          <div className="px-3 py-1.5 border border-border bg-card/50 font-mono text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${detected ? 'bg-green-500' : 'bg-red-500'}`} />
            {handedness ?? 'NO'} HAND · FINGERS: {fingerCount} · OPEN: {openness.toFixed(0)}%
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest hidden sm:inline-block">Output:</span>
          <InstrumentSelector value={instrument} onChange={setInstrument} />
        </div>
      </header>

      {/* Main Center Area */}
      {!(songPlayback.playing && songPlayback.midiMode) && <main className="relative z-10 flex min-h-[420px] flex-1 items-center justify-center p-4 sm:p-6">
        <div className="flex min-h-0 w-full max-w-5xl flex-1 flex-col items-center justify-center gap-4 xl:flex-row xl:gap-6">
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <ChordWheel chords={visibleChords} activeIdx={activeSector} pointerAngle={isPointing ? pointerAngle : null} containerRef={wheelRef} onPointerSectorChange={selectSector} disabled={songPlayback.playing} />
          </div>
          <ChordNoteList chords={visibleChords} activeIdx={activeSector} />
        </div>
      </main>}

      {/* Bottom Panel */}
      <div className="relative z-10 mt-auto">
        {instrument === 'Grand Piano' && (
          <>
            <SongLibrary playback={songPlayback} ready={pianoReady} tempo={songTempo} onTempoChange={handleSongTempoChange} songKey={songKey} onSongKeyChange={handleSongKeyChange} drumPattern={drumPattern} onDrumPatternChange={handleDrumPatternChange} pianoSound={pianoSound} onPianoSoundChange={setPianoSound} onPlay={handlePlaySong} onStop={stopSong} />
            {!(songPlayback.playing && songPlayback.midiMode) && <PianoControls settings={pianoSettings} ready={pianoReady} performanceNotes={performanceNotes} onChange={setPianoSettings} />}
            <PianoKeyboard onNoteAttack={playNote} onNoteRelease={releaseNote} playedNotes={songPlayback.activeNotes} keyCount={songPlayback.keyboardSize} />
          </>
        )}
        <KeySelector 
          keySets={keySets}
          activeKeySet={activeKeySet}
          onSelectKeySet={setActiveKeySet}
          volume={volume}
          onVolumeChange={setVolume}
          filterType={filterType}
          onFilterChange={setFilterType}
        />
      </div>

    </div>
  );
}
