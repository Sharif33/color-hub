# Plan: move Color Hub from Plasmo to WXT

Status: **applied on branch `feat/wxt-migration`; manual testing (Phase 5) still to do.** Written 2026-11-15.

## Goal

Swap the build tool and keep everything else. After the move:

- Users see the same extension: same features, same permissions, same saved data, same extension ID.
- The Chrome Web Store sees no new permission, so nobody gets an "extension disabled, accept new permissions" prompt.
- Developers get WXT's dev server, Vite 8, and a maintained framework. Plasmo is barely maintained.

Not part of this move (each is its own follow-up, see the end of this file): switching `chrome.*` to `browser.*`, Firefox support, new features.

**Update:** after the move, every dependency was upgraded to its latest version, including Tailwind 4, React 19 and TypeScript 7. The table below shows the final versions.

## Target versions

Checked on npm on 2026-11-15.

| Package | Version | Why |
|---|---|---|
| `wxt` | `0.21.5` | Latest. Needs **Node ≥ 22**, Vite 6.3+/7/8 and TypeScript ≥ 5.4. |
| `@wxt-dev/module-react` | `^1.2.2` | Adds the React Vite plugin. It pulls `@vitejs/plugin-react@6`, which needs Vite 8. |
| `vite` | `^8.3` | Required peer of WXT since 0.21 (WXT no longer installs it for you). |
| `typescript` | `7.0.2` | WXT needs ≥ 5.4. Type check passes on 7. |
| `@types/chrome` | `0.3.7` | Still needed: WXT's own types (`@wxt-dev/browser`) don't declare the global `chrome` that our code uses. |
| `react`, `react-dom` | `19.3.1` | Latest. No `StrictMode` (see D7). |
| `lucide-react` | `1.73.0` | Latest. |
| `tailwindcss`, `@tailwindcss/vite` | `4.3.5` | Latest, through the Vite plugin. The theme moved from `tailwind.config.js` to CSS in `src/style.css`, and PostCSS is gone. Class names were renamed by `@tailwindcss/upgrade`. |
| `tailwindcss-v3` | `npm:tailwindcss@3.4.19` | Only for `scripts/gen-tailwind-palettes.mjs`, which writes the v3 palette for the Tailwind color match. |
| Removed | `plasmo`, `@plasmohq/messaging`, `@plasmohq/storage` | The last two are installed but unused today. |

Not installing `web-ext`. In WXT 0.21 it's optional, and without it `pnpm dev` doesn't launch a browser. We keep loading the unpacked build by hand, as today.

## Plasmo → WXT at a glance

| Today (Plasmo) | After (WXT) |
|---|---|
| `src/popup.tsx`, default export is mounted for us | `src/entrypoints/popup/index.html` + `main.tsx` (mounts) + `App.tsx` (today's component) |
| `src/tabs/<name>.tsx` → `tabs/<name>.html` | `src/entrypoints/<name>/index.html` + `main.tsx` + `App.tsx` → **`<name>.html`** (URL changes) |
| `src/background.ts`, code runs at top level | `src/entrypoints/background.ts`, code inside `defineBackground(() => { … })` |
| Manifest in `package.json` → `manifest` | `wxt.config.ts` → `manifest` |
| `assets/icon.png`, resized by Plasmo at build time | `public/icon/{16,32,48,64,128}.png`, committed, found by WXT automatically |
| `import logo from "data-base64:~assets/…"` | `import logo from "~/assets/…"` (Vite gives a URL) |
| Alias `~utils/…` (`~*` → `src/*`) | Alias `~/utils/…` (WXT's built-in `~` → `src`) |
| Generated `.plasmo/` | Generated `.wxt/` (made by `wxt prepare` on install) |
| `build/chrome-mv3-dev`, `build/chrome-mv3-prod`, `build/chrome-mv3-prod.zip` | `dist/chrome-mv3-dev`, `dist/chrome-mv3`, `dist/color-hub-vX.Y.Z-chrome.zip` |
| `tsconfig.json` extends Plasmo's base (`strict: false`) | extends `.wxt/tsconfig.json` (`strict: true`) |
| Parcel | Vite 8 |

What stays as it is: every `chrome.*` call, all `chrome.storage.local` keys and shapes, the injected functions, the `COLOR_PICKED` message, the `"popup"` port, the Tailwind config, the components and hooks.

## What the code review found

These are the specific things in our code that the move has to handle.

1. **Background runs code at the top level.** `src/background.ts:14` calls `void initializeBadgeState()`, and lines 17–53 register listeners at module level. WXT imports the background file in Node during the build, so this code must move inside `defineBackground`'s `main`. The listeners still register synchronously when the service worker starts, which MV3 needs.
2. **Alias style.** 43 import lines in 18 files use `~name/…` (no slash). WXT's `~` alias only matches `~/…`. All 43 are import lines, so a find/replace is safe.
3. **Relative imports from files that will move.** `src/popup.tsx` (9 imports, `./features/…`, `./utils/…`) and `src/background.ts` (1 import) break once the files move into `src/entrypoints/`. Switch them to `~/…`.
4. **Hard-coded page URLs.** `chrome.runtime.getURL("tabs/…")` at `src/popup.tsx:150`, `src/popup.tsx:164` and `src/tabs/wcag-contrast-analyzer.tsx:146`.
5. **Plasmo-only import.** `src/components/color hub/logo.tsx` uses `data-base64:`.
6. **Dead Plasmo leftovers.** The `#plasmo-shadow-container` rule in `src/style.css` (only used by Plasmo content-script UIs, which we don't have). `src/types/css.d.ts`, which Vite's own types replace.
7. **Stricter TypeScript.** The code passes `--strict` today with **0 errors**, so we gain strict mode for free. WXT also turns on `noUncheckedIndexedAccess`, which gives **53 errors**: 39 in `src/features/webpage-color-analyzer/index.ts` (mostly inside injected functions), 11 in `src/utils/color-utils.ts`, 3 in `src/features/color-picker/ColorPickerPanel.tsx`. We turn that one flag off for now (see D10).
8. **Manifest fields WXT doesn't copy.** WXT doesn't carry `author` over from `package.json`. Its type is also `{ email: string }`, not a string. Chrome doesn't use it, so we drop it. WXT also only sets `action.default_icon` when the popup HTML asks for it, so we add a meta tag to keep it.
9. **CI uses Node 20.** WXT 0.21 refuses to run on it. Both workflows need Node 22 or newer.
10. **The release workflow copies `build/chrome-mv3-prod.zip`**, which won't exist anymore.
11. **Open branches use the Plasmo layout.** All three would need porting (see "Open branches" below):
    - `feat/gradient` (updated today): `src/options.tsx`, `src/tabs/gradient-studio.tsx`, `src/tabs/palette-studio.tsx`.
    - `feat/developer-tools`: `src/options.tsx`, `src/tabs/palette-studio.tsx`.
    - `feat/context-menu`: `src/contents/content-context-menu.ts`, a Plasmo content script with `export const config`.
12. **The local `build/` folder is stale.** It's version 1.2.0 with an options page, built from a feature branch. Don't use it as the baseline; rebuild on `main` (Phase 0).

## Decisions

Each has a recommendation. The ones marked **(your call)** are for you to decide before we start.

- **D1. Keep `chrome.*`.** The extension is Chrome-only (EyeDropper is Chromium-only), and on Chrome WXT's `browser` *is* `chrome`. Rewriting about 60 call sites and their types (`chrome.runtime.Port` → `Browser.runtime.Port`) adds risk and gives us nothing yet. This is a follow-up.
- **D2. Turn auto-imports off (`imports: false`).** We already import everything explicitly. More importantly, auto-imports would let an injected function call a helper from `src/utils/` with no type error. It would build fine and then throw `ReferenceError` on the page, which is exactly the trap CLAUDE.md warns about. WXT's own APIs (`defineBackground`) are imported from `#imports`.
- **D3. Rewrite `~name/` to `~/name/`.** It's one command, and afterwards we use WXT's default alias with no custom alias config to maintain.
- **D4. Put the build in `dist/`** (`outDir: "dist"` in `wxt.config.ts`) instead of WXT's default `.output/`. `dist/` is already in `.gitignore`.
- **D5. Commit pre-sized icon PNGs** to `public/icon/` instead of using `@wxt-dev/auto-icons`. The icon rarely changes, and auto-icons pulls in `sharp`, a large native dependency. We take the exact PNGs Plasmo generates in Phase 0, so the icons are identical.
- **D6. Accept the new page URLs.** `tabs/contrast-checker.html` becomes `contrast-checker.html`, and the same for the WCAG analyzer. Only our own code links to them. Chrome closes open extension tabs on update anyway.
- **D7. No `<StrictMode>`** in the new `main.tsx` files. Plasmo didn't use it, and in dev it runs effects twice. The popup's port and listener effects weren't written for that. Adding it is a separate change.
- **D8. Order of work (your call).** `feat/gradient` was updated today and adds three entry points (options page and two tabs).
  - **Recommended:** if it's close to done, merge `feat/gradient` into `dev` first, then migrate. The migration then moves those three files in the same mechanical pass, instead of rebasing a feature branch across a large file move.
  - If it's not close, migrate first and port the branch afterwards using the table below.
- **D9. Version (your call).** Ship as **1.1.1**: the bundle is completely rebuilt, but nothing changes for users. 1.2.0 seems to be planned for the gradient work. Or hold the migration until the next feature release.
- **D10. TypeScript strictness.** Keep `strict` on (already clean). Turn `noUncheckedIndexedAccess` off in `tsconfig.json` for this change, and fix its 53 errors in a follow-up. Most are inside injected functions, which need careful, separate testing.

## Step by step

### Phase 0: baseline (on `main`, still Plasmo)

1. `git switch main && pnpm install && pnpm build`.
2. Save what we compare against later, outside the repo (e.g. `~/color-hub-baseline/`):
   - `build/chrome-mv3-prod/manifest.json` → `baseline-manifest.json`
   - the five `build/chrome-mv3-prod/icon*.plasmo.*.png` files (renamed in Phase 3)
   - the whole `build/chrome-mv3-prod/` folder, for the update test in Phase 5
3. Note the zip size for comparison.

### Phase 1: branch and tooling

1. Branch `feat/wxt-migration` from `dev`. `dev` has no commits that aren't in `main`.
2. Dependencies:

   ```bash
   pnpm remove plasmo @plasmohq/messaging @plasmohq/storage
   pnpm add -D wxt@0.21.5 @wxt-dev/module-react vite@^8.3 typescript@~5.9.3 @types/chrome@latest
   ```

   If local pnpm 10 prints "Ignored build scripts", run `pnpm approve-builds` and keep the generated allow-list. Check the lockfile stays a single YAML document (see CLAUDE.md, since CI runs pnpm 9).

3. `package.json`:
   - add `"type": "module"` (WXT dropped CommonJS support)
   - replace `scripts` with:

     ```json
     "dev": "wxt",
     "build": "wxt build",
     "zip": "wxt zip",
     "compile": "tsc --noEmit",
     "postinstall": "wxt prepare"
     ```

   - delete the `manifest` field (moves to `wxt.config.ts`) and `displayName` (unused by WXT)
   - optional: `"engines": { "node": ">=22" }`

4. New `wxt.config.ts`:

   ```ts
   import { defineConfig } from "wxt"

   export default defineConfig({
     srcDir: "src",
  outDir: "dist",
     modules: ["@wxt-dev/module-react"],
     // Explicit imports only. Auto-imports would let an injected function use
     // a src/utils helper with no type error, then throw on the page
     imports: false,
     manifest: {
       name: "Color Hub",
       permissions: [
         "activeTab",
         "tabs",
         "storage",
         "unlimitedStorage",
         "scripting",
         "contextMenus"
       ],
       host_permissions: ["<all_urls>"]
     },
     zip: {
       // Same name the release workflow already publishes
       artifactTemplate:
         "color-hub-v{{packageVersion}}-{{browser}}{{modeSuffix}}.zip"
     }
   })
   ```

   `version` and `description` keep coming from `package.json`. With `srcDir: "src"`, WXT looks for `public/` at the repo root and for entry points in `src/entrypoints/`.

5. `tsconfig.json`:

   ```jsonc
   {
     "extends": "./.wxt/tsconfig.json",
     "compilerOptions": {
       // WXT turns this on. 53 errors today, mostly in injected functions.
       // Fix in a follow-up, then delete this line
       "noUncheckedIndexedAccess": false
     }
   }
   ```

   Don't add `paths` here: it would replace WXT's paths instead of merging with them. Custom aliases go in `wxt.config.ts` → `alias`.

6. With `"type": "module"`, convert `postcss.config.js` and `tailwind.config.js` from `module.exports =` to `export default`. The contents stay the same. The Tailwind `content` glob `./src/**/*.{tsx,html}` already covers the new `index.html` files.
7. `.gitignore`: add `.wxt/`, `stats.html`, `stats-*.json`, `web-ext.config.ts`. Remove the Plasmo and `keys.json` (bpp) sections. Keep `build/` for now so old local build folders don't show as untracked.
8. `.prettierrc.mjs`: remove the `^@plasmo/(.*)$` and `^@plasmohq/(.*)$` groups (and their blank-line separators) from `importOrder`.

### Phase 2: entry points

Target layout:

```text
public/
└─ icon/16.png 32.png 48.png 64.png 128.png    ← Phase 0 PNGs, renamed
src/entrypoints/
├─ background.ts                              ← src/background.ts
├─ popup/
│  ├─ index.html                              new
│  ├─ main.tsx                                new
│  └─ App.tsx                                 ← src/popup.tsx
├─ contrast-checker/
│  ├─ index.html, main.tsx                    new
│  └─ App.tsx                                 ← src/tabs/contrast-checker.tsx
└─ wcag-contrast-analyzer/
   ├─ index.html, main.tsx                    new
   └─ App.tsx                                 ← src/tabs/wcag-contrast-analyzer.tsx
```

Moving the files without other edits in the same commit lets git track the renames, which keeps `git log --follow` and blame useful.

**`popup/index.html`.** The meta tag keeps `action.default_icon` in the manifest:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Color Hub</title>
    <meta
      name="manifest.default_icon"
      content="{ 16: '/icon/16.png', 32: '/icon/32.png', 48: '/icon/48.png', 64: '/icon/64.png', 128: '/icon/128.png' }" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

The two tab pages use the same HTML without the `manifest.default_icon` meta. Keep `<title>Color Hub</title>`, which is what Plasmo used.

**`main.tsx`** (one per page, identical apart from the import):

```tsx
import { createRoot } from "react-dom/client"

import App from "./App"

createRoot(document.getElementById("root")!).render(<App />)
```

`App.tsx` keeps its own `import "~/style.css"`, as each entry file does today.

**`background.ts`:**

```ts
import { defineBackground } from "#imports"

import { hexToRgb } from "~/utils/color-utils"
import { isRestrictedUrl } from "~/utils/restricted-urls"

export default defineBackground(() => {
  void initializeBadgeState()
  chrome.runtime.onMessage.addListener(/* unchanged */)
  chrome.runtime.onInstalled.addListener(/* unchanged */)
  chrome.runtime.onStartup.addListener(/* unchanged */)
  chrome.storage.onChanged.addListener(/* unchanged */)
  chrome.runtime.onConnect.addListener(/* unchanged */)
})

// clearWebpageHighlights, savePickedColor, initializeBadgeState and
// updateBadgeColor stay as module-level function declarations, unchanged.
// Declaring them runs nothing at import time
```

Also drop the `export {}` line, and move the `ColorEntry` interface below the imports.

### Phase 3: Plasmo-specific code

1. Rewrite the aliases (BSD `sed` on macOS; `--null`/`-0` because one folder name has a space):

   ```bash
   grep -rl --null -E '"~[A-Za-z]' src | xargs -0 sed -i '' -E 's/"~([A-Za-z])/"~\/\1/g'
   grep -rnE '"~[A-Za-z]' src   # expect no output
   ```

2. In the moved `popup/App.tsx` and `background.ts`, change the remaining `./features/…` and `./utils/…` imports to `~/features/…` and `~/utils/…`.
3. Change the page URLs:
   - `"tabs/contrast-checker.html"` → `"/contrast-checker.html"` (popup and WCAG analyzer)
   - `"tabs/wcag-contrast-analyzer.html"` → `"/wcag-contrast-analyzer.html"`
4. `logo.tsx`: `import logo from "~/assets/color-hub-logo.png"`. Vite emits it as a file; it's 5 KB, just over the 4 KB inline limit.
5. `src/style.css`: delete the `#plasmo-shadow-container` rule.
6. Delete `src/types/css.d.ts` (Vite's client types cover `.css` and `.png` imports). Keep `src/types/chrome.d.ts`.
7. Icons: copy the Phase 0 PNGs to `public/icon/16.png` … `128.png`. Delete the root `assets/` folder: `assets/icon.png` is byte-identical to `src/assets/color-hub-logo.png`, so nothing is lost.
8. Format only the touched files: `pnpm exec prettier --write <files>`.

### Phase 4: build checks

```bash
pnpm install       # runs wxt prepare, which creates .wxt/
pnpm compile       # must pass with 0 errors
pnpm zip           # builds dist/chrome-mv3 and dist/color-hub-v<version>-chrome.zip
```

**Manifest diff.** This is the most important check:

```bash
diff <(jq -S . ~/color-hub-baseline/baseline-manifest.json) <(jq -S . dist/chrome-mv3/manifest.json)
```

Expected differences, and nothing else:

| Field | Before | After |
|---|---|---|
| `icons`, `action.default_icon` | `icon16.plasmo.<hash>.png` … | `icon/16.png` … (same five sizes) |
| `background.service_worker` | `static/background/index.js` | `background.js` |
| `author` | `"Sharif Rashed"` | removed |

`permissions` and `host_permissions` must contain exactly the same entries (order doesn't matter). Anything else in the diff, such as a new permission, `web_accessible_resources` or `content_security_policy`, must be explained before going further.

**Injected functions.** They must still run once serialized. They are:

- `highlightColorInPage`, `extractColorsInPage`, `extractContrastPairsInPage` and `clearHighlightsInPage` in `src/features/webpage-color-analyzer/index.ts`
- the inline cleanup function in the background

If the bundler ever rewrites one to call a shared helper (for example `__name`, or spread/async helpers), it fails on the page with `ReferenceError`. Vite 8's default target doesn't down-level any syntax we use, so this shouldn't happen. The Phase 5 checks catch it if it does. The fix would be `vite: () => ({ build: { target: "esnext" } })` in `wxt.config.ts`.

### Phase 5: manual test (production build first, then dev)

Load `dist/chrome-mv3` with "Load unpacked". Keep DevTools open on the page, the popup and the service worker, and look for errors throughout.

**Popup**
- [ ] It opens at the same size and look, with the logo showing.
- [ ] **Pick Color**:
  - The popup shows "Pick colors from anywhere", then closes.
  - Picking a color sets the badge to that color, with tooltip "Color Hub • Last picked #…".
  - Reopening the popup shows Last Picked, and the hex is copied.
  - Pressing Esc cancels with no warning logged.
- [ ] The **×** on Last Picked clears the badge.
- [ ] **Color Picker Panel**:
  - Dragging the gradient and the hue works.
  - Adding to history removes duplicates and keeps the 35 cap.
  - Clear history asks for confirmation.
- [ ] **Analyze Webpage Colors**:
  - Colors are listed and highlighted on the page.
  - Selecting a color highlights it.
  - Save stores the colors under the site name.
  - Cancel removes the highlights.
- [ ] Closing the popup while the page is highlighted removes the highlights. Also try it after switching to another tab first: highlights are removed from the original tab (the `"popup"` port path).
- [ ] **Saved Webpage Colors**: expanding, picking and deleting a site all work.
- [ ] On `chrome://extensions`, the page features are disabled.
- [ ] **Analyze WCAG Contrast** opens `/wcag-contrast-analyzer.html` with results. Filters and sort work.

**Pages**
- [ ] From the WCAG analyzer, opening a pair goes to `/contrast-checker.html?fg=…&bg=…&large=1` and starts at 24px.
- [ ] Contrast checker:
  - swap
  - alpha input
  - suggestions
  - Save Pair, and "Exists" for a duplicate
  - palette sources, including Saved Pairs

**Service worker**
- [ ] Stop the worker from `chrome://extensions`, then use the extension: the badge is restored and picks still save.

**Update from the old version** (proves saved data survives):
- [ ] Load the Phase 0 Plasmo build unpacked from a fixed folder. Create history, a Last Picked color, saved site colors and saved pairs.
- [ ] Replace that folder's contents with `dist/chrome-mv3`, then click reload. All data is still there and the badge keeps its color. (Same folder means same extension ID.)
- [ ] Optional: Google's [extension update testing tool](https://github.com/GoogleChromeLabs/extension-update-testing-tool) confirms no new permission warning.

**Dev mode**
- [ ] `pnpm dev`, then load `dist/chrome-mv3-dev` once:
  - editing a popup component updates it
  - editing the background reloads the extension

The dev manifest has extra dev-only entries; never ship a dev build.

### Phase 6: CI, release and docs

- `.github/workflows/ci.yml`: `node-version: 24` (or 22, the minimum); `run: pnpm zip`. Optional: add a `pnpm compile` step, since type errors don't fail the build.
- `.github/workflows/release.yml`:
  - Same Node version change, and `run: pnpm zip`.
  - In "Publish release", use `asset="dist/color-hub-$TAG-chrome.zip"` and drop the `cp` (the template already produces that name).
- `README.md` and `CONTRIBUTING.md`: the dev folder is now `dist/chrome-mv3-dev` and the build goes to `dist/`. Mention the Node 22+ requirement.
- `CLAUDE.md`:
  - Overview: Plasmo 0.90.5 → WXT 0.21 + Vite 8.
  - Commands, including the type check, which is now `pnpm compile`; the `--incremental false` flag is no longer needed.
  - The entry points section (new layout and page URLs).
  - Alias `~/`, and `.plasmo/` → `.wxt/`.
  - Remove the `data-base64` and `@plasmohq/*` notes.
  - Under injected functions, add why auto-imports are off.
  - Remove the `@plasmo` groups from the Prettier import order.
- `CHANGELOG.md` and `RELEASE_NOTES.md`: a `1.1.1` entry. "Rebuilt with WXT instead of Plasmo. No changes to features, permissions or saved data."
- `package.json` `version` → `1.1.1` (per D9).

### Phase 7: merge and release

1. PR `feat/wxt-migration` → `dev`. CI must be green on Node 22+.
2. Run Phase 5 once more on the CI-built zip (download the workflow artifact, or rebuild locally from the merge commit).
3. PR `dev` → `main`. The release workflow tags `v1.1.1` and attaches `color-hub-v1.1.1-chrome.zip`.
4. Upload that zip to the Chrome Web Store as usual.

## Open branches: how to port them

Whichever way D8 goes, the moves are mechanical:

| Plasmo file | WXT file | Notes |
|---|---|---|
| `src/tabs/gradient-studio.tsx` | `src/entrypoints/gradient-studio/{index.html,main.tsx,App.tsx}` | URL becomes `/gradient-studio.html` |
| `src/tabs/palette-studio.tsx` | `src/entrypoints/palette-studio/{index.html,main.tsx,App.tsx}` | URL becomes `/palette-studio.html` |
| `src/options.tsx` | `src/entrypoints/options/{index.html,main.tsx,App.tsx}` | Add `<meta name="manifest.open_in_tab" content="true" />` to keep `options_ui.open_in_tab` |
| `src/contents/content-context-menu.ts` | `src/entrypoints/content-context-menu.content.ts` | `export default defineContentScript({ matches: ["<all_urls>"], runAt: "document_idle", allFrames: true, main() { … } })`, with all top-level code moved into `main` |

On each branch, also apply the Phase 3 alias rewrite, and change any `getURL("tabs/…")` to `getURL("/…")`.

## Risks

| Risk | What would happen | How we catch or prevent it |
|---|---|---|
| A permission changes in the manifest | Chrome disables the extension for existing users until they accept | Phase 4 manifest diff, plus the optional update testing tool |
| An injected function gets a bundler helper | A feature fails on the page with `ReferenceError` | Phase 5 tests every injected function; fix with `build.target` |
| Runtime code left outside `defineBackground` | The build fails, or code runs at the wrong time | The build fails loudly; code review of `background.ts` |
| CI still on Node 20 | CI and release fail | Phase 6 workflow changes, in the same PR |
| Lockfile mismatch (pnpm 10 locally, 9 in CI) | `--frozen-lockfile` fails in CI | Check the lockfile is a single document; CI runs on the PR before merge |
| Old dev folder still loaded | Confusing "nothing updates" in dev | Remove the old unpacked `build/chrome-mv3-dev` and load `dist/chrome-mv3-dev` |

**Rollback:** revert the merge on `main` and release the next patch version. Storage keys and data are untouched, so there's nothing to migrate back.

## Size of the change

- 4 files moved
- 6 new files (3 `index.html`, 3 `main.tsx`), plus `wxt.config.ts` and 5 icon PNGs
- 18 files get the alias rewrite
- about 10 config and doc files
- 2 workflows

No feature code changes beyond imports and the three page URLs.

## Follow-ups (separate PRs, after this ships)

1. Fix the 53 `noUncheckedIndexedAccess` errors, then remove the override. Test the injected functions carefully.
2. Switch `chrome.*` to `browser` from `wxt/browser` and drop `@types/chrome`. Only worth it if we target another browser.
3. Edge build: `wxt zip -b edge` should just work (Chromium). Firefox needs a fallback for the EyeDropper API, which it doesn't support.
4. Optional: `@wxt-dev/auto-icons` for a grey icon in dev builds, so dev and store versions are easy to tell apart.
5. Optional: `<StrictMode>` once the popup effects handle double runs.
