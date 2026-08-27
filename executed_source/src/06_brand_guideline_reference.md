# Brand Guideline Reference

Condensed from V360's own brand package (`V360_Brand_Guideline_Master_Package`), specifically
the parts that shaped implementation decisions in both tools. This is a reference, not the
full guideline — for anything not covered here, defer to the source package.

## Color

Primary palette (used as-is, both tools):

| Name | Hex | Role |
|---|---|---|
| V360 Orange | `#C6691D` | Accent, headlines, CTAs — **never body text or data** (fails contrast at that use) |
| Charcoal | `#2B2A29` | Primary text; also valid as a dark-mode background |
| White | `#FEFEFE` | Primary background / dark-mode text |

Secondary: Cloud Grey `#EBECEC`, Cream `#FFF6E0`, Ice Blue `#E4F6F8`, Navy `#011843`,
Indigo `#0C2939`, Royal Blue `#072C50`, Slate `#34434D`.

**Accessibility rule from the source guideline, load-bearing for both tools:** orange fails
WCAG contrast for body text and data on both light and dark backgrounds — it's accent-only,
confirmed by testing (white text on charcoal passes at 14.8:1; orange on charcoal is
borderline at ~4.0:1). Every score number, every table value, every data label in both tools
uses charcoal/navy/white depending on theme — orange only touches accent chips, active-state
pills, and the logo.

**Functional colors** (not in the original print guideline, defined for digital use, extended
further for dark-mode in this project since the source only specified light-mode values):
Success green `#2E7D32`, Warning amber `#E0A800`, Danger red `#C62828` (light mode). Dark-mode
equivalents used in this project (`#5CB860` / `#FFC947` / `#EF5350`) are this project's own
reasonable lightened adaptation, not sourced from the original guideline — flagged as a
judgment call, not confirmed brand policy.

**60/30/10 rule:** roughly 60% neutral/light background, 30% charcoal/dark, 10% orange accent
— both tools' layouts default to generous whitespace and sparing orange use for this reason.

## Typography

For **digital/web specifically** (the source guideline's print recommendation is Gill Sans MT
/ Verdana — those are the Office/print fallback, not the web choice):

| Use | Font | Notes |
|---|---|---|
| UI text, headings, body | **Inter** | Loaded via Google Fonts; fallback stack `-apple-system, "Segoe UI", Arial, sans-serif` |
| Spec tables, part numbers, data values | **JetBrains Mono** | Source guideline's own rule: monospace for technical/spec content — used throughout both tools for score numbers, machine IDs, and every raw settings value |

Digital heading scale from the source guideline (H1: Inter 700, 48px, Title Case): the Report's
own page title uses 30px/700/Title Case rather than the full 48px — a deliberate scale-down
since it shares a compact header bar with a logo and action buttons, not a full-page hero. Still
Inter 700, still Title Case, just sized for the actual context rather than applied literally.

## Logo

Two variants used, both real SVGs from `03_Logo_Library`: `Black/SVG/V360.svg` (light-theme
backgrounds) and `White/SVG/V360.svg` (dark-theme backgrounds). See the scoping caution in
`03_output_report_spec.md` — both files use colliding internal style class names and need to
be scoped under unique IDs before being embedded together in one document, or the wrong one's
colors leak into the other.

## Mood, for anyone making new design decisions

Source guideline's own words: precision, premium industrial, technical clarity, restrained B2B.
The four Report visual themes each interpret this differently on purpose (see
`03_output_report_spec.md`) — Instrument Readout leans hardest into "precision/technical,"
Cut & Facet leans into "premium" via the diamond-industry facet motif, Spec Sheet leans into
"restrained." None of the four abandon the core palette or type rules above; they vary
structure and emphasis, not the underlying brand tokens.
