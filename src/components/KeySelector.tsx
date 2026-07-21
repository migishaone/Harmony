import { KeySet } from "../data/chords";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Volume2, VolumeX } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChordType } from "../data/chords";

interface Props {
  keySets: KeySet[];
  activeKeySet: KeySet;
  onSelectKeySet: (keySet: KeySet) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  filterType: ChordType | "All";
  onFilterChange: (type: ChordType | "All") => void;
}

export function KeySelector({ keySets, activeKeySet, onSelectKeySet, volume, onVolumeChange, filterType, onFilterChange }: Props) {
  
  const handleVolumeChange = (vals: number[]) => {
    onVolumeChange(vals[0]);
  };

  return (
    <div className="w-full flex flex-col gap-4 p-4 border-t border-border bg-background">
      
      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        
        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Filter</span>
          <Select value={filterType} onValueChange={(val) => onFilterChange(val as any)}>
            <SelectTrigger className="w-[120px] h-8 bg-card border-card-border font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Types</SelectItem>
              <SelectItem value="Major">Major</SelectItem>
              <SelectItem value="Minor">Minor</SelectItem>
              <SelectItem value="7th">7th</SelectItem>
              <SelectItem value="Maj7">Maj7</SelectItem>
              <SelectItem value="Dim">Diminished</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3 w-48">
          {volume <= -40 ? <VolumeX className="w-4 h-4 text-muted-foreground" /> : <Volume2 className="w-4 h-4 text-muted-foreground" />}
          <Slider 
            value={[volume]} 
            min={-40} 
            max={5} 
            step={1} 
            onValueChange={handleVolumeChange}
            className="flex-1"
          />
        </div>
      </div>

      {/* Keys Row */}
      <ScrollArea className="w-full whitespace-nowrap pb-2">
        <div className="flex w-max space-x-2">
          {keySets.map((ks) => (
            <Button
              key={ks.name}
              variant={activeKeySet.name === ks.name ? "default" : "outline"}
              className={`h-9 px-4 font-mono text-xs rounded-none border ${
                activeKeySet.name === ks.name 
                  ? 'border-primary bg-primary/20 text-primary hover:bg-primary/30' 
                  : 'border-border bg-card hover:bg-accent/10 hover:text-accent'
              }`}
              onClick={() => onSelectKeySet(ks)}
            >
              {ks.name}
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="h-1.5" />
      </ScrollArea>
    </div>
  );
}
