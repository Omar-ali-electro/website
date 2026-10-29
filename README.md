# Little 3D Factory

A small animated factory built with [three.js](https://threejs.org/).

- A stamping press makes crates that ride a conveyor through the hall
- An orange robot arm (2-link IK) picks each crate off the belt and loads it onto a truck
- When the truck holds 6 crates it drives off, returns empty, and the "Crates shipped" counter goes up
- Plus a forklift doing laps, a smoking chimney, silos, trees and a sawtooth roof with skylights

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

Controls: drag to orbit, scroll to zoom, `Space` pauses, `R` toggles the roof.
Add `?speed=3` to the URL to fast-forward the simulation.
