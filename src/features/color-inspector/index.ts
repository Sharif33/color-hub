interface PageColor {
  r: number
  g: number
  b: number
  a: number
}

/**
 * Starts the hover inspector on the page, or stops it if it's running.
 * Hovering an element shows its text and rendered background colors, their
 * contrast (WCAG and APCA), border color and matching CSS variables. Clicking
 * pins the panel so its buttons can be used; Esc exits. Resolves whether the
 * inspector is now running.
 *
 * The UI lives in a closed shadow root under `[data-ecp-inspector]`, so page
 * styles can't reach it. Like every injected function, this one can't use
 * imports: color parsing, compositing and contrast math are copied here.
 */
const toggleInspectorInPage = (): boolean => {
  type InspectorWindow = Window & { __ecpInspector?: { stop: () => void } }
  const inspectorWindow = window as InspectorWindow
  if (inspectorWindow.__ecpInspector) {
    inspectorWindow.__ecpInspector.stop()
    return false
  }

  // --- Colors ---------------------------------------------------------------

  // Computed styles keep oklch(), lab() and color() as written, so anything
  // that isn't rgb() is resolved to sRGB by painting it on a 1×1 canvas
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  const canvasCtx = canvas.getContext("2d", { willReadFrequently: true })
  const parsedColors = new Map<string, PageColor | null>()
  const parseCssColor = (value: string): PageColor | null => {
    const cached = parsedColors.get(value)
    if (cached !== undefined) return cached
    let parsed: PageColor | null = null
    const rgbMatch = value
      .replace(/\s+/g, "")
      .match(/^rgba?\(([\d.]+),([\d.]+),([\d.]+)(?:,([\d.]+))?\)$/i)
    if (rgbMatch) {
      const channel = (n: string) =>
        Math.max(0, Math.min(255, Math.round(parseFloat(n))))
      parsed = {
        r: channel(rgbMatch[1]),
        g: channel(rgbMatch[2]),
        b: channel(rgbMatch[3]),
        a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1
      }
    } else if (canvasCtx) {
      // Paint without the "/ alpha" part so the channels read back exactly
      const alphaMatch = value.match(/\/\s*([\d.]+)(%?)\s*\)$/)
      canvasCtx.clearRect(0, 0, 1, 1)
      canvasCtx.fillStyle = "rgba(0, 0, 0, 0)"
      canvasCtx.fillStyle = value.replace(/\/[^/)]*\)$/, ")")
      canvasCtx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = canvasCtx.getImageData(0, 0, 1, 1).data
      // A value the canvas can't parse leaves the transparent fill in place
      if (a > 0) {
        const alpha = alphaMatch
          ? parseFloat(alphaMatch[1]) / (alphaMatch[2] ? 100 : 1)
          : a / 255
        parsed = { r, g, b, a: alpha }
      }
    }
    parsedColors.set(value, parsed)
    return parsed
  }

  // Same keys as the color analyzer, so variables match the same way
  const colorKey = (value: string): string | null => {
    const color = parseCssColor(value)
    if (!color) return null
    const alpha = Math.round(color.a * 100) / 100
    if (alpha <= 0) return null
    const { r, g, b } = color
    return alpha >= 1
      ? `rgb(${r}, ${g}, ${b})`
      : `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const toHex = (r: number, g: number, b: number) =>
    "#" +
    [r, g, b]
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
      .toUpperCase()

  // Premultiplied RGBA, so compositing is a weighted sum
  type Layer = [number, number, number, number]
  const premultiply = ({ r, g, b, a }: PageColor): Layer => [
    r * a,
    g * a,
    b * a,
    a
  ]
  // Porter-Duff "source over": `top` painted onto `bottom`
  const over = (top: Layer, bottom: Layer): Layer =>
    top.map((v, i) => v + bottom[i] * (1 - top[3])) as Layer
  const fade = (layer: Layer, opacity: number): Layer =>
    layer.map((v) => v * opacity) as Layer

  // The element a node is drawn inside, across shadow root boundaries
  const flatParent = (el: Element): Element | null => {
    if (el.assignedSlot) return el.assignedSlot
    if (el.parentElement) return el.parentElement
    const parent = el.parentNode
    return parent instanceof ShadowRoot ? parent.host : null
  }

  // The colors as painted, the same way the WCAG analysis composites them:
  // through every ancestor's background and opacity, onto a white canvas.
  // Background images are not taken into account
  const resolveRenderedColors = (el: Element, textColor: PageColor) => {
    let text = premultiply(textColor)
    let background: Layer = [0, 0, 0, 0]
    for (let node: Element | null = el; node; node = flatParent(node)) {
      const styles = window.getComputedStyle(node)
      const layer = parseCssColor(styles.backgroundColor)
      const backgroundLayer: Layer = layer ? premultiply(layer) : [0, 0, 0, 0]
      text = over(text, backgroundLayer)
      background = over(background, backgroundLayer)
      const opacity = parseFloat(styles.opacity)
      if (!Number.isNaN(opacity) && opacity < 1) {
        text = fade(text, opacity)
        background = fade(background, opacity)
      }
    }
    const white: Layer = [255, 255, 255, 1]
    const t = over(text, white)
    const b = over(background, white)
    return {
      foreground: toHex(t[0], t[1], t[2]),
      background: toHex(b[0], b[1], b[2])
    }
  }

  const hexChannels = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

  const relativeLuminance = (hex: string) => {
    const [r, g, b] = hexChannels(hex).map((c) => {
      const n = c / 255
      return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const contrastRatio = (a: string, b: string) => {
    const [high, low] = [relativeLuminance(a), relativeLuminance(b)].sort(
      (x, y) => y - x
    )
    return (high + 0.05) / (low + 0.05)
  }

  // APCA-W3 0.0.98G-4g
  const apcaLc = (textHex: string, backgroundHex: string) => {
    const screenY = (hex: string) => {
      const [r, g, b] = hexChannels(hex).map((c) => Math.pow(c / 255, 2.4))
      const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
      return y > 0.022 ? y : y + Math.pow(0.022 - y, 1.414)
    }
    const text = screenY(textHex)
    const background = screenY(backgroundHex)
    if (Math.abs(background - text) < 0.0005) return 0
    if (background > text) {
      const sapc = (Math.pow(background, 0.56) - Math.pow(text, 0.57)) * 1.14
      return sapc < 0.1 ? 0 : (sapc - 0.027) * 100
    }
    const sapc = (Math.pow(background, 0.65) - Math.pow(text, 0.62)) * 1.14
    return sapc > -0.1 ? 0 : (sapc + 0.027) * 100
  }

  // Custom properties whose value is a color, by color key (see the color
  // analyzer for why matching is by value)
  const colorVariables = new Map<string, string[]>()
  {
    const names = new Set<string>()
    const addNames = (style: CSSStyleDeclaration) => {
      for (let i = 0; i < style.length; i += 1) {
        if (style[i].startsWith("--")) names.add(style[i])
      }
    }
    const visitRules = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule) addNames(rule.style)
        if ("cssRules" in rule) visitRules((rule as CSSGroupingRule).cssRules)
      }
    }
    for (const sheet of [
      ...Array.from(document.styleSheets),
      ...(document.adoptedStyleSheets ?? [])
    ]) {
      try {
        visitRules(sheet.cssRules)
      } catch {
        // Stylesheets from another origin can't be read
      }
    }
    addNames(document.documentElement.style)
    const bareHsl =
      /^-?[\d.]+(?:deg)?\s+[\d.]+%\s+[\d.]+%(?:\s*\/\s*[\d.]+%?)?$/
    const bareRgb = /^\d{1,3}(?:\s*,\s*|\s+)\d{1,3}(?:\s*,\s*|\s+)\d{1,3}$/
    const rootStyles = window.getComputedStyle(document.documentElement)
    for (const name of Array.from(names).slice(0, 5000)) {
      const value = rootStyles.getPropertyValue(name).trim()
      if (!value) continue
      const key = bareHsl.test(value)
        ? colorKey(`hsl(${value})`)
        : bareRgb.test(value)
          ? colorKey(`rgb(${value})`)
          : colorKey(value)
      if (key)
        colorVariables.set(key, [...(colorVariables.get(key) ?? []), name])
    }
  }

  const inputTypesWithoutText = [
    "checkbox",
    "radio",
    "range",
    "color",
    "hidden",
    "image",
    "file"
  ]
  const rendersText = (el: Element): boolean => {
    if (el instanceof SVGElement) return false
    if (el instanceof HTMLInputElement)
      return !inputTypesWithoutText.includes(el.type)
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)
      return true
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
        return true
    }
    return false
  }

  const describeElement = (el: Element) => {
    const tag = el.tagName.toLowerCase()
    if (el.id) return `${tag}#${el.id}`
    const classes = Array.from(el.classList).slice(0, 2)
    const more = el.classList.length - classes.length
    return `${tag}${classes.map((name) => `.${name}`).join("")}${more > 0 ? ` +${more}` : ""}`
  }

  // --- UI -------------------------------------------------------------------

  const host = document.createElement("div")
  host.setAttribute("data-ecp-inspector", "true")
  host.style.cssText =
    "all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;"
  const shadow = host.attachShadow({ mode: "closed" })
  const style = document.createElement("style")
  style.textContent = `
    .box { position: fixed; display: none; box-sizing: border-box; border: 2px solid #2563eb; background: rgba(37, 99, 235, 0.08); border-radius: 2px; pointer-events: none; }
    .tip { position: fixed; display: none; box-sizing: border-box; width: 290px; padding: 10px 12px; font: 12px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18); pointer-events: none; }
    .tip.pinned { pointer-events: auto; border-color: #93c5fd; }
    .head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
    .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 11px ui-monospace, SFMono-Regular, Menlo, monospace; color: #334155; }
    .row { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
    .label { width: 72px; flex-shrink: 0; color: #64748b; font-size: 11px; }
    .swatch { width: 14px; height: 14px; flex-shrink: 0; border-radius: 4px; border: 1px solid rgba(0, 0, 0, 0.15); }
    .mono { font: 600 11px ui-monospace, SFMono-Regular, Menlo, monospace; }
    .muted { color: #94a3b8; font-size: 10px; }
    .badge { border-radius: 999px; padding: 1px 6px; font-size: 10px; font-weight: 700; }
    .pass { background: #ecfdf5; color: #047857; }
    .fail { background: #fef2f2; color: #dc2626; }
    .vars { font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; color: #475569; overflow-wrap: anywhere; }
    button { font: inherit; cursor: pointer; }
    .copy { margin-left: auto; padding: 1px 6px; font-size: 10px; color: #334155; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; }
    .copy:hover { background: #f8fafc; }
    .icon { padding: 0 6px; font-size: 14px; line-height: 18px; color: #64748b; background: none; border: 0; border-radius: 6px; }
    .icon:hover { background: #f1f5f9; }
    .actions { display: flex; gap: 6px; margin-top: 8px; }
    .primary { flex: 1; padding: 6px; font-weight: 600; color: #ffffff; background: #2563eb; border: 0; border-radius: 8px; }
    .primary:hover { background: #1d4ed8; }
    .hint { margin-top: 6px; color: #94a3b8; font-size: 10px; }
  `
  const box = document.createElement("div")
  box.className = "box"
  const tip = document.createElement("div")
  tip.className = "tip"
  shadow.append(style, box, tip)
  document.documentElement.appendChild(host)

  const make = (tag: string, className: string, text?: string): HTMLElement => {
    const el = document.createElement(tag)
    if (className) el.className = className
    if (text !== undefined) el.textContent = text
    return el
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // The async clipboard is missing on http pages
      const area = document.createElement("textarea")
      area.value = text
      shadow.appendChild(area)
      area.select()
      document.execCommand("copy")
      area.remove()
    }
  }

  let current: Element | null = null
  let pinned = false
  let pointer = { x: 0, y: 0 }

  const colorRow = (label: string, hex: string, names: string[] = []) => {
    const row = make("div", "row")
    const swatch = make("span", "swatch")
    swatch.style.background = hex
    row.append(make("span", "label", label), swatch, make("span", "mono", hex))
    if (names.length)
      row.append(make("span", "vars", names.slice(0, 2).join(" ")))
    const copy = make("button", "copy", "Copy")
    copy.addEventListener("click", () => {
      void copyText(hex).then(() => {
        copy.textContent = "Copied"
        setTimeout(() => (copy.textContent = "Copy"), 1200)
      })
    })
    if (pinned) row.append(copy)
    return row
  }

  const render = () => {
    const el = current
    if (!el) return
    const styles = window.getComputedStyle(el)
    const textColor = parseCssColor(styles.color)
    const hasText = rendersText(el) && !!textColor && textColor.a > 0
    const { foreground, background } = resolveRenderedColors(
      el,
      hasText && textColor ? textColor : { r: 0, g: 0, b: 0, a: 0 }
    )

    tip.replaceChildren()
    const head = make("div", "head")
    head.append(make("span", "name", describeElement(el)))
    if (pinned) {
      const close = make("button", "icon", "×")
      close.title = "Unpin"
      close.addEventListener("click", () => {
        pinned = false
        tip.classList.remove("pinned")
        render()
      })
      head.append(close)
    }
    tip.append(head)

    if (hasText) {
      tip.append(
        colorRow(
          "Text",
          foreground,
          colorVariables.get(colorKey(styles.color) ?? "") ?? []
        )
      )
    }
    tip.append(
      colorRow(
        "Background",
        background,
        colorVariables.get(colorKey(styles.backgroundColor) ?? "") ?? []
      )
    )

    const borderSides: Array<[string, string, string]> = [
      [styles.borderTopStyle, styles.borderTopWidth, styles.borderTopColor],
      [
        styles.borderRightStyle,
        styles.borderRightWidth,
        styles.borderRightColor
      ],
      [
        styles.borderBottomStyle,
        styles.borderBottomWidth,
        styles.borderBottomColor
      ],
      [styles.borderLeftStyle, styles.borderLeftWidth, styles.borderLeftColor]
    ]
    const drawnBorder = borderSides.find(
      ([borderStyle, width]) =>
        borderStyle !== "none" &&
        borderStyle !== "hidden" &&
        parseFloat(width) > 0
    )
    const border = drawnBorder ? parseCssColor(drawnBorder[2]) : null
    if (border && border.a > 0) {
      tip.append(colorRow("Border", toHex(border.r, border.g, border.b)))
    }

    if (hasText) {
      const ratio = contrastRatio(foreground, background)
      const fontSize = parseFloat(styles.fontSize)
      const bold = parseInt(styles.fontWeight, 10) >= 700
      const large = fontSize >= 24 || (bold && fontSize >= 18.66)
      const aa = ratio >= (large ? 3 : 4.5)
      const aaa = ratio >= (large ? 4.5 : 7)
      const shown = (Math.floor(ratio * 100 + 1e-9) / 100).toFixed(2)

      const contrastRow = make("div", "row")
      contrastRow.append(
        make("span", "label", "Contrast"),
        make("span", "mono", `${shown}:1`),
        make("span", `badge ${aa ? "pass" : "fail"}`, `AA ${aa ? "✓" : "✗"}`),
        make("span", `badge ${aaa ? "pass" : "fail"}`, `AAA ${aaa ? "✓" : "✗"}`)
      )
      const apcaRow = make("div", "row")
      apcaRow.append(
        make("span", "label", "APCA"),
        make("span", "mono", `Lc ${apcaLc(foreground, background).toFixed(1)}`)
      )
      const sizeRow = make("div", "row")
      sizeRow.append(
        make("span", "label", "Text"),
        make(
          "span",
          "muted",
          `${Math.round(fontSize * 10) / 10}px · ${styles.fontWeight} · ${large ? "large" : "normal"} text`
        )
      )
      tip.append(contrastRow, apcaRow, sizeRow)

      if (pinned) {
        const actions = make("div", "actions")
        const open = make("button", "primary", "Open in Contrast Checker")
        open.addEventListener("click", () => {
          void chrome.runtime.sendMessage({
            type: "OPEN_CONTRAST_CHECKER",
            foreground,
            background,
            largeText: large
          })
        })
        actions.append(open)
        tip.append(actions)
      }
    } else {
      tip.append(
        make("div", "hint", "No text of its own, so no contrast to check.")
      )
    }

    tip.append(
      make(
        "div",
        "hint",
        pinned
          ? "Click another element to inspect it · Esc to exit"
          : "Click to pin · Esc to exit"
      )
    )
    place()
  }

  const place = () => {
    if (!current) return
    const rect = current.getBoundingClientRect()
    box.style.display = "block"
    box.style.left = `${rect.left}px`
    box.style.top = `${rect.top}px`
    box.style.width = `${rect.width}px`
    box.style.height = `${rect.height}px`
    tip.style.display = "block"
    const margin = 14
    const { width, height } = tip.getBoundingClientRect()
    let left = pointer.x + margin
    let top = pointer.y + margin
    if (left + width > window.innerWidth - 8) left = pointer.x - width - margin
    if (top + height > window.innerHeight - 8) top = pointer.y - height - margin
    tip.style.left = `${Math.max(8, left)}px`
    tip.style.top = `${Math.max(8, top)}px`
  }

  const isOwnEvent = (event: Event) => event.composedPath().includes(host)
  const targetOf = (event: Event): Element | null => {
    const target = event.composedPath()[0]
    return target instanceof Element ? target : null
  }

  const onMove = (event: MouseEvent) => {
    if (pinned || isOwnEvent(event)) return
    pointer = { x: event.clientX, y: event.clientY }
    const target = targetOf(event)
    if (!target) return
    if (target !== current) {
      current = target
      render()
    } else {
      place()
    }
  }

  // While inspecting, clicks pin the panel instead of reaching the page
  const swallow = (event: Event) => {
    if (isOwnEvent(event)) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  const onClick = (event: MouseEvent) => {
    if (isOwnEvent(event)) return
    swallow(event)
    const target = targetOf(event)
    if (!target) return
    pointer = { x: event.clientX, y: event.clientY }
    current = target
    pinned = true
    tip.classList.add("pinned")
    render()
  }
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault()
      stop()
    }
  }
  const onScroll = () => {
    if (current) place()
  }

  const stop = () => {
    window.removeEventListener("mousemove", onMove, true)
    window.removeEventListener("click", onClick, true)
    window.removeEventListener("mousedown", swallow, true)
    window.removeEventListener("mouseup", swallow, true)
    window.removeEventListener("pointerdown", swallow, true)
    window.removeEventListener("keydown", onKey, true)
    window.removeEventListener("scroll", onScroll, true)
    host.remove()
    delete inspectorWindow.__ecpInspector
  }

  window.addEventListener("mousemove", onMove, true)
  window.addEventListener("click", onClick, true)
  window.addEventListener("mousedown", swallow, true)
  window.addEventListener("mouseup", swallow, true)
  window.addEventListener("pointerdown", swallow, true)
  window.addEventListener("keydown", onKey, true)
  window.addEventListener("scroll", onScroll, true)
  inspectorWindow.__ecpInspector = { stop }
  return true
}

/** Resolves whether the inspector is now running, or `null` if the page can't be scripted */
export const toggleColorInspector = async (
  tabId: number
): Promise<boolean | null> => {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: toggleInspectorInPage
    })
    return result?.result === true
  } catch {
    return null
  }
}

/** Validates an `OPEN_CONTRAST_CHECKER` message and builds the checker URL */
export const contrastCheckerUrl = (message: {
  foreground?: unknown
  background?: unknown
  largeText?: unknown
}): string | null => {
  const hex = (value: unknown) =>
    typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
      ? value.slice(1)
      : null
  const fg = hex(message.foreground)
  const bg = hex(message.background)
  if (!fg || !bg) return null
  return chrome.runtime.getURL(
    `tabs/contrast-checker.html?fg=${fg}&bg=${bg}${message.largeText === true ? "&large=1" : ""}`
  )
}
