# Runbook: Discord 작업 완료(#DONE) 노트

작업을 마칠 때마다 `#DONE` 채널에 짧게 기록을 올리는 아웃바운드 루틴이다. 채널을 읽지 않고 쓰기만 하므로 봇이 아니라 **webhook**을 쓴다. 배포 상태 알림(`notify_discord.py`)과 같은 전송 방식(403 회피 User-Agent)을 재사용한다.

## 1회 설정

1. Discord에서 `#DONE` 채널 → 채널 설정(톱니) → **연동 → 웹후크 → 새 웹후크** → 이름 지정 → **웹후크 URL 복사**.
2. URL을 로컬 환경변수로만 보관한다(저장소·CI에 넣지 않는다):

```powershell
[Environment]::SetEnvironmentVariable("DISCORD_DONE_WEBHOOK_URL", "<웹후크 URL>", "User")
```

이 URL은 CI 상태 알림용 `DISCORD_WEBHOOK_URL`과 **다른 채널**이므로 별도로 둔다.

## 사용

기본은 전송하지 않고 미리보기만 출력한다(`--send`를 줘야 실제 게시).

```powershell
# 1) 한 줄 완료 노트 — 가장 짧은 경로
python automation\post_done_note.py --message "hero 이미지 잘림 수정 배포 완료" --send

# 2) 제목 + 한 줄
python automation\post_done_note.py --title "작업 완료" --message "가치 필터·읽기 모달 배포" --send

# 3) 최근 커밋에서 초안 자동 생성 (미리보기 후 --send)
python automation\post_done_note.py --title "작업 완료" --since <직전-커밋>
```

- `--message` 가 가장 우선한다(짧은 완료 노트에 적합). 없으면 `--summary-file`, 그것도 없으면 `git log`로 커밋 제목을 모아 초안을 만든다.
- `--since` 를 생략하면 마지막 git 태그 이후, 태그가 없으면 최근 10개 커밋을 대상으로 한다.
- 전송 전에 민감 패턴(토큰·전화번호·주민번호·이메일)을 한 번 더 검사하고, 하나라도 걸리면 전송을 거부한다.
- Discord 2000자 제한을 넘으면 잘라내고 말줄임표를 붙인다.

## 경계 규칙

- 완료 노트는 공개 저장소(GitHub)의 변경 요약만 담는다. 현장·개인 정보, 비밀값은 넣지 않는다.
- `--send` 없이 먼저 돌려 미리보기로 확인한 뒤 게시한다. 자동 게시는 하지 않는다.

## 문제 해결

- `403` — 웹후크 URL이 폐기되었거나 잘못되었다. 채널에서 웹후크를 다시 발급한다.
- `FAIL: DISCORD_DONE_WEBHOOK_URL is required with --send` — 환경변수가 설정되지 않았다.
- `FAIL: message matches '...'` — 노트에 민감 패턴이 있다. 해당 부분을 제거한다.
