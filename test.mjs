import assert from 'node:assert/strict';
import * as T from './theory.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const mod12 = x => ((x % 12) + 12) % 12;

test('chords of G are G Am Bm C D Em', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(d => T.chordName('G', d)), ['G', 'Am', 'Bm', 'C', 'D', 'Em']);
});
test('chords of E are E F#m G#m A B C#m', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(d => T.chordName('E', d)), ['E', 'F#m', 'G#m', 'A', 'B', 'C#m']);
});
test('Nashville numbers', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(T.nashville), ['1', '2m', '3m', '4', '5', '6m']);
});
test('functions: 1 3 6 home, 2 4 away, 5 tension', () => {
  const by = fn => Object.keys(T.DEGREES).filter(d => T.DEGREES[d].fn === fn).map(Number);
  assert.deepEqual(by('home'), [1, 3, 6]);
  assert.deepEqual(by('away'), [2, 4]);
  assert.deepEqual(by('tension'), [5]);
});
test('every chord in every key has a shape', () => {
  for (const key of T.KEYS) for (let d = 1; d <= 6; d++) assert.ok(T.shapeOf(T.chordName(key, d)), key + ' ' + d);
});
test('every shape sounds only the notes of its chord, and all three of them', () => {
  for (const key of T.KEYS) for (let d = 1; d <= 6; d++) {
    const name = T.chordName(key, d);
    const want = new Set(T.chordTones(key, d));
    const got = new Set(T.chordMidi(name).map(mod12));
    assert.deepEqual([...got].sort(), [...want].sort(), name);
  }
});
test('the lowest note of every shape is the root', () => {
  for (const key of T.KEYS) for (let d = 1; d <= 6; d++) {
    const name = T.chordName(key, d);
    assert.equal(mod12(T.chordMidi(name)[0]), T.chordTones(key, d)[0], name);
  }
});
test('diagrams: open chords start at fret 1, C#m starts at fret 4', () => {
  assert.equal(T.shapeDiagram('G').base, 1);
  assert.equal(T.shapeDiagram('Bm').base, 1);
  assert.equal(T.shapeDiagram('C#m').base, 4);
  assert.deepEqual(T.shapeDiagram('D').frets, [null, null, 0, 2, 3, 2]);
});
test('levels only use degrees 1-6 and level 1 is 1 4 5 6', () => {
  assert.deepEqual(T.LEVELS[0].degrees, [1, 4, 5, 6]);
  for (const l of T.LEVELS) for (const d of l.degrees) assert.ok(T.DEGREES[d]);
});
test('links round-trip', () => {
  const s = { level: 2, key: 'D', bars: 8, bpm: 96, prog: [1, 5, 6, 4, 0, 2, 5, 1] };
  assert.deepEqual(T.parseLink(T.serializeLink(s)), s);
});
test('a link with only some settings gives only those', () => {
  assert.deepEqual(T.parseLink('?v=1&level=1&key=g'), { level: 1, key: 'G' });
});
test('nonsense in a link is ignored', () => {
  assert.deepEqual(T.parseLink('?level=9&key=H&bars=5&bpm=999&prog=1,7,x'), {});
  assert.deepEqual(T.parseLink(null), {});
});
test('visualiser link uses its key= and scale= words', () => {
  assert.equal(T.visualiserLink('G'), 'https://matthewannable.github.io/guitar-interval-visualiser/#key=G&scale=major');
  assert.equal(T.visualiserLink('A', 'majpent'), 'https://matthewannable.github.io/guitar-interval-visualiser/#key=A&scale=majpent');
});
console.log(`\nAll ${n} tests passed`);
