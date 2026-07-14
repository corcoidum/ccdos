export type PublicNote = {
  id: string;
  title: string;
  updated: string;
  published_at?: string | null;
  tags: string[];
  state: "approved" | "published";
  body: string;
};

export type PublicContent = {
  version: number;
  notes: PublicNote[];
};

export type RankedNote = {
  note: PublicNote;
  score: number;
  excerpt: string;
};

const TOKEN_PATTERN = /[0-9A-Za-z가-힣_]+/g;
const PUBLISHABLE_STATES = new Set(["approved", "published"]);

export function tokenize(text: string): string[] {
  return (text.match(TOKEN_PATTERN) ?? []).map((token) => token.toLowerCase());
}

function countTokens(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

// 한국어 조사까지 붙은 token도 원형 검색어로 찾을 수 있게 prefix를 허용한다.
function prefixCount(counts: Map<string, number>, queryToken: string): number {
  let total = 0;
  for (const [token, count] of counts) {
    if (token.startsWith(queryToken)) {
      total += count;
    }
  }
  return total;
}

function scoreNote(note: PublicNote, queryTokens: string[]): number {
  const title = countTokens(tokenize(note.title));
  const tags = countTokens(tokenize(note.tags.join(" ")));
  const body = countTokens(tokenize(note.body));
  return queryTokens.reduce(
    (score, token) =>
      score + 4 * prefixCount(title, token) + 3 * prefixCount(tags, token) + prefixCount(body, token),
    0,
  );
}

export function excerptOf(body: string, queryTokens: string[], limit = 180): string {
  const normalized = body.split(/\s+/).join(" ");
  const lower = normalized.toLowerCase();
  const matchIndex =
    queryTokens.map((token) => lower.indexOf(token)).find((position) => position >= 0) ?? 0;
  const start = Math.max(matchIndex - 40, 0);
  const end = Math.min(start + limit, normalized.length);
  return `${start > 0 ? "…" : ""}${normalized.slice(start, end)}${end < normalized.length ? "…" : ""}`;
}

export function searchPublicNotes(
  content: PublicContent,
  query: string,
  limit = 5,
): RankedNote[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return [];
  }
  return content.notes
    .filter((note) => PUBLISHABLE_STATES.has(note.state))
    .map((note) => ({
      note,
      score: scoreNote(note, queryTokens),
      excerpt: excerptOf(note.body, queryTokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.note.updated.localeCompare(a.note.updated))
    .slice(0, limit);
}
