# Mizan Finance | ميزان — brand and interface guide

This guide records the identity actually implemented in the product. The established warm ivory, navy and emerald direction is retained. The geometric **m·** symbol now has one vector construction shared by the application, favicon and downloadable artwork. Its two equal arches suggest balance; the restrained gold point supplies recognition at small sizes. No trademark clearance or registration is claimed.

## Ready-to-use assets

All supplied logo SVGs use outlined geometry, with no external font, image or network dependency. SVG and PNG logo backgrounds are transparent. PNGs use RGBA; a white mark will intentionally look blank against a white viewer.

| Asset | Files | Intended background |
| --- | --- | --- |
| Full horizontal logo | `public/brand/logo-on-light.svg` and `.png` | Ivory/white |
| Reversed horizontal logo | `public/brand/logo-on-dark.svg` and `.png` | Navy/dark |
| Monochrome full logos | `public/brand/logo-black.svg`, `logo-white.svg`, matching PNGs | Print, one-color use |
| Standalone symbol | `public/brand/mark-on-light.svg`, `mark-on-dark.svg`, matching PNGs | Small UI/avatar use |
| Monochrome symbols | `public/brand/mark-black.svg`, `mark-white.svg`, matching PNGs | One-color use |
| App/browser icons | `public/brand/app-icon.svg`, `app-icon-192.png`, `app-icon-512.png`; `src/app/icon.svg`; `src/app/apple-icon.png` (180 × 180) | Self-contained navy tile |
| Social share image | `public/brand/social-share.png` and `.svg` (1200 × 630) | Open Graph / social previews |
| Visual review board | `docs/screenshots/brand-board.png` | Delivery reference |

`public/brand/manifest.json` lists dimensions and variants. `node scripts/generate-brand.mjs` regenerates the brand assets using Sharp from the locked Next.js dependency tree; run it after `npm ci`. It writes only generated artwork and the brand review board, not financial data. The production UI renders `BrandMark` directly as SVG. The name next to it uses the selected interface language, including the Arabic name ميزان, preserving the established localized treatment.

Keep at least half the mark height of clear space around a standalone logo. Use the symbol below a 150px full-lockup width. Do not stretch, rotate, add gradients, add a drop shadow, or recolor one arch. The gold dot is decorative, never the only indicator of a financial status. The mark is legible at 24px; the favicon contains its own protected background.

## Color tokens

The source of truth is `src/app/globals.css`, with component-specific chart and surface styles where needed.

| Role / token | Light | Dark | Use |
| --- | --- | --- | --- |
| Canvas `--bg` | `#F7F5F0` | `#111E27` | Page background |
| Surface `--surface` | `#FFFFFF` | `#192A35` | Forms/cards/dialogs |
| Text `--ink` | `#172D38` | `#EEF3F4` | Headings and primary text |
| Secondary text `--muted` | `#586973` | `#B3C0C8` | Explanations and labels |
| Brand structure `--navy` | `#142F3E` | `#102532` | Sidebar and dark sections |
| Primary action `--green` | `#087F60` | `#70D2AE` | Primary actions and emphasis |
| Action foreground `--action-ink` | `#FFFFFF` | `#10251E` | Text/icons on primary actions |
| Accent `--gold` | `#AC8B4D` | `#D5BC80` | Small brand accents, not small body text |
| Success `--positive` | `#087455` | `#83D5B4` | Positive amount/status, accompanied by wording/sign |
| Warning `--warning` | `#805B20` | `#E4C185` | Warning text and status |
| Error `--danger` | `#AE3838` | `#FFA6A0` | Errors and destructive states |
| Border `--border` | `#D9DFDF` | `#3C505D` | Decorative divisions |
| Control border `--control-border` | `#80909A` | `#6D8492` | Input boundaries |
| Focus `--focus` | `#087F60` | `#8CDBB8` | 3px keyboard focus outline |

Normal text uses `--ink` or `--muted`, never the decorative gold. Finance amounts use tabular numerals and retain their signs, currency and labels. Do not communicate warnings or spending/income differences by color alone. Dark mode has its own action foreground and status colors rather than inverting the light palette.

Calculated sRGB relative-luminance checks on 11 November 2026: body text/canvas 13.12:1 (light), muted/surface 5.70:1 (light), primary action text 4.98:1 (light), body/surface 13.18:1 (dark), muted/surface 7.93:1 (dark), primary action text 8.82:1 (dark), error/white 6.14:1, warning/white 6.11:1. These checks cover the listed token pairs; they are not a claim of an independent accessibility certification for every rendered state.

## Typography and licensing

| Family | Use | Bundled source | License |
| --- | --- | --- | --- |
| Noto Sans Arabic Variable | Arabic script | `@fontsource-variable/noto-sans-arabic@5.3.0` | SIL OFL 1.1 |
| Noto Sans Hebrew Variable | Hebrew script | `@fontsource-variable/noto-sans-hebrew@5.3.0` | SIL OFL 1.1 |
| DM Sans Variable | English/German/Latin figures | `@fontsource-variable/dm-sans@5.3.0` | SIL OFL 1.1 |
| Lucide | Interface icons | `lucide-react@1.69.0` | ISC |

Exact upstream notices are copied into `docs/licenses/`. Sources and package versions are recorded in `docs/licenses/SOURCES.json`; those notices, rather than an assumed claim of authorship, govern third-party use. The custom logo geometry itself does not embed these fonts. It is authored for this project, but no assertion of global uniqueness or trademark rights is made.

Fonts are self-hosted. `src/app/fonts.css` loads four required subsets: Arabic, Hebrew, Latin and Latin extended; it does not import unrelated math, symbol, Greek or Cyrillic font files. Unicode ranges load a subset only when used. Mixed-script content falls back among all three families, and user-entered content is not translated. The currency symbol ₪ uses the Hebrew subset. Font loading uses `swap` and keeps a system fallback.

Body: 15–16px with 1.65 or greater line height. Form input text: 16px to avoid mobile zoom. Headings are generally weight 550–650, not excessively bold. Arabic headings use a more generous line height and no decorative Latin tracking. Avoid letter spacing in Arabic/Hebrew and do not rasterize UI text.

## Component system

- Spacing tokens: `--space-1/2/3/4/6/8` = 4/8/12/16/24/32px.
- Controls: `--control-height` 48px, `--touch-target` 44px minimum; `--control-radius` 8px. Cards use `--radius-card` 12px when no existing layout-specific treatment applies.
- Buttons: primary emerald, secondary outlined surface, destructive text with an explicit confirmation. Disabled buttons retain a visible shape and use the native disabled state. Submission messages name the action underway.
- Fields: visible labels, 16px input text, darker borders than decorative dividers. Errors use text/role and color together. Currency inputs isolate numeric direction without forcing the whole form LTR.
- Focus: 3px outline with 4px offset. Dialogs retain focus, support Escape where safe and restore the trigger. Tab and native select controls remain keyboard accessible.
- Motion: `--motion-fast` 160ms for color/focus changes. The global reduced-motion media query disables animations and smooth scrolling.
- Financial charts have exact tabular alternatives. Status text and signed amounts explain values without requiring color vision.

## Metadata and indexing

The public landing page has a title, description, canonical URL and social preview. Its canonical URL is derived only from a configured HTTPS `BETTER_AUTH_URL`; no deployment domain is invented. Local/invalid/absent origins are not advertised and default to no indexing. The sitemap contains only the public landing page. App, authentication, onboarding and demo pages explicitly request no indexing; the robots file excludes them and API paths. These directives control discoverability, not authorization—server-side sessions and ownership checks protect financial data.

Set the final origin before the production build and deployment, so generated metadata and the sitemap refer to the correct host. Changing a deployment domain requires rebuilding. The language selector currently changes one URL's interface, so the metadata does not invent separate language URLs or `hreflang` alternates.
