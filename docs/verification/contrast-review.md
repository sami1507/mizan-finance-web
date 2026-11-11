# Manual contrast follow-up

Checked **12 November 2026, Asia/Jerusalem** (raw sample timestamp: `2026-11-11T22:13:12.716Z`) against the running production preview at `http://127.0.0.1:3200`. Chromium viewport: 1440 × 1100, scale factor 1, reduced motion. Arabic/light and English/dark each used a newly isolated synthetic demo session. No real financial data or external service was used, and no production code was changed for this review.

This follows the `color-contrast` manual-review entries in [delivery-browser-audit.json](delivery-browser-audit.json). Browser-computed foregrounds, SVG fills, ancestor backgrounds, opacities, font properties and bounds were collected in [contrast-samples.json](contrast-samples.json). The six linked screenshots were opened and visually inspected.

## Results

Ratios use sRGB relative luminance: convert each RGB channel to linear light, calculate `L = 0.2126 R + 0.7152 G + 0.0722 B`, then `(lighter L + 0.05) / (darker L + 0.05)`. All reviewed text pairs exceed 4.5:1, including the small 12–13px labels.

| Target | Arabic/light foreground → background | Ratio | English/dark foreground → background | Ratio |
| --- | --- | ---: | --- | ---: |
| `.preview-caption` | `#586973` → `#F7F5F0` | 5.23:1 | `#B3C0C8` → `#111E27` | 9.11:1 |
| `.wealth-card .stat-label` | `#CAD4D9` → `#172D38` | 9.48:1 | `#C5D2D9` → `#233C49` | 7.49:1 |
| `.wealth-card .stat-foot`, including its second span | `#BDCBD1` → `#172D38` | 8.60:1 | `#C5D2D9` → `#233C49` | 7.49:1 |
| `.wealth-card .light-pill` | `#F1F3F1` → `#172D38` | 12.82:1 | `#F1F3F1` → `#233C49` | 10.38:1 |
| `.cashflow-chart tspan` (actual SVG `fill`) | `#586973` → `#FFFFFF` | 5.70:1 | `#B3C0C8` → `#192A35` | 7.93:1 |
| `.donut-center span` | `#586973` → `#FFFFFF` | 5.70:1 | `#B3C0C8` → `#192A35` | 7.93:1 |
| `.donut-center strong` | `#172D38` → `#FFFFFF` | 14.30:1 | `#EEF3F4` → `#192A35` | 13.18:1 |

## Background and overlap checks

- All sampled text and relevant ancestors had computed opacity 1. The effective text backgrounds were solid colors; there was no CSS background image. `.light-pill` has a translucent **separator border**, not a translucent layer behind its text. The wealth-card's gold rule is confined to the top 2px and does not cross labels.
- The landing caption sits below the image preview on the body background. Its decorative gold dot is separate from the text. Captures: [Arabic/light](contrast-caption-ar-light.png), [English/dark](contrast-caption-en-dark.png).
- Chart-axis text uses SVG `fill`, not its inherited CSS `color`. The reviewed Y-axis labels end approximately 8px before the plot begins; X-axis labels are below the plot. The income gradient therefore does not form their actual text background in these samples.
- As a conservative additional calculation, blending the maximum 15% income-fill opacity over the panel produces approximately `rgb(217.95,235.8,231.15)` in light mode and `rgb(38.05,67.2,71.15)` in dark mode. Axis-text contrast against those hypothetical backgrounds is still **4.65:1** and **5.70:1** respectively. The actual sampled axis contrast is the higher table value.
- The donut text is in the unfilled center on the panel surface. The visible glyphs did not cross a colored sector at the sampled total of 5,139.00 ILS. The exact amount and category values are also available adjacent to the chart. Chart captures: [Arabic/light](contrast-charts-ar-light.png), [English/dark](contrast-charts-en-dark.png).
- Wealth-card labels, amount, account count and footnote were visually distinct without overlap. Captures: [Arabic/light](contrast-wealth-ar-light.png), [English/dark](contrast-wealth-en-dark.png).

## Scope and remaining limits

No contrast defect was found among these reviewed selectors and rendered samples. The original automated audit's `incomplete` entries remain in its JSON as evidence; this document is the bounded manual follow-up, not a claim that the automation independently resolved them.

This check does not certify every chart value, future extremely long total, browser/OS font rendering, hover state, screen reader or viewport. It does not replace the broader responsive audit or an independent accessibility assessment. Different amounts and geometry can change overlap without changing color-token contrast; review such cases when the chart or its sizing changes. No claim of complete WCAG certification is made.
