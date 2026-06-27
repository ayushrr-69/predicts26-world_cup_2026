# Project Rules: Predicts 26 Tournament Predictor

This file defines the style, alignment, and implementation constraints to preserve the professional Brutalist design system of this codebase.

## 1. Aesthetic Guidelines
* **Brutalist Theme**: Every primary container, card, button, and input must use the thick border style (`border-2 border-slate-950`) and a flat solid outline shadow (`shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`) for depth. Do not use dynamic blur shadows, pastel panel gradients, or glassmorphism.
* **Vector Icons Only**: Emojis are prohibited. Use Lucide icons or raw SVG paths (such as the official FIFA logo SVG and gold Trophy SVG).
* **Dynamic Flag Layout**: Flags must be loaded dynamically from FlagCDN next to the country names. Avoid box containers or country text codes inside badges.

## 2. Mathematical Spacing Matrix
When editing or modifying columns or card offsets in the horizontal tournament bracket, always preserve the mathematical wire-connecting formulas:
* **Card Height**: Every bracket MatchCard must have a fixed height of `162px`. (H=162, G=24, U=H+G=186)
* **Column Alignment**: The horizontal scroll container must use `items-start`, and columns must be positioned using these exact padding/gap values:
  * **Round of 32**: `pt-0`, `gap-6` (24px spacing); connectorHeight=`calc(50% + 12px)`
  * **Round of 16**: `pt-[93px]`, `gap-[210px]`; connectorHeight=`calc(50% + 105px)`
  * **Quarterfinals**: `pt-[279px]`, `gap-[582px]`; connectorHeight=`calc(50% + 291px)`
  * **Semifinals**: `pt-[651px]`, `gap-[1326px]`; connectorHeight=`calc(50% + 663px)`
  * **Finals**: `pt-[1395px]`
* **Wire Routing**: Horizontal lines (`.bracket-line`) must be nested inside the top vertical connector at `bottom: 0`, `right: -32px` to connect columns perfectly across the `64px` column gap.

## 3. Reference Files
* Before making any edits, always review the detailed design specifications in [DESIGN.md](file:///c:/Users/Asus/OneDrive/Desktop/worldcup_pred/DESIGN.md).
* Always test the build output using `npm run build` after editing to ensure there are no compilation warnings.
