// 지식 지도 뒤에 깔리는 은하수. graph-view.ts가 화면이 그려진 뒤 dynamic import로 불러온다.
// 장식일 뿐이라 기록·관계·클릭 위치에는 관여하지 않는다. 지도 화면(SVG)은 움직이지 않고 이 배경만 돈다.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Clock,
  Color,
  Group,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  Sprite,
  SpriteMaterial,
  WebGLRenderer,
} from "three";

export type MapView = { x: number; y: number; scale: number; width: number; height: number };

type GalaxyOptions = {
  /** 지도 카메라(이동·확대)를 읽어 은하수에 약한 시차를 준다. */
  view: () => MapView;
  /** 사람이 지도를 만지고 있으면 회전을 늦춰 읽기를 방해하지 않는다. */
  engaged: () => boolean;
};

const ARM_STARS = 5200;
const FIELD_STARS = 1400;
const ARMS = 3;
const RADIUS = 9;

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

/** 은하의 모양은 열 때마다 같아야 하므로 seed가 있는 난수를 쓴다. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * host 안에 천천히 도는 나선 은하를 그리고 정리 함수를 돌려준다.
 * WebGL을 쓸 수 없으면 null을 반환하고, 지도는 기존 배경 그대로 동작한다.
 * host가 문서에서 빠지면(다른 화면으로 이동) 스스로 정리한다.
 */
export function mountGalaxy(host: HTMLElement, options: GalaxyOptions): GalaxyHandle | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "knowledge-map-galaxy-canvas";
  host.append(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1.5, 0.1, 200);
  camera.position.set(0, 0, 16);
  const disposables: Array<{ dispose: () => void }> = [];
  const dot = radialTexture("rgba(255,255,255,1)", "rgba(255,255,255,0)");
  disposables.push(dot);

  // 은하 원반을 비스듬히 눕혀, 위에서 비껴 본 은하수처럼 보이게 한다.
  const tilt = new Group();
  tilt.rotation.set(1.02, 0, -0.32);
  scene.add(tilt);
  const disk = new Group();
  tilt.add(disk);

  const random = seeded(2026);
  const gauss = (): number => (random() + random() + random() - 1.5) / 1.5;
  const core = new Color("#f4dfc5");
  const gold = new Color("#e3c27a");
  const palette = [new Color("#9fd6c4"), new Color("#a9c9e8"), new Color("#e8a08a")];
  const mixed = new Color();

  const positions = new Float32Array(ARM_STARS * 3);
  const colors = new Float32Array(ARM_STARS * 3);
  for (let index = 0; index < ARM_STARS; index += 1) {
    const arm = index % ARMS;
    const radius = random() ** 0.62 * RADIUS;
    const ratio = radius / RADIUS;
    // 중심에서 멀어질수록 더 감기는 나선 팔. 팔 둘레로 흩뿌려 띠처럼 보이게 한다.
    const angle = (arm / ARMS) * Math.PI * 2 + ratio * 4.2 + gauss() * (0.28 + ratio * 0.18);
    const spread = gauss() * (0.25 + ratio * 0.55);
    positions[index * 3] = Math.cos(angle) * radius + spread;
    positions[index * 3 + 1] = gauss() * (0.42 * (1 - ratio) + 0.06);
    positions[index * 3 + 2] = Math.sin(angle) * radius + gauss() * (0.25 + ratio * 0.55);
    mixed.copy(core).lerp(gold, Math.min(1, ratio * 2.2)).lerp(palette[arm], Math.max(0, ratio - 0.35));
    const brightness = (0.35 + random() * 0.65) * (1.05 - ratio * 0.55);
    colors[index * 3] = mixed.r * brightness;
    colors[index * 3 + 1] = mixed.g * brightness;
    colors[index * 3 + 2] = mixed.b * brightness;
  }
  const armGeometry = new BufferGeometry();
  armGeometry.setAttribute("position", new BufferAttribute(positions, 3));
  armGeometry.setAttribute("color", new BufferAttribute(colors, 3));
  const armMaterial = new PointsMaterial({
    size: 0.09,
    vertexColors: true,
    map: dot,
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  disk.add(new Points(armGeometry, armMaterial));
  disposables.push(armGeometry, armMaterial);

  // 은하 중심의 부드러운 빛.
  const bulgeTexture = radialTexture("rgba(244,223,197,0.55)", "rgba(244,223,197,0)");
  const bulgeMaterial = new SpriteMaterial({
    map: bulgeTexture,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const bulge = new Sprite(bulgeMaterial);
  bulge.scale.set(6.5, 6.5, 1);
  disk.add(bulge);
  disposables.push(bulgeTexture, bulgeMaterial);

  // 은하 밖의 먼 별들. 은하보다 느리게 움직여 깊이가 생긴다.
  const fieldPositions = new Float32Array(FIELD_STARS * 3);
  const fieldColors = new Float32Array(FIELD_STARS * 3);
  for (let index = 0; index < FIELD_STARS; index += 1) {
    fieldPositions[index * 3] = (random() - 0.5) * 60;
    fieldPositions[index * 3 + 1] = (random() - 0.5) * 40;
    fieldPositions[index * 3 + 2] = -10 - random() * 30;
    const brightness = 0.2 + random() * 0.5;
    fieldColors[index * 3] = core.r * brightness;
    fieldColors[index * 3 + 1] = core.g * brightness;
    fieldColors[index * 3 + 2] = core.b * brightness;
  }
  const fieldGeometry = new BufferGeometry();
  fieldGeometry.setAttribute("position", new BufferAttribute(fieldPositions, 3));
  fieldGeometry.setAttribute("color", new BufferAttribute(fieldColors, 3));
  const fieldMaterial = new PointsMaterial({
    size: 0.12,
    vertexColors: true,
    map: dot,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const field = new Points(fieldGeometry, fieldMaterial);
  scene.add(field);
  disposables.push(fieldGeometry, fieldMaterial);

  const clock = new Clock();
  let spin = 0;
  let calm = 0;
  let visible = true;
  let running = false;
  let disposed = false;

  function step(delta: number): void {
    if (!host.isConnected) {
      dispose();
      return;
    }
    // 만지고 있을 때는 거의 멈추고, 손을 떼면 다시 천천히 돈다.
    calm += ((options.engaged() ? 1 : 0) - calm) * Math.min(1, delta * 2);
    spin += delta * (0.035 - calm * 0.028);
    disk.rotation.y = -spin;
    field.rotation.z = spin * 0.08;

    // 지도를 옮기고 확대한 만큼 은하수가 조금만 따라와 시차가 생긴다.
    const view = options.view();
    const shiftX = (view.x + (view.scale - 1) * view.width * 0.5) / Math.max(view.width, 1);
    const shiftY = (view.y + (view.scale - 1) * view.height * 0.5) / Math.max(view.height, 1);
    tilt.position.set(shiftX * 2.6, -shiftY * 1.8, 0);
    camera.position.z = 16 / Math.sqrt(Math.max(view.scale, 0.5));
    field.position.set(shiftX * 0.8, -shiftY * 0.6, 0);
    renderer.render(scene, camera);
  }

  function fit(): void {
    const width = host.clientWidth || 1;
    const height = host.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function syncLoop(): void {
    const shouldRun = visible && !document.hidden && !reduceMotion && !disposed;
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
    fit();
    if (!running) step(0);
  });
  resizeObserver.observe(host);
  const intersectionObserver = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    syncLoop();
  });
  intersectionObserver.observe(host);
  document.addEventListener("visibilitychange", syncLoop);

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", syncLoop);
    for (const item of disposables) item.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  fit();
  step(0);
  host.classList.add("is-live");
  syncLoop();
  return {
    // 애니메이션이 멈춰 있을 때(움직임 줄이기·화면 밖) 지도를 옮기면 한 장만 다시 그린다.
    redraw: () => {
      if (!running && !disposed) step(0);
    },
    dispose,
  };
}

export type GalaxyHandle = { redraw: () => void; dispose: () => void };
