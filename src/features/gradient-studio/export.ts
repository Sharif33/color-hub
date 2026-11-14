import { formatColor } from "~utils/color-formats"
import { parseColorWithAlpha } from "~utils/color-utils"
import {
  backgroundImageCss,
  gradientToCss,
  needsSrgbFallback,
  sortStops,
  srgbStops,
  type Gradient,
  type GradientStop
} from "~utils/gradient"
import {
  nearestTailwindColor,
  type TailwindVersion
} from "~utils/tailwind-match"

export type GradientExportFormat =
  | "css"
  | "tailwind-v4"
  | "tailwind-v3"
  | "swiftui"
  | "compose"
  | "flutter"
  | "android"
  | "svg"

export const GRADIENT_EXPORT_FORMATS: Array<{
  value: GradientExportFormat
  label: string
}> = [
  { value: "css", label: "CSS" },
  { value: "tailwind-v4", label: "Tailwind v4" },
  { value: "tailwind-v3", label: "Tailwind v3" },
  { value: "swiftui", label: "SwiftUI" },
  { value: "compose", label: "Compose" },
  { value: "flutter", label: "Flutter" },
  { value: "android", label: "Android XML" },
  { value: "svg", label: "SVG" }
]

export interface GradientExport {
  code: string
  /** What the code can't do exactly, in plain words */
  notes: string[]
}

const round = (n: number, digits = 3) => +n.toFixed(digits)

const radians = (degrees: number) => (degrees * Math.PI) / 180

/**
 * Where a linear gradient starts and ends, as fractions of the box (0,0 is
 * top left). For a square this matches CSS: the line runs through the center
 * at the angle and reaches the corners. Other boxes stretch it, like CSS's
 * `to top right`
 */
const linearEnds = (angle: number) => {
  const dx = Math.sin(radians(angle))
  const dy = -Math.cos(radians(angle))
  const half = (Math.abs(dx) + Math.abs(dy)) / 2
  return {
    start: { x: round(0.5 - dx * half), y: round(0.5 - dy * half) },
    end: { x: round(0.5 + dx * half), y: round(0.5 + dy * half) }
  }
}

/** Distances from the center to the farthest sides, in box fractions */
const farthestSides = (gradient: Gradient) => ({
  x: Math.max(gradient.center.x, 100 - gradient.center.x) / 100,
  y: Math.max(gradient.center.y, 100 - gradient.center.y) / 100
})

/** Distance from the center to the farthest corner, in box fractions */
const farthestCorner = (gradient: Gradient) => {
  const { x, y } = farthestSides(gradient)
  return Math.hypot(x, y)
}

/**
 * The radii of CSS's default ellipse (to the farthest corner), in box
 * fractions: √2 times the distances to the farthest sides, so it keeps their
 * proportions. Other platforms stretch a circle with the box, which is the
 * same shape only when the center is centered
 */
const ellipseRadii = (gradient: Gradient) => {
  const { x, y } = farthestSides(gradient)
  return { x: x * Math.SQRT2, y: y * Math.SQRT2 }
}

const isOffCenterEllipse = (gradient: Gradient) => {
  const { x, y } = farthestSides(gradient)
  return gradient.shape === "ellipse" && Math.abs(x - y) > 1e-6
}

const alphaOf = (color: string) => parseColorWithAlpha(color)?.alpha ?? 1
const hexOf = (color: string) =>
  parseColorWithAlpha(color)?.hex ?? color.slice(0, 7)

// --- Shared notes ---

const GRAIN_NOTE =
  "Grain isn't included here. Layer a noise image over the gradient, or use the CSS."
const REPEAT_NOTE =
  "Repeating gradients aren't supported here, so it's written once, not repeated."
// Start and end points relative to the view stretch with it
const stretchNote = (gradient: Gradient) =>
  gradient.type === "linear" && gradient.angle % 90 !== 0
    ? "The direction stretches with the view's shape, like CSS's `to bottom right`, so a diagonal matches CSS exactly only in a square."
    : null

const sampledNote = (gradient: Gradient) =>
  gradient.space !== "srgb" || gradient.easing !== "linear"
    ? "This platform blends in plain sRGB, so the OKLab/OKLCH blend or easing is reproduced with extra sampled stops."
    : null

const platformNotes = (
  gradient: Gradient,
  extra: Array<string | null> = [],
  { sampled = true } = {}
) =>
  [
    sampled ? sampledNote(gradient) : null,
    gradient.repeating ? REPEAT_NOTE : null,
    gradient.grain > 0 ? GRAIN_NOTE : null,
    ...extra
  ].filter((note): note is string => note !== null)

// --- CSS ---

const cssExport = (gradient: Gradient): GradientExport => {
  const main = `background-image: ${backgroundImageCss(gradient)};`
  if (!needsSrgbFallback(gradient)) return { code: main, notes: [] }
  const fallback = `background-image: ${backgroundImageCss(gradient, { srgbFallback: true })};`
  return {
    code: `${fallback}\n${main}`,
    notes: [
      "The first line is a fallback in plain sRGB for browsers from before 2023, which skip the second."
    ]
  }
}

// --- Tailwind ---

// Below this ΔE a stop is written as a palette color, e.g. blue-600
const TAILWIND_NAME_MAX_DELTA_E = 2

const tailwindColor = (color: string, version: TailwindVersion) => {
  const hex = hexOf(color)
  const alpha = alphaOf(color)
  const match = nearestTailwindColor(hex, version)
  if (match.deltaE < TAILWIND_NAME_MAX_DELTA_E) {
    return alpha < 1 ? `${match.name}/${Math.round(alpha * 100)}` : match.name
  }
  return `[${color.toLowerCase()}]`
}

// Arbitrary values use _ for spaces
const arbitrary = (css: string) => css.replace(/\s+/g, "_")

const SIDES: Record<number, string> = { 0: "t", 90: "r", 180: "b", 270: "l" }

/** `from-… via-… to-…`, with positions only where they aren't the default */
const stopClasses = (stops: GradientStop[], version: TailwindVersion) => {
  const [first, middle, last] =
    stops.length === 2 ? [stops[0], null, stops[1]] : stops
  const classes = [`from-${tailwindColor(first.color, version)}`]
  if (first.position !== 0) classes.push(`from-${round(first.position, 1)}%`)
  if (middle) {
    classes.push(`via-${tailwindColor(middle.color, version)}`)
    if (middle.position !== 50)
      classes.push(`via-${round(middle.position, 1)}%`)
  }
  classes.push(`to-${tailwindColor(last.color, version)}`)
  if (last.position !== 100) classes.push(`to-${round(last.position, 1)}%`)
  return classes
}

const tailwindExport = (
  gradient: Gradient,
  version: TailwindVersion
): GradientExport => {
  const stops = sortStops(gradient.stops)
  const notes: string[] = []
  if (gradient.grain > 0) notes.push(GRAIN_NOTE)
  // from/via/to hold three stops, and can't ease or repeat
  const simple =
    stops.length <= 3 && gradient.easing === "linear" && !gradient.repeating
  const angle = round(gradient.angle, 2)
  const centered = gradient.center.x === 50 && gradient.center.y === 50

  if (simple && version === "v4") {
    // v4 blends in OKLab unless told otherwise
    const modifier =
      gradient.space === "srgb"
        ? "/srgb"
        : gradient.space === "oklch"
          ? gradient.hue === "longer"
            ? "/longer"
            : "/oklch"
          : ""
    let base: string | null = null
    if (gradient.type === "linear") {
      base =
        angle in SIDES
          ? `bg-linear-to-${SIDES[angle]}`
          : Number.isInteger(angle)
            ? `bg-linear-${angle}`
            : `bg-linear-[${angle}deg]`
    } else if (
      gradient.type === "radial" &&
      centered &&
      gradient.shape === "ellipse"
    ) {
      base = "bg-radial"
    } else if (
      gradient.type === "conic" &&
      centered &&
      Number.isInteger(angle)
    ) {
      base = angle === 0 ? "bg-conic" : `bg-conic-${angle}`
    }
    if (base) {
      return {
        code: [`${base}${modifier}`, ...stopClasses(stops, version)].join(" "),
        notes
      }
    }
  }

  if (
    simple &&
    version === "v3" &&
    gradient.space === "srgb" &&
    gradient.type === "linear"
  ) {
    // v3's to-tr and the like point at the corner, which is only 45° in a
    // square, so other angles set the direction with an arbitrary value
    const base =
      angle in SIDES
        ? `bg-gradient-to-${SIDES[angle]}`
        : `bg-[linear-gradient(${angle}deg,var(--tw-gradient-stops))]`
    const classes = stopClasses(stops, version)
    if (classes.some((c) => c.endsWith("%")))
      notes.push(
        "Stop positions (from-10% and so on) need Tailwind 3.3 or later."
      )
    return { code: [base, ...classes].join(" "), notes }
  }

  // Anything else is the whole gradient as an arbitrary value
  if (version === "v3" && gradient.space !== "srgb")
    notes.push(
      "Tailwind v3 has no setting for OKLab or OKLCH blending, so the gradient is an arbitrary value. Browsers from before 2023 show nothing; the CSS tab has a fallback."
    )
  else if (!simple)
    notes.push(
      "More than three stops, easing or repeating needs the whole gradient as an arbitrary value."
    )
  return { code: `bg-[${arbitrary(gradientToCss(gradient))}]`, notes }
}

// --- SwiftUI ---

const swiftStops = (stops: GradientStop[]) =>
  stops
    .map(
      (stop) =>
        `        .init(color: ${formatColor(stop.color, "swiftui")}, location: ${round(stop.position / 100)})`
    )
    .join(",\n")

const swiftUiExport = (gradient: Gradient): GradientExport => {
  const stops = swiftStops(srgbStops(gradient))
  const gradientValue = `Gradient(stops: [\n${stops}\n    ])`
  const center = `UnitPoint(x: ${round(gradient.center.x / 100)}, y: ${round(gradient.center.y / 100)})`
  if (gradient.type === "linear") {
    const { start, end } = linearEnds(gradient.angle)
    return {
      code: `LinearGradient(\n    gradient: ${gradientValue},\n    startPoint: UnitPoint(x: ${start.x}, y: ${start.y}),\n    endPoint: UnitPoint(x: ${end.x}, y: ${end.y})\n)`,
      notes: platformNotes(gradient, [stretchNote(gradient)])
    }
  }
  if (gradient.type === "conic") {
    // SwiftUI's 0° points right; CSS's points up
    return {
      code: `AngularGradient(\n    gradient: ${gradientValue},\n    center: ${center},\n    startAngle: .degrees(${round(gradient.angle - 90, 2)}),\n    endAngle: .degrees(${round(gradient.angle + 270, 2)})\n)`,
      notes: platformNotes(gradient)
    }
  }
  if (gradient.shape === "circle") {
    return {
      code: `RadialGradient(\n    gradient: ${gradientValue},\n    center: ${center},\n    startRadius: 0,\n    // In points: the distance from the center to the view's farthest corner\n    endRadius: 300\n)`,
      notes: platformNotes(gradient, [
        "Set endRadius to your view's size. CSS sizes the circle to the box; SwiftUI needs points."
      ])
    }
  }
  // SwiftUI stretches the ellipse with the view, so off center it can match
  // CSS's width or height, not both. Width, like the CSS gradient line
  return {
    code: `// iOS 17 / macOS 14\nEllipticalGradient(\n    gradient: ${gradientValue},\n    center: ${center},\n    endRadiusFraction: ${round(ellipseRadii(gradient).x)}\n)`,
    notes: platformNotes(gradient, [
      isOffCenterEllipse(gradient)
        ? "SwiftUI keeps the ellipse in the view's proportions, so off center it matches the CSS in width but not in height."
        : null
    ])
  }
}

// --- Jetpack Compose ---

// Kotlin doesn't turn 90 into 90.0 for a Double parameter
const kotlinDouble = (n: number) =>
  Number.isInteger(round(n, 2)) ? `${round(n, 2)}.0` : `${round(n, 2)}`

const composeLists = (stops: GradientStop[]) => ({
  colors: stops.map((stop) => formatColor(stop.color, "compose")).join(", "),
  positions: stops.map((stop) => `${round(stop.position / 100)}f`).join(", ")
})

const composeExport = (gradient: Gradient): GradientExport => {
  const { colors, positions } = composeLists(srgbStops(gradient))
  const lists = `colors = listOf(${colors}),\n            colorStops = listOf(${positions})`
  const center = `Offset(size.width * ${round(gradient.center.x / 100)}f, size.height * ${round(gradient.center.y / 100)}f)`
  let shader: string
  const notes: Array<string | null> = []
  if (gradient.type === "linear") {
    shader = `        // The same line as CSS: through the center at ${round(gradient.angle, 2)}°, reaching the corners
        val angle = Math.toRadians(${kotlinDouble(gradient.angle)})
        val dx = sin(angle).toFloat()
        val dy = -cos(angle).toFloat()
        val half = (abs(size.width * dx) + abs(size.height * dy)) / 2
        val offset = Offset(dx * half, dy * half)
        return LinearGradientShader(
            from = size.center - offset,
            to = size.center + offset,
            ${lists}
        )`
  } else if (gradient.type === "radial") {
    shader = `        val center = ${center}
        // To the farthest corner, like CSS
        val radius = maxOf(
            (center - Offset.Zero).getDistance(),
            (center - Offset(size.width, 0f)).getDistance(),
            (center - Offset(0f, size.height)).getDistance(),
            (center - Offset(size.width, size.height)).getDistance()
        )
        return RadialGradientShader(
            center = center,
            radius = radius,
            ${lists}
        )`
    if (gradient.shape === "ellipse")
      notes.push(
        "Compose draws radial gradients as circles, so the ellipse is a circle here."
      )
  } else {
    shader = `        val center = ${center}
        // Compose starts at 3 o'clock, CSS at 12, so turn it (Android)
        return SweepGradientShader(
            center = center,
            ${lists}
        ).apply {
            setLocalMatrix(android.graphics.Matrix().apply {
                setRotate(${round(gradient.angle - 90, 2)}f, center.x, center.y)
            })
        }`
  }
  return {
    code: `// import androidx.compose.ui.graphics.*, androidx.compose.ui.geometry.*, kotlin.math.*
val gradientBrush = object : ShaderBrush() {
    override fun createShader(size: Size): Shader {
${shader}
    }
}

// Modifier.background(gradientBrush)`,
    notes: platformNotes(gradient, notes)
  }
}

// --- Flutter ---

const flutterExport = (gradient: Gradient): GradientExport => {
  const stops = srgbStops(gradient)
  const colors = stops
    .map((stop) => formatColor(stop.color, "compose"))
    .join(", ")
  const positions = stops.map((stop) => round(stop.position / 100)).join(", ")
  const lists = `  colors: [${colors}],\n  stops: [${positions}],`
  // Alignment runs from -1 to 1, with -1 at the top and left
  const alignment = (x: number, y: number) =>
    `Alignment(${round(x * 2 - 1)}, ${round(y * 2 - 1)})`
  const center = alignment(gradient.center.x / 100, gradient.center.y / 100)
  const notes: Array<string | null> = []
  let code: string
  if (gradient.type === "linear") {
    const { start, end } = linearEnds(gradient.angle)
    code = `LinearGradient(\n  begin: ${alignment(start.x, start.y)},\n  end: ${alignment(end.x, end.y)},\n${lists}\n)`
    notes.push(stretchNote(gradient))
  } else if (gradient.type === "radial") {
    code = `RadialGradient(\n  center: ${center},\n  // A fraction of the shortest side; this reaches the farthest corner of a square\n  radius: ${round(farthestCorner(gradient))},\n${lists}\n)`
    if (gradient.shape === "ellipse")
      notes.push(
        "Flutter draws radial gradients as circles, so the ellipse is a circle here."
      )
  } else {
    code = `SweepGradient(\n  center: ${center},\n${lists}\n  // Flutter starts at 3 o'clock, CSS at 12\n  transform: GradientRotation(${round(radians(gradient.angle - 90), 4)}),\n)`
  }
  return {
    code: `// BoxDecoration(gradient: ...)\n${code}`,
    notes: platformNotes(gradient, notes)
  }
}

// --- Android XML ---

const androidColor = (color: string) =>
  `#${formatColor(color, "compose").slice(8, 16)}`

const androidExport = (gradient: Gradient): GradientExport => {
  const notes: Array<string | null> = []
  const stops = srgbStops(gradient)
  // A shape takes a start, an optional center and an end color
  const pick = (position: number) =>
    stops.reduce((best, stop) =>
      Math.abs(stop.position - position) < Math.abs(best.position - position)
        ? stop
        : best
    )
  const first = stops[0]
  const last = stops[stops.length - 1]
  const original = sortStops(gradient.stops)
  const needsCenter = stops.length > 2
  const middle = needsCenter ? pick((first.position + last.position) / 2) : null
  if (
    stops.length > 3 ||
    (original.length === 3 && original[1].position !== 50)
  )
    notes.push(
      "Android shapes take three colors at most, with the middle one halfway, so this is close but not exact. For the exact gradient use Compose."
    )
  if (first.position !== 0 || last.position !== 100)
    notes.push(
      "Android shapes can't move the first and last stops in from the edges."
    )

  const lines = [
    `android:type="${gradient.type === "conic" ? "sweep" : gradient.type}"`
  ]
  if (gradient.type === "linear") {
    // Android's 0 points right and turns counterclockwise, in steps of 45
    const exact = (((90 - gradient.angle) % 360) + 360) % 360
    const angle = (Math.round(exact / 45) * 45) % 360
    if (angle !== round(exact, 2))
      notes.push(
        `Android angles go in steps of 45°, so ${round(gradient.angle, 2)}° is rounded.`
      )
    lines.push(`android:angle="${angle}"`)
  } else {
    lines.push(
      `android:centerX="${round(gradient.center.x / 100, 2)}"`,
      `android:centerY="${round(gradient.center.y / 100, 2)}"`
    )
    if (gradient.type === "radial") {
      // A fraction of the shape's shorter side
      lines.push(
        `android:gradientRadius="${Math.round(farthestCorner(gradient) * 100)}%"`
      )
      if (gradient.shape === "ellipse")
        notes.push(
          "Android draws radial gradients as circles, so the ellipse is a circle here."
        )
    } else if (gradient.angle !== 90) {
      notes.push(
        "Android sweep gradients always start at 3 o'clock, so the start angle is lost."
      )
    }
  }
  lines.push(`android:startColor="${androidColor(first.color)}"`)
  if (middle) lines.push(`android:centerColor="${androidColor(middle.color)}"`)
  lines.push(`android:endColor="${androidColor(last.color)}"`)

  return {
    code: `<?xml version="1.0" encoding="utf-8"?>
<!-- res/drawable/gradient.xml, colors as #AARRGGBB -->
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <gradient
        ${lines.join("\n        ")} />
</shape>`,
    // Three colors are picked from the sampled stops, so the note about
    // sampling doesn't apply
    notes: platformNotes(gradient, notes, { sampled: false })
  }
}

// --- SVG ---

const svgStops = (stops: GradientStop[]) =>
  stops
    .map((stop) => {
      const alpha = alphaOf(stop.color)
      return `      <stop offset="${round(stop.position, 2)}%" stop-color="${hexOf(stop.color)}"${
        alpha < 1 ? ` stop-opacity="${round(alpha)}"` : ""
      } />`
    })
    .join("\n")

// An id from the gradient itself, so two exported SVGs on one page don't
// both draw whichever gradient was defined first
const svgId = (gradient: Gradient) => {
  let hash = 0
  for (const char of JSON.stringify(gradient))
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  return `gradient-${(hash >>> 0).toString(36).slice(0, 6)}`
}

const svgExport = (gradient: Gradient): GradientExport => {
  if (gradient.type === "conic") {
    return {
      code: "<!-- SVG has no conic gradient -->",
      notes: [
        "SVG can't draw conic gradients. Use the CSS, or export an image."
      ]
    }
  }
  const stops = svgStops(srgbStops(gradient))
  const id = svgId(gradient)
  const spread = gradient.repeating ? ` spreadMethod="repeat"` : ""
  let element: string
  const notes: Array<string | null> = []
  if (gradient.type === "linear") {
    const { start, end } = linearEnds(gradient.angle)
    notes.push(stretchNote(gradient))
    element = `    <linearGradient id="${id}" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}"${spread}>\n${stops}\n    </linearGradient>`
  } else {
    const cx = round(gradient.center.x / 100)
    const cy = round(gradient.center.y / 100)
    let r = round(farthestCorner(gradient))
    let transform = ""
    if (gradient.shape === "ellipse") {
      // One radius stretched with the box gives the box's proportions, so
      // an off-center ellipse is squeezed to its own, around its center
      const radii = ellipseRadii(gradient)
      r = round(radii.x)
      if (isOffCenterEllipse(gradient))
        transform = ` gradientTransform="translate(${cx} ${cy}) scale(1 ${round(radii.y / radii.x)}) translate(${-cx} ${-cy})"`
    } else {
      notes.push(
        "SVG stretches the gradient with the shape, so the circle is an ellipse in a box that isn't square."
      )
    }
    element = `    <radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"${transform}${spread}>\n${stops}\n    </radialGradient>`
  }
  return {
    code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="none">
  <defs>
${element}
  </defs>
  <rect width="100%" height="100%" fill="url(#${id})" />
</svg>`,
    notes: platformNotes(gradient, notes).filter((note) => note !== REPEAT_NOTE)
  }
}

export const exportGradient = (
  gradient: Gradient,
  format: GradientExportFormat
): GradientExport => {
  switch (format) {
    case "css":
      return cssExport(gradient)
    case "tailwind-v4":
      return tailwindExport(gradient, "v4")
    case "tailwind-v3":
      return tailwindExport(gradient, "v3")
    case "swiftui":
      return swiftUiExport(gradient)
    case "compose":
      return composeExport(gradient)
    case "flutter":
      return flutterExport(gradient)
    case "android":
      return androidExport(gradient)
    case "svg":
      return svgExport(gradient)
  }
}
