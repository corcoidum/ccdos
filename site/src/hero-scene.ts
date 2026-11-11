// Hero 3D 장식. main.ts가 화면이 뜬 뒤 dynamic import로 불러오므로 첫 로딩에는 포함되지 않는다.
// 공통 규칙: 평소에는 별가루처럼 아주 느리게 흐르고, pointer가 올라왔을 때만 깨어난다.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Clock,
  Color,
  Group,
  LineBasicMaterial,
  LineLoop,
  PerspectiveCamera,
  Plane,
  Points,
  PointsMaterial,
  Raycaster,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

export type OrbitKey = "hope" | "trust" | "mercy" | "love";

type OrbitSpec = { key: OrbitKey; radius: number; speed: number; tilt: number; phase: number };

// 안쪽부터 H.OPE → T.RUST → M.ERCY → L.OVE. 반지름은 3:2 무대에 맞춘 값이다.
const ORBITS: OrbitSpec[] = [
  { key: "hope", radius: 1.9, speed: 0.3, tilt: 0, phase: 0.4 },
  { key: "trust", radius: 2.7, speed: 0.22, tilt: 0.1, phase: 2.2 },
  { key: "mercy", radius: 3.5, speed: 0.16, tilt: -0.08, phase: 3.9 },
  { key: "love", radius: 4.3, speed: 0.12, tilt: 0.14, phase: 5.3 },
];
const TRAIL_LENGTH = 40;
const DUST_COUNT = 2200;
const SLEEP_SPEED = 0.08;

function radialTexture(inner: string, outer: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(1, outer);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  return new CanvasTexture(canvas);
}

function cssColor(stage: HTMLElement, name: string, fallback: string): Color {
  const value = getComputedStyle(stage).getPropertyValue(name).trim();
  return new Color(value || fallback);
}

/**
 * 작은 빛을 중심으로 네 가치가 도는 궤도. 반환값은 정리 함수다.
 * WebGL을 쓸 수 없으면 null을 반환하고, 호출한 쪽은 정적 poster를 그대로 둔다.
 */
export function mountOrbitScene(stage: HTMLElement, labels: Record<OrbitKey, HTMLElement>): (() => void) | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "hero-stage-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");
  stage.prepend(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(36, 1.5, 0.1, 100);
  camera.position.set(0, 0, 11);
  const world = new Group();
  scene.add(world);
  // 궤도면을 눕혀 위에서 비껴 본 모습으로 만든다.
  const system = new Group();
  system.rotation.set(1.08, 0, -0.18);
  world.add(system);

  const dot = radialTexture("rgba(255,255,255,1)", "rgba(255,255,255,0)");
  const ivory = cssColor(stage, "--ivory", "#f4dfc5");
  const disposables: Array<{ dispose: () => void }> = [dot];

  const orbits = ORBITS.map((spec) => {
    const color = cssColor(stage, `--orbit-${spec.key}`, "#f4dfc5");
    const pivot = new Group();
    pivot.rotation.set(spec.tilt, 0, spec.tilt * 0.7);
    system.add(pivot);

    const ringPoints: Vector3[] = [];
    for (let index = 0; index <= 256; index += 1) {
      const angle = (index / 256) * Math.PI * 2;
      ringPoints.push(new Vector3(Math.cos(angle) * spec.radius, Math.sin(angle) * spec.radius, 0));
    }
    const ringGeometry = new BufferGeometry().setFromPoints(ringPoints);
    const ringMaterial = new LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.18,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    pivot.add(new LineLoop(ringGeometry, ringMaterial));

    const trailPositions = new Float32Array(TRAIL_LENGTH * 3);
    const trailColors = new Float32Array(TRAIL_LENGTH * 3);
    for (let index = 0; index < TRAIL_LENGTH; index += 1) {
      const fade = 1 - index / TRAIL_LENGTH;
      trailColors[index * 3] = color.r * fade;
      trailColors[index * 3 + 1] = color.g * fade;
      trailColors[index * 3 + 2] = color.b * fade;
    }
    const trailGeometry = new BufferGeometry();
    trailGeometry.setAttribute("position", new BufferAttribute(trailPositions, 3));
    trailGeometry.setAttribute("color", new BufferAttribute(trailColors, 3));
    const trailMaterial = new PointsMaterial({
      size: 0.08,
      vertexColors: true,
      map: dot,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    pivot.add(new Points(trailGeometry, trailMaterial));

    const moonMaterial = new SpriteMaterial({
      map: dot,
      color,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const moon = new Sprite(moonMaterial);
    pivot.add(moon);
    disposables.push(ringGeometry, ringMaterial, trailGeometry, trailMaterial, moonMaterial);
    return { spec, moon, ringMaterial, trailGeometry, trailPositions, label: labels[spec.key], glow: 0, x: 0, y: 0 };
  });

  // 중심의 작은 빛: 네 가치가 도는 자리.
  const haloTexture = radialTexture("rgba(244,223,197,0.55)", "rgba(244,223,197,0)");
  const haloMaterial = new SpriteMaterial({
    map: haloTexture,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const halo = new Sprite(haloMaterial);
  const sparkMaterial = new SpriteMaterial({
    map: dot,
    color: ivory,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const spark = new Sprite(sparkMaterial);
  world.add(halo, spark);
  disposables.push(haloTexture, haloMaterial, sparkMaterial);

  // 별가루: 기본 궤도 위에서 아주 느리게 돌고, pointer 주변에서는 밀려나며 감긴다.
  const baseRadius = new Float32Array(DUST_COUNT);
  const baseAngle = new Float32Array(DUST_COUNT);
  const baseHeight = new Float32Array(DUST_COUNT);
  const offset = new Float32Array(DUST_COUNT * 3);
  const velocity = new Float32Array(DUST_COUNT * 3);
  const dustPositions = new Float32Array(DUST_COUNT * 3);
  const dustColors = new Float32Array(DUST_COUNT * 3);
  const tints = [ivory, ivory, ivory, ...ORBITS.map((spec) => cssColor(stage, `--orbit-${spec.key}`, "#f4dfc5"))];
  for (let index = 0; index < DUST_COUNT; index += 1) {
    baseRadius[index] = 0.9 + Math.random() ** 0.55 * 7.4;
    baseAngle[index] = Math.random() * Math.PI * 2;
    baseHeight[index] = (Math.random() * 2 - 1) * 3.8;
    const tint = tints[Math.floor(Math.random() * tints.length)];
    const dim = 0.35 + Math.random() * 0.5;
    dustColors[index * 3] = tint.r * dim;
    dustColors[index * 3 + 1] = tint.g * dim;
    dustColors[index * 3 + 2] = tint.b * dim;
  }
  const dustGeometry = new BufferGeometry();
  dustGeometry.setAttribute("position", new BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute("color", new BufferAttribute(dustColors, 3));
  const dustMaterial = new PointsMaterial({
    size: 0.045,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    map: dot,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  scene.add(new Points(dustGeometry, dustMaterial));
  disposables.push(dustGeometry, dustMaterial);

  const pointer = new Vector2(9, 9);
  const pointerPixels = { x: -9999, y: -9999 };
  const cursor = new Vector3(99, 99, 0);
  const raycaster = new Raycaster();
  const plane = new Plane(new Vector3(0, 0, 1), 0);
  const projected = new Vector3();
  const tilt = { x: 0, y: 0 };
  let inside = false;
  let wake = 0;
  let beat = 0;
  let time = 0;
  let width = 1;
  let height = 1;
  let touchTimer = 0;
  let visible = true;
  let running = false;
  const clock = new Clock();

  const leave = (): void => {
    inside = false;
    pointerPixels.x = -9999;
    pointerPixels.y = -9999;
  };
  const controller = new AbortController();
  const { signal } = controller;
  stage.addEventListener(
    "pointermove",
    (event) => {
      const bounds = stage.getBoundingClientRect();
      pointerPixels.x = event.clientX - bounds.left;
      pointerPixels.y = event.clientY - bounds.top;
      pointer.set((pointerPixels.x / bounds.width) * 2 - 1, -((pointerPixels.y / bounds.height) * 2 - 1));
      inside = true;
      stage.classList.add("is-touched");
      if (reduceMotion) step(0.016);
    },
    { signal },
  );
  stage.addEventListener(
    "pointerleave",
    () => {
      leave();
      if (reduceMotion) step(0.016);
    },
    { signal },
  );
  stage.addEventListener(
    "pointerdown",
    (event) => {
      beat = 1;
      if (event.pointerType !== "mouse") {
        // touch에는 hover가 없으므로, 누른 뒤 잠시 깨어 있다가 다시 잠든다.
        inside = true;
        window.clearTimeout(touchTimer);
        touchTimer = window.setTimeout(leave, 2400);
      }
      if (reduceMotion) step(0.016);
    },
    { signal },
  );

  function step(delta: number): void {
    wake += ((inside ? 1 : 0) - wake) * Math.min(1, delta * (inside ? 2.2 : 0.9));
    time += delta * (SLEEP_SPEED + wake * (1 - SLEEP_SPEED));

    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(plane, cursor);
    tilt.x += ((inside ? pointer.x : 0) - tilt.x) * Math.min(1, delta * 2.5);
    tilt.y += ((inside ? pointer.y : 0) - tilt.y) * Math.min(1, delta * 2.5);
    world.rotation.y = tilt.x * 0.4;
    world.rotation.x = -tilt.y * 0.26;
    system.rotation.z = -0.18 + time * 0.02;

    // 잠든 동안에는 6초에 한 번 숨 쉬듯, 깨어나면 두 번 뛰는 박동으로 바뀐다.
    const breath = 0.5 + 0.5 * Math.sin(clock.elapsedTime * ((Math.PI * 2) / 6));
    const cycle = (time % 1.1) / 1.1;
    const lub = Math.exp(-(((cycle - 0.08) / 0.05) ** 2));
    const dub = 0.6 * Math.exp(-(((cycle - 0.28) / 0.05) ** 2));
    beat = Math.max(0, beat - delta * 1.3);
    const pulse = reduceMotion ? beat : (lub + dub) * 0.25 * wake + breath * 0.08 * (1 - wake) + beat;
    halo.scale.setScalar(2.6 + pulse * 1.3 + wake * 0.3);
    haloMaterial.opacity = 0.6 + pulse * 0.4;
    spark.scale.setScalar(0.5 + pulse * 0.2);

    let nearest: (typeof orbits)[number] | null = null;
    let nearestDistance = 96;
    for (const orbit of orbits) {
      const angle = orbit.spec.phase + time * orbit.spec.speed;
      const radius = orbit.spec.radius;
      orbit.moon.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      for (let index = 0; index < TRAIL_LENGTH; index += 1) {
        const trailing = angle - index * 0.022;
        orbit.trailPositions[index * 3] = Math.cos(trailing) * radius;
        orbit.trailPositions[index * 3 + 1] = Math.sin(trailing) * radius;
      }
      orbit.trailGeometry.attributes.position.needsUpdate = true;
      orbit.moon.getWorldPosition(projected);
      projected.project(camera);
      orbit.x = (projected.x * 0.5 + 0.5) * width;
      orbit.y = (-projected.y * 0.5 + 0.5) * height;
      const distance = Math.hypot(orbit.x - pointerPixels.x, orbit.y - pointerPixels.y);
      if (inside && distance < nearestDistance) {
        nearestDistance = distance;
        nearest = orbit;
      }
    }
    for (const orbit of orbits) {
      orbit.glow += ((orbit === nearest ? 1 : 0) - orbit.glow) * Math.min(1, delta * 4);
      orbit.ringMaterial.opacity = 0.12 + wake * 0.14 + orbit.glow * 0.45;
      orbit.moon.scale.setScalar(0.4 + wake * 0.08 + orbit.glow * 0.26);
      // 이름표가 무대 밖으로 잘리지 않도록 가장자리에서 안쪽으로 붙인다.
      const labelX = Math.min(Math.max(orbit.x, 44), width - 44);
      const labelY = Math.min(Math.max(orbit.y, 40), height - 8);
      orbit.label.style.transform = `translate(${labelX.toFixed(1)}px, ${labelY.toFixed(1)}px) translate(-50%, -150%)`;
      orbit.label.classList.toggle("is-near", orbit.glow > 0.5);
      orbit.label.style.opacity = orbit.glow > 0.5 ? "" : (0.3 + wake * 0.35).toFixed(2);
    }

    const reach = 2.1;
    const spin = time * 0.025;
    const spring = 7;
    const damping = Math.exp(-delta * 4.5);
    for (let index = 0; index < DUST_COUNT; index += 1) {
      const angle = baseAngle[index] + spin * (1.6 / (0.6 + baseRadius[index] * 0.3));
      const baseX = Math.cos(angle) * baseRadius[index];
      const baseZ = Math.sin(angle) * baseRadius[index];
      const cell = index * 3;
      if (wake > 0.01 && !reduceMotion) {
        const dx = baseX + offset[cell] - cursor.x;
        const dy = baseHeight[index] + offset[cell + 1] - cursor.y;
        const squared = dx * dx + dy * dy;
        if (squared < reach * reach) {
          const distance = Math.sqrt(squared) + 0.0001;
          const force = (1 - distance / reach) * wake * delta * 6;
          // 바깥으로 밀면서 접선 방향으로 감아 소용돌이를 만든다.
          velocity[cell] += ((dx / distance) * 2.2 - (dy / distance) * 1.6) * force;
          velocity[cell + 1] += ((dy / distance) * 2.2 + (dx / distance) * 1.6) * force;
          velocity[cell + 2] += force * 0.25;
        }
      }
      for (let axis = 0; axis < 3; axis += 1) {
        velocity[cell + axis] = (velocity[cell + axis] - offset[cell + axis] * spring * delta) * damping;
        offset[cell + axis] += velocity[cell + axis] * delta;
      }
      dustPositions[cell] = baseX + offset[cell];
      dustPositions[cell + 1] = baseHeight[index] + offset[cell + 1];
      dustPositions[cell + 2] = baseZ + offset[cell + 2];
    }
    dustGeometry.attributes.position.needsUpdate = true;
    dustMaterial.opacity = 0.6 + wake * 0.3;
    renderer.render(scene, camera);
  }

  function syncLoop(): void {
    const shouldRun = visible && !document.hidden && !reduceMotion;
    if (shouldRun === running) return;
    running = shouldRun;
    if (running) {
      clock.getDelta();
      renderer.setAnimationLoop(() => step(Math.min(clock.getDelta(), 0.05)));
    } else {
      renderer.setAnimationLoop(null);
    }
  }

  const resizeObserver = new ResizeObserver(() => {
    width = stage.clientWidth;
    height = stage.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // 좁은 화면에서도 가장 바깥 궤도가 잘리지 않도록 가로 시야를 지킨다.
    camera.position.z = Math.max(11, 9.6 / camera.aspect + 4.4);
    camera.updateProjectionMatrix();
    if (!running) step(0.016);
  });
  resizeObserver.observe(stage);
  // 화면 밖이거나 탭이 가려져 있으면 그리지 않는다.
  const intersectionObserver = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    syncLoop();
  });
  intersectionObserver.observe(stage);
  document.addEventListener("visibilitychange", syncLoop, { signal });

  width = stage.clientWidth || 1;
  height = stage.clientHeight || 1;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.position.z = Math.max(11, 9.6 / camera.aspect + 4.4);
  camera.updateProjectionMatrix();
  step(0.016);
  stage.classList.add("is-live");
  syncLoop();

  return () => {
    controller.abort();
    window.clearTimeout(touchTimer);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    renderer.setAnimationLoop(null);
    for (const item of disposables) item.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
