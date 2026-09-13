# Market Radar motion system

## Architecture and scope
React 19 / Vinext / Vite 8, existing Radix dialogs and Base UI controls, Recharts trends and a custom SVG candlestick chart. `app/page.tsx` renders the single dashboard in `app/market-radar.tsx`; `app/layout.tsx` owns global styles. The separate Worker access gate remains a native server form. There is no multi-page content navigation or hero photograph to animate.

The dashboard is a working surface. Keep the monochrome palette, original monogram, muted green/red market direction, secure access gate, quote polling, chart controls, alerts and data provenance. No animated price counters, chart parallax, custom cursor, scroll hijacking or artificial waiting for data.

## Motion vocabulary
- 140 ms direct feedback, 240 ms controls and dialogs, 480 ms section arrivals; main easing `cubic-bezier(.16,1,.3,1)`, curtain easing `.65,0,.35,1`.
- First session only: original monogram and a hairline on black; upward curtain reveals the header, title, supporting text, CTA and four summary cards. About 1.7 seconds including the last card. Mobile curtain finishes at 1.12 seconds with fewer staggered elements.
- Bootstrap runs before body paint to prevent a content/intro flash. Storage failure and disabled JavaScript default to visible content. A 2.2 second independent fail-open timer removes the intro flag even if React fails. Pointer, wheel or keyboard interaction dismisses the decorative opening immediately. It never captures pointer events or stops data requests.
- Native browser anchor scrolling with fixed header clearance. Header border/background become slightly stronger after scrolling; its geometry stays fixed. Navigation follows visible sections.
- One IntersectionObserver gives watchlist headings, supporting panels and footer a single short arrival. Unobserved content is never hidden. Cards and title have distinct first-arrival treatments; separator uses scaleX.
- Precise desktop pointer: primary add button moves at most 2 px, cards lift 2 px, navigation underline extends, link arrows move 2 px. Native focus outlines remain explicit. Only the plus icon rotates.
- Dialogs use a short 6 px / 1% arrival instead of the previous larger zoom. Disclosures animate their chevron and newly opened content. Search and form focus use a subtle border and halo.
- No continuous animation loop. Scroll and pointer updates coalesce into event-driven animation frames without React state updates. Observers, media listeners, timers and in-flight animations are cleaned up on unmount.

## Mobile and accessibility
Coarse pointers and narrower screens disable magnetic motion and card stagger, reduce entrance displacement to 3 px, shorten durations and reduce header/dock blur. Chart touch handling stays scoped to its SVG. `prefers-reduced-motion` skips the opening, reveals, smooth scrolling and decorative transforms; live preference changes cancel in-flight Web Animations. Content remains visible without JavaScript. Native dialog focus management and keyboard chart controls remain intact.

## Research
- [1820 Productions, Codrops, February 2026](https://tympanus.net/codrops/2026/02/13/1820-productions-minimal-design-maximal-motion/): rhythm, section hairlines and session-aware intros in a monochrome site. Adapted the principles to a live dashboard; no source code copied.
- [High-performance animations, web.dev](https://web.dev/articles/animations-guide): prefer transform/opacity, avoid layout animation and excessive layer promotion. Only the small one-shot heading uses clip-path; no animated blur or broad will-change.
- [Reduced motion, web.dev](https://web.dev/articles/prefers-reduced-motion): CSS media queries and live preference handling.

No new dependencies. The effect is deliberately independent of quote/history requests and chart viewport state. Validation records are kept in the ignored `outputs` directory.

## Frame budget refinement
- Geometry for the candle drawing is memoized separately from the crosshair/readout. Pointer bursts are coalesced to one hover update per animation frame; chart bounds are reused until scrolling or resizing invalidates them.
- Fractional chart panning translates a stable candle group. Candles and moving averages rebuild when the visible bars or price scale actually change, rather than rewriting every SVG coordinate for each fractional movement. Pinch gestures reuse their initial bounds.
- Navigation caches document coordinates, invalidated by ResizeObserver or viewport resize. Reads precede writes; header state is written only when crossing its threshold. Intro cancellation listeners detach when the intro finishes.
- Title reveal uses a static overflow mask plus a moving inner line. Fixed header/dock surfaces no longer use backdrop blur.
- Additional feedback has distinct purposes: a 520 ms low-opacity directional halo for a real price change (no number interpolation, no flash on initial data or symbol changes); tool-selection underline; eased switch thumb; refresh icon settling; success icon stroke; a single small bell movement on desktop hover. Reduced-motion preferences suppress all decorative motion, including in-flight price halos. Touch input does not activate hover-only motion.
- Reproducible browser benchmark uses 96 fixed candles, two passes, a 1440×1000 viewport and 4× CPU slowdown. Measures frame intervals, script/layout/style work and geometry/state writes for idle, hover, pan, scroll and the full opening. Synthetic pointer bursts stress the handlers; results are not a guarantee of a physical device's refresh rate or data latency.
