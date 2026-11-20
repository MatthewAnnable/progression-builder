// Progression Builder: the loop. A simple drum beat and a strummed guitar,
// one chord a bar, four beats in a bar. The guitar is real: the same acoustic
// steel-string recordings as the singing app's Sing From a Chord (see below). No DOM in here, so another page (the
// Fretboard Visualiser, later) can import it and drive its own display.
//
// createEngine(get, onBeat)
//   get()            -> { bpm, drums, chords, bars: [ [midi, ...] | null, ... ] }
//                       read at every beat, so changes are heard without stopping
//   onBeat(bar, beat) -> called as each beat sounds; bar is -1 during the count-in

const GUITAR_LEVEL = 1.0;   // the real guitar, after its compressor
const PLUCK_LEVEL = 0.5;    // the stand-in plucked sound, before the recordings load

// How far out of tune a recording is, in cents (McLeod pitch detection, as in
// the singing app's sing-core.js), so it can be corrected on playback.
function detectPitch(buf, sr, fMin, fMax) {
  const n = buf.length, maxTau = Math.min(n >> 1, Math.floor(sr / fMin)), minTau = Math.floor(sr / fMax);
  const nsdf = new Float32Array(maxTau);
  let sq = 0; for (let i = 0; i < n; i++) sq += buf[i] * buf[i];
  let m = 2 * sq;
  for (let tau = 0; tau < maxTau; tau++) {
    let acf = 0;
    for (let i = 0; i < n - tau; i++) acf += buf[i] * buf[i + tau];
    nsdf[tau] = m > 0 ? 2 * acf / m : 0;
    m -= buf[tau] * buf[tau] + buf[n - 1 - tau] * buf[n - 1 - tau];
  }
  const peaks = [];
  let tau = 1;
  while (tau < maxTau - 1 && nsdf[tau] > 0) tau++;
  while (tau < maxTau - 1) {
    while (tau < maxTau - 1 && nsdf[tau] <= 0) tau++;
    let best = -1;
    while (tau < maxTau - 1 && nsdf[tau] > 0) { if (best < 0 || nsdf[tau] > nsdf[best]) best = tau; tau++; }
    if (best > 0 && best >= minTau && nsdf[best] > nsdf[best - 1] && nsdf[best] >= nsdf[best + 1]) peaks.push(best);
  }
  if (!peaks.length) return null;
  let maxVal = 0; for (const p of peaks) maxVal = Math.max(maxVal, nsdf[p]);
  const pick = peaks.find(p => nsdf[p] >= 0.9 * maxVal);
  const a = nsdf[pick - 1], b = nsdf[pick], c = nsdf[pick + 1];
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
  return { freq: sr / (pick + shift), clarity: b };
}
function measureTuning(buf, sm) {
  const d = buf.getChannelData(0), sr = buf.sampleRate;
  const n = sm < 48 ? 8192 : 4096, readings = [];
  for (const at of [0.2, 0.45, 0.7]) {
    const s = Math.floor(sr * at);
    if (s + n > d.length) break;
    const r = detectPitch(d.subarray(s, s + n), sr, 30, 2500);
    if (!r || r.clarity < 0.85) continue;
    let c = 1200 * Math.log2(r.freq / (440 * Math.pow(2, (sm - 69) / 12)));
    c -= 1200 * Math.round(c / 1200);
    if (Math.abs(c) <= 40) readings.push(c);
  }
  readings.sort((x, y) => x - y);
  return readings.length ? readings[readings.length >> 1] : 0;
}

export function createEngine(get, onBeat) {
  let ctx = null, master = null, noiseBuf = null;
  let timer = null, starting = false, nextTime = 0, bar = 0, beat = 0, countIn = 0;
  let ringing = [];
  const bufs = new Map();
  let guitarBus = null;

  function audio() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      // The recordings are quieter than the drums and peak hard on the strike:
      // a compressor evens out strike and ring, then a gain lifts them up.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -28; comp.knee.value = 6; comp.ratio.value = 6;
      comp.attack.value = 0.003; comp.release.value = 0.2;
      guitarBus = ctx.createGain(); guitarBus.gain.value = GUITAR_LEVEL;
      comp.connect(guitarBus).connect(master);
      guitarBus.input = comp;
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // A plucked string (Karplus-Strong), the same sound as the Ear Trainer.
  function pluck(midi) {
    if (bufs.has(midi)) return bufs.get(midi);
    const sr = ctx.sampleRate, len = Math.floor(sr * 2.2);
    const period = sr / (440 * Math.pow(2, (midi - 69) / 12)), N = Math.floor(period), frac = period - N;
    const buf = ctx.createBuffer(1, len, sr), out = buf.getChannelData(0);
    const line = new Float32Array(N + 2);
    let prev = 0;
    for (let i = 0; i < line.length; i++) { const r = Math.random() * 2 - 1; prev = prev * 0.5 + r * 0.5; line[i] = prev; }
    const decay = midi < 52 ? 0.996 : 0.994;
    let p = 0;
    for (let i = 0; i < len; i++) {
      const a = line[p], b = line[(p + 1) % line.length];
      out[i] = a + (b - a) * frac;
      line[p] = decay * 0.5 * (a + b);
      p = (p + 1) % line.length;
    }
    const fade = Math.floor(sr * 0.08);
    for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;
    bufs.set(midi, buf);
    return buf;
  }


  // ---------- Real guitar ----------
  // Acoustic steel-string from nbrosowsky/tonejs-instruments (CC-BY 3.0), one
  // recording for every semitone D2..D5, the same set the singing app's
  // Sing From a Chord uses. Each file's own tuning is measured when it loads
  // and corrected, so the chords ring in tune. Until a note has loaded (or if
  // the student is offline) the old plucked sound stands in for it.
  const SAMPLE_BASE = 'https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-acoustic/';
  const FILE = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
  const samples = new Map();   // midi -> Promise, with .done = { buf, tune } | null once settled
  const nearest = m => Math.max(38, Math.min(74, m));
  function load(midi) {
    const sm = nearest(midi);
    if (!samples.has(sm)) {
      const p = (async () => {
        const res = await fetch(SAMPLE_BASE + FILE[sm % 12] + (Math.floor(sm / 12) - 1) + '.mp3');
        if (!res.ok) throw new Error(res.status);
        const ab = await res.arrayBuffer();
        const buf = await new Promise((ok, no) => ctx.decodeAudioData(ab, ok, no));
        return { buf, tune: measureTuning(buf, sm) };
      })().catch(() => null);
      p.done = undefined;
      p.then(v => { p.done = v; });
      samples.set(sm, p);
    }
    return samples.get(sm);
  }
  const loadAll = notes => Promise.all([...new Set(notes)].map(load));

  // Stop whatever is still ringing, quickly but without a click (a hand on the strings).
  function damp(time) {
    for (const r of ringing) {
      r.g.gain.setTargetAtTime(0, time, 0.02);
      r.srcs.forEach(s => { try { s.stop(time + 0.15); } catch {} });
    }
    ringing = [];
  }
  // A strum. Down: low string first. Up: high strings first, lighter, missing the bass.
  function strum(notes, time, vol, up = false) {
    const g = ctx.createGain(); g.gain.value = vol;
    g.connect(guitarBus.input);
    let order = [...notes].sort((a, b) => a - b);
    if (up) order = order.slice(-4).reverse();
    const per = 1 / Math.sqrt(order.length), gap = up ? 0.012 : 0.02;
    const srcs = order.map((m, i) => {
      const s = ctx.createBufferSource();
      const real = samples.get(nearest(m));
      if (real && real.done) {
        s.buffer = real.done.buf;
        s.playbackRate.value = Math.pow(2, (m - nearest(m)) / 12 - real.done.tune / 1200);
      } else {
        load(m);
        s.buffer = pluck(m);
      }
      const v = ctx.createGain(); v.gain.value = per * (real && real.done ? 1 : PLUCK_LEVEL);
      s.connect(v).connect(g); s.start(time + i * gap);
      return s;
    });
    ringing.push({ g, srcs });
  }

  function kick(time) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, time);
    o.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    g.gain.setValueAtTime(0.9, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    o.connect(g); g.connect(master); o.start(time); o.stop(time + 0.25);
  }
  function noise(time, freq, dur, vol) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    s.connect(hp); hp.connect(g); g.connect(master); s.start(time); s.stop(time + dur + 0.02);
  }
  const snare = time => {
    noise(time, 1400, 0.16, 0.5);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(220, time); o.frequency.exponentialRampToValueAtTime(140, time + 0.08);
    g.gain.setValueAtTime(0.3, time); g.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    o.connect(g); g.connect(master); o.start(time); o.stop(time + 0.12);
  };
  const hat = (time, vol) => noise(time, 7000, 0.045, vol);
  // The count-in: a stick click.
  function stick(time) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 1100;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.5, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    o.connect(g); g.connect(master); o.start(time); o.stop(time + 0.07);
  }

  function notify(b, k, time) {
    const run = timer;
    setTimeout(() => { if (timer && timer === run) onBeat(b, k); }, Math.max(0, (time - ctx.currentTime) * 1000));
  }

  function scheduleBeat(time) {
    const s = get();
    const spb = 60 / s.bpm;
    if (countIn > 0) {
      stick(time);
      notify(-1, 4 - countIn, time);
      countIn--;
      return spb;
    }
    if (bar >= s.bars.length) bar = 0;
    if (s.drums) {
      hat(time, 0.22); hat(time + spb / 2, 0.12);
      if (beat === 0 || beat === 2) kick(time);
      if (beat === 1 || beat === 3) snare(time);
    }
    damp(time);
    const chord = s.bars[bar];
    // Down on 1 and 3, up on 2 and 4; beat 1 the strongest.
    if (s.chords && chord && chord.length) strum(chord, time, beat === 0 ? 1 : beat === 2 ? 0.8 : 0.5, beat % 2 === 1);
    notify(bar, beat, time);
    beat++;
    if (beat === 4) { beat = 0; bar = (bar + 1) % s.bars.length; }
    return spb;
  }
  function tick() {
    while (nextTime < ctx.currentTime + 0.12) nextTime += scheduleBeat(nextTime);
  }

  return {
    get playing() { return !!timer || starting; },
    async start() {
      audio();
      if (timer || starting) return;
      // Fetch this progression's notes first (a moment, the first time only),
      // but never wait more than a few seconds: the stand-in sound covers the rest.
      starting = true;
      const notes = get().bars.flat().filter(n => n != null);
      await Promise.race([loadAll(notes), new Promise(r => setTimeout(r, 4000))]);
      if (!starting) return;   // stopped while loading
      starting = false;
      bar = 0; beat = 0; countIn = 4;
      nextTime = ctx.currentTime + 0.08;
      timer = setInterval(tick, 25);
      tick();
    },
    stop() {
      starting = false;
      if (!timer) return;
      clearInterval(timer); timer = null;
      damp(ctx.currentTime);
    },
    // Hear one chord when it is tapped.
    preview(notes) {
      audio();
      if (timer || !notes.length) return;
      damp(ctx.currentTime);
      strum(notes, ctx.currentTime + 0.02, 1);
    },
    // Start fetching the recordings for these notes (call when chords are chosen).
    prepare(notes) {
      audio();
      return loadAll(notes.filter(n => n != null));
    },
  };
}
