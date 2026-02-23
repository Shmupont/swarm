import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* ── Background Layers (deep navy) ── */
        background: "#04080f",
        surface: "#080f1e",
        "surface-2": "#0d1829",
        "surface-3": "#111f38",
        elevated: "#111f38",
        "card-hover": "#0d1829",

        /* ── Accent — Blue ── */
        accent: "#3b82f6",
        "accent-muted": "rgba(59, 130, 246, 0.12)",
        "accent-hover": "#60a5fa",
        "accent-soft": "rgba(59, 130, 246, 0.12)",
        "accent-bright": "#60a5fa",
        "accent-dim": "#1d4ed8",

        /* ── Text ── */
        foreground: "#f0f4ff",
        muted: "#7a90a8",
        "muted-2": "#4a6070",

        /* ── Borders ── */
        border: "#1a2d4a",
        "border-hover": "rgba(59, 130, 246, 0.3)",

        /* ── Semantic ── */
        success: "#30D158",
        warning: "#FFD60A",
        error: "#FF453A",
        info: "#64D2FF",

        /* keep secondary for compat */
        secondary: "#3b82f6",
        "secondary-muted": "rgba(59, 130, 246, 0.12)",
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
          "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
      },
      borderRadius: {
        squircle: "22%",
      },
      boxShadow: {
        card: "0 2px 12px rgba(0, 0, 0, 0.4)",
        elevated: "0 4px 24px rgba(0, 0, 0, 0.6)",
      },
    },
  },
  plugins: [],
};

export default config;
