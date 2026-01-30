'use client';

import { ErrorState } from '@/components/ui/ErrorState';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    // Log error for debugging
    console.error('Global Error:', error);

    return (
        <html lang="es">
            <body className={inter.className}>
                <div className="min-h-screen w-full flex items-center justify-center bg-white">
                    <ErrorState
                        title="Error Crítico del Sistema"
                        description="Ocurrió un error que impidió cargar la aplicación. Nuestro equipo ha sido notificado."
                        retry={reset}
                        home={false}
                    />
                </div>
            </body>
        </html>
    );
}
