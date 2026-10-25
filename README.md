# Color Hub

Extract colors, analyze palettes, and enhance your design workflow.

## Features
- Pick colors from anywhere using `Pick Color` (EyeDropper)
- Analyze webpage CSS colors (text, backgrounds, borders, outlines, SVG, shadows and gradients, including translucent colors) and save palettes by domain
- See which CSS variables (design tokens) each page color comes from
- Export palettes as CSS variables, SCSS, Tailwind v4/v3 config or W3C design tokens from Palette Studio
- Find near-duplicate colors (e.g. `#333333` and `#343434`) that should be one token
- Compare two palettes, such as staging and production, to see which colors changed
- Extract the main colors of the visible page from a screenshot, including images and video
- Keep a picked-color history with larger, readable swatches
- Copy analyzed RGB/HEX values directly from the analyzer fields
- Keep the extension badge and popup `Last Picked` color in sync
- Copy colors as HEX, RGB, HSL, OKLCH, Tailwind, SwiftUI, UIKit or Compose/Flutter code, with a default format in Settings
- See the nearest Tailwind v4 or v3 color for any color, with its ΔE distance
- Check contrast with WCAG 2.2 ratios and with APCA (the WCAG 3 draft method)
- Export a page's contrast report as a GitHub issue, Markdown, CSV or JSON
- Simulate color vision deficiencies and blurred vision on any page
- Hover any element to inspect its colors, contrast and CSS variables
- Right-click menu for the page tools, and for checking the contrast of a selected color code
- Back up and restore your history, palettes, contrast pairs and settings as a JSON file
- Fast access in a compact popup UI

## Install (Development)
1. Install dependencies: `pnpm install`
2. Start the dev server: `pnpm dev`
3. Load the extension in Chrome:
   - Open `chrome://extensions`
   - Enable Developer mode
   - Click "Load unpacked" and select `build/chrome-mv3-dev`

## Build (Production)
```bash
pnpm build
```
This creates a production bundle in `build/`.

## Permissions
- `activeTab`: read the currently active tab on demand
- `tabs`: read the active tab's URL and title (restricted-page check, saved colors per site, WCAG report header)
- `storage`: save palettes and settings
- `unlimitedStorage`: store larger color histories and saved webpage colors
- `scripting`: inject scripts to sample colors
- `contextMenus`: the Color Hub right-click menu
- `host_permissions` `<all_urls>`: allow color sampling on any page, and capture the visible tab for `Extract Colors from Screenshot`

## Privacy
This extension does not collect or transmit user data. All data stays local in your browser storage.

## Contributing
See `CONTRIBUTING.md` for workflow and guidelines.

## License
MIT — see `LICENSE`.

## Release Notes
See `RELEASE_NOTES.md` and `CHANGELOG.md`.
