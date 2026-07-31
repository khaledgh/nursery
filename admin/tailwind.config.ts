import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Nunito", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
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
