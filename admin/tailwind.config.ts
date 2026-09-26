import type { Config } from "tailwindcss";
import { heroui } from "@heroui/react";

export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Nunito", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Semantic aliases
        success: {
          bg: "#ccfbf1",
          fg: "#0f766e",
        },
        warning: {
          bg: "#fef3c7",
          fg: "#b45309",
        },
        danger: {
          bg: "#ffe4e6",
          fg: "#be123c",
        },
        info: {
          bg: "#e0f2fe",
          fg: "#0369a1",
        },
        // Official Nursee+ brand colors sampled from the logo:
        // 1. Signature Turquoise Teal (#2CAFA8 - second color of the app)
        brand: {
          50: "#eefbf9",
          100: "#d4f6f3",
          200: "#aceee7",
          300: "#73ded5",
          400: "#3ec7be",
          500: "#2CAFA8",
          600: "#2CAFA8",
          700: "#23928c",
          800: "#1f7571",
          900: "#1e5d5a",
          950: "#0b2e2d",
          DEFAULT: "#2CAFA8",
        },
        primary: {
          50: "#eefbf9",
          100: "#d4f6f3",
          200: "#aceee7",
          300: "#73ded5",
          400: "#3ec7be",
          500: "#2CAFA8",
          600: "#2CAFA8",
          700: "#23928c",
          800: "#1f7571",
          900: "#1e5d5a",
          950: "#0b2e2d",
          DEFAULT: "#2CAFA8",
          foreground: "#ffffff",
        },
        // 2. Royal Violet / Indigo (left curve of the N)
        violet: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#6c5ce7",
          700: "#5b4cdb",
          800: "#4d3ec2",
          900: "#3d2fa3",
          950: "#241a70",
          DEFAULT: "#6c5ce7",
        },
        // 3. Vibrant Cyan / Turquoise Teal (alias)
        teal: {
          50: "#eefbf9",
          100: "#d4f6f3",
          200: "#aceee7",
          300: "#73ded5",
          400: "#3ec7be",
          500: "#2CAFA8",
          600: "#2CAFA8",
          700: "#23928c",
          800: "#1f7571",
          900: "#1e5d5a",
          950: "#0b2e2d",
          DEFAULT: "#2CAFA8",
        },
        // 4. Sunny Warm Marigold (the + sign and stars)
        marigold: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          DEFAULT: "#ffb142",
        },
        // 5. Playful Coral Pink & Sky Blue dots
        coral: {
          500: "#ff5e7e",
          DEFAULT: "#ff5e7e",
        },
        sky: {
          500: "#00a8ff",
          DEFAULT: "#00a8ff",
        },
      },
    },
  },
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            primary: {
              50: "#eefbf9",
              100: "#d4f6f3",
              200: "#aceee7",
              300: "#73ded5",
              400: "#3ec7be",
              500: "#2CAFA8",
              600: "#2CAFA8",
              700: "#23928c",
              800: "#1f7571",
              900: "#1e5d5a",
              DEFAULT: "#2CAFA8",
              foreground: "#ffffff",
            },
            focus: "#2CAFA8",
          },
        },
        dark: {
          colors: {
            primary: {
              50: "#eefbf9",
              100: "#d4f6f3",
              200: "#aceee7",
              300: "#73ded5",
              400: "#3ec7be",
              500: "#2CAFA8",
              600: "#2CAFA8",
              700: "#23928c",
              800: "#1f7571",
              900: "#1e5d5a",
              DEFAULT: "#2CAFA8",
              foreground: "#ffffff",
            },
            focus: "#2CAFA8",
          },
        },
      },
    }),
  ],
} satisfies Config;
