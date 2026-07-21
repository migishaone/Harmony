import type { ChordDef } from '../data/chords';

interface Props {
  chords: ChordDef[];
  activeIdx: number | null;
}

export function ChordNoteList({ chords, activeIdx }: Props) {
  return (
    <aside className="w-full border border-border bg-card/80 p-3 xl:w-72" aria-label="Chord notes">
      <div className="mb-3 border-b border-border pb-2">
        <h2 className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-primary">Chord Notes</h2>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Notes played by each ring chord</p>
      </div>

      <ol className="grid max-h-72 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 xl:max-h-[32rem] xl:grid-cols-1">
        {chords.map((chord, index) => {
          const active = activeIdx === index;
          return (
            <li
              key={`${chord.name}-${index}`}
              aria-current={active ? 'true' : undefined}
              className={`flex min-h-12 items-center gap-3 border px-3 py-2 transition-colors ${
                active
                  ? 'border-primary bg-primary/15 text-foreground'
                  : 'border-border bg-background/60 text-muted-foreground'
              }`}
            >
              <span className={`flex h-7 min-w-12 items-center justify-center border font-mono text-xs font-bold ${active ? 'border-primary text-primary' : 'border-border text-foreground'}`}>
                {chord.name}
              </span>
              <span className="min-w-0 font-mono text-xs tracking-wide">
                {chord.notes.join(' · ')}
              </span>
              {active && <span className="ml-auto h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" aria-label="Playing" />}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
