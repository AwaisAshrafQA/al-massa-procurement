/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "IBM Plex Sans Arabic", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        // Al Massa navy (logo #203050)
        brand: {
          50: "#eef1f8", 100: "#d9dfee", 200: "#b3bfdd", 300: "#8597c4", 400: "#586fa8",
          500: "#34497f", 600: "#2a3d6c", 700: "#203050", 800: "#182540", 900: "#101a2e",
        },
        // Al Massa orange (logo #F09020)
        accent: { 300: "#f8c27a", 400: "#f6a84a", 500: "#f09020", 600: "#d97a0c", 700: "#b4620a" },
        viz: { 1: "#2c4a8a", grid: "#e1e0d9", base: "#c3c2b7", muted: "#898781" },
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.04), 0 4px 16px -4px rgba(15,23,42,.08)",
        lift: "0 2px 4px rgba(15,23,42,.06), 0 12px 32px -8px rgba(15,23,42,.18)",
        glow: "0 0 0 4px rgba(52,73,127,.18)",
      },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(10px)" }, "100%": { opacity: "1", transform: "none" } },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "scale-in": { "0%": { opacity: "0", transform: "scale(.96)" }, "100%": { opacity: "1", transform: "none" } },
        "sheet-up": { "0%": { transform: "translateY(100%)" }, "100%": { transform: "none" } },
        "toast-in": { "0%": { opacity: "0", transform: "translateY(-12px) scale(.97)" }, "100%": { opacity: "1", transform: "none" } },
        shimmer: { "0%": { backgroundPosition: "-400px 0" }, "100%": { backgroundPosition: "400px 0" } },
        "pulse-ring": { "0%": { boxShadow: "0 0 0 0 rgba(240,144,32,.5)" }, "100%": { boxShadow: "0 0 0 10px rgba(240,144,32,0)" } },
        "pulse-dot": { "0%,100%": { opacity: "1" }, "50%": { opacity: ".35" } },
        float: { "0%,100%": { transform: "translate(0,0) scale(1)" }, "50%": { transform: "translate(20px,-30px) scale(1.08)" } },
        "grow-x": { "0%": { transform: "scaleX(0)" }, "100%": { transform: "scaleX(1)" } },
        "grow-y": { "0%": { transform: "scaleY(0)" }, "100%": { transform: "scaleY(1)" } },
      },
      animation: {
        "fade-up": "fade-up .45s cubic-bezier(.2,.8,.2,1) both",
        "fade-in": "fade-in .3s ease-out both",
        "scale-in": "scale-in .22s cubic-bezier(.2,.8,.2,1) both",
        "sheet-up": "sheet-up .3s cubic-bezier(.2,.8,.2,1) both",
        "toast-in": "toast-in .3s cubic-bezier(.2,.8,.2,1) both",
        shimmer: "shimmer 1.3s linear infinite",
        "pulse-ring": "pulse-ring 1.6s ease-out infinite",
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite",
        float: "float 14s ease-in-out infinite",
        "grow-x": "grow-x .8s cubic-bezier(.2,.8,.2,1) both",
        "grow-y": "grow-y .8s cubic-bezier(.2,.8,.2,1) both",
      },
    },
  },
  plugins: [],
};
