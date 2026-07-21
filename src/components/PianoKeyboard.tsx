import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Piano } from 'lucide-react';

interface Props {
  onNoteAttack: (note: string) => void;
  onNoteRelease: (note: string) => void;
  playedNotes?: string[];
  keyCount?: 61 | 88;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const WHITE_WIDTH = 34;
const BLACK_WIDTH = 22;

function noteFromMidi(midi: number) {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function PianoKeyboard({ onNoteAttack, onNoteRelease, playedNotes = [], keyCount = 61 }: Props) {
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (playedNotes.length > 0) setExpanded(true);
  }, [playedNotes.length]);
  const keys = useMemo(() => Array.from({ length: keyCount }, (_, index) => {
    const midi = (keyCount === 88 ? 21 : 36) + index;
    const name = noteFromMidi(midi);
    return { midi, name, black: name.includes('#') };
  }), [keyCount]);
  const whiteKeys = keys.filter(key => !key.black);
  let whitesSeen = 0;
  const positionedKeys = keys.map(key => {
    if (!key.black) {
      const left = whitesSeen * WHITE_WIDTH;
      whitesSeen += 1;
      return { ...key, left };
    }
    return { ...key, left: whitesSeen * WHITE_WIDTH - BLACK_WIDTH / 2 };
  });

  const attack = (note: string) => {
    setActiveNotes(current => new Set(current).add(note));
    onNoteAttack(note);
  };
  const release = (note: string) => {
    setActiveNotes(current => {
      const next = new Set(current);
      next.delete(note);
      return next;
    });
    onNoteRelease(note);
  };

  const toggleExpanded = () => {
    if (expanded) activeNotes.forEach(onNoteRelease);
    setActiveNotes(new Set());
    setExpanded(current => !current);
  };

  return (
    <section className="border-t border-primary/30 bg-background/95 px-4 py-3" aria-label={`${keyCount}-key piano keyboard`}>
      <button type="button" className="flex w-full items-center justify-between font-mono text-xs uppercase tracking-widest text-primary" onClick={toggleExpanded} aria-expanded={expanded}>
        <span className="flex items-center gap-2"><Piano className="h-4 w-4" />{keyCount}-key piano · {keyCount === 88 ? 'A0—C8' : 'C2—C7'}</span>
        <span className="flex items-center gap-2 text-muted-foreground">{expanded ? 'Close keys' : 'Open keys'}{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}</span>
      </button>
      {expanded && <div className="mt-2 overflow-x-auto pb-2 touch-pan-x">
        <div className="relative mx-auto h-36" style={{ width: whiteKeys.length * WHITE_WIDTH }}>
          {positionedKeys.filter(key => !key.black).map(key => (
            <button
              key={key.midi}
              type="button"
              aria-label={`Play ${key.name}`}
              className={`absolute bottom-0 h-36 border border-slate-400 text-slate-800 transition-colors duration-75 ${activeNotes.has(key.name) || playedNotes.includes(key.name) ? 'bg-teal-300' : 'bg-stone-100 hover:bg-teal-50'}`}
              style={{ left: key.left, width: WHITE_WIDTH }}
              onPointerDown={(event) => { event.preventDefault(); attack(key.name); }}
              onPointerEnter={(event) => { if (event.buttons > 0 && !activeNotes.has(key.name)) attack(key.name); }}
              onPointerUp={() => release(key.name)}
              onPointerLeave={() => { if (activeNotes.has(key.name)) release(key.name); }}
              onPointerCancel={() => release(key.name)}
            >
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[9px]">{key.name}</span>
            </button>
          ))}
          {positionedKeys.filter(key => key.black).map(key => (
            <button
              key={key.midi}
              type="button"
              aria-label={`Play ${key.name}`}
              className={`absolute top-0 z-10 h-24 border border-black text-white transition-colors duration-75 ${activeNotes.has(key.name) || playedNotes.includes(key.name) ? 'bg-teal-600' : 'bg-slate-950 hover:bg-slate-800'}`}
              style={{ left: key.left, width: BLACK_WIDTH }}
              onPointerDown={(event) => { event.preventDefault(); attack(key.name); }}
              onPointerEnter={(event) => { if (event.buttons > 0 && !activeNotes.has(key.name)) attack(key.name); }}
              onPointerUp={() => release(key.name)}
              onPointerLeave={() => { if (activeNotes.has(key.name)) release(key.name); }}
              onPointerCancel={() => release(key.name)}
            >
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 -rotate-90 font-mono text-[8px]">{key.name}</span>
            </button>
          ))}
        </div>
      </div>}
    </section>
  );
}
