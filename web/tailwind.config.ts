import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* ── Background Layers (warm dark blue-grey, Safari-inspired) ── */
        background: "#1C1C1E",
        surface: "#2C2C2E",
        "surface-2": "#3A3A3C",
        "surface-3": "#48484A",
        elevated: "#48484A",
        "card-hover": "#333335",

        /* ── Accent — Red/Amber ── */
        accent: "#F97316",
        "accent-muted": "rgba(249, 115, 22, 0.12)",
        "accent-hover": "#FB923C",
        "accent-soft": "rgba(249, 115, 22, 0.12)",

        /* ── Text ── */
        foreground: "#F5F5F7",
        muted: "#A1A1A6",
        "muted-2": "#6E6E73",

        /* ── Borders (very subtle, used sparingly) ── */
        border: "rgba(255, 255, 255, 0.06)",
        "border-hover": "rgba(255, 255, 255, 0.1)",

        /* ── Semantic ── */
        success: "#30D158",
        warning: "#FFD60A",
        error: "#FF453A",
        info: "#64D2FF",

        /* keep secondary for compat */
        secondary: "#EF4444",
        "secondary-muted": "rgba(239, 68, 68, 0.12)",
      },
      fontFamily: {
        display: ["Clash Display", "system-ui", "sans-serif"],
        heading: ["Satoshi", "system-ui", "sans-serif"],
        sans: ["General Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-accent":
          "linear-gradient(135deg, #F97316 0%, #EF4444 100%)",
      },
      borderRadius: {
        "squircle": "22%",
      },
      boxShadow: {
        card: "0 2px 12px rgba(0, 0, 0, 0.2)",
        elevated: "0 4px 24px rgba(0, 0, 0, 0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
