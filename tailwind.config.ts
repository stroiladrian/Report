import type { Config } from "tailwindcss";

/** Brand colours come from CSS variables injected from config/branding.ts (see src/app/layout.tsx). */
const v = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: v("primary"), dark: v("primary-dark"), light: v("primary-light") },
        secondary: v("secondary"),
        accent: { DEFAULT: v("accent"), dark: v("accent-dark") },
        danger: v("danger"),
        surface: v("surface"),
      },
      fontFamily: { sans: "var(--font-sans)" },
      boxShadow: { card: "0 1px 3px rgb(15 23 42 / 0.12), 0 8px 24px -12px rgb(15 23 42 / 0.25)" },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pop-in": { from: { opacity: "0", transform: "translateY(6px) scale(.98)" }, to: { opacity: "1", transform: "none" } },
        "slide-up": { from: { transform: "translateY(100%)" }, to: { transform: "none" } },
        "slide-left": { from: { transform: "translateX(100%)" }, to: { transform: "none" } },
      },
      animation: {
        "fade-in": "fade-in 120ms ease-out",
        "pop-in": "pop-in 140ms ease-out",
        "slide-up": "slide-up 200ms ease-out",
        "slide-left": "slide-left 200ms ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
