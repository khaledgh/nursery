import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // Class-based so the panel follows an explicit user choice rather than only
  // the OS setting.
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Nunito", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Semantic aliases, so a status colour is named by meaning rather than
        // by hue at each call site. These previously lived as literal
        // `bg-emerald-100 text-emerald-700` strings copy-pasted across pages.
        success: {
          bg: "#d1fae5",
          fg: "#047857",
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
        // Green scale sampled from the Little Talent Childcare logo. Every
        // `brand-*` utility across the admin resolves through here, so the
        // whole panel rebrands from this one ramp.
        brand: {
          50: "#f4f9ef",
          100: "#e8f4dd",
          200: "#d1e8bc",
          300: "#b3d894",
          400: "#8fc464",
          500: "#7cb342",
          600: "#5b9c34",
          700: "#4a8a2a",
          800: "#3f7222",
          900: "#2f551a",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
