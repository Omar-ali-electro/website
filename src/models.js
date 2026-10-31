import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
export const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts });
export const glow = (color, intensity = 1) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });

export const boxGeo = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cylGeo = (rTop, rBottom, h, segments = 16) => new THREE.CylinderGeometry(rTop, rBottom, h, segments);
export const sphereGeo = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);

export function part(parent, geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function textTexture(text, { w = 256, h = 64, bg = '#ffffff', fg = '#222222', font = 'bold 40px system-ui, sans-serif' } = {}) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

export const M = {
  dark: mat(0x222428),
  glass: new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.6, roughness: 0.1 }),
  chrome: mat(0xd5d9de, { metalness: 0.9, roughness: 0.25 }),
  tire: mat(0x1a1a1a, { roughness: 0.9 }),
  hub: mat(0xcccccc, { metalness: 0.7 }),
  headlight: glow(0xfff6cc, 0.8),
  white: mat(0xf4f1ea),
};

function wheel(parent, r, width, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  part(g, cylGeo(r, r, width, 18), M.tire).rotation.z = Math.PI / 2;
  part(g, cylGeo(r * 0.5, r * 0.5, width + 0.02, 10), M.hub).rotation.z = Math.PI / 2;
  return g;
}

// Soft round sprite used for smoke, exhaust and fireworks
export const puffTexture = canvasTexture(64, 64, (g, w, h) => {
  const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
});

export class Particles {
  constructor(parent, count, blending = THREE.NormalBlending) {
    this.items = [];
    this.next = 0;
    for (let i = 0; i < count; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: puffTexture, transparent: true, depthWrite: false, blending }),
      );
      sprite.visible = false;
      parent.add(sprite);
      this.items.push({ sprite, age: 0, life: 1, vel: new THREE.Vector3(), size0: 1, size1: 1, opacity: 1, gravity: 0 });
    }
  }

  emit(pos, vel, { life = 2, size0 = 0.5, size1 = 1.5, opacity = 0.8, color = 0xffffff, gravity = 0 } = {}) {
    const p = this.items[this.next];
    this.next = (this.next + 1) % this.items.length;
    p.sprite.position.copy(pos);
    p.vel.copy(vel);
    Object.assign(p, { age: 0, life, size0, size1, opacity, gravity });
    p.sprite.material.color.set(color);
    p.sprite.visible = true;
  }

  update(dt) {
    for (const p of this.items) {
      if (!p.sprite.visible) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.sprite.visible = false;
        continue;
      }
      const k = p.age / p.life;
      p.vel.y -= p.gravity * dt;
      p.sprite.position.addScaledVector(p.vel, dt);
      const s = p.size0 + (p.size1 - p.size0) * k;
      p.sprite.scale.set(s, s, 1);
      p.sprite.material.opacity = p.opacity * (1 - k);
    }
  }
}

export function makeBubble(text) {
  const tex = canvasTexture(256, 112, (g, w) => {
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#222';
    g.lineWidth = 6;
    g.beginPath();
    g.roundRect(6, 6, w - 12, 78, 24);
    g.moveTo(110, 84);
    g.lineTo(128, 106);
    g.lineTo(146, 84);
    g.fill();
    g.stroke();
    g.fillStyle = '#222';
    g.font = 'bold 44px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, 47);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.scale.set(2, 0.875, 1);
  s.renderOrder = 10;
  return s;
}

// ---------------------------------------------------------------------------
// Delivery truck (faces +z, bed centred on the origin)
// ---------------------------------------------------------------------------
export function buildTruck(plateText) {
  const g = new THREE.Group();
  const blue = mat(0x2a5d8f, { metalness: 0.35, roughness: 0.45 });
  const orange = mat(0xf08a1c, { roughness: 0.5 });
  const bedMetal = mat(0x8a8f96, { metalness: 0.5 });

  part(g, boxGeo(1.9, 0.25, 4.8), M.dark, 0, 0.75, 0.6); // chassis
  part(g, boxGeo(2.0, 0.12, 3.2), bedMetal, 0, 0.93, 0); // bed floor
  for (const side of [-1, 1]) {
    part(g, boxGeo(0.08, 0.3, 3.2), blue, side * 0.96, 1.14, 0);
    part(g, boxGeo(0.1, 0.08, 3.2), M.chrome, side * 0.96, 1.48, 0);
    for (const z of [-1.5, -0.5, 0.5, 1.5]) part(g, boxGeo(0.1, 0.5, 0.1), blue, side * 0.96, 1.22, z);
    // mud flaps behind the rear wheels
    part(g, boxGeo(0.35, 0.35, 0.03), M.dark, side * 0.95, 0.45, -1.55);
  }
  part(g, boxGeo(2.0, 0.4, 0.08), blue, 0, 1.18, -1.56); // tailgate
  part(g, boxGeo(2.0, 1.2, 0.12), blue, 0, 1.6, 1.62); // headboard
  for (const x of [-0.6, 0, 0.6]) part(g, boxGeo(0.05, 1.1, 0.04), M.chrome, x, 1.62, 1.56);

  // Cab
  part(g, boxGeo(2.0, 1.0, 1.45), blue, 0, 1.35, 2.48);
  part(g, boxGeo(1.9, 0.75, 1.15), blue, 0, 2.2, 2.35);
  part(g, boxGeo(2.02, 0.1, 1.47), orange, 0, 0.95, 2.48); // stripe
  part(g, boxGeo(1.7, 0.58, 0.04), M.glass, 0, 2.2, 2.93); // windshield
  for (const side of [-1, 1]) part(g, boxGeo(0.04, 0.48, 0.8), M.glass, side * 0.955, 2.22, 2.45);
  for (const x of [-0.5, 0, 0.5]) part(g, boxGeo(0.14, 0.06, 0.08), glow(0xffb020, 0.7), x, 2.6, 2.85); // roof marker lights

  const logo = canvasTexture(256, 160, (c, w, h) => {
    c.fillStyle = '#2a5d8f';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#f08a1c';
    c.beginPath();
    c.arc(60, 80, 46, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    c.font = 'bold 44px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('LF', 60, 82);
    c.font = 'bold 30px system-ui, sans-serif';
    c.textAlign = 'left';
    c.fillText('LITTLE', 118, 62);
    c.fillText('FACTORY', 118, 100);
  });
  for (const side of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.62), new THREE.MeshStandardMaterial({ map: logo, roughness: 0.6 }));
    door.position.set(side * 1.006, 1.38, 2.45);
    door.rotation.y = side * Math.PI / 2;
    g.add(door);
  }

  part(g, boxGeo(1.3, 0.55, 0.05), M.dark, 0, 1.3, 3.22); // grille
  for (const y of [1.15, 1.3, 1.45]) part(g, boxGeo(1.25, 0.04, 0.03), M.chrome, 0, y, 3.25);
  part(g, boxGeo(2.1, 0.22, 0.2), M.chrome, 0, 0.78, 3.28); // bumper
  for (const side of [-1, 1]) {
    part(g, boxGeo(0.32, 0.2, 0.05), M.headlight, side * 0.8, 1.3, 3.23);
    part(g, boxGeo(0.25, 0.04, 0.04), M.dark, side * 1.1, 2.0, 2.95); // mirror arm
    part(g, boxGeo(0.06, 0.32, 0.18), M.dark, side * 1.24, 2.0, 2.95); // mirror
  }

  // Indicators keyed by the side they sit on: +x is the truck's left
  const indicators = { left: glow(0xffa000, 0), right: glow(0xffa000, 0) };
  const tail = glow(0xff2a1a, 0.4);
  for (const side of [-1, 1]) {
    const m = side > 0 ? indicators.left : indicators.right;
    part(g, boxGeo(0.2, 0.1, 0.05), m, side * 0.8, 1.08, 3.23);
    part(g, boxGeo(0.14, 0.12, 0.05), m, side * 0.55, 0.82, -1.83);
    part(g, boxGeo(0.3, 0.15, 0.05), tail, side * 0.8, 0.82, -1.83);
  }

  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.2),
    new THREE.MeshStandardMaterial({ map: textTexture(plateText, { w: 256, h: 80, bg: '#f7d43b', fg: '#1a1a1a', font: 'bold 52px monospace' }) }),
  );
  plate.position.set(0, 0.78, -1.84);
  plate.rotation.y = Math.PI;
  g.add(plate);

  const beaconMat = glow(0xffa000, 0);
  part(g, cylGeo(0.12, 0.14, 0.16, 12), beaconMat, 0, 2.66, 2.2);

  part(g, cylGeo(0.07, 0.07, 1.4, 10), M.chrome, -0.85, 2.2, 1.72); // exhaust stack
  const exhaust = new THREE.Object3D();
  exhaust.position.set(-0.85, 2.95, 1.72);
  g.add(exhaust);
  const tank = part(g, cylGeo(0.22, 0.22, 0.8, 14), M.chrome, 0.85, 0.62, 1.4);
  tank.rotation.x = Math.PI / 2;

  const wheels = [];
  for (const z of [-1.0, 0.2, 2.5]) for (const side of [-1, 1]) wheels.push(wheel(g, 0.45, 0.35, side * 0.95, 0.45, z));

  return { group: g, wheels, tail, indicators, beacon: beaconMat, exhaust };
}

// ---------------------------------------------------------------------------
// Small car (faces +z)
// ---------------------------------------------------------------------------
export function buildCar(color) {
  const g = new THREE.Group();
  const paint = mat(color, { metalness: 0.4, roughness: 0.35 });
  part(g, boxGeo(1.7, 0.5, 3.6), paint, 0, 0.55, 0);
  part(g, boxGeo(1.5, 0.48, 1.9), M.glass, 0, 1.04, -0.15);
  part(g, boxGeo(1.56, 0.08, 1.7), paint, 0, 1.31, -0.2);
  for (const z of [1.82, -1.82]) part(g, boxGeo(1.75, 0.15, 0.15), M.chrome, 0, 0.4, z);
  const tail = glow(0xff2a1a, 0.5);
  for (const side of [-1, 1]) {
    part(g, boxGeo(0.35, 0.12, 0.04), M.headlight, side * 0.55, 0.64, 1.81);
    part(g, boxGeo(0.35, 0.12, 0.04), tail, side * 0.6, 0.66, -1.81);
    part(g, boxGeo(0.08, 0.1, 0.2), paint, side * 0.88, 1.0, 0.75); // side mirror
  }
  const wheels = [];
  for (const z of [-1.15, 1.15]) for (const side of [-1, 1]) wheels.push(wheel(g, 0.33, 0.25, side * 0.8, 0.33, z));
  return { group: g, wheels };
}

// ---------------------------------------------------------------------------
// Factory worker with a hard hat (faces +z)
// ---------------------------------------------------------------------------
export function buildPerson(shirt = 0x2f6fb0, hat = 0xf2c230) {
  const g = new THREE.Group();
  const pants = mat(0x2b3a55);
  const skin = mat(0xe0b48a);
  const shirtMat = mat(shirt);
  const legs = [];
  const arms = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, 0.7, 0);
    g.add(hip);
    part(hip, boxGeo(0.14, 0.7, 0.16), pants, 0, -0.35, 0);
    legs.push(hip);
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.27, 1.25, 0);
    g.add(shoulder);
    part(shoulder, boxGeo(0.11, 0.55, 0.12), shirtMat, 0, -0.27, 0);
    arms.push(shoulder);
  }
  part(g, boxGeo(0.42, 0.6, 0.24), shirtMat, 0, 1.0, 0);
  part(g, boxGeo(0.43, 0.07, 0.25), mat(0xd9e04a), 0, 1.08, 0); // hi-vis band
  part(g, sphereGeo(0.15), skin, 0, 1.48, 0);
  part(g, new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(hat), 0, 1.53, 0);
  part(g, cylGeo(0.21, 0.21, 0.03, 14), mat(hat), 0, 1.53, 0);
  return { group: g, legs, arms };
}

// ---------------------------------------------------------------------------
// House (front door faces +z). `porch` is where parcels get dropped.
// ---------------------------------------------------------------------------
export function buildHouse({ wall, roof, number, pathLen = 1.9, w = 4, d = 4, h = 2.4 }) {
  const g = new THREE.Group();
  const trim = M.white;
  part(g, boxGeo(w + 0.1, 0.25, d + 0.1), mat(0x8d8a84), 0, 0.12, 0);
  part(g, boxGeo(w, h, d), mat(wall), 0, 0.25 + h / 2, 0);
  const roofGeo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roofMesh = part(g, roofGeo, mat(roof), 0, 0.25 + h + 0.7, 0);
  roofMesh.scale.set(w + 0.6, 1.4, d + 0.6);
  part(g, boxGeo(0.4, 1.1, 0.4), mat(0x9a4a3a), w * 0.25, h + 1.1, -d * 0.15);

  // Door: a dark opening with a hinged door that swings inwards
  const front = d / 2;
  part(g, boxGeo(0.8, 1.5, 0.02), M.dark, 0, 1.0, front + 0.005);
  part(g, boxGeo(1.0, 0.1, 0.06), trim, 0, 1.8, front + 0.02);
  const door = new THREE.Group();
  door.position.set(-0.4, 0, front + 0.02);
  g.add(door);
  part(door, boxGeo(0.8, 1.5, 0.06), mat(0x7a3b2e), 0.4, 1.0, 0);
  part(door, sphereGeo(0.04, 8, 6), M.chrome, 0.68, 1.0, 0.05);

  const winMat = mat(0xbfdcf0, { metalness: 0.3, roughness: 0.15, emissive: 0xfff2c0, emissiveIntensity: 0.12 });
  const shutter = mat(roof);
  for (const x of [-w * 0.3, w * 0.3]) {
    part(g, boxGeo(0.8, 0.7, 0.04), winMat, x, 1.55, front + 0.01);
    part(g, boxGeo(0.04, 0.7, 0.06), trim, x, 1.55, front + 0.02);
    part(g, boxGeo(0.8, 0.04, 0.06), trim, x, 1.55, front + 0.02);
    for (const s of [-1, 1]) part(g, boxGeo(0.22, 0.72, 0.04), shutter, x + s * 0.52, 1.55, front + 0.02);
    part(g, boxGeo(0.9, 0.12, 0.25), mat(0x6b4a2f), x, 1.12, front + 0.12); // flower box
    [0xe0457b, 0xf2c230, 0xffffff].forEach((c, i) => part(g, sphereGeo(0.08, 8, 6), mat(c), x + (i - 1) * 0.3, 1.24, front + 0.12));
  }
  for (const side of [-1, 1]) part(g, boxGeo(0.04, 0.7, 1.0), winMat, side * (w / 2 + 0.01), 1.55, 0);

  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshStandardMaterial({ map: textTexture(String(number), { w: 64, h: 64, bg: '#1f2a36', fg: '#ffffff', font: 'bold 44px system-ui' }) }));
  plaque.position.set(0.65, 1.55, front + 0.02);
  g.add(plaque);

  part(g, boxGeo(1.6, 0.15, 0.9), mat(0xa39b8f), 0, 0.075, front + 0.45); // porch
  part(g, boxGeo(0.12, 0.12, 0.12), glow(0xffe2a0, 1.2), -0.62, 1.9, front + 0.06); // porch light
  part(g, boxGeo(0.9, 0.04, pathLen), mat(0xcfc8bb), 0, 0.03, front + 0.9 + pathLen / 2);
  for (const s of [-1, 1]) {
    for (let z = front + 1.1; z < front + 0.9 + pathLen; z += 0.45) {
      part(g, sphereGeo(0.2, 8, 6), mat(0x4f8a3e), s * 0.8, 0.15, z); // hedge
    }
  }

  // Mailbox with a flag that pops up once a parcel arrives
  const mbZ = front + 0.9 + pathLen - 0.3;
  part(g, boxGeo(0.08, 0.9, 0.08), mat(0x6b4a2f), 1.3, 0.45, mbZ);
  part(g, boxGeo(0.3, 0.25, 0.45), mat(0x3a6ea5, { metalness: 0.4 }), 1.3, 1.0, mbZ);
  const flag = new THREE.Group();
  flag.position.set(1.47, 0.95, mbZ - 0.1);
  g.add(flag);
  part(flag, boxGeo(0.03, 0.04, 0.3), mat(0xd83a2e), 0, 0, 0.15);
  part(flag, boxGeo(0.03, 0.14, 0.1), mat(0xd83a2e), 0, 0.07, 0.25);

  return { group: g, door, flag, porch: new THREE.Vector3(0.0, 0.45, front + 0.5) };
}

// ---------------------------------------------------------------------------
// Critters and secrets
// ---------------------------------------------------------------------------
export function buildCat() {
  const g = new THREE.Group();
  const fur = mat(0xe08a3c);
  const stripe = mat(0xa6581f);
  part(g, sphereGeo(0.2), fur, 0, 0.14, 0).scale.set(1, 0.7, 1.6);
  for (const z of [-0.15, 0, 0.15]) part(g, boxGeo(0.14, 0.03, 0.05), stripe, 0, 0.27, z);
  const head = new THREE.Group();
  head.position.set(0, 0.2, 0.32);
  g.add(head);
  part(head, sphereGeo(0.14), fur);
  for (const s of [-1, 1]) {
    part(head, new THREE.ConeGeometry(0.05, 0.1, 4), fur, s * 0.07, 0.14, 0);
    part(head, boxGeo(0.05, 0.012, 0.01), M.dark, s * 0.05, 0.02, 0.135); // sleepy eyes
  }
  part(head, sphereGeo(0.025, 6, 4), mat(0xe58a9a), 0, -0.02, 0.14);
  const tail = new THREE.Group();
  tail.position.set(0, 0.12, -0.3);
  g.add(tail);
  part(tail, cylGeo(0.035, 0.03, 0.45, 6), fur, 0, 0, -0.22).rotation.x = Math.PI / 2;
  return { group: g, tail, head };
}

export function buildCow() {
  const g = new THREE.Group();
  const hide = canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#f5f2ea';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#1e1e1e';
    for (const [x, y, r] of [[30, 30, 18], [90, 50, 24], [50, 100, 20], [110, 110, 14], [10, 80, 10]]) {
      c.beginPath();
      c.ellipse(x, y, r, r * 0.7, 0.6, 0, Math.PI * 2);
      c.fill();
    }
  });
  const coat = new THREE.MeshStandardMaterial({ map: hide, roughness: 0.9 });
  part(g, boxGeo(0.9, 0.8, 1.7), coat, 0, 1.05, 0);
  for (const x of [-0.3, 0.3]) for (const z of [-0.6, 0.6]) part(g, boxGeo(0.18, 0.65, 0.18), coat, x, 0.33, z);
  part(g, sphereGeo(0.16, 10, 8), mat(0xf0a5b0), 0, 0.62, -0.3);
  const head = new THREE.Group();
  head.position.set(0, 1.25, 0.85);
  g.add(head);
  part(head, boxGeo(0.5, 0.5, 0.55), coat, 0, 0, 0.22);
  part(head, boxGeo(0.42, 0.25, 0.12), mat(0xf0a5b0), 0, -0.1, 0.52);
  for (const s of [-1, 1]) {
    part(head, cylGeo(0.03, 0.05, 0.25, 6), mat(0xe8e0c8), s * 0.2, 0.32, 0.15).rotation.z = -s * 0.5;
    part(head, boxGeo(0.2, 0.08, 0.12), coat, s * 0.32, 0.12, 0.1);
    part(head, sphereGeo(0.04, 6, 4), M.dark, s * 0.15, 0.08, 0.5);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 1.35, -0.86);
  g.add(tail);
  part(tail, cylGeo(0.025, 0.025, 0.7, 6), coat, 0, -0.35, 0);
  part(tail, sphereGeo(0.07, 6, 4), M.dark, 0, -0.72, 0);
  return { group: g, head, tail };
}

export function buildDuck() {
  const g = new THREE.Group();
  const yellow = mat(0xffd21f, { roughness: 0.35 });
  part(g, sphereGeo(0.25), yellow, 0, 0.12, 0).scale.set(1, 0.7, 1.3);
  part(g, sphereGeo(0.15), yellow, 0, 0.38, 0.2);
  const beak = part(g, new THREE.ConeGeometry(0.06, 0.16, 8), mat(0xff7a1a), 0, 0.36, 0.38);
  beak.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) part(g, sphereGeo(0.03, 6, 4), M.dark, s * 0.08, 0.43, 0.32);
  return g;
}

export function buildGnome() {
  const g = new THREE.Group();
  part(g, new THREE.ConeGeometry(0.22, 0.5, 12), mat(0x2f5fb0), 0, 0.25, 0);
  part(g, sphereGeo(0.13), mat(0xf0c09a), 0, 0.58, 0);
  const beard = part(g, new THREE.ConeGeometry(0.12, 0.28, 10), M.white, 0, 0.42, 0.08);
  beard.rotation.x = Math.PI;
  part(g, new THREE.ConeGeometry(0.15, 0.4, 12), mat(0xd83a2e), 0, 0.85, 0);
  part(g, sphereGeo(0.035, 6, 4), mat(0xe58a6a), 0, 0.57, 0.13);
  return g;
}

export function buildUfo() {
  const g = new THREE.Group();
  const hull = part(g, sphereGeo(2, 28, 14), mat(0xb8c2cc, { metalness: 0.85, roughness: 0.25 }));
  hull.scale.set(1, 0.26, 1);
  part(g, new THREE.SphereGeometry(0.95, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x9ff7ff, transparent: true, opacity: 0.45, roughness: 0.05 }), 0, 0.3, 0);
  // Pilot
  part(g, sphereGeo(0.32, 12, 10), mat(0x7ddc5a), 0, 0.62, 0);
  for (const s of [-1, 1]) {
    part(g, sphereGeo(0.09, 8, 6), M.dark, s * 0.13, 0.7, 0.24).scale.set(1, 1.4, 0.6);
    part(g, cylGeo(0.015, 0.015, 0.3, 4), mat(0x7ddc5a), s * 0.12, 1.0, 0).rotation.z = -s * 0.3;
  }
  const lights = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const l = glow([0xff4d6d, 0x4dd2ff, 0xffe14d][i % 3], 1.5);
    part(g, sphereGeo(0.12, 8, 6), l, Math.cos(a) * 1.85, -0.05, Math.sin(a) * 1.85);
    lights.push(l);
  }
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 2.6, 1, 28, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x9effa0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
  );
  g.add(beam);
  return { group: g, beam, lights };
}
