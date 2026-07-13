# Phase 6 Automation MVP Runbook

## 목적

배포·검증·주간 검토의 상태를 **비식별 요약**으로 확인한다. 노트 본문, 실제 운영 정보, webhook URL, secret은 메시지·로그·report에 포함하지 않는다.

## 로컬 확인

```powershell
python automation/create_status_report.py
python automation/weekly_review.py
```

Discord에는 기본적으로 아무것도 전송하지 않는다. 전송은 유효한 `DISCORD_WEBHOOK_URL` 환경 변수와 명시적 `--send`가 모두 있을 때만 수행한다.

```powershell
python automation/create_status_report.py --output $env:TEMP\ccdos-status.json
python automation/notify_discord.py --report $env:TEMP\ccdos-status.json --send
```

## GitHub Actions

- `deploy-worker.yml`: 성공·실패와 관계없이 status report 단계를 실행하고, `DISCORD_WEBHOOK_URL` Secret이 있을 때 redacted 결과를 알린다.
- `weekly-review.yml`: 매주 월요일 09:00 KST에 승인된 Public 콘텐츠의 수와 tag 요약만 만든다. Secret이 있을 때만 Discord로 전송한다.

## 실패 대응

1. 앞선 lint·test·deploy가 실패해도 `if: always()` 알림 단계는 실행된다. Discord 알림 자체의 실패는 배포된 Worker를 롤백하지 않는다.
2. `create_status_report.py`가 실패하면 출력의 check 이름·상태만 확인한다. 노트 본문을 외부 채널에 복사하지 않는다.
3. Webhook URL은 GitHub Actions Secret 또는 로컬 환경 변수로만 제공한다.
