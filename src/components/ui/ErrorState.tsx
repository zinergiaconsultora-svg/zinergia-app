'use client';

import React from 'react';
import { Button } from '@/components/ui/primitives/Button';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ErrorStateProps {
    title?: string;
    description?: string;
    retry?: () => void;
    home?: boolean;
}

export function ErrorState({
    title = 'Algo salió mal',
    description = 'Hemos encontrado un error inesperado al procesar tu solicitud.',
    retry,
    home = true
}: ErrorStateProps) {
    const router = useRouter();

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-rose-500/10 ring-1 ring-rose-100">
                <AlertTriangle size={32} strokeWidth={1.5} />
            </div>

            <h3 className="text-xl font-semibold text-slate-900 mb-2">
                {title}
            </h3>

            <p className="text-slate-500 max-w-md mb-8 leading-relaxed">
                {description}
            </p>

            <div className="flex gap-3">
                {retry && (
                    <Button
                        onClick={retry}
                        variant="primary"
                        leftIcon={<RefreshCcw size={18} />}
                    >
                        Intentar de nuevo
                    </Button>
                )}

                {home && (
                    <Button
                        onClick={() => router.push('/dashboard')}
                        variant="secondary"
                        leftIcon={<Home size={18} />}
                    >
                        Ir al Inicio
                    </Button>
                )}
            </div>
        </div>
    );
}
