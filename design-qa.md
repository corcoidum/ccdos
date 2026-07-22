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

---

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

---

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
