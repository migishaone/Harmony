import { useEffect, useRef, useState } from 'react';

export interface MidiKeyboardState {
  supported: boolean;
  connected: boolean;
  devices: string[];
  error: string | null;
  activeNotes: string[];
}

const INITIAL_STATE: MidiKeyboardState = {
  supported: typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator,
  connected: false,
  devices: [],
  error: null,
  activeNotes: [],
};

export function useMidiKeyboard(
  onNoteAttack: (note: string) => void,
  onNoteRelease: (note: string) => void,
  ringMode = false,
  onChordAttack?: (midi: number) => void,
  onChordRelease?: (midi: number) => void,
) {
  const [state, setState] = useState(INITIAL_STATE);
  const attackRef = useRef(onNoteAttack);
  const releaseRef = useRef(onNoteRelease);
  const ringModeRef = useRef(ringMode);
  const chordAttackRef = useRef(onChordAttack);
  const chordReleaseRef = useRef(onChordRelease);

  useEffect(() => { attackRef.current = onNoteAttack; }, [onNoteAttack]);
  useEffect(() => { releaseRef.current = onNoteRelease; }, [onNoteRelease]);
  useEffect(() => { ringModeRef.current = ringMode; }, [ringMode]);
  useEffect(() => { chordAttackRef.current = onChordAttack; }, [onChordAttack]);
  useEffect(() => { chordReleaseRef.current = onChordRelease; }, [onChordRelease]);

  useEffect(() => {
    if (!('requestMIDIAccess' in navigator)) return;
    let cancelled = false;
    let access: MIDIAccess | null = null;
    const heldNotes = new Set<number>();
    const sustainedNotes = new Set<number>();
    const noteRoutes = new Map<number, 'keys' | 'ring'>();
    let sustain = false;
    const noteName = (midi: number) => {
      const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
    };
    const publishActiveNotes = () => {
      const active = new Set([
        ...[...heldNotes].filter(midi => noteRoutes.get(midi) === 'keys'),
        ...sustainedNotes,
      ]);
      setState(current => ({ ...current, activeNotes: [...active].map(noteName) }));
    };
    const releaseMidiNote = (midi: number) => {
      heldNotes.delete(midi);
      const route = noteRoutes.get(midi) ?? 'keys';
      if (route === 'ring') chordReleaseRef.current?.(midi);
      else if (sustain) sustainedNotes.add(midi);
      else releaseRef.current(noteName(midi));
      noteRoutes.delete(midi);
      publishActiveNotes();
    };
    const handleMessage = (event: MIDIMessageEvent) => {
      const [status = 0, data1 = 0, data2 = 0] = Array.from(event.data ?? []);
      const command = status & 0xf0;
      if (command === 0x90 && data2 > 0) {
        heldNotes.add(data1);
        sustainedNotes.delete(data1);
        const route = ringModeRef.current ? 'ring' : 'keys';
        noteRoutes.set(data1, route);
        if (route === 'ring') chordAttackRef.current?.(data1);
        else attackRef.current(noteName(data1));
        publishActiveNotes();
      } else if (command === 0x80 || (command === 0x90 && data2 === 0)) {
        releaseMidiNote(data1);
      } else if (command === 0xb0 && data1 === 64) {
        sustain = data2 >= 64;
        if (!sustain) {
          sustainedNotes.forEach(midi => {
            if (!heldNotes.has(midi)) releaseRef.current(noteName(midi));
          });
          sustainedNotes.clear();
          publishActiveNotes();
        }
      }
    };
    const refreshInputs = () => {
      if (!access || cancelled) return;
      const inputs = [...access.inputs.values()].filter(input => input.state === 'connected');
      access.inputs.forEach(input => { input.onmidimessage = handleMessage; });
      setState(current => ({
        ...current,
        supported: true,
        connected: inputs.length > 0,
        devices: inputs.map(input => input.name || input.manufacturer || 'MIDI keyboard'),
        error: null,
      }));
    };

    navigator.requestMIDIAccess().then(midiAccess => {
      if (cancelled) return;
      access = midiAccess;
      access.onstatechange = refreshInputs;
      refreshInputs();
    }).catch(error => {
      if (!cancelled) setState({ supported: true, connected: false, devices: [], error: error instanceof Error ? error.message : 'MIDI access was not allowed', activeNotes: [] });
    });

    return () => {
      cancelled = true;
      if (access) {
        access.onstatechange = null;
        access.inputs.forEach(input => { input.onmidimessage = null; });
      }
      heldNotes.forEach(midi => {
        if (noteRoutes.get(midi) === 'ring') chordReleaseRef.current?.(midi);
        else releaseRef.current(noteName(midi));
      });
      sustainedNotes.forEach(midi => releaseRef.current(noteName(midi)));
    };
  }, []);

  return state;
}
