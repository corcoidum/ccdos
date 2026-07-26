// 용어 표시는 승인된 glossary.json이 결정한다. 브라우저는 추론하지 않고, 빌드가 정한
// (기록, 용어, alias) 조합만 첫 등장 위치에 표시한다. ADR-0008.
export type GlossaryTerm = {
  id: string;
  title: string;
  summary: string;
  aliases: string[];
};

export type GlossaryMention = {
  note: string;
  term: string;
  alias: string;
  context: string;
};

export type PublicGlossary = {
  version: number;
  terms: GlossaryTerm[];
  mentions: GlossaryMention[];
};

export type GlossarySegment = { text: string } | { text: string; term: GlossaryTerm };

export function isTermSegment(
  segment: GlossarySegment,
): segment is { text: string; term: GlossaryTerm } {
  return "term" in segment;
}

export function termsByNote(glossary: PublicGlossary): ReadonlyMap<string, GlossaryMention[]> {
  const byNote = new Map<string, GlossaryMention[]>();
  for (const mention of glossary.mentions) {
    const existing = byNote.get(mention.note);
    if (existing) {
      existing.push(mention);
    } else {
      byNote.set(mention.note, [mention]);
    }
  }
  return byNote;
}

/**
 * 한 문단을 표시 구간과 일반 텍스트로 나눈다.
 *
 * 빌드가 기록 전체에서 첫 등장 1회만 남기므로, 여기서도 alias마다 첫 등장만 사용하고
 * 이미 사용한 alias는 다시 쓰지 않는다. 표시 구간은 alias까지만이며 뒤따르는 조사는
 * 구간 밖에 남는다.
 */
export function glossarySegments(
  paragraph: string,
  mentions: readonly GlossaryMention[],
  termsById: ReadonlyMap<string, GlossaryTerm>,
  consumed: Set<string>,
): GlossarySegment[] {
  type Span = { start: number; end: number; term: GlossaryTerm };
  const spans: Span[] = [];

  // 긴 alias가 먼저 구간을 차지해야 그 안에 든 짧은 alias가 겹치지 않는다.
  const ordered = [...mentions].sort(
    (left, right) => right.alias.length - left.alias.length || left.alias.localeCompare(right.alias),
  );
  for (const mention of ordered) {
    if (consumed.has(mention.term)) {
      continue;
    }
    const term = termsById.get(mention.term);
    if (!term) {
      continue;
    }
    // 빌드와 같은 규칙: 첫 등장이 더 긴 용어에 먹히면 겹치지 않는 다음 등장을 쓴다.
    for (let start = paragraph.indexOf(mention.alias); start !== -1; ) {
      const end = start + mention.alias.length;
      if (!spans.some((span) => start < span.end && span.start < end)) {
        spans.push({ start, end, term });
        consumed.add(mention.term);
        break;
      }
      start = paragraph.indexOf(mention.alias, start + 1);
    }
  }

  if (spans.length === 0) {
    return [{ text: paragraph }];
  }

  spans.sort((left, right) => left.start - right.start);
  const segments: GlossarySegment[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor) {
      segments.push({ text: paragraph.slice(cursor, span.start) });
    }
    segments.push({ text: paragraph.slice(span.start, span.end), term: span.term });
    cursor = span.end;
  }
  if (cursor < paragraph.length) {
    segments.push({ text: paragraph.slice(cursor) });
  }
  return segments;
}
