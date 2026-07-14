# Runbook: Discord 아이디어 인박스

폰에서 Discord 채널에 한 줄 아이디어를 던지면, 로컬 스크립트가 그것을 Obsidian 인박스 노트로 가져오는 캡처 루틴이다. Discord는 입구일 뿐이며 권위 원천은 언제나 Obsidian vault다.

## 흐름

```text
📱 Discord #ideas 채널 (공개 가능한 아이디어 한 줄만)
   ↓ python automation/import_discord_ideas.py  ← 내 PC에서 실행
🗂 로컬 Obsidian 인박스 (저장소 밖, 비공개)
   ↓ 글로 여물면 사람이 판단해 승격
📝 vaults/CORCOIDUM-Public/00_Drafts + 가치 태그(hope/trust/mercy/love)
   ↓ 기존 게이트 그대로 (검토 → 승인 → 발행)
🌐 Garden 게시
```

## 1회 설정

1. **봇 생성** — [Discord Developer Portal](https://discord.com/developers/applications)에서 New Application → Bot 탭:
   - **Message Content Intent를 켠다** (끄면 메시지 내용이 빈 문자열로 온다).
   - Token을 발급받아 로컬 환경변수로만 보관한다. 저장소·CI에 절대 넣지 않는다.
2. **서버 초대** — OAuth2 → URL Generator에서 scope `bot`, 권한 `View Channel` + `Read Message History`만 선택해 내 서버에 초대한다.
3. **채널 준비** — 비공개 `#ideas` 채널을 만들고 봇에게 위 두 권한을 준다. 채널 ID는 채널 우클릭 → "ID 복사" (개발자 모드 필요).
4. **환경변수** — PowerShell 예시:

```powershell
$env:DISCORD_BOT_TOKEN = "<봇 토큰>"
$env:DISCORD_IDEAS_CHANNEL_ID = "<채널 ID>"
$env:IDEAS_INBOX_DIR = "D:\Obsidian\CORCOIDUM-Core\00_Inbox\discord-ideas"
```

인박스 경로는 반드시 이 저장소 **밖**이어야 한다. 저장소 안 경로를 주면 스크립트가 거부한다 — 설익은 아이디어가 공개 repo에 커밋되는 사고를 막기 위한 규칙이다.

## 실행

```powershell
python automation/import_discord_ideas.py
```

- 마지막으로 가져온 메시지 ID를 인박스의 `.discord-ideas-state.json`에 기억하므로, 다시 실행하면 새 메시지만 가져온다.
- 봇 메시지와 빈 메시지는 건너뛴다.
- 원하면 Windows 작업 스케줄러에 하루 1회 등록해도 되고, 글 쓰러 앉을 때 수동으로 돌려도 충분하다.

## 경계 규칙

- **채널에는 공개돼도 괜찮은 아이디어만 쓴다.** Discord는 외부 서비스라서, 입력하는 순간 이미 경계 밖이다. 현장의 구체적 사건·사람·연락처는 금지.
- 스크립트는 가져온 내용에서 고신뢰 민감 패턴(전화번호·주민번호·이메일·secret)을 발견하면 노트에 `sensitive_warning`을 남기고 경고를 출력한다. 경고가 나오면 **Discord 원본 메시지를 삭제**하라 — 로컬로 가져왔다고 밖에 남은 흔적이 사라지는 것은 아니다.
- 로그에는 메시지 내용을 출력하지 않는다(개수와 파일명만).

## 문제 해결

- `403` — 봇 토큰이 틀렸거나 봇이 채널을 볼 수 없다. 초대 권한과 채널 권한을 확인한다.
- 메시지 내용이 전부 비어 있음 — Developer Portal에서 Message Content Intent가 꺼져 있다.
- `FAIL: inbox must be outside this repository` — 인박스 경로를 저장소 밖으로 옮긴다.
