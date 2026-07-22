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
