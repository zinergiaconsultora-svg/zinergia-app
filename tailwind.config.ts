
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
                brand: {
                    blue: 'var(--color-brand-blue)',
                }
            },
            animation: {
                blob: "blob 7s infinite",
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
            },
        },
    },
    plugins: [],
} satisfies Config;
