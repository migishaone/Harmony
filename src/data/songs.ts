export interface SongMeasure {
  chord: string;
  chordNotes: string[];
  melody: Array<string | null>;
  score?: SongNoteEvent[];
}

export interface SongNoteEvent {
  note: string;
  beat: number;
  duration: number;
  hand: 'left' | 'right';
  velocity?: number;
}

export interface PianoSong {
  id: string;
  title: string;
  composer: string;
  key: string;
  bpm: number;
  beatsPerBar: 2 | 3 | 4 | 6;
  beatUnit?: 4 | 8;
  mood: string;
  measures: SongMeasure[];
  midiUrl?: string;
  includeAllPitchedTracks?: boolean;
  excludedMidiChannels?: number[];
  allowDrums?: boolean;
}

export const pianoSongs: PianoSong[] = [
  {
    id: 'heal-the-world', title: 'Heal the World', composer: 'Michael Jackson', key: 'A Major', bpm: 79, beatsPerBar: 4, beatUnit: 4, mood: 'Original MIDI · Melody and harmony · Piano rendering', midiUrl: '/songs/heal-the-world.mid', includeAllPitchedTracks: true, excludedMidiChannels: [1, 5, 6, 7, 8, 9], allowDrums: false, measures: [],
  },
  {
    id: 'rwanda-nziza', title: 'Rwanda Nziza', composer: 'Rwandan National Anthem', key: 'G Major', bpm: 92, beatsPerBar: 2, beatUnit: 4, mood: 'Original MIDI · Rwanda national anthem · Piano arrangement', midiUrl: '/songs/rwanda.mid', allowDrums: false, measures: [],
  },
  {
    id: 'burundi-anthem', title: 'Burundi Bwacu', composer: 'Burundian National Anthem', key: 'D# Major', bpm: 74, beatsPerBar: 4, beatUnit: 4, mood: 'Original MIDI · Burundi national anthem · Piano rendering', midiUrl: '/songs/burundi.mid', includeAllPitchedTracks: true, excludedMidiChannels: [4, 5, 6, 8], allowDrums: false, measures: [],
  },
  {
    id: 'india-anthem', title: 'Jana Gana Mana', composer: 'Rabindranath Tagore', key: 'G# Major', bpm: 90, beatsPerBar: 4, beatUnit: 4, mood: 'Original MIDI · Indian national anthem · Piano arrangement', midiUrl: '/songs/india-anthem.mid', excludedMidiChannels: [13], allowDrums: false, measures: [],
  },
  {
    id: 'south-africa-anthem', title: 'National Anthem of South Africa', composer: 'South African National Anthem', key: 'D Major', bpm: 78, beatsPerBar: 4, beatUnit: 4, mood: 'Original MIDI · South African national anthem · Piano rendering', midiUrl: '/songs/south-africa-anthem.mid', includeAllPitchedTracks: true, excludedMidiChannels: [4, 5, 6, 7, 8], allowDrums: false, measures: [],
  },
  {
    id: 'everytime', title: 'Everytime', composer: 'Britney Spears', key: 'D# Major', bpm: 108, beatsPerBar: 4, beatUnit: 4, mood: 'Original MIDI · Melody and accompaniment · Piano rendering', midiUrl: '/songs/everytime.mid', includeAllPitchedTracks: true, excludedMidiChannels: [7, 9, 11], measures: [],
  },
  {
    id: 'he-leadeth-me', title: 'He Leadeth Me', composer: 'William B. Bradbury', key: 'C Major', bpm: 108, beatsPerBar: 4, beatUnit: 4, mood: 'Original MIDI · Four-part hymn · Piano', midiUrl: '/songs/he-leadeth-me.mid', measures: [],
  },
  {
    id: 'all-of-me', title: 'All of Me', composer: 'John Legend', key: 'G# Major', bpm: 120, beatsPerBar: 4, beatUnit: 4, mood: 'Original MIDI · 4/4 · Piano', midiUrl: '/songs/all-of-me.mid', measures: [],
  },
  {
    id: 'dont-stop-believin', title: "Don't Stop Believin'", composer: 'Journey', key: 'B Major', bpm: 118, beatsPerBar: 4, beatUnit: 4, mood: 'Original MIDI · Melody and accompaniment · Piano rendering', midiUrl: '/songs/dont-stop-believin.mid', includeAllPitchedTracks: true, measures: [],
  },
  {
    id: 'see-you-again', title: 'See You Again', composer: 'Wiz Khalifa feat. Charlie Puth', key: 'A# Major', bpm: 79, beatsPerBar: 4, beatUnit: 4, mood: 'Original MIDI · 4/4 · Piano', midiUrl: '/songs/see-you-again.mid', measures: [],
  },
  {
    id: 'heart-and-soul', title: 'Heart and Soul', composer: 'Hoagy Carmichael', key: 'F Major', bpm: 150, beatsPerBar: 4, beatUnit: 4, mood: 'Original MIDI · 4/4 · Piano duet', midiUrl: '/songs/heart-and-soul.mid', measures: [],
  },
  {
    id: 'alla-turca', title: 'Rondo Alla Turca', composer: 'W. A. Mozart', key: 'A Minor', bpm: 132, beatsPerBar: 2, beatUnit: 4, mood: 'Original MIDI · 2/4 · Piano', midiUrl: '/songs/alla-turca.mid', measures: [],
  },
  {
    id: 'canon-in-d', title: 'Canon in D', composer: 'Johann Pachelbel', key: 'D Major', bpm: 72, beatsPerBar: 4, beatUnit: 4, mood: 'Original MIDI · 4/4 · Piano arrangement', midiUrl: '/songs/canon-3.mid', measures: [],
  },
  {
    id: 'us-anthem', title: 'The Star-Spangled Banner', composer: 'John Stafford Smith', key: 'C Major', bpm: 100, beatsPerBar: 3, beatUnit: 4, mood: 'Original MIDI · Melody and accompaniment · No drums', midiUrl: '/songs/us-anthem.mid', includeAllPitchedTracks: true, excludedMidiChannels: [9, 15], allowDrums: false, measures: [],
  },
  {
    id: 'a-thousand-miles', title: 'A Thousand Miles', composer: 'Vanessa Carlton', key: 'C Major', bpm: 95, beatsPerBar: 4, beatUnit: 4, mood: 'Original MIDI · 4/4 · Piano', midiUrl: '/songs/vanessa_carlton_-_a_thousand_miles.mid', measures: [],
  },
  {
    id: 'fur-elise', title: 'Für Elise', composer: 'L. van Beethoven', key: 'A Minor', bpm: 75, beatsPerBar: 3, beatUnit: 8, mood: 'Original MIDI · 3/8 · Poco moto', midiUrl: '/songs/Fur%20Elise.mid',
    measures: [],
  },
  {
    id: 'pirates-caribbean', title: 'Pirates of the Caribbean', composer: 'Piano arrangement', key: 'D Minor', bpm: 100, beatsPerBar: 6, beatUnit: 8, mood: 'Original MIDI · 6/8 · Piano only', midiUrl: '/songs/Pirates%20of%20the%20Caribbean.mid',
    measures: [],
  },
  {
    id: 'still-dre', title: 'Still D.R.E.', composer: 'Piano arrangement', key: 'B Minor', bpm: 93, beatsPerBar: 4, beatUnit: 4, mood: 'Original MIDI · 4/4 · Piano only', midiUrl: '/songs/FULL%20PIANO%20STILL%20DRE.mid', measures: [],
  },
  {
    id: 'river-flows-in-you', title: 'River Flows in You', composer: 'Yiruma', key: 'F# Minor', bpm: 65, beatsPerBar: 4, beatUnit: 4, mood: 'Original MIDI · Expressive tempo · Piano only', midiUrl: '/songs/Yiruma%20-%20Rivers%20Flow%20In%20You.mid', measures: [],
  },
  {
    id: 'jingle-bells', title: 'Jingle Bells', composer: 'Piano arrangement', key: 'G Major', bpm: 105, beatsPerBar: 2, beatUnit: 4, mood: 'Original MIDI · 2/4 · Piano only', midiUrl: '/songs/jingle-bells-keyboard.mid', measures: [],
  },
  {
    id: 'amazing-grace', title: 'Amazing Grace', composer: 'Traditional', key: 'G Major', bpm: 85, beatsPerBar: 3, beatUnit: 4, mood: 'Original MIDI · 3/4 · Piano only', midiUrl: '/songs/amazing-grace-piano.mid', measures: [],
  },
];
