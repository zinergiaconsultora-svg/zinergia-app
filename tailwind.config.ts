
import type { Config } from "tailwindcss";

export default {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/features/**/*.{js,ts,jsx,tsx,mdx}", // Added features directory
    ],
    theme: {
        extend: {
            fontFamily: {
                display: ['var(--font-display)', 'sans-serif'],
                sans: ['var(--font-sans)', 'sans-serif'],
                mono: ['var(--font-mono)', 'monospace'],
            },
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                energy: {
                    50: 'var(--color-energy-50)',
                    100: 'var(--color-energy-100)',
                    200: 'var(--color-energy-200)',
                    300: 'var(--color-energy-300)',
                    400: 'var(--color-energy-400)',
                    500: 'var(--color-energy-500)',
                    600: 'var(--color-energy-600)',
                    700: 'var(--color-energy-700)',
                    800: 'var(--color-energy-800)',
                    900: 'var(--color-energy-900)',
                    950: 'var(--color-energy-950)',
                },
                emerald: {
                    50: 'var(--color-emerald-50)',
                    100: 'var(--color-emerald-100)',
                    200: 'var(--color-emerald-200)',
                    300: 'var(--color-emerald-300)',
                    400: 'var(--color-emerald-400)',
                    500: 'var(--color-emerald-500)',
                    600: 'var(--color-emerald-600)',
                    700: 'var(--color-emerald-700)',
                    800: 'var(--color-emerald-800)',
                    900: 'var(--color-emerald-900)',
                    950: 'var(--color-emerald-950)',
                },
                teal: {
                    50: 'var(--color-teal-50)',
                    100: 'var(--color-teal-100)',
                    200: 'var(--color-teal-200)',
                    300: 'var(--color-teal-300)',
                    400: 'var(--color-teal-400)',
                    500: 'var(--color-teal-500)',
                    600: 'var(--color-teal-600)',
                    700: 'var(--color-teal-700)',
                    800: 'var(--color-teal-800)',
                    900: 'var(--color-teal-900)',
                    950: 'var(--color-teal-950)',
                },
                amber: {
                    50: 'var(--color-amber-50)',
                    100: 'var(--color-amber-100)',
                    200: 'var(--color-amber-200)',
                    300: 'var(--color-amber-300)',
                    400: 'var(--color-amber-400)',
                    500: 'var(--color-amber-500)',
                    600: 'var(--color-amber-600)',
                    700: 'var(--color-amber-700)',
                    800: 'var(--color-amber-800)',
                    900: 'var(--color-amber-900)',
                    950: 'var(--color-amber-950)',
                },
                brand: {
                    blue: 'var(--color-brand-blue)',
                }
            },
            animation: {
                blob: "blob 7s infinite",
                'fade-in-up': 'fade-in-up 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards',
                'slide-up': 'slide-up 0.3s ease-out forwards',
                'pulse-slow': 'pulse-slow 6s ease-in-out infinite',
                'float-slow': 'float-slow 8s ease-in-out infinite',
                'glow-soft': 'glow-soft 4s ease-in-out infinite',
                'glow-strong': 'glow-strong 3s ease-in-out infinite',
            },
            keyframes: {
                blob: {
                    "0%": {
                        transform: "translate(0px, 0px) scale(1)",
                    },
                    "33%": {
                        transform: "translate(30px, -50px) scale(1.1)",
                    },
                    "66%": {
                        transform: "translate(-20px, 20px) scale(0.9)",
                    },
                    "100%": {
                        transform: "translate(0px, 0px) scale(1)",
                    },
                },
                'fade-in-up': {
                    from: {
                        opacity: 0,
                        transform: 'translateY(30px) scale(0.95)',
                    },
                    to: {
                        opacity: 1,
                        transform: 'translateY(0) scale(1)',
                    },
                },
                'slide-up': {
                    from: {
                        opacity: 0,
                        transform: 'translateY(20px)',
                    },
                    to: {
                        opacity: 1,
                        transform: 'translateY(0)',
                    },
                },
                'pulse-slow': {
                    '0%, 100%': {
                        opacity: 0.8,
                        transform: 'scale(1)',
                    },
                    '50%': {
                        opacity: 1,
                        transform: 'scale(1.05)',
                    },
                },
                'float-slow': {
                    '0%, 100%': {
                        transform: 'translateY(0) translateX(0)',
                        opacity: 0,
                    },
                    '25%': {
                        opacity: 0.6,
                    },
                    '50%': {
                        transform: 'translateY(-20px) translateX(10px)',
                    },
                    '75%': {
                        opacity: 0.3,
                    },
                },
                'glow-soft': {
                    '0%, 100%': {
                        'fill-opacity': 0.1,
                    },
                    '50%': {
                        'fill-opacity': 0.25,
                    },
                },
                'glow-strong': {
                    '0%, 100%': {
                        'fill-opacity': 0.4,
                        'stroke-opacity': 0.5,
                    },
                    '50%': {
                        'fill-opacity': 0.8,
                        'stroke-opacity': 1,
                    },
                },
            },
        },
    },
    plugins: [],
} satisfies Config;

