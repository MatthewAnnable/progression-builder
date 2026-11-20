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

**Built 17/11/2026: "play over chords" in the visualiser (steps 1 to 3)**

When the progression has at least one chord, the builder's two scale links
carry it: `#key=G&scale=majpent&pk=G&prog=1,5,6,4&bpm=80&lv=2` (`pk` = the
progression's key, `lv` = the builder's level, so "change the chords" can
return to the same place). The visualiser then:

1. Shows the chords as a strip above the neck with a Play button, and loops
   them with a copy of `audio.js`.
2. Rings the notes of the chord being played, in amber, wherever they fall in
   the scale. Stopped, tapping a chord in the strip shows that chord's notes.
3. Offers three scales that share one set of notes: the key's major
   pentatonic, the major scale, and the relative minor pentatonic.

It hides the key and scale pickers in this mode, so the scale always fits the
chords. Close returns to the plain visualiser, and the progression is never
saved there, so the page opens as the plain visualiser next time.

`theory.js` and `audio.js` are copied into the visualiser as `progression.js`
and `audio.js`. **This folder is the master**: change them here, then copy them
over (keeping the two-line header in the copies) and run both test files.

**Still to do, if it earns its place**

4. **One page.** Fold the builder's bar boxes into that view so a student can
   change a chord without leaving the neck.
- A chord note that is not in the scale on screen (the 4th and 7th are missing
  from the pentatonic) is simply not shown. It could be drawn as a ghost dot.

**Things to keep in mind**

- The visualiser's own rules say no sound, one idea on screen, and that tapping
  the neck never changes the key. That is why this is a separate mode reached
  only from the builder's links, and why the plain view is untouched.
- The visualiser has all twelve keys and minor scales; the builder has five
  major keys. Minor keys in the builder come first if he wants minor-key
  writing, and the visualiser is already ready for them.
- Whether `audio.js` is copied into the visualiser or the two apps become one
  repo. Copying is simpler; one repo is tidier if step 4 happens.

## Guitar sound (20/11/2026)

Matthew found the plucked (Karplus-Strong) chords unpleasant to play along to.
The loop now strums the real acoustic steel-string recordings that the singing
app's Sing From a Chord uses (nbrosowsky/tonejs-instruments, CC-BY 3.0), with
each recording's tuning measured and corrected on load. Down strums on 1 and 3,
lighter up strums on 2 and 4. The plucked sound only stands in until a note has
loaded, or if the student is offline. Play waits up to 4 s for the first load.

## Home / Away / Tension colours (20/11/2026)

Matthew found every chord box looking the same. Each chord now wears its
function's colour: Home moss, Away amber, Tension clay. (Small icons for each
were tried and removed the same day: Matthew found them too busy.) This is
(the Play-Along harmony view's tonic green / subdominant sand / dominant rose,
in Evening colours). Bars, palette, group headings, a key on level 1, and the
chord-shape dots all use it. The bar that's playing fills with its colour; the
selected bar has an ink outline. Clay is fine here: this app has no right/wrong
marking. Day theme uses a darker amber (#A86A10) for amber words.
