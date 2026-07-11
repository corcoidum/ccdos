# CORCOIDUM OS Design QA

## Comparison Target

- Source visual truth: `docs/design-evidence/selected-option-2-human-constellation.jpg`
- Rendered implementation: `docs/design-evidence/os-desktop-final.jpg`
- Full-view comparison evidence: `docs/design-evidence/os-source-vs-implementation.jpg`
- Focused comparison evidence: the bottom row of `docs/design-evidence/os-source-vs-implementation.jpg` compares the hero copy region at the same state; no additional crop was needed because the display typography, CTA group, and supporting copy are readable there.
- Desktop viewport: `1536 × 1024`
- Intermediate viewport: `1200 × 900`
- Mobile viewport: `390 × 844`
- State: public `/os` default state, dark theme, no authentication, primary CTA idle.
- Additional route evidence:
  - `docs/design-evidence/garden-desktop-final.jpg`
  - `docs/design-evidence/lab-desktop-final.jpg`
  - `docs/design-evidence/projects-desktop-final.jpg`
  - `docs/design-evidence/os-tablet-final.jpg`
  - `docs/design-evidence/os-mobile-final.jpg`
  - `docs/design-evidence/garden-mobile-final.jpg`
  - `docs/design-evidence/lab-mobile-final.jpg`
  - `docs/design-evidence/projects-mobile-final.jpg`

## Findings

- No actionable P0, P1, or P2 findings remain.
- [P3] The reference uses pictorial process icons while the implementation uses restrained numeric markers.
  - Location: `/os` journey section.
  - Evidence: the source uses five circular line icons; the implementation keeps the same five-step rhythm with `01–05` markers and dividers.
  - Impact: slightly less illustrative, but clearer at small sizes and consistent with the implemented editorial system.
  - Follow-up: add a licensed icon set only if a future brand system standardizes one; do not replace it with custom CSS or inline SVG art.
- [P3] The Korean display type depends on locally available serif fallbacks.
  - Location: all hero and section headings.
  - Evidence: the implementation uses `Noto Serif KR`, `NanumMyeongjo`, `Batang`, and platform serif fallbacks without adding a new production font dependency.
  - Impact: line metrics can vary slightly by operating system while hierarchy and wrapping remain usable.
  - Follow-up: self-host a licensed Korean variable font if exact cross-platform metrics become a brand requirement.
- [P3] Open Graph metadata is intentionally shared at the site level.
  - Location: `/garden`, `/lab`, and `/projects` social previews.
  - Evidence: the static SPA updates `document.title` per route, while crawlers receive the common CORCOIDUM OS Open Graph image and credo from `index.html`.
  - Impact: route shares have a consistent brand preview rather than route-specific art.
  - Follow-up: add edge-rendered route metadata only if page-specific social cards become a publishing requirement.

## Required Fidelity Surfaces

- Fonts and typography: passed. Display serif and compact sans hierarchy match the reference mood. Desktop hero copy fits in three deliberate lines; mobile headlines were reduced and rewrapped to remove orphan characters and clipped phrases.
- Spacing and layout rhythm: passed. The 64px header, 620px split hero, 48/52 visual balance, and journey start at approximately 686px preserve the reference composition. Sections use dividers and negative space instead of nested card grids.
- Colors and visual tokens: passed. Deep forest, warm ivory, muted coral, moss, and gold are centralized as CSS tokens. Primary CTA contrast was corrected from `3.01:1` to `5.76:1` by using dark text on coral.
- Image quality and asset fidelity: passed. Four route-specific `1536 × 1024` constellation illustrations were generated from the selected direction and placed as real raster assets. JPEG optimization reduced the combined public art payload from about 9.8MB to about 1.25MB without visible degradation. No custom CSS art, handcrafted SVG, placeholder image, or stretched source was used.
- Copy and content: passed. The worldview statement, CORCOIDUM credo, H.O.P.E/T.R.U.S.T/M.E.R.C.Y/L.O.V.E taxonomy, safety boundary, real Phase 0–7 progress, and decision-pending next layer are coherent and route-specific. Garden accurately preserves the zero-approved-record state instead of inventing public notes.
- Icons: passed with the P3 deviation noted above. The primary constellation nodes are part of generated art and receive accessible text links as interactive overlays on desktop.
- States and interactions: passed. SPA navigation, active route state, browser history, title updates, route focus, the `/os` journey CTA, external evidence links, Garden empty state, and future tag filtering behavior are implemented. The zero-note dataset correctly omits unused filter controls.
- Responsiveness: passed. All four routes were rendered at desktop and `390 × 844`, and the split hero was additionally verified at `1200 × 900`; `scrollWidth` did not exceed the content viewport, hero images loaded successfully, and controls remained at least 44px high.
- Accessibility: passed. Includes skip link, semantic header/nav/main/footer landmarks, `aria-current`, descriptive image alt text, visible `:focus-visible`, reduced-motion handling, keyboard-reachable controls, and AA text contrast for primary controls.

## Comparison History

### Pass 1 — blocked

- [P1] The implementation hero was too tall and the display type was too large, so the CTA and journey disappeared below the first desktop viewport.
- [P2] The constellation was visual-only and did not express the reference's navigable OS/Garden/Lab/Projects nodes.
- Fixes: reduced hero height to 620px, rebalanced the split grid, corrected Korean line breaks and type scale, compressed hero spacing, placed the journey beside its introduction, and added accessible route-node links over the generated constellation.
- Post-fix evidence: `docs/design-evidence/os-source-vs-implementation.jpg`.

### Pass 2 — blocked

- [P2] A reveal animation left page content at low opacity during initial and automated mobile captures.
- [P2] Lab and Projects mobile headings produced orphan characters and awkward multi-line breaks.
- Fixes: removed the opacity reveal, reduced the mobile display scale, applied `word-break: keep-all`, and adjusted the Projects heading break.
- Post-fix evidence: all `docs/design-evidence/*-mobile-final.jpg` files.

### Pass 3 — blocked

- [P1] White CTA text on coral measured `3.01:1`, below AA for the implemented text size.
- Fix: changed CTA foreground to the dark forest token, producing `5.76:1` contrast.
- Post-fix evidence: `docs/design-evidence/os-desktop-final.jpg`.

### Pass 4 — passed

- [P2] The base hero tracks required 1240px before the responsive rule began, leaving a clipping range near 1200px.
- [P2] Hash history could return to the top instead of the intended anchor, and same-route navigation could leave a stale hash in the URL.
- Fixes: moved the split-layout breakpoint to 1280px, adjusted the intermediate type scale, verified the full hero at `1200 × 900`, restored hash targets on history navigation, and cleared a stale hash on same-route navigation.
- Browser verification: navigation `OS → Garden → Lab → Projects` resolved uniquely and updated the URL and active state; the primary `/os` CTA reached `#journey`; all route images loaded at natural size; a clean browser tab reported zero console errors.
- Final visual evidence: `docs/design-evidence/os-desktop-final.jpg`, `docs/design-evidence/os-tablet-final.jpg`, `docs/design-evidence/os-mobile-final.jpg`, and `docs/design-evidence/os-source-vs-implementation.jpg`.

## Open Questions

- None blocking. A future self-hosted font and licensed icon family are optional brand refinements, not release blockers.

## Implementation Checklist

- [x] Selected ImageGen direction resolved unambiguously.
- [x] Four route-specific assets generated and optimized.
- [x] `/os`, `/garden`, `/lab`, and `/projects` implemented.
- [x] Navigation, CTA, history, title, focus, and empty state verified.
- [x] Desktop and mobile rendering verified without horizontal overflow.
- [x] Console and image-loading checks completed.
- [x] Build and repository tests passed.

## Follow-up Polish

- P3: self-host a Korean display font if exact rendering parity across Windows, macOS, and Linux becomes necessary.
- P3: adopt a licensed line-icon family if future sections require a broader pictographic vocabulary.
- P3: add route-specific edge-rendered Open Graph metadata if individual page sharing becomes important.

final result: passed
