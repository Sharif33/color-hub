# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

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
