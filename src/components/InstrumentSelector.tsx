import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { instruments, InstrumentName } from "../data/instruments";
import { Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  value: InstrumentName;
  onChange: (val: InstrumentName) => void;
}

export function InstrumentSelector({ value, onChange }: Props) {
  const [search, setSearch] = useState("");
  
  const instrumentNames = Object.keys(instruments) as InstrumentName[];
  const filtered = instrumentNames.filter(name => name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Select value={value} onValueChange={(val) => onChange(val as InstrumentName)}>
      <SelectTrigger className="w-[200px] bg-card border-card-border text-foreground h-10 font-mono text-sm">
        <SelectValue placeholder="Select instrument" />
      </SelectTrigger>
      <SelectContent className="bg-popover border-popover-border shadow-xl">
        <div className="flex items-center px-3 py-2 border-b border-border sticky top-0 bg-popover z-10">
          <Search className="w-4 h-4 mr-2 text-muted-foreground" />
          <Input 
            placeholder="Search..." 
            className="border-0 h-7 focus-visible:ring-0 p-0 text-sm font-mono bg-transparent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <ScrollArea className="h-[300px]">
          {filtered.map(name => (
            <SelectItem key={name} value={name} className="font-mono text-sm cursor-pointer hover:bg-muted focus:bg-muted">
              {name}
            </SelectItem>
          ))}
          {filtered.length === 0 && (
            <div className="px-2 py-4 text-sm text-center text-muted-foreground font-mono">
              No instruments found.
            </div>
          )}
        </ScrollArea>
      </SelectContent>
    </Select>
  );
}
