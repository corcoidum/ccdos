# Phase 9 완료 보고서 — Living Values

**완료 검증일:** 2026-07-24

**판정:** PASSED — 네 가치 각각에 승인·발행 증적이 있는 공개 기록 3편 이상 확인

## 완료 기준 대조

[Phase 9 계획](phase-9-plan.md)은 `hope`, `trust`, `mercy`, `love` 각각에 승인·발행된 기록이 3편 이상 쌓일 것을 완료 검증의 전제조건으로 정한다.

| 가치 | `published` 기록 수 | 판정 | 공개 index의 기록 ID |
| --- | ---: | --- | --- |
| `hope` | 3 | 통과 | `failed-qa-became-a-test`, `doubt-into-a-ladder`, `late-restart-operating-system` |
| `trust` | 6 | 통과 | `graceful-fallback-hid-the-outage`, `only-reviewed-relations-become-graph`, `from-working-site-to-trustworthy-system`, `discord-webhook-403-lesson`, `search-that-does-not-guess`, `empty-garden-is-a-promise` |
| `mercy` | 4 | 통과 | `an-open-link-must-be-visible`, `one-link-less-explanation`, `safe-automation-case-study`, `value-of-invisible-work` |
| `love` | 3 | 통과 | `leave-the-constellation-uncropped`, `night-comfort-with-my-son`, `moonlight-and-the-name-claude` |

현재 `content/public/index.json`의 16편은 모두 `published` 상태이며 네 가치 중 하나 이상의 tag를 가진다. source validator와 deterministic artifact check를 함께 실행해 index의 ID·metadata·본문이 현재 Public Vault 원본과 일치함을 확인했다.

## 기록별 review·approval·publication 증적

아래 값은 각 Public Vault 원본의 frontmatter에 이미 기록된 증적을 그대로 대조한 것이다. 16편 모두 `privacy_review_result: passed`, `reviewed_revision == updated`, `privacy_reviewed_by: corcoidum`, `approved_by: corcoidum` 조건을 만족했다.

| 기록 ID | 가치 | `privacy_reviewed_at` | `approved_at` | `published_at` |
| --- | --- | --- | --- | --- |
| `an-open-link-must-be-visible` | `mercy` | 2026-07-22T16:38:04Z | 2026-07-22T16:38:04Z | 2026-07-22T16:46:57Z |
| `discord-webhook-403-lesson` | `trust` | 2026-07-20T02:24:53Z | 2026-07-20T02:24:54Z | 2026-07-20T02:24:55Z |
| `doubt-into-a-ladder` | `hope` | 2026-07-20T02:24:53Z | 2026-07-20T02:24:54Z | 2026-07-20T02:24:55Z |
| `empty-garden-is-a-promise` | `trust` | 2026-07-14T09:12:12Z | 2026-07-14T09:12:12Z | 2026-07-14T09:14:52Z |
| `failed-qa-became-a-test` | `hope` | 2026-07-22T00:11:34Z | 2026-07-22T00:11:35Z | 2026-07-22T00:15:52Z |
| `from-working-site-to-trustworthy-system` | `trust` | 2026-07-20T02:24:53Z | 2026-07-20T02:24:54Z | 2026-07-20T02:24:55Z |
| `graceful-fallback-hid-the-outage` | `trust` | 2026-07-22T10:50:09Z | 2026-07-22T10:50:10Z | 2026-07-22T10:54:24Z |
| `late-restart-operating-system` | `hope` | 2026-07-14T04:50:23Z | 2026-07-14T04:50:23Z | 2026-07-14T04:52:42Z |
| `leave-the-constellation-uncropped` | `love` | 2026-07-22T00:11:34Z | 2026-07-22T00:11:35Z | 2026-07-22T00:15:52Z |
| `moonlight-and-the-name-claude` | `love` | 2026-07-16T06:18:23Z | 2026-07-16T06:18:23Z | 2026-07-16T06:21:56Z |
| `night-comfort-with-my-son` | `love` | 2026-07-16T06:18:23Z | 2026-07-16T06:18:23Z | 2026-07-16T06:21:56Z |
| `one-link-less-explanation` | `mercy` | 2026-07-22T00:11:34Z | 2026-07-22T00:11:35Z | 2026-07-22T00:15:52Z |
| `only-reviewed-relations-become-graph` | `trust` | 2026-07-22T00:11:34Z | 2026-07-22T00:11:35Z | 2026-07-22T00:15:52Z |
| `safe-automation-case-study` | `mercy` | 2026-07-20T02:24:53Z | 2026-07-20T02:24:54Z | 2026-07-20T02:24:55Z |
| `search-that-does-not-guess` | `trust` | 2026-07-14T09:12:12Z | 2026-07-14T09:12:12Z | 2026-07-14T09:14:52Z |
| `value-of-invisible-work` | `mercy` | 2026-07-14T09:12:12Z | 2026-07-14T09:12:12Z | 2026-07-14T09:14:52Z |

## 검증 범위와 경계

- 이 판정은 저장소의 현재 Public Vault 원본, 공개 index와 그 frontmatter 증적에 한정한다.
- validator는 필수 증적, UTC 시각 순서, 현재 revision 일치와 고신뢰 민감 패턴을 검사한다.
- 이 보고서는 사람의 승인 행위나 비식별 판단을 새로 만들거나 추정하지 않는다. 기록된 actor·timestamp와 validator 결과만 증적으로 사용하며, 자동 검사는 사람의 Privacy Review를 대체하지 않는다.
- 원격 production의 현재 가동 상태를 별도로 검증하지 않았으므로 Projects 상태는 `LIVE`나 `VERIFIED`가 아니라 완료 기준 통과를 뜻하는 `PASSED`로 갱신한다.

## 검증 명령

```powershell
python scripts/verify_phase0.py
python automation/validate_notes.py vaults/CORCOIDUM-Public
python automation/build_public_content.py --check
python automation/build_public_graph.py --check
python -m unittest discover -s tests -v

$index = Get-Content content/public/index.json -Raw | ConvertFrom-Json
$values = @("hope", "trust", "mercy", "love")
$withoutValue = @($index.notes | Where-Object {
  $tags = $_.tags
  -not ($values | Where-Object { $_ -in $tags })
})
if ($withoutValue.Count -ne 0) { throw "published note without a Living Values tag" }
foreach ($value in $values) {
  $count = @($index.notes | Where-Object {
    $_.state -eq "published" -and $_.tags -contains $value
  }).Count
  if ($count -lt 3) { throw "$value has only $count published notes" }
  "$value=$count"
}

cd site
npm run typecheck
npm run build
npm test
```
