// Progression Builder: the music facts and the link format. Pure functions, no DOM.
//
// Kept in step with the Fretboard Visualiser on purpose (see PLAN.md): the same
// key names, the same "key=" and "scale=" words in links, and string 0 = low E.

export const OPEN_MIDI = [40, 45, 50, 55, 59, 64]; // low E ... high E
const PC = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const mod12 = n => ((n % 12) + 12) % 12;

// The guitar-friendly major keys, G first because Matthew teaches functions in G.
export const KEY_NOTES = {
  G: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
  C: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  D: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
  A: ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
  E: ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
};
export const KEYS = Object.keys(KEY_NOTES);

// The three jobs a chord can do, in the words used in lessons.
export const FUNCTIONS = {
  home:    { label: 'Home',    theory: 'tonic' },
  away:    { label: 'Away',    theory: 'subdominant' },
  tension: { label: 'Tension', theory: 'dominant' },
};
export const FUNCTION_ORDER = ['home', 'away', 'tension'];

// Degrees 1-6 of a major key. The 7th (diminished) is left out for now.
export const DEGREES = {
  1: { minor: false, fn: 'home' },
  2: { minor: true,  fn: 'away' },
  3: { minor: true,  fn: 'home' },
  4: { minor: false, fn: 'away' },
  5: { minor: false, fn: 'tension' },
  6: { minor: true,  fn: 'home' },
};

export const LEVELS = [
  { id: 1, title: 'Level 1', desc: 'Four chords, your order', degrees: [1, 4, 5, 6], groups: false,
    hint: 'Try the four chords in different orders. Which order sounds best to you?' },
  { id: 2, title: 'Level 2', desc: 'Home, away and tension', degrees: [1, 6, 4, 2, 5], groups: true,
    hint: 'Try starting at home, going away, building tension, then coming back home.' },
  { id: 3, title: 'Level 3', desc: 'Every chord in the key', degrees: [1, 6, 3, 4, 2, 5], groups: true,
    hint: 'Try swapping one chord for another from the same group and hear what changes.' },
];
export const levelOf = id => LEVELS.find(l => l.id === id) || LEVELS[0];

export const chordName = (key, deg) => KEY_NOTES[key][deg - 1] + (DEGREES[deg].minor ? 'm' : '');
// Nashville numbers: 1, 2m, 3m, 4, 5, 6m.
export const nashville = deg => deg + (DEGREES[deg].minor ? 'm' : '');
// The three notes of the chord, as pitch classes (0 = C). For the fretboard later.
export function chordTones(key, deg) {
  const n = KEY_NOTES[key];
  return [0, 2, 4].map(step => PC[n[(deg - 1 + step) % 7]]);
}
export const keyPc = key => PC[key];

// One shape per chord, low E string first. x = not played.
export const SHAPES = {
  G: '320003', C: 'x32010', D: 'xx0232', A: 'x02220', E: '022100', F: '133211', B: 'x24442',
  Em: '022000', Am: 'x02210', Dm: 'xx0231', Bm: 'x24432',
  'F#m': '244222', 'C#m': 'x46654', 'G#m': '466444',
};
export const shapeOf = name => SHAPES[name] || null;
// The notes that shape sounds, low to high, as MIDI numbers.
export function chordMidi(name) {
  const s = shapeOf(name);
  if (!s) return [];
  return [...s].map((c, i) => (c === 'x' ? null : OPEN_MIDI[i] + parseInt(c, 10))).filter(n => n !== null);
}
// For drawing: which fret the diagram starts at, and each string's fret (null = x).
export function shapeDiagram(name) {
  const s = shapeOf(name);
  if (!s) return null;
  const frets = [...s].map(c => (c === 'x' ? null : parseInt(c, 10)));
  const played = frets.filter(f => f !== null && f > 0);
  const max = Math.max(0, ...played);
  const base = max <= 4 ? 1 : Math.min(...played);
  return { frets, base };
}

// ---------- Links ----------
// ?v=1&level=2&key=G&bars=4&bpm=80&prog=1,5,6,4   (0 in prog = an empty bar)
// Returns only the fields that were present and valid. Never throws.
export function parseLink(search) {
  const out = {};
  try {
    const q = new URLSearchParams(String(search || '').replace(/^[?#]/, ''));
    const int = k => (/^\d{1,3}$/.test(q.get(k) || '') ? +q.get(k) : null);
    const lv = int('level');
    if (lv >= 1 && lv <= LEVELS.length) out.level = lv;
    const key = (q.get('key') || '').toUpperCase();
    if (KEYS.includes(key)) out.key = key;
    if ([4, 8].includes(int('bars'))) out.bars = int('bars');
    const bpm = int('bpm');
    if (bpm >= 50 && bpm <= 160) out.bpm = bpm;
    const prog = q.get('prog');
    if (prog && /^[0-6](,[0-6]){0,7}$/.test(prog)) out.prog = prog.split(',').map(Number);
  } catch { return {}; }
  return out;
}
export function serializeLink(state) {
  return `?v=1&level=${state.level}&key=${state.key}&bars=${state.bars}&bpm=${state.bpm}` +
    `&prog=${state.prog.map(d => d || 0).join(',')}`;
}
// The Fretboard Visualiser already reads key= and scale= from its link.
export const VISUALISER = 'https://matthewannable.github.io/guitar-interval-visualiser/';
// Give it a progression as well ({ prog, bpm, level }) and the visualiser opens
// in its "play over chords" mode: pk = the progression's key, lv = this level.
export function visualiserLink(key, scale = 'major', jam = null) {
  let url = `${VISUALISER}#key=${encodeURIComponent(key.replace('#', 's'))}&scale=${scale}`;
  if (jam && jam.prog.some(Boolean)) {
    url += `&pk=${key}&prog=${jam.prog.map(d => d || 0).join(',')}&bpm=${jam.bpm}`;
    if (jam.level) url += `&lv=${jam.level}`;
  }
  return url;
}
