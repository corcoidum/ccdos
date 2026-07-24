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

function graphPositions(nodes: PublicGraphNode[]): Map<string, GraphPosition> {
  const positions = new Map<string, GraphPosition>();
  const centerX = 500;
  const centerY = 340;
  const radiusX = 385;
  const radiusY = 255;
  nodes.forEach((node, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(nodes.length, 1);
    positions.set(node.id, {
      x: centerX + radiusX * Math.cos(angle),
      y: centerY + radiusY * Math.sin(angle),
    });
  });
  return positions;
}

function edgeLine(
  source: GraphPosition,
  target: GraphPosition,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  const startPadding = 34;
  const endPadding = 40;
  return {
    x1: source.x + (dx / length) * startPadding,
    y1: source.y + (dy / length) * startPadding,
    x2: target.x - (dx / length) * endPadding,
    y2: target.y - (dy / length) * endPadding,
  };
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
  const positions = graphPositions(graphNodes);
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

  const layout = createElement("div", "knowledge-map-layout");
  const visualColumn = createElement("div", "knowledge-map-visual-column");
  const canvas = createElement("div", "knowledge-map-canvas");
  const svg = createSvgElement("svg");
  svg.classList.add("knowledge-map-svg");
  svg.setAttribute("viewBox", "0 0 1000 680");
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "승인된 공개 기록의 관계 지도");

  const definitions = createSvgElement("defs");
  const marker = createSvgElement("marker");
  marker.id = "knowledge-map-arrow";
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "8");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "7");
  marker.setAttribute("markerHeight", "7");
  marker.setAttribute("orient", "auto-start-reverse");
  const arrow = createSvgElement("path");
  arrow.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  marker.append(arrow);
  definitions.append(marker);
  svg.append(definitions);

  const edgeElements = new Map<string, SVGLineElement>();
  graph.edges.forEach((edge, index) => {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target || !graphNodeIds.has(edge.source) || !graphNodeIds.has(edge.target)) {
      return;
    }
    const coordinates = edgeLine(source, target);
    const line = createSvgElement("line");
    const key = `${edge.source}:${edge.target}:${edge.type}:${index}`;
    line.classList.add("knowledge-map-edge");
    line.dataset.source = edge.source;
    line.dataset.target = edge.target;
    line.dataset.type = edge.type;
    line.setAttribute("x1", String(coordinates.x1));
    line.setAttribute("y1", String(coordinates.y1));
    line.setAttribute("x2", String(coordinates.x2));
    line.setAttribute("y2", String(coordinates.y2));
    if (edge.type !== "related_to") {
      line.setAttribute("marker-end", "url(#knowledge-map-arrow)");
    } else {
      line.classList.add("is-undirected");
    }
    line.setAttribute("aria-hidden", "true");
    edgeElements.set(key, line);
    svg.append(line);
  });

  const nodeElements = new Map<string, SVGGElement>();
  graphNodes.forEach((node, index) => {
    const recordNumber = recordNumberFor(node, index);
    const position = positions.get(node.id);
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
    group.setAttribute("transform", `translate(${position.x} ${position.y})`);
    group.setAttribute("role", "button");
    group.setAttribute("tabindex", "0");
    group.setAttribute("aria-label", `${recordNumber}. ${node.label}`);
    const halo = createSvgElement("circle");
    halo.classList.add("knowledge-map-node-halo");
    halo.setAttribute("r", "34");
    const circle = createSvgElement("circle");
    circle.classList.add("knowledge-map-node-core");
    circle.setAttribute("r", "25");
    const label = createSvgElement("text");
    label.classList.add("knowledge-map-node-number");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("dominant-baseline", "central");
    label.textContent = String(recordNumber).padStart(2, "0");
    group.append(halo, circle, label);
    nodeElements.set(node.id, group);
    svg.append(group);
  });
  canvas.append(svg);

  const legend = createElement("ul", "knowledge-map-legend");
  for (const [className, label] of [
    ["is-directed", "화살표 · 선언된 방향 관계"],
    ["is-undirected", "직선 · related_to 양방향 해석"],
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
  layout.append(visualColumn, details);
  root.append(controls, layout);

  let activeValue = "all";
  let activeRelation: "all" | RelationType = "all";
  let selectedId: string | null = graphNodes[0]?.id ?? null;
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

  const renderState = (): void => {
    const visibleIds = visibleNodeIds();
    if (!selectedId || !visibleIds.has(selectedId)) {
      selectedId = graphNodes.find((node) => visibleIds.has(node.id))?.id ?? null;
    }
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
      const active = visible && (source === selectedId || target === selectedId);
      line.classList.toggle("is-hidden", !visible);
      line.classList.toggle("is-active", active);
      line.classList.toggle("is-muted", visible && source !== selectedId && target !== selectedId);
      if (visible) {
        visibleEdgeCount += 1;
        if (source === selectedId) connectedIds.add(target);
        if (target === selectedId) connectedIds.add(source);
      }
    }
    for (const [nodeId, group] of nodeElements) {
      const visible = visibleIds.has(nodeId);
      group.classList.toggle("is-hidden", !visible);
      group.classList.toggle("is-selected", nodeId === selectedId);
      group.classList.toggle("is-connected", connectedIds.has(nodeId));
      group.classList.toggle(
        "is-muted",
        visible && selectedId !== null && nodeId !== selectedId && !connectedIds.has(nodeId),
      );
      group.setAttribute("aria-pressed", String(nodeId === selectedId));
      group.setAttribute("aria-hidden", String(!visible));
      group.setAttribute("tabindex", visible ? "0" : "-1");
    }
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

  renderState();
  return root;
}
