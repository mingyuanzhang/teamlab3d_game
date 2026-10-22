# Little Wonders · 3D

A separate, dependency-free 3D version of `team_lab`. Forty-eight little people explore a miniature stage, climb ladders, fall, and bounce. Six small mystery shapes reveal repeating kinetic sculptures: rainbow showers, chrysanthemum fireworks, floating balloons, paper-flower gardens, silk ribbons, and miniature planetariums. Up to six copies of each shape have independent clocks.

Open `index.html` in a modern browser with WebGL, or serve this directory:

```sh
cd team_lab3d
python3 -m http.server 8000
```

Visit http://localhost:8000. Everything is local: no package installation, build, CDN, fonts, models, or network connection is needed. The original `team_lab` is untouched.

## Play

- Choose a shape, then tap the stage, or drag a shape from the tray. Each copy reveals its discovery after a short delay and repeats automatically. The shapes stay small; the people and discoveries carry the scene. Discoveries arrive with a springy wobble, have small variations between reveals, and dissolve into drifting flecks at the end. The six dots show used copies.
- Choose the arrow to drag existing shapes. Moving a shape moves its next discovery; already released discoveries continue at their original location.
- Drag empty space with the arrow tool to orbit the world. The bottom-left camera controls rotate in 45° steps, toggle automatic rotation, zoom, and restore the original view. Scroll also zooms.
- Use Path or Bounce, then drag across the stage. The height arrows set the horizontal construction plane: 0, 2.4, 3.8, or 5.2 metres. Shapes can also be placed at these heights.
- Choose Ladder, then drag from its lower end toward a raised path at the selected height. The lower end connects to the highest existing surface below that height; the upper end should meet a path. Choosing Ladder at ground level automatically selects 2.4 metres.
- Pause freezes people, discovery clocks, and effects. Building and camera controls remain available. Undo reverses edits; reset clears edits and restores the starting paths and population.
- A gentle original soundtrack starts after your first click, tap, or game key. Every reveal plays its shape's own melody: rain chimes, sparkling fireworks, rising balloon flutes, wooden garden notes, rippling ribbon harp, and orbital bells. Tunes and visual pops enter together on the soundtrack’s pulse. Melodies, echoes, and held notes follow its current chord through every change. The speaker button or **M** mutes all audio and remembers your preference. Audio pauses with the game and when the tab is hidden.
- The **Music** menu offers **Default**, the original soundtrack; **Jazz**, with warm keys, walking bass, brushed percussion, and swing; **Rock**, with electric guitars, driving bass, and a drum backbeat; **Classical**, with chamber strings, cello, oboe, piano, and harp; and two piano-only themes, **Bach** and **Chopin**, with piano accompaniments from their music and original discovery phrases that follow their harmony. Changing themes updates the accompaniment, all six discovery instruments, and rhythmic motion together. Existing and newly placed objects join the selected theme; pending entrances are rescheduled to its beat. Theme choice is remembered separately from mute, and switching preserves pause and mute.
- The `?` button opens instructions. Controls have accessible names, tooltips, focus outlines, and status announcements.

Keyboard: **1–6** shapes, **V** move/orbit, **L** path, **H** ladder, **B** bounce, **← / →** rotate, **R** auto rotate, **[ / ]** building height, **Space** pause, **M** sound, **Escape** cancel, **Ctrl/Cmd+Z** undo. Press Enter on a focused tray shape to place a copy in a free spot near the centre.

## Piano themes and score sources

Bach's accompaniment reduces the opening four bars of [Prelude in C major, BWV 846](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5), for piano. Chopin's accompaniment uses both hands of the opening two bars of [Nocturne Op. 9 No. 2](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1590). These backgrounds are unchanged.

The six discoveries use original, quieter piano phrases composed to fit those backgrounds: falling droplets, a quick rising flare, floating ascents, a little bloom, weaving arpeggios, and an orbiting answer. Bach uses light, articulated figures; Chopin uses softer triplet figures on the Nocturne's pulse. Each object cycles through three variations in its answering notes, cadence timing, and touch; different copies can play different variations. The opening gesture keeps its identity. Every phrase follows the active harmony, including Chopin's chord changes inside a bar. Common tones can sustain across a change; other notes release ahead of it. Chopin discoveries enter on full beats so their subdivisions align with the accompaniment. All parts use piano hammer attacks, decaying string partials, and damped releases.

The Nocturne background notation in `audio.js` adapts Renato Biolcati Rinaldi's Mutopia transcription under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/); the adapted notation is shared under that license. The Prelude edition by Tobias Erbsland is marked public domain. The discovery phrases are original compositions. No recordings, score downloads, or third-party audio services are used at runtime.

## People and spacing

Each person has a full-height 3D capsule encompassing their body and animated arms. Every movement checks the capsule along its swept path against the other 47 bodies. Walkers steer sideways, narrow-path walkers turn or wait, climbers wait, and falling people yield instead of entering an occupied volume. People on different floors can pass above and below each other. The simulation uses small fixed substeps and never relies on visual depth sorting to prevent overlap.

People avoid placed shapes, and placement or movement over a person's body is rejected. Shapes may overlap other shapes. Like the original, this is a wandering playground rather than a goal-directed pathfinding game: a narrow ladder can develop a queue, and a floating path needs a ladder to become reachable. Perspective can visually conceal one person behind another; the actual 3D bodies remain separate.

## Files and validation

- `simulation.js`: browser-independent movement, collision volumes, inventory, history, and clocks.
- `renderer.js`: local WebGL mesh renderer, curved petals, twisting ribbon surfaces, lighting, depth buffer, and orbit camera.
- `world.js`: scene, six 3D effects, placement, tools, and camera input.
- `audio.js`: six music themes (Default, Jazz, Rock, Classical, Bach, and Chopin), shared chord and rhythm timing, and six theme-aware discovery tunes using Web Audio; no audio assets or dependencies. Browsers without Web Audio can still play silently.
- `index.html` and `style.css`: responsive controls and instructions.

```sh
node --test team_lab3d/tests/*.test.cjs
```

Run that command from the parent directory (or `node --test tests/*.test.cjs` here). Tests cover collision-free spawning, approaching walkers, swept collisions, falling bodies, ladder queues, gravity, elevated supports, springs, shape avoidance, inventory, repeating discoveries, move/undo, invalid inputs, camera picking at desktop and phone dimensions, and ten simulated minutes with two deterministic populations. Audio checks cover audible, distinct waveforms, loop continuity, chord changes, beat synchronization, overlapping tunes, mute persistence, pause and visibility, and browser or storage restrictions. A separate DOM/WebGL harness checks application startup, geometry submission, input, and all six effects, including pop overshoot, settling, and full-size dissolves; it does not replace visual testing in a real browser.

For GitHub Pages releases, update each changed CSS or JavaScript file's `?v=` value in `index.html` to the first 12 characters of its SHA-256 hash, so returning visitors load the matching styles and scripts.
