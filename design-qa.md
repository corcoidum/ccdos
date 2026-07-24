# CORCOIDUM OS Fluid Shell Design QA

## Comparison Target

- Source visual truth:
  - `docs/design-evidence/user-width-mismatch-os.jpg`
  - `docs/design-evidence/user-width-mismatch-garden.jpg`
  - `docs/design-evidence/user-width-mismatch-lab.jpg`
  - `docs/design-evidence/user-width-mismatch-projects.jpg`
- Rendered implementation:
  - `docs/design-evidence/os-fluid-shell-desktop.png`
  - `docs/design-evidence/garden-fluid-shell-desktop.png`
  - `docs/design-evidence/lab-fluid-shell-desktop.png`
  - `docs/design-evidence/projects-fluid-shell-desktop.png`
- Full-view comparison evidence: `docs/design-evidence/os-width-source-vs-fluid-shell.jpg` (left: source, right: implementation).
- Focused comparison evidence: a separate crop was not needed. The normalized `3046 × 802` comparison keeps the header, complete hero boundary, first content boundary, typography, CTA group, and both outer alignment rails readable in one image.
- Desktop viewport: requested `1536 × 1024`; browser content viewport `1521 × 1014` after the native scrollbar.
- Tablet viewport: requested `1024 × 900`; browser content viewport `1009 × 900`.
- Mobile viewport: requested `390 × 844`; browser content viewport `375 × 844`.
- State: public route default state, dark theme, no authentication, reveal transition settled for `850ms`, primary CTA idle.

## Findings

- No actionable P0, P1, or P2 findings remain.
- [P3] The desktop hero preserves each illustration's original `3:2` frame instead of cropping it to fill the full row height.
  - Location: `.hero-frame` in all four routes.
  - Evidence: the implementation leaves a small amount of dark breathing room above and below the image at wide viewports; all constellation subjects and edge details remain visible.
  - Impact: the image band is slightly less full-bleed than the source, but asset fidelity is higher and the dark edge blends into the surrounding surface.
  - Follow-up: only switch to a crop if route-specific art-directed focal points are defined.
- [P3] Korean display type still depends on locally available serif fallbacks.
  - Location: hero and section headings.
  - Impact: exact line metrics can vary slightly by operating system, while the tested layouts remain readable and overflow-free.
  - Follow-up: self-host a licensed Korean variable font if cross-platform metric parity becomes a brand requirement.

## Required Fidelity Surfaces

- Fonts and typography: passed. Existing display serif/body sans tokens were preserved. Desktop hierarchy and mobile wrapping remain coherent; no clipping or orphaned controls were observed.
- Spacing and layout rhythm: passed. Header, hero inner frame, every `.content-section`, and footer now share one `--shell-width`. At desktop the measured frame is `1360px` from `80.5px` to `1440.5px`; at mobile it is `335px` from `20px` to `355px`.
- Colors and visual tokens: passed. Forest, ivory, coral, moss, gold, and divider tokens are unchanged. Active, hover, focus, and primary-action states retain their existing contrast.
- Image quality and asset fidelity: passed. All four real `1536 × 1024` raster illustrations are retained at natural `3:2` ratio. No placeholder, CSS drawing, handcrafted SVG, stretch, or missing asset was introduced.
- Copy and content: passed. Route-specific Korean/English copy is unchanged; the redesign affects layout and interaction behavior only.
- Icons: passed. Existing raster logo and illustration-contained symbols remain unchanged; no substitute icon art was added.
- States and interactions: passed. Browser testing covered SPA navigation and the Lab same-page CTA. The CTA updates the hash, scrolls below the sticky header, and transfers focus to `#wiki-search`. Existing Playwright coverage also passes for Garden filter/modal, Lab search/modal/answer fallback, swipe/wheel route movement, and Projects legend.
- Responsiveness: passed. All four routes share the same fluid outer frame at desktop, tablet, and mobile. The hero changes from two columns to one at `1100px`; no global horizontal overflow was measured.
- Accessibility: passed. Semantic landmarks, skip link, active navigation state, alt text, focus-visible treatment, reduced-motion handling, 44px+ controls, modal focus return, and same-page CTA focus transfer remain present.

## Comparison History

### Pass 1 — blocked

- [P1] The source used three width policies: viewport-wide hero, max-width header/content, and a full-width OS journey exception. This produced the visible top/bottom width mismatch.
- [P2] The first fluid-shell implementation retained the two-column hero too close to tablet width, causing excessive title wrapping around `1024px`.
- [P2] Same-page CTA links scrolled but did not transfer keyboard focus, and `#wiki-search` lacked the sticky-header scroll offset.
- Fixes: added one responsive `--shell-width`, wrapped all heroes with `.hero-inner`, applied the shell to header/content/footer, removed the journey width exception while retaining its full-bleed color band, changed hero tracks to `minmax(0, …)`, moved the one-column transition to `1100px`, and added shared hash navigation with focus transfer.
- Post-fix evidence: `docs/design-evidence/os-fluid-shell-desktop.png`, `docs/design-evidence/os-fluid-shell-tablet.png`, `docs/design-evidence/os-fluid-shell-mobile.png`, and `docs/design-evidence/os-width-source-vs-fluid-shell.jpg`.

### Pass 2 — passed

- Browser geometry: header, hero, and first content section share identical left/right/width values at desktop, tablet, and mobile.
- Browser interactions: `OS → Garden → Lab → Projects` navigation resolved uniquely; `검색 직접 써보기` reached `/lab#wiki-search`, focused the section, used `84px` scroll margin, and placed the section below the `65px` sticky header.
- Browser console: zero warning/error entries after the primary interaction checks.
- Automated verification: TypeScript typecheck, production build, and all 15 Playwright tests passed.

## Implementation Checklist

- [x] One fluid shell token controls header, hero, body sections, and footer.
- [x] Four route heroes use the shared wrapper without duplicating route code.
- [x] Tablet and mobile layouts stack without horizontal overflow.
- [x] Same-page CTA history, scrolling, and focus behavior work.
- [x] Desktop, tablet, and mobile evidence captured.
- [x] Geometry regression test added for all four routes and three viewports.
- [x] Typecheck, build, browser interaction checks, and Playwright suite passed.

## Follow-up Polish

- P3: self-host a Korean display font if exact cross-platform line metrics become necessary.
- P3: define route-specific image focal points before considering a full-height crop treatment.

final result: passed

# Living Values Global Drawer Extension QA

## Comparison Target

- Source visual truth: `docs/design-evidence/living-values-os-source.png`.
- Rendered implementations:
  - `docs/design-evidence/living-values-garden-implementation.png`
  - `docs/design-evidence/living-values-lab-implementation.png`
  - `docs/design-evidence/living-values-projects-implementation.png`
- Full-view comparison evidence: `docs/design-evidence/living-values-primary-routes-comparison.jpg` (top-left: OS source, top-right: Garden, bottom-left: Lab, bottom-right: Projects).
- Viewport and density: `1280 × 720` CSS px, `devicePixelRatio: 1`; every individual source/implementation capture is `1280 × 720` px. The comparison sheet is an unscaled `2560 × 1440` px 2×2 composition.
- State: dark theme, Living Values drawer open, H.O.P.E expanded with three approved records, motion settled.
- Focused comparison: a separate crop was not needed because the drawer occupies `540 × 636` CSS px and its typography, spacing, icon, dividers, counts, and record rows remain readable at native size in the combined evidence.

## Findings

- No actionable P0, P1, or P2 findings remain.
- The Garden, Lab, and Projects implementations reproduce the OS source drawer at the same position, dimensions, hierarchy, colors, content, and expanded state.
- No P3 follow-up specific to this extension was identified.

## Required Fidelity Surfaces

- Fonts and typography: passed. The same heading, body, count, and record-date typography is reused through the shared component and style tokens.
- Spacing and layout rhythm: passed. Every route measured the drawer at `540 × 636` CSS px, anchored at `x: 38.390625`, `y: 64`; header alignment and internal row rhythm match the OS source.
- Colors and visual tokens: passed. Forest, ivory, coral, moss, gold, opacity, dividers, and focus/expanded tokens are unchanged.
- Image quality and asset fidelity: passed. The official menu icon asset and existing route hero assets remain unchanged; no placeholder or code-drawn replacement was introduced.
- Copy and content: passed. Drawer heading, hint, H.O.P.E label, three approved note titles, dates, counts, and value-space link match the source.
- Interaction and accessibility: passed. All four primary routes expose the labelled trigger; accordion state, note counts, modal opening, modal close return, Esc focus restoration, `aria-expanded`, `aria-hidden`, and `inert` behavior are covered by browser and Playwright checks.
- Responsiveness: passed. Desktop captures showed no horizontal overflow; the existing `390 × 844` mobile drawer test continues to pass.

## Comparison History

### Pass 1 — passed

- The shared drawer code and existing style tokens produced no visible route-specific drift.
- Garden, Lab, and Projects each kept their active top-navigation indicator and route-specific hero while the overlay remained visually identical to OS.
- Browser console: zero warning/error entries after the Projects interaction check.
- Primary interactions checked: drawer open, H.O.P.E expand, three-note list rendering, and route-preserving note modal behavior.

## Implementation Checklist

- [x] Reuse one global drawer implementation across OS, Garden, Lab, and Projects.
- [x] Preserve the existing value-space routes without adding the drawer there.
- [x] Add route-level regression coverage for trigger, drawer, accordion, note count, and Projects modal return.
- [x] Scope Garden note-modal locators to visible page content now that identical notes also exist in the header drawer.
- [x] Run typecheck, production build, full Playwright suite, visual comparison, overflow check, and console check.

## Follow-up Polish

- None required for this extension.

final result: passed

# OS Constellation Map — Design QA

## 검수 대상

- Desktop reference: `docs/design-evidence/os-constellation-map-reference.jpg`
- Mobile reference: `docs/design-evidence/os-mobile-links-reference.jpg`
- Source asset: `site/public/assets/constellation-os.jpg`
- Implementation: `http://127.0.0.1:4176/os`
- Desktop evidence: `docs/design-evidence/os-constellation-map-final.jpg`
- Mobile evidence: `docs/design-evidence/os-mobile-links-final.png`
- Full-view comparison: `docs/design-evidence/os-constellation-map-comparison.jpg`
- Focused mobile comparison: `docs/design-evidence/os-mobile-links-comparison.png`

## 비교 조건

- Reference dimensions: 1140 × 950 px (제공된 cropped composition)
- Desktop implementation map: 1352 × 903 px at 1440 × 900 viewport
- Mobile reference: 702 × 1402 px device screenshot, approximately 343 CSS px at DPR 2
- Mobile implementation map and navigation: 301 × 274 px at 343 × 800 CSS viewport, DPR 1
- Density normalization: reference focused crop displayed at 50%; implementation captured with Playwright `scale: css`
- State: `/os` constellation figure visible; desktop overlay links and mobile single-row navigation
- Focus region: constellation image and OS/Garden/Lab/Projects navigation

## Fidelity surfaces

| Surface | Result | Evidence |
| --- | --- | --- |
| Typography | Passed | 기존 serif hierarchy를 유지하고 desktop에서 reference에 가까운 link scale을 적용했다. |
| Spacing / layout | Passed | Intro band 아래에 full-width 3:2 map을 배치하고 기존 page shell 및 borders를 유지했다. |
| Colors / tokens | Passed | 기존 ivory, orange, green-black, line tokens만 사용했다. |
| Image quality / asset fidelity | Passed | 기존 1536 × 1024 source asset을 늘이거나 재생성하지 않고 `object-fit: contain`으로 표시했다. |
| Copy / content | Passed | 기존 OS copy, CTA, route label을 변경하지 않았다. |
| Responsiveness / accessibility | Passed | 1440, 1024, 768 px의 비례 overlay와 430, 390, 360, 320 px의 단일행 nav에서 no-crop, no overflow, 44 px target을 확인했다. |

## Comparison history

1. Pass 1 — P2: overlay link text가 reference보다 작았다. Fluid `clamp()` scale로 확대했다.
2. Pass 1 — P2: touch viewport에서 decorative floating animation이 click 위치를 흔들 수 있었다. 1100 px 이하에서는 animation을 제거했다.
3. Pass 1 — P2: intro copy가 map의 첫 노출을 늦췄다. Desktop intro band를 압축하고 map을 다음 full-width row로 이동했다.
4. Pass 2 — P2: 기존 mobile nav에서 Projects가 두 번째 행으로 내려갔다. Mobile nav를 `repeat(4, minmax(0, 1fr))` grid와 compact fluid type으로 변경했다.
5. Final pass: desktop에서는 네 link가 별자리의 비례 좌표를 유지하고, mobile에서는 네 link가 한 행에서 동일한 44 px touch target을 유지한다. Post-fix evidence는 `docs/design-evidence/os-mobile-links-comparison.png`이다.

## Intentional difference

Desktop reference는 1140 × 950 비율로 원본 좌우·하단 일부가 잘린 composition이다. 구현은 사용자의 “브라우저가 변경되어도 그림이 잘리지 않게” 요구에 따라 1536 × 1024 원본의 3:2 비율 전체를 유지한다. Mobile에서는 비례 좌표 overlay 대신 사용자가 요청한 4개 링크 단일 행을 지도 아래에 배치한다.

## Automated evidence

- Playwright: 43 passed
- Python unittest: 67 passed
- `npm run typecheck`: passed
- `npm run build`: passed
- Architecture, privacy, public content, public graph gates: passed
- Actual mobile Projects link navigation: `/os` → `/projects` passed
- Browser console: 0 errors, 0 warnings on `/os`

final result: passed

---

# OS Desktop Hero Composition Restoration — Design QA

## 검수 대상

- 사용자 문제 화면: `C:/yTemp/codex-clipboard-9adb5209-1ca6-4162-a6a2-84304a21135e.png`
- Source visual truth: `docs/design-evidence/os-fluid-shell-desktop.png`
- Implementation: `http://127.0.0.1:4173/os`
- Desktop implementation screenshot: `docs/design-evidence/os-hero-restored-desktop.png`
- Mobile regression screenshot: `docs/design-evidence/os-hero-restored-mobile.png`

## 비교 조건

- Source pixels: 1536 × 1024 px
- Implementation pixels: 1536 × 1024 px
- Desktop CSS viewport: 1521 × 1024 px (15 px vertical scrollbar 제외), DPR 1
- Mobile CSS viewport: 375 × 844 px (390 px override에서 scrollbar 제외), DPR 1
- State: `/os` initial route, reveal transition settled
- Full-view comparison: 이전 승인 desktop screenshot과 복원된 desktop screenshot을 같은 1536 × 1024 입력에서 비교
- Focused comparison: desktop hero의 copy/image 비율과 mobile 4-link navigation geometry. 별도 crop 없이 원본 screenshot에서 충분히 판독 가능했다.

## Fidelity surfaces

| Surface | Result | Evidence |
| --- | --- | --- |
| Typography | Passed | OS title을 최대 3rem으로 유지해 source와 같은 3줄 hierarchy와 hero 높이를 회복했다. |
| Spacing / layout | Passed | 0.9fr / 1.1fr desktop split, 606 px hero 높이, 오른쪽 3:2 image frame이 source 구도와 일치한다. |
| Colors / tokens | Passed | 기존 night, ivory, coral, line token을 변경하지 않았다. |
| Image quality / asset fidelity | Passed | 기존 `constellation-os.jpg`를 재생성·stretch·crop하지 않고 contain으로 유지했다. |
| Copy / content | Passed | 현재 승인된 copy와 CTA를 변경하지 않았다. Source의 이전 영문 credo와 다른 점은 기존 제품 copy 변경이며 이번 구도 복원 범위 밖이다. |
| Responsiveness / accessibility | Passed | Desktop 1440/1280/1120 두 열, mobile 430/390/360/320의 4개 링크 단일 행, 44 px target, no overflow를 확인했다. |

## Comparison history

1. Initial — P1: desktop에서 intro band 아래 full-width map이 첫 화면을 과도하게 점유해 copy와 image의 관계가 끊겼다.
2. Pass 1 — P2: 단순 직전 CSS 복원만으로는 0.82fr copy column에서 title이 6줄, hero가 약 790 px로 길어져 이전 승인 화면보다 밀도가 높았다.
3. Fix — OS desktop만 0.9fr / 1.1fr로 조정하고 title을 최대 3rem으로 제한했다. Mobile 4-link navigation은 유지했다.
4. Final — source와 implementation 모두 1536 × 1024에서 copy/image split, 3줄 title, 3:2 map 위치가 실질적으로 일치했다. Console error·warning은 0건이다.

## Automated evidence

- Playwright full regression: 43 passed (desktop/mobile hero targeted checks 4 passed)
- `npm run typecheck`: passed
- `npm run build`: passed
- Browser console: 0 errors, 0 warnings on desktop and mobile `/os`
- Desktop horizontal overflow: 0 px
- Mobile horizontal overflow: 0 px

## Follow-up polish

- 현재 요청 범위에서 남은 P0/P1/P2는 없다.
- 필요하면 별도 iteration에서 desktop hero의 copy와 image 비율을 2–3% 단위로 미세 조정할 수 있다.

final result: passed

---

# ZIP Editorial Redesign — Design QA

## 검수 대상

- 사용자 제공 source: `C:/Users/user/Downloads/CCDOS 사이트 리디자인.zip`
- Source visual truth: ZIP 내부 `.thumbnail` WebP
- 로컬 검수 사본: `C:/Users/user/.codex/visualizations/2026/07/24/019f920c-1f2b-7d43-bc42-890d87c872b4/ccdos-redesign-reference/reference-thumbnail.webp`
- Implementation: `http://127.0.0.1:4173/os`
- 기준 viewport: source thumbnail과 같은 640px 폭, 구현 확인용 desktop 1440 × 900 및 mobile 390 × 844
- State: `/os` initial route, drawer closed, motion idle

## 반영 범위

- ZIP의 dark editorial, warm ivory, gold accent, pill CTA, rounded constellation panel, raised evidence card 언어를 기존 Vite/TypeScript 제품에 이식했다.
- 기존 `logo.png` 브랜드 마크, 실제 constellation asset, 공개 note/Phase source-of-truth, route/history/dialog 접근성 로직은 유지했다.
- ZIP의 custom runtime, 외부 Babel/React loader, hard-coded Phase 상태, 복제 note 데이터는 가져오지 않았다.

## 자동 검증

- 브랜드 마크 source: `/assets/logo.png`
- Mobile brand 및 Living Values trigger: 44px 이상
- Desktop hero: 30–73px column gap, 48–56% visual 비율, 18px 이상 panel radius
- 320–1536px 대표 viewport: global horizontal overflow 없음
- Playwright full regression: 46 passed
- TypeScript typecheck: passed
- Production build: passed

## 차단된 시각 비교

- Codex in-app browser에서 `terminal.local:4173`은 `ERR_NAME_NOT_RESOLVED`, `127.0.0.1:4173`은 격리된 browser namespace에서 접근할 수 없었다.
- 따라서 source thumbnail과 현재 implementation screenshot을 같은 viewport로 결합하는 mandatory visual comparison은 완료하지 못했다.
- P0/P1/P2가 없다고 시각적으로 확정하거나 screenshot evidence를 새로 기록하지 않는다. 사용자가 로컬 preview를 확인한 뒤 시각 승인 또는 조정 의견을 주면 같은 source와 viewport로 최종 pass를 갱신한다.

final result: blocked

---

# OS Value Card Alignment — Design QA

## 검수 대상

- 사용자 문제 화면: `C:/yTemp/codex-clipboard-045827aa-c11a-4059-901f-da79bb2c66bb.png`
- Implementation: `http://127.0.0.1:4173/os#values`
- 수정 전 screenshot: `docs/design-evidence/value-cards-alignment-before.png`
- 수정 후 screenshot: `docs/design-evidence/value-cards-alignment-after.png`
- 동일 크기 비교: `docs/design-evidence/value-cards-alignment-comparison.png`

## 비교 조건

- Source pixels: 1420 × 416 px
- Implementation viewport: 1420 × 620 CSS px, DPR 1
- Focused implementation crop: 1420 × 416 px
- Comparison pixels: 2840 × 416 px (왼쪽 source, 오른쪽 implementation)
- State: `/os#values`, reveal transition settled, pointer idle

## 원인과 수정

- P2 — 두 번째 카드부터 적용되던 legacy sibling selector `.value-item + .value-item`의 specificity가 `.value-item-link`보다 높아 `padding-left: 0`이 T.R.U.S.T, M.E.R.C.Y, L.O.V.E에만 남아 있었다.
- 공통 padding을 base `.value-item`에 두고 legacy sibling/nth-child reset을 제거했다.
- 모든 카드를 column flex layout으로 통일하고 action에 `margin-top: auto`를 적용해 copy 길이와 무관하게 CTA 기준선을 맞췄다.

## Fidelity surfaces

| Surface | Result | Evidence |
| --- | --- | --- |
| Typography / copy | Passed | label, title, body, CTA copy와 type token을 변경하지 않았다. |
| Spacing / layout | Passed | Desktop 네 카드 모두 실제 왼쪽 inset 25 px, CTA bottom 386.64 px로 일치한다. |
| Colors / assets | Passed | 기존 night, ivory, gold token과 브랜드 마크·constellation asset을 변경하지 않았다. |
| Tablet responsiveness | Passed | 1024 px에서 네 카드 inset 25 px, 각 행의 CTA bottom이 일치한다. |
| Mobile responsiveness | Passed | 390 px에서 네 카드 inset 23 px, horizontal overflow 0 px를 확인했다. |
| Interaction / console | Passed | T.R.U.S.T 카드의 `/trust` 이동이 동작하며 console error·warning은 0건이다. |

## Comparison history

1. Initial — P2: H.O.P.E만 정상 inset이고 나머지 세 카드는 text와 CTA가 왼쪽 border에 붙었다.
2. Fix — 공통 card padding과 column flex layout을 base selector에 적용하고 충돌 selector를 제거했다.
3. Final — desktop, tablet, mobile에서 네 카드의 inset과 CTA 정렬이 일치하며 남은 P0/P1/P2는 없다.

final result: passed
