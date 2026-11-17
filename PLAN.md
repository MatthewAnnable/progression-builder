# Progression Builder

Built 17/11/2026. A student picks chords from a key, hears them looped over a
drum beat, and strums or sings along. It is the tool for the first Creating
steps Matthew teaches: choosing an order for four chords, then building a
progression from the three chord functions.

## What it does now

- **Three levels**, like his other apps (numbered levels, not a grid of options):
  1. Four chords, your order (1, 4, 5, 6m).
  2. Home, away and tension (adds 2m; chords grouped by function).
  3. Every chord in the key (adds 3m).
- **Five keys:** G, C, D, A, E major. G first, because he teaches functions in G.
- **Function words:** Home (tonic), Away (subdominant), Tension (dominant).
  Numbers are Nashville: 1, 2m, 3m, 4, 5, 6m.
- **4 or 8 bars**, one chord a bar. Tap a bar, then tap a chord.
- **The loop:** a count-in, then drums and a strummed guitar. Drums and Chords
  each switch off, so a student can strum it themselves over the drums.
- **Chord shapes** for whatever is in the progression.
- **Links:** to the Fretboard Visualiser for the key's major scale and major
  pentatonic, and "Copy a link to this progression" to send to Matthew.
- **Set tasks:** `?v=1&level=2&key=G` (also `bars=4|8`, `bpm=50-160`,
  `prog=1,5,6,4`). Link settings apply to that visit only; what the student
  builds is saved under that level and key.

Left out on purpose: the 7th (diminished) chord, minor keys, sevenths, and
more than one chord in a bar. Add them when Matthew teaches them, not before.

## Files

| File | What it holds |
|---|---|
| `theory.js` | Keys, chords, functions, levels, chord shapes, the link format. No DOM. |
| `audio.js` | The loop: drums and strum. No DOM. `createEngine(get, onBeat)`. |
| `app.js` | The page. |
| `test.mjs` | `node test.mjs`. Includes a check that every chord shape sounds exactly the notes of its chord. |
| `evening.css`, `fonts/` | The shared look. Master is `System/design-system/evening-apps.css`. |

## Joining it with the Fretboard Visualiser

Matthew wants students to be able to play scales over the progressions they
have made. The two apps are separate today but were built to meet:

**Already shared**

- The same words in links: `key=` and `scale=`. The builder's two scale links
  open the visualiser on the right key today.
- The same layout of files (`theory.js` pure, `app.js` for the page,
  `test.mjs`), the same string order (0 = low E) and the same open-string notes.
- `audio.js` touches no page elements, so the visualiser can use it as it is.
- `chordTones(key, degree)` gives the three notes of each chord, ready for the
  fretboard to mark.

**Steps towards one "play over your chords" view** (each useful on its own)

1. **Carry the progression across.** The scale links add `prog=` and `bpm=`.
   The visualiser shows the chords as a thin strip above the neck and gets a
   Play button, using a copy of `audio.js`.
2. **Show where to land.** While the loop plays, the visualiser rings the
   current chord's three notes inside the scale shape. That is his improvising
   advice (aim for chord notes, start and end phrases on them) made visible.
3. **Suggest the scale.** For a major key: major pentatonic first, then the
   full major scale, then the relative minor pentatonic as "the same notes from
   a different home". The visualiser already treats scales that way.
4. **One page.** If steps 1 to 3 earn their place, fold the builder's bar boxes
   into that view so a student can change a chord without leaving the neck.

**Things to settle first**

- The visualiser's own rules say no sound, one idea on screen, and that tapping
  the neck never changes the key. So this should be a separate "Play over
  chords" mode reached from the builder, not a change to the visualiser's
  normal view.
- The visualiser has all twelve keys and minor scales; the builder has five
  major keys. Minor keys in the builder come first if he wants minor-key
  writing, and the visualiser is already ready for them.
- Whether `audio.js` is copied into the visualiser or the two apps become one
  repo. Copying is simpler; one repo is tidier if step 4 happens.
