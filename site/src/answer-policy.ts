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

// Provider 실패를 진단 가능한 최소 정보로만 요약한다. 질문·출처·키는 절대 포함하지 않는다.
export class ProviderError extends Error {
  constructor(
    readonly kind: "http" | "timeout" | "network",
    readonly status?: number,
  ) {
    super(`provider ${kind}${status === undefined ? "" : ` ${status}`}`);
    this.name = "ProviderError";
  }
}

// Provider edge가 egress 위치에 따라 403을, 과부하 시 5xx를 준다. 둘 다
// 요청 내용과 무관한 일시적 실패이므로 폴백 전에 다시 시도할 가치가 있다.
// 429는 제외한다 — 재시도가 상황을 악화시킨다.
const RETRYABLE_STATUS = new Set([403, 408, 500, 502, 503, 504]);

export function isRetryableProviderFailure(error: unknown): boolean {
  if (error instanceof ProviderError) {
    return error.kind === "network" || (error.status !== undefined && RETRYABLE_STATUS.has(error.status));
  }
  return false;
}

export function providerFailureLabel(error: unknown): string {
  if (error instanceof ProviderError) {
    return error.kind === "http" ? `http_${error.status}` : error.kind;
  }
  // AbortSignal.timeout()은 TimeoutError DOMException을 던진다.
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "timeout";
  }
  return "unknown";
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
