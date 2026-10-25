/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{tsx,html}"],
  darkMode: "media",
  theme: {
    extend: {
      keyframes: {
        // The popup's transitions both answer a click: a screen sliding in
        // when opened, and a confirmation dialog appearing
        "screen-in": {
          from: { opacity: "0", transform: "translateX(12px)" },
          to: { opacity: "1", transform: "translateX(0)" }
        },
        "dialog-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" }
        }
      },
      animation: {
        "screen-in": "screen-in 160ms ease-out",
        "dialog-in": "dialog-in 120ms ease-out"
      }
    }
  }
}
