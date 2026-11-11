// Hero 3D 장식. main.ts가 화면이 뜬 뒤 dynamic import로 불러오므로 첫 로딩에는 포함되지 않는다.
// 공통 규칙: 평소에는 별가루처럼 아주 느리게 흐르고, pointer가 올라왔을 때만 깨어난다.
// 공통 틀(mountHeroScene)이 renderer·별가루·입력·수명 주기를 맡고, 각 장면은 자기 모양만 그린다.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Clock,
  Color,
  Euler,
  Group,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Matrix4,
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
export type SceneKind = "orbit" | "garden" | "lab" | "projects" | "graph" | OrbitKey;

type Frame = {
  /** 장면의 시간. 잠든 동안에는 8% 속도로만 흐른다. */
  time: number;
  /** 벽시계 시간(초). 잠들어도 같은 속도로 흐른다. */
  elapsed: number;
  delta: number;
  /** 0(잠듦) ~ 1(깨어남). */
  wake: number;
  /** pointer를 누른 직후 1에서 0으로 줄어드는 박동. */
  beat: number;
  inside: boolean;
  /** z=0 평면 위의 pointer 위치. */
  cursor: Vector3;
  raycaster: Raycaster;
  pointerPixels: { x: number; y: number };
  width: number;
  height: number;
  camera: PerspectiveCamera;
  reduceMotion: boolean;
};

type BuildContext = {
  stage: HTMLElement;
  world: Group;
  dot: CanvasTexture;
  color: (name: string, fallback?: string) => Color;
  track: <T extends { dispose: () => void }>(item: T) => T;
  labels?: Record<OrbitKey, HTMLElement>;
};

type SceneDefinition = {
  /** 별가루에 섞을 색(CSS 변수 이름). */
  tints: string[];
  build: (context: BuildContext) => (frame: Frame) => void;
};

const SLEEP_SPEED = 0.08;
const DUST_COUNT = 1700;
const IVORY = "#f4dfc5";

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

/** 장면의 모양은 새로 열어도 같아야 하므로, 구조를 만들 때는 seed가 있는 난수를 쓴다. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function glowPoints(
  context: BuildContext,
  positions: Float32Array,
  colors: Float32Array,
  size: number,
): { geometry: BufferGeometry; material: PointsMaterial; points: Points } {
  const geometry = context.track(new BufferGeometry());
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  const material = context.track(
    new PointsMaterial({
      size,
      vertexColors: true,
      map: context.dot,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  return { geometry, material, points: new Points(geometry, material) };
}

function glowLines(
  context: BuildContext,
  positions: Float32Array,
  color: Color,
  opacity: number,
): { geometry: BufferGeometry; material: LineBasicMaterial; lines: LineSegments } {
  const geometry = context.track(new BufferGeometry());
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  const material = context.track(
    new LineBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false }),
  );
  return { geometry, material, lines: new LineSegments(geometry, material) };
}

function glowSprite(context: BuildContext, color: Color, scale: number): { sprite: Sprite; material: SpriteMaterial } {
  const material = context.track(
    new SpriteMaterial({ map: context.dot, color, transparent: true, blending: AdditiveBlending, depthWrite: false }),
  );
  const sprite = new Sprite(material);
  sprite.scale.setScalar(scale);
  return { sprite, material };
}

/** 점으로 채운 면의 가장자리를 서서히 어둡게 해, 네모난 테두리가 드러나지 않게 한다. */
function edgeFade(column: number, columns: number, row: number, rows: number): number {
  const x = Math.abs(column / (columns - 1) - 0.5) * 2;
  const y = Math.abs(row / (rows - 1) - 0.5) * 2;
  const edge = Math.max(x, y);
  return edge < 0.62 ? 1 : Math.max(0, 1 - (edge - 0.62) / 0.38) ** 1.5;
}

function setColor(target: Float32Array, index: number, color: Color, strength: number): void {
  target[index * 3] = color.r * strength;
  target[index * 3 + 1] = color.g * strength;
  target[index * 3 + 2] = color.b * strength;
}

// ───────────────────────── OS: 작은 빛과 네 가치의 궤도 ─────────────────────────

const ORBITS: Array<{ key: OrbitKey; radius: number; speed: number; tilt: number; phase: number }> = [
  { key: "hope", radius: 1.9, speed: 0.3, tilt: 0, phase: 0.4 },
  { key: "trust", radius: 2.7, speed: 0.22, tilt: 0.1, phase: 2.2 },
  { key: "mercy", radius: 3.5, speed: 0.16, tilt: -0.08, phase: 3.9 },
  { key: "love", radius: 4.3, speed: 0.12, tilt: 0.14, phase: 5.3 },
];
const TRAIL_LENGTH = 40;

const orbitScene: SceneDefinition = {
  tints: ["--orbit-hope", "--orbit-trust", "--orbit-mercy", "--orbit-love"],
  build(context) {
    // 궤도면을 눕혀 위에서 비껴 본 모습으로 만든다.
    const system = new Group();
    system.rotation.set(1.08, 0, -0.18);
    context.world.add(system);
    const ivory = context.color("--ivory");

    const orbits = ORBITS.map((spec) => {
      const color = context.color(`--orbit-${spec.key}`);
      const pivot = new Group();
      pivot.rotation.set(spec.tilt, 0, spec.tilt * 0.7);
      system.add(pivot);

      const ringPoints: Vector3[] = [];
      for (let index = 0; index <= 256; index += 1) {
        const angle = (index / 256) * Math.PI * 2;
        ringPoints.push(new Vector3(Math.cos(angle) * spec.radius, Math.sin(angle) * spec.radius, 0));
      }
      const ringGeometry = context.track(new BufferGeometry().setFromPoints(ringPoints));
      const ringMaterial = context.track(
        new LineBasicMaterial({ color, transparent: true, opacity: 0.18, blending: AdditiveBlending, depthWrite: false }),
      );
      pivot.add(new LineLoop(ringGeometry, ringMaterial));

      const trailPositions = new Float32Array(TRAIL_LENGTH * 3);
      const trailColors = new Float32Array(TRAIL_LENGTH * 3);
      for (let index = 0; index < TRAIL_LENGTH; index += 1) {
        setColor(trailColors, index, color, 1 - index / TRAIL_LENGTH);
      }
      const trail = glowPoints(context, trailPositions, trailColors, 0.08);
      pivot.add(trail.points);
      const moon = glowSprite(context, color, 0.4);
      pivot.add(moon.sprite);
      return { spec, moon: moon.sprite, ringMaterial, trail, trailPositions, label: context.labels?.[spec.key], glow: 0, x: 0, y: 0 };
    });

    // 중심의 작은 빛: 네 가치가 도는 자리.
    const haloTexture = context.track(radialTexture("rgba(244,223,197,0.55)", "rgba(244,223,197,0)"));
    const haloMaterial = context.track(
      new SpriteMaterial({ map: haloTexture, transparent: true, blending: AdditiveBlending, depthWrite: false }),
    );
    const halo = new Sprite(haloMaterial);
    const spark = glowSprite(context, ivory, 0.5);
    context.world.add(halo, spark.sprite);
    const projected = new Vector3();

    return (frame) => {
      system.rotation.z = -0.18 + frame.time * 0.02;
      // 잠든 동안에는 6초에 한 번 숨 쉬듯, 깨어나면 두 번 뛰는 박동으로 바뀐다.
      const breath = 0.5 + 0.5 * Math.sin(frame.elapsed * ((Math.PI * 2) / 6));
      const cycle = (frame.time % 1.1) / 1.1;
      const lub = Math.exp(-(((cycle - 0.08) / 0.05) ** 2));
      const dub = 0.6 * Math.exp(-(((cycle - 0.28) / 0.05) ** 2));
      const pulse = frame.reduceMotion
        ? frame.beat
        : (lub + dub) * 0.25 * frame.wake + breath * 0.08 * (1 - frame.wake) + frame.beat;
      halo.scale.setScalar(2.6 + pulse * 1.3 + frame.wake * 0.3);
      haloMaterial.opacity = 0.6 + pulse * 0.4;
      spark.sprite.scale.setScalar(0.5 + pulse * 0.2);

      let nearest: (typeof orbits)[number] | null = null;
      let nearestDistance = 96;
      for (const orbit of orbits) {
        const angle = orbit.spec.phase + frame.time * orbit.spec.speed;
        const radius = orbit.spec.radius;
        orbit.moon.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
        for (let index = 0; index < TRAIL_LENGTH; index += 1) {
          const trailing = angle - index * 0.022;
          orbit.trailPositions[index * 3] = Math.cos(trailing) * radius;
          orbit.trailPositions[index * 3 + 1] = Math.sin(trailing) * radius;
        }
        orbit.trail.geometry.attributes.position.needsUpdate = true;
        orbit.moon.getWorldPosition(projected);
        projected.project(frame.camera);
        orbit.x = (projected.x * 0.5 + 0.5) * frame.width;
        orbit.y = (-projected.y * 0.5 + 0.5) * frame.height;
        const distance = Math.hypot(orbit.x - frame.pointerPixels.x, orbit.y - frame.pointerPixels.y);
        if (frame.inside && distance < nearestDistance) {
          nearestDistance = distance;
          nearest = orbit;
        }
      }
      for (const orbit of orbits) {
        orbit.glow += ((orbit === nearest ? 1 : 0) - orbit.glow) * Math.min(1, frame.delta * 4);
        orbit.ringMaterial.opacity = 0.12 + frame.wake * 0.14 + orbit.glow * 0.45;
        orbit.moon.scale.setScalar(0.4 + frame.wake * 0.08 + orbit.glow * 0.26);
        if (!orbit.label) continue;
        // 이름표가 무대 밖으로 잘리지 않도록 가장자리에서 안쪽으로 붙인다.
        const labelX = Math.min(Math.max(orbit.x, 44), frame.width - 44);
        const labelY = Math.min(Math.max(orbit.y, 40), frame.height - 8);
        orbit.label.style.transform = `translate(${labelX.toFixed(1)}px, ${labelY.toFixed(1)}px) translate(-50%, -150%)`;
        orbit.label.classList.toggle("is-near", orbit.glow > 0.5);
        orbit.label.style.opacity = orbit.glow > 0.5 ? "" : (0.3 + frame.wake * 0.35).toFixed(2);
      }
    };
  },
};

// ───────────────────────── Garden: 씨앗에서 자라는 빛의 가지 ─────────────────────────

const gardenScene: SceneDefinition = {
  tints: ["--orbit-mercy", "--orbit-hope"],
  build(context) {
    const random = seeded(7);
    type Segment = { start: Vector3; end: Vector3; from: number; to: number; tip: boolean; depth: number };
    const segments: Segment[] = [];
    const maxDepth = 6;
    const grow = (start: Vector3, direction: Vector3, length: number, depth: number, from: number): void => {
      const end = start.clone().addScaledVector(direction, length);
      const to = from + length * 0.11;
      const tip = depth === maxDepth;
      segments.push({ start, end, from, to, tip, depth });
      if (tip) return;
      const children = depth < 2 || random() > 0.72 ? 3 : 2;
      for (let child = 0; child < children; child += 1) {
        const spread = 0.42 + random() * 0.5;
        const turn = (child / children) * Math.PI * 2 + random() * 1.6;
        const side = new Vector3(Math.cos(turn), 0.18, Math.sin(turn)).normalize();
        const next = direction.clone().multiplyScalar(Math.cos(spread)).addScaledVector(side, Math.sin(spread)).normalize();
        // 가지가 위로 뻗도록 조금씩 위쪽으로 당긴다.
        next.y += 0.12;
        grow(end, next.normalize(), length * (0.66 + random() * 0.1), depth + 1, to);
      }
    };
    grow(new Vector3(0, -3, 0), new Vector3(0, 1, 0), 1.35, 0, 0);
    const span = Math.max(...segments.map((segment) => segment.to));
    for (const segment of segments) {
      segment.from /= span;
      segment.to /= span;
    }

    const tree = new Group();
    tree.position.y = 1.2;
    tree.scale.setScalar(1.5);
    context.world.add(tree);
    const positions = new Float32Array(segments.length * 6);
    const lines = glowLines(context, positions, context.color("--orbit-mercy"), 0.5);
    tree.add(lines.lines);
    const tips = segments.filter((segment) => segment.tip);
    const budPositions = new Float32Array(tips.length * 3);
    const budColors = new Float32Array(tips.length * 3);
    const buds = glowPoints(context, budPositions, budColors, 0.16);
    tree.add(buds.points);
    const seed = glowSprite(context, context.color("--ivory"), 0.5);
    seed.sprite.position.set(0, -3, 0);
    tree.add(seed.sprite);
    const mint = context.color("--orbit-mercy");
    const gold = context.color("--orbit-hope");
    tips.forEach((tip, index) => budPositions.set([tip.end.x, tip.end.y, tip.end.z], index * 3));

    return (frame) => {
      // 평소에는 절반쯤 자란 채 천천히 숨 쉬고, 깨어나면 끝까지 자란다.
      const idle = 0.66 + (frame.reduceMotion ? 0 : 0.04 * Math.sin(frame.elapsed * 0.4));
      const growth = Math.min(1, idle + frame.wake * 0.4);
      segments.forEach((segment, index) => {
        const progress = Math.min(1, Math.max(0, (growth - segment.from) / Math.max(segment.to - segment.from, 0.0001)));
        const cell = index * 6;
        positions[cell] = segment.start.x;
        positions[cell + 1] = segment.start.y;
        positions[cell + 2] = segment.start.z;
        positions[cell + 3] = segment.start.x + (segment.end.x - segment.start.x) * progress;
        positions[cell + 4] = segment.start.y + (segment.end.y - segment.start.y) * progress;
        positions[cell + 5] = segment.start.z + (segment.end.z - segment.start.z) * progress;
      });
      lines.geometry.attributes.position.needsUpdate = true;
      lines.material.opacity = 0.42 + frame.wake * 0.25;
      tips.forEach((tip, index) => {
        const open = Math.min(1, Math.max(0, (growth - tip.to) / 0.04 + 1));
        const twinkle = 0.7 + 0.3 * Math.sin(frame.time * 2 + index);
        setColor(budColors, index, index % 3 === 0 ? gold : mint, growth >= tip.to ? open * twinkle : 0);
      });
      buds.geometry.attributes.color.needsUpdate = true;
      seed.sprite.scale.setScalar(0.5 + frame.beat * 0.4 + frame.wake * 0.1);
      tree.rotation.y = frame.time * 0.12;
      tree.rotation.z = Math.sin(frame.time * 0.6) * 0.025;
    };
  },
};

// ───────────────────────── Lab: 두 물결이 만나는 간섭 무늬 ─────────────────────────

const labScene: SceneDefinition = {
  tints: ["--orbit-trust"],
  build(context) {
    const columns = 66;
    const rows = 44;
    const count = columns * rows;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const fade = new Float32Array(count);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        positions[index * 3] = (column / (columns - 1) - 0.5) * 10.8;
        positions[index * 3 + 1] = (row / (rows - 1) - 0.5) * 7;
        fade[index] = edgeFade(column, columns, row, rows);
      }
    }
    const field = glowPoints(context, positions, colors, 0.15);
    context.world.add(field.points);
    const blue = context.color("--orbit-trust");
    const ivory = context.color("--ivory");
    const mixed = new Color();
    const sourceA = { x: -2.4, y: 0.5 };
    const markerA = glowSprite(context, ivory, 0.34);
    markerA.sprite.position.set(sourceA.x, sourceA.y, 0.1);
    const markerB = glowSprite(context, blue, 0.34);
    context.world.add(markerA.sprite, markerB.sprite);
    const sourceB = { x: 2.2, y: -0.6 };

    return (frame) => {
      // 첫 물결은 가설, pointer가 만드는 둘째 물결은 검증이다. 둘이 만나야 무늬가 생긴다.
      if (frame.inside) {
        sourceB.x += (frame.cursor.x - sourceB.x) * Math.min(1, frame.delta * 6);
        sourceB.y += (frame.cursor.y - sourceB.y) * Math.min(1, frame.delta * 6);
      }
      markerB.sprite.position.set(sourceB.x, sourceB.y, 0.1);
      markerB.material.opacity = frame.wake;
      markerA.sprite.scale.setScalar(0.34 + frame.beat * 0.3);
      const phase = frame.time * 2.4;
      const second = frame.wake;
      for (let index = 0; index < count; index += 1) {
        const x = positions[index * 3];
        const y = positions[index * 3 + 1];
        const first = Math.sin(Math.hypot(x - sourceA.x, y - sourceA.y) * 3.1 - phase);
        const other = Math.sin(Math.hypot(x - sourceB.x, y - sourceB.y) * 3.1 - phase) * second;
        const height = (first + other) / (1 + second);
        const light = (height * 0.5 + 0.5) ** 1.15;
        positions[index * 3 + 2] = height * 0.14;
        mixed.copy(blue).lerp(ivory, light * second);
        setColor(colors, index, mixed, (0.26 + light * 0.74) * fade[index]);
      }
      field.geometry.attributes.position.needsUpdate = true;
      field.geometry.attributes.color.needsUpdate = true;
    };
  },
};

// ───────────────────────── Projects: 흩어진 점이 구조로 정렬된다 ─────────────────────────

const projectsScene: SceneDefinition = {
  tints: ["--orbit-hope"],
  build(context) {
    const random = seeded(23);
    const ordered: Vector3[] = [];
    const links: Array<[number, number]> = [];
    const indexAt = new Map<string, number>();
    // 한 단씩 높아지는 계단 모양의 격자: 검증된 것 위에 다음 것을 쌓는다.
    for (let column = 0; column < 14; column += 1) {
      const height = 1 + Math.floor(column * 0.5);
      for (let level = 0; level < height; level += 1) {
        for (let depth = 0; depth < 4; depth += 1) {
          indexAt.set(`${column}:${level}:${depth}`, ordered.length);
          ordered.push(new Vector3((column - 6.5) * 0.5, level * 0.5 - 1.7, (depth - 1.5) * 0.5));
        }
      }
    }
    for (const [key, index] of indexAt) {
      const [column, level, depth] = key.split(":").map(Number);
      for (const neighbour of [`${column + 1}:${level}:${depth}`, `${column}:${level + 1}:${depth}`, `${column}:${level}:${depth + 1}`]) {
        const other = indexAt.get(neighbour);
        if (other !== undefined) links.push([index, other]);
      }
    }
    const count = ordered.length;
    const scatter = ordered.map(
      () => new Vector3((random() - 0.5) * 10, (random() - 0.5) * 6, (random() - 0.5) * 4),
    );
    const drift = ordered.map(() => random() * Math.PI * 2);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const gold = context.color("--orbit-hope");
    const ivory = context.color("--ivory");
    for (let index = 0; index < count; index += 1) {
      setColor(colors, index, index % 5 === 0 ? ivory : gold, 0.75 + random() * 0.25);
    }
    const structure = new Group();
    structure.rotation.set(0.28, -0.5, 0);
    structure.position.x = -0.7;
    structure.scale.setScalar(1.15);
    context.world.add(structure);
    const dots = glowPoints(context, positions, colors, 0.15);
    const linePositions = new Float32Array(links.length * 6);
    const lines = glowLines(context, linePositions, gold, 0);
    structure.add(lines.lines, dots.points);
    let order = 0;

    return (frame) => {
      // 평소에는 흩어져 떠다니고, 깨어나면 제자리를 찾아 구조가 된다.
      order += ((frame.wake > 0.5 ? 1 : frame.wake * 0.3) - order) * Math.min(1, frame.delta * 1.6);
      const eased = order * order * (3 - 2 * order);
      for (let index = 0; index < count; index += 1) {
        const loose = scatter[index];
        const sway = frame.reduceMotion ? 0 : 0.25;
        const lx = loose.x + Math.sin(frame.time * 0.7 + drift[index]) * sway;
        const ly = loose.y + Math.cos(frame.time * 0.6 + drift[index] * 1.3) * sway;
        positions[index * 3] = lx + (ordered[index].x - lx) * eased;
        positions[index * 3 + 1] = ly + (ordered[index].y - ly) * eased;
        positions[index * 3 + 2] = loose.z + (ordered[index].z - loose.z) * eased;
      }
      links.forEach(([from, to], index) => {
        linePositions.set(positions.subarray(from * 3, from * 3 + 3), index * 6);
        linePositions.set(positions.subarray(to * 3, to * 3 + 3), index * 6 + 3);
      });
      dots.geometry.attributes.position.needsUpdate = true;
      lines.geometry.attributes.position.needsUpdate = true;
      lines.material.opacity = eased * eased * 0.32 + frame.beat * 0.2 * eased;
      structure.rotation.y = -0.5 + frame.time * 0.05;
    };
  },
};

// ───────────────────────── Map: 이어진 기록들의 연결망 ─────────────────────────

const graphScene: SceneDefinition = {
  tints: ["--orbit-hope", "--orbit-trust", "--orbit-mercy", "--orbit-love"],
  build(context) {
    const random = seeded(41);
    const palette = (["hope", "trust", "mercy", "love"] as const).map((key) => context.color(`--orbit-${key}`));
    const count = 34;
    const nodes: Vector3[] = [];
    for (let index = 0; index < count; index += 1) {
      const radius = 1.2 + random() ** 0.7 * 2.6;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      nodes.push(
        new Vector3(radius * Math.sin(phi) * Math.cos(theta) * 1.35, radius * Math.cos(phi) * 0.85, radius * Math.sin(phi) * Math.sin(theta)),
      );
    }
    const edges: Array<[number, number]> = [];
    const seen = new Set<string>();
    nodes.forEach((node, index) => {
      const nearest = nodes
        .map((other, otherIndex) => ({ otherIndex, distance: node.distanceTo(other) }))
        .filter(({ otherIndex }) => otherIndex !== index)
        .sort((left, right) => left.distance - right.distance)
        .slice(0, 2);
      for (const { otherIndex } of nearest) {
        const key = [Math.min(index, otherIndex), Math.max(index, otherIndex)].join(":");
        if (!seen.has(key)) {
          seen.add(key);
          edges.push([index, otherIndex]);
        }
      }
    });
    const web = new Group();
    context.world.add(web);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    nodes.forEach((node, index) => {
      positions.set([node.x, node.y, node.z], index * 3);
      setColor(colors, index, palette[index % palette.length], 1);
    });
    const dots = glowPoints(context, positions, colors, 0.26);
    const linePositions = new Float32Array(edges.length * 6);
    edges.forEach(([from, to], index) => {
      linePositions.set([nodes[from].x, nodes[from].y, nodes[from].z, nodes[to].x, nodes[to].y, nodes[to].z], index * 6);
    });
    const lines = glowLines(context, linePositions, context.color("--ivory"), 0.14);
    web.add(lines.lines, dots.points);
    // 선을 따라 흐르는 작은 빛: 한 기록에서 다음 기록으로 생각이 이어진다.
    const pulseCount = 9;
    const pulsePositions = new Float32Array(pulseCount * 3);
    const pulseColors = new Float32Array(pulseCount * 3);
    const pulses = glowPoints(context, pulsePositions, pulseColors, 0.14);
    web.add(pulses.points);
    const ivory = context.color("--ivory");

    return (frame) => {
      web.rotation.y = frame.time * 0.1;
      web.rotation.x = Math.sin(frame.time * 0.07) * 0.12;
      lines.material.opacity = 0.12 + frame.wake * 0.32 + frame.beat * 0.2;
      dots.material.size = 0.24 + frame.wake * 0.08 + frame.beat * 0.06;
      for (let index = 0; index < pulseCount; index += 1) {
        const [from, to] = edges[(index * 5) % edges.length];
        const travel = (frame.time * 0.35 + index * 0.37) % 1;
        pulsePositions[index * 3] = nodes[from].x + (nodes[to].x - nodes[from].x) * travel;
        pulsePositions[index * 3 + 1] = nodes[from].y + (nodes[to].y - nodes[from].y) * travel;
        pulsePositions[index * 3 + 2] = nodes[from].z + (nodes[to].z - nodes[from].z) * travel;
        setColor(pulseColors, index, ivory, frame.wake * Math.sin(travel * Math.PI));
      }
      pulses.geometry.attributes.position.needsUpdate = true;
      pulses.geometry.attributes.color.needsUpdate = true;
    };
  },
};

// ───────────────────────── H.OPE: 위로 감아 오르는 나선 ─────────────────────────

const hopeScene: SceneDefinition = {
  tints: ["--orbit-hope"],
  build(context) {
    const count = 320;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const gold = context.color("--orbit-hope");
    const ivory = context.color("--ivory");
    const mixed = new Color();
    const place = (ratio: number, target: Vector3): Vector3 => {
      const angle = ratio * Math.PI * 9;
      const radius = 2 - ratio * 1.55;
      return target.set(Math.cos(angle) * radius, -3 + ratio * 6, Math.sin(angle) * radius);
    };
    const point = new Vector3();
    for (let index = 0; index < count; index += 1) {
      place(index / (count - 1), point);
      positions.set([point.x, point.y, point.z], index * 3);
    }
    const spiral = new Group();
    context.world.add(spiral);
    const path = glowPoints(context, positions, colors, 0.085);
    spiral.add(path.points);
    const climberCount = 14;
    const climberPositions = new Float32Array(climberCount * 3);
    const climberColors = new Float32Array(climberCount * 3);
    const climbers = glowPoints(context, climberPositions, climberColors, 0.2);
    spiral.add(climbers.points);
    const star = glowSprite(context, ivory, 0.6);
    spiral.add(star.sprite);

    return (frame) => {
      // 평소에는 중간까지만 보이고, 깨어나면 꼭대기의 빛까지 길이 열린다.
      const reach = Math.min(1, 0.52 + frame.wake * 0.5);
      for (let index = 0; index < count; index += 1) {
        const ratio = index / (count - 1);
        const shown = Math.min(1, Math.max(0, (reach - ratio) / 0.08));
        mixed.copy(gold).lerp(ivory, ratio);
        setColor(colors, index, mixed, shown * (0.35 + ratio * 0.5));
      }
      path.geometry.attributes.color.needsUpdate = true;
      for (let index = 0; index < climberCount; index += 1) {
        // 느려도 멈추지 않고 오르는 빛.
        const ratio = ((frame.time * 0.06 + index / climberCount) % 1) * reach;
        place(ratio, point);
        climberPositions.set([point.x, point.y, point.z], index * 3);
        setColor(climberColors, index, ivory, Math.sin((ratio / reach) * Math.PI));
      }
      climbers.geometry.attributes.position.needsUpdate = true;
      climbers.geometry.attributes.color.needsUpdate = true;
      place(reach, point);
      star.sprite.position.copy(point);
      star.sprite.scale.setScalar(0.45 + frame.wake * 0.5 + frame.beat * 0.5);
      spiral.rotation.y = frame.time * 0.2;
    };
  },
};

// ───────────────────────── T.RUST: 흔들려도 제자리로 돌아오는 격자 ─────────────────────────

const trustScene: SceneDefinition = {
  tints: ["--orbit-trust"],
  build(context) {
    const size = 5;
    const spacing = 0.88;
    const base: Vector3[] = [];
    const links: Array<[number, number]> = [];
    const at = (x: number, y: number, z: number): number => (x * size + y) * size + z;
    for (let x = 0; x < size; x += 1) {
      for (let y = 0; y < size; y += 1) {
        for (let z = 0; z < size; z += 1) {
          base.push(new Vector3((x - 2) * spacing, (y - 2) * spacing, (z - 2) * spacing));
          if (x + 1 < size) links.push([at(x, y, z), at(x + 1, y, z)]);
          if (y + 1 < size) links.push([at(x, y, z), at(x, y + 1, z)]);
          if (z + 1 < size) links.push([at(x, y, z), at(x, y, z + 1)]);
        }
      }
    }
    const count = base.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const offset = new Float32Array(count * 3);
    const velocity = new Float32Array(count * 3);
    const blue = context.color("--orbit-trust");
    const ivory = context.color("--ivory");
    for (let index = 0; index < count; index += 1) {
      setColor(colors, index, index % 4 === 0 ? ivory : blue, 0.9);
    }
    const dots = glowPoints(context, positions, colors, 0.13);
    const linePositions = new Float32Array(links.length * 6);
    const lines = glowLines(context, linePositions, blue, 0.16);
    context.world.add(lines.lines, dots.points);
    const rotation = new Matrix4();
    const euler = new Euler();
    const turned = new Vector3();

    return (frame) => {
      // 격자는 화면 좌표에서 직접 계산한다. 그래야 pointer가 건드린 점만 정확히 밀린다.
      euler.set(0.5, 0.62 + frame.time * 0.06, 0.08);
      rotation.makeRotationFromEuler(euler);
      const reach = 1.5;
      const damping = Math.exp(-frame.delta * 3.2);
      for (let index = 0; index < count; index += 1) {
        turned.copy(base[index]).applyMatrix4(rotation);
        const cell = index * 3;
        if (frame.wake > 0.01 && !frame.reduceMotion) {
          const dx = turned.x + offset[cell] - frame.cursor.x;
          const dy = turned.y + offset[cell + 1] - frame.cursor.y;
          const squared = dx * dx + dy * dy;
          if (squared < reach * reach) {
            const distance = Math.sqrt(squared) + 0.0001;
            const force = (1 - distance / reach) * frame.wake * frame.delta * 16;
            velocity[cell] += (dx / distance) * force;
            velocity[cell + 1] += (dy / distance) * force;
          }
        }
        for (let axis = 0; axis < 3; axis += 1) {
          // 흔들려도 반드시 제자리로 돌아온다.
          velocity[cell + axis] = (velocity[cell + axis] - offset[cell + axis] * 14 * frame.delta) * damping;
          offset[cell + axis] += velocity[cell + axis] * frame.delta;
        }
        positions[cell] = turned.x + offset[cell];
        positions[cell + 1] = turned.y + offset[cell + 1];
        positions[cell + 2] = turned.z + offset[cell + 2];
      }
      links.forEach(([from, to], index) => {
        linePositions.set(positions.subarray(from * 3, from * 3 + 3), index * 6);
        linePositions.set(positions.subarray(to * 3, to * 3 + 3), index * 6 + 3);
      });
      dots.geometry.attributes.position.needsUpdate = true;
      lines.geometry.attributes.position.needsUpdate = true;
      lines.material.opacity = 0.14 + frame.wake * 0.2 + frame.beat * 0.25;
    };
  },
};

// ───────────────────────── M.ERCY: 잔잔한 수면과 파문 ─────────────────────────

const mercyScene: SceneDefinition = {
  tints: ["--orbit-mercy"],
  build(context) {
    const columns = 78;
    const rows = 40;
    const count = columns * rows;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const fade = new Float32Array(count);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        positions[index * 3] = (column / (columns - 1) - 0.5) * 15;
        positions[index * 3 + 1] = (row / (rows - 1) - 0.5) * 9;
        fade[index] = edgeFade(column, columns, row, rows);
      }
    }
    // 수면을 눕혀 위에서 비껴 본다.
    const tiltAngle = -1.12;
    const water = new Group();
    water.rotation.x = tiltAngle;
    water.position.y = -0.5;
    context.world.add(water);
    const surface = glowPoints(context, positions, colors, 0.12);
    water.add(surface.points);
    const mint = context.color("--orbit-mercy");
    const ivory = context.color("--ivory");
    const mixed = new Color();
    const normal = new Vector3(0, 0, 1).applyEuler(new Euler(tiltAngle, 0, 0));
    const plane = new Plane().setFromNormalAndCoplanarPoint(normal, new Vector3(0, -0.5, 0));
    const hit = new Vector3();
    const ripples = Array.from({ length: 7 }, () => ({ x: 0, y: 0, born: -99 }));
    let next = 0;
    let lastDrop = -99;
    const drop = (x: number, y: number, now: number): void => {
      ripples[next] = { x, y, born: now };
      next = (next + 1) % ripples.length;
      lastDrop = now;
    };
    const local = new Vector3();

    return (frame) => {
      if (frame.inside && !frame.reduceMotion && frame.raycaster.ray.intersectPlane(plane, hit)) {
        water.worldToLocal(local.copy(hit));
        // pointer가 머무는 자리에 한 방울씩, 누르면 바로 떨어진다.
        if (frame.elapsed - lastDrop > 0.55 || frame.beat > 0.96) {
          drop(local.x, local.y, frame.elapsed);
        }
      }
      for (let index = 0; index < count; index += 1) {
        const x = positions[index * 3];
        const y = positions[index * 3 + 1];
        let height = frame.reduceMotion ? 0 : Math.sin(x * 0.55 + frame.time * 0.8) * 0.07 + Math.sin(y * 0.8 - frame.time * 0.6) * 0.05;
        for (const ripple of ripples) {
          const age = frame.elapsed - ripple.born;
          if (age < 0 || age > 5) continue;
          const distance = Math.hypot(x - ripple.x, y - ripple.y);
          const front = age * 1.7;
          const band = Math.exp(-(((distance - front) / 0.7) ** 2));
          height += Math.sin((distance - front) * 4.2) * band * Math.exp(-age * 0.6) * 0.34;
        }
        positions[index * 3 + 2] = height;
        const light = Math.min(1, Math.abs(height) * 3.2);
        // 잔잔할 때에도 물결의 결이 보이도록 높낮이에 따라 은은하게 빛난다.
        const shimmer = Math.min(1, Math.max(0, (height + 0.12) / 0.24));
        mixed.copy(mint).lerp(ivory, light);
        setColor(colors, index, mixed, (0.3 + shimmer * 0.35 + light * 0.35) * fade[index]);
      }
      surface.geometry.attributes.position.needsUpdate = true;
      surface.geometry.attributes.color.needsUpdate = true;
    };
  },
};

// ───────────────────────── L.OVE: 서로를 도는 두 빛 ─────────────────────────

const loveScene: SceneDefinition = {
  tints: ["--orbit-love", "--orbit-hope"],
  build(context) {
    const coral = context.color("--orbit-love");
    const ivory = context.color("--ivory");
    const pair = new Group();
    pair.rotation.set(1.02, 0, 0.22);
    context.world.add(pair);
    const trailLength = 90;
    const makeLight = (color: Color) => {
      const light = glowSprite(context, color, 0.7);
      const trailPositions = new Float32Array(trailLength * 3);
      const trailColors = new Float32Array(trailLength * 3);
      for (let index = 0; index < trailLength; index += 1) {
        setColor(trailColors, index, color, (1 - index / trailLength) ** 1.6);
      }
      const trail = glowPoints(context, trailPositions, trailColors, 0.09);
      pair.add(trail.points, light.sprite);
      return { light, trail, trailPositions };
    };
    const first = makeLight(coral);
    const second = makeLight(ivory);
    const warmthTexture = context.track(radialTexture("rgba(232,160,138,0.5)", "rgba(232,160,138,0)"));
    const warmthMaterial = context.track(
      new SpriteMaterial({ map: warmthTexture, transparent: true, blending: AdditiveBlending, depthWrite: false }),
    );
    const warmth = new Sprite(warmthMaterial);
    pair.add(warmth);

    return (frame) => {
      // 멀리서 천천히 돌다가, 깨어나면 가까워지며 사이가 따뜻해진다.
      const gap = 3.3 - frame.wake * 1.9;
      const angle = frame.time * 0.85;
      const breath = 0.5 + 0.5 * Math.sin(frame.elapsed * ((Math.PI * 2) / 6));
      [first, second].forEach((body, side) => {
        const sign = side === 0 ? 1 : -1;
        const radius = (gap / 2) * (side === 0 ? 1 : 1.12);
        body.light.sprite.position.set(Math.cos(angle) * radius * sign, Math.sin(angle) * radius * sign, 0);
        body.light.sprite.scale.setScalar(0.6 + frame.wake * 0.25 + breath * 0.08 + frame.beat * 0.4);
        for (let index = 0; index < trailLength; index += 1) {
          const past = angle - index * 0.045;
          body.trailPositions[index * 3] = Math.cos(past) * radius * sign;
          body.trailPositions[index * 3 + 1] = Math.sin(past) * radius * sign;
        }
        body.trail.geometry.attributes.position.needsUpdate = true;
      });
      warmth.scale.setScalar(1.6 + frame.wake * 3.2 + frame.beat * 1.2);
      warmthMaterial.opacity = 0.1 + frame.wake * 0.5 + breath * 0.06;
      pair.rotation.z = 0.22 + frame.time * 0.03;
    };
  },
};

const SCENES: Record<SceneKind, SceneDefinition> = {
  orbit: orbitScene,
  garden: gardenScene,
  lab: labScene,
  projects: projectsScene,
  graph: graphScene,
  hope: hopeScene,
  trust: trustScene,
  mercy: mercyScene,
  love: loveScene,
};

/**
 * 무대에 장면을 붙이고 정리 함수를 돌려준다.
 * WebGL을 쓸 수 없으면 null을 반환하고, 호출한 쪽은 정적 poster를 그대로 둔다.
 */
export function mountHeroScene(
  kind: SceneKind,
  stage: HTMLElement,
  labels?: Record<OrbitKey, HTMLElement>,
): (() => void) | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }
  const definition = SCENES[kind];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "hero-stage-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");
  stage.prepend(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(36, 1.5, 0.1, 100);
  const world = new Group();
  scene.add(world);
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };
  const dot = track(radialTexture("rgba(255,255,255,1)", "rgba(255,255,255,0)"));
  const styles = getComputedStyle(stage);
  const color = (name: string, fallback = IVORY): Color => new Color(styles.getPropertyValue(name).trim() || fallback);
  const context: BuildContext = { stage, world, dot, color, track, labels };
  const update = definition.build(context);

  // 별가루: 기본 궤도 위에서 아주 느리게 돌고, pointer 주변에서는 밀려나며 감긴다.
  const baseRadius = new Float32Array(DUST_COUNT);
  const baseAngle = new Float32Array(DUST_COUNT);
  const baseHeight = new Float32Array(DUST_COUNT);
  const offset = new Float32Array(DUST_COUNT * 3);
  const velocity = new Float32Array(DUST_COUNT * 3);
  const dustPositions = new Float32Array(DUST_COUNT * 3);
  const dustColors = new Float32Array(DUST_COUNT * 3);
  const ivory = color("--ivory");
  const tints = [ivory, ivory, ivory, ...definition.tints.map((name) => color(name))];
  for (let index = 0; index < DUST_COUNT; index += 1) {
    baseRadius[index] = 0.9 + Math.random() ** 0.55 * 7.4;
    baseAngle[index] = Math.random() * Math.PI * 2;
    baseHeight[index] = (Math.random() * 2 - 1) * 3.8;
    setColor(dustColors, index, tints[Math.floor(Math.random() * tints.length)], 0.3 + Math.random() * 0.45);
  }
  const dust = glowPoints(context, dustPositions, dustColors, 0.045);
  scene.add(dust.points);

  const pointer = new Vector2(9, 9);
  const flat = new Plane(new Vector3(0, 0, 1), 0);
  const tilt = { x: 0, y: 0 };
  const frame: Frame = {
    time: 0,
    elapsed: 0,
    delta: 0.016,
    wake: 0,
    beat: 0,
    inside: false,
    cursor: new Vector3(99, 99, 0),
    raycaster: new Raycaster(),
    pointerPixels: { x: -9999, y: -9999 },
    width: 1,
    height: 1,
    camera,
    reduceMotion,
  };
  let touchTimer = 0;
  let visible = true;
  let running = false;
  const clock = new Clock();

  const leave = (): void => {
    frame.inside = false;
    frame.pointerPixels.x = -9999;
    frame.pointerPixels.y = -9999;
  };
  const controller = new AbortController();
  const { signal } = controller;
  stage.addEventListener(
    "pointermove",
    (event) => {
      const bounds = stage.getBoundingClientRect();
      frame.pointerPixels.x = event.clientX - bounds.left;
      frame.pointerPixels.y = event.clientY - bounds.top;
      pointer.set((frame.pointerPixels.x / bounds.width) * 2 - 1, -((frame.pointerPixels.y / bounds.height) * 2 - 1));
      frame.inside = true;
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
      frame.beat = 1;
      if (event.pointerType !== "mouse") {
        // touch에는 hover가 없으므로, 누른 뒤 잠시 깨어 있다가 다시 잠든다.
        const bounds = stage.getBoundingClientRect();
        pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -(((event.clientY - bounds.top) / bounds.height) * 2 - 1));
        frame.inside = true;
        window.clearTimeout(touchTimer);
        touchTimer = window.setTimeout(leave, 2400);
      }
      if (reduceMotion) step(0.016);
    },
    { signal },
  );

  function step(delta: number): void {
    frame.delta = delta;
    frame.wake += ((frame.inside ? 1 : 0) - frame.wake) * Math.min(1, delta * (frame.inside ? 2.2 : 0.9));
    frame.time += delta * (SLEEP_SPEED + frame.wake * (1 - SLEEP_SPEED));
    frame.elapsed = clock.elapsedTime;
    frame.beat = Math.max(0, frame.beat - delta * 1.3);

    frame.raycaster.setFromCamera(pointer, camera);
    frame.raycaster.ray.intersectPlane(flat, frame.cursor);
    tilt.x += ((frame.inside ? pointer.x : 0) - tilt.x) * Math.min(1, delta * 2.5);
    tilt.y += ((frame.inside ? pointer.y : 0) - tilt.y) * Math.min(1, delta * 2.5);
    world.rotation.y = tilt.x * 0.4;
    world.rotation.x = -tilt.y * 0.26;

    update(frame);

    const reach = 2.1;
    const spin = frame.time * 0.025;
    const spring = 7;
    const damping = Math.exp(-delta * 4.5);
    for (let index = 0; index < DUST_COUNT; index += 1) {
      const angle = baseAngle[index] + spin * (1.6 / (0.6 + baseRadius[index] * 0.3));
      const baseX = Math.cos(angle) * baseRadius[index];
      const baseZ = Math.sin(angle) * baseRadius[index];
      const cell = index * 3;
      if (frame.wake > 0.01 && !reduceMotion) {
        const dx = baseX + offset[cell] - frame.cursor.x;
        const dy = baseHeight[index] + offset[cell + 1] - frame.cursor.y;
        const squared = dx * dx + dy * dy;
        if (squared < reach * reach) {
          const distance = Math.sqrt(squared) + 0.0001;
          const force = (1 - distance / reach) * frame.wake * delta * 6;
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
    dust.geometry.attributes.position.needsUpdate = true;
    dust.material.opacity = 0.6 + frame.wake * 0.3;
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

  function fit(): void {
    frame.width = stage.clientWidth || 1;
    frame.height = stage.clientHeight || 1;
    renderer.setSize(frame.width, frame.height, false);
    camera.aspect = frame.width / frame.height;
    // 좁은 화면에서도 장면의 가로 끝이 잘리지 않도록 가로 시야를 지킨다.
    camera.position.set(0, 0, Math.max(11, 9.6 / camera.aspect + 4.4));
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(() => {
    fit();
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

  fit();
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
