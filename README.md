# Little Wonders · 3D

A separate, dependency-free 3D version of `team_lab`. Forty-eight little people explore a miniature stage, climb ladders, fall, and bounce. Six mystery shapes reveal repeating 3D rain clouds, fireworks, balloons, gardens, ribbons, and orbiting worlds. Up to six copies of each shape have independent clocks.

Open `index.html` in a modern browser with WebGL, or serve this directory:

```sh
cd team_lab3d
python3 -m http.server 8000
```

Visit http://localhost:8000. Everything is local: no package installation, build, CDN, fonts, models, or network connection is needed. The original `team_lab` is untouched.

## Play

- Choose a shape, then tap the stage, or drag a shape from the tray. Each copy reveals its discovery after a short delay and repeats automatically. The six dots show used copies.
- Choose the arrow to drag existing shapes. Moving a shape moves its next discovery; already released discoveries continue at their original location.
- Drag empty space with the arrow tool to orbit the world. The bottom-left camera controls rotate in 45° steps, toggle automatic rotation, zoom, and restore the original view. Scroll also zooms.
- Use Path or Bounce, then drag across the stage. The height arrows set the horizontal construction plane: 0, 2.4, 3.8, or 5.2 metres. Shapes can also be placed at these heights.
- Choose Ladder, then drag from its lower end toward a raised path at the selected height. The lower end connects to the highest existing surface below that height; the upper end should meet a path. Choosing Ladder at ground level automatically selects 2.4 metres.
- Pause freezes people, discovery clocks, and effects. Building and camera controls remain available. Undo reverses edits; reset clears edits and restores the starting paths and population.
- The `?` button opens instructions. Controls have accessible names, tooltips, focus outlines, and status announcements.

Keyboard: **1–6** shapes, **V** move/orbit, **L** path, **H** ladder, **B** bounce, **← / →** rotate, **R** auto rotate, **[ / ]** building height, **Space** pause, **Escape** cancel, **Ctrl/Cmd+Z** undo. Press Enter on a focused tray shape to place a copy in a free spot near the centre.

## People and spacing

Each person has a full-height 3D capsule encompassing their body and animated arms. Every movement checks the capsule along its swept path against the other 47 bodies. Walkers steer sideways, narrow-path walkers turn or wait, climbers wait, and falling people yield instead of entering an occupied volume. People on different floors can pass above and below each other. The simulation uses small fixed substeps and never relies on visual depth sorting to prevent overlap.

People avoid placed shapes, and placement or movement over a person's body is rejected. Shapes may overlap other shapes. Like the original, this is a wandering playground rather than a goal-directed pathfinding game: a narrow ladder can develop a queue, and a floating path needs a ladder to become reachable. Perspective can visually conceal one person behind another; the actual 3D bodies remain separate.

## Files and validation

- `simulation.js`: browser-independent movement, collision volumes, inventory, history, and clocks.
- `renderer.js`: local WebGL mesh renderer, lighting, depth buffer, and orbit camera.
- `world.js`: scene, six 3D effects, placement, tools, and camera input.
- `index.html` and `style.css`: responsive controls and instructions.

```sh
node --test team_lab3d/tests/*.test.cjs
```

Run that command from the parent directory (or `node --test tests/*.test.cjs` here). Tests cover collision-free spawning, approaching walkers, swept collisions, falling bodies, ladder queues, gravity, elevated supports, springs, shape avoidance, inventory, repeating discoveries, move/undo, invalid inputs, camera picking at desktop and phone dimensions, and ten simulated minutes with two deterministic populations. A separate DOM/WebGL harness checks application startup, geometry submission, input, and all six effects; it does not replace visual testing in a real browser.
