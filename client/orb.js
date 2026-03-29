/**
 * GLaDOS Orb — Three.js animated visualization.
 * Pulsating glowing sphere with Matrix aesthetics.
 */
const GladosOrb = (() => {
  let scene, camera, renderer;
  let orb, orbGlow, pointLight, ambientLight;
  let clock;
  let container;

  // State
  let state = 'idle'; // idle | recording | thinking | speaking
  let targetAmplitude = 0;
  let currentAmplitude = 0;

  // Color targets — Matrix green palette
  const COLOR_IDLE = new THREE.Color(0x003b00);
  const COLOR_SPEAKING = new THREE.Color(0x39ff14);
  const COLOR_RECORDING = new THREE.Color(0x00ff41);
  const COLOR_THINKING = new THREE.Color(0x00aa2a);
  let currentColor = new THREE.Color().copy(COLOR_IDLE);
  let targetColor = new THREE.Color().copy(COLOR_IDLE);

  function init(containerEl) {
    container = containerEl;
    clock = new THREE.Clock();

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.08);

    // Camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 5;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    // Grid floor
    createGrid();

    // Main orb
    const orbGeometry = new THREE.SphereGeometry(1, 64, 64);
    const orbMaterial = new THREE.MeshStandardMaterial({
      color: 0x001a00,
      emissive: COLOR_IDLE,
      emissiveIntensity: 0.6,
      metalness: 0.3,
      roughness: 0.4,
      transparent: true,
      opacity: 0.9,
    });
    orb = new THREE.Mesh(orbGeometry, orbMaterial);
    scene.add(orb);

    // Outer glow sphere
    const glowGeometry = new THREE.SphereGeometry(1.2, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: COLOR_IDLE,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
    });
    orbGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(orbGlow);

    // Lights
    pointLight = new THREE.PointLight(COLOR_IDLE, 2, 15);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    ambientLight = new THREE.AmbientLight(0x001100, 0.5);
    scene.add(ambientLight);

    // Resize handler
    window.addEventListener('resize', onResize);

    // Start loop
    animate();
  }

  function createGrid() {
    const gridSize = 40;
    const gridDivisions = 40;
    const gridMaterial = new THREE.LineBasicMaterial({
      color: 0x003b00,
      transparent: true,
      opacity: 0.3,
    });

    // Horizontal grid below the orb
    const gridGeometry = new THREE.BufferGeometry();
    const vertices = [];
    const half = gridSize / 2;
    const step = gridSize / gridDivisions;

    for (let i = 0; i <= gridDivisions; i++) {
      const pos = -half + i * step;
      vertices.push(-half, 0, pos, half, 0, pos);
      vertices.push(pos, 0, -half, pos, 0, half);
    }

    gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const grid = new THREE.LineSegments(gridGeometry, gridMaterial);
    grid.position.y = -3;
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

    // Base pulsation
    let pulseSpeed, pulseAmount, emissiveIntensity, glowOpacity;

    switch (state) {
      case 'idle':
        pulseSpeed = 1.5;
        pulseAmount = 0.03;
        emissiveIntensity = 0.4 + Math.sin(elapsed * pulseSpeed) * 0.15;
        glowOpacity = 0.06 + Math.sin(elapsed * pulseSpeed) * 0.02;
        break;
      case 'recording':
        pulseSpeed = 3;
        pulseAmount = 0.05 + currentAmplitude * 0.15;
        emissiveIntensity = 0.5 + currentAmplitude * 0.5;
        glowOpacity = 0.08 + currentAmplitude * 0.12;
        break;
      case 'thinking':
        pulseSpeed = 2.5;
        pulseAmount = 0.04;
        emissiveIntensity = 0.3 + Math.sin(elapsed * pulseSpeed) * 0.3;
        glowOpacity = 0.05 + Math.sin(elapsed * pulseSpeed) * 0.04;
        break;
      case 'speaking':
        pulseSpeed = 4;
        pulseAmount = 0.04 + currentAmplitude * 0.2;
        emissiveIntensity = 0.5 + currentAmplitude * 0.6;
        glowOpacity = 0.08 + currentAmplitude * 0.15;
        break;
      default:
        pulseSpeed = 1.5;
        pulseAmount = 0.03;
        emissiveIntensity = 0.4;
        glowOpacity = 0.06;
    }

    // Apply pulsation to orb scale
    const pulse = 1 + Math.sin(elapsed * pulseSpeed) * pulseAmount + currentAmplitude * 0.1;
    orb.scale.setScalar(pulse);
    orbGlow.scale.setScalar(pulse * 1.2);

    // Slow rotation
    orb.rotation.y += dt * 0.2;
    orb.rotation.x = Math.sin(elapsed * 0.5) * 0.1;

    // Apply colors
    orb.material.emissive.copy(currentColor);
    orb.material.emissiveIntensity = emissiveIntensity;
    orbGlow.material.color.copy(currentColor);
    orbGlow.material.opacity = glowOpacity;
    pointLight.color.copy(currentColor);
    pointLight.intensity = 1 + emissiveIntensity * 2;

    renderer.render(scene, camera);
  }

  return { init, setState, setAmplitude };
})();
