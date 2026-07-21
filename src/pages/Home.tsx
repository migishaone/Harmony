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
import { pianoSongs } from '../data/songs';

export function Home() {
  const [started, setStarted] = useState(false);
  const [activeKeySet, setActiveKeySet] = useState(keySets[0]); // Default C Major
  const [filterType, setFilterType] = useState<ChordType | "All">("All");
  
  const { instrument, setInstrument, volume, setVolume, playChord, sustainChord, releaseChord, pianoSettings, setPianoSettings, pianoReady, performanceNotes, playNote, releaseNote, songPlayback, playSong, stopSong, songTempo, setSongTempo, drumPattern, setDrumPattern, pianoSound, setPianoSound, violinEnabled, setViolinEnabled, violinStyle, setViolinStyle } = useChordPlayer();
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
    playSong(song);
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

  const restartActiveSong = (change: () => void) => {
    change();
    if (!songPlayback.playing || !songPlayback.songId) return;
    const activeSong = pianoSongs.find(song => song.id === songPlayback.songId);
    if (activeSong) setTimeout(() => playSong(activeSong), 0);
  };

  useEffect(() => () => {
    if (tempoRestartRef.current) clearTimeout(tempoRestartRef.current);
  }, []);

  useEffect(() => {
    if (directSector !== null) return;
    if (!detected || !isPointing || pointerAngle === null || !wheelRef.current || visibleChords.length === 0) {
      if (activeSector !== null) { setActiveSector(null); releaseChord(); }
      return;
    }
    const rect = wheelRef.current.getBoundingClientRect();
    const distance = Math.hypot(pointerPosition!.x - (rect.left + rect.width / 2), pointerPosition!.y - (rect.top + rect.height / 2));
    const size = Math.min(rect.width, rect.height);
    if (distance < size * 0.125 || distance > size * 0.475) {
      if (activeSector !== null) { setActiveSector(null); releaseChord(); }
      return;
    }
    const anglePerSector = (2 * Math.PI) / visibleChords.length;
    const normalized = (pointerAngle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    const target = Math.floor(((normalized + anglePerSector / 2) % (Math.PI * 2)) / anglePerSector);
    if (target !== activeSector) { setActiveSector(target); playChord(visibleChords[target]); }
    else sustainChord();
  }, [pointerAngle, pointerPosition, detected, isPointing, visibleChords, activeSector, directSector, playChord, releaseChord, sustainChord]);

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
        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
          <ChordWheel chords={visibleChords} activeIdx={activeSector} pointerAngle={isPointing ? pointerAngle : null} containerRef={wheelRef} onPointerSectorChange={selectSector} />
        </div>
      </main>}

      {/* Bottom Panel */}
      <div className="relative z-10 mt-auto">
        {instrument === 'Grand Piano' && (
          <>
            <SongLibrary playback={songPlayback} ready={pianoReady} tempo={songTempo} onTempoChange={handleSongTempoChange} drumPattern={drumPattern} onDrumPatternChange={handleDrumPatternChange} pianoSound={pianoSound} onPianoSoundChange={setPianoSound} violinEnabled={violinEnabled} onViolinEnabledChange={enabled => restartActiveSong(() => setViolinEnabled(enabled))} violinStyle={violinStyle} onViolinStyleChange={style => restartActiveSong(() => setViolinStyle(style))} onPlay={handlePlaySong} onStop={stopSong} />
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
