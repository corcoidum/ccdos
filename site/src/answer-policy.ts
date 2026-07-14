export const DEFAULT_DAILY_LIMIT = 200;

export type OpenAIResponsePayload = {
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

export function boundedDailyLimit(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 10_000 ? parsed : DEFAULT_DAILY_LIMIT;
}

export function hasValidCitations(answer: string, sources: Array<{ id: string }>): boolean {
  const allowedIds = new Set(sources.map(({ id }) => id));
  // 모든 대괄호 인용을 검사한다 — 허용 ID 형식(소문자 ASCII) 밖의 한글·대문자 인용도 위조로 간주해 거부한다.
  const citations = Array.from(answer.matchAll(/\[([^\][]*)\]/g), (match) => match[1]);
  return citations.length > 0 && citations.every((id) => allowedIds.has(id));
}

export function extractOpenAIText(payload: OpenAIResponsePayload): string {
  return (payload.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}
