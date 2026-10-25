# Release Notes

## 1.2.0 (2026-10-25)
Developer tools: get a page's colors into your code as tokens, check accessibility more deeply, and trust the analysis more.

Highlights:
- Palette Studio: see every color with its OKLCH value, CSS variable and nearest Tailwind color, then export it as CSS variables, SCSS, Tailwind v4 `@theme`, Tailwind v3 config or W3C design tokens
- Find near-duplicate colors that should be one token, and compare palettes (for example staging against production)
- `Analyze Webpage Colors` names the CSS variables colors come from, keeps translucent colors with their alpha, sees outlines, SVG, shadows and gradients, and looks inside shadow DOM and iframes
- `Extract Colors from Screenshot` gets the main colors of the visible page, images and video included
- Copy any color as HEX, RGB, HSL, OKLCH, Tailwind, SwiftUI, UIKit or Compose/Flutter code, and see its nearest Tailwind color
- APCA (WCAG 3 draft) contrast next to WCAG 2.2, in the Contrast Checker and the WCAG report
- Export the WCAG report as a GitHub issue with suggested fixes, Markdown, CSV or JSON
- Hover inspector for any element's colors and contrast, and color vision deficiency simulation on any page
- Right-click menu for the page tools, including checking the contrast of a selected color code
- Settings page with a default copy format, the Tailwind palette version, and backup and restore
- Fixed color counts that were inflated by borders that aren't drawn and by elements without text

Permissions used:
- `activeTab`, `tabs`, `storage`, `unlimitedStorage`, `scripting`, `contextMenus` (no new permissions)
- `host_permissions`: `<all_urls>`

## 1.1.0 (2026-10-25)
New contrast tools: a Color Contrast Checker and a WCAG contrast report for the current page.

Highlights:
- Added a Color Contrast Checker with alpha support, an eyedropper per color, a live preview, AA/AAA results for normal and large text, and suggested fixes
- Added saved contrast pairs and swatches from color history and saved webpage colors
- Added `Analyze WCAG Contrast`, a report of every text/background pair on the page, measured as rendered, with large text judged at 3:1 and 4.5:1
- Filter the report by failing or passing AA/AAA, sort by ratio or frequency, and open any pair in the Contrast Checker
- `Analyze Webpage Colors` now finds colors written as `oklch()`, `lab()` and `color()`
- Page highlights stay on their elements while scrolling and are cleared from the right tab when the popup closes
- Fixed the hue slider showing hues in reverse order
- Disabled page-based actions on extension stores and other pages the browser doesn't allow scripting on

Permissions used:
- `activeTab`, `tabs`, `storage`, `unlimitedStorage`, `scripting`, `contextMenus`
- `host_permissions`: `<all_urls>`

## 1.0.2 (2026-02-10)
UI and state improvements for picked colors, history visibility, and analyzer interactions.

Highlights:
- Added extension badge state sync with `lastPickedColor` on install/startup/storage updates
- Badge now displays the last picked color and clears automatically when the value is removed
- Added a `Last Picked` section in popup with preview and one-click clear action
- Updated color history and saved webpage colors to larger grid tiles with inline HEX labels
- Improved contrast-aware text rendering on color tiles for better readability
- Enabled click-to-copy on analyzer RGB and HEX fields

## 1.0.1 (2026-02-09)
Updates to popup picking flow and picker UX.

Highlights:
- Consolidated popup picker actions into a single `Pick Color` option
- Removed the separate active-page picker code path
- Kept a lightweight temporary popup state while EyeDropper is active
- Suppressed warning logs for expected user-cancelled EyeDropper actions

## 1.0.0 (2026-02-08)
Color Hub public release.

Highlights:
- Pick colors from any page via the popup and context menu
- Save and organize palettes in browser storage
- Fast, minimal UI focused on everyday design workflows

Permissions used:
- `activeTab`, `storage`, `unlimitedStorage`, `scripting`, `contextMenus`
- `host_permissions`: `<all_urls>`
