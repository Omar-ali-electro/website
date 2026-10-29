import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
scene.fog = new THREE.Fog(0x9fc7e8, 45, 110);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(14, 14, 24);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(1, 1.5, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 6;
controls.maxDistance = 70;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------
scene.add(new THREE.HemisphereLight(0xdfefff, 0x6b7a4f, 0.9));

const sun = new THREE.DirectionalLight(0xfff2dd, 2.2);
sun.position.set(18, 30, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
sun.shadow.bias = -0.0005;
scene.add(sun);

for (const x of [-6, -1, 4]) {
  const lamp = new THREE.PointLight(0xffe2b0, 12, 12, 1.5);
  lamp.position.set(x, 4.2, 0);
  scene.add(lamp);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts });

function box(w, h, d, material, x = 0, y = 0, z = 0, parent = scene) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function cylinder(rTop, rBottom, h, material, x = 0, y = 0, z = 0, parent = scene, segments = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const smoothstep = (t) => t * t * (3 - 2 * t);

// ---------------------------------------------------------------------------
// Ground, yard, road
// ---------------------------------------------------------------------------
const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), mat(0x7fa35a, { roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const concrete = mat(0xb9b6ae, { roughness: 0.95 });
const pad = box(30, 0.1, 24, concrete, 0, 0.05, 2);
pad.castShadow = false;

const asphalt = mat(0x3d3f44, { roughness: 1 });
const road = box(5, 0.04, 110, asphalt, 11.6, 0.12, 50);
road.castShadow = false;
const stripeMat = mat(0xf2d14b);
for (let z = 10; z < 100; z += 4) {
  const s = box(0.15, 0.02, 2, stripeMat, 11.6, 0.145, z);
  s.castShadow = false;
}

// ---------------------------------------------------------------------------
// Factory hall (open front so the line is visible)
// ---------------------------------------------------------------------------
const hall = new THREE.Group();
scene.add(hall);
const wallMat = mat(0xd8cbb4);
const trimMat = mat(0x8c3b2e);
const steelMat = mat(0x5a6370, { metalness: 0.6, roughness: 0.4 });

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

// Front columns + fascia with a sign
for (let x = HALL.x0; x <= HALL.x1; x += 4) {
  box(0.35, HALL.h, 0.35, steelMat, x, HALL.h / 2, HALL.z1, hall);
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

// Sawtooth roof: sloped panels with vertical skylights
const roof = new THREE.Group();
hall.add(roof);
const roofMat = mat(0x6d7682, { metalness: 0.3, roughness: 0.6 });
const glassMat = new THREE.MeshStandardMaterial({
  color: 0xaad4ff, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1,
});
const TOOTH = 4;
const RISE = 1.4;
const roofDepth = HALL.z1 - HALL.z0 + 0.6;
for (let x = HALL.x0; x < HALL.x1; x += TOOTH) {
  const len = Math.hypot(TOOTH, RISE);
  const slope = box(len, 0.12, roofDepth, roofMat, x + TOOTH / 2, HALL.h + RISE / 2, 0, roof);
  slope.rotation.z = Math.atan2(RISE, TOOTH);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.06, RISE, roofDepth - 0.2), glassMat);
  glass.position.set(x + TOOTH, HALL.h + RISE / 2, 0);
  roof.add(glass);
}

// Chimney
const chimneyMat = mat(0x9a4a3a);
cylinder(0.55, 0.7, 9, chimneyMat, -8, 4.5, -3.2);
cylinder(0.62, 0.62, 0.4, mat(0x333333), -8, 9.1, -3.2);
for (let y = 2; y < 9; y += 2) cylinder(0.72, 0.72, 0.15, mat(0xe8e2d6), -8, y, -3.2, scene);

// Storage silos behind the hall
const siloMat = mat(0xc9ced4, { metalness: 0.5, roughness: 0.35 });
for (const [x, z] of [[-4, -8], [-1, -8], [2, -8]]) {
  cylinder(1.2, 1.2, 6, siloMat, x, 3, z);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.9, 20), siloMat);
  cap.position.set(x, 6.45, z);
  cap.castShadow = true;
  scene.add(cap);
}
box(7, 0.2, 0.4, steelMat, -1, 6.2, -8);

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
const belt = box(beltLen, 0.08, BELT.width, mat(0xffffff, { map: beltTex, roughness: 0.9 }),
  (BELT.x0 + BELT.x1) / 2, BELT.top - 0.04, BELT.z);
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
  for (const side of [-1, 1]) {
    box(0.1, BELT.top - 0.2, 0.1, steelMat, x, (BELT.top - 0.2) / 2, BELT.z + side * 0.45);
  }
}

// ---------------------------------------------------------------------------
// Stamping press at the start of the line
// ---------------------------------------------------------------------------
const press = new THREE.Group();
press.position.set(BELT.x0 + 0.6, 0, BELT.z);
scene.add(press);
const pressMat = mat(0x2f6fb0, { metalness: 0.3, roughness: 0.5 });
for (const side of [-1, 1]) box(0.3, 3.6, 0.3, pressMat, 0, 1.8, side * 0.85, press);
box(0.9, 0.6, 2.0, pressMat, 0, 3.6, 0, press);
const ram = box(0.75, 0.5, 0.75, mat(0x9aa3ad, { metalness: 0.8, roughness: 0.3 }), 0, 2.6, 0, press);
const warningLight = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff7a00, emissive: 0xff7a00, emissiveIntensity: 0 }));
warningLight.position.set(0, 4.05, 0);
press.add(warningLight);

// ---------------------------------------------------------------------------
// Crates
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
  g.strokeStyle = 'rgba(80,50,20,0.35)';
  g.lineWidth = 2;
  for (let y = 24; y < h; y += 24) {
    g.beginPath();
    g.moveTo(10, y);
    g.lineTo(w - 10, y);
    g.stroke();
  }
});
const crateGeo = new THREE.BoxGeometry(CRATE, CRATE, CRATE);
const crateMat = mat(0xffffff, { map: crateTex });

const beltCrates = []; // crates riding the belt, sorted front (largest x) first
const BELT_SPEED = 1.3;
const CRATE_SPACING = 1.0;

function spawnCrate() {
  const c = new THREE.Mesh(crateGeo, crateMat);
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
// Truck (gets loaded by the robot, drives off when full)
// ---------------------------------------------------------------------------
const truck = new THREE.Group();
const TRUCK_PARK_Z = 1.6;
truck.position.set(11.6, 0, TRUCK_PARK_Z);
scene.add(truck);
const truckBlue = mat(0x2a5d8f, { metalness: 0.3, roughness: 0.5 });
const darkMat = mat(0x222428);
box(2.0, 0.25, 4.8, darkMat, 0, 0.75, 0.6, truck); // chassis
box(2.0, 0.12, 3.2, mat(0x8a8f96, { metalness: 0.5 }), 0, 0.93, 0, truck); // bed floor
for (const side of [-1, 1]) box(0.08, 0.4, 3.2, truckBlue, side * 0.96, 1.18, 0, truck);
box(2.0, 0.4, 0.08, truckBlue, 0, 1.18, -1.56, truck);
box(2.0, 1.2, 0.12, truckBlue, 0, 1.6, 1.62, truck); // headboard
const cab = box(2.0, 1.5, 1.4, truckBlue, 0, 1.6, 2.5, truck);
box(1.8, 0.6, 0.05, new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.6, roughness: 0.1 }), 0, 1.95, 3.21, truck);
for (const side of [-1, 1]) {
  const lamp = box(0.3, 0.15, 0.05, new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffaa, emissiveIntensity: 0.6 }), side * 0.7, 1.1, 3.22, truck);
  lamp.castShadow = false;
}
const truckWheels = [];
const wheelMat = mat(0x1a1a1a, { roughness: 0.9 });
const hubMat = mat(0xcccccc, { metalness: 0.7 });
for (const z of [-1.0, 0.2, 2.5]) {
  for (const side of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(side * 0.95, 0.45, z);
    truck.add(w);
    const tire = cylinder(0.45, 0.45, 0.35, wheelMat, 0, 0, 0, w, 18);
    tire.rotation.z = Math.PI / 2;
    const hub = cylinder(0.2, 0.2, 0.37, hubMat, 0, 0, 0, w, 10);
    hub.rotation.z = Math.PI / 2;
    truckWheels.push(w);
  }
}
const BED_TOP = 0.99;
const truckSlots = [];
for (const z of [-1.0, 0.0, 1.0]) for (const x of [-0.45, 0.45]) truckSlots.push(new THREE.Vector3(x, BED_TOP + CRATE / 2, z));

const truckState = { mode: 'parked', loaded: [], timer: 0, speed: 0 };
let shipped = 0;
const countEl = document.getElementById('count');

function truckReady() {
  return truckState.mode === 'parked' && truckState.loaded.length < truckSlots.length;
}

function updateTruck(dt) {
  const s = truckState;
  let dz = 0;
  if (s.mode === 'parked') {
    if (s.loaded.length === truckSlots.length && arm.busy === false) {
      s.timer += dt;
      if (s.timer > 1.0) {
        s.mode = 'leaving';
        s.timer = 0;
        s.speed = 0;
      }
    }
  } else if (s.mode === 'leaving') {
    s.speed = Math.min(s.speed + 3 * dt, 9);
    dz = s.speed * dt;
    if (truck.position.z > 45) {
      shipped += s.loaded.length;
      countEl.textContent = shipped;
      for (const c of s.loaded) truck.remove(c);
      s.loaded = [];
      s.mode = 'returning';
      s.speed = 6;
    }
  } else if (s.mode === 'returning') {
    // Reverse back into the bay and ease in
    const remaining = truck.position.z - TRUCK_PARK_Z;
    s.speed = Math.max(Math.min(6, remaining * 1.2), 0.4);
    dz = -Math.min(s.speed * dt, remaining);
    if (remaining <= 0.001) {
      truck.position.z = TRUCK_PARK_Z;
      s.mode = 'parked';
    }
  }
  truck.position.z += dz;
  for (const w of truckWheels) w.rotation.x += dz / 0.45;
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
const sJoint = cylinder(0.28, 0.28, 0.6, armDark, 0, 0, 0, shoulder);
sJoint.rotation.x = Math.PI / 2;
box(ARM.l1, 0.32, 0.36, armOrange, ARM.l1 / 2, 0, 0, shoulder);
const elbow = new THREE.Group();
elbow.position.x = ARM.l1;
shoulder.add(elbow);
const eJoint = cylinder(0.22, 0.22, 0.5, armDark, 0, 0, 0, elbow);
eJoint.rotation.x = Math.PI / 2;
box(ARM.l2, 0.24, 0.28, armOrange, ARM.l2 / 2, 0, 0, elbow);
const wrist = new THREE.Group();
wrist.position.x = ARM.l2;
elbow.add(wrist);
cylinder(0.14, 0.14, 0.2, armDark, 0, -0.1, 0, wrist);
box(0.5, 0.06, 0.5, armDark, 0, -0.22, 0, wrist);
const fingers = [];
for (const side of [-1, 1]) {
  const f = box(0.05, 0.25, 0.3, armDark, side * 0.36, -0.36, 0, wrist);
  fingers.push(f);
}
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

const HOME = ik(new THREE.Vector3(10.6, 2.6, 0.2));
const arm = { busy: false, pose: { ...HOME }, steps: [], step: 0, t: 0, from: null, held: null, grip: 0 };
setPose(HOME);

function startPick(crate) {
  beltCrates.shift();
  const slotIndex = truckState.loaded.length;
  const pickPos = crate.position.clone();
  pickPos.y += CRATE / 2;
  const abovePick = pickPos.clone().add(new THREE.Vector3(0, 0.9, 0));
  const slotWorld = truck.localToWorld(truckSlots[slotIndex].clone());
  const dropPos = slotWorld.clone();
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
// Forklift driving laps around the yard
// ---------------------------------------------------------------------------
const forklift = new THREE.Group();
scene.add(forklift);
const yellow = mat(0xf2c230, { roughness: 0.5 });
box(1.1, 0.6, 1.6, yellow, 0, 0.55, 0, forklift);
box(1.1, 0.5, 0.5, darkMat, 0, 0.9, -0.6, forklift); // counterweight
for (const x of [-0.5, 0.5]) for (const z of [-0.6, 0.55]) box(0.06, 1.3, 0.06, darkMat, x, 1.5, z * 0.95, forklift);
box(1.1, 0.06, 1.3, darkMat, 0, 2.15, 0, forklift); // cage roof
for (const x of [-0.35, 0.35]) box(0.08, 1.9, 0.08, steelMat, x, 1.05, 0.88, forklift); // mast
const forks = new THREE.Group();
forklift.add(forks);
for (const x of [-0.25, 0.25]) box(0.12, 0.05, 1.0, steelMat, x, 0, 1.4, forks);
box(1.0, 0.7, 0.9, mat(0x5a8f3c), 0, 0.42, 1.4, forks); // cargo
const flWheels = [];
for (const z of [-0.5, 0.5]) for (const side of [-1, 1]) {
  const w = cylinder(0.25, 0.25, 0.2, wheelMat, side * 0.6, 0.25, z, forklift, 12);
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
// Chimney smoke
// ---------------------------------------------------------------------------
const smokeTex = canvasTexture(64, 64, (g, w, h) => {
  const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
});
const smoke = [];
for (let i = 0; i < 40; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xdddddd, transparent: true, depthWrite: false }));
  s.userData.age = (i / 40) * 6;
  smoke.push(s);
  scene.add(s);
}

function updateSmoke(dt) {
  for (const s of smoke) {
    s.userData.age += dt;
    if (s.userData.age > 6) {
      s.userData.age = 0;
      s.userData.jx = (Math.random() - 0.5) * 0.4;
      s.userData.jz = (Math.random() - 0.5) * 0.4;
    }
    const a = s.userData.age;
    s.position.set(-8 + a * 0.55 + (s.userData.jx || 0) * a, 9.4 + a * 1.1, -3.2 + (s.userData.jz || 0) * a);
    const size = 0.8 + a * 0.7;
    s.scale.set(size, size, 1);
    s.material.opacity = Math.max(0, 0.75 * (1 - a / 6));
  }
}

// ---------------------------------------------------------------------------
// Scenery: trees and fence
// ---------------------------------------------------------------------------
const trunkMat = mat(0x6b4a2f);
const leafMat = mat(0x3f7d3a);
function tree(x, z, s = 1) {
  cylinder(0.15 * s, 0.2 * s, 1.2 * s, trunkMat, x, 0.6 * s, z, scene, 8);
  const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * s, 0), leafMat);
  top.position.set(x, 1.9 * s, z);
  top.castShadow = true;
  scene.add(top);
}
for (const [x, z, s] of [[-18, -6, 1.3], [-17, 4, 1], [-19, 12, 1.4], [-6, -13, 1.2], [6, -12, 1], [18, -6, 1.3], [19, 6, 1.1], [-12, 18, 1.2], [3, 19, 1]]) tree(x, z, s);

const fenceMat = mat(0x9ba3ab, { metalness: 0.5 });
for (let x = -15; x <= 15; x += 1.5) {
  cylinder(0.04, 0.04, 1.2, fenceMat, x, 0.6, -10, scene, 6);
}
box(30, 0.05, 0.05, fenceMat, 0, 1.15, -10);
box(30, 0.05, 0.05, fenceMat, 0, 0.6, -10);

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let paused = false;
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { paused = !paused; e.preventDefault(); }
  if (e.code === 'KeyR') roof.visible = !roof.visible;
});

const PRESS_PERIOD = 3.4;
let simTime = 0;
let lastPressPhase = 0;
const clock = new THREE.Clock();
const timeScale = Number(new URLSearchParams(location.search).get('speed')) || 1;

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

function tick() {
  const dt = paused ? 0 : Math.min(clock.getDelta(), 0.05) * timeScale;
  if (paused) clock.getDelta();
  simTime += dt;

  updatePress();
  updateBelt(dt);
  updateArm(dt);
  updateTruck(dt);
  updateForklift(dt, simTime);
  updateSmoke(dt);

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
