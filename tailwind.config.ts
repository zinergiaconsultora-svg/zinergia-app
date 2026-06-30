
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
                },
                primary: {
                    DEFAULT: '#1e293b',
                    foreground: '#f8fafc',
                },
            },
            animation: {
                'slide-up': 'slide-up 0.3s ease-out forwards',
            },
            keyframes: {
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
            },
            boxShadow: {
                'card': '0 2px 10px -3px rgba(0, 0, 0, 0.05)',
                'dropdown': '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                'button': '0 2px 4px rgba(0, 0, 0, 0.05)',
                'floating': '0 20px 40px -10px rgba(0, 0, 0, 0.04)',
                'interaction': '0 8px 20px -5px rgba(0, 0, 0, 0.03)',
                'floating-light': '0 8px 32px rgba(30, 41, 59, 0.06)',
                'floating-medium': '0 12px 48px rgba(30, 41, 59, 0.08)',
                'floating-deep': '0 16px 64px rgba(30, 41, 59, 0.12)',
            },
        },
    },
    plugins: [],
} satisfies Config;

