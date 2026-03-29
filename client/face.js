/**
 * GLaDOS Face — Three.js 3D face loaded from GLTF.
 * Matrix-inspired green solid polygons with bone-driven jaw animation.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, clock, container;
let model, chinBone, pointLight;

// State
let state = 'idle';
let targetAmplitude = 0;
let currentAmplitude = 0;

// Colors
const COLOR_IDLE = new THREE.Color(0x006600);
const COLOR_SPEAKING = new THREE.Color(0x00ff41);
const COLOR_RECORDING = new THREE.Color(0x00bb33);
const COLOR_THINKING = new THREE.Color(0x00aa2a);
let currentColor = new THREE.Color().copy(COLOR_IDLE);
let targetColor = new THREE.Color().copy(COLOR_IDLE);

// All mesh materials (updated each frame)
let meshMaterials = [];

function init(containerEl) {
  container = containerEl;
  clock = new THREE.Clock();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 60, 220);
  camera.lookAt(0, 65, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);
  container.appendChild(renderer.domElement);

  // Green point light above the model
  pointLight = new THREE.PointLight(0x00ff41, 2, 300);
  pointLight.position.set(0, 120, 60);
  scene.add(pointLight);

  const ambientLight = new THREE.AmbientLight(0x001100, 0.3);
  scene.add(ambientLight);

  // Grid floor
  createGrid();

  // Load GLTF model
  const loader = new GLTFLoader();
  loader.load('assets/face.gltf', (gltf) => {
    model = gltf.scene;

    // Apply solid material with glow to all meshes
    model.traverse((child) => {
      if (child.isMesh) {
        const mat = new THREE.MeshPhongMaterial({
          color: COLOR_IDLE.clone(),
          emissive: new THREE.Color(0x003300),
          shininess: 100,
          transparent: true,
          opacity: 0.9,
        });
        child.material = mat;
        meshMaterials.push(mat);
      }
    });

    // Find chin bone for jaw animation
    model.traverse((child) => {
      if (child.isBone && child.name === 'chin') {
        chinBone = child;
        // Store rest quaternion to animate from
        // Bind pose = open mouth; derive closed by rotating chin upward
        chinBone.userData.openQuaternion = chinBone.quaternion.clone();
        const closeOffset = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, 0, 0));
        chinBone.userData.closedQuaternion = chinBone.quaternion.clone().multiply(closeOffset);
        // Start closed immediately
        chinBone.quaternion.copy(chinBone.userData.closedQuaternion);
        console.log('chin open Q:', chinBone.userData.openQuaternion.toArray());
        console.log('chin closed Q:', chinBone.userData.closedQuaternion.toArray());
      }
    });

    scene.add(model);
  });

  window.addEventListener('resize', onResize);
  animate();
}

function createGrid() {
  const gridSize = 400;
  const gridDivisions = 40;
  const gridMaterial = new THREE.LineBasicMaterial({
    color: 0x003b00,
    transparent: true,
    opacity: 0.3,
  });

  const vertices = [];
  const half = gridSize / 2;
  const step = gridSize / gridDivisions;

  for (let i = 0; i <= gridDivisions; i++) {
    const pos = -half + i * step;
    vertices.push(-half, 0, pos, half, 0, pos);
    vertices.push(pos, 0, -half, pos, 0, half);
  }

  const gridGeometry = new THREE.BufferGeometry();
  gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const grid = new THREE.LineSegments(gridGeometry, gridMaterial);
  grid.position.y = -30;
  scene.add(grid);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function setState(newState) {
  state = newState;
  switch (state) {
    case 'idle':
      targetColor.copy(COLOR_IDLE);
      break;
    case 'recording':
      targetColor.copy(COLOR_RECORDING);
      break;
    case 'thinking':
      targetColor.copy(COLOR_THINKING);
      break;
    case 'speaking':
      targetColor.copy(COLOR_SPEAKING);
      break;
  }
}

function setAmplitude(amp) {
  targetAmplitude = Math.min(1, Math.max(0, amp));
}

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // Smooth amplitude
  currentAmplitude += (targetAmplitude - currentAmplitude) * Math.min(1, dt * 12);

  // Smooth color transition
  currentColor.lerp(targetColor, Math.min(1, dt * 4));

  let rotationSpeed, intensity;

  switch (state) {
    case 'idle':
      rotationSpeed = 0.15;
      intensity = 0.4 + Math.sin(elapsed * 1.5) * 0.15;
      break;
    case 'recording':
      rotationSpeed = 0.25;
      // Pulsing effect
      intensity = 0.6 + Math.sin(elapsed * 3) * 0.2;
      break;
    case 'thinking':
      rotationSpeed = 0.4;
      // Blinking: rapid intensity oscillation
      intensity = 0.3 + Math.abs(Math.sin(elapsed * 5)) * 0.7;
      break;
    case 'speaking':
      rotationSpeed = 0.2;
      intensity = 0.7 + currentAmplitude * 0.3;
      break;
    default:
      rotationSpeed = 0.15;
      intensity = 0.4;
  }

  // Subtle idle wobble (no continuous rotation)
  if (model) {
    model.rotation.y = Math.sin(elapsed * 0.3) * 0.15;
  }

  // Jaw animation (chin bone) using quaternion slerp from rest pose
  if (chinBone && chinBone.userData.closedQuaternion) {
    if (state === 'speaking' && currentAmplitude > 0.05) {
      chinBone.quaternion.copy(chinBone.userData.closedQuaternion)
        .slerp(chinBone.userData.openQuaternion, Math.min(1, currentAmplitude * 1.5));
    } else {
      chinBone.quaternion.slerp(chinBone.userData.closedQuaternion, 0.2);
    }
  }

  // Apply color and intensity to materials
  const displayColor = currentColor.clone().multiplyScalar(intensity);
  const emissiveColor = currentColor.clone().multiplyScalar(intensity * 0.4);
  for (const mat of meshMaterials) {
    mat.color.copy(displayColor);
    mat.emissive.copy(emissiveColor);
  }

  // Point light reacts to state
  pointLight.color.copy(currentColor);
  pointLight.intensity = 1 + intensity * 3;

  renderer.render(scene, camera);
}

function resize() {
  onResize();
}

export const GladosOrb = { init, setState, setAmplitude, resize };
