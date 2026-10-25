# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Color Hub is a Chrome MV3 extension built with **Plasmo 0.90.5**, React 18, Tailwind 3 and `lucide-react`. Package manager is **pnpm**.

## Commands

```bash
pnpm install
pnpm dev                 # dev build with HMR → load build/chrome-mv3-dev via chrome://extensions "Load unpacked"
pnpm build               # production build + zip → build/chrome-mv3-prod(.zip)
pnpm package             # zip an existing build
pnpm exec tsc --noEmit --incremental false   # type check (passes clean; the flag stops it writing an untracked tsconfig.tsbuildinfo)
pnpm exec prettier --write <files>
```

- There is no test suite and no linter.
- CI (`.github/workflows/ci.yml`, Node 20 / pnpm 9) runs only `pnpm install --frozen-lockfile` and `pnpm build`, so keep `pnpm-lock.yaml` in sync with `package.json`. pnpm 9 rejects a lockfile with more than one YAML document, which pnpm 11+ creates by prepending a `packageManagerDependencies` block. Don't commit that block.
- `.github/workflows/release.yml` publishes the GitHub release on every push to `main` whose `package.json` version has no tag yet (see Releases below).
- Prettier is not enforced, and several existing files are unformatted. Format only the files you touch so diffs stay small.

## Architecture

### Plasmo entry points and manifest
- Plasmo routes entry points by file name:
  - `src/popup.tsx` → the action popup.
  - `src/background.ts` → the service worker.
  - `src/options.tsx` → the options page (Settings), opened with `chrome.runtime.openOptionsPage()`.
  - `src/tabs/<name>.tsx` → an extension page at `tabs/<name>.html`, opened with `chrome.tabs.create({ url: chrome.runtime.getURL("tabs/<name>.html") })`. The pages are `contrast-checker`, `wcag-contrast-analyzer` and `palette-studio`. Palette Studio is opened with `openPaletteStudio()` from `~features/palette-studio/pending`, and takes `?domain=` or `?pending=1`, plus an optional `&view=colors|export|lint|compare`.
- The manifest is generated from the `manifest` field in `package.json`, so change permissions there. Per CONTRIBUTING, permission or privacy changes also need a `README.md` update. `contextMenus` is used by the right-click menu (`~features/context-menu`), which the background registers on install and shows only on http(s) and file pages.
- `.plasmo/` and `build/` are generated. Don't edit them.
- The path alias `~` maps to `src/` (e.g. `~utils/color-utils`). Images are imported as `data-base64:~assets/...`. One directory name contains a space: `src/components/color hub/`.

### Page interaction: injected functions, no content scripts
The extension has no content scripts. All work on the page goes through `chrome.scripting.executeScript({ func, args })`, called from the popup or the background script (see `src/features/webpage-color-analyzer/index.ts`).
- **Injected functions are serialized**, so they must be self-contained: no imports, and no references to module-scope helpers. That is why `parseCssColor` (which resolves `oklch()`/`lab()`/`color()` through a 1×1 canvas, since computed styles keep those as written) and its helpers are copied inside each injected function. Don't refactor them to use `~utils/color-utils`. Pass inputs through `args`.
- Page-highlight overlays live under `#ecp-highlight-root` as `[data-ecp-highlight="true"]` nodes. Cleanup code in both `background.ts` and the analyzer depends on these markers, and the color scan skips them.
- Page scans run in every frame (`runInAllFrames`, which falls back to the top frame if a frame can't be scripted) and walk into open and closed shadow roots. Each frame returns raw counts that `mergeColorScans` / `mergeContrastScans` add up, so ranking and limits are applied after merging.
- CSS variables are matched to colors by value: `scanColorsInPage` reads custom property names from same-origin stylesheets (cross-origin ones throw and are skipped) and resolves them on `:root`, then `body`. Variables defined only on deeper elements aren't found.
- `scanColorsInPage` both extracts colors and highlights one, so the two always agree on which elements use a color. A color's key is its `AnalyzedColor.rgb` value: `rgb(r, g, b)`, or `rgba(r, g, b, a)` with alpha rounded to two decimals.
- The hover inspector (`~features/color-inspector`) runs in the top frame only. Its UI is in a closed shadow root under `[data-ecp-inspector]`. Calling `toggleInspectorInPage` again stops it, through `window.__ecpInspector` in the isolated world.
- The vision simulation (`~features/vision-simulation`) adds a `<style>` and an SVG filter, both marked `[data-ecp-vision="<mode>"]`, to the top frame. Its filter on `html` covers iframes too. It isn't cleared when the popup closes, only by choosing Off or reloading. The color matrices are duplicated inside the injected function.
- `chrome://`, `edge://`, `about:` and similar pages can't be scripted (see `src/utils/restricted-urls.ts`). The popup disables page-based features on them.

### State: `chrome.storage.local` is the source of truth
The code calls `chrome.storage.local` directly. `@plasmohq/storage` and `@plasmohq/messaging` are installed but unused. Hooks do an initial `get` and then subscribe with `chrome.storage.onChanged`, which keeps the popup, the tabs and the background script in sync. Storage keys:

| Key | Shape | Notes |
|---|---|---|
| `colorHistory` | `ColorEntry[]` | Deduped by hex (case-insensitive) and capped at `COLOR_HISTORY_LIMIT` (35, `~lib/constants`). |
| `lastPickedColor` | `ColorEntry` | `background.ts` watches it and paints the action badge with the color. |
| `WEBPAGES_COLORS` | `Record<hostname, AnalyzedColor[]>` | Saved results of the webpage color analyzer. Screenshot palettes are saved under `<hostname> (screenshot)` and have `coverage` instead of meaningful selectors. |
| `savedContrastPairs` | `SavedPair[]` | Contrast checker's saved pairs (`~hooks/use-saved-pairs`). |
| `WCAG_ANALYSIS_PENDING` | `WCAGAnalysisData` | Handoff from the popup to the `wcag-contrast-analyzer` tab. |
| `PALETTE_PENDING` | `PendingPalette` | Handoff of unsaved analyzer results from the popup to Palette Studio, which can save them into `WEBPAGES_COLORS`. |
| `settings` | `Settings` | User preferences (`~lib/settings`, `~hooks/use-settings`). Always read through `parseSettings`, which fills in defaults. |

Backups (`~lib/backup`, in Settings) hold every key above except the `*_PENDING` handoffs. A new persistent key should be added to `BACKUP_KEYS`, with a shape check in `parseBackup`.

### Messaging and lifecycle
- Messages go to the background with raw `chrome.runtime.sendMessage`:
  - `COLOR_PICKED` saves the color to history and to `lastPickedColor`.
  - `OPEN_CONTRAST_CHECKER` (`{ foreground, background, largeText }`, from the hover inspector in the page) opens the Contrast Checker. `contrastCheckerUrl()` validates the hex values first, because the message comes from page context.
- The analyzer's `save()` and `cancel()` clear the page overlays themselves (`clearWebpageHighlights()` in the analyzer).
- The popup opens a port named `"popup"` and posts `{ highlightedTabId }` on it when it highlights a page. When the port disconnects (the popup closes), the background clears highlights on that tab. It doesn't query the active tab, because the user may have switched tabs.
- **Pick Color** uses the EyeDropper API from the popup (`features/pick-outside-browser-color`):
  - While picking, the popup shows a minimal UI, then calls `window.close()`.
  - The color reaches the next popup session by this path: `COLOR_PICKED` → background → storage → `useColorHistory`.
  - An `AbortError` means the user cancelled. It is expected and should not be logged as a warning.

### Feature flows
- **WCAG analysis:**
  1. The popup calls `analyzeWebpageContrastPairs()`. It scans text elements and composites the text color over every ancestor's background color and `opacity` up to the root, on a white canvas, to get the colors actually rendered (background images are ignored). Each pair is flagged `largeText` (≥ 24px, or ≥ 18.66px bold) and judged at 3:1 / 4.5:1. It resolves `null` and writes nothing when the page can't be scripted.
  2. It writes the result to `WCAG_ANALYSIS_PENDING`.
  3. It opens `tabs/wcag-contrast-analyzer.html`.
- **Contrast checker** (`tabs/contrast-checker.tsx`) reads `?fg=RRGGBB&bg=RRGGBB` (no `#`), plus `&large=1` to start at 24px so the pair is judged as large text. The WCAG analyzer links into it this way.
- **Color math** is in pure functions in `src/utils/color-utils.ts` (parsing, conversion including OKLab/OKLCH and CIE Lab, CIEDE2000 `deltaE2000`, alpha blending, relative luminance, contrast ratio), `src/utils/color-formats.ts` (writing a color as CSS or platform code), `src/utils/tailwind-match.ts` (nearest Tailwind color), `src/utils/apca.ts` (APCA Lc) and `src/utils/wcag-utils.ts` (AA/AAA thresholds, the large-text rule, accessible-color suggestions). Use them from extension pages, but not inside injected functions.

### Code layout
- `src/features/<feature>/` holds a feature's components and its hooks.
- `src/hooks/` holds hooks shared by the contrast checker tab.
- **Background-safe modules:** the background imports the analyzer, inspector, vision, screenshot, context-menu and `~features/palette-studio/pending` modules. Keep those free of React. Screenshot decoding uses `createImageBitmap` and `OffscreenCanvas` because the service worker has no DOM.
- **Tailwind palettes** live in `src/lib/tailwind-palettes.ts`, which is generated. Regenerate it with `node scripts/gen-tailwind-palettes.mjs <v4 theme.css> <v4 version>` instead of editing it. v3 is read from the installed `tailwindcss`. v4 isn't installed, so download its `theme.css` from `https://unpkg.com/tailwindcss@<version>/theme.css`.

## Conventions

- **Prettier config** (`.prettierrc.mjs`):
  - No semicolons, double quotes, no trailing commas, `bracketSameLine`.
  - Imports are sorted by `@ianvs/prettier-plugin-sort-imports` in this order: third-party → `@plasmo/*` → `@plasmohq/*` → `~*` → relative.
- **Tailwind:**
  - `content` only scans `./src/**/*.{tsx,html}`, so class names written in `.ts` files are not generated.
  - `darkMode: "media"`.
  - Each entry point imports `~style.css`.
- **`cn`:** `~lib/cn` is a homegrown clsx without tailwind-merge. It does not resolve conflicting classes.
- **Releases:**
  - Bump `version` in `package.json`.
  - Add an entry to `CHANGELOG.md` (Keep a Changelog format).
  - Add an entry to `RELEASE_NOTES.md` under a `## X.Y.Z (YYYY-MM-DD)` heading. The release workflow uses that section as the release description, falling back to GitHub's generated notes when it's missing.
  - Merge to `main`. The release workflow then creates tag `vX.Y.Z` and a release with the built zip attached. Don't tag by hand, or the workflow skips that version.
