import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  mat, glow, part, boxGeo, cylGeo, sphereGeo, canvasTexture, textTexture, M, Particles, makeBubble,
  buildTruck, buildCar, buildPerson, buildHouse, buildCat, buildCow, buildDuck, buildGnome, buildUfo,
} from './models.js';

// ---------------------------------------------------------------------------
// Renderer, scene, camera
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc7e8);
scene.fog = new THREE.Fog(0x9fc7e8, 60, 150);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(8, 34, 52);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(16, 0.5, 2);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 5;
controls.maxDistance = 130;

// Narrow (portrait) screens get a wider lens and a farther camera so the whole town fits
const BASE_DIST = camera.position.distanceTo(controls.target);
const FIT_HALF_WIDTH = 26;
function fitCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  camera.fov = aspect < 1 ? 60 : 50;
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const dist = Math.min(Math.max(BASE_DIST, FIT_HALF_WIDTH / (Math.tan(halfFov) * aspect)), 110);
  const dir = camera.position.clone().sub(controls.target).normalize();
  camera.position.copy(controls.target).addScaledVector(dir, dist);
  scene.fog.near = dist + 20;
  scene.fog.far = dist + 100;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
fitCamera();
window.addEventListener('resize', fitCamera);

// ---------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------
scene.add(new THREE.HemisphereLight(0xdfefff, 0x6b7a4f, 0.9));

const sun = new THREE.DirectionalLight(0xfff2dd, 2.2);
sun.position.set(36, 34, 18);
sun.target.position.set(18, 0, 0);
scene.add(sun.target);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, far: 120 });
sun.shadow.bias = -0.0005;
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun);

for (const x of [-6, -1, 4]) {
  const lamp = new THREE.PointLight(0xffe2b0, 12, 12, 1.5);
  lamp.position.set(x, 4.2, 0);
  scene.add(lamp);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const box = (w, h, d, material, x = 0, y = 0, z = 0, parent = scene) => part(parent, boxGeo(w, h, d), material, x, y, z);
const cylinder = (rTop, rBottom, h, material, x = 0, y = 0, z = 0, parent = scene, segments = 20) =>
  part(parent, cylGeo(rTop, rBottom, h, segments), material, x, y, z);
const smoothstep = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(Math.max(t, 0), 1);

// Things the viewer can tap. Each root carries userData.onTap.
const tappables = [];
function onTap(obj, fn) {
  obj.userData.onTap = fn;
  tappables.push(obj);
}

const bubbles = [];
function say(text, obj, height = 1.5) {
  const b = makeBubble(text);
  scene.add(b);
  bubbles.push({ sprite: b, obj, height, age: 0 });
}

let audio = null;
function chirp(type, from, to, dur, volume = 0.06) {
  try {
    audio ??= new AudioContext();
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch {
    // Sound is a bonus; ignore browsers that refuse it
  }
}

// ---------------------------------------------------------------------------
// Ground, yard, roads
// ---------------------------------------------------------------------------
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(0x7fa35a, { roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const concrete = mat(0xb9b6ae, { roughness: 0.95 });
box(30, 0.1, 24, concrete, 0, 0.05, 2).castShadow = false;

const asphalt = mat(0x3d3f44, { roughness: 1 });
const stripeMat = mat(0xf2d14b);
const whiteLine = mat(0xf2f2f2);
const ROAD_W = 4.4;

// Delivery loop: from the loading bay out to the houses and back round
const ROUTE_PTS = [[11.6, 1.6], [11.6, 14], [42, 14], [42, -14], [11.6, -14], [11.6, 1.6]];
const RECT = [[11.6, -14], [11.6, 14], [42, 14], [42, -14], [11.6, -14]];
for (let i = 0; i < RECT.length - 1; i++) {
  const [x0, z0] = RECT[i];
  const [x1, z1] = RECT[i + 1];
  const alongX = z0 === z1;
  const len = Math.abs(alongX ? x1 - x0 : z1 - z0);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  box(alongX ? len + ROAD_W : ROAD_W, 0.04, alongX ? ROAD_W : len + ROAD_W, asphalt, cx, 0.1, cz).castShadow = false;
  for (let t = 5; t < len - 4; t += 3) {
    const x = alongX ? Math.min(x0, x1) + t : cx;
    const z = alongX ? cz : Math.min(z0, z1) + t;
    box(alongX ? 1.4 : 0.14, 0.02, alongX ? 0.14 : 1.4, stripeMat, x, 0.125, z).castShadow = false;
  }
}
// Loading bay box
for (const [w, d, x, z] of [[2.8, 0.12, 11.6, -1.3], [2.8, 0.12, 11.6, 4.6], [0.12, 6, 10.2, 1.65], [0.12, 6, 13, 1.65]]) {
  box(w, 0.02, d, stripeMat, x, 0.125, z).castShadow = false;
}

// Highway behind the factory with passing traffic
box(260, 0.04, 7, asphalt, 0, 0.02, -31).castShadow = false;
for (let x = -128; x < 128; x += 5) box(2, 0.02, 0.14, whiteLine, x, 0.05, -31).castShadow = false;
for (const z of [-27.6, -34.4]) box(260, 0.02, 0.12, whiteLine, 0, 0.05, z).castShadow = false;

// Staff car park
for (const z of [5.2, 7.8, 10.4, 13]) box(3.8, 0.02, 0.1, whiteLine, -12.9, 0.11, z).castShadow = false;

// ---------------------------------------------------------------------------
// Factory hall (open front so the line is visible)
// ---------------------------------------------------------------------------
const hall = new THREE.Group();
scene.add(hall);
const wallMat = mat(0xd8cbb4);
const trimMat = mat(0x8c3b2e);
const steelMat = mat(0x5a6370, { metalness: 0.6, roughness: 0.4 });
const windowMat = mat(0x9cc4e4, { metalness: 0.3, roughness: 0.15 });

const HALL = { x0: -10, x1: 6, z0: -5, z1: 5, h: 5 };

box(HALL.x1 - HALL.x0, HALL.h, 0.3, wallMat, (HALL.x0 + HALL.x1) / 2, HALL.h / 2, HALL.z0, hall); // back
box(0.3, HALL.h, HALL.z1 - HALL.z0, wallMat, HALL.x0, HALL.h / 2, 0, hall); // left
// Right wall with an opening for the conveyor
box(0.3, HALL.h, 3.5, wallMat, HALL.x1, HALL.h / 2, -3.25, hall);
box(0.3, HALL.h, 3.5, wallMat, HALL.x1, HALL.h / 2, 3.25, hall);
box(0.3, 2.2, 3, wallMat, HALL.x1, HALL.h - 1.1, 0, hall);
// Brick-red base trim
box(HALL.x1 - HALL.x0, 0.6, 0.35, trimMat, (HALL.x0 + HALL.x1) / 2, 0.3, HALL.z0, hall);
box(0.35, 0.6, HALL.z1 - HALL.z0, trimMat, HALL.x0, 0.3, 0, hall);

// Windows in the back and left walls
function wallWindow(x, y, z, alongX) {
  box(alongX ? 1.8 : 0.36, 1.0, alongX ? 0.36 : 1.8, windowMat, x, y, z, hall);
  box(alongX ? 0.06 : 0.4, 1.0, alongX ? 0.4 : 0.06, steelMat, x, y, z, hall);
  box(alongX ? 1.9 : 0.4, 0.08, alongX ? 0.4 : 1.9, steelMat, x, y - 0.5, z, hall);
}
for (const x of [-7.5, 4]) wallWindow(x, 3.4, HALL.z0, true);
wallWindow(HALL.x0, 3.4, -2.6, false);

// Roll-up door on the left wall
const rollTex = canvasTexture(64, 128, (g, w, h) => {
  g.fillStyle = '#9aa3ad';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#7d8691';
  for (let y = 0; y < h; y += 10) g.fillRect(0, y, w, 3);
});
box(0.36, 3, 2.4, new THREE.MeshStandardMaterial({ map: rollTex, metalness: 0.5, roughness: 0.5 }), HALL.x0, 1.5, 1.1, hall);
box(0.5, 0.25, 2.6, trimMat, HALL.x0, 3.1, 1.1, hall);

// Front columns, wall lamps and a fascia with the sign
for (let x = HALL.x0; x <= HALL.x1; x += 4) {
  box(0.35, HALL.h, 0.35, steelMat, x, HALL.h / 2, HALL.z1, hall);
  box(0.25, 0.12, 0.3, glow(0xfff0c8, 1.2), x, 3.6, HALL.z1 + 0.25, hall);
}
const signTex = canvasTexture(1024, 128, (g, w, h) => {
  g.fillStyle = '#8c3b2e';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#f6efe2';
  g.font = 'bold 84px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('LITTLE FACTORY CO.', w / 2, h / 2 + 4);
});
const fasciaMats = [trimMat, trimMat, trimMat, trimMat, mat(0xffffff, { map: signTex }), trimMat];
const fascia = new THREE.Mesh(new THREE.BoxGeometry(HALL.x1 - HALL.x0 + 0.4, 0.9, 0.3), fasciaMats);
fascia.position.set((HALL.x0 + HALL.x1) / 2, HALL.h - 0.45, HALL.z1 + 0.1);
fascia.castShadow = true;
hall.add(fascia);

// Hazard stripes either side of the conveyor and a walkway
const hazardTex = canvasTexture(128, 32, (g, w, h) => {
  g.fillStyle = '#f2c230';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#1e1e1e';
  for (let x = -h; x < w; x += 32) {
    g.beginPath();
    g.moveTo(x, h);
    g.lineTo(x + 16, h);
    g.lineTo(x + 16 + h, 0);
    g.lineTo(x + h, 0);
    g.fill();
  }
});
hazardTex.wrapS = THREE.RepeatWrapping;
hazardTex.repeat.set(16, 1);
for (const z of [-0.95, 0.95]) {
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(16, 0.25), new THREE.MeshStandardMaterial({ map: hazardTex }));
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0.5, 0.105, z);
  strip.receiveShadow = true;
  hall.add(strip);
}
box(15, 0.01, 0.8, mat(0x4f8a5a), -2, 0.105, -3.6, hall).castShadow = false;

// Control room in the front-left corner
const ctrl = new THREE.Group();
ctrl.position.set(-8.7, 0, 3.6);
hall.add(ctrl);
box(2.2, 0.2, 2.2, steelMat, 0, 2.3, 0, ctrl);
box(0.1, 2.2, 2.2, wallMat, -1.05, 1.1, 0, ctrl);
box(2.2, 1.0, 0.1, wallMat, 0, 0.5, -1.05, ctrl);
box(0.1, 1.0, 2.2, wallMat, 1.05, 0.5, 0, ctrl);
box(0.06, 1.2, 2.2, windowMat, 1.05, 1.6, 0, ctrl);
box(1.0, 0.08, 0.6, mat(0x6b4a2f), 0.3, 0.8, -0.5, ctrl);
const monitor = box(0.5, 0.35, 0.05, glow(0x55d6ff, 0.9), 0.3, 1.05, -0.7, ctrl);
monitor.rotation.y = 0.2;

// Wall clock that shows the real time, and a safety board
const wallClock = new THREE.Group();
wallClock.position.set(-3, 3.6, HALL.z0 + 0.17);
hall.add(wallClock);
const clockFace = canvasTexture(256, 256, (g, w) => {
  g.fillStyle = '#fbf8f1';
  g.beginPath();
  g.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#222';
  for (let i = 0; i < 12; i++) {
    g.save();
    g.translate(w / 2, w / 2);
    g.rotate((i / 12) * Math.PI * 2);
    g.fillRect(-4, -118, 8, i % 3 === 0 ? 28 : 16);
    g.restore();
  }
  g.font = 'bold 26px system-ui';
  g.textAlign = 'center';
  g.fillText('LFC', w / 2, w / 2 + 52);
});
const face = new THREE.Mesh(new THREE.CircleGeometry(0.55, 32), new THREE.MeshStandardMaterial({ map: clockFace }));
wallClock.add(face);
const rim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 8, 32), trimMat);
wallClock.add(rim);
function hand(len, width, color) {
  const geo = boxGeo(width, len, 0.02);
  geo.translate(0, len / 2 - 0.05, 0);
  const m = new THREE.Mesh(geo, mat(color));
  m.position.z = 0.03;
  wallClock.add(m);
  return m;
}
const hourHand = hand(0.3, 0.05, 0x222222);
const minuteHand = hand(0.45, 0.035, 0x222222);
const secondHand = hand(0.5, 0.015, 0xd83a2e);
function updateClock() {
  const now = new Date();
  const s = now.getSeconds() + now.getMilliseconds() / 1000;
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  secondHand.rotation.z = -(s / 60) * Math.PI * 2;
  minuteHand.rotation.z = -(m / 60) * Math.PI * 2;
  hourHand.rotation.z = -(h / 12) * Math.PI * 2;
}
const board = new THREE.Mesh(
  new THREE.PlaneGeometry(2.4, 1.0),
  new THREE.MeshStandardMaterial({
    map: canvasTexture(512, 214, (g, w, h) => {
      g.fillStyle = '#1d6b3a';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 8;
      g.strokeRect(10, 10, w - 20, h - 20);
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      g.font = 'bold 34px system-ui';
      g.fillText('DAYS WITHOUT A', w / 2, 62);
      g.fillText('CAT INCIDENT', w / 2, 102);
      g.fillStyle = '#f2c230';
      g.font = 'bold 74px system-ui';
      g.fillText('0', w / 2, 182);
    }),
  }),
);
board.position.set(0.6, 3.5, HALL.z0 + 0.16);
hall.add(board);

// Sawtooth roof: sloped panels, skylights and spinning vent turbines
const roof = new THREE.Group();
hall.add(roof);
const roofMat = mat(0x6d7682, { metalness: 0.3, roughness: 0.6 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0xaad4ff, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1 });
const TOOTH = 4;
const RISE = 1.4;
const roofDepth = HALL.z1 - HALL.z0 + 0.6;
const vents = [];
for (let x = HALL.x0; x < HALL.x1; x += TOOTH) {
  const len = Math.hypot(TOOTH, RISE);
  const slope = box(len, 0.12, roofDepth, roofMat, x + TOOTH / 2, HALL.h + RISE / 2, 0, roof);
  slope.rotation.z = Math.atan2(RISE, TOOTH);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.06, RISE, roofDepth - 0.2), glassMat);
  glass.position.set(x + TOOTH, HALL.h + RISE / 2, 0);
  roof.add(glass);
  const vx = x + 2.4;
  const vy = HALL.h + (RISE * 2.4) / TOOTH;
  cylinder(0.18, 0.22, 0.4, steelMat, vx, vy + 0.2, 2.6, roof, 10);
  const head = cylinder(0.32, 0.25, 0.35, mat(0xc9ced4, { metalness: 0.7, roughness: 0.3, flatShading: true }), vx, vy + 0.55, 2.6, roof, 9);
  vents.push(head);
}

// Chimney with ladder, warning light and tap-to-summon secret
const chimney = new THREE.Group();
scene.add(chimney);
const CHIMNEY = new THREE.Vector3(-8, 0, -3.2);
chimney.position.copy(CHIMNEY);
cylinder(0.55, 0.7, 9, mat(0x9a4a3a), 0, 4.5, 0, chimney);
cylinder(0.62, 0.62, 0.4, mat(0x333333), 0, 9.1, 0, chimney);
for (let y = 2; y < 9; y += 2) cylinder(0.72, 0.72, 0.15, M.white, 0, y, 0, chimney);
for (const x of [-0.18, 0.18]) box(0.04, 8.2, 0.04, steelMat, x, 4.6, 0.76, chimney);
for (let y = 0.8; y < 8.6; y += 0.4) box(0.36, 0.03, 0.03, steelMat, 0, y, 0.76, chimney);
const beaconRed = glow(0xff2020, 0);
part(chimney, sphereGeo(0.12), beaconRed, 0, 9.4, 0);

// Storage silos and pipes into the hall
const siloMat = mat(0xc9ced4, { metalness: 0.5, roughness: 0.35 });
for (const x of [-4, -1, 2]) {
  cylinder(1.2, 1.2, 6, siloMat, x, 3, -8);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.9, 20), siloMat);
  cap.position.set(x, 6.45, -8);
  cap.castShadow = true;
  scene.add(cap);
  for (const y of [1.5, 3, 4.5]) cylinder(1.23, 1.23, 0.08, steelMat, x, y, -8);
  const pipe = cylinder(0.14, 0.14, 1.7, steelMat, x + 0.6, 4.2, -5.95, scene, 10);
  pipe.rotation.x = Math.PI / 2;
}
box(7, 0.2, 0.4, steelMat, -1, 6.2, -8);

// Barrels and pallets beside the hall
for (const [x, z, c] of [[-11.6, -3.6, 0x2f6fb0], [-12.3, -3.6, 0x2f6fb0], [-11.9, -2.9, 0xd83a2e], [-12.6, -2.9, 0x2f6fb0]]) {
  cylinder(0.3, 0.3, 0.9, mat(c, { metalness: 0.4, roughness: 0.5 }), x, 0.55, z, scene, 14);
}
const palletMat = mat(0xa07a4c);
for (let i = 0; i < 4; i++) box(1.2, 0.14, 1.0, palletMat, -12.2, 0.17 + i * 0.16, -1.2);

// ---------------------------------------------------------------------------
// Conveyor belt
// ---------------------------------------------------------------------------
const BELT = { x0: -7.5, x1: 8.6, z: 0, top: 1.0, width: 1.1 };
const beltLen = BELT.x1 - BELT.x0;
const beltTex = canvasTexture(256, 64, (g, w, h) => {
  g.fillStyle = '#2b2d31';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#3c3f45';
  for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 10, h);
});
beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping;
beltTex.repeat.set(beltLen / 1.2, 1);
box(beltLen, 0.08, BELT.width, mat(0xffffff, { map: beltTex, roughness: 0.9 }), (BELT.x0 + BELT.x1) / 2, BELT.top - 0.04, BELT.z);
const railMat = mat(0xe0a526, { metalness: 0.4, roughness: 0.5 });
for (const side of [-1, 1]) {
  box(beltLen, 0.22, 0.08, railMat, (BELT.x0 + BELT.x1) / 2, BELT.top - 0.05, BELT.z + side * (BELT.width / 2 + 0.04));
}
const rollers = [];
const rollerMat = mat(0x9aa3ad, { metalness: 0.8, roughness: 0.3 });
for (let x = BELT.x0 + 0.2; x < BELT.x1; x += 0.6) {
  const r = cylinder(0.09, 0.09, BELT.width, rollerMat, x, BELT.top - 0.16, BELT.z, scene, 10);
  r.rotation.x = Math.PI / 2;
  rollers.push(r);
}
for (let x = BELT.x0 + 0.4; x < BELT.x1; x += 2.2) {
  for (const side of [-1, 1]) box(0.1, BELT.top - 0.2, 0.1, steelMat, x, (BELT.top - 0.2) / 2, BELT.z + side * 0.45);
}
// Emergency stop button on a post
box(0.1, 1.1, 0.1, steelMat, 2, 0.55, 0.85);
box(0.22, 0.16, 0.22, mat(0xf2c230), 2, 1.15, 0.85);
cylinder(0.07, 0.07, 0.07, glow(0xd83a2e, 0.3), 2, 1.26, 0.85, scene, 12);

// ---------------------------------------------------------------------------
// Stamping press at the start of the line
// ---------------------------------------------------------------------------
const press = new THREE.Group();
press.position.set(BELT.x0 + 0.6, 0, BELT.z);
scene.add(press);
const pressMat = mat(0x2f6fb0, { metalness: 0.3, roughness: 0.5 });
for (const side of [-1, 1]) box(0.3, 3.6, 0.3, pressMat, 0, 1.8, side * 0.85, press);
box(0.9, 0.6, 2.0, pressMat, 0, 3.6, 0, press);
cylinder(0.12, 0.12, 0.8, M.chrome, 0, 3.1, 0, press, 12);
const ram = box(0.75, 0.5, 0.75, mat(0x9aa3ad, { metalness: 0.8, roughness: 0.3 }), 0, 2.6, 0, press);
const warningLight = new THREE.Mesh(sphereGeo(0.14, 12, 8), glow(0xff7a00, 0));
warningLight.position.set(0, 4.05, 0);
press.add(warningLight);
box(0.5, 0.7, 0.4, mat(0x33373d), 0.6, 1.4, 1.2, press); // control panel
box(0.04, 0.3, 0.3, glow(0x55ff8a, 0.6), 0.86, 1.5, 1.2, press);

// ---------------------------------------------------------------------------
// Crates (about one in eight comes out golden)
// ---------------------------------------------------------------------------
const CRATE = 0.6;
const crateTex = canvasTexture(128, 128, (g, w, h) => {
  g.fillStyle = '#b07a43';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#7a4f26';
  g.lineWidth = 10;
  g.strokeRect(5, 5, w - 10, h - 10);
  g.beginPath();
  g.moveTo(10, 10);
  g.lineTo(w - 10, h - 10);
  g.stroke();
  g.fillStyle = 'rgba(60,35,10,0.6)';
  g.font = 'bold 26px system-ui';
  g.textAlign = 'center';
  g.fillText('LFC', w / 2 + 18, h / 2 - 14);
});
const crateGeo = new THREE.BoxGeometry(CRATE, CRATE, CRATE);
const crateMat = mat(0xffffff, { map: crateTex });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xffc83a, metalness: 1, roughness: 0.2, emissive: 0x6b4a00, emissiveIntensity: 0.4 });

const beltCrates = [];
const BELT_SPEED = 1.3;
const CRATE_SPACING = 1.0;

function spawnCrate() {
  const golden = Math.random() < 0.125;
  const c = new THREE.Mesh(crateGeo, golden ? goldMat : crateMat);
  c.userData.golden = golden;
  c.castShadow = true;
  c.receiveShadow = true;
  c.position.set(press.position.x, BELT.top + CRATE / 2, BELT.z);
  scene.add(c);
  beltCrates.push(c);
}

function updateBelt(dt) {
  beltTex.offset.x -= (BELT_SPEED * dt) / 1.2;
  for (const r of rollers) r.rotation.y -= (BELT_SPEED * dt) / 0.09;
  const endX = BELT.x1 - CRATE / 2 - 0.05;
  for (let i = 0; i < beltCrates.length; i++) {
    const c = beltCrates[i];
    const limit = i === 0 ? endX : beltCrates[i - 1].position.x - CRATE_SPACING;
    c.position.x = Math.min(c.position.x + BELT_SPEED * dt, limit);
  }
}

// ---------------------------------------------------------------------------
// Delivery route and houses
// ---------------------------------------------------------------------------
const CORNER_R = 3.5;
const route = new THREE.CurvePath();
const routeCorners = [];
{
  const v = ([x, z]) => new THREE.Vector3(x, 0, z);
  let cursor = v(ROUTE_PTS[0]);
  for (let i = 1; i < ROUTE_PTS.length; i++) {
    const p = v(ROUTE_PTS[i]);
    if (i === ROUTE_PTS.length - 1) {
      route.add(new THREE.LineCurve3(cursor, p));
      break;
    }
    const dIn = p.clone().sub(cursor).normalize();
    const dOut = v(ROUTE_PTS[i + 1]).sub(p).normalize();
    const a = p.clone().addScaledVector(dIn, -CORNER_R);
    const b = p.clone().addScaledVector(dOut, CORNER_R);
    route.add(new THREE.LineCurve3(cursor, a));
    route.add(new THREE.QuadraticBezierCurve3(a, p, b));
    cursor = b;
  }
  const lengths = route.getCurveLengths();
  route.curves.forEach((c, i) => {
    if (c.isQuadraticBezierCurve3) routeCorners.push([lengths[i - 1], lengths[i]]);
  });
}
const ROUTE_LEN = route.getLength();
const routePoint = (s) => route.getPoint(THREE.MathUtils.clamp(s, 0, ROUTE_LEN) / ROUTE_LEN);
function routeHeading(s) {
  const a = routePoint(Math.max(s - 0.1, 0));
  const b = routePoint(Math.min(s + 0.1, ROUTE_LEN));
  return b.sub(a).normalize();
}
function closestS(target) {
  let best = 0;
  let bestD = Infinity;
  for (let s = 0; s <= ROUTE_LEN; s += 0.05) {
    const d = routePoint(s).distanceToSquared(target);
    if (d < bestD) [best, bestD] = [s, d];
  }
  return best;
}

const HOUSE_SPECS = [
  { x: 20, z: 21, rot: Math.PI, street: [20, 14], wall: 0xf3e3c3, roof: 0xb5523b, car: 0xd83a2e },
  { x: 31, z: 21, rot: Math.PI, street: [31, 14], wall: 0xcfe0d8, roof: 0x4d5d6c },
  { x: 49, z: 6, rot: -Math.PI / 2, street: [42, 6], wall: 0xf0c9c0, roof: 0x7a3b2e },
  { x: 49, z: -6, rot: -Math.PI / 2, street: [42, -6], wall: 0xb9cbef, roof: 0x3f4f7a, car: 0x2fa36b, gnome: true },
  { x: 31, z: -21, rot: 0, street: [31, -14], wall: 0xf6edb5, roof: 0x8c5a2b },
  { x: 20, z: -21, rot: 0, street: [20, -14], wall: 0xe2d4f0, roof: 0x5b4a6e },
];
const houses = HOUSE_SPECS.map((spec, i) => {
  const h = buildHouse({ wall: spec.wall, roof: spec.roof, number: i + 1 });
  h.group.position.set(spec.x, 0, spec.z);
  h.group.rotation.y = spec.rot;
  scene.add(h.group);
  // A tree in each back garden
  cylinder(0.15, 0.2, 1.2, mat(0x6b4a2f), 0, 0.6, 0, h.group, 8).position.set(-1.4, 0.6, -3.4);
  part(h.group, new THREE.IcosahedronGeometry(1.0, 0), mat(0x3f7d3a), -1.4, 1.8, -3.4);
  if (spec.car) {
    box(2.2, 0.04, 4.6, mat(0xcfc8bb), -3.2, 0.03, 2.6, h.group).castShadow = false;
    const car = buildCar(spec.car);
    car.group.position.set(-3.2, 0, 2.5);
    h.group.add(car.group);
  }
  if (spec.gnome) {
    const gnome = buildGnome();
    gnome.position.set(1.3, 0, -2.6);
    gnome.rotation.y = Math.PI;
    h.group.add(gnome);
    onTap(gnome, () => {
      say('Shhh!', gnome, 1.4);
      chirp('triangle', 900, 1400, 0.15, 0.04);
    });
  }
  h.group.updateMatrixWorld(true);
  return { ...h, spec, s: closestS(new THREE.Vector3(spec.street[0], 0, spec.street[1])), parcel: null };
});
houses.sort((a, b) => a.s - b.s);

// Street lamps around the block
function streetLamp(x, z, faceX, faceZ) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = Math.atan2(faceX, faceZ);
  scene.add(g);
  cylinder(0.07, 0.1, 3.4, steelMat, 0, 1.7, 0, g, 8);
  box(0.06, 0.06, 0.8, steelMat, 0, 3.35, 0.4, g);
  box(0.3, 0.12, 0.4, glow(0xfff0c0, 1.0), 0, 3.28, 0.8, g);
}
for (const x of [16, 26, 36]) {
  streetLamp(x, 16.6, 0, -1);
  streetLamp(x, -16.6, 0, 1);
}
for (const z of [-10, 0, 10]) streetLamp(44.6, z, -1, 0);

// ---------------------------------------------------------------------------
// Park in the middle of the block: pond, duck, cow, benches
// ---------------------------------------------------------------------------
box(22, 0.04, 21, mat(0x8cbc63, { roughness: 1 }), 27.5, 0.02, 0).castShadow = false;
const POND = new THREE.Vector3(29, 0, 1);
const water = new THREE.Mesh(new THREE.CircleGeometry(3.4, 40), new THREE.MeshStandardMaterial({ color: 0x3f8fd0, roughness: 0.1, metalness: 0.2 }));
water.rotation.x = -Math.PI / 2;
water.position.set(POND.x, 0.06, POND.z);
scene.add(water);
const pondRim = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.18, 6, 40), mat(0x9a9590));
pondRim.rotation.x = Math.PI / 2;
pondRim.position.set(POND.x, 0.06, POND.z);
scene.add(pondRim);
for (const [x, z] of [[27, 1.5], [30.5, -0.3]]) {
  const pad = new THREE.Mesh(new THREE.CircleGeometry(0.4, 12), mat(0x3f8a3a));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(x, 0.07, z);
  scene.add(pad);
}

const duck = buildDuck();
scene.add(duck);
let duckSpin = 0;
onTap(duck, () => {
  duckSpin = 1;
  say('Quack!', duck, 1.1);
  chirp('sawtooth', 520, 260, 0.18, 0.05);
});

function bench(x, z, rotY) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);
  const wood = mat(0x8a5a32);
  box(1.6, 0.08, 0.45, wood, 0, 0.45, 0, g);
  box(1.6, 0.35, 0.06, wood, 0, 0.7, -0.22, g);
  for (const s of [-0.7, 0.7]) box(0.06, 0.45, 0.4, M.dark, s, 0.22, 0, g);
}
bench(29, -3.8, 0);
bench(24.6, 1, Math.PI / 2);

const trunkMat = mat(0x6b4a2f);
const leafMat = mat(0x3f7d3a);
const leafMat2 = mat(0x5a9a3c);
function tree(x, z, s = 1, leaves = leafMat) {
  cylinder(0.15 * s, 0.2 * s, 1.2 * s, trunkMat, x, 0.6 * s, z, scene, 8);
  const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * s, 0), leaves);
  top.position.set(x, 1.9 * s, z);
  top.castShadow = true;
  scene.add(top);
}
for (const [x, z, s] of [[19, -6, 1.1], [19.5, 6, 1.2], [37, 7, 1.0], [37.5, -7.5, 1.3], [22, 8.5, 0.9], [33.5, 8.5, 0.8]]) tree(x, z, s, leafMat2);
for (const [x, z, s] of [[-18, -6, 1.3], [-17, 4, 1], [-19, 12, 1.4], [-6, -13, 1.2], [6, -12, 1], [-12, 18, 1.2], [3, 19, 1], [56, 14, 1.3], [56, -15, 1.1], [12, 25, 1.2], [40, 26, 1], [12, -24, 1.1], [42, -25, 1.3]]) tree(x, z, s);

// Flower bed
const flowerColors = [0xe0457b, 0xf2c230, 0xffffff, 0x9b59d0, 0xff7a3a];
box(3, 0.12, 1.6, mat(0x5b3d26), 23, 0.06, -7.5).castShadow = false;
for (let i = 0; i < 24; i++) {
  part(scene, sphereGeo(0.11, 6, 5), mat(flowerColors[i % flowerColors.length]), 21.7 + (i % 8) * 0.37, 0.22, -8 + Math.floor(i / 8) * 0.5);
}

const cow = buildCow();
const COW_HOME = new THREE.Vector3(34, 0, -3);
cow.group.position.copy(COW_HOME);
cow.group.rotation.y = -0.8;
scene.add(cow.group);
onTap(cow.group, () => {
  say('Moo!', cow.group, 2.3);
  chirp('sawtooth', 160, 110, 0.6, 0.05);
});

// ---------------------------------------------------------------------------
// Truck: gets loaded by the robot, then delivers one parcel per house
// ---------------------------------------------------------------------------
const truckParts = buildTruck('OMAR 01');
const truck = truckParts.group;
scene.add(truck);
const BED_TOP = 0.99;
const truckSlots = [];
for (const z of [-1.0, 0.0, 1.0]) for (const x of [-0.45, 0.45]) truckSlots.push(new THREE.Vector3(x, BED_TOP + CRATE / 2, z));

const TRUCK_MAX = 7;
const ACCEL = 2.5;
const DECEL = 3;
const CORNER_V = 3;
const truckState = { mode: 'parked', loaded: [], s: 0, v: 0, stop: 0, timer: 0, dropped: false, departTimer: 0 };
let delivered = 0;
let goldenDelivered = 0;
const countEl = document.getElementById('count');
const goldEl = document.getElementById('gold');

function placeTruck() {
  const p = routePoint(truckState.s);
  const t = routeHeading(truckState.s);
  truck.position.set(p.x, 0, p.z);
  truck.rotation.y = Math.atan2(t.x, t.z);
}
placeTruck();
truck.updateMatrixWorld(true);

onTap(truck, () => {
  say('HONK!', truck, 3.6);
  chirp('square', 330, 300, 0.35, 0.05);
  chirp('square', 415, 380, 0.35, 0.05);
});

function truckReady() {
  return truckState.mode === 'parked' && truckState.loaded.length < truckSlots.length;
}

function speedLimit(s, target) {
  let lim = Math.min(TRUCK_MAX, Math.sqrt(2 * DECEL * Math.max(target - s, 0)) + 0.3);
  for (const [c0, c1] of routeCorners) {
    if (s >= c0 && s <= c1) lim = Math.min(lim, CORNER_V);
    else if (s < c0) lim = Math.min(lim, Math.sqrt(CORNER_V * CORNER_V + 2 * DECEL * (c0 - s)));
  }
  return lim;
}

const hops = []; // parcels flying from the truck to a porch
function dropParcel(house) {
  const crate = truckState.loaded.pop();
  if (!crate) return;
  scene.attach(crate);
  const to = house.group.localToWorld(house.porch.clone());
  hops.push({ crate, house, from: crate.position.clone(), to, t: 0 });
  chirp('sine', 700, 900, 0.12, 0.03);
}

const exhaustPos = new THREE.Vector3();
let exhaustTimer = 0;

function updateTruck(dt) {
  const st = truckState;
  const { indicators, tail, beacon } = truckParts;
  let braking = false;

  if (st.mode === 'parked') {
    if (st.loaded.length === truckSlots.length && !arm.busy) {
      st.departTimer += dt;
      if (st.departTimer > 1.0) {
        st.mode = 'driving';
        st.departTimer = 0;
        st.stop = 0;
        for (const h of houses) h.flag.rotation.x = 0;
      }
    }
  } else if (st.mode === 'driving') {
    const target = st.stop < houses.length ? houses[st.stop].s : ROUTE_LEN;
    const prev = st.v;
    st.v = Math.min(st.v + ACCEL * dt, speedLimit(st.s, target));
    braking = st.v < prev - 1e-4;
    let step = st.v * dt;
    if (st.s + step >= target) {
      step = target - st.s;
      st.s = target;
      st.v = 0;
      if (st.stop < houses.length) {
        st.mode = 'stopped';
        st.timer = 0;
        st.dropped = false;
      } else {
        st.mode = 'parked';
        st.s = 0;
      }
    } else {
      st.s += step;
    }
    for (const w of truckParts.wheels) w.rotation.x += step / 0.45;
    placeTruck();
  } else if (st.mode === 'stopped') {
    braking = true;
    st.timer += dt;
    if (st.timer > 0.4 && !st.dropped) {
      st.dropped = true;
      dropParcel(houses[st.stop]);
    }
    if (st.timer > 1.8) {
      st.stop++;
      st.mode = 'driving';
    }
  }

  // Lights: brake, indicators before turns, amber beacon while out on a run
  const out = st.mode !== 'parked';
  tail.emissiveIntensity = braking ? 2.2 : 0.4;
  const blinkOn = simTime * 2.5 % 1 < 0.5;
  let turn = 0;
  if (st.mode === 'driving') {
    const now = routeHeading(st.s);
    const ahead = routeHeading(Math.min(st.s + 7, ROUTE_LEN));
    turn = now.z * ahead.x - now.x * ahead.z;
  }
  indicators.left.emissiveIntensity = turn > 0.3 && blinkOn ? 2.5 : 0;
  indicators.right.emissiveIntensity = turn < -0.3 && blinkOn ? 2.5 : 0;
  beacon.emissiveIntensity = out && simTime * 3 % 1 < 0.5 ? 3 : 0;

  if (out) {
    exhaustTimer -= dt;
    if (exhaustTimer <= 0) {
      exhaustTimer = st.v > 0.5 && !braking ? 0.07 : 0.2;
      truckParts.exhaust.getWorldPosition(exhaustPos);
      exhaust.emit(exhaustPos, new THREE.Vector3((Math.random() - 0.5) * 0.3, 1.2, (Math.random() - 0.5) * 0.3), {
        life: 1.2, size0: 0.2, size1: 0.9, opacity: 0.5, color: 0x777777,
      });
    }
  }
}

function updateHops(dt) {
  for (let i = hops.length - 1; i >= 0; i--) {
    const h = hops[i];
    h.t = Math.min(h.t + dt / 0.9, 1);
    h.crate.position.lerpVectors(h.from, h.to, h.t);
    h.crate.position.y += Math.sin(h.t * Math.PI) * 2.2;
    h.crate.rotation.y = h.t * Math.PI * 2;
    if (h.t >= 1) {
      hops.splice(i, 1);
      h.crate.rotation.set(0, 0, 0);
      h.house.group.attach(h.crate);
      if (h.house.parcel) h.house.group.remove(h.house.parcel.crate);
      h.house.parcel = { crate: h.crate, t: 0 };
      delivered++;
      countEl.textContent = delivered;
      if (h.crate.userData.golden) {
        goldenDelivered++;
        goldEl.textContent = goldenDelivered;
        celebrate(h.to);
      }
    }
  }
}

// Each house: wait, open the door, pull the parcel inside, close, raise the mailbox flag
function updateHouses(dt) {
  for (const h of houses) {
    const p = h.parcel;
    if (!p) continue;
    p.t += dt;
    const t = p.t;
    h.door.rotation.y = 1.4 * (smoothstep(clamp01((t - 1.5) / 0.6)) - smoothstep(clamp01((t - 3.4) / 0.6)));
    if (t > 2.1) {
      const k = smoothstep(clamp01((t - 2.1) / 1.1));
      p.crate.position.set(h.porch.x, h.porch.y, h.porch.z - k * 1.6);
    }
    if (t > 3.3 && p.crate.parent) h.group.remove(p.crate);
    if (t > 4.0) {
      h.flag.rotation.x = -1.4 * smoothstep(clamp01((t - 4.0) / 0.4));
      if (t > 4.4) h.parcel = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Robot arm (2-link IK) moving crates from belt to truck
// ---------------------------------------------------------------------------
const ARM = { base: new THREE.Vector3(9.9, 0, -1.6), h: 1.25, l1: 1.7, l2: 1.6, grip: 0.42 };
const armRoot = new THREE.Group();
armRoot.position.copy(ARM.base);
scene.add(armRoot);
const armOrange = mat(0xf08a1c, { metalness: 0.3, roughness: 0.45 });
const armDark = mat(0x33373d, { metalness: 0.5, roughness: 0.5 });
cylinder(0.55, 0.65, 0.3, armDark, 0, 0.15, 0, armRoot);
const yawG = new THREE.Group();
armRoot.add(yawG);
cylinder(0.4, 0.45, ARM.h - 0.3, armOrange, 0, 0.3 + (ARM.h - 0.3) / 2, 0, yawG);
const shoulder = new THREE.Group();
shoulder.position.y = ARM.h;
yawG.add(shoulder);
cylinder(0.28, 0.28, 0.6, armDark, 0, 0, 0, shoulder).rotation.x = Math.PI / 2;
box(ARM.l1, 0.32, 0.36, armOrange, ARM.l1 / 2, 0, 0, shoulder);
box(ARM.l1 * 0.8, 0.06, 0.37, armDark, ARM.l1 / 2, 0.1, 0, shoulder); // cable cover
const elbow = new THREE.Group();
elbow.position.x = ARM.l1;
shoulder.add(elbow);
cylinder(0.22, 0.22, 0.5, armDark, 0, 0, 0, elbow).rotation.x = Math.PI / 2;
box(ARM.l2, 0.24, 0.28, armOrange, ARM.l2 / 2, 0, 0, elbow);
const wrist = new THREE.Group();
wrist.position.x = ARM.l2;
elbow.add(wrist);
cylinder(0.14, 0.14, 0.2, armDark, 0, -0.1, 0, wrist);
box(0.5, 0.06, 0.5, armDark, 0, -0.22, 0, wrist);
part(wrist, sphereGeo(0.05, 8, 6), glow(0x55ff8a, 1), 0.2, -0.15, 0.2);
const fingers = [];
for (const side of [-1, 1]) fingers.push(box(0.05, 0.25, 0.3, armDark, side * 0.36, -0.36, 0, wrist));
const gripPoint = new THREE.Object3D();
gripPoint.position.y = -ARM.grip;
wrist.add(gripPoint);

function setPose(p) {
  yawG.rotation.y = p.yaw;
  shoulder.rotation.z = p.s;
  elbow.rotation.z = p.e;
  wrist.rotation.z = -(p.s + p.e); // keep the gripper pointing straight down
}

// Solve joint angles so the grip point lands on a world-space target
function ik(target) {
  const dx = target.x - ARM.base.x;
  const dz = target.z - ARM.base.z;
  const r = Math.hypot(dx, dz);
  const y = target.y + ARM.grip - ARM.h;
  const { l1, l2 } = ARM;
  const d = Math.min(Math.hypot(r, y), l1 + l2 - 1e-3);
  const e = -Math.acos(THREE.MathUtils.clamp((d * d - l1 * l1 - l2 * l2) / (2 * l1 * l2), -1, 1));
  const s = Math.atan2(y, r) - Math.atan2(l2 * Math.sin(e), l1 + l2 * Math.cos(e));
  return { yaw: Math.atan2(-dz, dx), s, e };
}

function lerpPose(a, b, t) {
  let dy = b.yaw - a.yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  return { yaw: a.yaw + dy * t, s: a.s + (b.s - a.s) * t, e: a.e + (b.e - a.e) * t };
}

// Home pose sits over the belt so the arm is clear of the truck lane
const HOME = ik(new THREE.Vector3(8.4, 2.8, -1.2));
const arm = { busy: false, pose: { ...HOME }, steps: [], step: 0, t: 0, from: null, held: null, grip: 0 };
setPose(HOME);

function startPick(crate) {
  beltCrates.shift();
  const slotIndex = truckState.loaded.length;
  const pickPos = crate.position.clone();
  pickPos.y += CRATE / 2;
  const abovePick = pickPos.clone().add(new THREE.Vector3(0, 0.9, 0));
  const dropPos = truck.localToWorld(truckSlots[slotIndex].clone());
  dropPos.y += CRATE / 2 + 0.02;
  const aboveDrop = dropPos.clone().add(new THREE.Vector3(0, 1.0, 0));

  arm.busy = true;
  arm.steps = [
    { pose: ik(abovePick), dur: 0.63 },
    { pose: ik(pickPos), dur: 0.35, grip: 1, end: () => { arm.held = crate; gripPoint.attach(crate); } },
    { pose: ik(abovePick), dur: 0.35 },
    { pose: ik(aboveDrop), dur: 0.77 },
    { pose: ik(dropPos), dur: 0.39, grip: 0, end: () => release(slotIndex) },
    { pose: ik(aboveDrop), dur: 0.32 },
    { pose: HOME, dur: 0.56 },
  ];
  arm.step = 0;
  arm.t = 0;
  arm.from = { ...arm.pose };
}

function release(slotIndex) {
  const c = arm.held;
  arm.held = null;
  truck.add(c);
  c.position.copy(truckSlots[slotIndex]);
  c.rotation.set(0, 0, 0);
  truckState.loaded.push(c);
}

function updateArm(dt) {
  if (!arm.busy) {
    const front = beltCrates[0];
    if (front && front.position.x >= BELT.x1 - CRATE / 2 - 0.06 && truckReady()) startPick(front);
  }
  if (arm.busy) {
    const step = arm.steps[arm.step];
    arm.t = Math.min(arm.t + dt / step.dur, 1);
    const k = smoothstep(arm.t);
    arm.pose = lerpPose(arm.from, step.pose, k);
    if (step.grip !== undefined) arm.grip = step.grip === 1 ? k : 1 - k;
    if (arm.t >= 1) {
      if (step.end) step.end();
      arm.from = { ...step.pose };
      arm.step++;
      arm.t = 0;
      if (arm.step >= arm.steps.length) arm.busy = false;
    }
  }
  setPose(arm.pose);
  fingers.forEach((f, i) => { f.position.x = (i ? 1 : -1) * (0.36 - 0.03 * arm.grip); });
}

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------
const walkers = [
  { ...buildPerson(0x2f6fb0), cx: -1, z: -2.8, amp: 4.5, speed: 0.25, phase: 0 },
  { ...buildPerson(0xd83a2e, 0xffffff), cx: -2, z: 2.6, amp: 3.5, speed: 0.2, phase: 2 },
];
for (const w of walkers) scene.add(w.group);
const spotter = buildPerson(0x3b8f4a);
spotter.group.position.set(8.2, 0.1, 3.4);
spotter.group.rotation.y = Math.PI / 2;
scene.add(spotter.group);
onTap(spotter.group, () => say('Hi!', spotter.group, 2.2));

function updateWorkers(time) {
  for (const w of walkers) {
    const a = time * w.speed + w.phase;
    const x = w.cx + Math.sin(a) * w.amp;
    const vx = Math.cos(a);
    w.group.position.set(x, 0.1, w.z);
    w.group.rotation.y = vx > 0 ? Math.PI / 2 : -Math.PI / 2;
    const swing = Math.sin(time * 7 + w.phase) * 0.5;
    w.legs[0].rotation.x = swing;
    w.legs[1].rotation.x = -swing;
    w.arms[0].rotation.x = -swing * 0.8;
    w.arms[1].rotation.x = swing * 0.8;
  }
  // The spotter waves the truck off on each run
  const waving = truckState.mode !== 'parked' && truckState.s < 12;
  spotter.arms[1].rotation.z = waving ? 2.6 + Math.sin(time * 10) * 0.35 : 0;
  spotter.arms[0].rotation.x = waving ? 0 : -0.3;
}

// ---------------------------------------------------------------------------
// Forklift driving laps around the yard
// ---------------------------------------------------------------------------
const forklift = new THREE.Group();
scene.add(forklift);
const yellow = mat(0xf2c230, { roughness: 0.5 });
box(1.1, 0.6, 1.6, yellow, 0, 0.55, 0, forklift);
box(1.1, 0.5, 0.5, M.dark, 0, 0.9, -0.6, forklift); // counterweight
for (const x of [-0.5, 0.5]) for (const z of [-0.6, 0.55]) box(0.06, 1.3, 0.06, M.dark, x, 1.5, z * 0.95, forklift);
box(1.1, 0.06, 1.3, M.dark, 0, 2.15, 0, forklift); // cage roof
box(0.5, 0.1, 0.5, mat(0x222222), 0, 1.0, -0.1, forklift); // seat
part(forklift, sphereGeo(0.08, 8, 6), glow(0xffa000, 1), 0, 2.25, -0.5);
for (const x of [-0.35, 0.35]) box(0.08, 1.9, 0.08, steelMat, x, 1.05, 0.88, forklift); // mast
const driver = buildPerson(0x2f6fb0);
driver.group.position.set(0, 0.35, -0.1);
driver.group.scale.setScalar(0.85);
for (const l of driver.legs) l.rotation.x = -1.4;
forklift.add(driver.group);
const forks = new THREE.Group();
forklift.add(forks);
for (const x of [-0.25, 0.25]) box(0.12, 0.05, 1.0, steelMat, x, 0, 1.4, forks);
box(1.0, 0.12, 0.9, palletMat, 0, 0.08, 1.4, forks);
box(0.9, 0.6, 0.8, mat(0x5a8f3c), 0, 0.44, 1.4, forks); // cargo
const flWheels = [];
for (const z of [-0.5, 0.5]) for (const side of [-1, 1]) {
  const w = cylinder(0.25, 0.25, 0.2, M.tire, side * 0.6, 0.25, z, forklift, 12);
  w.rotation.z = Math.PI / 2;
  flWheels.push(w);
}
const flPath = (u) => new THREE.Vector3(-2.5 + Math.cos(u) * 6.5, 0, 9 + Math.sin(u) * 2.2);
let flU = 0;

function updateForklift(dt, time) {
  flU += dt * 0.28;
  const p = flPath(flU);
  const ahead = flPath(flU + 0.01);
  forklift.position.copy(p);
  forklift.rotation.y = Math.atan2(ahead.x - p.x, ahead.z - p.z);
  forks.position.y = 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(time * 0.9));
  for (const w of flWheels) w.rotation.x += dt * 4;
}

// ---------------------------------------------------------------------------
// Cars: staff car park and highway traffic
// ---------------------------------------------------------------------------
const staffCars = [0x2f6fb0, 0xe8e8e8, 0xd83a2e].map((c, i) => {
  const car = buildCar(c);
  car.group.position.set(-12.9, 0.1, 6.5 + i * 2.6);
  car.group.rotation.y = -Math.PI / 2;
  scene.add(car.group);
  return car;
});

const cat = buildCat();
cat.group.position.set(0, 1.35, -0.2);
staffCars[1].group.add(cat.group);
let catHop = 0;
onTap(cat.group, () => {
  catHop = 1;
  say('Meow!', cat.group, 1.0);
  chirp('sine', 700, 1100, 0.12, 0.05);
  setTimeout(() => chirp('sine', 1100, 600, 0.25, 0.05), 120);
});

const traffic = [0xf2c230, 0x8e44ad, 0x16a085, 0xe67e22, 0x34495e, 0xc0392b].map((c, i) => {
  const car = buildCar(c);
  const dir = i % 2 ? -1 : 1;
  scene.add(car.group);
  car.group.rotation.y = dir * Math.PI / 2;
  car.group.position.set(-110 + i * 38, 0.04, dir > 0 ? -29.3 : -32.7);
  return { ...car, dir, speed: 9 + (i % 3) * 2.5 };
});

function updateTraffic(dt) {
  for (const c of traffic) {
    c.group.position.x += c.dir * c.speed * dt;
    if (c.group.position.x > 120) c.group.position.x = -120;
    if (c.group.position.x < -120) c.group.position.x = 120;
    for (const w of c.wheels) w.rotation.x += (c.speed * dt) / 0.33;
  }
}

// ---------------------------------------------------------------------------
// Particles: chimney smoke, truck exhaust, fireworks
// ---------------------------------------------------------------------------
const smoke = new Particles(scene, 60);
const exhaust = new Particles(scene, 40);
const sparks = new Particles(scene, 300);
let smokeTimer = 0;
const smokeSource = new THREE.Vector3(CHIMNEY.x, 9.4, CHIMNEY.z);
let rainbowSmoke = 0;

function updateSmoke(dt) {
  smokeTimer -= dt;
  if (smokeTimer <= 0) {
    smokeTimer = 0.15;
    const color = rainbowSmoke > 0 ? new THREE.Color().setHSL((simTime * 0.5) % 1, 0.8, 0.65) : 0xdddddd;
    smoke.emit(smokeSource, new THREE.Vector3(0.55 + (Math.random() - 0.5) * 0.3, 1.1, (Math.random() - 0.5) * 0.3), {
      life: 6, size0: 0.8, size1: 4.8, opacity: 0.75, color,
    });
  }
  rainbowSmoke = Math.max(0, rainbowSmoke - dt);
}

const fireworkQueue = [];
function celebrate(at) {
  for (let i = 0; i < 4; i++) fireworkQueue.push({ when: simTime + i * 0.45, at: at.clone() });
}
function updateFireworks() {
  for (let i = fireworkQueue.length - 1; i >= 0; i--) {
    const f = fireworkQueue[i];
    if (simTime < f.when) continue;
    fireworkQueue.splice(i, 1);
    const center = f.at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 7 + Math.random() * 3, (Math.random() - 0.5) * 4));
    const color = [0xff4d6d, 0x4dd2ff, 0xffe14d, 0x7dff6a, 0xd17dff][Math.floor(Math.random() * 5)];
    for (let k = 0; k < 60; k++) {
      const dir = new THREE.Vector3().randomDirection().multiplyScalar(4 + Math.random() * 2);
      sparks.emit(center, dir, { life: 1.6, size0: 0.8, size1: 0.25, opacity: 1, color, gravity: 3 });
    }
    chirp('triangle', 200 + Math.random() * 100, 60, 0.4, 0.04);
  }
}

// ---------------------------------------------------------------------------
// Secret: tap the chimney three times
// ---------------------------------------------------------------------------
const ufo = buildUfo();
ufo.group.visible = false;
scene.add(ufo.group);
const ufoState = { active: false, t: 0 };
let chimneyTaps = [];
onTap(chimney, () => {
  chimneyTaps = chimneyTaps.filter((t) => simTime - t < 3);
  chimneyTaps.push(simTime);
  rainbowSmoke = 4;
  if (chimneyTaps.length >= 3 && !ufoState.active) {
    chimneyTaps = [];
    ufoState.active = true;
    ufoState.t = 0;
    ufo.group.visible = true;
    chirp('sine', 300, 1200, 1.2, 0.04);
  }
});

const UFO_START = new THREE.Vector3(80, 45, -60);
const UFO_END = new THREE.Vector3(-70, 50, 60);
const HOVER_Y = 9;
function updateUfo(dt) {
  if (!ufoState.active) return;
  ufoState.t += dt;
  const t = ufoState.t;
  const hover = new THREE.Vector3(COW_HOME.x, HOVER_Y + Math.sin(t * 2) * 0.2, COW_HOME.z);
  const g = ufo.group;
  if (t < 4) g.position.lerpVectors(UFO_START, hover, smoothstep(t / 4));
  else if (t < 17) g.position.copy(hover);
  else g.position.lerpVectors(hover, UFO_END, smoothstep(clamp01((t - 17) / 4)));
  g.rotation.y += dt * 1.5;
  ufo.lights.forEach((l, i) => { l.emissiveIntensity = (Math.floor(t * 6) + i) % 3 === 0 ? 3 : 0.4; });

  // Beam the cow up, keep it a moment, then return it
  const beamOn = (t > 4 && t < 9) || (t > 11.5 && t < 16.5);
  ufo.beam.material.opacity += ((beamOn ? 0.35 : 0) - ufo.beam.material.opacity) * Math.min(dt * 6, 1);
  const beamLen = HOVER_Y - 0.2;
  ufo.beam.scale.set(1, beamLen, 1);
  ufo.beam.position.y = -beamLen / 2;
  let lift = 0;
  if (t > 5 && t < 8.5) lift = smoothstep((t - 5) / 3.5);
  else if (t >= 8.5 && t < 12) lift = 1;
  else if (t >= 12 && t < 16) lift = 1 - smoothstep((t - 12) / 4);
  cow.group.position.set(COW_HOME.x, lift * (HOVER_Y - 1.4), COW_HOME.z);
  cow.group.visible = lift < 0.98;
  cow.group.rotation.y = -0.8 + lift * 6;
  if (t > 21.5) {
    ufoState.active = false;
    g.visible = false;
    cow.group.position.copy(COW_HOME);
    cow.group.rotation.y = -0.8;
    cow.group.visible = true;
  }
}

// ---------------------------------------------------------------------------
// Tapping, buttons and keys
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || performance.now() - down.t > 600) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(tappables, true)[0];
  let o = hit?.object;
  while (o && !o.userData.onTap) o = o.parent;
  o?.userData.onTap();
});

let paused = false;
let follow = false;
const pauseBtn = document.getElementById('pauseBtn');
const roofBtn = document.getElementById('roofBtn');
const followBtn = document.getElementById('followBtn');
function togglePause() {
  paused = !paused;
  pauseBtn.textContent = paused ? 'Resume' : 'Pause';
}
function toggleRoof() {
  roof.visible = !roof.visible;
  roofBtn.textContent = roof.visible ? 'Hide roof' : 'Show roof';
}
function toggleFollow() {
  follow = !follow;
  followBtn.textContent = follow ? 'Stop following' : 'Follow truck';
  followBtn.setAttribute('aria-pressed', String(follow));
  if (follow) {
    // Jump in closer, looking down at the truck from behind the overview angle
    const dir = new THREE.Vector3(-0.3, 0.75, 0.6).normalize();
    controls.target.copy(truck.position).setY(1);
    camera.position.copy(controls.target).addScaledVector(dir, 18);
  }
}
pauseBtn.addEventListener('click', togglePause);
roofBtn.addEventListener('click', toggleRoof);
followBtn.addEventListener('click', toggleFollow);
for (const b of [pauseBtn, roofBtn, followBtn]) b.addEventListener('keydown', (e) => e.stopPropagation());
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    togglePause();
    e.preventDefault();
  }
  if (e.code === 'KeyR') toggleRoof();
  if (e.code === 'KeyF') toggleFollow();
});

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const PRESS_PERIOD = 3.4;
const timeScale = Number(new URLSearchParams(location.search).get('speed')) || 1;
let simTime = 0;
let lastPressPhase = 0;
const clock = new THREE.Clock();

function updatePress() {
  const phase = (simTime % PRESS_PERIOD) / PRESS_PERIOD;
  // Fast stroke down, slow return up
  const stroke = phase < 0.15 ? smoothstep(phase / 0.15) : 1 - smoothstep((phase - 0.15) / 0.85);
  ram.position.y = 2.6 - stroke * (2.6 - (BELT.top + CRATE + 0.25));
  warningLight.material.emissiveIntensity = phase < 0.2 ? 2 : 0.2;
  if (lastPressPhase < 0.15 && phase >= 0.15) {
    const last = beltCrates[beltCrates.length - 1];
    if (!last || last.position.x - press.position.x > CRATE_SPACING) spawnCrate();
  }
  lastPressPhase = phase;
}

function updateCritters(dt, time) {
  // Duck paddles round the pond
  const a = time * 0.35;
  duck.position.set(POND.x + Math.cos(a) * 2, 0.08 + Math.sin(time * 3) * 0.02, POND.z + Math.sin(a) * 2);
  duckSpin = Math.max(0, duckSpin - dt);
  duck.rotation.y = -a + duckSpin * Math.PI * 4;

  // Sleeping cat: slow breathing and a lazy tail; hops when tapped
  catHop = Math.max(0, catHop - dt * 1.6);
  cat.group.position.y = 1.35 + Math.sin(catHop * Math.PI) * 0.8;
  cat.group.scale.y = 1 + Math.sin(time * 1.5) * 0.04;
  cat.tail.rotation.y = Math.sin(time * 1.2) * 0.5;

  // Grazing cow
  cow.head.rotation.x = 0.5 + Math.sin(time * 0.8) * 0.35;
  cow.tail.rotation.z = Math.sin(time * 2.2) * 0.4;
}

function tick() {
  const raw = clock.getDelta();
  const dt = paused ? 0 : Math.min(raw, 0.05) * timeScale;
  simTime += dt;

  updatePress();
  updateBelt(dt);
  updateArm(dt);
  updateTruck(dt);
  updateHops(dt);
  updateHouses(dt);
  updateForklift(dt, simTime);
  updateWorkers(simTime);
  updateTraffic(dt);
  updateCritters(dt, simTime);
  updateUfo(dt);
  updateSmoke(dt);
  updateFireworks();
  smoke.update(dt);
  exhaust.update(dt);
  sparks.update(dt);
  updateClock();

  for (const v of vents) v.rotation.y += dt * 3;
  beaconRed.emissiveIntensity = simTime % 1.5 < 0.2 ? 3 : 0.1;

  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.age += 1 / 60;
    b.obj.getWorldPosition(b.sprite.position);
    b.sprite.position.y += b.height + b.age * 0.3;
    b.sprite.material.opacity = 1 - clamp01((b.age - 1.2) / 0.4);
    if (b.age > 1.6) {
      scene.remove(b.sprite);
      bubbles.splice(i, 1);
    }
  }

  if (follow) {
    const want = truck.position.clone().setY(1);
    const delta = want.sub(controls.target).multiplyScalar(1 - Math.exp(-dt * 4 / Math.max(timeScale, 1)));
    controls.target.add(delta);
    camera.position.add(delta);
  }

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
