import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const container = document.getElementById("heroVisual");

if (container) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    1000,
  );

  camera.position.z = 8;

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);

  container.appendChild(renderer.domElement);

  // Main holographic core

  const coreGeometry = new THREE.IcosahedronGeometry(1.35, 2);

  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0x00eaff,
    wireframe: true,
  });

  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  scene.add(core);

  // Inner glowing sphere

  const innerGeometry = new THREE.IcosahedronGeometry(0.85, 2);

  const innerMaterial = new THREE.MeshBasicMaterial({
    color: 0x087cff,
    wireframe: true,
    transparent: true,
    opacity: 0.45,
  });

  const innerCore = new THREE.Mesh(innerGeometry, innerMaterial);
  scene.add(innerCore);

  // Rotating rings

  const rings = [];

  for (let i = 0; i < 3; i++) {
    const geometry = new THREE.TorusGeometry(2 + i * 0.25, 0.012, 12, 120);

    const material = new THREE.MeshBasicMaterial({
      color: 0x00eaff,
      transparent: true,
      opacity: 0.65 - i * 0.12,
    });

    const ring = new THREE.Mesh(geometry, material);

    ring.rotation.x = Math.PI / 2 + i * 0.45;
    ring.rotation.y = i * 0.6;

    scene.add(ring);
    rings.push(ring);
  }

  // Digital particles

  const particleCount = 450;
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 9;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 9;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 5;
  }

  const particleGeometry = new THREE.BufferGeometry();

  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3),
  );

  const particleMaterial = new THREE.PointsMaterial({
    color: 0x00eaff,
    size: 0.025,
    transparent: true,
    opacity: 0.8,
  });

  const particles = new THREE.Points(particleGeometry, particleMaterial);

  scene.add(particles);

  // Mouse interaction

  let mouseX = 0;
  let mouseY = 0;

  document.addEventListener("mousemove", (event) => {
    mouseX = (event.clientX / window.innerWidth - 0.5) * 0.5;
    mouseY = (event.clientY / window.innerHeight - 0.5) * 0.5;
  });

  // Animation

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();

    core.rotation.x += 0.003;
    core.rotation.y += 0.005;

    innerCore.rotation.x -= 0.004;
    innerCore.rotation.y += 0.006;

    rings.forEach((ring, index) => {
      ring.rotation.z += 0.002 * (index + 1);
      ring.rotation.x += 0.001;
    });

    particles.rotation.y = time * 0.025;

    core.position.y = Math.sin(time) * 0.08;

    scene.rotation.y += (mouseX - scene.rotation.y) * 0.025;
    scene.rotation.x += (mouseY - scene.rotation.x) * 0.025;

    renderer.render(scene, camera);
  }

  animate();

  // Responsive resizing

  window.addEventListener("resize", () => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
  });
}

// Initialize button

const startButton = document.getElementById("startBtn");

if (startButton) {
  startButton.addEventListener("click", () => {
    document.getElementById("simulation")?.scrollIntoView({
      behavior: "smooth",
    });
  });
}
