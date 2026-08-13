---
name: SWALHA Analytics
description: Open-source, privacy-friendly web & product analytics. A flat, dark-mode-default instrument panel where the data is the interface, wearing the SWALHA gold.
colors:
  # Surfaces (dark mode is the default theme; light values noted in prose)
  background: "#0a0a0a"        # hsl(0 0% 3.9%) — app canvas (dark)
  surface: "#1b1b1b"           # hsl(0 0% 10.5%) — card / panel (neutral-900)
  surface-raised: "#242424"    # hsl(0 0% 14%) — default button / elevated chrome (neutral-850)
  foreground: "#fafafa"        # hsl(0 0% 98%) — primary text (dark)
  muted-foreground: "#a1a1a1"  # hsl(0 0% 63%) — secondary text / descriptions
  border: "#262626"            # hsl(0 0% 15%) — hairline dividers (dark)
  # Accent — the SWALHA gold ramp carries primary action + selection
  accent: "#d1a84b"            # gold-500 (swalha.com --gold)
  accent-strong: "#b99239"     # gold-600 (border / pressed fill)
  accent-deep: "#74591b"       # gold-800 (deep tint)
  # Data visualization
  dataviz: "#8ec5ff"           # hsl(210.7 100% 77.8%) — primary chart series (dark)
  dataviz-2: "#2b7fff"         # hsl(216.3 100% 58.5%) — secondary chart series
  # Semantic state
  destructive: "#ef4444"       # red-500
  warning: "#eab308"           # yellow-500
  info: "#3b82f6"              # blue-500
  success: "#10b981"           # emerald-500
typography:
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "normal"
rounded:
  sm: "6px"    # calc(var(--radius) - 4px)
  md: "8px"    # calc(var(--radius) - 2px)
  lg: "10px"   # var(--radius) = 0.625rem (matches swalha.com)
spacing:
  xs: "6px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-default:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
    height: "36px"
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "#1a1206"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
    height: "36px"
  button-accent-hover:
    backgroundColor: "#dcb55e"  # gold-400
    textColor: "#1a1206"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "4px 12px"
    height: "36px"
  badge-success:
    backgroundColor: "rgba(16,185,129,0.20)"
    textColor: "#34d399"  # success stays green; gold is action-only
    rounded: "{rounded.md}"
    padding: "2px 6px"
---

# Design System: SWALHA Analytics

## 1. Overview

**Creative North Star: "The Instrument Panel"**

SWALHA Analytics is a precise, legible cockpit for understanding a website. Every surface is flat; depth comes from tonal layering of a pure-grayscale ramp, not from shadows. The canvas recedes (near-black `#0a0a0a` in the default dark theme, matching swalha.com), panels lift one notch (`#1b1b1b`), interactive chrome lifts one more (`#242424`), and hairline 1px borders draw the seams. Onto that calm gray instrument, three signals are painted with intent: the **SWALHA gold** (`#d1a84b`) for action and selection, a **blue** (`#8ec5ff`) for the data lines themselves, and **green** reserved strictly for success and healthy state. The data is the instrument; the chrome stays out of the way.

The gold, the neutral chassis, the `0.625rem` radius, and Inter are all inherited directly from swalha.com, so the product and the marketing site read as one company.

The personality is friendly, precise, and trustworthy: approachable without being toy-like (PRODUCT.md). Warmth lives at the edges (an empty state, a small touch) and in the gold itself, never on top of the numbers. Density is a feature here, not a flaw: this is a tool people open to answer a specific question, and the layout should put that answer in front of them in seconds with depth one layer down. Radii sit at `0.625rem` / 10px, matching swalha.com — soft enough to feel crafted, tight enough that dense tables still read as engineered.

This system explicitly rejects the **generic SaaS template** (purple gradients, the hero-metric template, endless identical icon+heading+text card grids), anything **over-playful or toy-like** that undermines trust in the data, the **cluttered GA4** maze, and **cold enterprise-BI** heaviness (PRODUCT.md anti-references). It should feel like Linear or a Vercel/Stripe dashboard: confident, quiet, fast.

**Key Characteristics:**
- Dark-mode-default; a full light theme mirrors every token.
- Flat by default: depth via a 21-step grayscale ramp + 1px borders, never shadows.
- One accent (gold) for action/selection, one data hue (blue) for charts, green for success only.
- Geometry shared with swalha.com: 10px radius, Inter throughout, compact 36px controls.
- Density with legibility: dense data, but body text stays ≥4.5:1 contrast.

## 2. Colors

A pure-neutral grayscale chassis carrying exactly two chromatic signals; semantic state colors appear only on state.

### Primary
- **SWALHA Gold** (`#d1a84b`, `--accent-500`; border/pressed `#b99239`, `--accent-600`): The single brand accent, taken from swalha.com's `--gold: oklch(0.75 0.12 85)` and expanded into an 11-step ramp (`--gold-50` … `--gold-950`) that `--accent-*` aliases. Primary buttons, current selection, selected rows and tabs, focus emphasis, brand marks. This is the only color allowed to mean "act here."

### Secondary
- **Blue Data Line** (`#8ec5ff` dark / `#2b7fff` light, `--dataviz`; second series `#2b7fff`, `--dataviz-2`): Reserved exclusively for data visualization (line/bar/area series, the weekday heatmap, the retention grid, the activity globe). It is a *data* color, never a UI color: it must not appear on buttons, links, or chrome. Keeping data blue and action gold is what stops charts from competing with buttons.

### Neutral
The workhorse. A 21-step pure-grayscale ramp (`--neutral-0` at 97% L through `--neutral-1000` at 4% L, chroma 0).
- **Canvas** (`#0a0a0a`, `--background` dark / `#f7f7f7` light): The app backdrop.
- **Surface** (`#1b1b1b`, `--neutral-900` / white light): Cards and panels, one step off the canvas.
- **Raised Surface** (`#242424`, `--neutral-850` / white): Default buttons and elevated chrome.
- **Primary Text** (`#fafafa`, `--foreground` dark / `#0a0a0a` light): Body and headings.
- **Muted Text** (`#a1a1a1`, `--muted-foreground`): Descriptions, secondary labels, placeholders. Verify ≥4.5:1 before going lighter.
- **Border** (`#262626`, `--border` dark / `#ebebeb` light): Hairline seams and dividers, always 1px. Mirrors swalha.com's `oklch(1 0 0 / 10%)` composited over the canvas.

### Tertiary (semantic state only)
- **Success Green** (`#10b981`, `--emerald-500` / `--green-500`): Success badges, positive deltas, live/realtime pulses, uptime-OK, copy-confirm checks. Green no longer carries the brand — it carries *only* the meaning "this went well" — but it stays green so the green/red delta pairing survives.
- **Destructive Red** (`#ef4444`, `--red-500`): Errors, delete actions, negative deltas.
- **Warning Yellow** (`#eab308`, `--yellow-500`): Warnings, caution thresholds.
- **Info Blue** (`#3b82f6`, `--blue-500`): Informational badges only. It now sits close to the `--dataviz` hue, so keep it off anything adjacent to a chart — prefer a neutral badge there.

A full Tailwind-style ramp (red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose) is defined in `globals.css` for chart palettes and category coloring. Outside data viz and state, do not reach into it.

### Named Rules
**The Signal-Not-Decoration Rule.** Gold marks primary actions and current selection only. It never tints a surface, never fills a background, never decorates. If gold is on screen and nothing actionable is being communicated, remove it.

**The Three-Voice Rule.** The interface speaks in grayscale. Exactly three chromatic voices are allowed on top: gold for *action*, blue for *data*, green for *success*. Never swap them — a gold chart or a green button breaks the whole scheme. Remaining state colors (red/yellow) are whispers that appear only when state demands them.

**The Flat Rule.** No `box-shadow` for resting elevation. Depth is the grayscale ramp plus 1px borders. If two surfaces need separating, change the neutral step or add a hairline border, not a shadow.

## 3. Typography

**Display / Body / Label Font:** Inter (with `system-ui, sans-serif` fallback), loaded via `next/font`.

**Character:** One family, carried by weight and size contrast, not by pairing. Inter is neutral, screen-legible at small sizes, and tabular-friendly for numbers, which is exactly right for a dense analytics tool. There is no display typeface; product UI does not need one.

### Hierarchy
- **Headline** (600, 1.875rem / 30px, line-height 1.1): Large stat values and primary metric numbers. Use tabular figures for aligned columns.
- **Title** (600, 1rem / 16px, `leading-none`, `tracking-tight`): Card titles, section headers, panel headings.
- **Body** (400, 0.875rem / 14px, line-height ~1.4): The dominant size. Table cells, descriptions, most UI text. Cap prose at 65–75ch; tables may run denser.
- **Label** (500, 0.75rem / 12px): Badges, chips, small captions, axis labels, secondary metadata.

### Named Rules
**The One-Family Rule.** Inter does every job: headings, body, labels, data. Do not introduce a second UI typeface. Hierarchy comes from weight (400/500/600) and size, never from a new face.

**The No-Shrinking-Headline Rule.** Type uses a fixed rem scale, not fluid `clamp()`. Users view at a consistent DPI inside an app shell; a heading that shrinks in a sidebar looks worse, not better.

## 4. Elevation

This system is **flat by default**. There is no resting shadow vocabulary; depth is conveyed entirely through the grayscale ramp (canvas → surface → raised surface) and 1px borders. Cards declare `transition-all duration-300` but carry no shadow at rest; the only motion-borne depth is a hairline border-color shift on hover. If a surface looks like a 2014 app, the shadow is the problem: remove it and step the neutral instead.

### Named Rules
**The Tonal-Depth Rule.** Separation is achieved by moving one step on the neutral ramp or adding a 1px border, never by stacking shadows. Overlays that genuinely float (dropdowns, dialogs, popovers via Radix) may use the platform's minimal elevation, but in-page surfaces stay flat.

## 5. Components

### Buttons
- **Shape:** `rounded-lg` (10px) for default/sm/lg; `rounded-md` (8px) for xs/icon. Height 36px default (`h-9`), 32px sm, 24px xs. `font-medium`, `transition-colors`.
- **Default:** Raised neutral surface with a 1px border (`#242424` fill, `#3d3d3d` border in dark; white fill, `#d9d9d9` border in light). Hover lightens the fill and border one step. This is the neutral workhorse button.
- **Accent:** Gold fill (`#d1a84b`, `--accent-500`) with a `--accent-600` border and near-black text (`#1a1206`) — gold is light enough that white text on it fails contrast. The primary call to action.
- **Destructive / Warning:** Red / yellow fills, used only for genuinely destructive or cautionary actions.
- **Outline / Ghost / Link:** Transparent surfaces with muted neutral text; hover fills with the faintest neutral step. For secondary and tertiary actions.
- **Focus:** `focus-visible:ring-1` in `--neutral-950` (light) / `--neutral-300` (dark). Always keep a visible focus ring.

### Cards / Containers
- **Corner Style:** `rounded-lg` (10px).
- **Background:** Surface step (`#1b1b1b` dark / white light), one notch off the canvas.
- **Border:** 1px hairline (`--neutral-850` dark / `--neutral-100` light). `overflow-hidden`.
- **Shadow Strategy:** None at rest (see Elevation). Hover may shift border color only.
- **Internal Padding:** 16px (`p-4`); header uses `space-y-1.5` (6px). Descriptions in muted text at 14px.
- **Loading:** Cards use an in-place `CardLoader` (ldrs Zoomies) tinted from the neutral ramp; prefer skeletons over a centered spinner for content.

### Inputs / Fields
- **Style:** Transparent background, 1px border (`--neutral-150` light / `--neutral-800` dark), `rounded-lg`, 36px tall (`h-9`), 14px text. Placeholder in muted neutral (meets 4.5:1).
- **Focus:** `focus-visible:ring-1` neutral; no border color change beyond the ring.
- **Error:** `aria-[invalid=true]` flips the border to red-500 (dark: red-400).
- **Search variant:** Leading 16px search icon in `--neutral-400`, `pl-9`.

### Badges / Chips
- **Shape:** `rounded-md` (8px), `px-1.5 py-0.5`, 12px `font-medium`.
- **Semantic variants:** success/destructive/warning/info render as a 20% tint of the hue with the 600 (light) / 400 (dark) text shade and a transparent border. Neutral default/secondary/outline/ghost use the grayscale ramp.

### Data Visualization (signature)
- Charts (Nivo bar/line/calendar, D3, Mapbox/OpenLayers globe) render series in blue (`--dataviz`, `--dataviz-2`) by default, escalating to the full Tailwind ramp only when many categories must be distinguished. Axes, gridlines, and labels use the muted neutral steps so the data line stays dominant. Prefer hue+shape/position separation over hue-alone (PRODUCT.md a11y).

## 6. Do's and Don'ts

### Do:
- **Do** keep surfaces flat: convey depth with the neutral ramp (`#0a0a0a` → `#1b1b1b` → `#242424`) and 1px borders.
- **Do** reserve gold for action and current selection (The Signal-Not-Decoration Rule).
- **Do** keep data viz in blue (`--dataviz`) and the broader ramp; never use the data hue on chrome.
- **Do** keep green for success, health, and positive deltas only — never for brand or action.
- **Do** reach for the `--accent-*` token, never a literal `gold-*`/hex, so a future accent change is one edit.
- **Do** use Inter at fixed rem sizes with weight contrast (400/500/600) for all hierarchy.
- **Do** keep radii at 10px (`--radius: 0.625rem`) and controls compact (36px default height).
- **Do** keep a visible `focus-visible` ring on every interactive element, and honor `prefers-reduced-motion`.
- **Do** mirror every token across dark and light themes; dark is the default.

### Don't:
- **Don't** ship the **generic SaaS template**: no purple gradients, no hero-metric template (big number + tiny label + gradient accent), no endless identical icon+heading+text card grids.
- **Don't** let the friendly tone tip into **over-playful / toy-like** territory that undermines trust in the numbers.
- **Don't** recreate the **cluttered GA4** maze or **cold enterprise-BI** heaviness: surface the likely answer first, depth one layer down.
- **Don't** add resting `box-shadow` for elevation (The Flat Rule); don't use shadows where a neutral step or border works.
- **Don't** use `border-left`/`border-right` > 1px as a colored accent stripe; use full hairline borders or a tint.
- **Don't** use gradient text (`background-clip: text`) or decorative glassmorphism.
- **Don't** introduce a second UI typeface or fluid `clamp()` headings.
- **Don't** tint surfaces or backgrounds with gold, or paint chrome in the blue data hue.
- **Don't** put white text on a gold fill — gold is a light accent and needs near-black text.
