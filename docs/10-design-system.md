# 10 — Design System

> These are the exact tokens already implemented and shipped on the Verity marketing site. The application UI must extend this system, not invent a new one. If the app looks like a different product from the landing page, that's a bug.

## Design intent (read this before touching any UI)

Verity should never look like a generic AI-generated SaaS product. Specifically avoid:
- Purple/blue gradient hero patterns (the most overused pattern in AI-generated UI)
- Cream background + terracotta accent + default serif (a very recognizable "AI tool" tell)
- Inter font used everywhere by default
- Generic rounded-bubble cards with soft grey shadows and no point of view

Instead, the brand draws on **exam-document visual language** — official result slips, CBT interfaces, mark sheets, tabular data — treated with genuine design intent rather than decoration. The signature UI motif from the marketing site is the **"Readiness Card"**: a hybrid of an official WAEC/JAMB result slip and a live dashboard card (perforation notch, dashed rule, rotated "stamp" badge, monospace serial reference, "last updated" timestamp). **This motif should carry into the actual product** — dashboard summary cards, downloadable reports, and readiness displays should feel like the same document-like artifact, not a generic dashboard widget.

## Color tokens

```css
--ink:        #0B0F0D  /* near-black, green-tinted — primary dark surface */
--ink-soft:   #121814   /* secondary dark surface */
--ink-line:   #26302A   /* borders/dividers on dark backgrounds */

--paper:      #ECEAE0   /* primary light background — cool bone, NOT warm cream */
--paper-soft: #E1DECE   /* secondary light surface */
--paper-line: #CFCBB6   /* borders/dividers on light backgrounds */

--pine:       #1F4A3A   /* primary brand accent — deep forest green */
--pine-deep:  #143229   /* pine hover/active state */
--moss:       #5C9C7C   /* brighter pine, for accents on dark backgrounds */

--gold:       #B8862E   /* secondary accent — muted antique gold, NOT amber/terracotta */
--gold-soft:  #D9B863   /* gold on dark backgrounds */

--brick:      #9C4132   /* sparing use only — "weak/needs attention" indicator, like a red-pen correction mark. NEVER a primary UI color, never used for general error states beyond this specific "needs attention" meaning */

--text-ink-hi:   #F3F1E7  /* primary text on dark backgrounds */
--text-ink-lo:   #9BA398  /* secondary/muted text on dark backgrounds */
--text-paper-hi: #14170F  /* primary text on light backgrounds */
--text-paper-lo: #56594B  /* secondary/muted text on light backgrounds */
```

**Rule:** pine = positive/primary action, gold = highlight/featured/premium, brick = weakness indicator only (sparing, never a general "error" red — build a separate neutral error state if needed for form validation, don't repurpose brick for generic form errors since that would dilute its specific "academic weak spot" meaning).

## Typography

```css
--serif: "Newsreader", ui-serif, Georgia, serif;   /* display headings, editorial weight — use italic for emphasis words */
--sans:  "Archivo", -apple-system, "Segoe UI", sans-serif;  /* body copy, UI labels */
--mono:  "IBM Plex Mono", ui-monospace, "SFMono-Regular", monospace;  /* every number, score, data label, eyebrow tag, timestamp */
```

Google Fonts import:
```html
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500;1,6..72,600&family=Archivo:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

**The mono-for-numbers rule is not optional.** Every score, percentage, readiness number, timestamp, and reference ID in the application uses `--mono` with `font-variant-numeric: tabular-nums`. This is a deliberate brand decision tying the UI to exam-slip/CBT numeric culture — don't default to the sans font for numbers because it's "cleaner," that breaks the system.

## Spacing & shape

- Border radius: small and consistent — `3px` for cards/document-like elements, `999px` (pill) for buttons/badges only. Never large bubbly radii (16px+) — that reads as generic consumer-app, not institutional/credible.
- Hairline borders (`1px`) in `--paper-line` / `--ink-line`, used deliberately as structural dividers (echoing ruled document lines), not decoration.
- Dashed borders (`1px dashed`) specifically signal "tear-off/document" moments — used on the Readiness Card's internal dividers. Reserve this treatment for readiness/report-style components, don't use dashed borders generically.

## Motion

- Restrained. Only: score count-up animation, bar-fill on reveal, subtle card tilt on mouse move (desktop only), fade+rise on scroll reveal.
- No parallax, no particle effects, no scroll-jacking.
- **Everything must respect `prefers-reduced-motion: reduce`** — disable all non-essential animation when set. This is a strict requirement, not a nice-to-have, given the mobile-first / varied-device audience.

## Component patterns to carry into the app

### Buttons
- Primary: solid `--pine` background, pill radius, mono uppercase label, small letter-spacing
- Ghost: transparent with hairline border, fills on hover
- Gold: reserved for the single highest-priority CTA on a screen (e.g., "Upgrade," "Start diagnostic") — don't overuse, it loses meaning if every button is gold

### The Readiness Card pattern (use in-app, not just marketing)
Reuse this exact structure for the student's real dashboard readiness summary and for downloadable/printable reports:
- Small mono "reference" label top-left (e.g., candidate ID, session reference)
- Rotated "stamp" badge showing status (Developing / Approaching Ready / Strong Ready etc.) — outlined badge, not filled, ~4° rotation
- Large mono score number, tabular-nums
- Confidence tag directly under the score, mono, small, gold-colored
- Topic bars: label + thin fill-bar + mono percentage, weak topics use `--brick` fill, others use `--pine`
- Footer row: weakest cluster callout + "Updated {time} ago" in mono — the freshness timestamp is a deliberate trust signal, always show it on any live readiness display

### Data tables / cohort views (teacher & admin dashboards)
- Follow the same hairline-grid pattern used in the marketing site's "facts grid" and "trust grid" sections — thin `--paper-line` borders forming a grid, cells in `--paper-soft`, not heavy bordered tables with alternating row stripes (too generic-enterprise)
- Numbers always mono, right-aligned, tabular-nums
- Status/label text always sans, left-aligned

### Forms
- Label: mono, small, uppercase, muted color, positioned above the field (already implemented this way on the marketing site's contact form — replicate exactly)
- Input: `--paper` background, hairline border, pine border on focus, no heavy box-shadow glow
- Never use a bright, generic blue focus ring — focus states use `--pine` or `--gold` (for accessibility-critical focus-visible outlines specifically, gold is used, matching the marketing site's `outline: 2px solid var(--gold)` pattern)

### Badges / status indicators
- Outlined, not filled, small rotation optional for "stamp" contexts (readiness status only)
- Mastery/readiness labels use color meaningfully: pine = good/strong, gold = featured/highlight, brick = needs attention — never introduce a fourth arbitrary color for status

## Brand usage — Verity / Lumio

- **Verity** is the product wordmark — used everywhere in the app UI (nav, headers, footer, emails, receipts)
- **Lumio** is the company — appears only in footer legal text, copyright lines, and terms/invoices ("© Lumio. Verity is a Lumio product.")
- Logo: use the provided Verity logo asset (checkmark mark in pine-to-moss gradient + gold accent, wordmark in near-black). On dark backgrounds (nav, footer, dark dashboard sections if any), wrap the logo in a light `--paper` chip/pill — the logo's dark text disappears directly on dark backgrounds without this treatment. This exact pattern is already implemented on the marketing site; replicate it in the app shell.

## Mobile-first requirement

The primary student experience is mobile. Design and build mobile layouts first, then expand to tablet/desktop — not the reverse. This is a stated product principle (see `docs/01-product-vision.md`, `docs/02-users-and-journeys.md`), not just a technical nicety, given the target market's device patterns.

## Accessibility baseline

- Visible focus states on every interactive element (see focus-visible pattern above)
- Sufficient contrast — verify text/background pairs against the token list above, don't eyeball it
- All interactive elements keyboard-navigable
- `prefers-reduced-motion` respected everywhere, as stated above
