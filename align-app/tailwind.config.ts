import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0fdf9",
          100: "#ccfbef",
          200: "#99f6e0",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
        /** Tema app Cursor-ish (light): „dark-*” = suprafețe & text pe fundal deschis. */
        dark: {
          950: "#fafafa",
          900: "#f6f6f7",
          800: "#ffffff",
          700: "#f4f4f5",
          600: "#e4e4e7",
          500: "#71717a",
          400: "#a1a1aa",
          300: "#d4d4d8",
        },
        /** UI apeluri / overlay întunecat (valorile vechi dark). */
        night: {
          950: "#0c1116",
          900: "#0f1419",
          800: "#15202b",
          700: "#192734",
          600: "#22303c",
          500: "#5c6770",
          400: "#8b98a5",
          300: "#b8c5d1",
        },
      },
      fontFamily: {
        sans: ["system-ui", "sans-serif"],
        serif: ["Georgia", "Cambria", '"Times New Roman"', "Times", "serif"],
      },
      keyframes: {
        pulseLogo: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
        moveDiag: {
          "0%": { transform: "translateX(0) translateY(0)" },
          "100%": { transform: "translateX(-80px) translateY(-80px)" },
        },
        sweep: {
          "0%": { transform: "translateX(-100%) skewX(-12deg)" },
          "100%": { transform: "translateX(200%) skewX(-12deg)" },
        },
        diebelFlash: {
          "0%, 90%, 100%": { boxShadow: "0 0 0 0 rgba(255,255,255,0)" },
          "93%": { boxShadow: "0 0 0 3px rgba(255,255,255,0.45), 0 0 24px rgba(255,106,0,0.35)" },
        },
        diebelSparkle: {
          "0%, 100%": { opacity: "0", transform: "translate(-30%, -20%) scale(0.6)" },
          "48%": { opacity: "0" },
          "50%": { opacity: "0.9", transform: "translate(10%, 10%) scale(1)" },
          "52%": { opacity: "0" },
        },
        diebelFadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        diebelSlideLeft: {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        diebelScaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        diebelParticles: {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.55" },
        },
        diebelShimmer: {
          "0%": { backgroundPosition: "200% 50%" },
          "100%": { backgroundPosition: "-200% 50%" },
        },
        diebelOrb: {
          "0%, 100%": { transform: "translate(0,0) scale(1)", opacity: "0.4" },
          "50%": { transform: "translate(4%, -3%) scale(1.08)", opacity: "0.65" },
        },
        diebelFlare: {
          "0%, 100%": { opacity: "0.25", transform: "scale(1) rotate(0deg)" },
          "50%": { opacity: "0.5", transform: "scale(1.15) rotate(6deg)" },
        },
        diebelAurora: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        diebelFloat: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        diebelTwinkle: {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.15)" },
        },
        diebelGridPulse: {
          "0%, 100%": { opacity: "0.06" },
          "50%": { opacity: "0.12" },
        },
      },
      animation: {
        pulseLogo: "pulseLogo 2.2s ease-in-out infinite",
        moveDiag: "moveDiag 8s linear infinite",
        sweep: "sweep 6s linear infinite",
        diebelFlash: "diebelFlash 3.2s ease-in-out infinite",
        diebelSparkle: "diebelSparkle 5s ease-in-out infinite",
        diebelFadeUp: "diebelFadeUp 0.65s ease-out both",
        diebelSlideLeft: "diebelSlideLeft 0.55s ease-out both",
        diebelScaleIn: "diebelScaleIn 0.5s ease-out both",
        diebelParticles: "diebelParticles 5s ease-in-out infinite",
        diebelShimmer: "diebelShimmer 10s ease-in-out infinite",
        diebelOrb: "diebelOrb 12s ease-in-out infinite",
        diebelFlare: "diebelFlare 4s ease-in-out infinite",
        diebelAurora: "diebelAurora 18s ease-in-out infinite",
        diebelFloat: "diebelFloat 5s ease-in-out infinite",
        diebelTwinkle: "diebelTwinkle 2.8s ease-in-out infinite",
        diebelGridPulse: "diebelGridPulse 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
