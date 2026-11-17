// Progression Builder: the loop. A simple drum beat and a strummed guitar,
// one chord a bar, four beats in a bar. No DOM in here, so another page (the
// Fretboard Visualiser, later) can import it and drive its own display.
//
// createEngine(get, onBeat)
//   get()            -> { bpm, drums, chords, bars: [ [midi, ...] | null, ... ] }
//                       read at every beat, so changes are heard without stopping
//   onBeat(bar, beat) -> called as each beat sounds; bar is -1 during the count-in

export function createEngine(get, onBeat) {
  let ctx = null, master = null, noiseBuf = null;
  let timer = null, nextTime = 0, bar = 0, beat = 0, countIn = 0;
  let ringing = [];
  const bufs = new Map();

  function audio() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
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

  // Stop whatever is still ringing, quickly but without a click.
  function damp(time) {
    for (const r of ringing) {
      r.g.gain.setTargetAtTime(0, time, 0.015);
      r.srcs.forEach(s => { try { s.stop(time + 0.12); } catch {} });
    }
    ringing = [];
  }
  // A down-strum: low string first, each string a moment after the last.
  function strum(notes, time, vol) {
    const g = ctx.createGain(); g.gain.value = vol;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
    lp.connect(g); g.connect(master);
    const srcs = notes.map((m, i) => {
      const s = ctx.createBufferSource(); s.buffer = pluck(m);
      s.connect(lp); s.start(time + i * 0.014);
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
    if (s.chords && chord && chord.length) strum(chord, time, beat === 0 ? 0.5 : 0.32);
    notify(bar, beat, time);
    beat++;
    if (beat === 4) { beat = 0; bar = (bar + 1) % s.bars.length; }
    return spb;
  }
  function tick() {
    while (nextTime < ctx.currentTime + 0.12) nextTime += scheduleBeat(nextTime);
  }

  return {
    get playing() { return !!timer; },
    start() {
      audio();
      if (timer) return;
      bar = 0; beat = 0; countIn = 4;
      nextTime = ctx.currentTime + 0.08;
      timer = setInterval(tick, 25);
      tick();
    },
    stop() {
      if (!timer) return;
      clearInterval(timer); timer = null;
      damp(ctx.currentTime);
    },
    // Hear one chord when it is tapped.
    preview(notes) {
      audio();
      if (timer || !notes.length) return;
      damp(ctx.currentTime);
      strum(notes, ctx.currentTime + 0.02, 0.5);
    },
  };
}
