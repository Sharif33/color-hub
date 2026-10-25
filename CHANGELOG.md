# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]
### Changed
- Redesigned the popup. The home screen shows the current color as a full-width band with its HEX, OKLCH and nearest Tailwind color (each copies on click), Pick from screen and Adjust, recent colors, and the page tools with a one-line description each. Results, the color editor, history, saved palettes and vision simulation each open as their own screen with a Back button, instead of expanding inside one long list.
- The popup follows the system's light or dark mode.
- The popup is 360px wide (was 300px), and the color editor's hue slider is horizontal.
- In the History screen, `Remove` takes the last picked color off the toolbar icon. This replaces the `×` next to `Last Picked`.
- Deleting a saved palette and clearing the history now ask in the popup's own dialog instead of a browser alert. The dialog says what will be removed and names the action on its button (`Delete palette`, `Clear history`). Cancel has focus first, and Esc or a click outside the dialog cancels.

## [1.2.0] - 2026-10-25
### Added
- Palette Studio, a page for saved palettes and unsaved analyses, opened from the popup's `Palette Studio` action, `Open in Studio` on analyzer results, or `Studio` on a saved palette. It lists each color's HEX, OKLCH, uses, properties, CSS variables, nearest Tailwind color and elements, with click-to-copy. An unsaved analysis can be saved from there.
- Export a palette as CSS variables, SCSS, a Tailwind v4 `@theme` block, a Tailwind v3 config or W3C design tokens (DTCG 2025.10 JSON), with values as HEX, RGB, HSL or OKLCH. Token names come from the page's CSS variables, else the nearest Tailwind color within ΔE 2, else `palette-N`. Copy the code or download it.
- Near-duplicate detection: Palette Studio groups colors that are almost the same (CIEDE2000, threshold adjustable from ΔE 0.5 to 5), suggests the most used color in each group, and copies a find-and-replace list. Analyzer results in the popup show how many near-duplicate groups a page has.
- Compare two palettes in Palette Studio, e.g. staging against production or an unsaved analysis against the saved palette. Colors are shown as the same, changed (up to ΔE 5, with the difference), only in A, or only in B.
- `Analyze Webpage Colors` names the CSS variables each color comes from, e.g. `--primary`, including variables that hold bare channels such as `222 47% 11%` (shadcn/ui) or `37 99 235`. Click a variable to copy `var(--name)`.
- `Analyze Webpage Colors` also finds outline, underline, SVG fill and stroke, shadow and gradient colors, and shows which of these uses each color has.
- Translucent colors are kept with their alpha (e.g. `rgba(0, 0, 0, 0.1)` / `#0000001A`) instead of being merged with the opaque color, and every copy format keeps the alpha. The Tailwind match adds the opacity modifier, e.g. `black/10`.
- `Analyze Webpage Colors` and `Analyze WCAG Contrast` look inside shadow DOM (web components) and iframes. Selectors from an iframe start with `iframe(host) ›`.
- `Analyze Webpage Colors` keeps the 40 most used colors (up from 24).
- `Extract Colors from Screenshot` in the popup finds the main colors of the visible page, including images, canvas and video, and shows how much of the screen each covers. Colors are exact pixel colors, not averages, and text antialiasing is folded into the colors it blends. The result is saved as `<hostname> (screenshot)`, next to the page's CSS palette.
- Nearest Tailwind color for the picked color and for the selected analyzed color, e.g. `≈ blue-500 · ΔE 1.3`. Click it to copy the name. Colors are matched by CIEDE2000 against the Tailwind v4 (4.3.3) or v3 (3.4.1) palette, chosen in Settings.
- Choose the format a click copies: HEX, RGB, HSL, OKLCH, a Tailwind arbitrary value, SwiftUI, UIKit or Compose/Flutter. It applies to color history, saved webpage colors and Pick Color.
- Color picker: an editable OKLCH row, and a "Copy as" row for Tailwind, SwiftUI, UIKit and Compose/Flutter code.
- Color inputs, including the Contrast Checker's, accept `oklch()`.
- APCA contrast (the WCAG 3 draft method, shown as advisory) in the Contrast Checker: the Lc value, its polarity, and which uses it's good enough for, from body text (Lc 75/90) to non-text (Lc 15).
- The WCAG report shows APCA Lc for every pair and can sort by it.
- Export the WCAG report's current view as a GitHub issue (failing pairs as a task list, with the nearest color that passes AA), a Markdown table, CSV or JSON.
- `Inspect Element Colors` in the popup turns on a hover inspector: point at any element to see its text color, rendered background, border color, matching CSS variables, contrast ratio with AA/AAA, APCA Lc, and font size and weight. Click to pin it, copy a color, or open the pair in the Contrast Checker. Esc exits. Clicks don't reach the page while inspecting.
- `Simulate Vision Deficiency` in the popup filters the current page as seen with protanopia, deuteranopia, tritanopia, achromatopsia or blurred vision, using the same color matrices as Chrome DevTools (Machado et al., 2009). It stays on until turned off or the page reloads. The Contrast Checker's live preview has the same simulations.
- Right-click menu (on http, https and file pages): check the contrast of a selected color (e.g. `#2563eb` in code), inspect element colors, analyze page colors or a screenshot into Palette Studio, analyze WCAG contrast, simulate vision, or open the Contrast Checker.
- Settings page, opened from the gear button in the popup header.
- Backup and restore in Settings: export color history, saved palettes, contrast pairs and settings to a JSON file, then import it to merge with or replace the current data. Files are checked before anything is written.

### Changed
- Both analyses check up to 50,000 elements, stopping after about 1.5 seconds on very large pages (before: the first 2,000 elements for colors and 1,200 for contrast). When a scan stops early, the popup and the report say how much of the page was checked.
- `Analyze WCAG Contrast` checks any element with its own text, not only common text tags, so text directly inside a `<div>` is included. Hidden text is skipped.
- The `contextMenus` permission, declared since 1.0, is now used by the right-click menu. No permissions were added.

### Fixed
- `Analyze Webpage Colors` counted every element's border colors even where no border is drawn, which inflated the text color's count several times over.
- `Analyze Webpage Colors` counted the text color of elements without text, of hidden elements, and of `<head>` elements such as `<style>` and `<script>`.
- Re-analyzing a page while a color was highlighted counted the highlight overlays' red.
- Labels on translucent color tiles are now readable. Their text color was chosen as if the color were opaque.

## [1.1.0] - 2026-10-25
### Added
- Added a Color Contrast Checker page, opened from the popup's `Color Contrast Checker` action.
- Contrast checker: foreground and background accept hex (including `#rgba` and `#rrggbbaa`), `rgb()`/`rgba()` and `hsl()`/`hsla()`, with an eyedropper for each color and a swap button. Translucent colors are blended before the ratio is computed.
- Contrast checker: added a live text preview, WCAG AA/AAA results for normal and large text, and font size and bold controls that set which thresholds apply.
- Contrast checker: added suggestions for the nearest colors that reach AA and AAA (3:1 and 4.5:1 for large text).
- Contrast checker: added swatches from color history and saved webpage colors, and saved contrast pairs.
- Contrast ratios are truncated to two decimals, so a failing ratio such as 4.497:1 never displays as 4.50:1.
- Added WCAG contrast analysis of the current page, from the popup's `Analyze WCAG Contrast` action. Its report groups text/background pairs, filters by failing AA, passing AA or passing AAA, sorts by ratio or frequency, lists the elements that use each pair, and opens a pair in the Contrast Checker.
- WCAG analysis measures colors as rendered, blending text and backgrounds through every ancestor's background color and `opacity` onto a white page. Background images are not considered.
- WCAG analysis labels large text (24px and up, or 18.66px and up when bold) and judges it at 3:1 (AA) and 4.5:1 (AAA).

### Changed
- Chrome Web Store, Edge Add-ons, `view-source:`, `chrome-search://` and `chrome-untrusted://` pages are now treated as restricted, so page-based actions are disabled there.
- Extension pages no longer load fonts from Google Fonts, which were not used.

### Fixed
- The hue slider showed hues in reverse order, so the picked hue didn't match the color under the cursor.
- The color picker's hex field expanded `#abc` to `#aabbcc` while typing, which blocked typing a six-digit hex.
- `Analyze Webpage Colors` missed colors written as `oklch()`, `lab()` or `color()`.
- Page highlights drifted away from their elements when the page scrolled.
- Page highlights stayed on a tab when the user switched tabs before the popup closed.
- Analyzing a page that can't be scripted showed empty results. Page-based actions are now disabled instead.
- A failed save of webpage colors left the button stuck on `Saving...`. The popup now shows an error and keeps the results so the user can retry.
- Picking a color already in history could add a duplicate that differed only in letter case.
- The popup re-read storage and re-rendered continuously while open.

## [1.0.2] - 2026-02-10
### Added
- Initialized and synchronized extension badge color from `lastPickedColor` on install/startup/storage changes.
- Added popup `Last Picked` display with color preview and clear action.
- Added a shared contrast text utility for color-based UI elements.

### Changed
- Updated color history and saved webpage color layouts to larger grid tiles with inline HEX labels.
- Updated analyzer selected color fields to support click-to-copy for RGB and HEX.
- Preserved `lastPickedColor` in storage instead of removing it after popup hydration.

## [1.0.1] - 2026-02-09
### Changed
- Replaced separate popup picker entries with a single `Pick Color` action.
- Removed the old active-page picker implementation.

### Fixed
- Treat EyeDropper cancel (`AbortError`) as an expected action without warning noise.

## [1.0.0] - 2026-02-08
### Added
- Initial public release of Color Hub.
