// Progression Builder: the page. Music facts are in theory.js, sound in audio.js.
import { KEYS, LEVELS, FUNCTIONS, FUNCTION_ORDER, DEGREES, levelOf, chordName, nashville,
         chordMidi, shapeDiagram, parseLink, serializeLink, visualiserLink } from './theory.js';
import { createEngine } from './audio.js';

const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('pb-' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('pb-' + k, JSON.stringify(v)); } catch {} },
};

// A link from a lesson summary can set the level, key, length and speed. Those
// apply to this visit only: the student's own saved choices are left alone.
// What they build is still saved, under that level and key, so it is there
// when they come back through the same link.
const link = parseLink(location.search);
const fromLink = k => k in link;
const state = {
  level: link.level ?? store.get('level', 1),
  key: link.key ?? store.get('key', 'G'),
  bars: link.bars ?? store.get('bars', 4),
  bpm: link.bpm ?? store.get('bpm', 80),
  drums: store.get('drums', true),
  chords: store.get('chords', true),
  prog: [],
  sel: 0,
};
if (!levelOf(state.level) || !LEVELS.some(l => l.id === state.level)) state.level = 1;
if (!KEYS.includes(state.key)) state.key = 'G';
if (![4, 8].includes(state.bars)) state.bars = 4;
const keep = (k, v) => { state[k] = v; if (!fromLink(k)) store.set(k, v); };

const progKey = () => `prog-${state.level}-${state.key}-${state.bars}`;
function loadProg(given) {
  const allowed = levelOf(state.level).degrees;
  const p = given || store.get(progKey(), []);
  state.prog = Array.from({ length: state.bars }, (_, i) => (allowed.includes(p[i]) ? p[i] : 0));
  const empty = state.prog.indexOf(0);
  state.sel = empty < 0 ? 0 : empty;
}
const saveProg = () => store.set(progKey(), state.prog);

const engine = createEngine(
  () => ({ bpm: state.bpm, drums: state.drums, chords: state.chords,
           bars: state.prog.map(d => (d ? chordMidi(chordName(state.key, d)) : null)) }),
  (bar, beat) => showBeat(bar, beat),
);

// ---------- Drawing ----------
function pills(el, items, current, onPick) {
  el.querySelectorAll('.pill').forEach(b => b.remove());
  for (const [value, label] of items) {
    const b = document.createElement('button');
    b.className = 'pill' + (value === current ? ' on' : '');
    b.textContent = label;
    b.setAttribute('aria-pressed', value === current);
    b.onclick = () => onPick(value);
    el.appendChild(b);
  }
}

function renderTop() {
  const lv = levelOf(state.level);
  pills($('levels'), LEVELS.map(l => [l.id, l.title]), state.level, id => {
    keep('level', id); loadProg(); render();
  });
  $('levelDesc').textContent = `${lv.desc}. ${lv.hint}`;
  if (!$('keys').querySelector('.lab')) $('keys').insertAdjacentHTML('afterbegin', '<span class="lab">Key</span>');
  pills($('keys'), KEYS.map(k => [k, k]), state.key, k => {
    keep('key', k); loadProg(); render();
  });
  pills($('barsRow'), [[4, '4 bars'], [8, '8 bars']], state.bars, n => {
    keep('bars', n); loadProg(); render();
  });
}

function renderSlots() {
  const el = $('slots');
  el.innerHTML = '';
  state.prog.forEach((deg, i) => {
    const d = document.createElement('div');
    d.className = 'slot' + (deg ? '' : ' empty') + (i === state.sel ? ' sel' : '');
    d.dataset.i = i;
    const name = deg ? chordName(state.key, deg) : '+';
    d.innerHTML = `<span class="barno">${i + 1}</span>
      <button class="pick" aria-label="Bar ${i + 1}: ${deg ? name : 'empty'}">
        <span class="name${name.length > 2 ? ' long' : ''}">${name}</span><span class="num">${deg ? nashville(deg) : '&nbsp;'}</span>
        <span class="beatdots"><i></i><i></i><i></i><i></i></span>
      </button>` + (deg ? `<button class="x" aria-label="Clear bar ${i + 1}">✕</button>` : '');
    d.querySelector('.pick').onclick = () => { state.sel = i; renderSlots(); };
    const x = d.querySelector('.x');
    if (x) x.onclick = () => { state.prog[i] = 0; state.sel = i; saveProg(); renderSlots(); renderShapes(); };
    el.appendChild(d);
  });
}

function chordButton(deg) {
  const b = document.createElement('button');
  b.className = 'chord';
  const name = chordName(state.key, deg);
  b.innerHTML = `<b>${name}</b><span>${nashville(deg)}</span>`;
  b.onclick = () => {
    engine.preview(chordMidi(name));
    state.prog[state.sel] = deg;
    // Move on to the next empty bar, or the next bar along.
    const next = state.prog.findIndex((d, i) => i > state.sel && !d);
    state.sel = next >= 0 ? next : Math.min(state.sel + 1, state.bars - 1);
    saveProg(); renderSlots(); renderShapes();
  };
  return b;
}
function renderPalette() {
  const el = $('palette'), lv = levelOf(state.level);
  el.innerHTML = '';
  const groups = lv.groups
    ? FUNCTION_ORDER.map(fn => [fn, lv.degrees.filter(d => DEGREES[d].fn === fn)]).filter(g => g[1].length)
    : [[null, lv.degrees]];
  for (const [fn, degs] of groups) {
    const g = document.createElement('div');
    g.className = 'group';
    g.innerHTML = fn
      ? `<h2>${FUNCTIONS[fn].label} <span>(${FUNCTIONS[fn].theory})</span></h2>`
      : `<h2>The chords <span>(tap one to put it in the bar)</span></h2>`;
    const row = document.createElement('div');
    row.className = 'chords';
    degs.forEach(d => row.appendChild(chordButton(d)));
    g.appendChild(row);
    el.appendChild(g);
  }
}

// A small chord box: six strings, four frets.
function shapeSvg(name) {
  const dg = shapeDiagram(name);
  if (!dg) return '';
  const x = s => 14 + s * 12, y = f => 22 + f * 16;
  let out = `<svg viewBox="0 0 88 96" role="img" aria-label="${name} chord shape">`;
  for (let s = 0; s < 6; s++) out += `<line class="str" x1="${x(s)}" y1="${y(0)}" x2="${x(s)}" y2="${y(4)}"/>`;
  for (let f = 0; f <= 4; f++) out += `<line class="${f === 0 && dg.base === 1 ? 'nut' : 'fr'}" x1="${x(0)}" y1="${y(f)}" x2="${x(5)}" y2="${y(f)}"/>`;
  dg.frets.forEach((f, s) => {
    if (f === null) out += `<text x="${x(s)}" y="14">×</text>`;
    else if (f === 0) out += `<circle class="open" cx="${x(s)}" cy="10" r="3.6"/>`;
    else out += `<circle class="dot" cx="${x(s)}" cy="${y(f - dg.base + 1) - 8}" r="4.6"/>`;
  });
  if (dg.base > 1) out += `<text x="${x(5) + 9}" y="${y(1) - 4}" style="text-anchor:start">${dg.base}</text>`;
  return out + '</svg>';
}
function renderShapes() {
  const names = [...new Set(state.prog.filter(Boolean).map(d => chordName(state.key, d)))];
  $('shapesCard').hidden = !names.length;
  $('shapes').innerHTML = names.map(n => `<div class="shape"><b>${n}</b>${shapeSvg(n)}</div>`).join('');
}

function renderSound() {
  $('tempo').value = state.bpm;
  $('bpmVal').textContent = state.bpm;
  for (const [id, on] of [['drumsBtn', state.drums], ['chordsBtn', state.chords]]) {
    $(id).classList.toggle('on', on);
    $(id).setAttribute('aria-pressed', on);
  }
  $('soundHint').textContent = state.chords
    ? 'Turn Chords off to strum it yourself along to the drums.'
    : 'Chords are off: strum along to the drums.';
}
function renderLinks() {
  $('neckLink').href = visualiserLink(state.key, 'major');
  $('neckLink').textContent = `See the ${state.key} major scale on the neck`;
  $('pentLink').href = visualiserLink(state.key, 'majpent');
  $('pentLink').textContent = `See ${state.key} major pentatonic, for making up a melody`;
  $('shareMsg').textContent = '';
}
function render() { renderTop(); renderSlots(); renderPalette(); renderShapes(); renderSound(); renderLinks(); }

// ---------- Playing ----------
function showBeat(bar, beat) {
  $('countin').textContent = bar < 0 ? `Count in: ${beat + 1}` : '';
  document.querySelectorAll('.slot').forEach(s => {
    const now = +s.dataset.i === bar;
    s.classList.toggle('now', now);
    s.querySelectorAll('.beatdots i').forEach((d, k) => d.classList.toggle('on', now && k <= beat));
  });
}
function setPlaying(on) {
  if (on) engine.start(); else { engine.stop(); showBeat(-2, 0); $('countin').textContent = ''; }
  $('play').textContent = on ? 'Stop' : 'Play';
}
$('play').onclick = () => setPlaying(!engine.playing);
$('clear').onclick = () => {
  if (engine.playing) setPlaying(false);
  state.prog = state.prog.map(() => 0); state.sel = 0;
  saveProg(); renderSlots(); renderShapes();
};
const setTempo = v => { keep('bpm', Math.max(50, Math.min(160, v))); renderSound(); };
$('tempo').oninput = e => setTempo(+e.target.value);
$('tDown').onclick = () => setTempo(state.bpm - 2);
$('tUp').onclick = () => setTempo(state.bpm + 2);
$('drumsBtn').onclick = () => { state.drums = !state.drums; store.set('drums', state.drums); renderSound(); };
$('chordsBtn').onclick = () => { state.chords = !state.chords; store.set('chords', state.chords); renderSound(); };

$('share').onclick = async () => {
  const url = location.origin + location.pathname + serializeLink(state);
  try {
    await navigator.clipboard.writeText(url);
    $('shareMsg').textContent = 'Copied. Paste it in a message to Matthew.';
  } catch {
    $('shareMsg').textContent = url;
  }
};

loadProg(link.prog);
render();
