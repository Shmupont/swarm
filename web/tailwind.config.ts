import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          muted: "var(--accent-muted)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          hover: "var(--surface-hover)",
        },
        border: {
          DEFAULT: "var(--border)",
          hover: "var(--border-hover)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        destructive: "var(--destructive)",
        swarm: {
          bg: {
            DEFAULT: "#0A0F13",
            secondary: "#131A21",
            tertiary: "#1C252E",
            elevated: "#243140",
          },
          accent: {
            DEFAULT: "#2DD4BF",
            hover: "#14B8A6",
            muted: "#0F766E",
          },
          blue: {
            DEFAULT: "#38BDF8",
            muted: "#0284C7",
          },
          text: {
            DEFAULT: "#F0F4F8",
            secondary: "#94A3B8",
            muted: "#64748B",
          },
          border: {
            DEFAULT: "#1E293B",
            hover: "#334155",
          },
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["Clash Display", "sans-serif"],
        body: ["General Sans", "sans-serif"],
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
