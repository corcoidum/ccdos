# Runbook: Discord 릴리스 노트

작업 요약을 `#release` 채널에 올리는 아웃바운드 루틴이다. 채널을 읽지 않고 쓰기만 하므로 봇이 아니라 **webhook**을 쓴다. 배포 상태 알림(`notify_discord.py`)과 같은 전송 방식(403 회피 User-Agent)을 재사용한다.

## 1회 설정

1. Discord에서 `#release` 채널 → 채널 설정(톱니) → **연동 → 웹후크 → 새 웹후크** → 이름 지정 → **웹후크 URL 복사**.
2. URL을 로컬 환경변수로만 보관한다(저장소·CI에 넣지 않는다):

```powershell
[Environment]::SetEnvironmentVariable("DISCORD_RELEASE_WEBHOOK_URL", "<웹후크 URL>", "User")
```

이 URL은 CI 상태 알림용 `DISCORD_WEBHOOK_URL`과 **다른 채널**이므로 별도로 둔다.

## 사용

기본은 전송하지 않고 미리보기만 출력한다(`--send`를 줘야 실제 게시).

```powershell
# 1) 최근 커밋에서 초안 자동 생성 (미리보기)
python automation\post_release_note.py --title "CCDOS 릴리스" --since <직전-태그-또는-커밋>

# 2) 사람이 다듬은 요약 파일로 게시
python automation\post_release_note.py --title "CCDOS 릴리스" --summary-file release-note.md --send
```

- `--summary-file` 이 있으면 그 내용을 그대로 본문으로 쓴다(Discord 마크다운 사용 가능). 없으면 `git log`로 커밋 제목을 모아 초안을 만든다.
- `--since` 를 생략하면 마지막 git 태그 이후, 태그가 없으면 최근 10개 커밋을 대상으로 한다.
- 전송 전에 민감 패턴(토큰·전화번호·주민번호·이메일)을 한 번 더 검사하고, 하나라도 걸리면 전송을 거부한다.
- Discord 2000자 제한을 넘으면 잘라내고 말줄임표를 붙인다.

## 경계 규칙

- 릴리스 노트는 공개 저장소(GitHub)의 변경 요약만 담는다. 현장·개인 정보, 비밀값은 넣지 않는다.
- 초안은 사람이 검토·승인한 뒤 `--send` 로 게시한다. 자동 게시는 하지 않는다(큐레이션이 목적).

## 문제 해결

- `403` — 웹후크 URL이 폐기되었거나 잘못되었다. 채널에서 웹후크를 다시 발급한다.
- `FAIL: DISCORD_RELEASE_WEBHOOK_URL is required with --send` — 환경변수가 설정되지 않았다.
- `FAIL: message matches '...'` — 요약에 민감 패턴이 있다. 해당 부분을 제거한다.
