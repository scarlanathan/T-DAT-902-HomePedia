import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: ["h-[min(56vh,560px)]", "min-h-[340px]", "h-[min(68vh,720px)]", "min-h-[420px]", "max-w-[96rem]"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f8fb",
          100: "#e9eef5",
          200: "#d4dce8",
          300: "#b8c4d6",
          400: "#7b8aa3",
          500: "#5c6b82",
          600: "#4a5870",
          700: "#3d4f6f",
          800: "#243044",
          900: "#152033",
        },
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          500: "#3b6cf4",
          600: "#2557eb",
          700: "#1d4ed8",
        },
        accent: { DEFAULT: "#2557eb", muted: "#93c5fd" },
        surface: "#ffffff",
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(21, 32, 51, 0.04), 0 8px 24px rgba(21, 32, 51, 0.06)",
        elevated:
          "0 4px 6px rgba(21, 32, 51, 0.05), 0 16px 40px rgba(21, 32, 51, 0.1)",
        glow: "0 0 0 1px rgba(59, 108, 244, 0.12), 0 12px 32px rgba(59, 108, 244, 0.12)",
      },
      animation: {
        "fade-in": "fadeIn 0.45s ease-out both",
        "slide-up": "slideUp 0.5s ease-out both",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
