# Design System & Implementation Specification: Predicts 26 (Brutalist Editorial)

This document serves as the design specification and screen implementation reference for the **Predicts 26 Knockout Predictor** project. It details the brand guidelines, typography systems, mathematical layouts, and component structures used to build a premium, high-contrast, Brutalist editorial aesthetic.

---

## 1. Brand & Design Philosophy

The brand is modeled after high-stakes sports broadcasting and news-editorial journalism. It is bold, high-contrast, authoritative, and clean:

*   **Outline System:** Thick, solid dark outlines (`border-2 border-slate-950`) define every container, button, and input element.
*   **Shadow System:** Flat, hard outlines (`shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]` or `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`) are used for depth and active focus, completely replacing dynamic gradients or blur shadows.
*   **Whitespace & Margin Rhythm:** Fixed spacing scales (4px, 8px, 16px, 24px, 32px) govern the layout. Horizontally scrolled columns implement a `scroll-ms-8` margin to ensure a clean 32px padding when columns are smooth-scrolled into view.
*   **Zero Emojis**: Emojis are strictly avoided. Vector-based Lucide icons and local SVG graphics are used instead.

---

## 2. Brand Color Palette

The color system uses solid high-contrast backgrounds with custom nation-specific accents:

| Token Name | Hex Color | Usage / Role |
| :--- | :--- | :--- |
| `background` | `#f8fafc` | Main canvas background |
| `surface` | `#ffffff` | Panel surfaces, cards, and primary containers |
| `surface-dim`| `#f1f5f9` | Recruit elements, inputs, and Recessed sections |
| `on-surface` | `#0f172a` | Primary typography |
| `outline` | `#0f172a` | Solid 2px borders and thick dividers |
| `primary` | `#003ec7` | Active navigation highlights and active round states |
| `emerald-600` | `#16a34a` | Correct prediction borders and victory highlights |
| `red-600` | `#dc2626` | Incorrect prediction borders |
| `gold-trophy` | `#f59e0b` | Champion trophies and tournament winners |

### Nation Flag Mapping Pips
Dynamic flags are rendered from **FlagCDN** (`https://flagcdn.com/w40/{code}.png`). Custom subdivisions are mapped locally:
*   `ENG` (England) -> `gb-eng`
*   `USA` -> `us`
*   `NED` (Netherlands) -> `nl`
*   `ARG` (Argentina) -> `ar`
*   `FRA` (France) -> `fr`
*   `GER` (Germany) -> `de`
*   `ESP` (Spain) -> `es`

---

## 3. Typography Pairings

The website currently uses only these fonts:

*   **Primary Headings (`font-sans`):** **Outfit** from Google Fonts (ExtraBold / Black, tight tracking).
*   **Body & Labels (`font-sans`):** **Inter** from Google Fonts (Bold / Medium, tracking-tight).
*   **Code/Stats (`font-mono`):** **JetBrains Mono** is reserved exclusively for tabular details.

### Font-Weight Matrix
*   **Scores / Stats:** `font-black text-sm md:text-base` for heavy numbers.
*   **Team Names:** `font-extrabold text-sm md:text-base tracking-tight`.
*   **Navigation & Tabs:** `font-black text-xs uppercase tracking-widest`.
*   **Header Labels:** `font-black uppercase tracking-wider text-[10px]`.

---

## 4. Mathematical Spacing Matrix (Bracket Wiring)

To guarantee that the connecting wires between stages meet perfectly without offset errors, the horizontal columns align using a fixed card size and calculated vertical padding/offsets:

### Spacing Core Rules
*   **Card Height (`cardHeight`):** Enforced at exactly `130px` inside [index.css](file:///c:/Users/Asus/OneDrive/Desktop/worldcup_pred/src/index.css).
*   **Column Gap:** `64px` (`gap-16`).
*   **Horizontal Wires:** Nested inside the top vertical connector at `bottom: 0`, `right: -32px` (extends `32px` to the right to meet the `64px` gap halfway).

### Columns Positioning Matrix
All columns start at the top (`items-start` on the scroll parent) and apply the following vertical properties:

| Round Stage | Top Padding (`pt`) | Card Gap (`gap`) | Vertical Connector Height |
| :--- | :--- | :--- | :--- |
| **Round of 32** | `pt-0` | `gap-6` (24px) | `calc(50% + 12px)` |
| **Round of 16** | `pt-[77px]` | `gap-[178px]` | `calc(50% + 89px)` |
| **Quarterfinals** | `pt-[231px]` | `gap-[486px]` | `calc(50% + 243px)` |
| **Semifinals** | `pt-[539px]` | `gap-[1102px]` | `calc(50% + 551px)` |
| **Finals** | `pt-[1091px]` | `gap-6` (24px) | `none` |

---

## 5. Main Component Structures

### A. Match Cards (`MatchCard`)
Renders the core bracket matches. It accepts `teamA` and `teamB` (can be `null` for skeleton states):

*   **TBD / Skeleton State:** When `team = null`, it displays a dashed flag container (`w-[22px] h-[16px] border-dashed border-slate-300 bg-slate-50`) alongside an italicized, low-opacity `"TBD"` text.
*   **Connectors:**
    *   `connectorType="top"`: Renders a line going right by `32px`, then down.
    *   `connectorType="bottom"`: Renders a line going right by `32px`, then up.
    *   `hasConnectorLine={true}`: Renders the horizontal `.bracket-line` at the bottom edge of the top connector (meeting point).

### B. Predicted Champion Card
*   **TBD / Placeholder State:** A white card with a dashed border (`border-dashed border-slate-950`), a grey vector trophy icon, and italic `"TBD"`.
*   **Predicted / Decided State:** An emerald-tinted solid card (`bg-emerald-50 border-emerald-600`) featuring a gold vector trophy SVG and the name of the winning nation in bold.

---

## 6. CSS Reference Implementation

```css
/* Bracket Wires meeting points */
.bracket-connector {
  border-right: 2px solid var(--color-outline);
  border-top: 2px solid var(--color-outline);
  border-bottom: 2px solid var(--color-outline);
  width: 32px;
  position: absolute;
  right: -32px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 0;
}
.bracket-connector.top { 
  border-bottom: none; 
  top: 50%; 
  transform: none; 
}
.bracket-connector.bottom { 
  border-top: none; 
  bottom: 50%; 
  top: auto; 
  transform: none; 
}
.bracket-connector .bracket-line {
  height: 2px;
  background-color: var(--color-outline);
  width: 32px;
  position: absolute;
  bottom: 0;
  right: -32px;
  z-index: 0;
}

/* Enforced Match Card Height */
.match-card {
  border: 2px solid var(--color-outline);
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 10;
  background-color: var(--color-surface);
  height: 130px;
}
```
