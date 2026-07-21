export interface DrumPattern {
  id: string;
  name: string;
  midiUrl: string;
}

export const drumPatterns: DrumPattern[] = [
  { id: 'basic-rock', name: 'Basic Rock Beat', midiUrl: '/songs/drums/01-basic-rock-beat.mid' },
  { id: 'basic-edm', name: 'Basic EDM Beat', midiUrl: '/songs/drums/03-basic-edm-beat.mid' },
  { id: 'classic-hip-hop', name: 'Classic Hip-Hop Beat', midiUrl: '/songs/drums/04-classic-hip-hop-beat.mid' },
  { id: 'reggae', name: 'Reggae Beat', midiUrl: '/songs/drums/06-reggae-beat.mid' },
  { id: 'disco', name: 'Disco Beat', midiUrl: '/songs/drums/07-disco-beat.mid' },
  { id: 'downtempo', name: 'Downtempo Beat', midiUrl: '/songs/drums/15-downtempo.mid' },
  { id: 'full-kit-165', name: 'Full Kit 165', midiUrl: '/songs/drums/PSR_4-4_NmlStr_T059_FullKit_165.mid' },
  { id: 'full-kit-166', name: 'Full Kit 166', midiUrl: '/songs/drums/PSR_4-4_NmlStr_T422_FullKit_166.mid' },
];
