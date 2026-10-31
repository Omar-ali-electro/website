# Little 3D Factory

A small animated factory built with [three.js](https://threejs.org/).

- A stamping press makes crates that ride a conveyor through the hall
- An orange robot arm (2-link IK) picks each crate off the belt and loads it onto a truck
- When the truck holds 6 crates it drives a loop through town, dropping one parcel at each of six houses
- Each house opens its door, takes the parcel in and raises its mailbox flag
- Plus workers, a forklift, highway traffic, a park with a pond, and a few secrets to find

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

Controls: drag to orbit, scroll to zoom, `Space` pauses, `R` toggles the roof, `F` follows the truck.
Tap things in the scene; some of them react.
Add `?speed=3` to the URL to fast-forward the simulation.
