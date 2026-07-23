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
    // Provider가 실패 이유를 본문에 담아 준다. 상태 코드만으로는 지역 제한과
    // 키 제한과 모델 접근을 구분할 수 없어 추측이 반복된다.
    readonly detail?: string,
  ) {
    super(`provider ${kind}${status === undefined ? "" : ` ${status}`}`);
    this.name = "ProviderError";
  }
}

type ProviderRetryOptions = {
  attempts: number;
  attemptTimeoutMs: number;
  deadlineMs: number;
  retryDelayMs: number;
  onRetry?: (attempt: number, error: unknown) => void;
};

const MAX_PROVIDER_DETAIL = 200;

// OpenAI 오류 본문은 error.code/message를 담는다. 요청 본문(질문·출처)이나
// Authorization 헤더는 되돌아오지 않으므로, 길이만 잘라 진단에 쓴다.
export function summarizeProviderBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = JSON.parse(trimmed) as { error?: { code?: unknown; message?: unknown } };
    const code = typeof parsed.error?.code === "string" ? parsed.error.code : "";
    const message = typeof parsed.error?.message === "string" ? parsed.error.message : "";
    const joined = [code, message].filter(Boolean).join(": ");
    if (joined) {
      return joined.slice(0, MAX_PROVIDER_DETAIL);
    }
  } catch {
    // JSON이 아니면(예: edge의 HTML 차단 페이지) 앞부분만 남긴다.
  }
  return trimmed.replace(/\s+/g, " ").slice(0, MAX_PROVIDER_DETAIL);
}

// Provider edge가 egress 위치에 따라 403을, 과부하 시 5xx를 준다. 둘 다
// 요청 내용과 무관한 일시적 실패이므로 폴백 전에 다시 시도할 가치가 있다.
// 429는 제외한다 — 재시도가 상황을 악화시킨다.
const RETRYABLE_STATUS = new Set([403, 408, 500, 502, 503, 504]);

export function isRetryableProviderFailure(error: unknown): boolean {
  if (error instanceof ProviderError) {
    return (
      error.kind === "network" ||
      error.kind === "timeout" ||
      (error.status !== undefined && RETRYABLE_STATUS.has(error.status))
    );
  }
  return false;
}

function providerFailureName(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return undefined;
  }
  return typeof error.name === "string" ? error.name : undefined;
}

// Cloudflare fetch는 egress 실패를 TypeError로, timeout/abort를 DOMException으로
// 던진다. retry 경계에 들어오기 전에 진단 가능한 최소 유형으로 정규화한다.
export function normalizeProviderFailure(error: unknown): unknown {
  if (error instanceof ProviderError) {
    return error;
  }
  const name = providerFailureName(error);
  if (name === "TimeoutError" || name === "AbortError") {
    return new ProviderError("timeout");
  }
  if (error instanceof TypeError || name === "TypeError") {
    return new ProviderError("network");
  }
  return error;
}

export function providerFailureLabel(error: unknown): string {
  if (error instanceof ProviderError) {
    const base = error.kind === "http" ? `http_${error.status}` : error.kind;
    return error.detail ? `${base} ${error.detail}` : base;
  }
  // AbortSignal.timeout()은 TimeoutError DOMException을 던진다.
  const name = providerFailureName(error);
  if (name === "TimeoutError" || name === "AbortError") {
    return "timeout";
  }
  return "unknown";
}

export async function withProviderRetry<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: ProviderRetryOptions,
): Promise<T> {
  const attempts = Math.max(1, options.attempts);
  const deadline = Date.now() + Math.max(1, options.deadlineMs);
  let lastError: unknown = new ProviderError("timeout");

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new ProviderError("timeout");
    }
    const attemptTimeoutMs = Math.max(1, Math.min(options.attemptTimeoutMs, remainingMs));
    try {
      return await operation(AbortSignal.timeout(attemptTimeoutMs));
    } catch (caught) {
      const error = normalizeProviderFailure(caught);
      lastError = error;
      const retryDelayMs = Math.max(0, options.retryDelayMs * attempt);
      const canRetry =
        attempt < attempts &&
        isRetryableProviderFailure(error) &&
        Date.now() + retryDelayMs < deadline;
      if (!canRetry) {
        break;
      }
      options.onRetry?.(attempt, error);
      if (retryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }
  throw lastError;
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
