# Mobile refinement

## 2.45 local verification — 2026-09-22

Motion Settings uses three persisted choices (system/normal/reduced), minimum 44 px targets and a viewport-contained scrolling dialog. Asset context keeps return actions before expanded details; evidence remains collapsed by default. Existing safe areas, chart gestures and muted market colors remain. Edge emulation verified 320 × 740, 390 × 844, 768 × 1024, 844 × 390 and 1440 × 1000 with no horizontal overflow. This is not physical iPhone/Safari validation. See `tasks/archive/MR-VISUAL-245.md`; the following describes earlier work.

- Header, opening and access gate use an explicit light PNG of the supplied monogram. It is exported from the original alpha silhouette, avoiding a client-side SVG inversion filter. The 360 × 304 transparent mark is accompanied by 48 × 48 browser and 180 × 180 Apple home-screen icons on a dark background. Versioned paths avoid reusing the earlier icon URL.
- The exact five legacy/current brand asset paths remain public for GET/HEAD. Application assets, APIs and owner monitor controls retain access verification.
- Mobile overrides follow the existing visual and motion layers. They restore refresh and automatic monitoring controls, provide 44 px primary touch targets, split K-line tools into two rows, wrap readouts without truncating prices, add safe-area spacing and use 16 px form inputs. Dialogs scroll within the dynamic viewport.
- No added dependency, continuous animation or change to chart geometry/gesture state. Muted red/green market direction remains intact.

Validation: 23 native behavior tests pass. Edge mobile emulation at 320 × 740, 390 × 844, 430 × 932 and 844 × 390 verifies overflow and dialog containment; 1440 × 1000 verifies desktop width. A disposable browser fixture supplies stable market data only for layout checks; it is never deployed. The logo has light opaque pixels and a transparent background. These checks do not constitute physical iPhone/Safari validation.
