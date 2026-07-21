import { ChordDef } from "../data/chords";
import type { RefObject } from 'react';

interface Props {
  chords: ChordDef[];
  activeIdx: number | null;
  pointerAngle: number | null;
  containerRef: RefObject<HTMLDivElement | null>;
  onPointerSectorChange: (index: number | null) => void;
  songChord?: string | null;
}

export function ChordWheel({
  chords,
  activeIdx,
  pointerAngle,
  containerRef,
  onPointerSectorChange,
  songChord = null,
}: Props) {
  const numSectors = chords.length;
  
  // Angle per sector in radians
  const anglePerSector = (2 * Math.PI) / numSectors;
  
  // Rotate the whole wheel so that the first sector is centered at the top (-90 degrees / -PI/2)
  const wheelRotation = -Math.PI / 2;

  // We draw the SVG from -100 to 100 in both X and Y
  const cx = 0;
  const cy = 0;
  const radius = 90;
  const innerRadius = 25; // Don't let sectors reach the center, leave a hole
  const pointerRadius = 62;
  const pointerPosition =
    pointerAngle === null
      ? null
      : {
          x: pointerRadius * Math.cos(pointerAngle - wheelRotation),
          y: pointerRadius * Math.sin(pointerAngle - wheelRotation),
        };

  const createSectorPath = (index: number) => {
    const startAngle = index * anglePerSector - (anglePerSector / 2);
    const endAngle = startAngle + anglePerSector;

    // Outer arc points
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    // Inner arc points
    const x3 = cx + innerRadius * Math.cos(endAngle);
    const y3 = cy + innerRadius * Math.sin(endAngle);
    const x4 = cx + innerRadius * Math.cos(startAngle);
    const y4 = cy + innerRadius * Math.sin(startAngle);

    // SVG path string
    return `
      M ${x1} ${y1}
      A ${radius} ${radius} 0 0 1 ${x2} ${y2}
      L ${x3} ${y3}
      A ${innerRadius} ${innerRadius} 0 0 0 ${x4} ${y4}
      Z
    `;
  };

  const createLabelPos = (index: number) => {
    const angle = index * anglePerSector;
    // Position label near the outer edge
    const r = radius - 15;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle)
    };
  };

  const sectorFromPointer = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const x = clientX - (rect.left + rect.width / 2);
    const y = clientY - (rect.top + rect.height / 2);
    const radius = Math.hypot(x, y);
    const outerRadius = Math.min(rect.width, rect.height) * 0.475;
    const innerRadius = Math.min(rect.width, rect.height) * 0.125;
    if (radius < innerRadius || radius > outerRadius) return null;

    const angle = Math.atan2(y, x);
    const normalized = (angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    return Math.floor(
      ((normalized + anglePerSector / 2) % (Math.PI * 2)) / anglePerSector,
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-square h-auto w-[min(100%,min(58vh,38rem))] shrink-0 touch-none"
      onPointerMove={(event) =>
        onPointerSectorChange(sectorFromPointer(event.clientX, event.clientY))
      }
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onPointerSectorChange(sectorFromPointer(event.clientX, event.clientY));
      }}
      onPointerLeave={() => onPointerSectorChange(null)}
      onPointerUp={(event) => {
        if (event.pointerType !== 'mouse') onPointerSectorChange(null);
      }}
      role="group"
      aria-label="Playable chord wheel"
    >
      <svg 
        viewBox="-100 -100 200 200" 
        className="w-full h-full transform"
        style={{ transform: `rotate(${wheelRotation}rad)` }}
      >
        {/* Outer decorative ring */}
        <circle cx="0" cy="0" r="95" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="2 4" />
        
        {chords.map((chord, i) => {
          const isActive = activeIdx === i;
          const pos = createLabelPos(i);
          
          return (
            <g key={i} className="transition-all duration-150">
              <path
                d={createSectorPath(i)}
                fill={isActive ? "hsl(var(--primary) / 0.3)" : "hsl(var(--card) / 0.5)"}
                stroke={isActive ? "hsl(var(--primary))" : "hsl(var(--border))"}
                strokeWidth={isActive ? "1.5" : "0.5"}
                className="transition-all duration-100 ease-out"
                aria-label={`Play ${chord.name}: ${chord.notes.join(', ')}`}
              />
              
              {/* Rotate text back so it reads horizontally, despite the group rotation */}
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                alignmentBaseline="middle"
                fill={isActive ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))"}
                className={`font-mono transition-colors duration-150 ${isActive ? 'font-bold text-[12px]' : 'text-[10px]'}`}
                style={{ transform: `rotate(${-wheelRotation}rad)`, transformOrigin: `${pos.x}px ${pos.y}px` }}
              >
                {chord.name}
              </text>
            </g>
          );
        })}

        {/* Center Knob */}
        <circle cx="0" cy="0" r="18" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1" />
        <circle cx="0" cy="0" r="8" fill="hsl(var(--primary))" opacity={activeIdx !== null ? 1 : 0.2} className="transition-opacity" />
        {songChord && <text
          x="0"
          y="1"
          textAnchor="middle"
          alignmentBaseline="middle"
          fill="hsl(var(--foreground))"
          className="font-mono text-[6px] font-bold"
          style={{ transform: `rotate(${-wheelRotation}rad)`, transformOrigin: '0px 0px' }}
        >{songChord}</text>}

        {/* Live hand direction marker, using the same geometry as selection. */}
        {pointerPosition && (
          <g className="pointer-events-none">
            <line
              x1="0"
              y1="0"
              x2={pointerPosition.x}
              y2={pointerPosition.y}
              stroke="hsl(var(--primary))"
              strokeWidth="1"
              strokeDasharray="2 2"
              opacity="0.7"
            />
            <circle
              cx={pointerPosition.x}
              cy={pointerPosition.y}
              r="3.5"
              fill="hsl(var(--primary))"
              stroke="hsl(var(--foreground))"
              strokeWidth="1"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
