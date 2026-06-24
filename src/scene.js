import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const CYAN = new THREE.Color(0x4df5ff);
const MAGENTA = new THREE.Color(0xff3ec8);
const VIOLET = new THREE.Color(0x8b5cf6);

const particleVertex = /* glsl */ `
  attribute float aSeed;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  varying vec3 vColor;

  void main() {
    vec3 pos = position;
    float t = uTime * 0.18 + aSeed * 6.2831853;
    pos.x += sin(t + aSeed * 12.0) * 0.55;
    pos.y += cos(t * 1.31 + aSeed * 5.0) * 0.55;
    pos.z += sin(t * 0.77 + aSeed * 9.0) * 0.55;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float size = uSize * uPixelRatio * (90.0 / -mvPosition.z);
    gl_PointSize = clamp(size, 1.0, 9.0);
    gl_Position = projectionMatrix * mvPosition;
    vColor = aColor;
  }
`;

const particleFragment = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float alpha = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, alpha * 0.5);
  }
`;

function buildParticles(count) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const radius = Math.pow(Math.random(), 0.5) * 17 + 1.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);

    seeds[i] = Math.random();

    const mix = Math.random();
    const base = mix < 0.15 ? VIOLET : CYAN;
    const c = base.clone().lerp(MAGENTA, mix < 0.15 ? mix * 2 : mix);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uSize: { value: 1.4 },
    },
    vertexShader: particleVertex,
    fragmentShader: particleFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}

function buildCore() {
  const group = new THREE.Group();

  const icoGeo = new THREE.IcosahedronGeometry(1.7, 1);
  const icoEdges = new THREE.EdgesGeometry(icoGeo);
  const ico = new THREE.LineSegments(
    icoEdges,
    new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.85 })
  );
  group.add(ico);

  const ringSpecs = [
    { r: 2.7, tube: 0.012, color: MAGENTA, rot: [Math.PI / 3, 0, 0] },
    { r: 3.3, tube: 0.009, color: VIOLET, rot: [-Math.PI / 4, Math.PI / 6, 0] },
    { r: 2.1, tube: 0.007, color: CYAN, rot: [Math.PI / 2.3, -Math.PI / 5, Math.PI / 8] },
  ];

  const rings = ringSpecs.map(({ r, tube, color, rot }) => {
    const geo = new THREE.TorusGeometry(r, tube, 8, 120);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.set(...rot);
    group.add(mesh);
    return mesh;
  });

  return { group, ico, rings };
}

export function createUniverse(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060c);
  scene.fog = new THREE.FogExp2(0x05060c, 0.05);

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 8);

  const isMobile = window.innerWidth < 768;
  const particles = buildParticles(isMobile ? 2800 : 7000);
  scene.add(particles);

  const { group: core, rings } = buildCore();
  scene.add(core);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.85,
    0.4,
    0.4
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  const pointer = { x: 0, y: 0 };
  const smoothPointer = { x: 0, y: 0 };

  function onPointerMove(e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }
  window.addEventListener('pointermove', onPointerMove);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloomPass.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  const cameraTarget = new THREE.Vector3(0, 0, 8);
  const lookTarget = new THREE.Vector3(0, 0, 0);

  let scrollRotation = 0;
  let autoRotY = 0;
  let autoRotX = 0;

  const clock = new THREE.Clock();

  function tick() {
    requestAnimationFrame(tick);
    const elapsed = clock.getElapsedTime();
    const delta = Math.min(clock.getDelta(), 0.05);

    particles.material.uniforms.uTime.value = elapsed;
    particles.rotation.y = scrollRotation * 0.6 + elapsed * 0.01;

    smoothPointer.x += (pointer.x - smoothPointer.x) * 0.04;
    smoothPointer.y += (pointer.y - smoothPointer.y) * 0.04;

    autoRotY += delta * 0.07;
    autoRotX += delta * 0.018;
    core.rotation.y = autoRotY + smoothPointer.x * 0.35;
    core.rotation.x = autoRotX + smoothPointer.y * 0.25;

    rings.forEach((mesh, i) => {
      mesh.rotation.z += delta * (0.05 + i * 0.02) * (i % 2 === 0 ? 1 : -1);
    });

    camera.position.x += (cameraTarget.x + smoothPointer.x * 0.5 - camera.position.x) * 0.05;
    camera.position.y += (cameraTarget.y - smoothPointer.y * 0.35 - camera.position.y) * 0.05;
    camera.position.z += (cameraTarget.z - camera.position.z) * 0.05;
    camera.lookAt(lookTarget);

    bloomPass.strength = 0.85 + Math.sin(elapsed * 0.6) * 0.06;

    composer.render();
  }
  tick();

  return {
    setCameraTarget({ x, y, z }) {
      if (x !== undefined) cameraTarget.x = x;
      if (y !== undefined) cameraTarget.y = y;
      if (z !== undefined) cameraTarget.z = z;
    },
    setScrollRotation(value) {
      scrollRotation = value;
    },
  };
}
