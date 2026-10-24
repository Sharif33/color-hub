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
- CI (`.github/workflows/ci.yml`, Node 20 / pnpm 9) runs only `pnpm install --frozen-lockfile` and `pnpm build`, so keep `pnpm-lock.yaml` in sync with `package.json`.
- Prettier is not enforced, and several existing files are unformatted. Format only the files you touch so diffs stay small.

## Architecture

### Plasmo entry points and manifest
- Plasmo routes entry points by file name:
  - `src/popup.tsx` → the action popup.
  - `src/background.ts` → the service worker.
  - `src/tabs/<name>.tsx` → an extension page at `tabs/<name>.html`, opened with `chrome.tabs.create({ url: chrome.runtime.getURL("tabs/<name>.html") })`.
- The manifest is generated from the `manifest` field in `package.json`, so change permissions there. Per CONTRIBUTING, permission or privacy changes also need a `README.md` update. `contextMenus` is declared, but nothing in `src/` registers a context menu.
- `.plasmo/` and `build/` are generated. Don't edit them.
- The path alias `~` maps to `src/` (e.g. `~utils/color-utils`). Images are imported as `data-base64:~assets/...`. One directory name contains a space: `src/components/color hub/`.

### Page interaction: injected functions, no content scripts
The extension has no content scripts. All work on the page goes through `chrome.scripting.executeScript({ func, args })`, called from the popup or the background script (see `src/features/webpage-color-analyzer/index.ts`).
- **Injected functions are serialized**, so they must be self-contained: no imports, and no references to module-scope helpers. That is why `normalizeRgb` and `rgbToHex` are copied inside each injected function. Don't refactor them to use `~utils/color-utils`. Pass inputs through `args`.
- Page-highlight overlays live under `#ecp-highlight-root` as `[data-ecp-highlight="true"]` nodes. Cleanup code in both `background.ts` and the analyzer depends on these markers.
- `chrome://`, `edge://`, `about:` and similar pages can't be scripted (see `src/utils/restricted-urls.ts`). The popup disables page-based features on them.

### State: `chrome.storage.local` is the source of truth
The code calls `chrome.storage.local` directly. `@plasmohq/storage` and `@plasmohq/messaging` are installed but unused. Hooks do an initial `get` and then subscribe with `chrome.storage.onChanged`, which keeps the popup, the tabs and the background script in sync. Storage keys:

| Key | Shape | Notes |
|---|---|---|
| `colorHistory` | `ColorEntry[]` | Deduped by hex and capped at 35. The cap is duplicated in `background.ts` and `popup.tsx`. |
| `lastPickedColor` | `ColorEntry` | `background.ts` watches it and paints the action badge with the color. |
| `WEBPAGES_COLORS` | `Record<hostname, AnalyzedColor[]>` | Saved results of the webpage color analyzer. |
| `savedContrastPairs` | `SavedPair[]` | Contrast checker's saved pairs (`~hooks/use-saved-pairs`). |
| `WCAG_ANALYSIS_PENDING` | `WCAGAnalysisData` | Handoff from the popup to the `wcag-contrast-analyzer` tab. |

### Messaging and lifecycle
- Messages go to the background with raw `chrome.runtime.sendMessage`. There are two:
  - `COLOR_PICKED` saves the color to history and to `lastPickedColor`.
  - `CLEAR_WEBPAGE_HIGHLIGHTS` (`{ tabId }`) removes the page overlays.
- The popup opens a port named `"popup"`. When it disconnects (the popup closes), the background clears highlights on the active tab.
- **Pick Color** uses the EyeDropper API from the popup (`features/pick-outside-browser-color`):
  - While picking, the popup shows a minimal UI, then calls `window.close()`.
  - The color reaches the next popup session by this path: `COLOR_PICKED` → background → storage → `useColorHistory`.
  - An `AbortError` means the user cancelled. It is expected and should not be logged as a warning.

### Feature flows
- **WCAG analysis:**
  1. The popup calls `analyzeWebpageContrastPairs()`. It scans text elements and finds each one's effective background by walking up the ancestors to the first non-transparent one, falling back to white.
  2. It writes the result to `WCAG_ANALYSIS_PENDING`.
  3. It opens `tabs/wcag-contrast-analyzer.html`.
- **Contrast checker** (`tabs/contrast-checker.tsx`) reads `?fg=RRGGBB&bg=RRGGBB` (no `#`). The WCAG analyzer links into it this way.
- **Color math** is in pure functions in `src/utils/color-utils.ts` (parsing, conversion, alpha blending, relative luminance, contrast ratio) and `src/utils/wcag-utils.ts` (AA/AAA thresholds, the large-text rule, accessible-color suggestions). Use them from extension pages, but not inside injected functions.

### Code layout
- `src/features/<feature>/` holds a feature's components and its hooks.
- `src/hooks/` holds hooks shared by the contrast checker tab.

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
  - Add an entry to `RELEASE_NOTES.md`.
