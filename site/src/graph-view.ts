import { publicRecordNumbers, type PublicNote } from "./search";

export type RelationType =
  | "related_to"
  | "builds_on"
  | "supports"
  | "demonstrates"
  | "implemented_by"
  | "uses";

export type RelationDirection = "incoming" | "outgoing" | "undirected";

export type PublicGraphNode = {
  id: string;
  type: "note";
  label: string;
  url: string;
  tags: string[];
  state: "approved" | "published";
  updated: string;
  published_at: string | null;
  backlinks: Array<{ source: string; type: RelationType }>;
  related_notes: string[];
};

export type PublicGraph = {
  version: number;
  nodes: PublicGraphNode[];
  edges: Array<{ source: string; target: string; type: RelationType }>;
};

export type GraphConnection = {
  note: PublicNote;
  type: RelationType;
  direction: RelationDirection;
};

type KnowledgeMapOptions = {
  graph: PublicGraph;
  notes: PublicNote[];
  onOpenNote: (note: PublicNote, trigger: HTMLElement) => void;
};

type GraphPosition = {
  x: number;
  y: number;
};

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const VALUE_TAGS = ["hope", "trust", "mercy", "love"] as const;
const INDEX_PAGE_SIZE = 4;
type ValueTag = (typeof VALUE_TAGS)[number];
const RELATION_TYPES: readonly RelationType[] = [
  "related_to",
  "builds_on",
  "supports",
  "demonstrates",
  "implemented_by",
  "uses",
];

const relationLabels: Record<
  RelationType,
  Record<RelationDirection, string>
> = {
  related_to: {
    incoming: "관련 기록",
    outgoing: "관련 기록",
    undirected: "관련 기록",
  },
  builds_on: {
    incoming: "이 기록에서 이어짐",
    outgoing: "이 기록의 기반",
    undirected: "생각을 발전시킨 관계",
  },
  supports: {
    incoming: "이 기록을 뒷받침함",
    outgoing: "이 기록이 뒷받침하는 대상",
    undirected: "서로 뒷받침하는 관계",
  },
  demonstrates: {
    incoming: "이 기록을 보여 주는 사례",
    outgoing: "이 기록이 보여 주는 원칙",
    undirected: "사례와 원칙의 관계",
  },
  implemented_by: {
    incoming: "이 기록이 구현한 개념",
    outgoing: "이 기록을 구현함",
    undirected: "개념과 구현의 관계",
  },
  uses: {
    incoming: "이 기록을 사용함",
    outgoing: "이 기록이 사용함",
    undirected: "사용 관계",
  },
};

const relationFilterLabels: Record<RelationType, string> = {
  related_to: "related_to · 관련",
  builds_on: "builds_on · 발전",
  supports: "supports · 뒷받침",
  demonstrates: "demonstrates · 사례",
  implemented_by: "implemented_by · 구현",
  uses: "uses · 사용",
};

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NAMESPACE, tag);
}

export function relationLabel(type: RelationType, direction: RelationDirection): string {
  return relationLabels[type][direction];
}

export function connectionsForNote(
  graph: PublicGraph,
  notesById: ReadonlyMap<string, PublicNote>,
  noteId: string,
): GraphConnection[] {
  const connections: GraphConnection[] = [];
  for (const edge of graph.edges) {
    let targetId: string | null = null;
    let direction: RelationDirection | null = null;
    if (edge.type === "related_to" && (edge.source === noteId || edge.target === noteId)) {
      targetId = edge.source === noteId ? edge.target : edge.source;
      direction = "undirected";
    } else if (edge.source === noteId) {
      targetId = edge.target;
      direction = "outgoing";
    } else if (edge.target === noteId) {
      targetId = edge.source;
      direction = "incoming";
    }
    if (!targetId || !direction || targetId === noteId) {
      continue;
    }
    const note = notesById.get(targetId);
    if (note) {
      connections.push({ note, type: edge.type, direction });
    }
  }
  return connections.sort(
    (left, right) =>
      left.note.id.localeCompare(right.note.id) ||
      left.type.localeCompare(right.type) ||
      left.direction.localeCompare(right.direction),
  );
}

type LayoutNode = GraphPosition & { id: string; vx: number; vy: number; radius: number; pinned: boolean };

type GraphLayout = {
  nodes: Map<string, LayoutNode>;
  tick: (alpha: number) => void;
};

type ViewSize = { width: number; height: number };

const WIDE_VIEW: ViewSize = { width: 1000, height: 680 };
const NARROW_VIEW: ViewSize = { width: 680, height: 680 };
const TITLE_LIMIT = 18;

/** 연결이 많은 기록일수록 크게 그린다. */
function nodeRadius(degree: number): number {
  return Math.min(13 + Math.sqrt(degree) * 4.5, 30);
}

/**
 * 연결된 기록은 서로 당기고 모든 기록은 서로 밀어내는 force layout.
 * 시작 위치와 계산이 모두 결정론적이라, 같은 graph.json은 언제나 같은 모양으로 놓인다.
 */
function createLayout(
  nodes: PublicGraphNode[],
  edges: ReadonlyArray<{ source: string; target: string }>,
  view: ViewSize,
): GraphLayout {
  const centerX = view.width / 2;
  const centerY = view.height / 2;
  const degrees = new Map<string, number>();
  for (const edge of edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
  }
  const layoutNodes = new Map<string, LayoutNode>();
  nodes.forEach((node, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(nodes.length, 1);
    layoutNodes.set(node.id, {
      id: node.id,
      x: centerX + view.width * 0.3 * Math.cos(angle),
      y: centerY + view.height * 0.3 * Math.sin(angle),
      vx: 0,
      vy: 0,
      radius: nodeRadius(degrees.get(node.id) ?? 0),
      pinned: false,
    });
  });
  const list = [...layoutNodes.values()];
  const links = edges
    .map((edge) => ({ source: layoutNodes.get(edge.source), target: layoutNodes.get(edge.target) }))
    .filter((link): link is { source: LayoutNode; target: LayoutNode } => Boolean(link.source && link.target));
  // 가로로 넓은 화면에서는 세로로 더 강하게 모아, 지도가 화면 비율을 따라 퍼지게 한다.
  const gravityY = view.width / view.height;

  const tick = (alpha: number): void => {
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j += 1) {
        const b = list[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy);
        if (distance < 0.01) {
          // 겹친 두 점은 index로 정한 방향으로 떼어, 난수 없이도 풀리게 한다.
          dx = (i % 2 === 0 ? 1 : -1) * 0.5;
          dy = 0.5;
          distance = Math.hypot(dx, dy);
        }
        const repel = (alpha * 5200) / (distance * distance);
        const gap = a.radius + b.radius + 22;
        const overlap = distance < gap ? (gap - distance) * 0.5 : 0;
        const push = repel + overlap;
        const ux = dx / distance;
        const uy = dy / distance;
        a.vx -= ux * push;
        a.vy -= uy * push;
        b.vx += ux * push;
        b.vy += uy * push;
      }
    }
    for (const { source, target } of links) {
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.hypot(dx, dy) || 1;
      const rest = 96 + source.radius + target.radius;
      const pull = alpha * 0.07 * (distance - rest);
      source.vx += (dx / distance) * pull;
      source.vy += (dy / distance) * pull;
      target.vx -= (dx / distance) * pull;
      target.vy -= (dy / distance) * pull;
    }
    for (const node of list) {
      node.vx += (centerX - node.x) * alpha * 0.014;
      node.vy += (centerY - node.y) * alpha * 0.014 * gravityY;
      node.vx *= 0.8;
      node.vy *= 0.8;
      if (!node.pinned) {
        node.x += node.vx;
        node.y += node.vy;
      }
    }
  };

  for (let step = 0; step < 420; step += 1) {
    tick(Math.max(0.02, 1 - step / 380));
  }

  // 계산된 모양을 화면 안에 맞춘다. 이름표가 붙을 아래쪽 여백을 조금 더 남긴다.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const node of list) {
    minX = Math.min(minX, node.x - node.radius);
    maxX = Math.max(maxX, node.x + node.radius);
    minY = Math.min(minY, node.y - node.radius);
    maxY = Math.max(maxY, node.y + node.radius + 20);
  }
  // 좁은 화면에서는 오른쪽 아래의 확대 버튼이 기록을 가리지 않도록 아래를 더 비운다.
  const bottomReserve = view.width === view.height ? 64 : 0;
  if (list.length > 0) {
    const margin = 44;
    const scale = Math.min(
      (view.width - margin * 2) / Math.max(maxX - minX, 1),
      (view.height - margin * 2 - bottomReserve) / Math.max(maxY - minY, 1),
      1.3,
    );
    for (const node of list) {
      node.x = centerX + (node.x - (minX + maxX) / 2) * scale;
      node.y = centerY - bottomReserve / 2 + (node.y - (minY + maxY) / 2) * scale;
      node.vx = 0;
      node.vy = 0;
    }
  }
  return { nodes: layoutNodes, tick };
}

function edgeLine(
  source: LayoutNode,
  target: LayoutNode,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  const startPadding = source.radius + 5;
  const endPadding = target.radius + 10;
  return {
    x1: source.x + (dx / length) * startPadding,
    y1: source.y + (dy / length) * startPadding,
    x2: target.x - (dx / length) * endPadding,
    y2: target.y - (dy / length) * endPadding,
  };
}

function shortTitle(title: string): string {
  return title.length > TITLE_LIMIT ? `${title.slice(0, TITLE_LIMIT - 1)}…` : title;
}

function directionSymbol(direction: RelationDirection): string {
  return direction === "incoming" ? "←" : direction === "outgoing" ? "→" : "↔";
}

function valueTagFor(tags: readonly string[]): ValueTag | null {
  return VALUE_TAGS.find((value) => tags.includes(value)) ?? null;
}

export function createKnowledgeMap({
  graph,
  notes,
  onOpenNote,
}: KnowledgeMapOptions): HTMLElement {
  const notesById = new Map(notes.map((note) => [note.id, note]));
  const recordNumbers = publicRecordNumbers(notes);
  const graphNodes = [...graph.nodes]
    .filter((node) => notesById.has(node.id))
    .sort(
      (left, right) =>
        (recordNumbers.get(right.id) ?? 0) - (recordNumbers.get(left.id) ?? 0) ||
        left.id.localeCompare(right.id),
    );
  const graphNodeIds = new Set(graphNodes.map((node) => node.id));
  const recordNumberFor = (node: PublicGraphNode, index: number): number =>
    recordNumbers.get(node.id) ?? graphNodes.length - index;
  // 좁은 화면에서는 정사각형 무대에 맞춰 배치해 점이 지나치게 작아지지 않게 한다.
  const view = window.matchMedia("(max-width: 760px)").matches ? NARROW_VIEW : WIDE_VIEW;
  const visibleEdges = graph.edges.filter(
    (edge) => graphNodeIds.has(edge.source) && graphNodeIds.has(edge.target),
  );
  const layout = createLayout(graphNodes, visibleEdges, view);
  const root = createElement("div", "knowledge-map-interface");
  root.dataset.swipeIgnore = "";

  const controls = createElement("div", "knowledge-map-controls");
  const valueField = createElement("label", "knowledge-map-field");
  valueField.append(createElement("span", undefined, "Living Value"));
  const valueSelect = createElement("select", "knowledge-map-select");
  valueSelect.setAttribute("aria-label", "Living Value 필터");
  valueSelect.append(new Option("모든 가치", "all"));
  for (const value of VALUE_TAGS) {
    valueSelect.append(new Option(value.toUpperCase(), value));
  }
  valueField.append(valueSelect);

  const relationField = createElement("label", "knowledge-map-field");
  relationField.append(createElement("span", undefined, "Relation"));
  const relationSelect = createElement("select", "knowledge-map-select");
  relationSelect.setAttribute("aria-label", "Relation type 필터");
  relationSelect.append(new Option("모든 관계", "all"));
  for (const type of RELATION_TYPES) {
    relationSelect.append(new Option(relationFilterLabels[type], type));
  }
  relationField.append(relationSelect);

  const status = createElement("p", "knowledge-map-status");
  status.setAttribute("aria-live", "polite");
  controls.append(valueField, relationField, status);

  const mapLayout = createElement("div", "knowledge-map-layout");
  const visualColumn = createElement("div", "knowledge-map-visual-column");
  const canvas = createElement("div", "knowledge-map-canvas");
  const svg = createSvgElement("svg");
  svg.classList.add("knowledge-map-svg");
  svg.setAttribute("viewBox", `0 0 ${view.width} ${view.height}`);
  svg.style.aspectRatio = `${view.width} / ${view.height}`;
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "승인된 공개 기록의 관계 지도");

  const definitions = createSvgElement("defs");
  const marker = createSvgElement("marker");
  marker.id = "knowledge-map-arrow";
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "8");
  marker.setAttribute("refY", "5");
  // 선 굵기와 무관하게 화살촉 크기를 고정한다.
  marker.setAttribute("markerUnits", "userSpaceOnUse");
  marker.setAttribute("markerWidth", "11");
  marker.setAttribute("markerHeight", "11");
  marker.setAttribute("orient", "auto-start-reverse");
  const arrow = createSvgElement("path");
  arrow.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  marker.append(arrow);
  definitions.append(marker);
  // 확대·이동은 이 묶음 하나의 transform으로 처리한다.
  const viewport = createSvgElement("g");
  viewport.classList.add("knowledge-map-viewport");
  svg.append(definitions, viewport);

  const edgeElements = new Map<string, SVGLineElement>();
  graph.edges.forEach((edge, index) => {
    if (!layout.nodes.has(edge.source) || !layout.nodes.has(edge.target)) {
      return;
    }
    const line = createSvgElement("line");
    const key = `${edge.source}:${edge.target}:${edge.type}:${index}`;
    line.classList.add("knowledge-map-edge");
    line.dataset.source = edge.source;
    line.dataset.target = edge.target;
    line.dataset.type = edge.type;
    if (edge.type !== "related_to") {
      line.setAttribute("marker-end", "url(#knowledge-map-arrow)");
    } else {
      line.classList.add("is-undirected");
    }
    line.setAttribute("aria-hidden", "true");
    edgeElements.set(key, line);
    viewport.append(line);
  });

  const nodeElements = new Map<string, SVGGElement>();
  graphNodes.forEach((node, index) => {
    const recordNumber = recordNumberFor(node, index);
    const position = layout.nodes.get(node.id);
    if (!position) {
      return;
    }
    const group = createSvgElement("g");
    group.classList.add("knowledge-map-node");
    group.dataset.nodeId = node.id;
    const valueTag = valueTagFor(node.tags);
    if (valueTag) {
      group.dataset.value = valueTag;
    }
    group.setAttribute("role", "button");
    group.setAttribute("tabindex", "0");
    group.setAttribute("aria-label", `${recordNumber}. ${node.label}`);
    const halo = createSvgElement("circle");
    halo.classList.add("knowledge-map-node-halo");
    halo.setAttribute("r", String(position.radius + 9));
    const circle = createSvgElement("circle");
    circle.classList.add("knowledge-map-node-core");
    circle.setAttribute("r", String(position.radius));
    const label = createSvgElement("text");
    label.classList.add("knowledge-map-node-number");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("dominant-baseline", "central");
    label.style.fontSize = `${Math.max(10, position.radius * 0.6).toFixed(1)}px`;
    label.textContent = String(recordNumber).padStart(2, "0");
    // 제목은 가리키거나 선택했을 때, 그리고 확대했을 때만 보인다.
    const title = createSvgElement("text");
    title.classList.add("knowledge-map-node-title");
    title.setAttribute("text-anchor", "middle");
    title.setAttribute("y", String(position.radius + 18));
    title.setAttribute("aria-hidden", "true");
    title.textContent = shortTitle(node.label);
    group.append(halo, circle, label, title);
    nodeElements.set(node.id, group);
    viewport.append(group);
  });

  const placeElements = (): void => {
    for (const [nodeId, group] of nodeElements) {
      const position = layout.nodes.get(nodeId);
      if (position) {
        group.setAttribute("transform", `translate(${position.x.toFixed(1)} ${position.y.toFixed(1)})`);
      }
    }
    for (const line of edgeElements.values()) {
      const source = layout.nodes.get(line.dataset.source ?? "");
      const target = layout.nodes.get(line.dataset.target ?? "");
      if (!source || !target) {
        continue;
      }
      const coordinates = edgeLine(source, target);
      line.setAttribute("x1", coordinates.x1.toFixed(1));
      line.setAttribute("y1", coordinates.y1.toFixed(1));
      line.setAttribute("x2", coordinates.x2.toFixed(1));
      line.setAttribute("y2", coordinates.y2.toFixed(1));
    }
  };
  placeElements();

  const zoomControls = createElement("div", "knowledge-map-zoom");
  zoomControls.setAttribute("role", "group");
  zoomControls.setAttribute("aria-label", "지도 확대와 축소");
  const zoomInButton = createElement("button", "knowledge-map-zoom-button", "+");
  zoomInButton.type = "button";
  zoomInButton.setAttribute("aria-label", "지도 확대");
  const zoomOutButton = createElement("button", "knowledge-map-zoom-button", "−");
  zoomOutButton.type = "button";
  zoomOutButton.setAttribute("aria-label", "지도 축소");
  const zoomResetButton = createElement("button", "knowledge-map-zoom-button knowledge-map-zoom-reset", "맞춤");
  zoomResetButton.type = "button";
  zoomResetButton.setAttribute("aria-label", "지도를 처음 크기로 맞춤");
  zoomControls.append(zoomInButton, zoomOutButton, zoomResetButton);
  canvas.append(svg, zoomControls);

  const legend = createElement("ul", "knowledge-map-legend");
  for (const [className, label] of [
    ["is-directed", "화살표 · 선언된 방향 관계"],
    ["is-undirected", "점선 · related_to 양방향 해석"],
  ]) {
    const item = createElement("li");
    item.append(createElement("span", `knowledge-map-legend-line ${className}`), document.createTextNode(label));
    legend.append(item);
  }

  const indexHeading = createElement("h3", "knowledge-map-index-title", "공개 기록 목록");
  const indexList = createElement("ol", "knowledge-map-index");
  indexList.id = "knowledge-map-index-list";
  const indexButtons = new Map<string, HTMLButtonElement>();
  graphNodes.forEach((node, index) => {
    const recordNumber = recordNumberFor(node, index);
    const item = createElement("li");
    const button = createElement("button", "knowledge-map-index-button");
    button.type = "button";
    button.dataset.nodeId = node.id;
    const valueTag = valueTagFor(node.tags);
    if (valueTag) {
      button.dataset.value = valueTag;
    }
    button.append(
      createElement("span", "knowledge-map-index-number", String(recordNumber).padStart(2, "0")),
      createElement("span", "knowledge-map-index-label", node.label),
    );
    item.append(button);
    indexList.append(item);
    indexButtons.set(node.id, button);
  });
  const indexFooter = createElement("div", "knowledge-map-index-footer");
  const indexProgress = createElement("p", "knowledge-map-index-progress");
  indexProgress.setAttribute("aria-live", "polite");
  const indexMoreButton = createElement("button", "knowledge-map-index-more");
  indexMoreButton.type = "button";
  indexMoreButton.setAttribute("aria-controls", indexList.id);
  indexFooter.append(indexProgress, indexMoreButton);
  visualColumn.append(canvas, legend, indexHeading, indexList, indexFooter);

  const details = createElement("aside", "knowledge-map-details");
  details.setAttribute("aria-live", "polite");
  mapLayout.append(visualColumn, details);
  root.append(controls, mapLayout);

  let activeValue = "all";
  let activeRelation: "all" | RelationType = "all";
  let selectedId: string | null = graphNodes[0]?.id ?? null;
  // 가리키는 동안에는 그 기록의 이웃을 미리 보여 주고, 선택은 바꾸지 않는다.
  let hoveredId: string | null = null;
  let visibleIndexCount = INDEX_PAGE_SIZE;

  const visibleNodes = (): PublicGraphNode[] =>
    graphNodes.filter((node) => activeValue === "all" || node.tags.includes(activeValue));

  const visibleNodeIds = (): Set<string> => new Set(visibleNodes().map((node) => node.id));

  const renderDetails = (visibleIds: Set<string>): void => {
    const note = selectedId ? notesById.get(selectedId) : undefined;
    const node = selectedId ? graphNodes.find((candidate) => candidate.id === selectedId) : undefined;
    if (!note || !node) {
      details.replaceChildren(
        createElement("p", "eyebrow", "선택된 기록"),
        createElement("p", "knowledge-map-empty", "현재 필터에 표시할 공개 기록이 없습니다."),
      );
      return;
    }
    const meta = createElement(
      "p",
      "knowledge-map-detail-meta",
      `${node.state} · ${new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(node.published_at ?? node.updated))}`,
    );
    const title = createElement("h3", "knowledge-map-detail-title", note.title);
    const tags = createElement("div", "tag-list");
    for (const tag of note.tags) {
      tags.append(createElement("span", "tag", `#${tag}`));
    }
    const openButton = createElement("button", "action-link action-link--primary", "전문 읽기");
    openButton.type = "button";
    openButton.addEventListener("click", () => onOpenNote(note, openButton));

    const connectionHeading = createElement("h4", "knowledge-map-connections-title", "직접 연결");
    const connectionList = createElement("ul", "knowledge-map-connections");
    const connections = connectionsForNote(graph, notesById, note.id).filter(
      (connection) =>
        visibleIds.has(connection.note.id) &&
        (activeRelation === "all" || connection.type === activeRelation),
    );
    if (connections.length === 0) {
      connectionList.append(
        createElement("li", "knowledge-map-empty", "현재 필터에서 직접 연결된 기록이 없습니다."),
      );
    } else {
      for (const connection of connections) {
        const item = createElement("li");
        const button = createElement("button", "knowledge-map-connection-button");
        button.type = "button";
        button.dataset.nodeId = connection.note.id;
        button.append(
          createElement("span", "knowledge-map-connection-direction", directionSymbol(connection.direction)),
          createElement("span", "knowledge-map-connection-note", connection.note.title),
          createElement(
            "span",
            "knowledge-map-connection-type",
            relationLabel(connection.type, connection.direction),
          ),
        );
        button.addEventListener("click", () => selectNode(connection.note.id, true));
        item.append(button);
        connectionList.append(item);
      }
    }
    details.replaceChildren(
      createElement("p", "eyebrow", "선택된 기록"),
      meta,
      title,
      tags,
      openButton,
      connectionHeading,
      connectionList,
    );
  };

  const renderHighlight = (visibleIds: Set<string>): number => {
    // 가리키는 동안에만 나머지를 흐리게 한다. 선택만 한 상태에서는 지도 전체가 또렷하게 남는다.
    const hovering = hoveredId !== null && visibleIds.has(hoveredId);
    const focusId = hovering ? hoveredId : selectedId;
    let visibleEdgeCount = 0;
    const connectedIds = new Set<string>();
    for (const line of edgeElements.values()) {
      const source = line.dataset.source ?? "";
      const target = line.dataset.target ?? "";
      const type = line.dataset.type as RelationType;
      const visible =
        visibleIds.has(source) &&
        visibleIds.has(target) &&
        (activeRelation === "all" || type === activeRelation);
      const active = visible && (source === focusId || target === focusId);
      line.classList.toggle("is-hidden", !visible);
      line.classList.toggle("is-active", active);
      line.classList.toggle("is-muted", hovering && visible && !active);
      if (visible) {
        visibleEdgeCount += 1;
        if (source === focusId) connectedIds.add(target);
        if (target === focusId) connectedIds.add(source);
      }
    }
    for (const [nodeId, group] of nodeElements) {
      const visible = visibleIds.has(nodeId);
      group.classList.toggle("is-hidden", !visible);
      group.classList.toggle("is-selected", nodeId === selectedId);
      group.classList.toggle("is-hovered", nodeId === hoveredId);
      group.classList.toggle("is-connected", connectedIds.has(nodeId));
      group.classList.toggle(
        "is-muted",
        hovering && visible && nodeId !== focusId && nodeId !== selectedId && !connectedIds.has(nodeId),
      );
      group.setAttribute("aria-pressed", String(nodeId === selectedId));
      group.setAttribute("aria-hidden", String(!visible));
      group.setAttribute("tabindex", visible ? "0" : "-1");
    }
    return visibleEdgeCount;
  };

  const renderState = (): void => {
    const visibleIds = visibleNodeIds();
    if (!selectedId || !visibleIds.has(selectedId)) {
      selectedId = graphNodes.find((node) => visibleIds.has(node.id))?.id ?? null;
    }
    const visibleEdgeCount = renderHighlight(visibleIds);
    const filteredNodes = visibleNodes();
    const revealedIds = new Set(
      filteredNodes.slice(0, visibleIndexCount).map((node) => node.id),
    );
    for (const [nodeId, button] of indexButtons) {
      const visible = visibleIds.has(nodeId);
      button.closest("li")!.hidden = !visible || !revealedIds.has(nodeId);
      button.classList.toggle("is-selected", nodeId === selectedId);
      button.setAttribute("aria-pressed", String(nodeId === selectedId));
    }
    const shownCount = Math.min(visibleIndexCount, filteredNodes.length);
    const remainingCount = Math.max(filteredNodes.length - shownCount, 0);
    indexProgress.textContent =
      filteredNodes.length === 0
        ? "표시할 공개 기록이 없습니다."
        : remainingCount > 0
          ? `최신 기록 ${shownCount} / ${filteredNodes.length}개 표시`
          : `공개 기록 ${filteredNodes.length}개 모두 표시`;
    indexMoreButton.hidden = remainingCount === 0;
    if (remainingCount > 0) {
      const nextCount = Math.min(INDEX_PAGE_SIZE, remainingCount);
      indexMoreButton.textContent = `다음 ${nextCount}개 기록 보기`;
      indexMoreButton.setAttribute(
        "aria-label",
        `공개 기록 ${nextCount}개 더 보기, ${remainingCount}개 남음`,
      );
    }
    status.textContent = `승인된 공개 기록 ${visibleIds.size}개 · 표시 관계 ${visibleEdgeCount}개`;
    renderDetails(visibleIds);
  };

  function selectNode(nodeId: string, focusMapNode = false): void {
    if (!visibleNodeIds().has(nodeId)) {
      return;
    }
    selectedId = nodeId;
    renderState();
    if (focusMapNode) {
      nodeElements.get(nodeId)?.focus();
    }
  }

  for (const [nodeId, group] of nodeElements) {
    group.addEventListener("click", () => selectNode(nodeId));
    group.addEventListener("focus", () => selectNode(nodeId));
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectNode(nodeId);
      }
    });
  }
  for (const [nodeId, button] of indexButtons) {
    button.addEventListener("click", () => selectNode(nodeId, true));
  }
  indexMoreButton.addEventListener("click", (event) => {
    const firstNewNode = visibleNodes()[visibleIndexCount];
    const moveFocusToNewItem = event.detail === 0;
    visibleIndexCount += INDEX_PAGE_SIZE;
    renderState();
    if (moveFocusToNewItem && firstNewNode) {
      indexButtons.get(firstNewNode.id)?.focus({ preventScroll: true });
    }
  });
  valueSelect.addEventListener("change", () => {
    activeValue = valueSelect.value;
    visibleIndexCount = INDEX_PAGE_SIZE;
    renderState();
  });
  relationSelect.addEventListener("change", () => {
    activeRelation = relationSelect.value as "all" | RelationType;
    renderState();
  });

  // ---- 확대·이동·끌기 ----
  const MIN_ZOOM = 0.6;
  const MAX_ZOOM = 3;
  const camera = { x: 0, y: 0, scale: 1 };
  const applyCamera = (): void => {
    viewport.setAttribute(
      "transform",
      `translate(${camera.x.toFixed(1)} ${camera.y.toFixed(1)}) scale(${camera.scale.toFixed(3)})`,
    );
    svg.classList.toggle("is-zoomed", camera.scale >= 1.45);
    zoomResetButton.disabled = camera.scale === 1 && camera.x === 0 && camera.y === 0;
  };
  const viewPoint = (event: { clientX: number; clientY: number }): GraphPosition => {
    const bounds = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * view.width,
      y: ((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * view.height,
    };
  };
  const zoomAt = (point: GraphPosition, factor: number): void => {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.scale * factor));
    const ratio = next / camera.scale;
    camera.x = point.x - (point.x - camera.x) * ratio;
    camera.y = point.y - (point.y - camera.y) * ratio;
    camera.scale = next;
    applyCamera();
  };
  const viewCenter = { x: view.width / 2, y: view.height / 2 };
  zoomInButton.addEventListener("click", () => zoomAt(viewCenter, 1.3));
  zoomOutButton.addEventListener("click", () => zoomAt(viewCenter, 1 / 1.3));
  zoomResetButton.addEventListener("click", () => {
    camera.x = 0;
    camera.y = 0;
    camera.scale = 1;
    applyCamera();
  });
  // 페이지 스크롤을 가로채지 않도록, 휠 확대는 Ctrl/⌘(트랙패드 pinch 포함)와 함께일 때만 받는다.
  svg.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      zoomAt(viewPoint(event), Math.exp(-event.deltaY * 0.01));
    },
    { passive: false },
  );

  type Gesture =
    | { kind: "pan"; pointerId: number; start: GraphPosition; origin: GraphPosition }
    | { kind: "node"; pointerId: number; node: LayoutNode; moved: boolean; start: GraphPosition };
  let gesture: Gesture | null = null;
  svg.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || gesture) {
      return;
    }
    const point = viewPoint(event);
    const group = (event.target as Element).closest<SVGGElement>(".knowledge-map-node");
    const node = group ? layout.nodes.get(group.dataset.nodeId ?? "") : undefined;
    gesture = node
      ? { kind: "node", pointerId: event.pointerId, node, moved: false, start: point }
      : { kind: "pan", pointerId: event.pointerId, start: point, origin: { x: camera.x, y: camera.y } };
  });
  svg.addEventListener("pointermove", (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    const point = viewPoint(event);
    if (gesture.kind === "pan") {
      camera.x = gesture.origin.x + point.x - gesture.start.x;
      camera.y = gesture.origin.y + point.y - gesture.start.y;
      svg.classList.add("is-panning");
      applyCamera();
      return;
    }
    if (!gesture.moved && Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) < 5) {
      return;
    }
    if (!gesture.moved) {
      gesture.moved = true;
      svg.setPointerCapture(event.pointerId);
      svg.classList.add("is-dragging");
    }
    // 끄는 기록은 손끝에 고정하고, 이어진 기록들이 따라오도록 몇 걸음만 다시 푼다.
    gesture.node.pinned = true;
    gesture.node.x = (point.x - camera.x) / camera.scale;
    gesture.node.y = (point.y - camera.y) / camera.scale;
    layout.tick(0.12);
    layout.tick(0.12);
    placeElements();
  });
  const endGesture = (event: PointerEvent): void => {
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    if (gesture.kind === "node") {
      gesture.node.pinned = false;
      gesture.node.vx = 0;
      gesture.node.vy = 0;
    }
    gesture = null;
    svg.classList.remove("is-panning", "is-dragging");
  };
  svg.addEventListener("pointerup", endGesture);
  svg.addEventListener("pointercancel", endGesture);

  for (const [nodeId, group] of nodeElements) {
    group.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse" || gesture) {
        return;
      }
      hoveredId = nodeId;
      renderHighlight(visibleNodeIds());
    });
    group.addEventListener("pointerleave", () => {
      if (hoveredId !== nodeId) {
        return;
      }
      hoveredId = null;
      renderHighlight(visibleNodeIds());
    });
  }

  applyCamera();
  renderState();
  return root;
}
