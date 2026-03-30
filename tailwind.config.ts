import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        amber: {
          DEFAULT: "#EF9F27",
          50: "#FEF3DC",
          100: "#FDEAB9",
          200: "#FBD573",
          300: "#F9C12D",
          400: "#EF9F27",
          500: "#D4811A",
          600: "#A96612",
          700: "#7E4B0D",
          800: "#543008",
          900: "#2A1804",
        },
        claude: "#8B7CF6",
        gpt: "#10A37F",
        gemini: "#4285F4",
        deepseek: "#EF9F27",
        surface: "#141414",
        border: "#2A2A2A",
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
      },
      maxWidth: {
        content: "390px",
        tablet: "680px",
        shell: "1280px",
        bubble: "680px",
      },
      animation: {
        "slide-in": "slideIn 0.3s ease-out",
        "slide-up": "slideUp 0.35s ease-out",
        "fade-in": "fadeIn 0.2s ease-out",
        "pulse-dot": "pulseDot 1.4s ease-in-out infinite",
      },
      keyframes: {
        slideIn: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        slideUp: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        pulseDot: {
          "0%, 80%, 100%": { transform: "scale(0.6)", opacity: "0.4" },
          "40%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
