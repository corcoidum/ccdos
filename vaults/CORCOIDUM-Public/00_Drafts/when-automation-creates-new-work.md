---
id: when-automation-creates-new-work
title: 자동화가 새로운 일을 만들 때
created: 2026-07-25T22:18:34Z
updated: 2026-07-25T22:18:34Z
classification: S0_PUBLIC
visibility: public
publish_state: approved
review_requested_at: 2026-07-25T22:27:39Z
privacy_reviewed_by: corcoidum
privacy_reviewed_at: 2026-07-25T22:27:40Z
privacy_review_result: passed
reviewed_revision: 2026-07-25T22:18:34Z
approved_by: corcoidum
approved_at: 2026-07-25T22:27:41Z
tags:
  - mercy
  - automation
  - operations
relations:
  - target: graceful-fallback-hid-the-outage
    type: builds_on
  - target: safe-automation-case-study
    type: builds_on
  - target: value-of-invisible-work
    type: related_to
---

자동화는 일을 없앤다고 말하지만, 실제로 하는 일은 일의 모양을 바꾸는 것이다. 사라진 일이 있고 그 자리에 새로 생긴 일이 있는데, 사라진 쪽은 눈에 띄고 새로 생긴 쪽은 이름이 없어서 잘 세어지지 않는다.

공개 위키의 답변 생성이 실패하면 승인된 근거 목록을 대신 보여 주는 폴백을 만들어 두었다. 방문자에게는 성공한 화면이었지만 나에게는 새 일이 생겼다. 화면이 멀쩡한지가 아니라 폴백이 정상인지 고장인지를 매번 따로 확인해야 했다. 자동화가 감당하지 못한 상태는 사라진 것이 아니라 사람이 확인해야 할 목록으로 자리를 옮긴 것이었다. 그 목록을 세지 않는 동안 기능은 몇 주를 멈춰 있었다.

의원 원무를 하면서도 같은 구조를 여러 번 봤다. 반복 절차를 기계에 넘기면 창구에서 손이 하나 빠진다. 대신 기계가 처리하지 못한 예외가 따로 모인다. 예외는 원래 흐름 안에서 그 자리에서 해결되던 것들인데, 자동화 뒤에는 흐름 밖으로 밀려나 별도의 확인 시간을 요구한다. 게다가 기계가 절차를 대신 밟기 시작하면 사람은 그 절차를 더 이상 외우지 않게 되므로, 문제가 생겼을 때 복구는 이전보다 느려진다. 줄어든 것은 손을 움직이는 횟수였고 늘어난 것은 확인과 복구의 무게였다.

그래서 자동화를 하나 늘릴 때마다 두 가지를 함께 적기로 했다. 무엇이 사라졌는가, 그리고 무엇을 새로 확인해야 하는가. 폴백에는 정상과 고장을 구분해 실패로 처리하는 검사를 붙였고, 상태 알림은 통과와 실패 요약만 남겨 읽는 데 드는 시간을 고정했다. 두 번째 칸을 채울 수 없는 자동화는 아직 완성된 것이 아니라고 본다. 확인을 설계하지 않으면 그 확인은 사라지는 것이 아니라 사람의 기억에 얹히기 때문이다.

자동화의 성공은 버튼을 없앤 수가 아니라, 사람이 새로 떠안은 확인과 복구의 총량으로 판단해야 한다. 이 기준을 계속 밀고 가면 다음 질문은 하나만 남는다. 사람이 무엇을 기억하지 않아도 되는 상태까지 갈 수 있는가.
