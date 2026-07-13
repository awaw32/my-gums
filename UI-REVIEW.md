# UI/UX Review — ملك الصحراء (Desert Kingdom)

**Audited:** 2026-07-13  
**Baseline:** Abstract 6-pillar standards (no `UI-SPEC.md` found)  
**Screenshots:** Captured via Playwright-MCP at `.planning/ui-reviews/`
- `desktop-1440x900.png`
- `mobile-375x812.png`
- `mobile-360x800.png`
- `mobile-320x568.png`
- `br-overlay-360x800.png`
- `landscape-812x375.png`

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Layout | **1/4** | Multiple fixed-position layers overlap on mobile; mini-map, BR HUD, and bottom controls fight for the same screen real estate. |
| 2. Typography | **2/4** | Many labels fall below readable mobile size (≤0.55 rem / ~8.8 px); BR stats are legible but top-bar text is cramped. |
| 3. Color | **2/4** | Desert palette is coherent, but hardcoded colors are scattered and a referenced `--accent-gold` variable is undefined. |
| 4. Spacing | **2/4** | Tiny gaps/padding in the top bar (2–6 px); no consistent spacing scale; safe-area handling is incomplete. |
| 5. Responsiveness | **1/4** | No responsive rules for BR HUD or mini-map below 480 px; duplicate/conflicting media queries; landscape mode hides panels instead of adapting them. |
| 6. Consistency | **2/4** | Mix of CSS variables and hardcoded values; duplicate rule blocks; arbitrary z-index ladder; bottom nav lives outside app shell. |

**Overall: 10/24**

---

## Top 3 Priority Fixes

1. **Mini-map obscures gameplay and BR UI on small screens** — At 150 × 150 px fixed bottom-right (`bottom: 80px; right: 12px; z-index: 9999`), the mini-map sits on top of the canvas, covers the right-side game world, and on 320–360 px widths it crowds the BR evacuate button and bottom nav.  
   *Fix:* Add a `< 480 px` media query to shrink the mini-map to ~90 × 90 px, move it to the top-right under the safe area, and/or make it collapsible with a toggle button. Increase `z-index` only where it must sit above the canvas, not above interactive BR controls.

2. **BR HUD overlaps the top bar and itself on mobile** — `#br-timer`, `#br-players`, and `#br-kills` all use `position: fixed; top: calc(var(--safe-t) + 8–10px);` with `z-index: 100`, the same stacking level as `#top-bar`. On phones with a notch/safe area the BR counters render over the avatar/resources row.  
   *Fix:* Give BR HUD its own dedicated safe strip below `#top-bar` (e.g. `top: calc(var(--top-h) + var(--safe-t) + 4px)`), group timer/players/kills into a single flex container with a semi-transparent background, and raise `z-index` above the top bar only for that strip.

3. **Top-bar resources are unreadable and disconnected on narrow screens** — Five resource pills are squeezed into a shrinking center area with `gap: 1–2 px` and font sizes down to `0.5 rem` at 360 px. Values are not visually grouped with the BR kill counter or other combat info.  
   *Fix:* Below 400 px collapse resource labels to icon-only and show values on a single combined “resources” chip, or move non-critical resources into a slide-out wallet panel. Ensure every clickable/resource element has at least a 44 px hit target and 12 px minimum font size.

---

## Detailed Findings

### Pillar 1: Layout (1/4)

**BLOCKER — Fixed-element stacking collision on mobile**
The game layers numerous `position: fixed` elements on top of the canvas without a clear collision grid:

- `#bottom-bar` is `position: fixed; bottom: 0; left: 50%; width: 480px; max-width: 100vw; height: var(--bottom-h); z-index: 9999` (`css/style.css:660-677`). On phones this bar is full-width and 56–72 px tall.
- `.mini-map` is `position: fixed; bottom: 80px; right: 12px; width: 150px; height: 150px; z-index: 9999` (`css/style.css:4742-4755`). Because it shares the same `z-index` as the bottom bar and sits only 8 px above it, it visually merges with the nav and covers a large portion of the right-hand game world.
- `.br-evacuate-btn` is `position: fixed; bottom: calc(var(--safe-b) + 100px); left: 50%; transform: translateX(-50%); z-index: 200` (`css/style.css:2526-2535`). On a 360 px screen, a centered 52 px-high button at `bottom: 100px` occupies the same vertical band as the mini-map’s left edge.
- `#chat-toggle-btn` (`bottom: calc(140px + var(--safe-b))`), `#zoom-in-btn` (`bottom: calc(140px + var(--safe-b))`), `#zoom-out-btn` (`bottom: calc(80px + var(--safe-b))`), and `.recenter-btn` (`bottom: calc(80px + var(--safe-b))`) all float above the bottom bar and can overlap each other or the mini-map depending on screen width (`css/style.css:1463-1497`, `2303-2318`).
- `#br-players` is top-left and `#br-kills` is top-right at `top: calc(var(--safe-t) + 10px)` with `z-index: 100` (`css/style.css:2494-2507`), colliding with `#top-bar` which also has `z-index: 100` (`css/style.css:164`).

**WARNING — app shell / bottom bar mismatch**
`#bottom-bar` is rendered *outside* `.app-shell` in `index.html:484-506`, while the rest of the UI lives inside the shell. The shell is `max-width: 480px` centered, but the bottom bar uses `left: 50%; transform: translateX(-50%)` to mimic the same centering. This duplication makes layout math fragile; any change to shell width must be mirrored in the bottom bar.

**WARNING — landscape mode removes features instead of adapting**
`@media (max-height: 500px) and (orientation: landscape)` simply hides `#quick-panel`, `#sub-bar`, and `#quick-upgrade-bar` (`css/style.css:2158-2171`). Players in landscape lose access to those features rather than getting a rearranged layout.

### Pillar 2: Typography (2/4)

**WARNING — sub-readable font sizes throughout the chrome**
Several important labels use sizes below the recommended 12 px mobile minimum:

- `.top-level-label` `0.55 rem` (`css/style.css:198`)
- `.top-level-amount` `0.45 rem` (`css/style.css:218`)
- `.csb-label` `0.48 rem` (`css/style.css:357`)
- `.qu-label` `0.55 rem` (`css/style.css:423`)
- `.map-building-desc` `0.58 rem`, `.map-building-level` `0.55 rem`, `.map-building-produce` `0.5 rem` (`css/style.css:533-545`)

On high-DPI devices these render at ~7–9 px and are hard to read, especially for the level/progress amounts that sit next to the tiny 5 px progress track.

**WARNING — BR info lacks visual hierarchy**
`#br-timer` is `1.6 rem` heavy red (`css/style.css:2485-2493`) while `#br-players` and `#br-kills` are only `0.95 rem` (`css/style.css:2496-2507`). The timer dominates, but the equally actionable player count and kill feed feel like secondary footnotes. Grouping them with a shared background/card would improve scannability.

**Observation — Arabic/English mix**
The loading screen title says “ملك السحراء” (likely a typo for “ملك الصحراء”) while the `<title>` and meta tags use “ملك الصحراء” (`index.html:62-63`). This inconsistency could confuse users during the loading state.

### Pillar 3: Color (2/4)

**BLOCKER — undefined CSS variable referenced**
`.game-tooltip` uses `border: 1.5px solid var(--accent-gold)` (`css/style.css:4722`), but `--accent-gold` is never declared in `:root`. The border will render as `transparent` or inherit unexpectedly, breaking tooltip affordance.

**WARNING — hardcoded colors bypass the theme system**
Many UI states use literal colors instead of variables, making theming and dark-mode maintenance difficult. Examples:

- `#e74c3c`, `#c0392b`, `#2ecc71`, `#f39c12`, `#3498db` in notification modifiers (`css/style.css:1603-1608`)
- `#ff4444`, `#ffcccc` in BR zone warning / kill feed (`css/style.css:2515-2524`)
- `#1a1a2e` game-map background (`css/style.css:484`)
- `#c2a06e` canvas background (`css/style.css:4009`)

**WARNING — `:root` block contains invalid nested rules**
The `:root` declaration block (`css/style.css:1-51`) embeds three selector rules (`* { ... }`, `button, ... { ... }`, `input, textarea { ... }`) before closing. This is invalid CSS and may cause browsers to skip the remaining custom properties (`--bg-page`, `--text-primary`, `--accent-red`, etc.) during parsing. Even if some browsers recover, this is a stability risk and should be extracted to top-level rules.

### Pillar 4: Spacing (2/4)

**WARNING — top bar is over-compressed**
`#top-bar` uses `height: var(--top-h)` (56 px), `padding: 2px 6px`, `gap: 3px` (`css/style.css:152-168`). The resource row has `gap: 2 px` and each pill has `padding: 2 px 6 px` (`css/style.css:226-236`). At 320 px, five resource pills plus avatar, level track, and menu button do not fit horizontally; the 280 px breakpoint hides the level info entirely (`css/style.css:2130-2134`), which is a crude fix rather than a scalable layout.

**WARNING — no consistent spacing scale**
The stylesheet mixes ad-hoc values: `4px`, `6px`, `8px`, `10px`, `12px`, `14px`, `16px` appear repeatedly without a clear 4-pt or 8-pt grid. Many component paddings are one-off (e.g., `.pvp-inspect-card padding: 28px 24px`, `.offline-rewards-card padding: 28px 24px`).

**WARNING — safe-area handling is partial**
`--safe-t` and `--safe-b` are defined but only applied to a handful of elements (`#top-bar`, `#bottom-bar`, `.world-buttons`, `.recenter-btn`, `.zoom-btn`). Fixed UI such as `#br-timer`, `#br-players`, `#br-kills`, `.mini-map`, and `.br-evacuate-btn` either ignore safe areas or only account for top/bottom insets on some axes, leading to notched-screen clipping.

### Pillar 5: Responsiveness (1/4)

**BLOCKER — no responsive treatment for BR HUD or mini-map below 480 px**
The only `< 480 px` media query (`css/style.css:2093-2110`) adjusts the top bar, nav, and quick-upgrade cards but leaves the BR overlay and mini-map at their desktop sizes. At 360–375 px the BR counters overlap the top bar, and the 150 px mini-map consumes ~17 % of screen height above the bottom nav.

**BLOCKER — conflicting and duplicate media queries**
There are two separate `@media (max-width: 360px)` blocks (`css/style.css:804-823` and `2111-2129`) with overlapping overrides. For example:
- First block sets `--bottom-h: 64px` and `--top-h: 50px`.
- Second block sets `--bottom-h: 56px` and `--top-h: 50px`.
CSS cascade means the second value wins, but the duplication makes debugging hard and suggests the responsive strategy was added incrementally without consolidation.

**WARNING — tablet/desktop layout is broken**
`@media (min-width: 768px)` changes `.app-shell { max-width: 1200px }` (`css/style.css:2143`), but `#bottom-bar`, `.lands-bg`, `.lands-page-full`, and several modals still hard-code `max-width: 480px`. The result is a centered 480 px column of UI floating inside a 1200 px shell, leaving large unused side margins and misaligned fixed controls.

**WARNING — landscape mode disables content**
As noted in Layout, landscape queries hide entire functional panels instead of reflowing them, which is not a responsive solution.

### Pillar 6: Consistency (2/4)

**WARNING — duplicate CSS rule blocks**
The same selectors are defined more than once with different values, creating maintenance hazards:

- `.story-overlay` — lines 4032–4129 and 4154–4410
- `.lands-page-full` — lines 986–994 and 1015–1022
- `@media (max-width: 360px)` — lines 804–823 and 2111–2129

**WARNING — arbitrary z-index ladder**
Notable z-index values include 50, 60, 65, 70, 80, 100, 110, 200, 500, 9999, 99999, 9999999, 99999999. There is no documented stacking context; new overlays risk under-lapping or over-lapping existing elements by accident. The mini-map and bottom bar sharing `z-index: 9999` is one symptom.

**WARNING — inconsistent units and sizing**
Font sizes switch between `rem` and `px` (e.g., `.lands-building-name font-size: 11.5px` vs. the rest of the UI using `rem`). Border radii also vary arbitrarily (8 px, 10 px, 12 px, 14 px, 16 px, 18 px, 20 px, 22 px, 24 px, 999 px) without a tokenized radius scale.

**WARNING — bottom nav outside app shell**
`#bottom-bar` is a sibling of `.app-shell` in the DOM (`index.html:483-506`). This means it cannot participate in the shell’s flex layout and must be manually centered with transforms, which already caused the width/alignment fragility noted above.

---

## Registry Safety

`components.json` not found; shadcn/third-party registry audit skipped.

---

## Files Audited

- `index.html` (595 lines)
- `css/style.css` (5,229 lines)
- Playwright-MCP screenshots in `.planning/ui-reviews/`
