/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Calm palette: soft neutrals + one gentle accent. No red anywhere.
        // Warm paper background, muted ink text, and a single sage/teal accent.
        paper: {
          DEFAULT: "#f6f4ef", // app background
          raised: "#fdfcfa", // cards / raised surfaces
          sunken: "#efece5", // wells / inputs
        },
        ink: {
          DEFAULT: "#3a3a34", // primary text
          soft: "#6b6b61", // secondary text
          faint: "#9a978c", // tertiary / hints
        },
        line: {
          DEFAULT: "#e4e0d7", // hairline borders
          strong: "#d6d1c6",
        },
        // Single accent: a calm sage. Used sparingly for the primary action + stats.
        accent: {
          DEFAULT: "#6f8f7d",
          soft: "#dfe8e2",
          deep: "#556e60",
          ink: "#2f3d35",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      transitionTimingFunction: {
        calm: "cubic-bezier(0.4, 0.0, 0.2, 1)",
      },
      keyframes: {
        "gentle-fade": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        // Soft, slow entrance only. No harsh/urgent motion.
        "gentle-fade": "gentle-fade 320ms cubic-bezier(0.4, 0.0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
