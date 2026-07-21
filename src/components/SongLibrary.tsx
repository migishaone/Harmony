import { useState } from 'react';
import { ChevronDown, ChevronUp, Disc3, Music, Play, Square, Waves } from 'lucide-react';
import { pianoSongs, type PianoSong } from '../data/songs';
import type { PianoSound, SongPlayback, ViolinStyle } from '../hooks/useChordPlayer';
import { drumPatterns } from '../data/drums';

interface Props {
  playback: SongPlayback;
  ready: boolean;
  tempo: number;
  onTempoChange: (tempo: number) => void;
  drumPattern: string;
  onDrumPatternChange: (pattern: string) => void;
  pianoSound: PianoSound;
  onPianoSoundChange: (sound: PianoSound) => void;
  violinEnabled: boolean;
  onViolinEnabledChange: (enabled: boolean) => void;
  violinStyle: ViolinStyle;
  onViolinStyleChange: (style: ViolinStyle) => void;
  onPlay: (song: PianoSong) => void;
  onStop: () => void;
}

const pianoSounds: PianoSound[] = ['Open Stage Grand', 'Concert Grand', 'Bright Grand', 'Warm Studio Piano'];

export function SongLibrary({ playback, ready, tempo, onTempoChange, drumPattern, onDrumPatternChange, pianoSound, onPianoSoundChange, violinEnabled, onViolinEnabledChange, violinStyle, onViolinStyleChange, onPlay, onStop }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const activeSong = pianoSongs.find(song => song.id === playback.songId);
  const selectedSong = pianoSongs.find(song => song.id === selectedSongId);

  return (
    <section className="border-t border-border bg-card px-4 py-4" aria-label="Professional piano songs">
      <button type="button" className={`${expanded ? 'mb-3' : ''} flex w-full flex-wrap items-center justify-between gap-2 text-left`} onClick={() => setExpanded(current => !current)} aria-expanded={expanded}>
        <div>
          <h2 className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-[0.2em] text-primary"><Disc3 className={`h-5 w-5 ${playback.playing ? 'animate-spin' : ''}`} />Piano Songs</h2>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Choose a song · piano performs automatically</p>
        </div>
        <span className="flex items-center gap-2 font-mono text-xs uppercase text-muted-foreground">
          {!ready ? 'Loading piano…' : expanded ? 'Close songs' : 'Open songs'}
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </span>
      </button>

      {expanded && <><div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
        {pianoSongs.map(song => {
          const active = playback.songId === song.id;
          const selected = selectedSongId === song.id;
          return (
            <button
              key={song.id}
              type="button"
              disabled={!ready}
              onClick={() => {
                setSelectedSongId(song.id);
                if (!(active && playback.playing)) onPlay(song);
              }}
              aria-expanded={selected}
              className={`flex min-h-9 items-center gap-2 border px-2.5 py-2 text-left transition-colors disabled:opacity-50 ${selected ? 'border-primary bg-primary/15' : active ? 'border-cyan-400/60 bg-cyan-400/5' : 'border-border bg-background hover:border-primary/60 hover:bg-muted'}`}
            >
              <Disc3 className={`h-3.5 w-3.5 shrink-0 ${active && playback.playing ? 'animate-spin text-cyan-300' : 'text-primary'}`} />
              <span className="truncate font-mono text-[11px] font-bold text-foreground">{song.title}</span>
            </button>
          );
        })}
      </div>

      {selectedSong && <div className="mt-3 border border-primary/40 bg-background p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-mono text-base font-bold text-foreground">{selectedSong.title}</h3>
            <p className="font-mono text-[10px] text-muted-foreground">{selectedSong.composer}</p>
          </div>
          <button type="button" disabled={!ready} onClick={() => playback.songId === selectedSong.id && playback.playing ? onStop() : onPlay(selectedSong)} className="flex h-9 items-center gap-2 border border-primary bg-primary px-4 font-mono text-xs font-bold uppercase text-primary-foreground transition-opacity disabled:opacity-50">
            {playback.songId === selectedSong.id && playback.playing ? <><Square className="h-3.5 w-3.5" />Stop</> : <><Play className="h-3.5 w-3.5" />Play</>}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-wider">
          <span className="text-primary">{selectedSong.key}</span>
          <span className="text-foreground">{selectedSong.beatsPerBar}/{selectedSong.beatUnit ?? 4}</span>
          <span className="text-cyan-300">Default {selectedSong.bpm} BPM</span>
        </div>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">{selectedSong.mood}</p>
      </div>}

      {activeSong && <div className="mt-3 flex flex-wrap items-center gap-3 border border-border bg-background px-3 py-2">
        <label htmlFor="piano-sound" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Piano sound</label>
        <select id="piano-sound" value={pianoSound} onChange={event => onPianoSoundChange(event.target.value as PianoSound)} className="border border-primary/50 bg-card px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-primary">
          {pianoSounds.map(sound => <option key={sound} value={sound}>{sound}</option>)}
        </select>
        <span className="hidden h-6 w-px bg-border sm:block" />
        <button type="button" aria-pressed={violinEnabled} onClick={() => onViolinEnabledChange(!violinEnabled)} className={`flex h-8 items-center gap-2 border px-3 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${violinEnabled ? 'border-fuchsia-400 bg-fuchsia-400/15 text-fuchsia-200' : 'border-border text-muted-foreground hover:border-fuchsia-400/60'}`}>
          <Waves className="h-3.5 w-3.5" />Violin {violinEnabled ? 'On' : 'Off'}
        </button>
        {violinEnabled && <><label htmlFor="violin-style" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Style</label>
        <select id="violin-style" value={violinStyle} onChange={event => onViolinStyleChange(event.target.value as ViolinStyle)} className="border border-fuchsia-400/50 bg-card px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-fuchsia-300">
          <option value="Pizzicato">Pizzicato · Plucked</option>
          <option value="Smooth Legato">Smooth · Legato</option>
        </select></>}
        <span className="hidden h-6 w-px bg-border sm:block" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Song tempo</span>
        <div className="flex items-center border border-cyan-400/40 bg-card" role="group" aria-label="Song tempo">
          <button type="button" onClick={() => onTempoChange(tempo - 1)} disabled={tempo <= 40} className="h-8 w-8 border-r border-border font-mono text-lg font-bold text-cyan-300 transition-colors hover:bg-cyan-400/10 disabled:opacity-30" aria-label="Decrease tempo">−</button>
          <output className="min-w-20 px-2 text-center font-mono text-sm font-bold text-cyan-300" aria-live="polite">{tempo} BPM</output>
          <button type="button" onClick={() => onTempoChange(tempo + 1)} disabled={tempo >= 220} className="h-8 w-8 border-l border-border font-mono text-lg font-bold text-cyan-300 transition-colors hover:bg-cyan-400/10 disabled:opacity-30" aria-label="Increase tempo">+</button>
        </div>
        <span className="hidden h-6 w-px bg-border sm:block" />
        <label htmlFor="drum-pattern" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Drums</label>
        <select id="drum-pattern" value={drumPattern} onChange={event => onDrumPatternChange(event.target.value)} className="border border-border bg-card px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-primary">
          <option value="none">Off</option>
          {drumPatterns.map(pattern => <option key={pattern.id} value={pattern.id}>{pattern.name}</option>)}
        </select>
      </div>}

      {activeSong && (
        <div className="relative mt-3 overflow-hidden border border-border bg-background p-3">
          <div className="absolute inset-y-0 left-0 bg-primary/10 transition-[width] duration-300" style={{ width: `${playback.progress}%` }} />
          <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><span className="block font-mono text-[9px] uppercase text-muted-foreground">Now playing</span><span className="font-mono text-sm font-bold text-foreground">{activeSong.title}</span></div>
            <div><span className="block font-mono text-[9px] uppercase text-muted-foreground">Key</span><span className="font-mono text-xl font-bold text-primary">{activeSong.key}</span></div>
            <div><span className="block font-mono text-[9px] uppercase text-muted-foreground">Mode</span><span className="font-mono text-sm font-bold text-cyan-300">{playback.midiMode ? `Pure piano · ${tempo} BPM` : playback.chord}</span></div>
            <div><span className="block font-mono text-[9px] uppercase text-muted-foreground">Measure</span><span className="font-mono text-xl font-bold text-foreground">{playback.measure}/{playback.totalMeasures}</span></div>
          </div>
          <div className="relative mt-3 grid gap-2 sm:grid-cols-3">
            <div className="min-h-16 border border-fuchsia-400/30 bg-fuchsia-400/5 p-3"><span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"><Music className="h-3.5 w-3.5 text-fuchsia-300" />Melody notes</span><span className="mt-1 block font-mono text-lg font-bold text-fuchsia-300">{playback.melodyNotes.join(' · ') || '—'}</span></div>
            <div className="min-h-16 border border-cyan-400/30 bg-cyan-400/5 p-3"><span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Accompaniment notes</span><span className="mt-1 block font-mono text-lg font-bold text-cyan-300">{playback.accompanimentNotes.join(' · ') || '—'}</span></div>
            <div className="min-h-16 border border-primary/30 bg-primary/5 p-3"><span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Chord notes</span><span className="mt-1 block font-mono text-lg font-bold text-primary">{playback.chordNotes.join(' · ') || '—'}</span></div>
          </div>
          <div className="relative mt-3 h-1 bg-border"><div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${playback.progress}%` }} /></div>
        </div>
      )}
      </>}
    </section>
  );
}
