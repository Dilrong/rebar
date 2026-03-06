import type { Config } from "tailwindcss"

const config = {
    darkMode: ["class"],
    content: [
        './app/**/*.{ts,tsx}',
    ],
    prefix: "",
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            fontFamily: {
                sans: ["var(--app-font)", "system-ui", "sans-serif"],
                mono: ["var(--app-font)", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
            },
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            boxShadow: {
                "brutal-sm": "4px 4px 0px 0px var(--shadow-color)",
                brutal: "8px 8px 0px 0px var(--shadow-color)",
            },
            keyframes: {
                "fade-in-up": {
                    "0%": { opacity: "0", transform: "translateY(10px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                "slide-up-fade": {
                    from: { opacity: "0", transform: "translateY(4px)" },
                    to: { opacity: "1", transform: "translateY(0)" },
                },
                "slide-in-right": {
                    from: { transform: "translateX(100%)" },
                    to: { transform: "translateX(0)" },
                },
                "slide-out-right": {
                    from: { transform: "translateX(0)" },
                    to: { transform: "translateX(100%)" },
                },
                "pulse-brutal": {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: "0.2" },
                },
                "marquee": {
                    "0%": { transform: "translateX(0%)" },
                    "100%": { transform: "translateX(-100%)" },
                },
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                "glitch": {
                    "0%, 100%": { transform: "translate(0)" },
                    "20%": { transform: "translate(-2px, 2px)" },
                    "40%": { transform: "translate(-2px, -2px)" },
                    "60%": { transform: "translate(2px, 2px)" },
                    "80%": { transform: "translate(2px, -2px)" },
                },
            },
            animation: {
                "fade-in-up": "fade-in-up 0.4s ease-out forwards",
                "slide-up-fade": "slide-up-fade 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                "slide-in-right": "slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                "slide-out-right": "slide-out-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                "pulse-brutal": "pulse-brutal 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "marquee": "marquee 25s linear infinite",
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "glitch": "glitch 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both infinite",
            },
        },
    },
    plugins: [require('@tailwindcss/typography')],
} satisfies Config

export default config
