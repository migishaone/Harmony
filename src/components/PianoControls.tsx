import { Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AccompanimentPattern, ArpeggioPattern, ArpeggioRate, PerformanceNotes, PianoSettings, PianoVoicing } from '../hooks/useChordPlayer';

interface Props {
  settings: PianoSettings;
  ready: boolean;
  performanceNotes: PerformanceNotes;
  onChange: (patch: Partial<PianoSettings>) => void;
}

export function PianoControls({ settings, ready, performanceNotes, onChange }: Props) {
  return (
    <section className="w-full border-t border-border bg-card px-4 py-3" aria-label="Professional piano settings">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 font-mono text-xs">
        <div className="flex items-center gap-2 text-primary uppercase tracking-widest">
          <Music2 className="h-4 w-4" /> Piano
          <span className={ready ? 'text-green-400' : 'text-amber-400'}>{ready ? 'Ready' : 'Loading samples…'}</span>
        </div>

        <Button type="button" variant="outline" className={`h-8 rounded-none ${settings.arpeggio ? 'border-primary text-primary' : ''}`} onClick={() => onChange({ arpeggio: !settings.arpeggio })}>
          Arpeggio {settings.arpeggio ? 'On' : 'Off'}
        </Button>

        <Button type="button" variant="outline" className={`h-8 rounded-none ${settings.accompaniment ? 'border-primary text-primary' : ''}`} onClick={() => onChange({ accompaniment: !settings.accompaniment })}>
          Left Hand {settings.accompaniment ? 'On' : 'Off'}
        </Button>

        <label className="flex items-center gap-2">Bass
          <Select value={settings.accompanimentPattern} onValueChange={(value) => onChange({ accompanimentPattern: value as AccompanimentPattern })}>
            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{['Root & Fifth', 'Octaves', 'Alberti', 'Waltz'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
          </Select>
        </label>

        <label className="flex items-center gap-2">Voicing
          <Select value={settings.voicing} onValueChange={(value) => onChange({ voicing: value as PianoVoicing })}>
            <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{['Compact', 'Open', 'Concert', 'Wide', 'Cinematic'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
          </Select>
        </label>

        <label className="flex items-center gap-2">Pattern
          <Select value={settings.pattern} onValueChange={(value) => onChange({ pattern: value as ArpeggioPattern })}>
            <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{['Up', 'Down', 'Up & Down', 'Random'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
          </Select>
        </label>

        <label className="flex items-center gap-2">Rate
          <Select value={settings.rate} onValueChange={(value) => onChange({ rate: value as ArpeggioRate })}>
            <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="4n">1/4</SelectItem><SelectItem value="8n">1/8</SelectItem><SelectItem value="8t">1/8T</SelectItem><SelectItem value="16n">1/16</SelectItem></SelectContent>
          </Select>
        </label>

        <label className="flex items-center gap-2">Meter
          <Select value={String(settings.beatsPerBar)} onValueChange={(value) => onChange({ beatsPerBar: Number(value) as PianoSettings['beatsPerBar'] })}>
            <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
            <SelectContent>{[2, 3, 4, 6].map(value => <SelectItem key={value} value={String(value)}>{value}/4</SelectItem>)}</SelectContent>
          </Select>
        </label>

        <label className="flex items-center gap-2">Tempo
          <Slider className="w-24" min={40} max={200} step={1} value={[settings.bpm]} onValueChange={([bpm]) => onChange({ bpm })} />
          <span className="w-14 text-primary">{settings.bpm} BPM</span>
        </label>

        <Button type="button" variant="outline" className={`h-8 rounded-none ${settings.pedal ? 'border-primary text-primary' : ''}`} onClick={() => onChange({ pedal: !settings.pedal })}>
          Pedal {settings.pedal ? 'Down' : 'Up'}
        </Button>

        <label className="flex items-center gap-2">Room
          <Slider className="w-20" min={0} max={60} step={1} value={[settings.ambience]} onValueChange={([ambience]) => onChange({ ambience })} />
        </label>
        <label className="flex items-center gap-2">Tone
          <Slider className="w-20" min={0} max={100} step={1} value={[settings.brightness]} onValueChange={([brightness]) => onChange({ brightness })} />
        </label>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-3">
        <div className="min-w-0 bg-background/80 px-3 py-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Left hand</span>
          <div className="truncate font-mono text-sm text-primary">{performanceNotes.bass}</div>
        </div>
        <div className="min-w-0 bg-background/80 px-3 py-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Complete chord</span>
          <div className="truncate font-mono text-sm text-foreground">{performanceNotes.chord}</div>
        </div>
        <div className="min-w-0 bg-background/80 px-3 py-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Right-hand arpeggio</span>
          <div className="truncate font-mono text-sm text-primary">{performanceNotes.arpeggio}</div>
        </div>
      </div>
    </section>
  );
}
