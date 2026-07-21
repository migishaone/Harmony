export const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export type ChordType = "Major" | "Minor" | "7th" | "Dim";

export interface ChordDef {
  name: string;
  notes: string[];
  type: ChordType;
}

export interface KeySet {
  name: string;
  chords: ChordDef[];
}

const getNoteInterval = (rootIndex: number, semitones: number) => {
  return NOTES[(rootIndex + semitones) % 12];
};

const getOctaveNote = (rootIndex: number, semitones: number, baseOctave = 3) => {
  const totalIndex = rootIndex + semitones;
  const octaveOffset = Math.floor(totalIndex / 12);
  const note = NOTES[totalIndex % 12];
  return `${note}${baseOctave + octaveOffset}`;
};

export const buildChord = (root: string, type: ChordType, octave = 3): ChordDef => {
  const rootIdx = NOTES.indexOf(root);
  let intervals: number[] = [];
  
  switch (type) {
    case "Major": intervals = [0, 4, 7]; break;
    case "Minor": intervals = [0, 3, 7]; break;
    case "7th": intervals = [0, 4, 7, 10]; break;
    case "Dim": intervals = [0, 3, 6]; break;
  }

  const suffixMap: Record<ChordType, string> = {
    Major: "", Minor: "m", "7th": "7", Dim: "dim"
  };

  const suffix = suffixMap[type];
  const name = `${root}${suffix}`;
  
  return {
    name,
    type,
    notes: intervals.map(i => getOctaveNote(rootIdx, i, octave))
  };
};

// Standard diatonic chords for Major keys: I, ii, iii, IV, V, vi, vii°, V7
const buildMajorKeySet = (root: string): KeySet => {
  const rootIdx = NOTES.indexOf(root);
  return {
    name: `${root} Major`,
    chords: [
      buildChord(getNoteInterval(rootIdx, 0), "Major"), // I
      buildChord(getNoteInterval(rootIdx, 2), "Minor"), // ii
      buildChord(getNoteInterval(rootIdx, 4), "Minor"), // iii
      buildChord(getNoteInterval(rootIdx, 5), "Major"), // IV
      buildChord(getNoteInterval(rootIdx, 7), "Major"), // V
      buildChord(getNoteInterval(rootIdx, 9), "Minor"), // vi
      buildChord(getNoteInterval(rootIdx, 11), "Dim"),  // vii°
      buildChord(getNoteInterval(rootIdx, 7), "7th")    // V7
    ]
  };
};

// Standard diatonic chords for Minor keys: i, ii°, III, iv, v, VI, VII, V7
const buildMinorKeySet = (root: string): KeySet => {
  const rootIdx = NOTES.indexOf(root);
  return {
    name: `${root} Minor`,
    chords: [
      buildChord(getNoteInterval(rootIdx, 0), "Minor"), // i
      buildChord(getNoteInterval(rootIdx, 2), "Dim"),   // ii°
      buildChord(getNoteInterval(rootIdx, 3), "Major"), // III
      buildChord(getNoteInterval(rootIdx, 5), "Minor"), // iv
      buildChord(getNoteInterval(rootIdx, 7), "Minor"), // v
      buildChord(getNoteInterval(rootIdx, 8), "Major"), // VI
      buildChord(getNoteInterval(rootIdx, 10), "Major"),// VII
      buildChord(getNoteInterval(rootIdx, 7), "7th")    // V7 (harmonic minor dominant)
    ]
  };
};

export const keySets: KeySet[] = [];

// Add Major Keys
NOTES.forEach(note => {
  keySets.push(buildMajorKeySet(note));
});

// Add Minor Keys
NOTES.forEach(note => {
  keySets.push(buildMinorKeySet(note));
});

// Add Chromatic Modes
const circleOfFifths = ["C", "G", "D", "A", "E", "B", "F#", "C#", "G#", "D#", "A#", "F"];
const chromaticMajor: KeySet = {
  name: "Chromatic (Major)",
  chords: circleOfFifths.map(note => buildChord(note, "Major"))
};

const chromaticMinor: KeySet = {
  name: "Chromatic (Minor)",
  chords: circleOfFifths.map(note => buildChord(note, "Minor"))
};

keySets.push(chromaticMajor, chromaticMinor);
