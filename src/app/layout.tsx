import type { Metadata } from "next";
import { Quicksand } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { Toaster } from "sonner";

const quicksand = Quicksand({
    variable: "--font-sans",
    subsets: ["latin"],
    weight: ["300", "400", "500", "600"],
    display: "swap",
});


export const metadata: Metadata = {
    title: "Zinergia - Comparador de Tarifas Eléctricas",
    description: "Compara y ahorra en tu factura de luz. Simulador de tarifas eléctricas con IA.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es" suppressHydrationWarning>
            <body
                className={`${quicksand.variable} antialiased font-light`}
            >
                <ThemeProvider>
                    <GlobalErrorBoundary>
                        {children}
                    </GlobalErrorBoundary>
                    <Toaster position="bottom-right" richColors closeButton />
                </ThemeProvider>
            </body>
        </html>
    );
}

