import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter, DM_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { Toaster } from "sonner";
import { PwaRegister } from "@/components/PwaRegister";

const displayFont = Plus_Jakarta_Sans({
    variable: "--font-display",
    subsets: ["latin"],
    weight: ["400", "500", "600"],
    display: "swap",
    preload: true,
});

const sansFont = Inter({
    variable: "--font-sans",
    subsets: ["latin"],
    weight: ["300", "400", "500", "600"],
    display: "swap",
    preload: true,
});

const monoFont = DM_Mono({
    variable: "--font-mono",
    subsets: ["latin"],
    weight: ["400", "500"],
    display: "swap",
    preload: true,
});


export const viewport: Viewport = {
    themeColor: "#4f46e5",
    width: "device-width",
    initialScale: 1,
    // Permitir zoom: bloquearlo (maximumScale/userScalable:false) incumple WCAG 1.4.4
    maximumScale: 5,
    userScalable: true,
    viewportFit: "cover",
};

export const metadata: Metadata = {
    title: {
        default: "Zinergia — Comparador de Tarifas Eléctricas",
        template: "%s — Zinergia",
    },
    description: "Compara y ahorra en tu factura de luz. Simulador de tarifas eléctricas con IA para empresas y autónomos.",
    metadataBase: new URL("https://zinergia.vercel.app"),
    openGraph: {
        type: "website",
        locale: "es_ES",
        siteName: "Zinergia",
        title: "Zinergia — Comparador de Tarifas Eléctricas",
        description: "Compara y ahorra en tu factura de luz. Simulador de tarifas eléctricas con IA para empresas y autónomos.",
    },
    twitter: {
        card: "summary",
        title: "Zinergia — Comparador de Tarifas Eléctricas",
        description: "Compara y ahorra en tu factura de luz con IA.",
    },
    alternates: {
        canonical: "https://zinergia.vercel.app",
    },
    robots: {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true },
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "Zinergia",
    },
    formatDetection: {
        telephone: false,
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es" suppressHydrationWarning>
            <head>
                {/* Critical connection hints — reduce TTFB for first API calls */}
                <link rel="preconnect" href="https://gmjgkzaxmkaggsyczwcm.supabase.co" crossOrigin="anonymous" />
                <link rel="dns-prefetch" href="https://gmjgkzaxmkaggsyczwcm.supabase.co" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify([
                            {
                                "@context": "https://schema.org",
                                "@type": "SoftwareApplication",
                                "name": "Zinergia",
                                "applicationCategory": "BusinessApplication",
                                "operatingSystem": "Web",
                                "description": "Comparador de tarifas eléctricas con IA para empresas y autónomos. Analiza tu factura y encuentra la mejor oferta del mercado.",
                                "url": "https://zinergia.vercel.app",
                                "provider": {
                                    "@type": "Organization",
                                    "name": "Zinergia Consultora Energética",
                                    "url": "https://zinergia.vercel.app",
                                },
                                "offers": {
                                    "@type": "Offer",
                                    "price": "0",
                                    "priceCurrency": "EUR",
                                    "description": "Auditoría energética gratuita",
                                },
                            },
                            {
                                "@context": "https://schema.org",
                                "@type": "Organization",
                                "name": "Zinergia Consultora Energética",
                                "url": "https://zinergia.vercel.app",
                                "logo": "https://zinergia.vercel.app/icons/icon-512x512.png",
                                "description": "Consultoría energética especializada en comparación de tarifas eléctricas para empresas y autónomos en España.",
                                "areaServed": {
                                    "@type": "Country",
                                    "name": "ES",
                                },
                                "knowsAbout": ["tarifas eléctricas", "ahorro energético", "comparador de luz", "consultoría energética"],
                            },
                        ]),
                    }}
                />
            </head>
            <body
                className={`${sansFont.variable} ${displayFont.variable} ${monoFont.variable} antialiased`}
                suppressHydrationWarning
            >
                <div className="bg-noise" aria-hidden="true" />
                <ThemeProvider>
                    <PwaRegister />
                    <GlobalErrorBoundary>
                        {children}
                    </GlobalErrorBoundary>
                    <Toaster position="bottom-right" richColors closeButton />
                </ThemeProvider>
            </body>
        </html>
    );
}
