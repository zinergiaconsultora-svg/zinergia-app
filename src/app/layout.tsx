import type { Metadata, Viewport } from "next";
import { Quicksand } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { Toaster } from "sonner";
import { PwaRegister } from "@/components/PwaRegister";

const quicksand = Quicksand({
    variable: "--font-sans",
    subsets: ["latin"],
    weight: ["300", "400", "600"],
    display: "swap",
    preload: true,
});


export const viewport: Viewport = {
    themeColor: "#4f46e5",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
};

export const metadata: Metadata = {
    title: "Zinergia - Comparador de Tarifas Eléctricas",
    description: "Compara y ahorra en tu factura de luz. Simulador de tarifas eléctricas con IA.",
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
                <link rel="preconnect" href="https://gmjgkzaxmkaggsyczwcm.supabase.co" crossOrigin="anonymous" />
                <link rel="dns-prefetch" href="https://gmjgkzaxmkaggsyczwcm.supabase.co" />
            </head>
            <body
                className={`${quicksand.variable} antialiased font-light`}
            >
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

