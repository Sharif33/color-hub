# Gradient roadmap

Gradient tools for Color Hub, built one at a time. Each item is checked off when
it builds, type-checks and has been tried in the browser.

Ground rules:
- Gradient Studio is a new tab page (`gradient-studio.html`), styled like
  Palette Studio. The popup only gets one link to it, so the popup's design and
  the home screen's 600px height stay as they are.
- Gradient math lives in pure functions in `src/utils/gradient.ts`, used by
  every item below. Injected page functions can't import it, so they only
  return raw CSS and the parsing happens in the extension.

## 1. Gradient model and math — `src/utils/gradient.ts`
- [x] Types: linear, radial and conic gradients, color stops with positions,
      interpolation space (sRGB, OKLab, OKLCH) and hue method (shorter, longer)
- [x] Sample a gradient at any point, interpolating the way CSS does
      (premultiplied alpha, hue fixup for OKLCH)
- [x] Write CSS, including `in oklch` syntax and a pre-sampled sRGB fallback
- [x] Parse CSS gradients, including the computed `background-image` that
      Chrome reports (`to right`, angles, two-position stops, missing positions)

## 2. Gradient Studio editor (roadmap items 1, 2, 3)
- [x] New tab page with a large live preview and the CSS below it
- [x] Linear / radial / conic, angle, radial shape and center
- [x] Stop bar: drag stops, click to add, remove, edit color, alpha and position
- [x] Interpolation space and hue method, with an sRGB vs. chosen-space
      comparison strip that shows the muddy middle
- [x] Easing between stops (ease-in, ease-out, ease-in-out) for smooth
      overlays that fade to transparent
- [x] Start from colors you have: the popup's current color, history, saved
      palettes, or two picks with the eyedropper
- [x] The URL keeps the gradient, so reloading or sharing the link restores it
- [x] Popup: a `Gradients` link that opens the studio with the current color

## 3. Gradient generator (roadmap item 10)
- [x] From one color: analogous, complementary, triadic, monochrome
      (computed in OKLCH so brightness stays even)
- [x] Shuffle (button or Space) with locked stops
- [x] From a palette: history, a saved palette or a page's colors
- [x] Mesh / aurora backgrounds from layered radial gradients
- [x] Built-in presets
- [x] Options: type, number of stops, random or fixed angle, grain overlay

## 4. Export (roadmap item 8)
- [x] CSS, with an sRGB fallback line for `in oklch`
- [x] Tailwind v4 (`bg-linear-45 from-… via-… to-…`, `/oklch`) and v3
      (`bg-gradient-to-r …`), using palette names when ΔE is small
- [x] SwiftUI, Jetpack Compose, Android XML, Flutter and SVG
- [x] Grain overlay included in the exported CSS

## 5. Page gradients and the inspector (roadmap items 4, 5)
- [x] Find the gradients a page uses (every frame, shadow DOM), with the
      elements that use each one
- [x] Popup: gradients section in the page colors results; copy CSS, highlight
      the elements, or open in Gradient Studio
- [x] Hover inspector shows the hovered element's gradient and copies its CSS

## 6. Contrast and lint (roadmap items 6, 7)
- [x] Text on gradient: worst WCAG ratio and APCA Lc along the gradient, where
      it happens, and which text color works best
- [x] WCAG report: text on gradient backgrounds is measured against the
      gradient's worst spot instead of the color behind it
- [x] Lint: muddy middle (chroma dip), near-identical stops, ends that look
      the same with color blindness, banding risk

## 7. Saved gradients (roadmap item 9)
- [x] Save, rename and delete gradients in Gradient Studio (`savedGradients`)
- [x] Included in backups (export, merge, replace)

## 8. Docs and release notes
- [x] README features, CHANGELOG `[Unreleased]`, CLAUDE.md architecture notes
